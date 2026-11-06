"use client";

import { useState } from "react";
import Link from "next/link";
import { Badges, Monogram, OnlineDot, Stars } from "@/components/ui";
import { inr } from "@/lib/geo";
import { categoryById } from "@/lib/seed";
import { setMyWorker, setWorkerVerification, toggleWorkerBadge, useStore } from "@/lib/store";
import type { Badge } from "@/lib/types";

const ALL_BADGES: { id: Badge; label: string; desc: string }[] = [
  { id: "id_verified", label: "Demo ID Check", desc: "Aadhaar / govt photo ID (simulated)" },
  { id: "background_checked", label: "Demo BG Check", desc: "Address & police record (simulated)" },
  { id: "skill_certified", label: "Demo Skill Cert", desc: "Trade competency test (simulated)" },
  { id: "top_rated", label: "Top Rated", desc: "Outstanding rating badge" },
];

export default function AdminPage() {
  const workers = useStore((s) => s.workers);
  const myWorkerId = useStore((s) => s.myWorkerId);
  const [filter, setFilter] = useState<"all" | "pending" | "verified">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const pendingCount = workers.filter((w) => w.pendingVerification).length;

  const filtered = workers.filter((w) => {
    if (filter === "pending" && !w.pendingVerification) return false;
    if (filter === "verified" && w.pendingVerification) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        w.name.toLowerCase().includes(q) ||
        (w.loc.label && w.loc.label.toLowerCase().includes(q)) ||
        w.categories.some((c) => categoryById(c).label.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-6">
      {/* Header Flyer */}
      <header className="flyer p-6 border-l-8 border-neel shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-display">Demo Admin Console</h1>
            <p className="text-sm text-muted mt-1">
              Verify mock applicants and toggle demo badges live. Updates reflect across all views instantly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/worker/join" className="btn btn-go text-xs font-bold min-h-[38px] px-3">
              + New Worker Registration
            </Link>
            <Link href="/worker" className="btn btn-line text-xs font-bold min-h-[38px] px-3">
              Worker View
            </Link>
          </div>
        </div>

        {/* Disclaimer Notice */}
        <div className="rounded-md border border-marigold bg-marigold-soft px-3.5 py-2 text-xs">
          <span className="font-bold">⚠️ Hackathon Demo Disclaimer:</span> Never claim or store real background checks. All verification badges here are simulated for platform testing and prototype presentation.
        </div>
      </header>

      {/* Filter and Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5" role="tablist">
          <button
            role="tab"
            aria-selected={filter === "all"}
            onClick={() => setFilter("all")}
            className={`btn text-xs font-bold px-3 py-1.5 min-h-[36px] ${
              filter === "all" ? "btn-neel" : "btn-line"
            }`}
          >
            All Workers ({workers.length})
          </button>
          <button
            role="tab"
            aria-selected={filter === "pending"}
            onClick={() => setFilter("pending")}
            className={`btn text-xs font-bold px-3 py-1.5 min-h-[36px] ${
              filter === "pending" ? "btn-neel" : "btn-line"
            }`}
          >
            ⏳ Pending Verification ({pendingCount})
          </button>
          <button
            role="tab"
            aria-selected={filter === "verified"}
            onClick={() => setFilter("verified")}
            className={`btn text-xs font-bold px-3 py-1.5 min-h-[36px] ${
              filter === "verified" ? "btn-neel" : "btn-line"
            }`}
          >
            ✓ Verified Profiles ({workers.length - pendingCount})
          </button>
        </div>

        <input
          type="search"
          placeholder="Filter by name, trade, area..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="field text-xs py-1.5 max-w-xs"
        />
      </div>

      {/* Workers List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="flyer p-8 text-center text-muted">
            No workers match the selected filter.
          </div>
        ) : (
          filtered.map((w) => {
            const firstCat = categoryById(w.categories[0]);
            const isMe = w.id === myWorkerId;

            return (
              <article
                key={w.id}
                className={`flyer overflow-hidden border-2 transition-all ${
                  w.pendingVerification
                    ? "border-marigold bg-[#fffdfa]"
                    : "border-ink/20"
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Worker Summary Row */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Monogram name={w.name} tone={firstCat.tone} size={48} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold">{w.name}</h2>
                          {isMe && (
                            <span className="rounded bg-neel px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                              Your Identity
                            </span>
                          )}
                          <OnlineDot online={w.online} />
                        </div>
                        <p className="text-sm text-muted font-semibold">
                          {w.categories.map((c) => categoryById(c).label).join(", ")} · {w.loc.label ?? "Local"} · {inr(w.baseRate)} base
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs">
                          <Stars value={w.rating} />
                          <span>{w.jobsDone} jobs completed</span>
                          {w.phone && <span className="font-mono text-muted">📱 {w.phone}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setMyWorker(w.id)}
                        disabled={isMe}
                        className={`btn text-xs min-h-[36px] px-3 font-bold ${
                          isMe ? "btn-go cursor-default" : "btn-line"
                        }`}
                      >
                        {isMe ? "Acting as this worker" : "Act as this worker"}
                      </button>

                      {w.pendingVerification ? (
                        <button
                          onClick={() => {
                            setWorkerVerification(w.id, false);
                            if (!w.badges.includes("id_verified")) {
                              toggleWorkerBadge(w.id, "id_verified");
                            }
                          }}
                          className="btn btn-go text-xs min-h-[36px] px-4 font-bold"
                        >
                          ✓ Approve & Verify
                        </button>
                      ) : (
                        <button
                          onClick={() => setWorkerVerification(w.id, true)}
                          className="btn btn-line text-xs min-h-[36px] px-3 text-muted hover:text-chilli"
                        >
                          Mark Pending
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Document & Current Badges */}
                  <div className="rounded-md bg-wall p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-bold text-ink">Mock ID Attachment:</span>{" "}
                      <span className="font-mono text-muted">
                        {w.idDocumentName || "mock_aadhaar_card.png"}
                      </span>
                    </div>
                    <div>
                      <Badges badges={w.badges} pendingVerification={w.pendingVerification} />
                    </div>
                  </div>

                  {/* Live Badge Toggles */}
                  <div className="tear-t pt-3">
                    <span className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                      Live Badge Toggles (Click to add / remove):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {ALL_BADGES.map((badge) => {
                        const active = w.badges.includes(badge.id);
                        return (
                          <button
                            key={badge.id}
                            type="button"
                            onClick={() => toggleWorkerBadge(w.id, badge.id)}
                            className={`flex flex-col text-left p-2.5 rounded-md border text-xs font-semibold transition-all ${
                              active
                                ? "border-neel bg-white shadow-sm ring-2 ring-neel"
                                : "border-ink/20 bg-paper/60 opacity-60 hover:opacity-100"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-bold">{badge.label}</span>
                              <span className={`text-[11px] font-extrabold ${active ? "text-signal" : "text-muted"}`}>
                                {active ? "ON" : "OFF"}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted mt-1 leading-tight">
                              {badge.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}