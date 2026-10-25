"use client";

import { useSyncExternalStore } from "react";
import { haversineKm } from "./geo";
import { PRESET_LOCATIONS } from "./geo";
import { SEED_WORKERS } from "./seed";
import type {
  AppState,
  CategoryId,
  Job,
  JobMode,
  LatLng,
  Offer,
} from "./types";

/**
 * Tiny cross-tab store (localStorage + `storage` event).
 * Open /customer in one tab and /worker in another to see live broadcast.
 * To go real-time with Firebase: replace `set()` with Firestore writes and
 * `subscribe()` with onSnapshot listeners — the action signatures stay the same.
 */

const KEY = "hyperlocal:v2";

const SEED_STATE: AppState = {
  workers: SEED_WORKERS,
  jobs: [],
  location: PRESET_LOCATIONS[0],
  myWorkerId: "w1",
  bots: true,
};

let state: AppState = SEED_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function set(next: AppState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  emit();
}

function subscribe(cb: () => void) {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = JSON.parse(raw) as AppState;
    } catch {}
    window.addEventListener("storage", (e) => {
      if (e.key === KEY && e.newValue) {
        try {
          state = JSON.parse(e.newValue) as AppState;
          emit();
        } catch {}
      }
    });
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(SEED_STATE),
  );
}

export const getState = () => state;

const uid = () => Math.random().toString(36).slice(2, 9);
const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);

/* ----------------------------- matching ----------------------------- */

export function nearbyWorkers(
  s: AppState,
  loc: LatLng,
  radiusKm: number,
  category?: CategoryId,
) {
  return s.workers
    .filter((w) => !category || w.categories.includes(category))
    .map((w) => ({ worker: w, distanceKm: haversineKm(loc, w.loc) }))
    .filter((x) => x.distanceKm <= radiusKm);
}

/** Market price range among nearby workers, used for the "fair price" hint. */
export function fairRange(s: AppState, loc: LatLng, radiusKm: number, c: CategoryId) {
  const rates = nearbyWorkers(s, loc, radiusKm, c).map((x) => x.worker.baseRate);
  if (!rates.length) return null;
  return { min: Math.min(...rates), max: Math.max(...rates) };
}

/* ----------------------------- actions ----------------------------- */

export function setLocation(location: LatLng) {
  set({ ...state, location });
}

export function setMyWorker(myWorkerId: string) {
  set({ ...state, myWorkerId });
}

export function setBots(bots: boolean) {
  set({ ...state, bots });
}

export function setOnline(workerId: string, online: boolean) {
  set({
    ...state,
    workers: state.workers.map((w) => (w.id === workerId ? { ...w, online } : w)),
  });
}

export function setBaseRate(workerId: string, baseRate: number) {
  set({
    ...state,
    workers: state.workers.map((w) => (w.id === workerId ? { ...w, baseRate } : w)),
  });
}

export function resetDemo() {
  set({ ...SEED_STATE, location: state.location });
}

export interface CreateJobInput {
  category: CategoryId;
  description: string;
  mode: JobMode;
  scheduledFor?: string;
  budget: number;
  radiusKm: number;
  /** Book a specific worker instead of broadcasting to everyone nearby */
  preferredWorkerId?: string;
}

export function createJob(input: CreateJobInput): string {
  const id = uid();
  const customerLoc = state.location;

  let broadcastTo: string[];
  if (input.preferredWorkerId) {
    broadcastTo = [input.preferredWorkerId];
  } else {
    broadcastTo = nearbyWorkers(state, customerLoc, input.radiusKm, input.category)
      // On-demand needs online workers; scheduled can notify anyone in range.
      .filter((x) => input.mode === "scheduled" || x.worker.online)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .map((x) => x.worker.id);
  }

  const job: Job = {
    id,
    category: input.category,
    description: input.description,
    mode: input.mode,
    scheduledFor: input.scheduledFor,
    budget: input.budget,
    radiusKm: input.radiusKm,
    customerLoc,
    status: "open",
    broadcastTo,
    offers: [],
    createdAt: Date.now(),
  };
  set({ ...state, jobs: [job, ...state.jobs] });

  if (state.bots) {
    for (const wid of broadcastTo) {
      if (wid === state.myWorkerId) continue; // the human responds manually
      const delay = 1500 + Math.random() * 7000;
      setTimeout(() => botRespond(id, wid), delay);
    }
  }
  return id;
}

