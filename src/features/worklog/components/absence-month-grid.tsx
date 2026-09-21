'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Clock, FileText, Plane, Store, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isWorkingDay, isHalfWorkingDay } from '@/lib/working-days'
import { getLkHoliday } from '@/lib/lk-holidays'
import { isoToDisplayDate } from '@/features/meetings/calendar-view'
import { HolidayIcons, HolidayLegend, holidayCategoryLabel, holidayToneClass } from '@/components/shared/holiday-icon'
import { eventColorClasses, eventSolidClasses } from '@/features/meetings/event-color'
import { shiftAbsenceMonth } from '@/features/worklog/absence-calendar'
import {
  ABSENCE_KIND_DEFINITIONS,
  absenceKindLabel,
  exemptsWholeDay,
  type AbsenceGroup,
} from '@/features/worklog/absence-kinds'
import type { AbsenceCalendarRow } from '@/features/worklog/absence-calendar-queries'

/**
 * The month grid — a TRUE ARIA grid with roving tabindex, new to this
 * codebase (the meetings month calendar has no grid semantics; its keyboard
 * story is dnd-kit's). `'use client'` for exactly that reason: this fetches
 * nothing, it only owns which cell currently holds the single tab stop.
 *
 * `role="grid"` + a `columnheader` row + one `role="row"` per week
 * (`display: contents` so the CSS grid still lays the 7 columns out) +
 * `role="gridcell"` per day wrapping ONE focusable button. Chips inside a
 * cell are deliberately NOT focusable — see the module-level a11y note on
 * `dayAbsences` below; the detail and every action live one Enter away in
 * the day sheet, which is focus-trapped and has real buttons.
 */

const GROUP_ICON: Record<AbsenceGroup, typeof Plane> = {
  'Time off': Plane,
  'Part of a day': Clock,
  'Working, elsewhere': Briefcase,
  'Filed for you': FileText,
}
const GROUP_BY_KIND = new Map<string, AbsenceGroup>(ABSENCE_KIND_DEFINITIONS.map((k) => [k.id, k.group]))

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 3

function firstName(name: string): string {
  return name.split(' ')[0]
}

/** One glyph per `AbsenceGroup`, never a hue — kind is a shape, identity is
 *  colour, and the two must never merge into one signal. Exported (pure, no
 *  React) so it is testable without mounting the grid — this repo has zero
 *  `.test.tsx`, so the pure logic a `'use client'` component needs tested
 *  lives here as a named export a plain `.test.ts` file can still import. */
export function absenceGroupIcon(kind: string): LucideIcon {
  return GROUP_ICON[GROUP_BY_KIND.get(kind) ?? 'Filed for you']
}

/** Where roving focus starts: the selected day, else today, else the
 *  grid's first day — never a day the caller didn't actually hand in. */
export function initialFocusedDay(
  days: readonly string[],
  selectedDay: string | null,
  todayIso: string,
): string {
  if (selectedDay && days.includes(selectedDay)) return selectedDay
  if (days.includes(todayIso)) return todayIso
  return days[0]
}

/** Arrow/Home/End math, clipped to the grid's own bounds — never wraps into
 *  a neighbouring month (PageUp/PageDown do that, and only that, in the
 *  caller). Returns null for a key this stepper doesn't move on (Enter,
 *  Space, PageUp, PageDown — the caller handles those itself). */
export function stepFocusIndex(index: number, key: string, total: number): number | null {
  const COLS = 7
  switch (key) {
    case 'ArrowRight':
      return index < total - 1 ? index + 1 : index
    case 'ArrowLeft':
      return index > 0 ? index - 1 : index
    case 'ArrowDown':
      return index + COLS < total ? index + COLS : index
    case 'ArrowUp':
      return index - COLS >= 0 ? index - COLS : index
    case 'Home':
      return index - (index % COLS)
    case 'End':
      return Math.min(total - 1, index - (index % COLS) + COLS - 1)
    default:
      return null
  }
}

/** The whole fact a cell button's accessible name must carry — colour is
 *  never the only signal, so status, kind and the holiday are all words
 *  here. Pure and exported for the same reason as `absenceGroupIcon`. */
export function dayCellAccessibleName(params: {
  iso: string
  isToday: boolean
  rows: readonly { userName: string; kind: string; status: string }[]
  holidayCategoryLabel: string | null
  holidayName: string | null
  /** True for a non-working day with no holiday NAME to say instead (a
   *  plain Sunday) — colour is never the only signal that a day is quiet. */
  isQuietDay?: boolean
}): string {
  const { iso, isToday, rows, holidayCategoryLabel: categoryLabel, holidayName, isQuietDay } = params
  const sentenceParts = rows.map(
    (row) => `${firstName(row.userName)} — ${absenceKindLabel(row.kind)}, ${row.status}`,
  )
  return [
    `${iso}${isToday ? ', today' : ''}`,
    rows.length > 0 ? `${rows.length} away: ${sentenceParts.join('; ')}.` : null,
    holidayName
      ? `${categoryLabel ?? 'Holiday'}: ${holidayName}.`
      : isQuietDay
        ? 'Non-working day.'
        : null,
  ]
    .filter(Boolean)
    .join(', ')
}

