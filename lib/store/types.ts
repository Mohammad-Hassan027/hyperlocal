import type { AppState, Badge, CategoryId, CreateJobInput, LatLng, Offer } from "../types";

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
  setDemoSpeed(speed: number): void;
  customerCounterOffer(
    jobId: string,
    offerId: string,
    price: number,
  ): Promise<void> | void;
  workerRespondToCounter(
    jobId: string,
    offerId: string,
    decision: "accept" | "decline",
  ): Promise<void> | void;
  declineJob(jobId: string, workerId: string): Promise<void> | void;
  switchToScheduled(jobId: string, scheduledFor?: string): Promise<void> | void;
  dismissNotification(id: string): void;
  clearNotifications(): void;
  startJobWithOtp(jobId: string, otp: string): boolean;
  flagJob(jobId: string, reason: string): Promise<void> | void;
  reportProblem(jobId: string, reason: string, details?: string): Promise<void> | void;
  blockWorker(workerId: string): void;
  unblockWorker(workerId: string): void;
  joinWorker(input: {
    name: string;
    categories: CategoryId[];
    baseRate: number;
    area: string;
    bio?: string;
    phone?: string;
    idDocumentName?: string;
  }): string;
  toggleWorkerBadge(workerId: string, badge: Badge): Promise<void> | void;
  setWorkerVerification(workerId: string, pending: boolean): Promise<void> | void;
}
