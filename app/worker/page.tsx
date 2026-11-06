"use client";

import { useSyncExternalStore, useState } from "react";
import WorkerMiniMapDynamic from "@/components/map/WorkerMiniMapDynamic";
import { Badges, Monogram, Note, OnlineDot, StarRow, Stars, StatusTag } from "@/components/ui";
import { etaMinutes, fmtKm, fmtWhen, haversineKm, inr, maskPhone } from "@/lib/geo";
import { categoryById } from "@/lib/seed";
import {
  advanceJob,
  declineJob,
  setBaseRate,
  setMyWorker,
  setOnline,
  startJobWithOtp,
  submitOffer,
  useStore,
  workerRespondToCounter,
} from "@/lib/store";
import type { Job, Worker } from "@/lib/types";

function IncomingRequest({ job, me }: { job: Job; me: Worker }) {
  const cat = categoryById(job.category);
  const dist = haversineKm(job.customerLoc, me.loc);
  const myOffer = job.offers.find((o) => o.workerId === me.id);
  const [counter, setCounter] = useState(Math.max(me.baseRate, job.budget));

  return (
    <article className="flyer overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: cat.tone }}>
        <h3 className="text-xl">{cat.label} needed</h3>
        <span className="rounded-sm bg-paper px-2 py-0.5 text-sm font-bold">
          {job.mode === "on-demand" ? "Needed now" : fmtWhen(job.scheduledFor)}
        </span>
      </header>

      <div className="space-y-4 px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg leading-snug">{job.description}</p>
            <p className="mt-1 text-[15px] text-muted">
              {job.customerLoc.label ?? "Customer"}, {fmtKm(dist)} from you, about {etaMinutes(dist)} min
            </p>
            <p className="mt-0.5 text-xs text-muted font-mono">
              🔒 Customer: {maskPhone(job.customerPhone)} <span className="font-sans italic">(masked until accepted)</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="num text-3xl leading-none">{inr(job.budget)}</div>
            <div className="mt-1 text-xs font-semibold text-muted">customer&apos;s budget</div>
          </div>
        </div>

        <WorkerMiniMapDynamic
          customerLoc={job.customerLoc}
          workerLoc={me.loc}
          distanceKm={dist}
          categoryTone={cat.tone}
          workerEmoji={me.emoji}
        />

        {myOffer ? (
          <div className="space-y-2">
            {myOffer.customerCounterPrice !== undefined ? (
              <div className="rounded-md border-2 border-marigold bg-marigold-soft p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Customer countered your price!</span>
                  <span className="num text-xl font-bold">{inr(myOffer.customerCounterPrice)}</span>
                </div>
                <div className="text-xs space-y-1 text-muted border-t border-ink/20 pt-1.5">
                  <div className="flex justify-between">
                    <span>1. You asked for:</span>
                    <span className="num">{inr(myOffer.price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2. Customer countered:</span>
                    <span className="num">{inr(myOffer.customerCounterPrice)}</span>
                  </div>
                </div>

                {myOffer.status === "declined" ? (
                  <p className="text-xs font-semibold text-chilli pt-1">
                    You declined this counter offer.
                  </p>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() =>
                        workerRespondToCounter(job.id, myOffer.id, "accept")
                      }
                      className="btn btn-go text-xs min-h-[38px] flex-1"
                    >
                      Accept {inr(myOffer.customerCounterPrice)}
                    </button>
                    <button
                      onClick={() =>
                        workerRespondToCounter(job.id, myOffer.id, "decline")
                      }
                      className="btn btn-line text-xs min-h-[38px] px-3 text-chilli"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-md bg-wall px-3 py-2.5 text-[15px]">
                <span>
                  You asked for <b>{inr(myOffer.price)}</b>. Waiting for response.
                </span>
                <button
                  onClick={() => declineJob(job.id, me.id)}
                  className="text-xs font-semibold text-chilli underline underline-offset-4 ml-2"
                >
                  Withdraw
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="tear-t flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <button onClick={() => submitOffer(job.id, me.id, job.budget, "accept")} className="btn btn-neel">
                Take it for {inr(job.budget)}
              </button>
              <span className="text-muted">or ask for</span>
              <div className="flex items-center gap-2">
                <span className="num text-xl">₹</span>
                <input
                  type="number"
                  step={10}
                  min={50}
                  value={counter}
                  onChange={(e) => setCounter(Number(e.target.value))}
                  className="field num w-28"
                  aria-label="Your price"
                />
                <button
                  onClick={() => submitOffer(job.id, me.id, counter, "counter")}
                  disabled={counter === job.budget || counter <= 0}
                  className="btn btn-line"
                >
                  Send price
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => declineJob(job.id, me.id)}
              className="btn btn-line text-chilli text-sm hover:border-chilli"
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

const STEPS = ["Assigned", "Working", "Done"];

function ActiveJob({ job }: { job: Job }) {
  const cat = categoryById(job.category);
  const step = job.status === "accepted" ? 0 : 1;
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");

  const handleStartWithOtp = () => {
    setOtpError("");
    const ok = startJobWithOtp(job.id, otpInput);
    if (!ok) {
      setOtpError("Incorrect 4-digit code. Please ask the customer for the start code shown on their screen.");
    }
  };

  return (
    <article className="flyer overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: cat.tone }}>
        <h3 className="text-xl">{cat.label}</h3>
        <StatusTag status={job.status} />
      </header>
      <div className="space-y-4 px-4 py-4">
        {job.flagged && (
          <div className="rounded-md border-2 border-chilli bg-chilli/10 p-3 text-xs">
            <span className="font-bold text-chilli">⚠️ Job Flagged:</span>{" "}
            <span>{job.flaggedReason || "Emergency flag active on this job"}</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg leading-snug">{job.description}</p>
            <p className="mt-1 text-[15px] text-muted">
              {job.customerLoc.label ?? "Customer"},{" "}
              {job.mode === "on-demand" ? "as soon as possible" : fmtWhen(job.scheduledFor)}
            </p>
            <p className="mt-1 text-sm font-bold text-neel">
              📞 Customer Phone:{" "}
              <a href={`tel:${job.customerPhone || "+919820198765"}`} className="underline">
                {job.customerPhone || "+91 98201 98765"}
              </a>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="num text-3xl leading-none">{inr(job.finalPrice ?? job.budget)}</div>
            <div className="mt-1 text-xs font-semibold text-muted">agreed price</div>
          </div>
        </div>

        <ol className="flex gap-1.5" aria-label="Job progress">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? "step" : undefined}
              className={`flex-1 border-t-4 pt-1 text-sm font-semibold ${
                i <= step ? "border-neel text-ink" : "border-line text-muted"
              }`}
            >
              {s}
            </li>
          ))}
        </ol>

        {job.status === "accepted" ? (
          <div className="space-y-2 rounded-md border-2 border-dashed border-neel bg-wall p-3">
            <label htmlFor={`otp-${job.id}`} className="block text-xs font-bold uppercase tracking-wider text-muted">
              Enter 4-Digit Customer Start Code
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={`otp-${job.id}`}
                type="text"
                maxLength={4}
                placeholder="0000"
                value={otpInput}
                onChange={(e) => {
                  setOtpInput(e.target.value.replace(/\D/g, ""));
                  setOtpError("");
                }}
                className="field num w-28 text-center text-xl font-bold tracking-widest min-h-[44px]"
              />
              <button
                type="button"
                onClick={handleStartWithOtp}
                disabled={otpInput.length !== 4}
                className="btn btn-go text-sm font-bold min-h-[44px] px-4"
              >
                Verify & Start Job
              </button>
            </div>
            {otpError && <p className="text-xs font-semibold text-chilli">{otpError}</p>}
            <p className="text-[11px] text-muted">
              Ask customer for the 4-digit code shown on their screen.{" "}
              {job.startOtp && <span className="font-mono text-muted/70">(Demo hint: {job.startOtp})</span>}
            </p>
          </div>
        ) : (
          <button onClick={() => advanceJob(job.id)} className="btn btn-go min-h-[44px] px-5 font-bold">
            Mark as done
          </button>
        )}
      </div>
    </article>
  );
}

// Module-level cache so getNowSnapshot returns a stable value between ticks.
// useSyncExternalStore requires getSnapshot to be referentially stable until
// the subscriber fires — calling Date.now() directly would return a new value
// every millisecond and trigger React error #185.
let _cachedNow = 0; // 0 = server/prerender; set on first client subscribe
function subscribeTicker(callback: () => void) {
  // Seed immediately so the first render after hydration has a real value.
  if (_cachedNow === 0) _cachedNow = Date.now();
  const t = setInterval(() => {
    _cachedNow = Date.now();
    callback();
  }, 2000);
  return () => clearInterval(t);
}
const getNowSnapshot = () => _cachedNow;
const getServerSnapshot = () => 0;

export default function WorkerPage() {
  const workers = useStore((s) => s.workers);
  const jobs = useStore((s) => s.jobs);
  const myId = useStore((s) => s.myWorkerId);
  const me = workers.find((w) => w.id === myId) ?? workers[0];
  const myTone = categoryById(me.categories[0]).tone;
  const where = me.loc.label ?? "your area";

  const now = useSyncExternalStore(subscribeTicker, getNowSnapshot, getServerSnapshot);

  const incoming = jobs.filter(
    (j) =>
      j.status === "open" &&
      (now === 0 || now < (j.expiresAt ?? j.createdAt + 15 * 60 * 1000)) &&
      !j.declinedBy?.includes(me.id) &&
      j.broadcastTo.includes(me.id) &&
      (me.online || j.mode === "scheduled"),
  );
  const active = jobs.filter(
    (j) => j.assignedWorkerId === me.id && (j.status === "accepted" || j.status === "in_progress"),
  );
  const done = jobs.filter((j) => j.assignedWorkerId === me.id && j.status === "completed");
  const earnings = done.reduce((sum, j) => sum + (j.finalPrice ?? 0), 0);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-12">
      <aside className="space-y-6">
        <div>
          <label htmlFor="acting-as" className="label">
            Demo: you are
          </label>
          <select id="acting-as" value={me.id} onChange={(e) => setMyWorker(e.target.value)} className="field">
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.loc.label})
              </option>
            ))}
          </select>
        </div>

        {/* Shop sign: Open / Closed */}
        <button
          onClick={() => setOnline(me.id, !me.online)}
          aria-pressed={me.online}
          className={`relative block w-full rounded-md border-2 border-ink px-5 pb-4 pt-6 text-left shadow-[0_3px_0_var(--color-ink)] transition-colors ${
            me.online ? "bg-signal text-white hover:bg-[#1b8a4b]" : "bg-paper hover:bg-white"
          }`}
        >
          <span aria-hidden="true" className="absolute left-4 top-2 size-2.5 rounded-full border-2 border-ink bg-wall" />
          <span aria-hidden="true" className="absolute right-4 top-2 size-2.5 rounded-full border-2 border-ink bg-wall" />
          <span className="block font-display text-4xl leading-none">{me.online ? "Open for jobs" : "Closed"}</span>
          <span className="mt-2 block text-[15px]">
            {me.online
              ? "Customers near you can send requests. Tap to close."
              : "You won't get on-demand requests. Tap to open."}
          </span>
        </button>

        {/* Worker ID card */}
        <section aria-label="Your profile" className="flyer overflow-hidden">
          <div className="relative px-4 pb-3 pt-6" style={{ background: myTone }}>
            <span aria-hidden="true" className="absolute left-1/2 top-2 h-2 w-12 -translate-x-1/2 rounded-full bg-wall shadow-[inset_0_1px_2px_rgb(15_26_77/0.45)]" />
            <div className="flex items-center gap-3">
              <Monogram name={me.name} tone="#fffffe" size={56} />
              <div>
                <h2 className="text-2xl">{me.name}</h2>
                <p className="text-sm font-semibold">
                  {me.categories.map((c) => categoryById(c).label).join(", ")}
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]">
              <Stars value={me.rating} />
              <span>{me.jobsDone} jobs done</span>
              <OnlineDot online={me.online} />
            </div>
            <p className="text-[15px]">{me.bio}</p>
            <Badges badges={me.badges} />
          </div>
          <div className="tear-t px-4 py-4">
            <label htmlFor="rate" className="label">
              Your base visit rate
            </label>
            <div className="flex items-center gap-2">
              <span className="num text-2xl">₹</span>
              <input
                id="rate"
                type="number"
                step={10}
                min={50}
                value={me.baseRate}
                onChange={(e) => setBaseRate(me.id, Number(e.target.value))}
                className="field num w-32 text-xl"
              />
            </div>
            <p className="mt-1.5 text-sm text-muted">Customers see this and set their budgets around it.</p>
          </div>
        </section>

        <section aria-label="Earnings" className="tear-b pb-5">
          <h2 className="text-lg font-bold">Earned this session</h2>
          <p className="num text-4xl">{inr(earnings)}</p>
          <p className="text-[15px] text-muted">
            from {done.length} finished job{done.length === 1 ? "" : "s"}
          </p>
        </section>

        <section aria-label="Recent reviews">
          <h2 className="mb-2 text-lg font-bold">What customers say</h2>
          <ul className="space-y-3">
            {me.reviews.slice(0, 3).map((r) => (
              <li key={r.id} className="border-l-4 border-marigold pl-3 text-[15px]">
                <p>{r.text}</p>
                <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
                  <StarRow n={r.rating} /> {r.author}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <div className="space-y-10">
        <section aria-label="Incoming requests">
          <h2 className="mb-4 flex items-center gap-3 text-3xl">
            Requests near you
            {incoming.length > 0 && (
              <span className="num rounded-sm bg-marigold px-2 py-0.5 text-lg">{incoming.length}</span>
            )}
          </h2>
          {incoming.length === 0 ? (
            <Note>
              {me.online ? (
                <p>
                  Waiting for requests near {where}. To try it, send one from the Customer view in another tab.
                </p>
              ) : (
                <>
                  <p>You&apos;re closed, so on-demand requests won&apos;t reach you.</p>
                  <button onClick={() => setOnline(me.id, true)} className="btn btn-go mt-4">
                    Open for jobs
                  </button>
                </>
              )}
            </Note>
          ) : (
            <div className="space-y-5">
              {incoming.map((j) => (
                <IncomingRequest key={j.id} job={j} me={me} />
              ))}
            </div>
          )}
        </section>

        <section aria-label="Active jobs">
          <h2 className="mb-4 text-3xl">Your active jobs</h2>
          {active.length === 0 ? (
            <Note>
              <p>No active jobs. Take a request above and it will show up here.</p>
            </Note>
          ) : (
            <div className="space-y-5">
              {active.map((j) => (
                <ActiveJob key={j.id} job={j} />
              ))}
            </div>
          )}
        </section>

        {done.length > 0 && (
          <section aria-label="Completed jobs">
            <h2 className="mb-2 text-3xl">Finished</h2>
            <ul>
              {done.map((j, i) => (
                <li key={j.id} className={`flex items-center justify-between gap-4 py-3 ${i > 0 ? "tear-t" : ""}`}>
                  <span className="min-w-0">
                    <b>{categoryById(j.category).label}:</b> {j.description}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {j.review && <StarRow n={j.review.rating} />}
                    <span className="num text-xl">{inr(j.finalPrice ?? 0)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
