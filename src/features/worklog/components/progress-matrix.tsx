import Link from 'next/link'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  classifyDay,
  DAY_STATE_CLASS,
  DAY_STATE_LABEL,
  dayStateText,
  loggedTone,
  type DayInput,
  type DayState,
} from '@/features/worklog/day-state'
import { formatCoverage, type CoverageSummary } from '@/features/worklog/coverage'
import {
  buildDayMix,
  type LegendEntry,
  type MixSegment,
} from '@/features/worklog/day-app-mix'
import { eventDotClasses } from '@/features/meetings/event-color'
import type { ProgressMatrixData } from '@/features/worklog/progress-queries'

/**
 * The people × days matrix — a real table, because that is what it is: one
 * row per person, one column per day, and screen readers get the row/column
 * associations for free.
 *
 * Every day cell speaks the ONE day vocabulary (day-state.ts) shared with the
 * /worklog calendar; the only thing added here is the holiday's name in the
 * title. The first column is sticky so the person stays named while the days
 * scroll — and only the table's own container scrolls, never the page.
 */

/** Anchored to local noon — the repo-wide guard for date-only strings. */
function noon(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase()
}

/** At most one decimal, no trailing `.0` — the same trim formatCoverage uses. */
const num = (n: number) => String(Math.round(n * 10) / 10)

/**
 * The compact "9/12" the summary cell shows. Never a bare percentage — the
 * denominator travels with the number — and the full formatCoverage sentence
 * rides along as the title and sr-only text, so the honest form is always
 * one hover or one virtual-cursor step away.
 */
function compactCoverage(s: CoverageSummary): string {
  if (s.expected === 0 && s.notRequired > 0) return '—'
  return `${num(s.logged)}/${num(s.expected)}`
}

const LEGEND_STATES: DayState[] = ['logged', 'owed', 'absence', 'holiday', 'off']

