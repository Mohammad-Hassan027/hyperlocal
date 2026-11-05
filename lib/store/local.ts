import { PRESET_LOCATIONS, haversineKm } from "../geo";
import { SEED_WORKERS } from "../seed";
import type {
  AppState,
  CategoryId,
  CreateJobInput,
  Job,
  LatLng,
  Offer,
} from "../types";
import type { StoreAdapter } from "./types";

const KEY = "hyperlocal:v2";

export const SEED_STATE: AppState = {
  workers: SEED_WORKERS,
  jobs: [],
  location: PRESET_LOCATIONS[0],
  myWorkerId: "w1",
  bots: true,
};

const uid = () => Math.random().toString(36).slice(2, 9);
const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);

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

export class LocalStorageAdapter implements StoreAdapter {
  private state: AppState = SEED_STATE;
  private hydrated = false;
  private listeners = new Set<() => void>();

  init(): void {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        this.state = JSON.parse(raw) as AppState;
      } else {
        localStorage.setItem(KEY, JSON.stringify(this.state));
      }
    } catch {}

    window.addEventListener("storage", (e) => {
      if (e.key === KEY && e.newValue) {
        try {
          this.state = JSON.parse(e.newValue) as AppState;
          this.emit();
        } catch {}
      }
    });
  }

  subscribe(callback: () => void): () => void {
    this.init();
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  getState(): AppState {
    return this.state;
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private set(next: AppState) {
    this.state = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    this.emit();
  }

  setLocation(location: LatLng): void {
    this.set({ ...this.state, location });
  }

  setMyWorker(myWorkerId: string): void {
    this.set({ ...this.state, myWorkerId });
  }

  setBots(bots: boolean): void {
    this.set({ ...this.state, bots });
  }

  setOnline(workerId: string, online: boolean): void {
    this.set({
      ...this.state,
      workers: this.state.workers.map((w) =>
        w.id === workerId ? { ...w, online } : w,
      ),
    });
  }

  setBaseRate(workerId: string, baseRate: number): void {
    this.set({
      ...this.state,
      workers: this.state.workers.map((w) =>
        w.id === workerId ? { ...w, baseRate } : w,
      ),
    });
  }

  resetDemo(): void {
    this.set({ ...SEED_STATE, location: this.state.location });
  }

  createJob(input: CreateJobInput): string {
    const id = uid();
    const customerLoc = this.state.location;

    let broadcastTo: string[];
    if (input.preferredWorkerId) {
      broadcastTo = [input.preferredWorkerId];
    } else {
      broadcastTo = nearbyWorkers(
        this.state,
        customerLoc,
        input.radiusKm,
        input.category,
      )
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
    this.set({ ...this.state, jobs: [job, ...this.state.jobs] });

    if (this.state.bots) {
      for (const wid of broadcastTo) {
        if (wid === this.state.myWorkerId) continue;
        const delay = 1500 + Math.random() * 7000;
        setTimeout(() => this.botRespond(id, wid), delay);
      }
    }
    return id;
  }

  private botRespond(jobId: string, workerId: string) {
    const job = this.state.jobs.find((j) => j.id === jobId);
    const worker = this.state.workers.find((w) => w.id === workerId);
    if (!job || !worker || job.status !== "open") return;
    if (job.offers.some((o) => o.workerId === workerId)) return;
    if (Math.random() < 0.15) return;

    if (job.budget >= worker.baseRate * 0.95) {
      this.submitOffer(jobId, workerId, job.budget, "accept");
    } else {
      const counter = round10(worker.baseRate * (0.92 + Math.random() * 0.14));
      this.submitOffer(jobId, workerId, counter, "counter");
    }
  }

  submitOffer(
    jobId: string,
    workerId: string,
    price: number,
    kind: Offer["kind"],
  ): void {
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "open" || (kind === "accept" && job.assignedWorkerId)) return;

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
            offers: [
              ...others.map((o) => ({ ...o, status: "rejected" as const })),
              offer,
            ],
            status: "accepted",
            assignedWorkerId: workerId,
            finalPrice: price,
            acceptedAt: Date.now(),
          }
        : { ...job, offers: [...others, offer] };

    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) => (j.id === jobId ? next : j)),
    });
  }

  acceptOffer(jobId: string, offerId: string): void {
    const job = this.state.jobs.find((j) => j.id === jobId);
    const offer = job?.offers.find((o) => o.id === offerId);
    if (!job || !offer || job.status !== "open" || job.assignedWorkerId) return;

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
    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) => (j.id === jobId ? next : j)),
    });
  }

  updateBudget(jobId: string, budget: number): void {
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "open") return;
    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) => (j.id === jobId ? { ...j, budget } : j)),
    });
    if (this.state.bots) {
      for (const wid of job.broadcastTo) {
        if (wid === this.state.myWorkerId) continue;
        const w = this.state.workers.find((x) => x.id === wid);
        if (w && budget >= w.baseRate * 0.95) {
          setTimeout(() => this.botRespond(jobId, wid), 800 + Math.random() * 2500);
        }
      }
    }
  }

  cancelJob(jobId: string): void {
    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) =>
        j.id === jobId && (j.status === "open" || j.status === "accepted")
          ? { ...j, status: "cancelled" }
          : j,
      ),
    });
  }

  advanceJob(jobId: string): void {
    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) => {
        if (j.id !== jobId) return j;
        if (j.status === "accepted")
          return { ...j, status: "in_progress", startedAt: Date.now() };
        if (j.status === "in_progress")
          return { ...j, status: "completed", completedAt: Date.now() };
        return j;
      }),
    });
  }

  submitReview(jobId: string, rating: number, text: string): void {
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "completed" || job.review || !job.assignedWorkerId)
      return;

    const workers = this.state.workers.map((w) => {
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
    this.set({
      ...this.state,
      workers,
      jobs: this.state.jobs.map((j) =>
        j.id === jobId ? { ...j, review: { rating, text } } : j,
      ),
    });
  }
}
