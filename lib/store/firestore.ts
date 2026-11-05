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
  CategoryId,
  CreateJobInput,
  Job,
  LatLng,
  Offer,
  Worker,
} from "../types";
import type { StoreAdapter } from "./types";

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

export class FirestoreAdapter implements StoreAdapter {
  private state: AppState = {
    workers: SEED_WORKERS,
    jobs: [],
    location: PRESET_LOCATIONS[0],
    myWorkerId: "w1",
    bots: true,
    demoSpeed: 20,
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

    const { auth, db } = getFirebase();

    // Ensure anonymous authentication
    ensureAnonymousAuth(auth).catch(() => {});

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
          // Keep canonical order or sort by id
          this.state = {
            ...this.state,
            workers,
          };
          this.emit();
        }
      },
      (err) => {
        console.error("Firestore workers snapshot error:", err);
      },
    );
    this.unsubscribers.push(unsubWorkers);

    // Listen to jobs collection
    const unsubJobs = onSnapshot(
      collection(db, "jobs"),
      (snapshot) => {
        const jobs = snapshot.docs
          .map((d) => d.data() as Job)
          .sort((a, b) => b.createdAt - a.createdAt);
        this.state = {
          ...this.state,
          jobs,
        };
        this.emit();
      },
      (err) => {
        console.error("Firestore jobs snapshot error:", err);
      },
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
    return this.state;
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  setLocation(location: LatLng): void {
    this.state = { ...this.state, location };
    try {
      localStorage.setItem("hyperlocal:client_location", JSON.stringify(location));
    } catch {}
    this.emit();
  }

  setMyWorker(myWorkerId: string): void {
    this.state = { ...this.state, myWorkerId };
    try {
      localStorage.setItem("hyperlocal:my_worker_id", myWorkerId);
    } catch {}
    this.emit();
  }

  setBots(bots: boolean): void {
    this.state = { ...this.state, bots };
    try {
      localStorage.setItem("hyperlocal:bots", JSON.stringify(bots));
    } catch {}
    this.emit();
  }

  setDemoSpeed(demoSpeed: number): void {
    this.state = { ...this.state, demoSpeed };
    try {
      localStorage.setItem("hyperlocal:demo_speed", JSON.stringify(demoSpeed));
    } catch {}
    this.emit();
  }

  async setOnline(workerId: string, online: boolean): Promise<void> {
    const { db } = getFirebase();
    await updateDoc(doc(db, "workers", workerId), { online });
  }

  async setBaseRate(workerId: string, baseRate: number): Promise<void> {
    const { db } = getFirebase();
    await updateDoc(doc(db, "workers", workerId), { baseRate });
  }

  async resetDemo(): Promise<void> {
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

    const { db } = getFirebase();
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
        assignedWorkerId: offer.workerId,
        finalPrice: offer.price,
        acceptedAt: now,
        offers,
      });
    });
  }

  async updateBudget(jobId: string, budget: number): Promise<void> {
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
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job || (job.status !== "open" && job.status !== "accepted")) return;

    const { db } = getFirebase();
    await updateDoc(doc(db, "jobs", jobId), { status: "cancelled" });
  }

  async advanceJob(jobId: string): Promise<void> {
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
}
