function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className ?? ''}`}
    />
  )
}

/**
 * Models the SHELL only — title, identity line, six header counters, the
 * section bar — and then one neutral content block.
 *
 * The old skeleton always painted a three-column kanban board, so opening any
 * other tab flashed a board that was never going to appear. A skeleton can't
 * see `?tab=`, so the honest thing is to promise only the part that is the
 * same on every tab and leave the rest as a single undifferentiated block.
 */
export default function AppDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-5 p-6" aria-busy="true" aria-label="Loading app">
      {/* The route change itself is silent to a screen reader — the URL moves
          and the old page's DOM is replaced with placeholders that are all
          aria-hidden. This is the announcement. Same wording pattern as the
          other loading routes so the app says one thing, one way. */}
      <span className="sr-only" role="status">
        Loading this app…
      </span>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Shimmer className="h-8 w-48" />
              <Shimmer className="h-5 w-16 rounded-full" />
              <Shimmer className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Shimmer className="h-3 w-20" />
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-3 w-12" />
            </div>
            <Shimmer className="h-4 w-80" />
            <div className="flex items-center gap-1.5">
              <Shimmer className="h-5 w-14 rounded-4xl" />
              <Shimmer className="h-5 w-16 rounded-4xl" />
            </div>
          </div>
          <Shimmer className="h-7 w-20 rounded-lg" />
        </div>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
              <Shimmer className="h-3 w-12" />
              <Shimmer className="h-5 w-10" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-border pb-2">
        {/* Keyed by position, not width: three tabs share `w-20`, and a
            duplicate key is a React error on every app page load. */}
        {['w-20', 'w-14', 'w-20', 'w-24', 'w-20', 'w-16'].map((width, index) => (
          <Shimmer key={index} className={`h-4 ${width}`} />
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Shimmer className="h-28 w-full rounded-xl" />
        <Shimmer className="h-40 w-full rounded-xl" />
      </div>
    </div>
  )
}
