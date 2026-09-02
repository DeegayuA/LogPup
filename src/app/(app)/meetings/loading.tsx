import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The route skeleton, shaped like the DOCKET it stands in for: the one-line
 * header with its mono summary slot, the 2×2/1×4 triage-tile rail, the
 * sticky control rail bar, then a hairline ring-1 group of divide-y rows
 * (time column, title line, chip line). The previous version still mirrored
 * the deleted layout — five stat tiles and date-rail cards — so arriving
 * data rearranged the whole screen, which is exactly what this file exists
 * to prevent.
 *
 * The header is the REAL PageHeader with the real words — the title is
 * static, so there is nothing to wait for and nothing to shift when data
 * lands.
 */
export default function MeetingsLoading() {
  return (
    <div className="relative flex flex-1 flex-col gap-6 p-6 md:p-8">
      {/* The route change itself is silent to a screen reader — the URL moves
          and the old page's DOM is replaced with placeholders that are all
          aria-hidden. This is the announcement. Same wording pattern as the
          other loading routes so the app says one thing, one way. */}
      <span className="sr-only" role="status">
        Loading meetings…
      </span>
      <PageHeader
        title="Meeting Intelligence"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* The mono week-summary line + the load link + the split pill. */}
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-9 w-36 rounded-lg" />
          </div>
        }
      />

      {/* Triage rail: four filter tiles, 2-up on phones, 4-up from sm. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-hidden>
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="flex flex-col gap-1 rounded-xl border px-3 py-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4" aria-hidden>
        {/* View switcher row. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
        {/* h2 "Upcoming" + the sticky control rail bar. */}
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-11 w-full rounded-xl" />
        {/* The docket: one hairline group, rows divided by hairlines. */}
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-28" />
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {[0, 1, 2, 3].map((row) => (
              <li key={row} className="flex min-h-14 items-center gap-3 py-2 pr-2 pl-4 sm:pr-3">
                <div className="hidden w-16 shrink-0 flex-col gap-1 sm:flex">
                  <Skeleton className="h-3.5 w-12" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-h-11 items-center">
                    <Skeleton className="h-4 w-48 max-w-full" />
                  </div>
                  <Skeleton className="h-[26px] w-28 rounded-md" />
                </div>
                <Skeleton className="hidden h-6 w-24 md:block" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
