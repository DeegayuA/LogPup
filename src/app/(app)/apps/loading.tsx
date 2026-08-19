function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className ?? ''}`}
    />
  )
}

/**
 * Deliberately shaped like the real page — header, six stat tiles, the search
 * + status row, the sort/tag row, then cards built to the same five bands as
 * app-card.tsx (header 24 · urgency 16 · bar 26 · context 16 · people 33, with
 * gap-2.5 and p-4, so a skeleton card is the same 187px a real one is). An
 * earlier skeleton modelled a much shorter card and no controls at all, so
 * every load ended in a visible jump as the real content pushed everything
 * down; the card is now shorter than that skeleton was, and a stale skeleton
 * would simply invert the jump rather than fix it.
 *
 * The column counts are copied from apps-browser.tsx and must stay copied:
 * this file previously said `xl:grid-cols-3` against the grid's
 * `xl:grid-cols-4`, which meant the vertical jump was fixed while a horizontal
 * reflow shipped in its place. Twelve cards, not six, because twelve divides
 * evenly by 1, 2, 3 and 4 — a ragged final row moves when the real grid
 * arrives, which is the same jump wearing a different hat.
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2.5 rounded-xl border-l-2 border-l-transparent bg-card p-4 ring-1 ring-foreground/10"
          >
            {/* Each band carries the real card's min-h and the shimmer inside
                it is smaller, rather than the shimmer itself being the band —
                that way a shimmer resized for looks can never quietly change
                the skeleton's height. */}
            <div className="flex min-h-6 items-center justify-between gap-2">
              <Shimmer className="h-4 w-28" />
              <Shimmer className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex min-h-4 items-center justify-between gap-2">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-3 w-10" />
            </div>
            <div className="flex flex-col gap-1">
              <Shimmer className="h-1.5 w-full rounded-full" />
              <div className="flex min-h-4 items-center">
                <Shimmer className="h-3 w-40" />
              </div>
            </div>
            <div className="flex min-h-4 items-center justify-between gap-2">
              <Shimmer className="h-3 w-28" />
              <Shimmer className="h-3 w-20" />
            </div>
            <div className="flex min-h-6 items-center justify-between gap-2 border-t border-border pt-2">
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
