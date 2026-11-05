"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type CustomerMap from "./CustomerMap";

const DynamicCustomerMap = dynamic(() => import("./CustomerMap"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-label="Loading interactive map"
      className="flex h-[320px] sm:h-[400px] w-full flex-col items-center justify-center rounded-md border-2 border-dashed border-ink/40 bg-wall/60 p-6 text-center"
    >
      <div className="size-8 animate-spin rounded-full border-4 border-neel border-t-transparent" />
      <p className="mt-3 font-semibold text-ink">Loading neighbourhood map…</p>
      <p className="text-sm text-muted">
        Workers are always shown in the list below.
      </p>
    </div>
  ),
});

export default function CustomerMapDynamic(
  props: ComponentProps<typeof CustomerMap>,
) {
  return <DynamicCustomerMap {...props} />;
}