/** `isHolidayDays` already carries gazette ∪ org holidays composed once
 *  server-side (`makeIsHoliday`) — this component never re-derives that
 *  union. `getLkHoliday` is asked ONLY for display copy (a name and an
 *  icon), never to decide whether a day counts as one. */
function isHoliday(days: ReadonlySet<string>) {
  return (iso: string) => days.has(iso)
}

export function AbsenceMonthGrid({
  month,
  days,
  todayIso,
  selectedDay,
  byDay,
  isHolidayDays,
  baseHref,
}: {
  month: string
  days: string[]
  todayIso: string
  selectedDay: string | null
  byDay: Map<string, AbsenceCalendarRow[]>
  isHolidayDays: ReadonlySet<string>
  baseHref: string
}) {
  const router = useRouter()
  const holidayTest = useMemo(() => isHoliday(isHolidayDays), [isHolidayDays])

  // The one tab stop: selected day → today (if on this grid) → the 1st row.
  const initialFocus = useMemo(
    () => initialFocusedDay(days, selectedDay, todayIso),
    [days, selectedDay, todayIso],
  )
  const [focused, setFocused] = useState(initialFocus)
  const cellRefs = useRef(new Map<string, HTMLButtonElement>())

  function focusDay(iso: string) {
    if (!days.includes(iso)) return
    setFocused(iso)
    cellRefs.current.get(iso)?.focus()
  }

  function openDay(iso: string) {
    router.push(`${baseHref}&day=${iso}`, { scroll: false })
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, iso: string) {
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      const target = shiftAbsenceMonth(month, event.key === 'PageUp' ? -1 : 1)
      router.push(`/admin/absences?view=calendar&month=${target}`, { scroll: false })
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDay(iso)
      return
    }
    const nextIndex = stepFocusIndex(days.indexOf(iso), event.key, days.length)
    if (nextIndex === null) return
    event.preventDefault()
    focusDay(days[nextIndex])
  }

  return (
    <div role="grid" aria-label={`Absences, ${month}`} className="flex flex-col gap-1">
      <div role="row" className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div key={day} role="columnheader" className="text-center text-2xs text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {Array.from({ length: days.length / 7 }, (_, week) => (
        <div key={week} role="row" className="contents">
          <div className="col-span-7 grid grid-cols-7 gap-1">
            {days.slice(week * 7, week * 7 + 7).map((iso) => (
              <DayCell
                key={iso}
                iso={iso}
                month={month}
                todayIso={todayIso}
                selected={iso === selectedDay}
                tabIndex={iso === focused ? 0 : -1}
                rows={byDay.get(iso) ?? []}
                isHoliday={holidayTest(iso)}
                onKeyDown={(e) => handleKeyDown(e, iso)}
                onClick={() => {
                  setFocused(iso)
                  openDay(iso)
                }}
                buttonRef={(el) => {
                  if (el) cellRefs.current.set(iso, el)
                  else cellRefs.current.delete(iso)
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <AbsenceCalendarLegend />
    </div>
  )
}

/**
 * Calendar legend explaining filing statuses, group icons, and holiday badges.
 */
export function AbsenceCalendarLegend({ className }: { className?: string }) {
  return (
    <div
      aria-label="Calendar legend"
      className={cn(
        'mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-2xs text-muted-foreground',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-foreground/80">Status:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center rounded border border-border bg-muted/70 px-1.5 py-0.5 text-2xs font-medium text-foreground">
            Solid
          </span>
          <span>Approved</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center rounded border border-dashed border-border bg-muted/30 px-1.5 py-0.5 text-2xs font-medium text-foreground">
            Dashed
          </span>
          <span>Pending approval</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-foreground/80">Kind:</span>
        <span className="inline-flex items-center gap-1">
          <Plane className="size-3 text-foreground/70" aria-hidden />
          <span>Time off</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3 text-foreground/70" aria-hidden />
          <span>Part of day (½)</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Briefcase className="size-3 text-foreground/70" aria-hidden />
          <span>Working elsewhere</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <FileText className="size-3 text-foreground/70" aria-hidden />
          <span>Filed for you</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-foreground/80">Holidays:</span>
        <HolidayLegend />
        <span className="inline-flex items-center gap-0.5">
          <span className="font-mono text-2xs font-medium text-foreground">½</span>
          <span>Saturday half-day</span>
        </span>
      </div>
    </div>
  )
}

function DayCell({
  iso,
  month,
  todayIso,
  selected,
  tabIndex,
  rows,
  isHoliday,
  onKeyDown,
  onClick,
  buttonRef,
}: {
  iso: string
  month: string
  todayIso: string
  selected: boolean
  tabIndex: 0 | -1
  rows: AbsenceCalendarRow[]
  isHoliday: boolean
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  onClick: () => void
  buttonRef: (el: HTMLButtonElement | null) => void
}) {
  const isToday = iso === todayIso
  const inMonth = iso.slice(0, 7) === month
  const dayNumber = Number(iso.slice(8, 10))
  const holidayRecord = getLkHoliday(isoToDisplayDate(iso))
  // An org holiday with no gazette entry — see the spec: it still closes the
  // studio, which is what the mercantile tone + Store glyph mean, but this
  // component was never handed the org holiday's own name (isHolidayDays is
  // booleans only), so it falls back to a generic label.
  const holidayName = isHoliday ? holidayRecord?.name ?? 'Company holiday' : undefined
  const holidayCategories = holidayRecord?.categories
  const half = isHalfWorkingDay(iso, () => isHoliday)
  const quiet = !isWorkingDay(iso, () => isHoliday)

  const visible = rows.slice(0, MAX_CHIPS)
  const overflow = rows.length - visible.length

  const accessibleName = dayCellAccessibleName({
    iso,
    isToday,
    rows,
    holidayCategoryLabel: holidayName ? holidayCategoryLabel(holidayCategories) ?? 'Holiday' : null,
    holidayName: holidayName ?? null,
    isQuietDay: quiet,
  })

  return (
    <div role="gridcell" aria-selected={selected} className="min-w-0">
      <button
        type="button"
        ref={buttonRef}
        tabIndex={tabIndex}
        aria-current={isToday ? 'date' : undefined}
        aria-label={accessibleName}
        onKeyDown={onKeyDown}
        onClick={onClick}
        className={cn(
          'flex min-h-[64px] w-full flex-col items-stretch gap-0.5 rounded-md border border-border/60 p-1 text-left transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:min-h-[92px]',
          quiet && 'bg-muted/40',
          selected && 'ring-2 ring-primary',
          !inMonth && 'opacity-60',
        )}
      >
        <div className="flex items-center justify-between">
          <span
            className={cn(
              'font-mono text-xs tabular-nums',
              !inMonth && 'text-muted-foreground/60',
              isToday && 'font-bold text-primary underline decoration-2 underline-offset-2',
            )}
          >
            {dayNumber}
          </span>
          {half ? <span className="font-mono text-2xs text-muted-foreground">½</span> : null}
        </div>

        {/* Chips, sm and up — collapse to dots below sm so a 40px cell never
            has to fit a name. */}
        <div className="hidden flex-col gap-0.5 sm:flex">
          {visible.map((row) => (
            <Chip key={row.id} row={row} />
          ))}
          {overflow > 0 ? (
            <span className="font-mono text-2xs text-muted-foreground">+{overflow} more</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-0.5 sm:hidden">
          {visible.map((row) => (
            <span
              key={row.id}
              aria-hidden
              className={cn(
                'size-2 rounded-full',
                row.status === 'approved' ? eventSolidClasses(row.userId) : eventColorClasses(row.userId),
                row.status !== 'approved' && 'border border-dashed',
              )}
            />
          ))}
          {rows.length > 0 ? (
            <span className="font-mono text-2xs text-muted-foreground">{rows.length}</span>
          ) : null}
        </div>

        {holidayName ? (
          <div className="mt-auto flex items-center gap-1 truncate">
            {holidayCategories ? (
              <HolidayIcons categories={holidayCategories} className="size-3" />
            ) : (
              <Store aria-hidden className={cn('size-3', holidayToneClass(holidayCategories) ?? 'text-mercantile')} />
            )}
            <span className="truncate text-2xs text-muted-foreground">{holidayName}</span>
          </div>
        ) : null}
      </button>
    </div>
  )
}

/** approved -> solid pill; pending -> outline + dashed. Never a hue for
 *  kind — see the module comment: identity is the only thing colour means
 *  here. The kind glyph beside the name carries kind instead. */
function Chip({ row }: { row: AbsenceCalendarRow }) {
  // Not `absenceGroupIcon(row.kind)` here: react-hooks' static-components
  // rule flags a JSX tag fed by a function call as "created during render"
  // even though the four glyphs are fixed — the direct Record lookup below
  // reads statically the same way holiday-icon.tsx's does. The exported
  // `absenceGroupIcon` stays for the pure-logic test (and any non-JSX use).
  const Icon = GROUP_ICON[GROUP_BY_KIND.get(row.kind) ?? 'Filed for you']
  const solid = row.status === 'approved'
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 truncate rounded border px-1 py-px text-2xs',
        solid ? eventSolidClasses(row.userId) : cn(eventColorClasses(row.userId), 'border-dashed'),
      )}
    >
      <Icon aria-hidden className="size-2.5 shrink-0" />
      <span className="truncate">{firstName(row.userName)}</span>
      {!exemptsWholeDay(row.kind) ? <sup>½</sup> : null}
    </span>
  )
}
