import Link from 'next/link'
import {
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  getDaysInMonth,
  startOfMonth,
} from 'date-fns'
import { cn } from '@/lib/utils'
import type { Sprint } from '@/features/sprints/queries'

// Month-scale timeline: every day is the same number of pixels, so month
// columns are proportional to their real length and bars line up exactly.
const PX_PER_DAY = 4
const LABEL_WIDTH = 224
const ROW_HEIGHT = 56

/* Planned gets a hollow dashed treatment so planned vs active is never
   color-only (the two pine tones are nearly identical). */
const STATUS_COLOR: Record<Sprint['status'], string> = {
  planned: 'border border-dashed border-chart-2 bg-chart-2/25',
  active: 'bg-primary',
  done: 'bg-muted-foreground/40',
}

const STATUS_LABEL: Record<Sprint['status'], string> = {
  planned: 'Planned',
  active: 'Active',
  done: 'Done',
}

// Plain YYYY-MM-DD strings from the `date` column must not be handed to
// `new Date()` directly — that parses as UTC midnight and can shift a day in
// negative-offset timezones. Anchoring to local noon keeps the date stable.
function parseSprintDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`)
}

function formatRange(start: Date, end: Date): string {
  const startPattern = start.getFullYear() === end.getFullYear() ? 'MMM d' : 'MMM d, yyyy'
  return `${format(start, startPattern)} – ${format(end, 'MMM d, yyyy')}`
}

export function Roadmap({ sprints, slug }: { sprints: Sprint[]; slug: string }) {
  if (sprints.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="font-heading text-base font-semibold">No sprints to map yet.</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Once sprints exist, LogPup will chart them here on a timeline.
        </p>
      </div>
    )
  }

  // getSprintsForApp returns newest-first; the roadmap reads top-to-bottom in
  // chronological order instead.
  const ordered = [...sprints].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const lastEnd = ordered.reduce(
    (max, sprint) => (sprint.endDate > max ? sprint.endDate : max),
    ordered[0].endDate,
  )
  const timelineStart = startOfMonth(parseSprintDate(ordered[0].startDate))
  const timelineEnd = endOfMonth(parseSprintDate(lastEnd))
  const months = eachMonthOfInterval({ start: timelineStart, end: timelineEnd })
  const totalDays = differenceInCalendarDays(timelineEnd, timelineStart) + 1
  const timelineWidth = totalDays * PX_PER_DAY

  const todayOffset = differenceInCalendarDays(new Date(), timelineStart)
  const showToday = todayOffset >= 0 && todayOffset < totalDays
  const todayLeft = LABEL_WIDTH + (todayOffset + 0.5) * PX_PER_DAY

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          <span className="font-mono">{ordered.length}</span>{' '}
          {ordered.length === 1 ? 'sprint' : 'sprints'}
        </p>
        <div className="flex items-center gap-4">
          {(Object.keys(STATUS_LABEL) as Sprint['status'][]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn('size-2 rounded-full', STATUS_COLOR[status])} />
              {STATUS_LABEL[status]}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="relative w-max min-w-full">
          {/* Month gridlines, behind everything. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-0 flex"
            style={{ left: LABEL_WIDTH }}
          >
            {months.map((month) => (
              <div
                key={month.toISOString()}
                className="h-full border-r border-border/60"
                style={{ width: getDaysInMonth(month) * PX_PER_DAY }}
              />
            ))}
          </div>

          {/* Header: sticky label cell + proportional month columns. */}
          <div className="relative z-10 flex border-b border-border">
            <div
              className="sticky left-0 z-30 shrink-0 border-r border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground"
              style={{ width: LABEL_WIDTH }}
            >
              Sprint
            </div>
            <div className="flex" style={{ width: timelineWidth }}>
              {months.map((month, index) => (
                <div
                  key={month.toISOString()}
                  className="shrink-0 px-2 py-2 font-mono text-2xs text-muted-foreground"
                  style={{ width: getDaysInMonth(month) * PX_PER_DAY }}
                >
                  {format(month, index === 0 || month.getMonth() === 0 ? 'MMM yyyy' : 'MMM')}
                </div>
              ))}
            </div>
          </div>

          {/* One row per sprint; the whole row links to that sprint's board. */}
          <div className="relative z-10 divide-y divide-border/60">
            {ordered.map((sprint) => {
              const start = parseSprintDate(sprint.startDate)
              const end = parseSprintDate(sprint.endDate)
              const barLeft = differenceInCalendarDays(start, timelineStart) * PX_PER_DAY
              const barWidth = Math.max(
                (differenceInCalendarDays(end, start) + 1) * PX_PER_DAY,
                PX_PER_DAY * 2,
              )
              return (
                <Link
                  key={sprint.id}
                  href={`/apps/${slug}?sprint=${sprint.id}&tab=board`}
                  aria-label={`${sprint.name}, ${formatRange(start, end)}, ${STATUS_LABEL[sprint.status]}. Open board.`}
                  className="group flex outline-none transition-colors duration-150 hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div
                    className="sticky left-0 z-30 flex shrink-0 flex-col justify-center gap-0.5 border-r border-border bg-card px-3 transition-colors duration-150 group-hover:bg-accent group-focus-visible:bg-accent"
                    style={{ width: LABEL_WIDTH }}
                  >
                    <p className="truncate text-sm font-medium">{sprint.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {formatRange(start, end)}
                    </p>
                  </div>
                  <div
                    aria-hidden
                    className="relative shrink-0"
                    style={{ width: timelineWidth, height: ROW_HEIGHT }}
                  >
                    <span
                      className={cn(
                        'absolute top-1/2 h-6 -translate-y-1/2 rounded-md ring-1 ring-inset ring-foreground/10',
                        STATUS_COLOR[sprint.status],
                      )}
                      style={{ left: barLeft, width: barWidth }}
                    />
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Today marker, above bars but below the sticky label column. */}
          {showToday ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-20 w-px bg-chart-1"
              style={{ left: todayLeft }}
            >
              <span className="absolute top-1 left-1 whitespace-nowrap rounded-sm border border-chart-1 bg-card px-1 py-px font-mono text-2xs text-foreground">
                Today
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
