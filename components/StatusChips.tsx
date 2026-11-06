"use client";

/** Offline / network status banner */
export function OfflineBanner() {
  // Rendered only by OfflineBannerClient which checks navigator.onLine
  return (
    <div
      role="status"
      aria-live="assertive"
      className="sticky top-14 z-20 flex items-center justify-center gap-2 bg-chilli px-4 py-2 text-sm font-semibold text-white"
    >
      <span>📡</span> You&apos;re offline — changes will sync when reconnected.
    </div>
  );
}

/** Demo-mode fallback chip — shown when Firestore is unavailable */
export function DemoModeChip() {
  return (
    <span
      title="Firestore unavailable — running on localStorage (demo only)"
      className="inline-flex items-center gap-1 rounded-full border border-marigold bg-marigold-soft px-2.5 py-0.5 text-xs font-bold text-ink"
    >
      🔌 Demo mode (offline)
    </span>
  );
}
