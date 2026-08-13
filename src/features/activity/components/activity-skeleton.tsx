const shimmer = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'

/**
 * Skeletons for /activity, shaped like what is actually coming: a rail with
 * day markers, rows of mixed sentence length, and a right-hand clock column.
 * A spinner would say "wait"; this says "a trail is arriving", which is the
 * difference the repo's states rule is after.
 *
 * Split in two because the page's two waits are genuinely different lengths.
 * The controls need two cheap `selectDistinct` queries; the feed needs the
 * paged trail query and, on a miss, a second fallback query. Standing one
 * skeleton in for both would hold the filter bar hostage to the slower half —
 * which is exactly the behaviour this redesign removes.
 *
 * Shared by loading.tsx (cold entry into the route) and the page's own
 * <Suspense> boundaries (every later filter change), so the two can never
 * drift into showing different shapes for the same wait.
 */

/** The filter bar: search box, three selects, two date fields. */
export function ActivityControlsSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="sr-only" role="status">
        Loading activity filters
      </span>
      <div className={`${shimmer} h-8 w-56`} />
      <div className={`${shimmer} h-8 w-40`} />
      <div className={`${shimmer} h-8 w-36`} />
      <div className={`${shimmer} h-8 w-40`} />
      <div className={`${shimmer} h-8 w-36`} />
      <div className={`${shimmer} h-8 w-36`} />
    </div>
  )
}

// Widths vary per row so the block reads as sentences of different lengths
// rather than as a grey table — the wall this redesign is fixing should not be
// what its own loading state looks like.
const ROW_WIDTHS = ['w-72', 'w-96', 'w-64', 'w-80', 'w-56', 'w-88']

function DaySkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 py-1.5">
        <div className={`${shimmer} h-3.5 w-24`} />
        <div className={`${shimmer} h-3 w-32`} />
      </div>
      <div className="ml-2 flex flex-col border-l border-border">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="relative flex items-baseline justify-between gap-3 py-2 pl-5"
          >
            <span
              aria-hidden
              className="absolute top-3.5 left-0 size-2 -translate-x-1/2 rounded-full bg-muted ring-2 ring-background"
            />
            <div className={`${shimmer} h-4 max-w-full ${ROW_WIDTHS[index % ROW_WIDTHS.length]}`} />
            <div className={`${shimmer} h-3 w-16 shrink-0`} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The trail itself — two days' worth, which is about one screen. */
export function ActivityTrailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only" role="status">
        Loading the activity trail
      </span>
      <DaySkeleton rows={5} />
      <DaySkeleton rows={4} />
    </div>
  )
}
