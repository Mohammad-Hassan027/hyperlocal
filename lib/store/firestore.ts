import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureAnonymousAuth, getFirebase } from "../firebase";
import { PRESET_LOCATIONS, haversineKm } from "../geo";
import { SEED_WORKERS } from "../seed";
import type {
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
import { LocalStorageAdapter } from "./local";

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

function cleanUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefined(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === undefined) continue;
    result[key] = cleanUndefined(value);
  }
  return result as T;
}


let _isFirestoreFallenBack = false;
const _fallbackListeners = new Set<(fallback: boolean) => void>();

export function isFirestoreFallenBack(): boolean {
  return _isFirestoreFallenBack;
}

export function subscribeFirestoreFallback(cb: (fallback: boolean) => void): () => void {
  _fallbackListeners.add(cb);
  cb(_isFirestoreFallenBack);
  return () => {
    _fallbackListeners.delete(cb);
  };
}

function notifyFallback(fallback: boolean) {
  _isFirestoreFallenBack = fallback;
  _fallbackListeners.forEach((l) => l(fallback));
}

export class FirestoreAdapter implements StoreAdapter {
  private fallbackAdapter = new LocalStorageAdapter();
  public isFallenBack = false;

  private fallbackToLocal(reason?: unknown) {
    if (this.isFallenBack) return;
    this.isFallenBack = true;
    console.warn("Firestore unavailable; falling back to LocalStorageAdapter:", reason);
    this.unsubscribers.forEach((u) => {
      try { u(); } catch {}
    });
    this.unsubscribers = [];
    this.fallbackAdapter.init();

    // Preserve any jobs currently in state into the fallback adapter
    const currentJobs = this.state.jobs;
    if (currentJobs.length > 0) {
      const localJobs = this.fallbackAdapter.getState().jobs;
      const missing = currentJobs.filter((j) => !localJobs.some((lj) => lj.id === j.id));
      if (missing.length > 0) {
        this.fallbackAdapter.setJobs([...missing, ...localJobs]);
      }
    }

    this.fallbackAdapter.subscribe(() => {
      this.state = this.fallbackAdapter.getState();
      this.emit();
    });
    this.state = this.fallbackAdapter.getState();
    this.emit();
    notifyFallback(true);
  }
  private state: AppState = {
    workers: SEED_WORKERS,
    jobs: [],
    location: PRESET_LOCATIONS[0],
    myWorkerId: "w1",
    bots: true,
    demoSpeed: 20,
    notifications: [],
  };

  private listeners = new Set<() => void>();
  private initialized = false;
  private unsubscribers: Unsubscribe[] = [];
  private isSeedingWorkers = false;

  init(): void {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;

    // Load client-local settings from localStorage
    try {
      const loc = localStorage.getItem("hyperlocal:client_location");
      if (loc) this.state.location = JSON.parse(loc);
      const wid = localStorage.getItem("hyperlocal:my_worker_id");
      if (wid) this.state.myWorkerId = wid;
      const b = localStorage.getItem("hyperlocal:bots");
      if (b !== null) this.state.bots = JSON.parse(b);
      const sp = localStorage.getItem("hyperlocal:demo_speed");
      if (sp !== null) this.state.demoSpeed = JSON.parse(sp);
    } catch {}

    // Await auth before attaching listeners so Firestore permission rules
    // can evaluate request.auth immediately on the first snapshot.
    const { auth, db } = getFirebase();
    ensureAnonymousAuth(auth)
      .then(() => this.attachListeners(db))
      .catch((err) => this.fallbackToLocal(err));
  }

