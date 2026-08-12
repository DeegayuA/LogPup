import { cn } from '@/lib/utils'

/**
 * The same `shimmer` class string people/loading.tsx uses, not a local
 * <Shimmer> component. The previous version defined its own, and the two had
 * already drifted in radius and pulse — two skeletons for one product should
 * not be distinguishable.
 *
 * THIS SKELETON MODELS THE PAGE IT STANDS IN FOR, block for block: back link,
 * identity header, seven stat tiles, then four half-width cards and two
 * full-width ones in the same grid with the same gaps. The old one modelled
 * three cards for a four-card page, so content visibly jumped on arrival.
 *
 * Heights are matched to the real thing rather than guessed — the stat tiles
 * carry `min-h-[4.75rem]`, exactly as PersonStatRow does, and the card blocks
 * are sized to their typical filled height. That is what makes this a
 * placeholder rather than a second, differently-shaped page.
 */
const shimmer = 'animate-pulse rounded-md bg-muted motion-reduce:animate-none'

function CardSkeleton({ rows, className }: { rows: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className={cn(shimmer, 'h-5 w-28')} />
        <div className={cn(shimmer, 'h-3 w-24')} />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={cn(shimmer, 'h-11 w-full rounded-lg')} />
        ))}
      </div>
    </div>
  )
}

export default function PersonDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <span className="sr-only" role="status">
        Loading person…
      </span>

      <div className="flex flex-col gap-4" aria-hidden>
        <div className={cn(shimmer, 'h-8 w-24 rounded-lg')} />
        <div className="flex flex-wrap items-start gap-4">
          <div className={cn(shimmer, 'size-14 rounded-full')} />
          <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
            <div className={cn(shimmer, 'h-7 w-48')} />
            <div className={cn(shimmer, 'h-4 w-56')} />
            <div className={cn(shimmer, 'h-3 w-64')} />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className={cn(shimmer, 'h-5 w-24 rounded-4xl')} />
              ))}
            </div>
          </div>
          <div className={cn(shimmer, 'h-8 w-32 rounded-lg')} />
        </div>
      </div>

      {/* Seven tiles, same grid and same min-height as PersonStatRow, so the
          strip does not resize under the cards when the numbers land.
          `justify-start` because the real tile is `flex-col-reverse
          justify-end`, which packs its content to the TOP of the box — the
          skeleton previously packed to the bottom, so every tile's contents
          jumped the height of the tile the moment the data arrived even though
          the strip itself never resized. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7" aria-hidden>
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="flex min-h-[4.75rem] flex-col justify-start gap-1.5 rounded-xl bg-card px-3 py-2.5 ring-1 ring-foreground/10"
          >
            <div className={cn(shimmer, 'h-7 w-12')} />
            <div className={cn(shimmer, 'h-3 w-16')} />
            <div className={cn(shimmer, 'h-2.5 w-20')} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2" aria-hidden>
        <CardSkeleton rows={3} />
        <CardSkeleton rows={4} />
        <CardSkeleton rows={3} />
        <CardSkeleton rows={3} />
        <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className={cn(shimmer, 'h-5 w-20')} />
            <div className={cn(shimmer, 'h-3 w-32')} />
          </div>
          {/* The contribution grid: 7 rows of blocks, not one big rectangle,
              so the shape reads as a calendar while it loads. */}
          <div className="flex flex-col gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className={cn(shimmer, 'h-2.5 w-full max-w-80 rounded-xs')} />
            ))}
          </div>
          <div className={cn(shimmer, 'h-3 w-56')} />
        </div>
        <CardSkeleton rows={4} className="lg:col-span-2" />
      </div>
    </div>
  )
}
