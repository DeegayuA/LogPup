import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeletons for /admin/audit, shaped like what is actually coming: a control
 * row, then day markers with rows of mixed sentence length and a right-hand
 * clock column. A spinner would say "wait"; this says "a trail is arriving",
 * which is the difference the repo's states rule is after.
 *
 * Built on the shared Skeleton primitive (this file predates it and used to
 * hand-roll the shimmer class). The exports stay — audit/page.tsx imports
 * both by name.
 *
 * Split in two because the page's two waits are genuinely different lengths.
 * The controls need two cheap selectDistinct queries; the trail needs the
 * paged read plus its count. Standing one skeleton in for both would hold the
 * filter bar hostage to the slower half — and blank the control the reader
 * just used, on every single filter change.
 */

/**
 * The filter bar: search box, three selects, the date pair, two buttons —
 * mirroring the bar's own responsive layout (stacked and full-width below
 * sm), so the swap from skeleton to controls moves nothing at 320px.
 */
export function AuditControlsSkeleton() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <span className="sr-only" role="status">
        Loading audit filters
      </span>
      <Skeleton className="h-8 w-full sm:w-56" />
      <Skeleton className="h-8 w-full sm:w-40" />
      <Skeleton className="h-8 w-full sm:w-36" />
      <Skeleton className="h-8 w-full sm:w-36" />
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Skeleton className="h-8 min-w-0 flex-1 sm:w-36 sm:flex-none" />
        <Skeleton className="h-8 min-w-0 flex-1 sm:w-36 sm:flex-none" />
      </div>
      <Skeleton className="h-8 w-32" />
    </div>
  )
}

// Widths vary per row so the block reads as sentences of different lengths
// rather than as a grey table — the wall this redesign is fixing should not be
// what its own loading state looks like. Every width is capped by max-w-full,
// so no bar can outgrow a 320px column and jump when the real rows land.
const ROW_WIDTHS = ['w-72', 'w-96', 'w-64', 'w-80', 'w-56', 'w-88']

function DaySkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 py-1.5">
        <Skeleton className="h-3.5 w-24 max-w-full" />
        <Skeleton className="h-3 w-16 max-w-full" />
      </div>
      <div className="ml-2 flex flex-col border-l border-border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="relative flex items-baseline justify-between gap-3 py-2 pl-5">
            <span
              aria-hidden
              className="absolute top-3.5 left-0 size-2 -translate-x-1/2 rounded-full bg-muted ring-2 ring-background"
            />
            <Skeleton className={`h-4 max-w-full ${ROW_WIDTHS[index % ROW_WIDTHS.length]}`} />
            <Skeleton className="h-3 w-16 shrink-0" />
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
        <Skeleton className="h-6 w-56 max-w-full" />
        <Skeleton className="h-3 w-32 max-w-full" />
      </div>
      <DaySkeleton rows={5} />
      <DaySkeleton rows={4} />
    </div>
  )
}
