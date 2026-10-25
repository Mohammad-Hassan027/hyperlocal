"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { resetDemo, setBots, useStore } from "@/lib/store";

export default function Header() {
  const pathname = usePathname();
  const bots = useStore((s) => s.bots);

  const tab = (href: string, label: string) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`rounded-[4px] px-4 py-1.5 text-base font-bold transition-colors ${
          active ? "bg-marigold text-ink" : "text-white hover:bg-white/15"
        }`}
      >
        {label}
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
          {tab("/customer", "Customer")}
          {tab("/worker", "Worker")}
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
    </header>
  );
}