export function ProgressMatrix({ data, today }: { data: ProgressMatrixData; today: string }) {
  const { days, people, closedDays, holidayNames } = data
  const from = days[0]
  const to = days[days.length - 1]

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            Work log state per person and day, {format(noon(from), 'MMMM d')} to{' '}
            {format(noon(to), 'MMMM d')}. People with the most owed days come first.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 border-b bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                Person
              </th>
              {days.map((iso) => {
                const isToday = iso === today
                return (
                  <th key={iso} scope="col" className="border-b px-0.5 py-2 text-center align-bottom">
                    <span aria-hidden className="block text-2xs font-normal text-muted-foreground">
                      {format(noon(iso), 'EEEEE')}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        'font-mono text-xs tabular-nums',
                        isToday ? 'font-semibold text-primary' : 'font-medium',
                      )}
                    >
                      {Number(iso.slice(8, 10))}
                    </span>
                    <span className="sr-only">
                      {format(noon(iso), 'EEEE, MMMM d')}
                      {isToday ? ' (today)' : ''}
                    </span>
                  </th>
                )
              })}
              <th
                scope="col"
                className="border-b px-3 py-2 text-right text-xs font-medium text-muted-foreground"
              >
                Logged
              </th>
              {/* DAYS AND HOURS ARE DIFFERENT QUESTIONS, so they get different
                  columns. "4/9.5" says how much of what the schedule expected
                  was answered at all; hours say how much time those answers
                  account for. A person can be 9.5/9.5 with two hours recorded,
                  and reading either number as the other is the confusion this
                  grid exists to remove. */}
              <th
                scope="col"
                className="border-b px-3 py-2 text-right text-xs font-medium text-muted-foreground"
              >
                Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((person, index) => {
              const border = index === people.length - 1 ? undefined : 'border-b'
              return (
                <tr key={person.id}>
                  <th
                    scope="row"
                    className={cn('sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-normal', border)}
                  >
                    <Link
                      href={`/people/${person.id}`}
                      className="flex w-28 min-w-0 items-center gap-2 sm:w-40 lg:w-48 rounded-md outline-none transition-colors duration-150 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
                    >
                      <Avatar size="sm">
                        {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt="" /> : null}
                        <AvatarFallback>{initials(person.name)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-medium">{person.name}</span>
                    </Link>
                  </th>
                  {days.map((iso) => {
                    const input: DayInput = {
                      iso,
                      percent: person.percentByDay.get(iso),
                      absent: person.absentDays.has(iso),
                      holiday: closedDays.has(iso),
                      today,
                      joinDay: person.joinDay,
                    }
                    const state = classifyDay(input)
                    const mix = buildDayMix(person.entriesByDay.get(iso) ?? [])
                    const holidayName = state === 'holiday' ? holidayNames.get(iso) : undefined
                    const text = holidayName
                      ? `${dayStateText(input)} — ${holidayName}`
                      : dayStateText(input)
                    return (
                      <td
                        key={iso}
                        className={cn('group/cell px-0.5 py-1 text-center', border)}
                        title={mixTitle(text, mix)}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'mx-auto flex size-6 items-center justify-center rounded-md font-mono text-2xs tabular-nums',
                            // A dense grid gives no sign that a cell is worth
                            // hovering, and every cell carries a title nobody
                            // knows is there. A lift on hover is the only cue
                            // that says "there is more here" without adding a
                            // pixel of height.
                            'transition-transform duration-150 group-hover/cell:scale-125 motion-reduce:transition-none motion-reduce:group-hover/cell:scale-100',
                            DAY_STATE_CLASS[state],
                            state === 'logged' && loggedTone(input.percent ?? 0),
                          )}
                        >
                          {state === 'logged' ? (
                            <span className="hidden md:inline">{input.percent}</span>
                          ) : null}
                        </span>
                        {/* Which projects the day went to, UNDER the number
                            rather than behind it: a saturated cell would fight
                            the figure it annotates, and the identity hues were
                            never chosen to carry text. Widths are minute
                            shares, so a day that was mostly one project reads
                            as that without being read. */}
                        {mix.length > 0 ? (
                          <span
                            aria-hidden
                            className="mx-auto mt-0.5 flex h-1 w-6 gap-px overflow-hidden rounded-full"
                          >
                            {mix.map((segment, i) => (
                              <span
                                key={`${segment.appId ?? 'none'}-${i}`}
                                style={{ width: `${segment.share * 100}%` }}
                                className={cn(
                                  'h-full',
                                  // Unassigned time takes the neutral tone,
                                  // never a hue — colouring it would invent a
                                  // project for work nobody assigned to one.
                                  eventDotClasses(segment.appId) ?? 'bg-muted-foreground/40',
                                )}
                              />
                            ))}
                          </span>
                        ) : null}
                        <span className="sr-only">{mixTitle(text, mix)}</span>
                      </td>
                    )
                  })}
                  <td
                    className={cn('px-3 py-1.5 text-right align-middle', border)}
                    title={formatCoverage(person.coverage)}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'font-mono text-xs tabular-nums',
                        person.coverage.missing > 0
                          ? 'font-medium text-chart-1'
                          : 'text-muted-foreground',
                      )}
                    >
                      {compactCoverage(person.coverage)}
                    </span>
                    <span className="sr-only">{formatCoverage(person.coverage)}</span>
                  </td>
                  {(() => {
                    // Summed from the SAME entries the cells and the legend
                    // are built from, so the row total and the bars can never
                    // disagree about what the day contained.
                    let minutes = 0
                    for (const entries of person.entriesByDay.values()) {
                      for (const entry of entries) minutes += entry.minutes
                    }
                    return (
                      <td
                        className={cn('px-3 py-1.5 text-right align-middle', border)}
                        title={
                          minutes > 0
                            ? `${formatMinutes(minutes)} recorded against projects in this window`
                            : 'No hours recorded in this window'
                        }
                      >
                        {/* An em dash, never 0h. Nobody in this workspace has
                            recorded an hour yet, and a zero reads as "worked
                            none" rather than "recorded none". */}
                        <span
                          className={cn(
                            'font-mono text-xs tabular-nums',
                            minutes > 0 ? 'text-foreground' : 'text-muted-foreground/50',
                          )}
                        >
                          {minutes > 0 ? formatMinutes(minutes) : '—'}
                        </span>
                      </td>
                    )
                  })()}
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Inside the scroll container and under the grid: the hues belong to
            the cells above them, and a legend that scrolled away from its own
            grid would be a key to a lock in another room. */}
        <MixLegend legend={data.mixLegend} />
      </div>

      {/* Colour never carries a state alone: every cell already speaks via
          title + sr-only text, and this names the palette for sighted
          readers learning the grid. */}
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="What the cell colours mean">
        {LEGEND_STATES.map((state) => (
          <li key={state} className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span
              aria-hidden
              className={cn(
                'size-3 rounded-sm',
                state === 'logged' ? 'bg-primary' : DAY_STATE_CLASS[state],
              )}
            />
            {DAY_STATE_LABEL[state]}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The matrix's own loading shape — shared by the Suspense fallback and the
 * route's loading.tsx so the swap never shifts layout. Columns are capped at
 * a fortnight's worth; a month of shimmer squares promises nothing extra.
 */
/**
 * The cell's title and screen-reader text, with the project split appended.
 *
 * Written as hours, not shares: "3h Kestrel · 1h 30m Apollo" is what somebody
 * can check against their own memory of the day, where "67% / 33%" is a figure
 * they would have to convert before it means anything. The bar carries the
 * proportion visually; the text carries the amount.
 */
function mixTitle(base: string, mix: MixSegment[]): string {
  if (mix.length === 0) return base
  return `${base} — ${mix.map((s) => `${formatMinutes(s.minutes)} ${s.label}`).join(' · ')}`
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/**
 * The legend, and the reason the bars mean anything.
 *
 * Only projects actually on screen, heaviest first — a legend listing the
 * whole portfolio would name projects no cell shows, and a reader checking a
 * hue against it would find several candidates.
 *
 * "Unassigned" is named here even though it is not a project, because the grey
 * segment IS on screen and an unexplained grey reads as a rendering fault
 * rather than as a real state.
 */
function MixLegend({ legend }: { legend: LegendEntry[] }) {
  if (legend.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 px-3 py-2.5">
      <span className="font-mono text-2xs tracking-wide text-muted-foreground uppercase">
        Projects
      </span>
      {/* A key, not navigation. /apps/[slug] is keyed by SLUG and the entries
          carry only an id, so linking here would 404 — and a legend swatch is
          answering "what is this colour", not offering a destination. */}
      {legend.map((item) => (
        <span key={item.appId} className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <span
            aria-hidden
            className={cn('size-2 rounded-full', eventDotClasses(item.appId) ?? 'bg-muted')}
          />
          <span className="truncate">{item.label}</span>
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
        <span aria-hidden className="size-2 rounded-full bg-muted-foreground/40" />
        Unassigned
      </span>
    </div>
  )
}

export function ProgressMatrixSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="sr-only" role="status">
        Loading the people matrix…
      </span>
      <div aria-hidden className="overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5',
              i < rows - 1 && 'border-b',
            )}
          >
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-28 shrink-0" />
            <div className="flex flex-1 justify-end gap-1 overflow-hidden">
              {Array.from({ length: 14 }, (_, j) => (
                <Skeleton key={j} className="size-6 shrink-0" />
              ))}
            </div>
            <Skeleton className="h-4 w-10 shrink-0" />
          </div>
        ))}
      </div>
      <Skeleton aria-hidden className="h-4 w-72 max-w-full" />
    </div>
  )
}
