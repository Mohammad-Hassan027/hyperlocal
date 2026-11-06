"use client";

import {
  acceptOffer,
  advanceJob,
  createJob,
  getStoreAdapter,
  resetDemo,
  setLocation,
  startJobWithOtp,
  submitOffer,
  submitReview,
} from "./store";
import { PRESET_LOCATIONS } from "./geo";

export interface JudgeStep {
  id: number;
  title: string;
  caption: string;
  durationMs: number;
  action?: (context: { jobId?: string; otp?: string }) => Promise<{ jobId?: string; otp?: string } | void> | ({ jobId?: string; otp?: string } | void);
}

export type JudgeStateListener = (state: JudgeRunState) => void;

export interface JudgeRunState {
  isActive: boolean;
  currentStepIndex: number;
  totalSteps: number;
  step: JudgeStep | null;
  progressPercent: number;
  secondsRemaining: number;
}

const listeners = new Set<JudgeStateListener>();

let runState: JudgeRunState = {
  isActive: false,
  currentStepIndex: 0,
  totalSteps: 7,
  step: null,
  progressPercent: 0,
  secondsRemaining: 75,
};

function emit() {
  listeners.forEach((l) => l({ ...runState }));
}

export function subscribeJudgeMode(listener: JudgeStateListener): () => void {
  listeners.add(listener);
  listener({ ...runState });
  return () => {
    listeners.delete(listener);
  };
}

let abortController: AbortController | null = null;

export const JUDGE_STEPS: JudgeStep[] = [
  {
    id: 1,
    title: "1. Posting ₹250 Plumber Request",
    caption: "Customer posts an urgent plumbing job in Thane West with a budget of ₹250.",
    durationMs: 8000,
    action: () => {
      resetDemo();
      setLocation(PRESET_LOCATIONS[0]);
      const jobId = createJob({
        category: "plumber",
        description: "Kitchen sink drain leaking onto cabinet floor",
        budget: 250,
        radiusKm: 10,
        mode: "on-demand",
      });
      return { jobId };
    },
  },
  {
    id: 2,
    title: "2. Worker Counter-Offer Received",
    caption: "Nearby plumber Ramesh Yadav (w1) evaluates the distance and counters with ₹350 fair market rate.",
    durationMs: 9000,
    action: ({ jobId }) => {
      if (!jobId) return;
      submitOffer(jobId, "w1", 350, "counter");
    },
  },
  {
    id: 3,
    title: "3. Best Match Highlighted",
    caption: "Algorithm calculates match score (4.8★, 412 jobs, 12 yrs exp) and flags Ramesh as 'Best match'.",
    durationMs: 9000,
  },
  {
    id: 4,
    title: "4. Customer Accepts & Receives Start OTP",
    caption: "Customer accepts ₹350 offer. A private 4-digit Start OTP is generated for on-site verification.",
    durationMs: 11000,
    action: ({ jobId }) => {
      if (!jobId) return;
      const state = getStoreAdapter().getState();
      const job = state.jobs.find((j) => j.id === jobId);
      const offer = job?.offers.find((o) => o.workerId === "w1");
      if (offer) {
        acceptOffer(jobId, offer.id);
      }
      const updatedJob = getStoreAdapter().getState().jobs.find((j) => j.id === jobId);
      return { jobId, otp: updatedJob?.startOtp };
    },
  },
  {
    id: 5,
    title: "5. Worker En Route with Live Map Tracking",
    caption: "Live GPS simulation shows Ramesh travelling toward Thane West customer location at demo speed.",
    durationMs: 12000,
    action: () => {
      getStoreAdapter().setDemoSpeed(20);
    },
  },
  {
    id: 6,
    title: "6. OTP Verified & Work In Progress",
    caption: "Worker arrives at doorstep, inputs customer's 4-digit OTP. Verified! Status moves to In Progress.",
    durationMs: 12000,
    action: ({ jobId, otp }) => {
      if (!jobId) return;
      const job = getStoreAdapter().getState().jobs.find((j) => j.id === jobId);
      const code = otp || job?.startOtp || "1234";
      startJobWithOtp(jobId, code);
    },
  },
  {
    id: 7,
    title: "7. Job Completed & 5-Star Review",
    caption: "Plumbing repair finished. Customer leaves a 5★ rating with feedback. Worker reputation updated live!",
    durationMs: 12000,
    action: ({ jobId }) => {
      if (!jobId) return;
      advanceJob(jobId); // moves to completed
      submitReview(jobId, 5, "Arrived in 15 mins, fixed the sink drain cleanly. Polite and professional!");
    },
  },
];

export async function startJudgeMode(onNavigate?: (path: string) => void) {
  if (runState.isActive) return;

  abortController = new AbortController();
  const signal = abortController.signal;

  if (onNavigate) {
    onNavigate("/customer");
  }

  runState = {
    isActive: true,
    currentStepIndex: 0,
    totalSteps: JUDGE_STEPS.length,
    step: JUDGE_STEPS[0],
    progressPercent: 0,
    secondsRemaining: Math.round(JUDGE_STEPS.reduce((acc, s) => acc + s.durationMs, 0) / 1000),
  };
  emit();

  let context: { jobId?: string; otp?: string } = {};

  try {
    for (let i = 0; i < JUDGE_STEPS.length; i++) {
      if (signal.aborted) break;

      const current = JUDGE_STEPS[i];
      runState.currentStepIndex = i;
      runState.step = current;
      runState.progressPercent = Math.round((i / JUDGE_STEPS.length) * 100);
      emit();

      if (current.action) {
        const res = await current.action(context);
        if (res) context = { ...context, ...res };
      }

      // Segment tick delay
      const stepSeconds = current.durationMs / 1000;
      for (let s = 0; s < stepSeconds; s++) {
        if (signal.aborted) break;
        await new Promise((r) => setTimeout(r, 1000));
        runState.secondsRemaining = Math.max(0, runState.secondsRemaining - 1);
        emit();
      }
    }
  } catch (e) {
    console.error("Judge mode error:", e);
  } finally {
    runState = {
      isActive: false,
      currentStepIndex: 0,
      totalSteps: JUDGE_STEPS.length,
      step: null,
      progressPercent: 100,
      secondsRemaining: 0,
    };
    emit();
  }
}

export function stopJudgeMode() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  runState = {
    isActive: false,
    currentStepIndex: 0,
    totalSteps: JUDGE_STEPS.length,
    step: null,
    progressPercent: 0,
    secondsRemaining: 0,
  };
  emit();
}
