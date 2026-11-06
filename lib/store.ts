"use client";

import { useRef, useSyncExternalStore } from "react";
import { isFirebaseConfigured } from "./firebase";
import { haversineKm } from "./geo";
import { FirestoreAdapter } from "./store/firestore";
import { LocalStorageAdapter, SEED_STATE } from "./store/local";
import type { StoreAdapter } from "./store/types";
import type {
  AppState,
  Badge,
  CategoryId,
  CreateJobInput,
  LatLng,
  Offer,
} from "./types";

export type { CreateJobInput };

interface CustomWindow extends Window {
  __STORE_ADAPTER__?: StoreAdapter;
}

let adapterInstance: StoreAdapter | undefined;

export function getStoreAdapter(): StoreAdapter {
  if (!adapterInstance) {
    let adapter: StoreAdapter;
    const customWindow = typeof window !== "undefined" ? (window as unknown as CustomWindow) : undefined;
    if (customWindow?.__STORE_ADAPTER__) {
      adapter = customWindow.__STORE_ADAPTER__;
    } else if (isFirebaseConfigured()) {
      adapter = new FirestoreAdapter();
    } else {
      adapter = new LocalStorageAdapter();
    }
    adapter.init();
    adapterInstance = adapter;
  }
  return adapterInstance;
}

/** Set a custom store adapter (useful for testing) */
export function setStoreAdapter(customAdapter: StoreAdapter | undefined) {
  adapterInstance = customAdapter;
  if (adapterInstance) {
    adapterInstance.init();
  }
}

export function useStore<T>(selector: (s: AppState) => T): T {
  const adapter = getStoreAdapter();
  // Memoize the last (state, result) pair so getSnapshot always returns the
  // same reference when the underlying state object hasn't changed.
  // This prevents React error #185, which fires when useSyncExternalStore's
  // getSnapshot returns a new (non-===) value on consecutive calls without a
  // real store mutation (e.g. derived arrays created by `?? []` or `.filter()`).
  const cache = useRef<{ state: AppState; value: T } | null>(null);

  const getSnapshot = () => {
    const s = adapter.getState();
    if (cache.current !== null && cache.current.state === s) {
      return cache.current.value;
    }
    const value = selector(s);
    cache.current = { state: s, value };
    return value;
  };

  // Server snapshot: run selector against seed state (no caching needed here).
  const getServerSnapshot = () => selector(SEED_STATE);

  return useSyncExternalStore(adapter.subscribe.bind(adapter), getSnapshot, getServerSnapshot);
}

export const getState = () => getStoreAdapter().getState();

/* ----------------------------- matching ----------------------------- */

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

/** Market price range among nearby workers, used for the "fair price" hint. */
export function fairRange(s: AppState, loc: LatLng, radiusKm: number, c: CategoryId) {
  const rates = nearbyWorkers(s, loc, radiusKm, c).map((x) => x.worker.baseRate);
  if (!rates.length) return null;
  return { min: Math.min(...rates), max: Math.max(...rates) };
}

/* ----------------------------- actions ----------------------------- */

export function setLocation(location: LatLng) {
  getStoreAdapter().setLocation(location);
}

export function setMyWorker(myWorkerId: string) {
  getStoreAdapter().setMyWorker(myWorkerId);
}

export function setBots(bots: boolean) {
  getStoreAdapter().setBots(bots);
}

export function setDemoSpeed(speed: number) {
  getStoreAdapter().setDemoSpeed(speed);
}

export function setOnline(workerId: string, online: boolean) {
  getStoreAdapter().setOnline(workerId, online);
}

export function setBaseRate(workerId: string, baseRate: number) {
  getStoreAdapter().setBaseRate(workerId, baseRate);
}

export function resetDemo() {
  getStoreAdapter().resetDemo();
}

export function createJob(input: CreateJobInput): string {
  return getStoreAdapter().createJob(input);
}

export function submitOffer(
  jobId: string,
  workerId: string,
  price: number,
  kind: Offer["kind"],
) {
  getStoreAdapter().submitOffer(jobId, workerId, price, kind);
}

export function acceptOffer(jobId: string, offerId: string) {
  getStoreAdapter().acceptOffer(jobId, offerId);
}

export function updateBudget(jobId: string, budget: number) {
  getStoreAdapter().updateBudget(jobId, budget);
}

export function cancelJob(jobId: string) {
  getStoreAdapter().cancelJob(jobId);
}

export function advanceJob(jobId: string) {
  getStoreAdapter().advanceJob(jobId);
}

export function submitReview(jobId: string, rating: number, text: string) {
  getStoreAdapter().submitReview(jobId, rating, text);
}

export function customerCounterOffer(jobId: string, offerId: string, price: number) {
  getStoreAdapter().customerCounterOffer(jobId, offerId, price);
}

export function workerRespondToCounter(
  jobId: string,
  offerId: string,
  decision: "accept" | "decline",
) {
  getStoreAdapter().workerRespondToCounter(jobId, offerId, decision);
}

export function declineJob(jobId: string, workerId: string) {
  getStoreAdapter().declineJob(jobId, workerId);
}

export function switchToScheduled(jobId: string, scheduledFor?: string) {
  getStoreAdapter().switchToScheduled(jobId, scheduledFor);
}

export function dismissNotification(id: string) {
  getStoreAdapter().dismissNotification(id);
}

export function clearNotifications() {
  getStoreAdapter().clearNotifications();
}

export function startJobWithOtp(jobId: string, otp: string): boolean {
  return getStoreAdapter().startJobWithOtp(jobId, otp);
}

export function flagJob(jobId: string, reason: string) {
  getStoreAdapter().flagJob(jobId, reason);
}

export function reportProblem(jobId: string, reason: string, details?: string) {
  getStoreAdapter().reportProblem(jobId, reason, details);
}

export function blockWorker(workerId: string) {
  getStoreAdapter().blockWorker(workerId);
}

export function unblockWorker(workerId: string) {
  getStoreAdapter().unblockWorker(workerId);
}

export function joinWorker(input: {
  name: string;
  categories: CategoryId[];
  baseRate: number;
  area: string;
  bio?: string;
  phone?: string;
  idDocumentName?: string;
}): string {
  return getStoreAdapter().joinWorker(input);
}

export function toggleWorkerBadge(workerId: string, badge: Badge) {
  getStoreAdapter().toggleWorkerBadge(workerId, badge);
}

export function setWorkerVerification(workerId: string, pending: boolean) {
  getStoreAdapter().setWorkerVerification(workerId, pending);
}
