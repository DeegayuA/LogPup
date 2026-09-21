import { addCalendarMonths, visibleRange } from '@/features/meetings/calendar-view'
import { isoDayAdd } from '@/features/people/iso-day'
import { absenceDays } from '@/features/worklog/absence-days'
import { ABSENCE_KIND_DEFINITIONS, type AbsenceKind } from '@/features/worklog/absence-kinds'
import { isMercantileHoliday } from '@/lib/lk-holidays'

/**
 * Pure month/grid/day helpers for the `/admin/absences` calendar. PURE ON
 * PURPOSE — no `@/db`, no React — so the aggregation the whole page hangs off
 * (which day gets which chips) is testable with plain arrays and no Actor.
 *
 * All date arithmetic is DELEGATED, never re-derived: `visibleRange` /
 * `addCalendarMonths` (meetings/calendar-view.ts) already own the
 * Monday-started-month-grid and month-stepping math this page needs to match,
 * and `absenceDays` (worklog/absence-days.ts) already owns the half-open
 * range clip a multi-day absence needs against a window.
 */

/** The row shape every helper below needs — a generic, not `AbsenceRow`
 *  itself, so the test suite needs no query module and no Actor. */
export type AbsenceSpan = {
  id: string
  userId: string
  userName: string
  kind: string
  status: string
  startDate: string
  endDate: string
}

const MONTH_RE = /^(\d{4})-(\d{2})$/

/** The focused month from the URL, falling back to today's month for
 *  anything missing, malformed, or naming a month that does not exist
 *  (`2026-13`) — the same "never trust the query string" contract
 *  `calendar-view.ts`'s `parseFocusedDate` follows. */
export function parseAbsenceMonth(raw: string | null | undefined, todayIso: string): string {
  const match = raw ? MONTH_RE.exec(raw) : null
  if (match) {
    const monthNum = Number(match[2])
    if (monthNum >= 1 && monthNum <= 12) return raw as string
  }
  return todayIso.slice(0, 7)
}

/** Where Prev / Next / Today land. Wraps `addCalendarMonths`, which already
 *  clamps day-of-month and rolls the year over — this only needs the
 *  'yyyy-mm' slice back off its 'yyyy-mm-dd' return. */
export function shiftAbsenceMonth(month: string, steps: number): string {
  return addCalendarMonths(`${month}-01`, steps).slice(0, 7)
}

/**
 * The padded Monday-started grid for `month`, plus the inclusive bounds the
 * query reads (`from`/`to` are the first/last day ON SCREEN, not the
 * calendar month's own bounds — a leave request on the 31st of last month
 * must still show up in the cell the user can see).
 */
export function absenceMonthGrid(month: string): { days: string[]; from: string; to: string } {
  const range = visibleRange('month', `${month}-01`)
  return { days: range.days, from: range.start, to: range.end }
}

/** The selected day from the URL — `null` unless it names a day actually on
 *  the current grid. An off-grid `?day=` (a hand-edited URL, or one left over
 *  from a month the user has since navigated away from) must never open an
 *  empty sheet. */
export function parseAbsenceDay(raw: string | null | undefined, days: readonly string[]): string | null {
  if (!raw) return null
  return days.includes(raw) ? raw : null
}

const ABSENCE_KIND_IDS = new Set<string>(ABSENCE_KIND_DEFINITIONS.map((k) => k.id))

/** The `?kind=` filter from the URL, or `null` for anything not a real kind. */
export function parseAbsenceKind(raw: string | null | undefined): AbsenceKind | null {
  return raw && ABSENCE_KIND_IDS.has(raw) ? (raw as AbsenceKind) : null
}

/**
 * Pending + approved only. "Rejected and withdrawn rows never enter the
 * grid" — a calendar answers "who is out", and a refused filing is not
 * somebody being out; painting it would make the month lie. Both statuses
 * still appear in `dayAbsences` (the sheet) and in the untouched `?view=list`.
 */
export const GRID_STATUSES: readonly string[] = ['pending', 'approved']

/**
 * day -> rows, for the grid.
 *
 * `absenceDays` is HALF-OPEN at its `to` bound (`[from, to)`), but a grid's
 * `to` is the LAST day ON SCREEN and must itself be included — so it is
 * called with `isoDayAdd(to, 1)`, once, here. Forgetting this clip is the
 * exact bug the module comment on `absenceDays` warns every caller about:
 * the last column would silently lose every absence ending on it.
 */
export function groupAbsencesByDay<T extends AbsenceSpan>(
  rows: readonly T[],
  days: readonly string[],
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  if (days.length === 0) return map
  const from = days[0]
  const windowTo = isoDayAdd(days[days.length - 1], 1)

  for (const row of rows) {
    if (!GRID_STATUSES.includes(row.status)) continue
    for (const day of absenceDays([row], from, windowTo)) {
      const bucket = map.get(day)
      if (bucket) bucket.push(row)
      else map.set(day, [row])
    }
  }
  return map
}

/**
 * All four statuses, for the sheet — pending first (not yet a fact, wants
 * attention first), then by start date, then by name.
 */
export function dayAbsences<T extends AbsenceSpan>(rows: readonly T[], day: string): T[] {
  return rows
    .filter((r) => r.startDate <= day && r.endDate >= day)
    .slice()
    .sort((a, b) => {
      const aPending = a.status === 'pending'
      const bPending = b.status === 'pending'
      if (aPending !== bPending) return aPending ? -1 : 1
      if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1
      return a.userName.localeCompare(b.userName)
    })
}

/**
 * The composed studio predicate the whole page shares: gazette ∪ org
 * holidays — the one definition `working-days.ts`'s `isWorkingDay` and
 * `coverage.ts` both compose from, so a day is never a holiday on this page
 * and a working day on another.
 */
export function makeIsHoliday(orgHolidayDays: readonly string[]): (iso: string) => boolean {
  const orgSet = new Set(orgHolidayDays)
  return (iso: string) => isMercantileHoliday(iso) || orgSet.has(iso)
}
