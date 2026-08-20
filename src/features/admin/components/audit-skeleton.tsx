const shimmer = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'

/**
 * Skeletons for /admin/audit, shaped like what is actually coming: a control
 * row, then day markers with rows of mixed sentence length and a right-hand
 * clock column. A spinner would say "wait"; this says "a trail is arriving",
 * which is the difference the repo's states rule is after.
 *
 * Split in two because the page's two waits are genuinely different lengths.
 * The controls need two cheap selectDistinct queries; the trail needs the
 * paged read plus its count. Standing one skeleton in for both would hold the
 * filter bar hostage to the slower half — and blank the control the reader
 * just used, on every single filter change.
 */

/** The filter bar: search box, three selects, two date fields, two buttons. */
export function AuditControlsSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="sr-only" role="status">
        Loading audit filters
      </span>
      <div className={`${shimmer} h-8 w-56`} />
      <div className={`${shimmer} h-8 w-40`} />
      <div className={`${shimmer} h-8 w-36`} />
      <div className={`${shimmer} h-8 w-36`} />
      <div className={`${shimmer} h-8 w-36`} />
      <div className={`${shimmer} h-8 w-36`} />
      <div className={`${shimmer} h-8 w-32`} />
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
        <div className={`${shimmer} h-3 w-16`} />
      </div>
      <div className="ml-2 flex flex-col border-l border-border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="relative flex items-baseline justify-between gap-3 py-2 pl-5">
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

/** The trail itself — the sort strip, the range line, and two days of rows. */
export function AuditTrailSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <span className="sr-only" role="status">
        Loading the audit trail
      </span>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={`${shimmer} h-6 w-56`} />
        <div className={`${shimmer} h-3 w-32`} />
      </div>
      <DaySkeleton rows={5} />
      <DaySkeleton rows={4} />
    </div>
  )
}
