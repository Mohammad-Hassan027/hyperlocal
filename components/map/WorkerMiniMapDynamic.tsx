"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type WorkerMiniMap from "./WorkerMiniMap";

const DynamicWorkerMiniMap = dynamic(() => import("./WorkerMiniMap"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="flex h-[110px] w-full flex-col items-center justify-center rounded-md border border-ink/20 bg-wall p-3 text-center text-xs"
    >
      <span className="font-semibold text-ink">📍 Customer route preview</span>
      <span className="mt-1 text-muted">Loading map preview…</span>
    </div>
  ),
});

export default function WorkerMiniMapDynamic(
  props: ComponentProps<typeof WorkerMiniMap>,
) {
  return <DynamicWorkerMiniMap {...props} />;
}
