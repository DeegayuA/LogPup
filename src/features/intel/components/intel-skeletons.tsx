import { Skeleton } from '@/components/ui/skeleton'

/**
 * The three Intel surfaces' loading shapes, shipped from the feature rather
 * than from the route, so the page's <Suspense> fallbacks and any loading.tsx
 * cannot drift apart from what actually resolves.
 *
 * Every block below is sized against the real component's geometry: the
 * briefing's micro-label row, headline, three body lines and three
 * priorities; the board's filter chips, group heading and 56px rows; the ask
 * panel's textarea plus its button row. A skeleton that does not match what
 * replaces it is worse than a spinner, because the swap becomes a layout
 * shift with extra steps.
 */

/** Matches BriefingCard: label row, headline, body, priorities, footer row. */
export function BriefingCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-sm sm:p-6">
      <span className="sr-only" role="status">
        Loading your briefing
      </span>
      <div aria-hidden className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-44" />
          <div className="flex gap-1.5">
            <Skeleton className="h-7 w-20 rounded-[min(var(--radius-md),12px)]" />
            <Skeleton className="h-7 w-16 rounded-[min(var(--radius-md),12px)]" />
          </div>
        </div>
        {/* Same two-column shape as BriefingCard's body, for the same reason:
            a skeleton in the old single-column layout reflows the whole card
            the instant the briefing lands. */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
          <div className="flex flex-col gap-2.5 border-t border-border/50 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <Skeleton className="h-3 w-16" />
            {['one', 'two', 'three'].map((row) => (
              <Skeleton key={row} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Matches SignalBoard: chip row, one group heading, three signal rows. */
export function SignalBoardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="sr-only" role="status">
        Loading signals
      </span>
      <div aria-hidden className="flex flex-wrap gap-1.5">
        <Skeleton className="h-6 w-16 rounded-[min(var(--radius-md),10px)]" />
        <Skeleton className="h-6 w-20 rounded-[min(var(--radius-md),10px)]" />
        <Skeleton className="h-6 w-20 rounded-[min(var(--radius-md),10px)]" />
        <Skeleton className="h-6 w-16 rounded-[min(var(--radius-md),10px)]" />
      </div>
      <Skeleton aria-hidden className="h-3 w-28" />
      <div aria-hidden className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5"
          >
            <Skeleton className="h-9 w-0.5 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3.5 w-full" />
            </div>
            <Skeleton className="h-5 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Matches AskPanel: label row, textarea, suggestion chips, submit row. */
export function AskPanelSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-sm sm:p-6">
      <span className="sr-only" role="status">
        Loading the ask panel
      </span>
      <div aria-hidden className="flex flex-col gap-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-6 w-40 rounded-[min(var(--radius-md),10px)]" />
          <Skeleton className="h-6 w-32 rounded-[min(var(--radius-md),10px)]" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
