"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationToast from "./NotificationToast";
import { resetDemo, setBots, setDemoSpeed, useStore } from "@/lib/store";

export default function Header() {
  const pathname = usePathname();
  const bots = useStore((s) => s.bots);
  const demoSpeed = useStore((s) => s.demoSpeed ?? 20);
  const jobs = useStore((s) => s.jobs);
  const myId = useStore((s) => s.myWorkerId);
  const me = useStore((s) => s.workers.find((w) => w.id === myId));

  const workerBadgeCount = jobs.filter(
    (j) =>
      j.status === "open" &&
      j.broadcastTo.includes(myId) &&
      !j.declinedBy?.includes(myId) &&
      (me?.online || j.mode === "scheduled"),
  ).length;

  const customerBadgeCount = jobs.filter(
    (j) =>
      (j.status === "open" && j.offers.some((o) => o.status === "pending")) ||
      j.status === "accepted",
  ).length;

  const tab = (href: string, label: string, count?: number) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-1.5 rounded-[4px] px-3.5 py-1.5 text-base font-bold transition-colors ${
          active ? "bg-marigold text-ink" : "text-white hover:bg-white/15"
        }`}
      >
        <span>{label}</span>
        {count !== undefined && count > 0 && (
          <span
            aria-label={`${count} notifications`}
            className={`num rounded-full px-1.5 py-0.5 text-xs font-extrabold leading-none ${
              active ? "bg-ink text-white" : "bg-marigold text-ink"
            }`}
          >
            {count}
          </span>
        )}
      </Link>
    );
  };

  return (
    <header className="on-dark sticky top-0 z-30 bg-neel text-white shadow-[0_3px_0_var(--color-ink)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link href="/" className="font-display text-2xl leading-none tracking-tight">
          QuickKaam
        </Link>

        <nav className="flex gap-1 rounded-md border-2 border-white/35 p-0.5" aria-label="Switch between customer and worker view">
          {tab("/customer", "Customer", customerBadgeCount)}
          {tab("/worker", "Worker", workerBadgeCount)}
        </nav>

        <details className="relative text-sm">
          <summary className="cursor-pointer list-none rounded px-2 py-1.5 font-semibold underline decoration-white/50 underline-offset-4 hover:decoration-white">
            Demo tools
          </summary>
          <div className="absolute right-0 mt-2 w-64 rounded-md bg-paper p-4 text-ink shadow-xl">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={bots}
                onChange={(e) => setBots(e.target.checked)}
                className="mt-1 size-4 accent-neel"
              />
              <span>
                <b>Simulate nearby workers</b>
                <span className="block text-muted">They reply to requests after a few seconds.</span>
              </span>
            </label>
            <div className="tear-t mt-3 pt-3">
              <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Demo travel speed
              </span>
              <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Demo travel speed">
                <button
                  type="button"
                  onClick={() => setDemoSpeed(1)}
                  aria-pressed={demoSpeed === 1}
                  className={`btn flex-1 px-2 py-1 text-xs ${
                    demoSpeed === 1 ? "btn-neel" : "btn-line"
                  }`}
                >
                  1× Normal
                </button>
                <button
                  type="button"
                  onClick={() => setDemoSpeed(20)}
                  aria-pressed={demoSpeed === 20}
                  className={`btn flex-1 px-2 py-1 text-xs ${
                    demoSpeed === 20 ? "btn-go" : "btn-line"
                  }`}
                >
                  20× Demo (25 s)
                </button>
              </div>
              <p className="mt-1 text-[13px] text-muted leading-tight">
                20× makes the worker arrive in ~25 s on stage.
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm("Reset all demo data?")) resetDemo();
              }}
              className="btn btn-line mt-3 w-full"
            >
              Reset demo data
            </button>
          </div>
        </details>
      </div>
      <NotificationToast />
    </header>
  );
}
