/**
 * The board's loading state — its shape, not a spinner.
 *
 * The board has a strong, predictable silhouette (a stat strip, a control
 * row, three columns of stacked cards), and reproducing it is what stops the
 * page reflowing when the real data lands. A centred spinner would tell the
 * user nothing about what is coming and move everything when it arrives.
 *
 * NOT YET REFERENCED. Wiring it up means wrapping the `<Board>` in the app
 * detail route with Suspense, which is outside this feature's files:
 *
 *   <Suspense fallback={<BoardSkeleton />}>
 *     <Board … />
 *   </Suspense>
 *
 * and moving that route's `await getBoard(...)` inside the suspended
 * subtree. Until then the route blocks on the query as it always has.
 */

import { Skeleton } from '@/components/ui/skeleton'

const COLUMN_CARD_COUNTS = [4, 2, 3]

/** The shared Skeleton primitive, kept under the local name the layout below
 *  was written against. One shimmer for the whole app — radius, tone and
 *  motion (incl. motion-reduce) come from the primitive, not this file. */
function Bar({ className }: { className: string }) {
  return <Skeleton className={className} />
}

export function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/*
        The status line sits OUTSIDE the aria-hidden shell, not inside it.
        Wrapping the whole skeleton in aria-hidden — the obvious thing to do,
        since the placeholder bars are noise to a screen reader — also hides
        the one element that exists to be announced, so a screen-reader user
        got total silence while the board loaded. Only the decorative shape
        is hidden; the sentence is not.
      */}
      <p className="sr-only" role="status">
        Loading the board…
      </p>
      <div aria-hidden className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-8 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Bar className="h-5 w-10" />
              <Bar className="h-2 w-16" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Bar className="h-8 w-full max-w-64" />
          <Bar className="h-8 w-40" />
          <Bar className="h-8 w-24" />
        </div>
        <div className="flex items-stretch gap-4 overflow-hidden">
          {COLUMN_CARD_COUNTS.map((cards, column) => (
            <div key={column} className="flex min-w-64 flex-1 flex-col gap-2 rounded-xl bg-muted/50 p-2">
              <div className="flex items-center justify-between px-1 pb-1">
                <Bar className="h-4 w-24" />
                <Bar className="h-3 w-4" />
              </div>
              {Array.from({ length: cards }, (_, card) => (
                <div key={card} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                  <Bar className="h-4 w-full" />
                  <Bar className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
