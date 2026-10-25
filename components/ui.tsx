import type { Badge } from "@/lib/types";

export function Star({ filled = true, className = "size-4" }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        d="M10 1.8l2.4 5.2 5.7.7-4.2 3.9 1.1 5.6L10 14.4 4.9 17.2 6 11.6 1.8 7.7l5.7-.7z"
        fill={filled ? "#f4a300" : "none"}
        stroke="#0f1a4d"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <Star />
      <span aria-hidden="true">{value.toFixed(1)}</span>
    </span>
  );
}

export function StarRow({ n }: { n: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} filled={i <= n} className="size-3.5" />
      ))}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

/** Round monogram, like the initials stitched on a uniform pocket. */
export function Monogram({ name, tone, size = 44 }: { name: string; tone: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full border-2 border-ink font-display text-ink"
      style={{ width: size, height: size, background: tone, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

const BADGE_LABEL: Record<Badge, string> = {
  id_verified: "ID verified",
  background_checked: "Background checked",
  skill_certified: "Skill certified",
  top_rated: "Top rated",
};

export function Badges({ badges }: { badges: Badge[] }) {
  if (!badges.length) return <span className="text-sm text-muted">New here, nothing verified yet</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <li
          key={b}
          className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-[13px] font-semibold ${
            b === "top_rated"
              ? "border-ink bg-marigold-soft"
              : "border-ink/40 bg-white"
          }`}
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
            <path d="M3 8.5l3.2 3L13 4.8" fill="none" stroke="#17783f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {BADGE_LABEL[b]}
        </li>
      ))}
    </ul>
  );
}

export function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      <span
        aria-hidden="true"
        className={`size-2.5 rounded-full ${online ? "bg-signal pulse-ring" : "border-2 border-muted"}`}
      />
      <span className={online ? "text-signal" : "text-muted"}>{online ? "Online" : "Offline"}</span>
    </span>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Finding a worker", cls: "bg-marigold text-ink" },
  accepted: { label: "Worker assigned", cls: "bg-neel text-white" },
  in_progress: { label: "Work in progress", cls: "bg-neel text-white" },
  completed: { label: "Completed", cls: "bg-signal text-white" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-white" },
};

export function StatusTag({ status }: { status: string }) {
  const s = STATUS[status];
  return <span className={`rounded-sm px-2 py-0.5 text-sm font-bold ${s.cls}`}>{s.label}</span>;
}

/** Plain note for empty states: says what happened and what to do next. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="tear-t tear-b py-10 text-center text-lg text-muted">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
