import Link from 'next/link'
import { format } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon, Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DAY_STATE_CLASS,
  DAY_STATE_LABEL,
  classifyDay,
  dayStateText,
  isHalfDay,
  loggedTone,
  type DayState,
} from '@/features/worklog/day-state'
import { getLkHoliday, excusesWork, LK_TIMEZONE } from '@/lib/lk-holidays'

export type CalendarDayFacts = {
  /** Self-scored percent for logged days, by ISO day. */
  loggedPercent: Readonly<Record<string, number>>
  /** ISO days covered by an APPROVED absence. Pending ones don't excuse. */
  absentDays: ReadonlySet<string>
  /** ISO day → holiday name, ONLY days that actually close the studio */
  closedDays: Readonly<Record<string, string>>
  /**
   * ISO days carrying at least one hour entry.
   *
   * Separate from `loggedPercent` because they are separate records written by
   * separate actions: a day can have hours and no score (`partial`) or a score
   * and no hours (`logged`). Nothing here derives either from the other.
   */
  hourDays: ReadonlySet<string>
}

function monthShape(month: string): { first: string; count: number } {
  const [year, monthIndex] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))]
  const count = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate()
  return { first: `${month}-01`, count }
}

export function shiftMonth(month: string, steps: number): string {
  const cursor = new Date(`${month}-15T12:00:00Z`)
  cursor.setUTCMonth(cursor.getUTCMonth() + steps)
  return cursor.toISOString().slice(0, 7)
}