  /**
   * Attach onSnapshot listeners for workers and jobs.
   * On a permission-denied error, re-auth once and retry; if the retry also
   * fails, call fallbackToLocal so the UI degrades gracefully.
   */
  private attachListeners(db: ReturnType<typeof getFirebase>["db"], isRetry = false): void {
    // Tear down any existing listeners before re-subscribing on retry.
    this.unsubscribers.forEach((u) => { try { u(); } catch {} });
    this.unsubscribers = [];

    const handleError = async (err: unknown, label: string) => {
      const code = (err as { code?: string }).code ?? "";
      console.warn(`Firestore ${label} snapshot error:`, err);
      if (!isRetry && (code === "permission-denied" || code === "unauthenticated")) {
        // Re-auth once then re-attach
        const { auth } = getFirebase();
        try {
          await ensureAnonymousAuth(auth, true);
          this.attachListeners(db, true);
        } catch (retryErr) {
          this.fallbackToLocal(retryErr);
        }
      } else {
        this.fallbackToLocal(err);
      }
    };

    // Listen to workers collection
    const unsubWorkers = onSnapshot(
      collection(db, "workers"),
      async (snapshot) => {
        if (snapshot.empty && !this.isSeedingWorkers) {
          await this.seedWorkers();
          return;
        }
        const workers = snapshot.docs.map((d) => d.data() as Worker);
        if (workers.length > 0) {
          this.state = { ...this.state, workers };
          this.emit();
        }
      },
      (err) => void handleError(err, "workers"),
    );
    this.unsubscribers.push(unsubWorkers);

    // Listen to jobs collection
    const unsubJobs = onSnapshot(
      collection(db, "jobs"),
      (snapshot) => {
        const jobs = snapshot.docs
          .map((d) => d.data() as Job)
          .sort((a, b) => b.createdAt - a.createdAt);
        this.state = { ...this.state, jobs };
        this.emit();
      },
      (err) => void handleError(err, "jobs"),
    );
    this.unsubscribers.push(unsubJobs);
  }

  private async seedWorkers() {
    this.isSeedingWorkers = true;
    try {
      const { db } = getFirebase();
      const batch = writeBatch(db);
      for (const w of SEED_WORKERS) {
        const ref = doc(db, "workers", w.id);
        batch.set(ref, cleanUndefined(w), { merge: true });
      }
      await batch.commit();
    } catch (err) {
      console.error("Failed to seed workers:", err);
    } finally {
      this.isSeedingWorkers = false;
    }
  }

  subscribe(callback: () => void): () => void {
    this.init();
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  getState(): AppState {
    if (this.isFallenBack) return this.fallbackAdapter.getState();
    const local = this.fallbackAdapter.getState();
    if (local.jobs.length > this.state.jobs.length) {
      return local;
    }
    return this.state;
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  setLocation(location: LatLng): void {
    if (this.isFallenBack) return this.fallbackAdapter.setLocation(location);
    this.state = { ...this.state, location };
    try {
      localStorage.setItem("hyperlocal:client_location", JSON.stringify(location));
    } catch {}
    this.emit();
  }

  setMyWorker(myWorkerId: string): void {
    if (this.isFallenBack) return this.fallbackAdapter.setMyWorker(myWorkerId);
    this.state = { ...this.state, myWorkerId };
    try {
      localStorage.setItem("hyperlocal:my_worker_id", myWorkerId);
    } catch {}
    this.emit();
  }

  setBots(bots: boolean): void {
    if (this.isFallenBack) return this.fallbackAdapter.setBots(bots);
    this.state = { ...this.state, bots };
    try {
      localStorage.setItem("hyperlocal:bots", JSON.stringify(bots));
    } catch {}
    this.emit();
  }

  setDemoSpeed(demoSpeed: number): void {
    if (this.isFallenBack) return this.fallbackAdapter.setDemoSpeed(demoSpeed);
    this.state = { ...this.state, demoSpeed };
    try {
      localStorage.setItem("hyperlocal:demo_speed", JSON.stringify(demoSpeed));
    } catch {}
    this.emit();
  }

  async setOnline(workerId: string, online: boolean): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.setOnline(workerId, online);
    const { db } = getFirebase();
    await updateDoc(doc(db, "workers", workerId), { online });
  }

  async setBaseRate(workerId: string, baseRate: number): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.setBaseRate(workerId, baseRate);
    const { db } = getFirebase();
    await updateDoc(doc(db, "workers", workerId), { baseRate });
  }

