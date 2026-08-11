export default function AppsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="h-5 w-32 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
                <div className="h-3 w-20 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-4 w-full animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
              <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
            </div>
            <div className="flex gap-1.5">
              <div className="h-5 w-14 animate-pulse rounded-4xl bg-muted motion-reduce:animate-none" />
              <div className="h-5 w-16 animate-pulse rounded-4xl bg-muted motion-reduce:animate-none" />
              <div className="h-5 w-12 animate-pulse rounded-4xl bg-muted motion-reduce:animate-none" />
            </div>
            <div className="flex -space-x-2">
              <div className="size-6 animate-pulse rounded-full bg-muted ring-2 ring-card motion-reduce:animate-none" />
              <div className="size-6 animate-pulse rounded-full bg-muted ring-2 ring-card motion-reduce:animate-none" />
              <div className="size-6 animate-pulse rounded-full bg-muted ring-2 ring-card motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
