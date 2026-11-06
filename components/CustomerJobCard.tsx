"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { etaMinutes, fmtKm, fmtWhen, haversineKm, inr, maskPhone } from "@/lib/geo";
import { categoryById } from "@/lib/seed";
import {
  acceptOffer,
  blockWorker,
  cancelJob,
  customerCounterOffer,
  reportProblem,
  submitReview,
  switchToScheduled,
  unblockWorker,
  updateBudget,
  useStore,
} from "@/lib/store";
import type { Job } from "@/lib/types";
import { Badges, Monogram, Star, StatusTag, Stars } from "./ui";

const EMPTY_BLOCKED: string[] = [];

export default function CustomerJobCard({ job }: { job: Job }) {
  const workers = useStore((s) => s.workers);
  const blockedWorkers = useStore((s) => s.blockedWorkers) ?? EMPTY_BLOCKED;
  const demoSpeed = useStore((s) => s.demoSpeed ?? 20);
  const cat = categoryById(job.category);
  const assigned = workers.find((w) => w.id === job.assignedWorkerId);
  const isAssignedBlocked = assigned ? blockedWorkers.includes(assigned.id) : false;

  const [newBudget, setNewBudget] = useState(job.budget);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [counterValues, setCounterValues] = useState<Record<string, number>>({});
  const [openCounterOfferId, setOpenCounterOfferId] = useState<string | null>(null);

  // Problem reporting state
  const [showProblemForm, setShowProblemForm] = useState(false);
  const [problemReason, setProblemReason] = useState("Work quality");
  const [problemDetails, setProblemDetails] = useState("");

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (job.status !== "open" && job.status !== "accepted") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [job.status]);
  const waited = Math.max(0, Math.floor((now - job.createdAt) / 1000));

  // 30-minute promise calculations
  const effectiveElapsedSec = Math.max(0, (now - job.createdAt) / 1000) * (demoSpeed || 1);
  const expansionIncrements = Math.floor(effectiveElapsedSec / 60);
  const searchRadius = Math.min(25, job.radiusKm + expansionIncrements * 3);
  const isRadiusWidened =
    job.status === "open" && job.mode === "on-demand" && searchRadius > job.radiusKm;
  const canOfferSchedule =
    job.status === "open" && job.mode === "on-demand" && effectiveElapsedSec >= 300;
  const isExpired =
    job.status === "expired" ||
    (job.status === "open" &&
      now >= (job.expiresAt ?? job.createdAt + 15 * 60 * 1000));

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

        {isExpired && (
          <div className="rounded-md border-2 border-chilli/40 bg-chilli/10 p-3.5">
            <p className="font-bold text-chilli">Request expired</p>
            <p className="mt-1 text-sm text-muted">
              No workers accepted within 15 minutes. You can increase your budget, widen your search, or schedule for a specific time.
            </p>
          </div>
        )}

        {job.status === "open" && !isExpired && (
          <>
            <div className="space-y-2">
              <p className="flex items-center gap-2.5 rounded-md bg-marigold-soft px-3 py-2 text-[15px] font-semibold" aria-live="polite">
                <span aria-hidden="true" className="size-2.5 animate-pulse rounded-full bg-marigold ring-2 ring-ink" />
                Sent to {job.broadcastTo.length} worker{job.broadcastTo.length === 1 ? "" : "s"}. Waiting{" "}
                <span className="num">
                  {Math.floor(waited / 60)}:{String(waited % 60).padStart(2, "0")}
                </span>
              </p>

              {isRadiusWidened && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-ink/25 bg-wall px-3 py-1.5 text-xs font-semibold text-ink">
                  <span className="flex items-center gap-2">
                    <span className="size-2 animate-ping rounded-full bg-neel" />
                    30-minute promise
                  </span>
                  <span className="rounded bg-ink px-2 py-0.5 text-white font-bold">
                    Searching wider: {searchRadius} km
                  </span>
                </div>
              )}

              {canOfferSchedule && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-ink/20 bg-paper p-3 text-xs sm:text-sm">
                  <div>
                    <p className="font-bold">Need this done at a convenient time?</p>
                    <p className="text-muted">Over 5 min waiting. Offline workers can be booked if you pick a time.</p>
                  </div>
                  <button
                    onClick={() => switchToScheduled(job.id)}
                    className="btn btn-go min-h-[38px] px-3 py-1 text-xs"
                  >
                    Schedule instead
                  </button>
                </div>
              )}
            </div>

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
                    const hasCountered = o.customerCounterPrice !== undefined;
                    const isOpenCounterBox = openCounterOfferId === o.id;
                    const myCounterVal = counterValues[o.id] ?? Math.round((job.budget + o.price) / 2 / 10) * 10;

                    return (
                      <li key={o.id} className={`space-y-3 py-3 ${i > 0 ? "tear-t" : ""}`}>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <Monogram name={w.name} tone={cat.tone} />
                          <div className="min-w-44 flex-1">
                            <p className="flex flex-wrap items-center gap-x-3 font-bold">
                              {w.name} <Stars value={w.rating} />
                            </p>
                            <p className="text-sm text-muted">
                              {fmtKm(d)} away, about {etaMinutes(d)} min
                            </p>
                            <p className="text-xs text-muted font-mono mt-0.5">
                              🔒 Phone: {maskPhone(w.phone)} <span className="font-sans text-[11px] italic">(masked until accepted)</span>
                            </p>
                            <div className="mt-1">
                              <Badges badges={w.badges} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="text-right">
                              <div className="num text-2xl leading-none">{inr(o.price)}</div>
                              <div className="mt-0.5 text-xs font-semibold text-muted">
                                {over > 0 ? `${inr(over)} over budget` : "within budget"}
                              </div>
                            </div>
                            {!hasCountered && (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => acceptOffer(job.id, o.id)} className="btn btn-neel text-sm min-h-[38px] px-3">
                                  Accept
                                </button>
                                <button
                                  onClick={() =>
                                    setOpenCounterOfferId(isOpenCounterBox ? null : o.id)
                                  }
                                  className="btn btn-line text-sm min-h-[38px] px-2.5"
                                >
                                  Counter
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Customer Counter Box (Round 2) */}
                        {!hasCountered && isOpenCounterBox && (
                          <div className="rounded-md border border-ink/20 bg-wall p-2.5 text-sm">
                            <label htmlFor={`counter-input-${o.id}`} className="label text-xs">
                              Propose your counter to {w.name.split(" ")[0]} (one round only)
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="num font-bold">₹</span>
                              <input
                                id={`counter-input-${o.id}`}
                                type="number"
                                step={10}
                                min={50}
                                max={o.price}
                                value={myCounterVal}
                                onChange={(e) =>
                                  setCounterValues({
                                    ...counterValues,
                                    [o.id]: Number(e.target.value),
                                  })
                                }
                                className="field num w-28 min-h-[36px] text-sm"
                              />
                              <button
                                onClick={() => {
                                  customerCounterOffer(job.id, o.id, myCounterVal);
                                  setOpenCounterOfferId(null);
                                }}
                                className="btn btn-go text-xs min-h-[36px] px-3"
                              >
                                Send counter
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Negotiation Thread Display */}
                        {hasCountered && (
                          <div className="rounded-md border border-ink/20 bg-paper p-2.5 text-xs space-y-1">
                            <span className="font-bold text-muted uppercase tracking-wider block">
                              Negotiation thread
                            </span>
                            <div className="flex items-center justify-between">
                              <span>1. {w.name.split(" ")[0]} countered:</span>
                              <b className="num">{inr(o.price)}</b>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>2. You countered back:</span>
                              <b className="num">{inr(o.customerCounterPrice!)}</b>
                            </div>
                            <div className="mt-1 font-semibold">
                              {o.status === "declined" ? (
                                <span className="text-chilli">✕ {w.name.split(" ")[0]} declined your counter.</span>
                              ) : o.status === "accepted" ? (
                                <span className="text-signal">✓ {w.name.split(" ")[0]} accepted your counter!</span>
                              ) : (
                                <span className="text-muted italic">Waiting for {w.name.split(" ")[0]} to accept or decline…</span>
                              )}
                            </div>
                          </div>
                        )}
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

        {job.flagged && (
          <div className="rounded-md border-2 border-chilli bg-chilli/10 p-3 text-sm">
            <div className="flex items-center gap-2 font-bold text-chilli">
              <span>⚠️ Emergency SOS Alert Logged</span>
              <span className="rounded bg-chilli px-1.5 py-0.5 text-[10px] uppercase text-white font-extrabold">Active Flag</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {job.flaggedReason || "SOS triggered from live tracking sheet"}. (Demo safety simulation)
            </p>
          </div>
        )}

        {assigned && (job.status === "accepted" || job.status === "in_progress") && (
          <div className="space-y-3">
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
                  <Badges badges={assigned.badges} pendingVerification={assigned.pendingVerification} />
                </div>
              </div>
              <div className="text-right">
                <div className="num text-2xl leading-none">{inr(job.finalPrice ?? job.budget)}</div>
                <div className="mt-0.5 text-xs font-semibold text-muted">agreed price</div>
              </div>
            </div>

            {/* Start-Job OTP Box: only visible on accept */}
            {job.status === "accepted" && (
              <div className="rounded-md border-2 border-dashed border-neel bg-wall p-3 text-center space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Start-Job 4-Digit Code
                </span>
                <div className="num text-3xl font-extrabold tracking-widest text-neel">
                  {job.startOtp ?? "4821"}
                </div>
                <p className="text-xs text-muted">
                  Share this 4-digit code with {assigned.name.split(" ")[0]} upon arrival. The worker must enter it to start.
                </p>
              </div>
            )}

            {/* Direct Contact & Live Tracking Share */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <a
                href={`tel:${assigned.phone || "+919820112345"}`}
                className="btn btn-neel text-xs min-h-[38px] px-3 font-bold"
              >
                📞 Call {assigned.phone || "+91 98201 12345"}
              </a>
              <Link
                href={`/track/${job.id}`}
                className="btn btn-line text-xs min-h-[38px] px-3 font-bold"
              >
                ↗ Share live status & SOS
              </Link>
            </div>
          </div>
        )}

        {job.status === "completed" && assigned && (
          <div className="space-y-3 rounded-md bg-marigold-soft p-3">
            <p className="font-bold">
              {assigned.name} finished the job for {inr(job.finalPrice ?? job.budget)}.
            </p>
            {job.review ? (
              <p className="mt-1 text-[15px]">
                You gave {job.review.rating} out of 5{job.review.text && `: “${job.review.text}”`}
              </p>
            ) : (
              <div className="space-y-2.5">
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

            {/* Problem Reporting & Block Worker */}
            <div className="tear-t pt-2.5 space-y-2">
              {job.problemReported ? (
                <div className="rounded-sm border border-chilli/40 bg-paper p-2 text-xs">
                  <span className="font-bold text-chilli">⚠️ Problem reported:</span>{" "}
                  <span>{job.problemReported.reason}</span>
                  {job.problemReported.details && <p className="mt-0.5 text-muted">“{job.problemReported.details}”</p>}
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => setShowProblemForm((s) => !s)}
                    className="text-xs font-semibold text-chilli underline underline-offset-2"
                  >
                    {showProblemForm ? "Cancel report" : "⚠️ Report a problem"}
                  </button>
                  {showProblemForm && (
                    <div className="mt-2 space-y-2 rounded-md border border-ink/20 bg-paper p-3 text-xs">
                      <label className="block font-bold">Select issue</label>
                      <select
                        value={problemReason}
                        onChange={(e) => setProblemReason(e.target.value)}
                        className="field text-xs py-1.5"
                      >
                        <option value="Work quality">Work quality</option>
                        <option value="Unprofessional behaviour">Unprofessional behaviour</option>
                        <option value="Overcharging">Overcharging</option>
                        <option value="Safety concern">Safety concern</option>
                        <option value="Other">Other</option>
                      </select>
                      <input
                        value={problemDetails}
                        onChange={(e) => setProblemDetails(e.target.value)}
                        placeholder="Additional details (optional)"
                        className="field text-xs py-1.5"
                      />
                      <button
                        onClick={() => {
                          reportProblem(job.id, problemReason, problemDetails);
                          setShowProblemForm(false);
                        }}
                        className="btn btn-chilli text-xs min-h-[34px] px-3 font-bold"
                      >
                        Submit problem report
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-muted">Preference:</span>
                {isAssignedBlocked ? (
                  <button
                    onClick={() => unblockWorker(assigned.id)}
                    className="font-bold text-signal underline"
                  >
                    Unblock {assigned.name.split(" ")[0]}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (confirm(`Block ${assigned.name}? They will not appear in future searches.`)) {
                        blockWorker(assigned.id);
                      }
                    }}
                    className="font-bold text-chilli underline"
                  >
                    Block {assigned.name.split(" ")[0]}
                  </button>
                )}
              </div>
            </div>
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