  async resetDemo(): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.resetDemo();
    const { db } = getFirebase();
    // 1. Delete all jobs
    const jobsSnap = await getDocs(collection(db, "jobs"));
    if (!jobsSnap.empty) {
      const deleteBatch = writeBatch(db);
      jobsSnap.docs.forEach((d) => deleteBatch.delete(d.ref));
      await deleteBatch.commit();
    }

    // 2. Reseed all workers
    const seedBatch = writeBatch(db);
    for (const w of SEED_WORKERS) {
      const ref = doc(db, "workers", w.id);
      seedBatch.set(ref, cleanUndefined(w));
    }
    await seedBatch.commit();
  }

  createJob(input: CreateJobInput): string {
    if (this.isFallenBack) return this.fallbackAdapter.createJob(input);
    const localId = this.fallbackAdapter.createJob(input);
    const id = localId || uid();
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

    const { db } = getFirebase();
    this.state = {
      ...this.state,
      jobs: [job, ...this.state.jobs],
    };
    this.emit();

    setDoc(doc(db, "jobs", id), cleanUndefined(job)).catch((err) => {
      console.error("Failed to write job to Firestore:", err);
    });

    // Bots run only in the creating client and are idempotent
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

  async submitOffer(
    jobId: string,
    workerId: string,
    price: number,
    kind: Offer["kind"],
  ): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.submitOffer(jobId, workerId, price, kind);
    this.fallbackAdapter.submitOffer(jobId, workerId, price, kind);
    const { db } = getFirebase();
    const jobRef = doc(db, "jobs", jobId);

    if (kind === "accept") {
      // Must use runTransaction so only the first accept wins and a job is never assigned twice
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(jobRef);
        if (!snap.exists()) return;
        const job = snap.data() as Job;

        // Atomic check: only open jobs without an assigned worker can be accepted
        if (job.status !== "open" || job.assignedWorkerId) {
          return;
        }

        const now = Date.now();
        const offer: Offer = {
          id: uid(),
          workerId,
          price,
          kind: "accept",
          status: "accepted",
          createdAt: now,
        };

        const others = (job.offers || []).filter((o) => o.workerId !== workerId);
        const offers = [
          ...others.map((o) => ({ ...o, status: "rejected" as const })),
          offer,
        ];

        tx.update(jobRef, {
          status: "accepted",
          startOtp: job.startOtp || String(Math.floor(1000 + Math.random() * 9000)),
          assignedWorkerId: workerId,
          finalPrice: price,
          acceptedAt: now,
          offers,
        });
      });
    } else {
      // Counter-offer: adds/updates pending counter offer atomically
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(jobRef);
        if (!snap.exists()) return;
        const job = snap.data() as Job;
        if (job.status !== "open") return;

        const offer: Offer = {
          id: uid(),
          workerId,
          price,
          kind: "counter",
          status: "pending",
          createdAt: Date.now(),
        };

        const others = (job.offers || []).filter((o) => o.workerId !== workerId);
        tx.update(jobRef, {
          offers: [...others, offer],
        });
      });
    }
  }

  async acceptOffer(jobId: string, offerId: string): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.acceptOffer(jobId, offerId);
    this.fallbackAdapter.acceptOffer(jobId, offerId);
    const { db } = getFirebase();
    const jobRef = doc(db, "jobs", jobId);

    // Must use runTransaction so only the first accept wins and a job is never assigned twice
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(jobRef);
      if (!snap.exists()) return;
      const job = snap.data() as Job;

      if (job.status !== "open" || job.assignedWorkerId) {
        return;
      }

      const offer = (job.offers || []).find((o) => o.id === offerId);
      if (!offer) return;

      const now = Date.now();
      const offers = job.offers.map((o) => ({
        ...o,
        status: o.id === offerId ? ("accepted" as const) : ("rejected" as const),
      }));

      tx.update(jobRef, {
        status: "accepted",
        startOtp: job.startOtp || String(Math.floor(1000 + Math.random() * 9000)),
        assignedWorkerId: offer.workerId,
        finalPrice: offer.price,
        acceptedAt: now,
        offers,
      });
    });
  }

  async updateBudget(jobId: string, budget: number): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.updateBudget(jobId, budget);
    const { db } = getFirebase();
    const jobRef = doc(db, "jobs", jobId);
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "open") return;

    await updateDoc(jobRef, { budget });

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

  async cancelJob(jobId: string): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.cancelJob(jobId);
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || (job.status !== "open" && job.status !== "accepted")) return;

    const { db } = getFirebase();
    await updateDoc(doc(db, "jobs", jobId), { status: "cancelled" });
  }

  async advanceJob(jobId: string): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.advanceJob(jobId);
    this.fallbackAdapter.advanceJob(jobId);
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job) return;

    const { db } = getFirebase();
    const jobRef = doc(db, "jobs", jobId);

    if (job.status === "accepted") {
      await updateDoc(jobRef, {
        status: "in_progress",
        startedAt: Date.now(),
      });
    } else if (job.status === "in_progress") {
      await updateDoc(jobRef, {
        status: "completed",
        completedAt: Date.now(),
      });
    }
  }

  async submitReview(jobId: string, rating: number, text: string): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.submitReview(jobId, rating, text);
    this.fallbackAdapter.submitReview(jobId, rating, text);
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "completed" || job.review || !job.assignedWorkerId)
      return;

    const worker = this.state.workers.find((w) => w.id === job.assignedWorkerId);
    if (!worker) return;

    const newRating =
      Math.round(((worker.rating * worker.jobsDone + rating) / (worker.jobsDone + 1)) * 10) / 10;
    const newReviews = [
      {
        id: uid(),
        author: "You",
        rating,
        text: text || "(no comment)",
        date: new Date().toISOString().slice(0, 10),
      },
      ...worker.reviews,
    ];

    const { db } = getFirebase();
    const batch = writeBatch(db);
    batch.update(doc(db, "jobs", jobId), { review: { rating, text } });
    batch.update(doc(db, "workers", worker.id), {
      rating: newRating,
      jobsDone: worker.jobsDone + 1,
      reviews: newReviews,
    });
    await batch.commit();
  }

  async customerCounterOffer(jobId: string, offerId: string, price: number): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.customerCounterOffer(jobId, offerId, price);
    const { db } = getFirebase();
    const jobRef = doc(db, "jobs", jobId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(jobRef);
      if (!snap.exists()) return;
      const job = snap.data() as Job;
      if (job.status !== "open" || job.assignedWorkerId) return;

      const offer = (job.offers || []).find((o) => o.id === offerId);
      if (!offer || offer.customerCounterPrice !== undefined) return;

      const now = Date.now();
      const thread = offer.thread ?? [{ sender: "worker" as const, price: offer.price, createdAt: offer.createdAt }];
      const nextOffers = job.offers.map((o) =>
        o.id === offerId
          ? {
              ...o,
              customerCounterPrice: price,
              customerCounterAt: now,
              thread: [...thread, { sender: "customer" as const, price, createdAt: now }],
            }
          : o,
      );

      tx.update(jobRef, { offers: cleanUndefined(nextOffers) });
    });
  }

  async workerRespondToCounter(
    jobId: string,
    offerId: string,
    decision: "accept" | "decline",
  ): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.workerRespondToCounter(jobId, offerId, decision);
    const { db } = getFirebase();
    const jobRef = doc(db, "jobs", jobId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(jobRef);
      if (!snap.exists()) return;
      const job = snap.data() as Job;
      if (job.status !== "open" || job.assignedWorkerId) return;

      const offer = (job.offers || []).find((o) => o.id === offerId);
      if (!offer || offer.customerCounterPrice === undefined) return;

      const now = Date.now();
      if (decision === "accept") {
        const nextOffers = job.offers.map((o) => ({
          ...o,
          status: o.id === offerId ? ("accepted" as const) : ("rejected" as const),
        }));

        tx.update(jobRef, {
          status: "accepted",
          assignedWorkerId: offer.workerId,
          finalPrice: offer.customerCounterPrice,
          acceptedAt: now,
          offers: cleanUndefined(nextOffers),
        });
      } else {
        const nextOffers = job.offers.map((o) =>
          o.id === offerId ? { ...o, status: "declined" as const } : o,
        );
        tx.update(jobRef, { offers: cleanUndefined(nextOffers) });
      }
    });
  }

  async declineJob(jobId: string, workerId: string): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.declineJob(jobId, workerId);
    const { db } = getFirebase();
    const jobRef = doc(db, "jobs", jobId);
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job) return;

    const declinedBy = job.declinedBy ?? [];
    if (declinedBy.includes(workerId)) return;

    await updateDoc(jobRef, { declinedBy: [...declinedBy, workerId] });
  }

  async switchToScheduled(jobId: string, scheduledFor?: string): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.switchToScheduled(jobId, scheduledFor);
    const { db } = getFirebase();
    const jobRef = doc(db, "jobs", jobId);
    const defaultWhen =
      scheduledFor ||
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

    await updateDoc(jobRef, {
      mode: "scheduled",
      scheduledFor: defaultWhen,
    });
  }

  dismissNotification(id: string): void {
    if (this.isFallenBack) return this.fallbackAdapter.dismissNotification(id);
    this.state = {
      ...this.state,
      notifications: (this.state.notifications ?? []).filter((n) => n.id !== id),
    };
    this.emit();
  }

  clearNotifications(): void {
    if (this.isFallenBack) return this.fallbackAdapter.clearNotifications();
    this.state = {
      ...this.state,
      notifications: [],
    };
    this.emit();
  }

  startJobWithOtp(jobId: string, otp: string): boolean {
    if (this.isFallenBack) return this.fallbackAdapter.startJobWithOtp(jobId, otp);
    this.fallbackAdapter.startJobWithOtp(jobId, otp);
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "accepted") return false;
    if (job.startOtp && job.startOtp !== otp.trim()) {
      return false;
    }
    const { db } = getFirebase();
    updateDoc(doc(db, "jobs", jobId), {
      status: "in_progress",
      startedAt: Date.now(),
    }).catch(console.error);
    return true;
  }

  async flagJob(jobId: string, reason: string): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.flagJob(jobId, reason);
    const { db } = getFirebase();
    await updateDoc(doc(db, "jobs", jobId), {
      flagged: true,
      flaggedReason: reason,
    });
  }

  async reportProblem(jobId: string, reason: string, details?: string): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.reportProblem(jobId, reason, details);
    const { db } = getFirebase();
    await updateDoc(doc(db, "jobs", jobId), {
      problemReported: {
        reason,
        details: details || "",
        reportedAt: Date.now(),
      },
    });
  }

  blockWorker(workerId: string): void {
    if (this.isFallenBack) return this.fallbackAdapter.blockWorker(workerId);
    const current = this.state.blockedWorkers ?? [];
    if (current.includes(workerId)) return;
    this.state = {
      ...this.state,
      blockedWorkers: [...current, workerId],
    };
    this.emit();
  }

  unblockWorker(workerId: string): void {
    if (this.isFallenBack) return this.fallbackAdapter.unblockWorker(workerId);
    const current = this.state.blockedWorkers ?? [];
    this.state = {
      ...this.state,
      blockedWorkers: current.filter((id) => id !== workerId),
    };
    this.emit();
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
    if (this.isFallenBack) return this.fallbackAdapter.joinWorker(input);
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
    const { db } = getFirebase();
    setDoc(doc(db, "workers", id), cleanUndefined(newWorker)).catch(console.error);
    return id;
  }

  async toggleWorkerBadge(workerId: string, badge: Badge): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.toggleWorkerBadge(workerId, badge);
    const worker = this.state.workers.find((w) => w.id === workerId);
    if (!worker) return;
    const has = worker.badges.includes(badge);
    const badges = has
      ? worker.badges.filter((b) => b !== badge)
      : [...worker.badges, badge];
    const { db } = getFirebase();
    await updateDoc(doc(db, "workers", workerId), { badges });
  }

  async setWorkerVerification(workerId: string, pending: boolean): Promise<void> {
    if (this.isFallenBack) return this.fallbackAdapter.setWorkerVerification(workerId, pending);
    const { db } = getFirebase();
    await updateDoc(doc(db, "workers", workerId), { pendingVerification: pending });
  }
}
