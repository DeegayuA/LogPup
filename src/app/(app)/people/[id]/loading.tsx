function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className ?? ''}`}
    />
  )
}

export default function PersonDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6" aria-busy="true" aria-label="Loading person">
      <div className="flex items-center gap-4">
        <Shimmer className="size-14 rounded-full" />
        <div className="flex flex-col gap-2">
          <Shimmer className="h-7 w-44" />
          <Shimmer className="h-4 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <Shimmer className="h-5 w-24" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Shimmer className="h-4 flex-1" />
                <Shimmer className="h-1.5 w-32 rounded-full" />
                <Shimmer className="h-4 w-10" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <Shimmer className="h-4 w-28" />
              <Shimmer className="h-4 w-10" />
            </div>
            <Shimmer className="h-2 w-full rounded-full" />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <Shimmer className="h-5 w-16" />
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <Shimmer key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <Shimmer className="h-5 w-36" />
            <div className="flex flex-col gap-2">
              {[0, 1].map((i) => (
                <Shimmer key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