function mondayColumn(iso: string): number {
  // Midday UTC, matching workingDayFraction's anchor in src/lib/working-days.ts:
  // far enough from either boundary that the +05:30 Colombo offset cannot tip
  // the weekday to its neighbour. Kept in step with that file deliberately — a
  // grid that disagreed with the working-day rule about which column a date
  // belongs in would paint Saturdays under Sunday.
  return (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7
}

const WEEKDAYS = [
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
  ['Sun', 'Sunday'],
] as const

const LEGEND_STATES: readonly DayState[] = [
  'logged',
  // Beside 'owed', because that is what it still is — a started one. Reading
  // the legend should tell somebody what is left, and a half-logged day is
  // left.
  'partial',
  'owed',
  'absence',
  'holiday',
  'off',
  'future',
  'outside',
]

function legendSwatchClass(state: DayState): string {
  if (state === 'logged') return cn(DAY_STATE_CLASS.logged, loggedTone(100))
  return DAY_STATE_CLASS[state]
}

export function WorklogCalendar({
  month,
  today,
  joinDay,
  selectedDay,
  facts,
}: {
  month: string
  today: string
  joinDay: string | null
  selectedDay: string | null
  facts: CalendarDayFacts
}) {
  const { first, count } = monthShape(month)
  const days = Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  const leadingPad = mondayColumn(first)
  const monthLabel = format(new Date(`${first}T12:00:00`), 'MMMM yyyy')
  const prevMonth = shiftMonth(month, -1)
  const nextMonth = shiftMonth(month, 1)

  const navHref = (m: string) =>
    selectedDay ? `/worklog?month=${m}&day=${selectedDay}` : `/worklog?month=${m}`

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border/70 bg-card/40 p-5 shadow-xs backdrop-blur-sm">
      {/* Month Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarIcon className="size-4" />
          </span>
          <div>
            <h2 className="font-heading text-base font-bold tracking-tight text-foreground sm:text-lg">
              {monthLabel}
            </h2>
            <span className="font-mono text-2xs text-muted-foreground">
              {count} days &bull; Sri Lanka Studio Calendar
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            render={
              <Link
                href={navHref(prevMonth)}
                scroll={false}
                aria-label={`Previous month, ${format(new Date(`${prevMonth}-01T12:00:00`), 'MMMM yyyy')}`}
              />
            }
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
          </Button>

          <Button variant="outline" size="sm" render={<Link href="/worklog" scroll={false} />}>
            Today
          </Button>

          <Button
            variant="outline"
            size="icon-sm"
            render={
              <Link
                href={navHref(nextMonth)}
                scroll={false}
                aria-label={`Next month, ${format(new Date(`${nextMonth}-01T12:00:00`), 'MMMM yyyy')}`}
              />
            }
          >
            <ChevronRightIcon className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Weekday Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS.map(([short, long]) => (
          <div key={short} className="pb-1 text-center font-mono text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span aria-hidden>{short}</span>
            <span className="sr-only">{long}</span>
          </div>
        ))}

        {Array.from({ length: leadingPad }, (_, i) => (
          <div key={`pad-${i}`} aria-hidden />
        ))}

        {days.map((iso) => {
          const percent = facts.loggedPercent[iso]
          const closed = iso in facts.closedDays
          const lkHoliday = getLkHoliday(new Date(`${iso}T12:00:00Z`), LK_TIMEZONE)
          const holidayName = facts.closedDays[iso] || lkHoliday?.name
          const isMercantile = lkHoliday ? excusesWork(lkHoliday.categories) : Boolean(facts.closedDays[iso])
          const isPoya = lkHoliday?.categories.includes('poya') ?? false

          const input = {
            iso,
            percent,
            hasHours: facts.hourDays.has(iso),
            absent: facts.absentDays.has(iso),
            holiday: closed,
            today,
            joinDay,
          }
          const state = classifyDay(input)
          const half = isHalfDay(iso, closed)
          const clickable = state !== 'future' && state !== 'outside'
          const selected = iso === selectedDay
          const isToday = iso === today
          const srText = dayStateText(input)

          const categoryDesc = isMercantile
            ? 'Mercantile Holiday (Studio Off)'
            : lkHoliday
            ? 'Bank/Public Only (Working Day)'
            : ''
          const title = holidayName
            ? `${srText} — ${holidayName} [${categoryDesc}]`
            : srText

          const paint = (
            <>
              <div
                aria-hidden
                className={cn(
                  'absolute inset-0 flex flex-col justify-between p-1 rounded-[inherit] overflow-hidden transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none',
                  // DAY_STATE_CLASS is the ONLY paint for a state. A local
                  // override here (holiday was repainted in --chart-1) puts
                  // this calendar and the /progress matrix on two different
                  // colour systems for the same fact, which is exactly what
                  // day-state.ts exists to prevent — and --chart-1 is the
                  // data-viz ember, already meaning "attention" elsewhere.
                  DAY_STATE_CLASS[state],
                  state === 'logged' && percent !== undefined && loggedTone(percent),
                  half && 'top-1/2 rounded-t-none',
                )}
              >
                {/* Top Row: Date Number & Badges */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={cn(
                      'font-mono text-xs tabular-nums',
                      isToday && 'font-bold underline decoration-2 underline-offset-2 text-primary',
                      selected && 'font-bold',
                    )}
                  >
                    {Number(iso.slice(8, 10))}
                  </span>

                  {/* Hidden below `sm`: at 320px a seven-column grid gives each
                      cell ~40px, and the number plus this badge on one row left
                      neither legible. The cell's fill tone (loggedTone) already
                      encodes the percent there, and the sr-only sentence states
                      it exactly for anyone who cannot see the tone. */}
                  {state === 'logged' && percent !== undefined ? (
                    <span className="hidden sm:inline font-mono text-2xs font-semibold tabular-nums">
                      {percent}%
                    </span>
                  ) : half ? (
                    <span className="font-mono text-2xs text-muted-foreground font-medium">
                      ½d
                    </span>
                  ) : isPoya ? (
                    <span className="size-2 rounded-full bg-chart-1 ring-1 ring-chart-1/30" title="Full Moon Poya" />
                  ) : null}
                </div>

                {/* Bottom Row: Text Holidays & Mercantile / Non-Mercantile Indicator */}
                {holidayName ? (
                  <div className="flex flex-col gap-0.5 leading-tight truncate mt-auto">
                    <span className="truncate font-heading text-[9.5px] font-bold text-chart-1 tracking-tight">
                      {holidayName.split(' ')[0]}
                    </span>
                    <span
                      className={cn(
                        'inline-block truncate rounded px-1 py-0.5 font-mono text-2xs font-bold uppercase tracking-wider',
                        isMercantile
                          ? 'bg-chart-1/25 text-chart-1'
                          : 'bg-muted/80 text-muted-foreground',
                      )}
                    >
                      {isMercantile ? 'Mercantile' : 'Public/Bank'}
                    </span>
                  </div>
                ) : state === 'absence' ? (
                  <div className="truncate mt-auto">
                    <span className="font-mono text-2xs font-semibold text-tag-discussion">
                      Leave
                    </span>
                  </div>
                ) : state === 'owed' ? (
                  <div className="truncate mt-auto">
                    <span className="font-mono text-2xs font-medium text-chart-1">
                      Owed
                    </span>
                  </div>
                ) : null}
              </div>

              <span className="sr-only">
                {srText}
                {isToday ? ', today' : ''}
                {selected ? ', selected' : ''}
                {holidayName ? `, ${holidayName} (${categoryDesc})` : ''}
              </span>
            </>
          )

          const cellClass = cn(
            'relative block min-h-[58px] sm:min-h-[64px] rounded-xl border border-border/60 bg-card/60 transition-[background-color,border-color,color,box-shadow] duration-150 motion-reduce:transition-none',
            selected && 'ring-2 ring-primary border-primary shadow-sm',
          )

          if (!clickable) {
            return (
              <span key={iso} aria-disabled="true" title={title} className={cellClass}>
                {paint}
              </span>
            )
          }

          return (
            <Link
              key={iso}
              href={`/worklog?month=${month}&day=${iso}`}
              scroll={false}
              title={title}
              aria-current={isToday ? 'date' : selected ? 'true' : undefined}
              className={cn(
                cellClass,
                'outline-none hover:border-primary/50 hover:bg-card focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none cursor-pointer',
              )}
            >
              {paint}
            </Link>
          )
        })}
      </div>

      {/* Legend */}
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-2xs text-muted-foreground border-t border-border/40 pt-3">
        {LEGEND_STATES.map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                'size-3 shrink-0 rounded-sm border border-border/60',
                legendSwatchClass(state),
              )}
            />
            {state === 'holiday' ? (
              <span>
                <strong>Holiday:</strong> Mercantile (Studio Off) / Public
              </span>
            ) : (
              DAY_STATE_LABEL[state]
            )}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="relative size-3 shrink-0 overflow-hidden rounded-sm border border-border/60">
            <span className="absolute inset-x-0 bottom-0 h-1/2 bg-primary" />
          </span>
          Half day (Saturday 50%)
        </li>
      </ul>
    </div>
  )
}
