function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className ?? ''}`}
    />
  )
}

export default function AppDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6" aria-busy="true" aria-label="Loading app">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-4 w-14" />
          <div className="flex items-center gap-1.5">
            <Shimmer className="h-5 w-14 rounded-4xl" />
            <Shimmer className="h-5 w-16 rounded-4xl" />
          </div>
        </div>
      </div>

      <div className="flex h-8 items-center gap-1 border-b border-border">
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-4 w-16" />
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-4 w-18" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shimmer className="h-8 w-56 rounded-lg" />
          <Shimmer className="h-8 w-20 rounded-lg" />
        </div>
        <Shimmer className="h-8 w-24 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((col) => (
          <div
            key={col}
            className="flex flex-col gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
          >
            <Shimmer className="h-4 w-20" />
            {[0, 1, 2].map((row) => (
              <Shimmer key={row} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
