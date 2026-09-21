import { Suspense } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listRecentAbsences } from '@/features/worklog/absence-queries'
import { absenceKindLabel } from '@/features/worklog/absence-kinds'
import type { AbsenceKind } from '@/features/worklog/absence-kinds'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import {
  GRID_STATUSES,
  absenceMonthGrid,
  dayAbsences,
  groupAbsencesByDay,
  makeIsHoliday,
  parseAbsenceDay,
  parseAbsenceKind,
  parseAbsenceMonth,
} from '@/features/worklog/absence-calendar'
import { loadAbsenceCalendar } from '@/features/worklog/absence-calendar-queries'
import type { AbsenceCalendarRow } from '@/features/worklog/absence-calendar-queries'
import { AbsenceCalendarToolbar } from '@/features/worklog/components/absence-calendar-toolbar'
import { AbsenceCalendarSkeleton } from '@/features/worklog/components/absence-calendar-skeleton'
import { AbsenceMonthGrid } from '@/features/worklog/components/absence-month-grid'
import { AbsenceDayPanel } from '@/features/worklog/components/absence-day-panel'
import { AbsenceListView } from '@/features/worklog/components/absence-list-view'
import type { Actor } from '@/features/auth/capabilities'

type RawAbsenceParams = {
  view?: string
  month?: string
  day?: string
  kind?: string
}

/**
 * The month grid, not the flat list — see the design doc for why. Split into
 * two zones on purpose:
 *
 * CONTROLS BEFORE DATA. The toolbar (prev/next/today/view/kind) is built from
 * the URL alone and renders synchronously; only the grid itself sits behind
 * <Suspense>. Without the split, clicking "Next month" would blank the whole
 * card — including the button just clicked — until the query returns.
 *
 * GRID != SHEET ON STATUSES. The grid only ever shows pending/approved
 * (GRID_STATUSES) — a rejected filing didn't happen, painting it makes the
 * month lie. The day sheet and the ?view=list table show all four statuses,
 * because "what was filed" is a different, honest question from "who is out".
 *
 * The page-level `canReview` boolean this file used to compute (`absence
 * .approve` with no resource, which fails closed for every 'scoped' manager)
 * is gone. Reach is decided per row now, inside loadAbsenceCalendar /
 * AbsenceListView, against the ABSENT person's apps — see canReviewAbsence.
 */
export default async function AdminAbsencesPage(props: {
  searchParams: Promise<RawAbsenceParams>
}) {
  const actor = await loadActor()
  if (!actor || !can(actor, 'absence.view')) notFound()

  const raw = await props.searchParams
  const todayIso = toIsoDateInTimeZone(new Date())
  const view: 'calendar' | 'list' = raw.view === 'list' ? 'list' : 'calendar'
  const month = parseAbsenceMonth(raw.month, todayIso)
  const kind = parseAbsenceKind(raw.kind)
  const grid = absenceMonthGrid(month)
  const day = parseAbsenceDay(raw.day, grid.days)
  const monthLabel = format(new Date(`${month}-01T12:00:00`), 'MMMM yyyy')
  // Calendar view, current month/kind, no `day` — the grid appends its own
  // `&day=`, and the day sheet closes back to exactly this.
  const baseHref = `/admin/absences?view=calendar&month=${month}${kind ? `&kind=${kind}` : ''}`

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Absences</CardTitle>
        <CardDescription>
          {view === 'list' ? (
            <>
              Leave, training, and days spent on another project — the 50 most recent
              filings, newest first. An approved absence makes those days exempt, so they
              never count against coverage — and a day the person logged anyway still counts
              as work, not leave.
            </>
          ) : (
            <>
              Who is out, and when. Pending filings are dashed, approved ones solid — open a
              day to decide it.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AbsenceCalendarToolbar view={view} month={month} kind={kind} todayIso={todayIso} />

        {view === 'list' ? (
          <AbsenceListData actor={actor} />
        ) : (
          <Suspense fallback={<AbsenceCalendarSkeleton />}>
            <AbsenceGridData
              actor={actor}
              month={month}
              monthLabel={monthLabel}
              grid={grid}
              day={day}
              kind={kind}
              todayIso={todayIso}
              baseHref={baseHref}
            />
          </Suspense>
        )}
      </CardContent>
    </Card>
  )
}

/** ?view=list, unchanged in substance — see absence-list-view.tsx for the row markup. */
async function AbsenceListData({ actor }: { actor: Actor }) {
  const absences = await listRecentAbsences(actor)
  return <AbsenceListView absences={absences} actor={actor} />
}

/**
 * The month's data, split out purely so the toolbar above can paint before
 * this resolves (see the page-level comment). Catches its own load so a
 * flaky query leaves the toolbar usable — the admin can still step to
 * another month — rather than tripping the route's error boundary.
 */
async function AbsenceGridData({
  actor,
  month,
  monthLabel,
  grid,
  day,
  kind,
  todayIso,
  baseHref,
}: {
  actor: Actor
  month: string
  monthLabel: string
  grid: { days: string[]; from: string; to: string }
  day: string | null
  kind: AbsenceKind | null
  todayIso: string
  /** Calendar view, current month/kind, no `day` — the grid appends its own
   *  `&day=`, and the day sheet closes back to exactly this. */
  baseHref: string
}) {
  let rows: AbsenceCalendarRow[]
  let orgHolidayDays: string[]
  try {
    const loaded = await loadAbsenceCalendar(actor, grid.from, grid.to)
    rows = loaded.rows
    orgHolidayDays = loaded.orgHolidayDays
  } catch {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <p>Could not load this month&rsquo;s absences.</p>
        <Link href={baseHref} className="text-primary underline">
          Try again
        </Link>
      </div>
    )
  }

  // Gazette ∪ org holidays, composed once — never a function crossing into
  // the client grid, just the resulting set of days.
  const isHoliday = makeIsHoliday(orgHolidayDays)
  const isHolidayDays = new Set(grid.days.filter(isHoliday))

  // ?kind filters grid, sheet and list alike (spec: URL grammar) — applied
  // once here, ahead of the GRID_STATUSES clip, so the sheet (all statuses)
  // and the grid (pending/approved only) see the same filtered set.
  const kindFiltered = kind ? rows.filter((r) => r.kind === kind) : rows
  const gridRows = kindFiltered.filter((r) => GRID_STATUSES.includes(r.status))
  const byDay = groupAbsencesByDay(gridRows, grid.days)

  return (
    <>
      <AbsenceMonthGrid
        month={month}
        days={grid.days}
        todayIso={todayIso}
        selectedDay={day}
        byDay={byDay}
        isHolidayDays={isHolidayDays}
        baseHref={baseHref}
      />

      {rows.length === 0 ? (
        // Empty month, not an absence of one — the grid above still renders.
        <p className="text-sm text-muted-foreground">
          Nobody is away in {monthLabel}.{' '}
          <Link href="/admin/absences?view=list" className="underline">
            See the list instead.
          </Link>
        </p>
      ) : kindFiltered.length === 0 ? (
        // Filtered-empty is a distinct message from empty-month — the month
        // isn't quiet, this filter just doesn't match anything in it.
        <p className="text-sm text-muted-foreground">
          No {absenceKindLabel(kind as AbsenceKind)} filings in {monthLabel}.{' '}
          <Link href={`/admin/absences?view=calendar&month=${month}`} className="underline">
            Clear filter
          </Link>
        </p>
      ) : null}

      {day ? (
        <AbsenceDayPanel
          day={day}
          rows={dayAbsences(kindFiltered, day)}
          actorId={actor.id}
          closeHref={baseHref}
        />
      ) : null}
    </>
  )
}
