"use client";

import { useSyncExternalStore } from "react";
import { isFirebaseConfigured } from "./firebase";
import { haversineKm } from "./geo";
import { FirestoreAdapter } from "./store/firestore";
import { LocalStorageAdapter, SEED_STATE } from "./store/local";
import type { StoreAdapter } from "./store/types";
import type {
  AppState,
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
  return useSyncExternalStore(
    (cb) => adapter.subscribe(cb),
    () => selector(adapter.getState()),
    () => selector(SEED_STATE),
  );
}

export const getState = () => getStoreAdapter().getState();

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
