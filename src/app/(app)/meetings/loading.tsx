import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The route skeleton, shaped like the page it stands in for: header, the
 * at-a-glance stat row, the view switcher, the day strip, then meeting cards
 * with their date rail and chip row. The previous version drew two flat grey
 * groups that matched nothing on the real page, so arriving data rearranged
 * the whole screen.
 *
 * The header is the REAL PageHeader with the real words — title and
 * description are static, so there is nothing to wait for and nothing to
 * shift when data lands.
 */
export default function MeetingsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* The route change itself is silent to a screen reader — the URL moves
          and the old page's DOM is replaced with placeholders that are all
          aria-hidden. This is the announcement. Same wording pattern as the
          other loading routes so the app says one thing, one way. */}
      <span className="sr-only" role="status">
        Loading meetings…
      </span>
      <PageHeader
        title="Meetings"
        description="Everything the pack has scheduled — upcoming and past."
        actions={<Skeleton className="h-8 w-28" />}
      />

      {/* Five tiles — the widest real strip (the "Now" tile joins when a
          meeting is live). Predicting wide and losing one tile moves nothing
          below the row; predicting narrow shoved every tile sideways the
          moment a live meeting arrived. */}
      <div className="flex flex-wrap gap-2" aria-hidden>
        {[0, 1, 2, 3, 4].map((tile) => (
          <div key={tile} className="flex min-w-16 flex-col gap-1 rounded-lg border px-2.5 py-1.5">
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4" aria-hidden>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3.5 w-32" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
