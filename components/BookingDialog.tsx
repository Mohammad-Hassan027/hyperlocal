"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inr } from "@/lib/geo";
import { categoryById } from "@/lib/seed";
import { createJob, fairRange, nearbyWorkers, useStore } from "@/lib/store";
import type { CategoryId, JobMode, Worker } from "@/lib/types";

export default function BookingDialog({
  category,
  preferred,
  radiusKm: initialRadius,
  onClose,
  onCreated,
}: {
  category: CategoryId;
  preferred?: Worker;
  radiusKm: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const state = useStore((s) => s);
  const cat = categoryById(category);
  const range = useMemo(
    () => fairRange(state, state.location, initialRadius, category),
    [state, initialRadius, category],
  );

  // Offline workers can't take on-demand jobs, so they're booked for a set time.
  const offline = !!preferred && !preferred.online;
  const typical = range ? Math.round((range.min + range.max) / 2 / 10) * 10 : 300;
  const [mode, setMode] = useState<JobMode>(offline ? "scheduled" : "on-demand");
  const [when, setWhen] = useState("");
  const [desc, setDesc] = useState("");
  const [budget, setBudget] = useState<number>(preferred ? preferred.baseRate : typical);
  const [radius, setRadius] = useState(initialRadius);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  // Mount-only: focus the first field once and close on Escape (parent re-renders must not steal focus).
  useEffect(() => {
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reach = useMemo(() => {
    if (preferred) return 1;
    return nearbyWorkers(state, state.location, radius, category).filter(
      (x) => mode === "scheduled" || x.worker.online,
    ).length;
  }, [state, preferred, radius, category, mode]);

  const canSubmit = desc.trim().length >= 3 && budget > 0 && (mode === "on-demand" || when !== "");

  const submit = () => {
    createJob({
      category,
      description: desc.trim(),
      mode,
      scheduledFor: mode === "scheduled" ? when : undefined,
      budget,
      radiusKm: radius,
      preferredWorkerId: preferred?.id,
    });
    onCreated();
  };

  const chips: [string, number][] = !range
    ? []
    : range.min === range.max
      ? [["Nearby rate", range.min]]
      : [
          ["Lowest nearby", range.min],
          ["Typical", typical],
          ["Highest nearby", range.max],
        ];

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-end bg-ink/60 sm:place-items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-title"
        className="flyer dialog-in max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-b-none sm:rounded-b-[3px]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4" style={{ background: cat.tone }}>
          <div>
            <h2 id="book-title" className="text-2xl">
              Book a {cat.label.toLowerCase()}
            </h2>
            <p className="text-[15px] font-semibold">
              {preferred
                ? `This request goes to ${preferred.name} only.`
                : `Goes to every ${mode === "on-demand" ? "online " : ""}${cat.label.toLowerCase()} in range.`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 grid size-10 place-items-center rounded hover:bg-ink/10">
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
              <path d="M4 4l12 12M16 4L4 16" stroke="#0f1a4d" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="space-y-5 px-5 py-5">
          <div>
            <label htmlFor="job-desc" className="label">
              What needs doing?
            </label>
            <textarea
              id="job-desc"
              ref={textRef}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="Kitchen tap leaks even when closed"
              className="field"
            />
            <p className="mt-1 text-sm text-muted">A line or two helps the worker bring the right tools.</p>
          </div>

          <fieldset>
            <legend className="label">When</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={offline}
                aria-pressed={mode === "on-demand"}
                onClick={() => setMode("on-demand")}
                className={`btn ${mode === "on-demand" ? "btn-neel" : "btn-line"}`}
              >
                As soon as possible
              </button>
              <button
                type="button"
                aria-pressed={mode === "scheduled"}
                onClick={() => setMode("scheduled")}
                className={`btn ${mode === "scheduled" ? "btn-neel" : "btn-line"}`}
              >
                Pick a time
              </button>
            </div>
            {offline && (
              <p className="mt-1.5 text-sm text-muted">
                {preferred?.name.split(" ")[0]} is offline right now, so choose a time they can come.
              </p>
            )}
            {mode === "scheduled" && (
              <input
                type="datetime-local"
                aria-label="Date and time"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="field mt-2"
              />
            )}
          </fieldset>

          <div>
            <label htmlFor="job-budget" className="label">
              Your budget
            </label>
            <div className="flex items-center gap-2">
              <span className="num text-3xl">₹</span>
              <input
                id="job-budget"
                type="number"
                inputMode="numeric"
                min={50}
                step={10}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="field num w-36 text-2xl"
              />
            </div>
            {chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {chips.map(([l, v]) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setBudget(v)}
                    aria-pressed={budget === v}
                    className={`rounded-md border-2 px-2.5 py-1 text-left text-sm leading-tight ${
                      budget === v ? "border-ink bg-marigold-soft" : "border-ink/30 hover:border-ink/60"
                    }`}
                  >
                    <span className="block text-muted">{l}</span>
                    <span className="num text-base">{inr(v)}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-sm text-muted">
              Workers can take the job at this price, or reply with their own. You choose.
            </p>
          </div>

          {!preferred && (
            <div>
              <label htmlFor="job-radius" className="label">
                Search within {radius} km
              </label>
              <input
                id="job-radius"
                type="range"
                min={1}
                max={25}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full accent-neel"
              />
            </div>
          )}
        </div>

        <footer className="tear-t sticky bottom-0 flex flex-wrap items-center justify-between gap-3 bg-paper px-5 py-4">
          <p className="text-[15px] font-semibold" aria-live="polite">
            {preferred
              ? "1 worker will be notified"
              : reach === 0
                ? "No one in range. Widen the search."
                : `${reach} worker${reach === 1 ? "" : "s"} will be notified`}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-line">
              Cancel
            </button>
            <button onClick={submit} disabled={!canSubmit || reach === 0} className="btn btn-go">
              Send request
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
