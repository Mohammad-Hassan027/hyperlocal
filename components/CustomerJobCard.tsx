"use client";

import { useEffect, useState } from "react";
import { etaMinutes, fmtKm, fmtWhen, haversineKm, inr } from "@/lib/geo";
import { categoryById } from "@/lib/seed";
import { acceptOffer, cancelJob, submitReview, updateBudget, useStore } from "@/lib/store";
import type { Job } from "@/lib/types";
import { Badges, Monogram, Star, StatusTag, Stars } from "./ui";

export default function CustomerJobCard({ job }: { job: Job }) {
  const workers = useStore((s) => s.workers);
  const demoSpeed = useStore((s) => s.demoSpeed ?? 20);
  const cat = categoryById(job.category);
  const assigned = workers.find((w) => w.id === job.assignedWorkerId);
  const [newBudget, setNewBudget] = useState(job.budget);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (job.status !== "open" && job.status !== "accepted") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [job.status]);
  const waited = Math.max(0, Math.floor((now - job.createdAt) / 1000));

  // Compute live ETA derived strictly from acceptedAt
  const totalTripSec = 500 / demoSpeed;
  const elapsedTripSec = Math.max(0, (now - (job.acceptedAt ?? job.createdAt)) / 1000);
  const remainingTripSec = Math.max(0, Math.round(totalTripSec - elapsedTripSec));
  const etaDisplay =
    remainingTripSec === 0
      ? "At your door!"
      : remainingTripSec < 60
        ? `Arriving in ~${remainingTripSec} s`
        : `On the way, about ${Math.ceil(remainingTripSec / 60)} min away`;

  const offers = job.offers.filter((o) => o.status === "pending").sort((a, b) => a.price - b.price);
  const active = job.status === "open" || job.status === "accepted";

  return (
    <article className="flyer overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: cat.tone }}>
        <h3 className="text-xl">{cat.label}</h3>
        <StatusTag status={job.status} />
      </header>

      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="text-lg leading-snug">{job.description}</p>
          <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-[15px]">
            <div>
              <dt className="inline text-muted">When: </dt>
              <dd className="inline font-semibold">
                {job.mode === "on-demand" ? "As soon as possible" : fmtWhen(job.scheduledFor)}
              </dd>
            </div>
            <div>
              <dt className="inline text-muted">Your budget: </dt>
              <dd className="inline font-semibold">{inr(job.budget)}</dd>
            </div>
          </dl>
        </div>

        {job.status === "open" && (
          <>
            <p className="flex items-center gap-2.5 rounded-md bg-marigold-soft px-3 py-2 text-[15px] font-semibold" aria-live="polite">
              <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-marigold ring-2 ring-ink" />
              Sent to {job.broadcastTo.length} worker{job.broadcastTo.length === 1 ? "" : "s"}. Waiting{" "}
              <span className="num">
                {Math.floor(waited / 60)}:{String(waited % 60).padStart(2, "0")}
              </span>
            </p>

            {offers.length > 0 && (
              <section aria-label="Counter-offers">
                <h4 className="mb-1 text-lg font-bold">
                  {offers.length} counter-offer{offers.length === 1 ? "" : "s"}, lowest first
                </h4>
                <ul>
                  {offers.map((o, i) => {
                    const w = workers.find((x) => x.id === o.workerId)!;
                    const d = haversineKm(job.customerLoc, w.loc);
                    const over = o.price - job.budget;
                    return (
                      <li key={o.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${i > 0 ? "tear-t" : ""}`}>
                        <Monogram name={w.name} tone={cat.tone} />
                        <div className="min-w-44 flex-1">
                          <p className="flex flex-wrap items-center gap-x-3 font-bold">
                            {w.name} <Stars value={w.rating} />
                          </p>
                          <p className="text-sm text-muted">
                            {fmtKm(d)} away, about {etaMinutes(d)} min
                          </p>
                          <div className="mt-1">
                            <Badges badges={w.badges} />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="num text-2xl leading-none">{inr(o.price)}</div>
                            <div className="mt-0.5 text-xs font-semibold text-muted">
                              {over > 0 ? `${inr(over)} over budget` : "within budget"}
                            </div>
                          </div>
                          <button onClick={() => acceptOffer(job.id, o.id)} className="btn btn-neel">
                            Accept
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <div className="tear-t pt-4">
              <label htmlFor={`raise-${job.id}`} className="label">
                {offers.length ? "Offers too high?" : "No replies yet?"} Raise your budget
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-xl">₹</span>
                <input
                  id={`raise-${job.id}`}
                  type="number"
                  step={10}
                  value={newBudget}
                  onChange={(e) => setNewBudget(Number(e.target.value))}
                  className="field num w-28"
                />
                <button
                  onClick={() => updateBudget(job.id, newBudget)}
                  disabled={newBudget === job.budget || newBudget <= 0}
                  className="btn btn-line"
                >
                  Update budget
                </button>
              </div>
            </div>
          </>
        )}

        {assigned && (job.status === "accepted" || job.status === "in_progress") && (
          <div className="flex items-center gap-3 rounded-md border-2 border-ink/25 p-3">
            <Monogram name={assigned.name} tone={cat.tone} size={48} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-3 font-bold">
                {assigned.name} <Stars value={assigned.rating} />
              </p>
              <p className="text-[15px] font-semibold">
                {job.status === "accepted" ? (
                  <span className="flex items-center gap-1.5 text-ink">
                    <span className="inline-block size-2 animate-ping rounded-full bg-marigold" />
                    {etaDisplay}
                  </span>
                ) : (
                  "Working on it now"
                )}
              </p>
              <div className="mt-1">
                <Badges badges={assigned.badges} />
              </div>
            </div>
            <div className="text-right">
              <div className="num text-2xl leading-none">{inr(job.finalPrice ?? job.budget)}</div>
              <div className="mt-0.5 text-xs font-semibold text-muted">agreed price</div>
            </div>
          </div>
        )}

        {job.status === "completed" && assigned && (
          <div className="rounded-md bg-marigold-soft p-3">
            <p className="font-bold">
              {assigned.name} finished the job for {inr(job.finalPrice ?? job.budget)}.
            </p>
            {job.review ? (
              <p className="mt-1 text-[15px]">
                You gave {job.review.rating} out of 5{job.review.text && `: “${job.review.text}”`}
              </p>
            ) : (
              <div className="mt-2 space-y-2.5">
                <div className="flex gap-0.5" role="radiogroup" aria-label="Your rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      role="radio"
                      aria-checked={n === rating}
                      onClick={() => setRating(n)}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      className="grid size-11 place-items-center rounded"
                    >
                      <Star filled={n <= rating} className="size-8" />
                    </button>
                  ))}
                </div>
                <label htmlFor={`rv-${job.id}`} className="sr-only">
                  Review
                </label>
                <input
                  id={`rv-${job.id}`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="How did it go? (optional)"
                  className="field"
                />
                <button onClick={() => submitReview(job.id, rating, text.trim())} className="btn btn-neel">
                  Submit review
                </button>
              </div>
            )}
          </div>
        )}

        {active && (
          <div className="text-right">
            <button onClick={() => cancelJob(job.id)} className="text-[15px] font-semibold text-chilli underline underline-offset-4">
              Cancel request
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
