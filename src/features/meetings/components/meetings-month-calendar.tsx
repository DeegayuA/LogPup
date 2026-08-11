'use client'

import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isLkHoliday, isLkSunday } from '@/lib/lk-holidays'
import { cn } from '@/lib/utils'
import type { MeetingSummary } from '@/features/meetings/queries'

/* Event chips colored per app on the shared chart ramp (stable hash), the
   way Untitled UI's event calendar colors per calendar source. */
const CHIP_TONES = [
  'border-chart-1 bg-chart-1/15',
  'border-chart-2 bg-chart-2/15',
  'border-chart-3 bg-chart-3/15',
  'border-chart-4 bg-chart-4/15',
  'border-chart-5 bg-chart-5/15',
]

function chipTone(appName: string | null): string {
  if (!appName) return 'border-primary bg-primary/12'
  let hash = 0
  for (const char of appName) hash = (hash + char.charCodeAt(0)) % CHIP_TONES.length
  return CHIP_TONES[hash]
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE = 3

/** Full chip text for the accessible tree — the visible spans truncate, and the
    app is otherwise encoded only as a border hue. */
function chipLabel(meeting: MeetingSummary, isPast: boolean): string {
  return [
    meeting.title,
    format(meeting.startsAt, 'h:mm a'),
    meeting.appName,
    isPast ? 'past' : null,
  ]
    .filter(Boolean)
    .join(', ')
}

export function MeetingsMonthCalendar({
  upcoming,
  past,
  onSelectDay,
}: {
  upcoming: MeetingSummary[]
  past: MeetingSummary[]
  /** Hands a day back to the parent so a chip can drop into the filtered list. */
  onSelectDay?: (date: Date) => void
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [expanded, setExpanded] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, { meeting: MeetingSummary; isPast: boolean }[]>()
    const put = (meeting: MeetingSummary, isPast: boolean) => {
      const key = format(meeting.startsAt, 'yyyy-MM-dd')
      const list = map.get(key) ?? []
      list.push({ meeting, isPast })
      map.set(key, list)
    }
    for (const m of past) put(m, true)
    for (const m of upcoming) put(m, false)
    for (const list of map.values()) {
      list.sort((a, b) => +new Date(a.meeting.startsAt) - +new Date(b.meeting.startsAt))
    }
    return map
  }, [upcoming, past])

  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Date badge — today's date, Untitled-style */}
          <div className="flex w-12 flex-col overflow-hidden rounded-lg border text-center">
            <span className="bg-muted px-1 py-0.5 font-mono text-2xs font-medium uppercase text-muted-foreground">
              {format(new Date(), 'MMM')}
            </span>
            <span className="py-0.5 font-heading text-lg font-bold leading-tight">
              {format(new Date(), 'd')}
            </span>
          </div>
          <div className="flex flex-col">
            {/* h2 — /meetings owns the h1, and the list view's "Upcoming" is an
                h2, so the calendar view must not skip a level. */}
            <h2 className="font-heading text-lg font-semibold leading-tight">
              {format(cursor, 'MMMM yyyy')}
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {format(monthStart, 'MMM d')} – {format(monthEnd, 'MMM d, yyyy')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor((c) => addMonths(c, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="h-7 px-2.5"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label="Next month"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[840px] overflow-hidden rounded-xl border">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
              >
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const entries = byDay.get(key) ?? []
              const inMonth = isSameMonth(day, cursor)
              const isExpanded = expanded === key
              const visible = isExpanded ? entries : entries.slice(0, MAX_VISIBLE)
              // Same Sri Lanka holiday/Sunday markers as the mini-calendar day
              // strip (src/components/kibo-ui/mini-calendar), reusing its
              // helpers rather than re-deriving the rules here. A Sunday that
              // is also a public holiday still reads as a holiday (holiday
              // wins) — the dot marker is what keeps that legible without
              // relying on the red/orange hue alone.
              const holidayName = isLkHoliday(day)
              const isWeekendDay = isLkSunday(day) && !holidayName
              return (
                <div
                  key={key}
                  className={cn(
                    'flex min-h-28 min-w-0 flex-col gap-1 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0',
                    !inMonth && 'bg-muted/25',
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span
                      aria-hidden
                      title={holidayName}
                      className={cn(
                        'flex size-5 items-center justify-center rounded-full font-mono text-xs',
                        isToday(day)
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : holidayName
                            ? 'text-holiday'
                            : isWeekendDay
                              ? 'text-weekend'
                              : inMonth
                                ? 'text-foreground'
                                : // The tinted cell already de-emphasises
                                  // out-of-month days; alpha on top of it
                                  // drops the date below AA.
                                  'text-muted-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {holidayName ? (
                      <span aria-hidden className="size-1 shrink-0 rounded-full bg-holiday" />
                    ) : null}
                    <span className="sr-only">
                      {format(day, 'EEEE, MMMM d')}
                      {holidayName ? `, ${holidayName}` : ''}
                    </span>
                  </div>
                  {visible.map(({ meeting, isPast }) => (
                    /* A real control, not a tooltip-only div: the full title,
                       time and app name live in the accessible tree (the visible
                       spans truncate), and activating the chip drops the parent
                       into that day's filtered list. "Past" is a dashed, hollow
                       border plus a spoken ", past" — never opacity, which drove
                       the chip text under AA and said nothing to a screen
                       reader. */
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={() => onSelectDay?.(meeting.startsAt)}
                      className={cn(
                        'flex min-w-0 flex-col gap-0.5 rounded-sm border-l-2 px-1.5 py-0.5 text-left',
                        'transition-colors duration-150 hover:brightness-95',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        chipTone(meeting.appName),
                        isPast && 'border-dashed bg-transparent',
                      )}
                    >
                      <span className="sr-only">{chipLabel(meeting, isPast)}</span>
                      <span aria-hidden className="flex w-full min-w-0 items-center gap-1">
                        <span className="min-w-0 truncate text-xs">{meeting.title}</span>
                        <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
                          {format(meeting.startsAt, 'h:mm a')}
                        </span>
                      </span>
                      {/* The app name is visible text, not just the border hue:
                          five chart tones are hashed across every app, so colour
                          alone can neither name the app nor tell two of them
                          apart for a colourblind user (WCAG 1.4.1). */}
                      {meeting.appName ? (
                        <span
                          aria-hidden
                          className="w-full min-w-0 truncate text-2xs text-muted-foreground"
                        >
                          {meeting.appName}
                        </span>
                      ) : null}
                    </button>
                  ))}
                  {/* One button across both states — rendering "+N more" and
                      "Show less" as separate elements unmounted the control the
                      user was standing on, dropping focus to <body>. */}
                  {entries.length > MAX_VISIBLE ? (
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpanded(isExpanded ? null : key)}
                      className="w-fit rounded-sm text-2xs text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                    >
                      {isExpanded ? 'Show less' : `+${entries.length - MAX_VISIBLE} more`}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
