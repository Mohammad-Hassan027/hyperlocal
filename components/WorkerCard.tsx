"use client";

import { useId, useState } from "react";
import { etaMinutes, fmtKm, inr } from "@/lib/geo";
import { categoryById } from "@/lib/seed";
import type { CategoryId, Worker } from "@/lib/types";
import { Badges, Monogram, OnlineDot, StarRow, Stars } from "./ui";

/** A worker as a flyer: paper colour = trade, tear-off tabs along the bottom. */
export default function WorkerCard({
  worker,
  category,
  distanceKm,
  onBook,
  isHighlighted = false,
  onHover,
  isBestMatch = false,
  matchReason,
}: {
  worker: Worker;
  category: CategoryId;
  distanceKm: number;
  onBook: () => void;
  isHighlighted?: boolean;
  onHover?: (hovering: boolean) => void;
  isBestMatch?: boolean;
  matchReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const reviewsId = useId();
  const tone = categoryById(category).tone;
  const eta = etaMinutes(distanceKm);
  const within30 = eta <= 30;
  const first = worker.name.split(" ")[0];

  return (
    <article
      id={`worker-card-${worker.id}`}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={`flyer overflow-hidden transition-all duration-150 ${
        worker.online ? "" : "opacity-85"
      } ${
        isHighlighted
          ? "ring-4 ring-marigold shadow-[0_4px_16px_rgba(244,163,0,0.45)] -translate-y-1"
          : ""
      }`}
    >
      {isBestMatch && matchReason && (
        <div className="flex items-center gap-2 border-b-2 border-ink bg-marigold px-4 py-1.5 text-xs font-bold text-ink">
          <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
            ★ Best match
          </span>
          <span className="truncate">{matchReason}</span>
        </div>
      )}
      <header className="flex items-center gap-3 px-4 py-3" style={{ background: tone }}>
        <Monogram name={worker.name} tone="#fffffe" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl">{worker.name}</h3>
          <p className="truncate text-sm font-semibold">
            {worker.categories.map((c) => categoryById(c).label).join(", ")}
          </p>
        </div>
        <div className="text-right">
          <div className="num text-2xl leading-none">{inr(worker.baseRate)}</div>
          <div className="mt-0.5 text-xs font-semibold">base visit rate</div>
        </div>
      </header>

      <div className="space-y-2.5 px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]">
          <Stars value={worker.rating} />
          <span>{worker.jobsDone} jobs done</span>
          <OnlineDot online={worker.online} />
        </div>
        <p className="text-[15px]">{worker.bio}</p>
        <Badges badges={worker.badges} />
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={reviewsId}
          className="text-[15px] font-semibold underline underline-offset-4"
        >
          {open ? "Hide reviews" : `Read ${Math.min(3, worker.reviews.length)} reviews`}
        </button>
        {open && (
          <ul id={reviewsId} className="space-y-2.5 pt-1">
            {worker.reviews.slice(0, 3).map((r) => (
              <li key={r.id} className="border-l-4 border-marigold pl-3 text-[15px]">
                <p>{r.text}</p>
                <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
                  <StarRow n={r.rating} /> {r.author}, {r.date}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* tear-off tabs: each cell is one fact; the last one is the action */}
      <div className="tear-t grid grid-cols-[1fr_1fr_1.35fr]">
        <div className="px-2 py-2 text-center">
          <div className="num text-xl leading-tight">{fmtKm(distanceKm)}</div>
          <div className="text-xs font-semibold text-muted">from you</div>
        </div>
        <div className="tear-l px-2 py-2 text-center">
          <div className={`num text-xl leading-tight ${within30 ? "text-signal" : ""}`}>~{eta} min</div>
          <div className="text-xs font-semibold text-muted">{within30 ? "inside 30 min" : "to reach you"}</div>
        </div>
        <button
          onClick={onBook}
          className="tear-l bg-marigold px-2 py-2 text-base font-bold transition-colors hover:bg-marigold-hover active:bg-marigold"
        >
          {worker.online ? `Book ${first}` : `Schedule ${first}`}
        </button>
      </div>
    </article>
  );
}
