import Link from 'next/link'
import { format } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ABSENCE_KIND_DEFINITIONS, absenceKindLabel, type AbsenceKind } from '@/features/worklog/absence-kinds'
import { shiftAbsenceMonth } from '@/features/worklog/absence-calendar'

/**
 * Server-rendered from the URL alone, no client JS — every control here is
 * either a `<Link>` or a native GET `<form>`, so it paints and is clickable
 * before the month query (behind the page's `<Suspense>`) has answered. See
 * the page-level comment on why that split matters.
 *
 * `?day=` is never carried forward from here: every control below changes
 * the month, the view or the filter, and a day sheet pinned to a date that
 * may no longer be on screen (or no longer matches the filter) is a stale
 * sheet, not a helpful one.
 */
export function AbsenceCalendarToolbar({
  view,
  month,
  kind,
  todayIso,
}: {
  view: 'calendar' | 'list'
  month: string
  kind: AbsenceKind | null
  todayIso: string
}) {
  const kindParam = kind ? `&kind=${kind}` : ''
  const monthLabel = format(new Date(`${month}-01T12:00:00`), 'MMMM yyyy')
  const todayMonth = todayIso.slice(0, 7)

  const hrefForMonth = (m: string) => `/admin/absences?view=${view}&month=${m}${kindParam}`
  const hrefForView = (v: 'calendar' | 'list') => `/admin/absences?view=${v}&month=${month}${kindParam}`
  const hrefForKind = (k: AbsenceKind | null) =>
    `/admin/absences?view=${view}&month=${month}${k ? `&kind=${k}` : ''}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          render={<Link href={hrefForMonth(shiftAbsenceMonth(month, -1))} scroll={false} aria-label="Previous month" />}
        >
          <ChevronLeftIcon aria-hidden />
        </Button>
        <span className="min-w-32 text-center font-mono text-sm tabular-nums">{monthLabel}</span>
        <Button
          size="icon-sm"
          variant="ghost"
          render={<Link href={hrefForMonth(shiftAbsenceMonth(month, 1))} scroll={false} aria-label="Next month" />}
        >
          <ChevronRightIcon aria-hidden />
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-disabled={month === todayMonth}
          className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
          render={<Link href={hrefForMonth(todayMonth)} scroll={false} />}
        >
          Today
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="View" className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <Button
            size="sm"
            variant={view === 'calendar' ? 'secondary' : 'ghost'}
            aria-current={view === 'calendar'}
            render={<Link href={hrefForView('calendar')} scroll={false} />}
          >
            Calendar
          </Button>
          <Button
            size="sm"
            variant={view === 'list' ? 'secondary' : 'ghost'}
            aria-current={view === 'list'}
            render={<Link href={hrefForView('list')} scroll={false} />}
          >
            List
          </Button>
        </div>

        {/* A row of links, not a <select> — every href is built right here,
            so no client JS is needed to write the URL. "All kinds" clears
            the filter. */}
        <div role="group" aria-label="Filter by kind" className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant={kind === null ? 'secondary' : 'ghost'}
            aria-current={kind === null}
            render={<Link href={hrefForKind(null)} scroll={false} />}
          >
            All kinds
          </Button>
          {ABSENCE_KIND_DEFINITIONS.map((k) => (
            <Button
              key={k.id}
              size="sm"
              variant={kind === k.id ? 'secondary' : 'ghost'}
              aria-current={kind === k.id}
              render={<Link href={hrefForKind(k.id)} scroll={false} />}
            >
              {absenceKindLabel(k.id)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
