import { SkeletonBlock } from '@/features/meetings/components/meeting-chips'

/**
 * The route skeleton, shaped like the page it stands in for: header, the
 * at-a-glance stat row, the view switcher, the day strip, then meeting cards
 * with their date rail and chip row. The previous version drew two flat grey
 * groups that matched nothing on the real page, so arriving data rearranged
 * the whole screen.
 */
export default function MeetingsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Everything the pack has scheduled — upcoming and past.
          </p>
        </div>
        <SkeletonBlock className="h-8 w-28" />
      </div>

      <div className="flex flex-wrap gap-2" aria-hidden>
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="flex min-w-16 flex-col gap-1 rounded-lg border px-2.5 py-1.5">
            <SkeletonBlock className="h-6 w-8" />
            <SkeletonBlock className="h-3 w-14" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4" aria-hidden>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SkeletonBlock className="h-8 w-44" />
          <SkeletonBlock className="h-5 w-40" />
        </div>
        <SkeletonBlock className="h-12 w-full rounded-lg" />
        <div className="flex flex-col gap-2">
          <SkeletonBlock className="h-5 w-28" />
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <SkeletonBlock className="h-12 w-12 shrink-0 rounded-lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SkeletonBlock className="h-4 w-48" />
                    <SkeletonBlock className="h-3.5 w-32" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <SkeletonBlock className="h-5 w-20" />
                    <SkeletonBlock className="h-5 w-24" />
                    <SkeletonBlock className="h-5 w-16" />
                  </div>
                  <SkeletonBlock className="h-3.5 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
