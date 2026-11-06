"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import CustomerMapDynamic from "@/components/map/CustomerMapDynamic";
import { Badges, Monogram, StatusTag, Stars } from "@/components/ui";
import { fmtWhen, inr } from "@/lib/geo";
import { categoryById } from "@/lib/seed";
import { flagJob, useStore } from "@/lib/store";

function TrackJobContent() {
  const params = useParams();
  const jobId = typeof params?.jobId === "string" ? params.jobId : "";
  const jobs = useStore((s) => s.jobs);
  const workers = useStore((s) => s.workers);
  const demoSpeed = useStore((s) => s.demoSpeed ?? 20);

  const job = jobs.find((j) => j.id === jobId);
  const assigned = job ? workers.find((w) => w.id === job.assignedWorkerId) : undefined;
  const cat = job ? categoryById(job.category) : undefined;

  const [copied, setCopied] = useState(false);
  const [showSosSheet, setShowSosSheet] = useState(false);
  const [sosReason, setSosReason] = useState("Immediate safety concern");
  const [sosFlagged, setSosFlagged] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!job || !cat) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <div className="flyer p-8 space-y-4">
          <h2 className="text-2xl font-bold">Job Not Found</h2>
          <p className="text-muted">
            The tracking link may be expired or the job ID is invalid.
          </p>
          <Link href="/customer" className="btn btn-go inline-block">
            Back to Customer View
          </Link>
        </div>
      </div>
    );
  }

  // Live ETA calculation
  const totalTripSec = 500 / demoSpeed;
  const elapsedTripSec = Math.max(0, (now - (job.acceptedAt ?? job.createdAt)) / 1000);
  const remainingTripSec = Math.max(0, Math.round(totalTripSec - elapsedTripSec));
  const etaDisplay =
    remainingTripSec === 0
      ? "At your door!"
      : remainingTripSec < 60
        ? `Arriving in ~${remainingTripSec} s`
        : `On the way, about ${Math.ceil(remainingTripSec / 60)} min away`;

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleTriggerSos = () => {
    flagJob(job.id, sosReason);
    setSosFlagged(true);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Read-only Demo Disclaimer Banner */}
      <div className="flex items-center justify-between rounded-md border border-ink/20 bg-paper px-4 py-2 text-xs">
        <span className="font-bold uppercase tracking-wider text-muted">
          📡 Live Tracking · Read-Only View
        </span>
        <span className="rounded bg-wall px-2 py-0.5 font-semibold text-ink">
          Demo Simulation
        </span>
      </div>

      {job.flagged && (
        <div className="rounded-md border-2 border-chilli bg-chilli/10 p-4 text-sm space-y-1">
          <div className="flex items-center gap-2 font-bold text-chilli">
            <span>⚠️ EMERGENCY FLAG ACTIVE ON THIS JOB</span>
            <span className="rounded bg-chilli px-1.5 py-0.5 text-[10px] uppercase text-white font-extrabold">SOS Logged</span>
          </div>
          <p className="text-xs text-ink/80">
            Emergency flag was logged: {job.flaggedReason || "SOS reported"}. (Demo safety simulation)
          </p>
        </div>
      )}

      <article className="flyer overflow-hidden shadow-xl">
        <header className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ background: cat.tone }}>
          <div>
            <h1 className="text-2xl font-bold">{cat.label} Service</h1>
            <p className="text-xs font-semibold text-ink/80">
              {job.customerLoc.label ?? "Customer Location"} · {fmtWhen(job.scheduledFor || new Date(job.createdAt).toISOString())}
            </p>
          </div>
          <StatusTag status={job.status} />
        </header>

        <div className="space-y-5 px-5 py-5">
          <div>
            <p className="text-lg leading-snug">{job.description}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted">Agreed visit price:</span>
              <span className="num text-2xl font-bold">{inr(job.finalPrice ?? job.budget)}</span>
            </div>
          </div>

          {/* Start OTP verification code */}
          {job.status === "accepted" && (
            <div className="rounded-md border-2 border-dashed border-neel bg-wall p-4 text-center space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Start-Job 4-Digit Verification Code
              </span>
              <div className="num text-4xl font-extrabold tracking-widest text-neel">
                {job.startOtp ?? "4821"}
              </div>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Give this code to the worker upon arrival. The worker must input this code on their device before starting work.
              </p>
            </div>
          )}

          {/* Assigned Worker Card */}
          {assigned ? (
            <div className="rounded-md border-2 border-ink/20 p-4 space-y-3 bg-paper">
              <div className="flex items-center gap-3">
                <Monogram name={assigned.name} tone={cat.tone} size={50} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-bold text-lg">
                    {assigned.name} <Stars value={assigned.rating} />
                  </p>
                  <p className="text-sm font-semibold text-signal">
                    {job.status === "accepted" ? (
                      <span className="flex items-center gap-1.5 text-ink">
                        <span className="inline-block size-2 animate-ping rounded-full bg-signal" />
                        {etaDisplay}
                      </span>
                    ) : job.status === "in_progress" ? (
                      "Work currently in progress"
                    ) : (
                      "Job completed"
                    )}
                  </p>
                  <div className="mt-1">
                    <Badges badges={assigned.badges} pendingVerification={assigned.pendingVerification} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-2 text-xs">
                <a
                  href={`tel:${assigned.phone || "+919820112345"}`}
                  className="inline-flex items-center gap-1.5 font-bold text-neel underline underline-offset-2 hover:text-neel-hover"
                >
                  📞 Direct Worker Line: {assigned.phone || "+91 98201 12345"}
                </a>
                <span className="text-muted">Unmasked upon job accept</span>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-wall p-4 text-sm text-center text-muted">
              Waiting for a nearby worker to accept the request…
            </div>
          )}

          {/* Live Map */}
          {assigned && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
                  Live Route & Proximity
                </h3>
                <span className="text-xs font-semibold text-neel">
                  {etaDisplay}
                </span>
              </div>
              <CustomerMapDynamic
                customerLoc={job.customerLoc}
                radiusKm={job.radiusKm}
                workers={[{ worker: assigned, distanceKm: 2.5 }]}
                category={job.category}
                activeJob={job}
                demoSpeed={demoSpeed}
              />
            </div>
          )}

          {/* Action Row: Share link + SOS Button */}
          <div className="tear-t pt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleCopyLink}
              className="btn btn-line text-sm font-bold min-h-[44px] px-4"
            >
              {copied ? "✓ Tracking link copied!" : "🔗 Share live status link"}
            </button>

            <button
              onClick={() => setShowSosSheet(true)}
              className="btn btn-chilli text-sm font-bold min-h-[44px] px-5 shadow-md"
            >
              🚨 SOS Emergency Sheet
            </button>
          </div>
        </div>
      </article>

      {/* SOS Bottom Sheet / Dialog */}
      {showSosSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/60 p-4">
          <div className="flyer w-full max-w-md rounded-t-lg sm:rounded-lg p-6 space-y-5 animate-dialog-in">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-chilli flex items-center gap-2">
                  <span>🚨 Emergency Assistance</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Demo Safety & Hazard Response Center
                </p>
              </div>
              <button
                onClick={() => setShowSosSheet(false)}
                className="text-muted hover:text-ink font-bold text-lg px-2"
                aria-label="Close SOS sheet"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <a
                href="tel:112"
                className="btn btn-chilli w-full text-base font-bold min-h-[48px] shadow-lg flex items-center justify-center gap-2"
              >
                <span>📞 Call 112 (National Emergency Helpline)</span>
              </a>

              <div className="rounded-md border border-ink/20 bg-wall p-3 space-y-2 text-xs">
                <label className="block font-bold">Flag hazard on this job:</label>
                <select
                  value={sosReason}
                  onChange={(e) => setSosReason(e.target.value)}
                  className="field text-xs py-1.5"
                >
                  <option value="Immediate safety concern">Immediate safety concern</option>
                  <option value="Harassment or threat">Harassment or threat</option>
                  <option value="Accident or medical issue">Accident or medical issue</option>
                  <option value="Property hazard / gas / electrical leak">Property hazard / electrical leak</option>
                  <option value="Other emergency">Other emergency</option>
                </select>
                <button
                  onClick={handleTriggerSos}
                  disabled={sosFlagged || job.flagged}
                  className="btn btn-line w-full text-xs font-bold text-chilli hover:border-chilli"
                >
                  {sosFlagged || job.flagged ? "✓ Job Flagged as Emergency" : "Flag Job & Log Safety Report"}
                </button>
              </div>

              <p className="text-[11px] text-muted text-center italic">
                This is a hackathon demo safety sheet. In an actual emergency, always dial 112 or local police directly.
              </p>
            </div>

            <button
              onClick={() => setShowSosSheet(false)}
              className="btn btn-line w-full min-h-[40px] text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackJobPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl py-12 text-center text-muted">
          Loading live tracking…
        </div>
      }
    >
      <TrackJobContent />
    </Suspense>
  );
}