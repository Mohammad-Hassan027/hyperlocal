import { PRESET_LOCATIONS, haversineKm } from "../geo";
import { notifyUser } from "../notifications";
import { SEED_WORKERS } from "../seed";
import type {
  AppNotification,
  AppState,
  Badge,
  CategoryId,
  CreateJobInput,
  Job,
  LatLng,
  Offer,
  Worker,
} from "../types";
import type { StoreAdapter } from "./types";

const KEY = "hyperlocal:v2";

export const SEED_STATE: AppState = {
  workers: SEED_WORKERS,
  jobs: [],
  location: PRESET_LOCATIONS[0],
  myWorkerId: "w1",
  bots: true,
  demoSpeed: 20,
  notifications: [],
  blockedWorkers: [],
};

const uid = () => Math.random().toString(36).slice(2, 9);
const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);

export function nearbyWorkers(
  s: AppState,
  loc: LatLng,
  radiusKm: number,
  category?: CategoryId,
) {
  const blocked = s.blockedWorkers ?? [];
  return s.workers
    .filter((w) => !blocked.includes(w.id))
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
        const parsed = JSON.parse(raw);
        this.state = {
          ...SEED_STATE,
          ...parsed,
          notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
          blockedWorkers: Array.isArray(parsed.blockedWorkers) ? parsed.blockedWorkers : [],
        };
      } else {
        localStorage.setItem(KEY, JSON.stringify(this.state));
      }
    } catch {}

    window.addEventListener("storage", (e) => {
      if (e.key === KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          this.state = {
            ...SEED_STATE,
            ...parsed,
            notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
            blockedWorkers: Array.isArray(parsed.blockedWorkers) ? parsed.blockedWorkers : [],
          };
          this.emit();
        } catch {}
      }
    });

    // Check for expired jobs every 10 s in the background.
    // We do this here rather than inside getState() so that getState()
    // always returns a stable this.state reference (required by
    // useSyncExternalStore — returning a new object each call causes #185).
    setInterval(() => this.checkExpiry(), 10_000);
  }

  subscribe(callback: () => void): () => void {
    this.init();
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  getState(): AppState {
    // Return the stable this.state reference so useSyncExternalStore's
    // getSnapshot doesn't see a new value on every call (React error #185).
    // Job expiration is handled by checkExpiry(), called on subscribe.
    return this.state;
  }

  /** Expire open jobs whose deadline has passed. Mutates this.state and
   *  emits if anything changed. Called periodically, not inside getState(). */
  private checkExpiry(): void {
    if (typeof window === "undefined") return;
    const now = Date.now();
    let changed = false;
    const jobs = this.state.jobs.map((j) => {
      if (
        j.status === "open" &&
        now >= (j.expiresAt ?? j.createdAt + 15 * 60 * 1000)
      ) {
        changed = true;
        return { ...j, status: "expired" as const };
      }
      return j;
    });
    if (changed) {
      this.state = { ...this.state, jobs };
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
      } catch {}
      this.emit();
    }
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

  setDemoSpeed(demoSpeed: number): void {
    this.set({ ...this.state, demoSpeed });
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

    const now = Date.now();
    const job: Job = {
      id,
      category: input.category,
      description: input.description,
      mode: input.mode,
      scheduledFor: input.scheduledFor,
      budget: input.budget,
      radiusKm: input.radiusKm,
      customerLoc,
      customerPhone: "+91 98201 98765",
      startOtp: String(Math.floor(1000 + Math.random() * 9000)),
      status: "open",
      broadcastTo,
      offers: [],
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000,
    };

    const notif: AppNotification = {
      id: uid(),
      type: "new_request",
      title: "New local request",
      body: `${input.description} (budget ₹${input.budget})`,
      jobId: id,
      createdAt: now,
      read: false,
    };
    notifyUser(notif);

    this.set({
      ...this.state,
      jobs: [job, ...this.state.jobs],
      notifications: [notif, ...(this.state.notifications ?? [])].slice(0, 15),
    });

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

    const now = Date.now();
    const offer: Offer = {
      id: uid(),
      workerId,
      price,
      kind,
      status: kind === "accept" ? "accepted" : "pending",
      createdAt: now,
      thread: [{ sender: "worker", price, createdAt: now }],
    };

    const worker = this.state.workers.find((w) => w.id === workerId);
    const workerName = worker?.name ?? "A nearby worker";
    const notif: AppNotification = {
      id: uid(),
      type: kind === "accept" ? "job_accepted" : "new_offer",
      title: kind === "accept" ? "Job accepted!" : "New counter-offer",
      body:
        kind === "accept"
          ? `${workerName} accepted your request for ₹${price}!`
          : `${workerName} countered with ₹${price}`,
      jobId,
      createdAt: now,
      read: false,
    };
    notifyUser(notif);

    const others = job.offers.filter((o) => o.workerId !== workerId);
    const next: Job =
      kind === "accept"
        ? {
            ...job,
            startOtp: job.startOtp || String(Math.floor(1000 + Math.random() * 9000)),
            offers: [
              ...others.map((o) => ({ ...o, status: "rejected" as const })),
              offer,
            ],
            status: "accepted",
            assignedWorkerId: workerId,
            finalPrice: price,
            acceptedAt: now,
          }
        : { ...job, offers: [...others, offer] };

    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) => (j.id === jobId ? next : j)),
      notifications: [notif, ...(this.state.notifications ?? [])].slice(0, 15),
    });
  }

  customerCounterOffer(jobId: string, offerId: string, price: number): void {
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "open" || job.assignedWorkerId) return;

    const offer = job.offers.find((o) => o.id === offerId);
    if (!offer || offer.customerCounterPrice !== undefined) return; // Only counter once

    const now = Date.now();
    const nextOffers = job.offers.map((o) => {
      if (o.id !== offerId) return o;
      const thread = o.thread ?? [{ sender: "worker" as const, price: o.price, createdAt: o.createdAt }];
      return {
        ...o,
        customerCounterPrice: price,
        customerCounterAt: now,
        thread: [...thread, { sender: "customer" as const, price, createdAt: now }],
      };
    });

    const notif: AppNotification = {
      id: uid(),
      type: "counter_offer",
      title: "Customer countered",
      body: `Customer offered ₹${price} for "${job.description.slice(0, 30)}"`,
      jobId,
      createdAt: now,
      read: false,
    };
    notifyUser(notif);

    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) => (j.id === jobId ? { ...j, offers: nextOffers } : j)),
      notifications: [notif, ...(this.state.notifications ?? [])].slice(0, 15),
    });

    // If worker is simulated bot, auto-evaluate
    if (this.state.bots && offer.workerId !== this.state.myWorkerId) {
      const worker = this.state.workers.find((w) => w.id === offer.workerId);
      const delay = 1500 + Math.random() * 2500;
      setTimeout(() => {
        if (worker && price >= worker.baseRate * 0.9) {
          this.workerRespondToCounter(jobId, offerId, "accept");
        } else {
          this.workerRespondToCounter(jobId, offerId, "decline");
        }
      }, delay);
    }
  }

  workerRespondToCounter(
    jobId: string,
    offerId: string,
    decision: "accept" | "decline",
  ): void {
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "open" || job.assignedWorkerId) return;

    const offer = job.offers.find((o) => o.id === offerId);
    if (!offer || offer.customerCounterPrice === undefined) return;

    const now = Date.now();
    const worker = this.state.workers.find((w) => w.id === offer.workerId);
    const workerName = worker?.name ?? "Worker";

    if (decision === "accept") {
      const finalPrice = offer.customerCounterPrice;
      const nextOffers = job.offers.map((o) => ({
        ...o,
        status: o.id === offerId ? ("accepted" as const) : ("rejected" as const),
      }));

      const notif: AppNotification = {
        id: uid(),
        type: "job_accepted",
        title: "Counter accepted!",
        body: `${workerName} accepted your ₹${finalPrice} offer!`,
        jobId,
        createdAt: now,
        read: false,
      };
      notifyUser(notif);

      this.set({
        ...this.state,
        jobs: this.state.jobs.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: "accepted",
                assignedWorkerId: offer.workerId,
                finalPrice,
                acceptedAt: now,
                offers: nextOffers,
              }
            : j,
        ),
        notifications: [notif, ...(this.state.notifications ?? [])].slice(0, 15),
      });
    } else {
      const nextOffers = job.offers.map((o) =>
        o.id === offerId ? { ...o, status: "declined" as const } : o,
      );

      const notif: AppNotification = {
        id: uid(),
        type: "counter_offer",
        title: "Counter declined",
        body: `${workerName} declined your ₹${offer.customerCounterPrice} counter.`,
        jobId,
        createdAt: now,
        read: false,
      };
      notifyUser(notif);

      this.set({
        ...this.state,
        jobs: this.state.jobs.map((j) => (j.id === jobId ? { ...j, offers: nextOffers } : j)),
        notifications: [notif, ...(this.state.notifications ?? [])].slice(0, 15),
      });
    }
  }

  declineJob(jobId: string, workerId: string): void {
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job) return;

    const declinedBy = job.declinedBy ?? [];
    if (declinedBy.includes(workerId)) return;

    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) =>
        j.id === jobId ? { ...j, declinedBy: [...declinedBy, workerId] } : j,
      ),
    });
  }

  switchToScheduled(jobId: string, scheduledFor?: string): void {
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "open") return;

    const defaultWhen =
      scheduledFor ||
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              mode: "scheduled",
              scheduledFor: defaultWhen,
            }
          : j,
      ),
    });
  }

  dismissNotification(id: string): void {
    this.set({
      ...this.state,
      notifications: (this.state.notifications ?? []).filter((n) => n.id !== id),
    });
  }

  clearNotifications(): void {
    this.set({
      ...this.state,
      notifications: [],
    });
  }

  acceptOffer(jobId: string, offerId: string): void {
    const job = this.state.jobs.find((j) => j.id === jobId);
    const offer = job?.offers.find((o) => o.id === offerId);
    if (!job || !offer || job.status !== "open" || job.assignedWorkerId) return;

    const startOtp = job.startOtp || String(Math.floor(1000 + Math.random() * 9000));
    const next: Job = {
      ...job,
      startOtp,
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

  startJobWithOtp(jobId: string, otp: string): boolean {
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "accepted") return false;
    if (job.startOtp && job.startOtp !== otp.trim()) {
      return false;
    }
    const next: Job = {
      ...job,
      status: "in_progress",
      startedAt: Date.now(),
    };
    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) => (j.id === jobId ? next : j)),
    });
    return true;
  }

  flagJob(jobId: string, reason: string): void {
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const next: Job = {
      ...job,
      flagged: true,
      flaggedReason: reason,
    };
    const notif: AppNotification = {
      id: uid(),
      type: "job_accepted",
      title: "⚠️ Emergency SOS Logged",
      body: `SOS report logged: ${reason} (Demo safety flag recorded)`,
      jobId,
      createdAt: Date.now(),
      read: false,
    };
    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) => (j.id === jobId ? next : j)),
      notifications: [notif, ...(this.state.notifications ?? [])].slice(0, 20),
    });
    notifyUser(notif);
  }

  reportProblem(jobId: string, reason: string, details?: string): void {
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const next: Job = {
      ...job,
      problemReported: {
        reason,
        details,
        reportedAt: Date.now(),
      },
    };
    this.set({
      ...this.state,
      jobs: this.state.jobs.map((j) => (j.id === jobId ? next : j)),
    });
  }

  blockWorker(workerId: string): void {
    const current = this.state.blockedWorkers ?? [];
    if (current.includes(workerId)) return;
    this.set({
      ...this.state,
      blockedWorkers: [...current, workerId],
    });
  }

  unblockWorker(workerId: string): void {
    const current = this.state.blockedWorkers ?? [];
    this.set({
      ...this.state,
      blockedWorkers: current.filter((id) => id !== workerId),
    });
  }

  joinWorker(input: {
    name: string;
    categories: CategoryId[];
    baseRate: number;
    area: string;
    bio?: string;
    phone?: string;
    idDocumentName?: string;
  }): string {
    const id = `w-${Date.now()}`;
    const newWorker: Worker = {
      id,
      name: input.name,
      emoji: "👷",
      bio: input.bio || "Demo applicant profile in sandbox.",
      categories: input.categories,
      baseRate: input.baseRate,
      rating: 5.0,
      jobsDone: 0,
      badges: [],
      reviews: [],
      online: true,
      loc: { ...this.state.location, label: input.area },
      phone: input.phone || `+91 98201 ${String(Math.floor(10000 + Math.random() * 90000))}`,
      pendingVerification: true,
      idDocumentName: input.idDocumentName || "mock_id_card.png",
    };
    this.set({
      ...this.state,
      workers: [newWorker, ...this.state.workers],
    });
    return id;
  }

  toggleWorkerBadge(workerId: string, badge: Badge): void {
    this.set({
      ...this.state,
      workers: this.state.workers.map((w) => {
        if (w.id !== workerId) return w;
        const has = w.badges.includes(badge);
        const nextBadges = has
          ? w.badges.filter((b) => b !== badge)
          : [...w.badges, badge];
        return { ...w, badges: nextBadges };
      }),
    });
  }

  setWorkerVerification(workerId: string, pending: boolean): void {
    this.set({
      ...this.state,
      workers: this.state.workers.map((w) =>
        w.id === workerId ? { ...w, pendingVerification: pending } : w,
      ),
    });
  }
}