function botRespond(jobId: string, workerId: string) {
  const job = state.jobs.find((j) => j.id === jobId);
  const worker = state.workers.find((w) => w.id === workerId);
  if (!job || !worker || job.status !== "open") return;
  if (job.offers.some((o) => o.workerId === workerId)) return;
  if (Math.random() < 0.15) return; // some workers just don't respond

  if (job.budget >= worker.baseRate * 0.95) {
    submitOffer(jobId, workerId, job.budget, "accept");
  } else {
    const counter = round10(worker.baseRate * (0.92 + Math.random() * 0.14));
    submitOffer(jobId, workerId, counter, "counter");
  }
}

/**
 * Worker responds to a broadcast.
 * "accept" at the customer's budget = instant match (first come, first served).
 * "counter" = goes to the customer's offer list.
 */
export function submitOffer(
  jobId: string,
  workerId: string,
  price: number,
  kind: Offer["kind"],
) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job || job.status !== "open") return;

  const offer: Offer = {
    id: uid(),
    workerId,
    price,
    kind,
    status: kind === "accept" ? "accepted" : "pending",
    createdAt: Date.now(),
  };

  const others = job.offers.filter((o) => o.workerId !== workerId);
  const next: Job =
    kind === "accept"
      ? {
          ...job,
          offers: [...others.map((o) => ({ ...o, status: "rejected" as const })), offer],
          status: "accepted",
          assignedWorkerId: workerId,
          finalPrice: price,
          acceptedAt: Date.now(),
        }
      : { ...job, offers: [...others, offer] };

  set({ ...state, jobs: state.jobs.map((j) => (j.id === jobId ? next : j)) });
}

/** Customer picks one of the counter-offers. */
export function acceptOffer(jobId: string, offerId: string) {
  const job = state.jobs.find((j) => j.id === jobId);
  const offer = job?.offers.find((o) => o.id === offerId);
  if (!job || !offer || job.status !== "open") return;

  const next: Job = {
    ...job,
    offers: job.offers.map((o) => ({
      ...o,
      status: o.id === offerId ? ("accepted" as const) : ("rejected" as const),
    })),
    status: "accepted",
    assignedWorkerId: offer.workerId,
    finalPrice: offer.price,
    acceptedAt: Date.now(),
  };
  set({ ...state, jobs: state.jobs.map((j) => (j.id === jobId ? next : j)) });
}

/** Customer raises the budget; workers who already countered may now be matched. */
export function updateBudget(jobId: string, budget: number) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job || job.status !== "open") return;
  set({
    ...state,
    jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, budget } : j)),
  });
  if (state.bots) {
    for (const wid of job.broadcastTo) {
      if (wid === state.myWorkerId) continue;
      const w = state.workers.find((x) => x.id === wid);
      if (w && budget >= w.baseRate * 0.95) {
        setTimeout(() => botRespond(jobId, wid), 800 + Math.random() * 2500);
      }
    }
  }
}

export function cancelJob(jobId: string) {
  set({
    ...state,
    jobs: state.jobs.map((j) =>
      j.id === jobId && (j.status === "open" || j.status === "accepted")
        ? { ...j, status: "cancelled" }
        : j,
    ),
  });
}

export function advanceJob(jobId: string) {
  set({
    ...state,
    jobs: state.jobs.map((j) => {
      if (j.id !== jobId) return j;
      if (j.status === "accepted") return { ...j, status: "in_progress", startedAt: Date.now() };
      if (j.status === "in_progress") return { ...j, status: "completed", completedAt: Date.now() };
      return j;
    }),
  });
}

export function submitReview(jobId: string, rating: number, text: string) {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job || job.status !== "completed" || job.review || !job.assignedWorkerId) return;

  const workers = state.workers.map((w) => {
    if (w.id !== job.assignedWorkerId) return w;
    const newRating =
      Math.round(((w.rating * w.jobsDone + rating) / (w.jobsDone + 1)) * 10) / 10;
    return {
      ...w,
      rating: newRating,
      jobsDone: w.jobsDone + 1,
      reviews: [
        {
          id: uid(),
          author: "You",
          rating,
          text: text || "(no comment)",
          date: new Date().toISOString().slice(0, 10),
        },
        ...w.reviews,
      ],
    };
  });
  set({
    ...state,
    workers,
    jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, review: { rating, text } } : j)),
  });
}
