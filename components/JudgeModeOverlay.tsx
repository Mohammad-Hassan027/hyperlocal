"use client";

import { useEffect, useState } from "react";
import {
  subscribeJudgeMode,
  stopJudgeMode,
  type JudgeRunState,
} from "@/lib/judge";

export default function JudgeModeOverlay() {
  const [state, setState] = useState<JudgeRunState>({
    isActive: false,
    currentStepIndex: 0,
    totalSteps: 7,
    step: null,
    progressPercent: 0,
    secondsRemaining: 0,
  });

  useEffect(() => {
    return subscribeJudgeMode((s) => setState(s));
  }, []);

  if (!state.isActive || !state.step) return null;

  return (
    <aside
      aria-label="Judge mode demo narration"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl animate-dialog-in"
    >
      <div className="flyer rounded-md border-3 border-ink bg-paper p-4 shadow-2xl">
        {/* Top bar with Step info & Skip button */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex size-3 items-center justify-center rounded-full bg-signal">
              <span className="size-2 animate-ping rounded-full bg-signal" />
            </span>
            <span className="font-display text-sm tracking-wide text-ink">
              JUDGE MODE DEMO • {state.step.title}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono font-bold text-muted">
              ~{state.secondsRemaining}s remaining
            </span>
            <button
              onClick={stopJudgeMode}
              className="rounded border border-ink/40 bg-wall px-2.5 py-1 font-bold text-ink hover:bg-chilli hover:text-white"
            >
              ✕ Skip Demo
            </button>
          </div>
        </div>

        {/* Caption Narration */}
        <div className="pt-2.5">
          <p className="text-base font-semibold leading-snug text-ink sm:text-lg">
            {state.step.caption}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-wall border border-ink/20">
            <div
              className="h-full bg-marigold transition-all duration-1000"
              style={{ width: `${state.progressPercent}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-muted">
            Step {state.currentStepIndex + 1}/{state.totalSteps}
          </span>
        </div>
      </div>
    </aside>
  );
}
