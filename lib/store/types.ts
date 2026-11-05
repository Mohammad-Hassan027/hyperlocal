import type { AppState, CreateJobInput, LatLng, Offer } from "../types";

export interface StoreAdapter {
  init(): void;
  subscribe(callback: () => void): () => void;
  getState(): AppState;

  setLocation(loc: LatLng): void;
  setMyWorker(workerId: string): void;
  setBots(bots: boolean): void;
  setOnline(workerId: string, online: boolean): Promise<void> | void;
  setBaseRate(workerId: string, baseRate: number): Promise<void> | void;
  resetDemo(): Promise<void> | void;
  createJob(input: CreateJobInput): string;
  submitOffer(
    jobId: string,
    workerId: string,
    price: number,
    kind: Offer["kind"],
  ): Promise<void> | void;
  acceptOffer(jobId: string, offerId: string): Promise<void> | void;
  updateBudget(jobId: string, budget: number): Promise<void> | void;
  cancelJob(jobId: string): Promise<void> | void;
  advanceJob(jobId: string): Promise<void> | void;
  submitReview(jobId: string, rating: number, text: string): Promise<void> | void;
}
