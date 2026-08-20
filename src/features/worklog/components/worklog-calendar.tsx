import Link from 'next/link'
import { format } from 'date-fns'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
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

/**
 * The month, visible: one cell per day, painted with the SHARED day-state
 * vocabulary (day-state.ts) — the same classes the /progress matrix uses, so
 * the two surfaces cannot drift into different colours for the same fact.
 *
 * A custom grid rather than react-day-picker on ui/calendar: every cell here
 * carries state, a link, a half-fill and two text layers, which is exactly
 * the control a date PICKER exists to take away.
 *
 * Server component. Selection is a URL (`?day=`), so clicking a day is a
 * navigation the server answers with that day's form — no client state, and
 * the selected day is linkable like everything else on this page.
 *
 * Colour never carries a state alone: every cell renders `dayStateText` for
 * screen readers and as its title, and the legend below names every state in
 * words (WCAG 1.4.1).
 */

export type CalendarDayFacts = {
  /** Self-scored percent for logged days, by ISO day. */
  loggedPercent: Readonly<Record<string, number>>
  /** ISO days covered by an APPROVED absence. Pending ones don't excuse. */
  absentDays: ReadonlySet<string>
  /** ISO day → holiday name, ONLY days that actually close the studio
   *  (gazetted mercantile + in-force company rows, composed upstream via
   *  buildHolidayCalendar/closesTheStudio). */
  closedDays: Readonly<Record<string, string>>
}

/** `YYYY-MM` → the ISO first day and the count of days in that month. */
function monthShape(month: string): { first: string; count: number } {
  const [year, monthIndex] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))]
  // Day 0 of the NEXT month = the last day of this one. UTC throughout —
  // these are calendar positions, not instants; day math stays in
  // working-days.ts and day-state.ts.
  const count = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate()
  return { first: `${month}-01`, count }
}

/** The `YYYY-MM` one step away. Anchored mid-month so length never bites. */
export function shiftMonth(month: string, steps: number): string {
  const cursor = new Date(`${month}-15T12:00:00Z`)
  cursor.setUTCMonth(cursor.getUTCMonth() + steps)
  return cursor.toISOString().slice(0, 7)
}

/** Monday-first column index for an ISO day — layout only, never day policy. */
function mondayColumn(iso: string): number {
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

/** Legend order: the states a person acts on first, the ambient ones after. */
const LEGEND_STATES: readonly DayState[] = [
  'logged',
  'owed',
  'absence',
  'holiday',
  'off',
  'future',
  'outside',
]

/** The legend's swatch for a state — `logged` shows the full-strength fill
 *  the cells use (`loggedTone`), the rest reuse DAY_STATE_CLASS verbatim. */
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
  /** `YYYY-MM`, already validated by the page. */
  month: string
  /** Today as a Colombo ISO day (resolveWorkDay). */
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

  /** Month nav keeps the selected day: paging to July does not un-answer
   *  "which day is open in the panel". */
  const navHref = (m: string) =>
    selectedDay ? `/worklog?month=${m}&day=${selectedDay}` : `/worklog?month=${m}`

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-semibold">{monthLabel}</h2>
        <div className="flex items-center gap-1">
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
            <ChevronLeftIcon aria-hidden />
          </Button>
          {/* Bare /worklog is "now": current month, today selected. */}
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
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(([short, long]) => (
          <div key={short} className="pb-1 text-center text-2xs font-medium text-muted-foreground">
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
          const input = {
            iso,
            percent,
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
          const title = closed ? `${srText} — ${facts.closedDays[iso]}` : srText

          const paint = (
            <>
              <span
                aria-hidden
                className={cn(
                  'absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-[inherit]',
                  DAY_STATE_CLASS[state],
                  state === 'logged' && percent !== undefined && loggedTone(percent),
                  // The half-fill: a half working Saturday paints only its
                  // bottom half, so the month reads half days at a glance.
                  half && 'top-1/2 rounded-t-none',
                )}
              >
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    isToday && 'font-bold underline decoration-2 underline-offset-2',
                  )}
                >
                  {Number(iso.slice(8, 10))}
                </span>
                {state === 'logged' && percent !== undefined ? (
                  <span className="hidden text-2xs font-medium tabular-nums md:block">
                    {percent}%
                  </span>
                ) : null}
              </span>
              <span className="sr-only">
                {srText}
                {isToday ? ', today' : ''}
                {selected ? ', selected' : ''}
              </span>
            </>
          )

          const cellClass = cn(
            'relative block min-h-10 rounded-md sm:min-h-12',
            selected && 'ring-2 ring-ring',
          )

          if (!clickable) {
            // Not a dead click: future days and days before joining are not
            // selectable, and they say so instead of swallowing the tap.
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
                'outline-none transition-[box-shadow] duration-150 hover:ring-2 hover:ring-ring/40 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none',
              )}
            >
              {paint}
            </Link>
          )
        })}
      </div>

      {/* Every state IN WORDS — the colours are reinforcement, never the
          message. The half-fill gets its own entry because it is a modifier
          on top of any state, not a state. */}
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-2xs text-muted-foreground">
        {LEGEND_STATES.map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            {/* The base border keeps swatches for the unpainted states
                (future, before joining) from being invisible squares. */}
            <span
              aria-hidden
              className={cn(
                'size-3 shrink-0 rounded-sm border border-border/60',
                legendSwatchClass(state),
              )}
            />
            {DAY_STATE_LABEL[state]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="relative size-3 shrink-0 overflow-hidden rounded-sm">
            <span className="absolute inset-x-0 bottom-0 h-1/2 bg-primary" />
          </span>
          Half day (bottom half filled)
        </li>
      </ul>
    </div>
  )
}
