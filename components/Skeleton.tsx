/** Loading skeleton primitives */
export function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-line/60 ${className}`}
    />
  );
}

export function WorkerCardSkeleton() {
  return (
    <div className="flyer space-y-3 p-4" aria-hidden="true">
      <div className="flex items-center gap-3">
        <SkeletonBox className="size-12 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <SkeletonBox className="h-5 w-2/3" />
          <SkeletonBox className="h-3.5 w-1/3" />
        </div>
        <SkeletonBox className="h-9 w-24 rounded-md" />
      </div>
      <SkeletonBox className="h-3.5 w-full" />
      <SkeletonBox className="h-3.5 w-4/5" />
      <div className="flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBox key={i} className="h-5 w-16 rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function JobCardSkeleton() {
  return (
    <div className="flyer space-y-3 p-4" aria-hidden="true">
      <SkeletonBox className="h-6 w-1/2" />
      <SkeletonBox className="h-4 w-full" />
      <SkeletonBox className="h-4 w-3/4" />
      <div className="flex gap-2 pt-1">
        <SkeletonBox className="h-9 flex-1 rounded-md" />
        <SkeletonBox className="h-9 flex-1 rounded-md" />
      </div>
    </div>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-label="Loading…" aria-busy="true">
      <SkeletonBox className="h-10 w-2/5" />
      <SkeletonBox className="h-5 w-3/5" />
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: rows }).map((_, i) => (
          <WorkerCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
