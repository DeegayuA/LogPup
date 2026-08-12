function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className ?? ''}`}
    />
  )
}

/**
 * Deliberately shaped like the real page — header, six stat tiles, the search
 * + status row, the sort/tag row, then cards with the same internal bands
 * (numbers, task bar, sprint bar, tags, footer). The previous skeleton
 * modelled a much shorter card and no controls at all, so every load ended in
 * a visible jump as the real content pushed everything down.
 */
export default function AppsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6" aria-busy="true" aria-label="Loading apps">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Shimmer className="h-8 w-24" />
          <Shimmer className="h-4 w-72" />
        </div>
        <Shimmer className="h-8 w-24 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
            <Shimmer className="h-3 w-16" />
            <Shimmer className="h-6 w-10" />
            <Shimmer className="h-3 w-12" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Shimmer className="h-8 flex-1 rounded-lg" />
          <Shimmer className="h-8 w-64 rounded-lg" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Shimmer className="h-6 w-16 rounded-4xl" />
          <Shimmer className="h-6 w-20 rounded-4xl" />
          <Shimmer className="h-6 w-20 rounded-4xl" />
          <Shimmer className="h-6 w-16 rounded-4xl" />
        </div>
        <Shimmer className="h-3 w-40" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border-l-2 border-l-transparent bg-card p-4 ring-1 ring-foreground/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <Shimmer className="h-5 w-32" />
                <Shimmer className="h-3 w-20" />
              </div>
              <Shimmer className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex items-end gap-4">
              <div className="flex flex-col gap-1">
                <Shimmer className="h-3 w-8" />
                <Shimmer className="h-6 w-8" />
              </div>
              <div className="flex flex-col gap-1">
                <Shimmer className="h-3 w-12" />
                <Shimmer className="h-6 w-8" />
              </div>
              <div className="flex flex-col gap-1">
                <Shimmer className="h-3 w-8" />
                <Shimmer className="h-6 w-12" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Shimmer className="h-1.5 w-full rounded-full" />
              <Shimmer className="h-3 w-48" />
            </div>
            <div className="flex flex-col gap-1">
              <Shimmer className="h-3 w-full" />
              <Shimmer className="h-1 w-full rounded-full" />
              <Shimmer className="h-3 w-40" />
            </div>
            <div className="flex gap-1.5">
              <Shimmer className="h-5 w-14 rounded-4xl" />
              <Shimmer className="h-5 w-16 rounded-4xl" />
              <Shimmer className="h-5 w-12 rounded-4xl" />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex -space-x-2">
                <Shimmer className="size-6 rounded-full ring-2 ring-card" />
                <Shimmer className="size-6 rounded-full ring-2 ring-card" />
                <Shimmer className="size-6 rounded-full ring-2 ring-card" />
              </div>
              <Shimmer className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
