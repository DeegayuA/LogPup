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

export function MeetingsMonthCalendar({
  upcoming,
  past,
}: {
  upcoming: MeetingSummary[]
  past: MeetingSummary[]
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
            <h3 className="font-heading text-lg font-semibold leading-tight">
              {format(cursor, 'MMMM yyyy')}
            </h3>
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
              const hidden = entries.length - visible.length
              return (
                <div
                  key={key}
                  className={cn(
                    'flex min-h-28 min-w-0 flex-col gap-1 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0',
                    !inMonth && 'bg-muted/25',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full font-mono text-xs',
                      isToday(day)
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/60',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {visible.map(({ meeting, isPast }) => (
                    <div
                      key={meeting.id}
                      title={`${meeting.title} · ${format(meeting.startsAt, 'h:mm a')}${meeting.appName ? ` · ${meeting.appName}` : ''}`}
                      className={cn(
                        'flex min-w-0 items-center gap-1 rounded-sm border-l-2 px-1.5 py-0.5',
                        chipTone(meeting.appName),
                        isPast && 'opacity-55',
                      )}
                    >
                      <span className="min-w-0 truncate text-xs">{meeting.title}</span>
                      <span className="ml-auto shrink-0 font-mono text-2xs text-muted-foreground">
                        {format(meeting.startsAt, 'h:mm a')}
                      </span>
                    </div>
                  ))}
                  {hidden > 0 ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(key)}
                      className="w-fit rounded-sm text-2xs text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      +{hidden} more
                    </button>
                  ) : null}
                  {isExpanded && entries.length > MAX_VISIBLE ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(null)}
                      className="w-fit rounded-sm text-2xs text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      Show less
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
