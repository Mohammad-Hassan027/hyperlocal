"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import BookingDialog from "./BookingDialog";
import CustomerJobCard from "./CustomerJobCard";
import CustomerMapDynamic from "./map/CustomerMapDynamic";
import WorkerCard from "./WorkerCard";
import { Note } from "./ui";
import { etaMinutes, haversineKm, PRESET_LOCATIONS } from "@/lib/geo";
import { rankWorkers } from "@/lib/matching";
import { CATEGORIES, categoryById } from "@/lib/seed";
import { nearbyWorkers, setLocation, useStore } from "@/lib/store";
import type { CategoryId, Worker } from "@/lib/types";

type Sort = "match" | "distance" | "rating" | "price";

export default function CustomerView() {
  const state = useStore((s) => s);
  const params = useSearchParams();
  const fromLink = CATEGORIES.find((c) => c.id === params.get("cat"))?.id;

  const [category, setCategory] = useState<CategoryId>(fromLink ?? "plumber");
  const [radius, setRadius] = useState(10);
  const [sort, setSort] = useState<Sort>("match");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [tab, setTab] = useState<"find" | "bookings">("find");
  const [booking, setBooking] = useState<{ preferred?: Worker } | null>(null);
  const [gpsMsg, setGpsMsg] = useState("");
  const [highlightedWorkerId, setHighlightedWorkerId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);

  const activeJob = state.jobs.find(
    (j) => j.status === "accepted" && j.assignedWorkerId,
  );

  const cat = categoryById(category);
  const label = cat.label.toLowerCase();

  const inRange = useMemo(
    () => nearbyWorkers(state, state.location, radius, category),
    [state, radius, category],
  );

  const rankedCandidates = useMemo(
    () => rankWorkers(inRange, radius, undefined, category),
    [inRange, radius, category],
  );

  const results = useMemo(() => {
    const list = rankedCandidates.filter((x) => !onlineOnly || x.worker.online);
    if (sort === "match") return list;
    return [...list].sort((a, b) =>
      sort === "distance"
        ? a.distanceKm - b.distanceKm
        : sort === "rating"
          ? b.worker.rating - a.worker.rating
          : a.worker.baseRate - b.worker.baseRate,
    );
  }, [rankedCandidates, onlineOnly, sort]);

  const onlineNow = inRange.filter((x) => x.worker.online);
  const nearestOnline = onlineNow.length ? Math.min(...onlineNow.map((x) => x.distanceKm)) : null;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((c) => [c.id, nearbyWorkers(state, state.location, radius, c.id).length]),
      ) as Record<CategoryId, number>,
    [state, radius],
  );

  const openJobs = state.jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled").length;
  const where = state.location.label ?? "you";
  const isPreset = PRESET_LOCATIONS.some((p) => p.label === state.location.label);

  const useGps = () => {
    if (!navigator.geolocation) return setGpsMsg("This browser can't share your location. Pick an area instead.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({ lat: p.coords.latitude, lng: p.coords.longitude, label: "My location" });
        setGpsMsg("");
      },
      () => setGpsMsg("Location is blocked. Allow it in your browser, or pick an area."),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-3xl">
          <h1 className="text-balance text-3xl sm:text-[2.6rem]">
            {tab === "find"
              ? `${results.length} ${label}${results.length === 1 ? "" : "s"} within ${radius} km of ${where}`
              : "Your bookings"}
          </h1>
          {tab === "find" && (
            <p className="mt-1.5 text-lg text-muted">
              {onlineNow.length === 0
                ? "No one is online in range right now. You can still schedule a visit."
                : `${onlineNow.length} online now. The nearest can reach you in about ${etaMinutes(nearestOnline!)} minutes.`}
            </p>
          )}
        </div>

        <div className="flex rounded-md border-2 border-ink p-0.5" role="tablist" aria-label="Customer sections">
          {(["find", "bookings"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-[4px] px-4 py-1.5 font-bold ${tab === t ? "bg-ink text-white" : "hover:bg-ink/10"}`}
            >
              {t === "find" ? "Find help" : `My bookings${openJobs ? ` (${openJobs})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {tab === "find" ? (
        <>
          <section aria-label="Choose a trade">
            <ul className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = category === c.id;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setCategory(c.id)}
                      aria-pressed={on}
                      style={{ background: c.tone }}
                      className={`flex items-baseline gap-2 rounded-md border-2 px-3.5 py-2 text-lg font-bold transition-transform ${
                        on
                          ? "-translate-y-0.5 border-ink shadow-[0_3px_0_var(--color-ink)]"
                          : "border-transparent hover:-translate-y-0.5"
                      }`}
                    >
                      {c.label}
                      <span className="num text-sm font-normal">{counts[c.id]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="Search area" className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto]">
            <div className="col-span-2 lg:col-span-1">
              <label htmlFor="area" className="label">
                Where are you?
              </label>
              <div className="flex gap-2">
                <select
                  id="area"
                  value={isPreset ? state.location.label : "gps"}
                  onChange={(e) => {
                    const p = PRESET_LOCATIONS.find((x) => x.label === e.target.value);
                    if (p) setLocation(p);
                  }}
                  className="field"
                >
                  {PRESET_LOCATIONS.map((p) => (
                    <option key={p.label}>{p.label}</option>
                  ))}
                  {!isPreset && <option value="gps">{state.location.label}</option>}
                </select>
                <button onClick={useGps} className="btn btn-line shrink-0">
                  Use GPS
                </button>
              </div>
              {gpsMsg && <p className="mt-1 text-sm font-semibold text-chilli">{gpsMsg}</p>}
            </div>

            <div className="col-span-2 lg:col-span-1">
              <label htmlFor="radius" className="label">
                How far: {radius} km
              </label>
              <input
                id="radius"
                type="range"
                min={1}
                max={25}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="mt-2.5 w-full accent-neel"
              />
            </div>

            <div>
              <label htmlFor="sort" className="label">
                Sort by
              </label>
              <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="field">
                <option value="match">Best match</option>
                <option value="distance">Nearest first</option>
                <option value="rating">Best rated</option>
                <option value="price">Lowest rate</option>
              </select>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-2 self-end font-semibold">
              <input
                type="checkbox"
                checked={onlineOnly}
                onChange={(e) => setOnlineOnly(e.target.checked)}
                className="size-5 accent-neel"
              />
              Online only
            </label>
          </section>

          {onlineNow.length > 0 && (
            <section
              aria-label="Send to everyone nearby"
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-md bg-marigold-soft px-5 py-4"
            >
              <p className="max-w-xl text-lg leading-snug">
                <b>Don&apos;t want to pick?</b> Send your job to all {onlineNow.length} online {label}
                {onlineNow.length === 1 ? "" : "s"} within {radius} km. First to accept your price gets it.
              </p>
              <button onClick={() => setBooking({})} className="btn btn-go text-lg">
                Send to everyone nearby
              </button>
            </section>
          )}

          {/* Interactive Map */}
          <section aria-label="Map of nearby workers" className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">
                Area map • {results.length} worker{results.length === 1 ? "" : "s"}
              </h2>
              <button
                type="button"
                onClick={() => setShowMap((v) => !v)}
                className="btn btn-line min-h-[38px] px-3 py-1 text-sm"
              >
                {showMap ? "Hide map" : "Show map"}
              </button>
            </div>
            {showMap && (
              <CustomerMapDynamic
                customerLoc={state.location}
                radiusKm={radius}
                workers={inRange}
                category={category}
                selectedWorkerId={highlightedWorkerId}
                onSelectWorker={(id) => {
                  setHighlightedWorkerId(id);
                  const el = document.getElementById(`worker-card-${id}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }}
                activeJob={activeJob}
                demoSpeed={state.demoSpeed ?? 20}
              />
            )}
          </section>

          {results.length === 0 ? (
            <Note>
              <p>
                No {label}s{onlineOnly ? " online" : ""} within {radius} km of {where}.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {radius < 25 && (
                  <button onClick={() => setRadius(Math.min(25, radius + 10))} className="btn btn-go">
                    Search {Math.min(25, radius + 10)} km
                  </button>
                )}
                {onlineOnly && (
                  <button onClick={() => setOnlineOnly(false)} className="btn btn-line">
                    Show offline too
                  </button>
                )}
              </div>
            </Note>
          ) : (
            <div className="grid items-start gap-6 md:grid-cols-2">
              {results.map(({ worker, distanceKm, isBestMatch, matchReason }) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  category={category}
                  distanceKm={distanceKm}
                  onBook={() => setBooking({ preferred: worker })}
                  isHighlighted={highlightedWorkerId === worker.id}
                  onHover={(isHovering) =>
                    setHighlightedWorkerId(isHovering ? worker.id : null)
                  }
                  isBestMatch={isBestMatch}
                  matchReason={matchReason}
                />
              ))}
            </div>
          )}
        </>
      ) : state.jobs.length === 0 ? (
        <Note>
          <p>No bookings yet. Pick a trade and send your first request.</p>
          <button onClick={() => setTab("find")} className="btn btn-go mt-4">
            Find help
          </button>
        </Note>
      ) : (
        <div className="space-y-6">
          {activeJob && (
            <section aria-label="Live tracking map" className="space-y-2">
              <h2 className="text-xl">Worker on the way • Live tracking</h2>
              <CustomerMapDynamic
                customerLoc={activeJob.customerLoc}
                radiusKm={activeJob.radiusKm}
                workers={state.workers
                  .filter((w) => w.id === activeJob.assignedWorkerId)
                  .map((w) => ({
                    worker: w,
                    distanceKm: haversineKm(activeJob.customerLoc, w.loc),
                  }))}
                category={activeJob.category}
                activeJob={activeJob}
                demoSpeed={state.demoSpeed ?? 20}
              />
            </section>
          )}
          <div className="grid items-start gap-6 md:grid-cols-2">
            {state.jobs.map((j) => (
              <CustomerJobCard key={j.id} job={j} />
            ))}
          </div>
        </div>
      )}

      {booking && (
        <BookingDialog
          category={category}
          preferred={booking.preferred}
          radiusKm={radius}
          onClose={() => setBooking(null)}
          onCreated={() => {
            setBooking(null);
            setTab("bookings");
          }}
        />
      )}
    </div>
  );
}
