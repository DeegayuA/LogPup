/**
 * One chronological list of every gazetted and company holiday, from both
 * sources at once, saying for each whether the studio actually closes.
 *
 * WHY THIS EXISTS. The admin page used to list only `org_holidays` and told
 * the reader, in its empty state, that "gazetted Sri Lankan public holidays
 * already apply automatically and are not listed here". Both halves of that
 * sentence were true and together they were a trap: the gazetted calendar is
 * what actually exempts most days of the year (`isMercantileHoliday`, read at
 * coverage time), so the one page an admin opens to answer "is the 27th a
 * working day?" was the one page that could not answer it. Worse, the
 * add-form's own duplicate warning pointed at a list the duplicate would not
 * appear in.
 *
 * NOT EVERY ROW IS A DAY OFF. Gazetted and "day the studio closes" are two
 * different facts — a bank closing day is gazetted and worked — so every row
 * carries `closesTheStudio` and the page states the answer rather than
 * leaving the reader to infer it from a row of category badges.
 *
 * The two sources stay SEPARATE ROWS on a shared date rather than merging
 * into one. A company holiday added on top of a gazetted one is a real,
 * separate record — somebody typed it, it has a note and an author, and it
 * can be revoked — while the gazetted day underneath it stays in force
 * either way. Collapsing them would hide exactly the fact the admin came to
 * check.
 *
 * Pure and DB-free on purpose: the merge is the part worth testing, and it is
 * testable here with two plain arrays and no mocking.
 */

import { excusesWork, LK_HOLIDAYS, type HolidayCategory, type LkHoliday } from '@/lib/lk-holidays'
import { isOrgHolidayInForce } from '@/features/worklog/org-holidays'
import type { OrgHolidayRow } from '@/features/worklog/org-holiday-queries'

export type HolidaySource = 'gazette' | 'company'

export type HolidayCalendarRow = {
  /** Stable React key. Gazetted days have no id of their own, so the date is it. */
  key: string
  day: string
  name: string
  source: HolidaySource
  /** Empty for company holidays — a studio shutdown is not gazetted as
   *  anything, and labelling it 'public' would be a claim about the law. */
  categories: readonly HolidayCategory[]
  note: string | null
  addedByName: string | null
  /** Company rows only: the day a cancellation took effect, or null. */
  revokedFrom: string | null
  /** `org_holidays.id`, present iff source === 'company' — revoke needs it. */
  orgId: string | null
}

/**
 * Merges the gazetted calendar with the company's own rows, soonest first.
 *
 * On a shared date the gazetted row sorts first: it was already in force
 * before anybody added anything, so it reads as the ground the company row is
 * stacked on rather than as a competing entry.
 */
export function buildHolidayCalendar(
  orgRows: readonly OrgHolidayRow[],
  gazette: Record<string, LkHoliday> = LK_HOLIDAYS,
): HolidayCalendarRow[] {
  const gazetteRows: HolidayCalendarRow[] = Object.entries(gazette).map(([day, holiday]) => ({
    key: `gazette:${day}`,
    day,
    name: holiday.name,
    source: 'gazette',
    categories: holiday.categories,
    note: null,
    addedByName: null,
    revokedFrom: null,
    orgId: null,
  }))

  const companyRows: HolidayCalendarRow[] = orgRows.map((row) => ({
    key: `company:${row.id}`,
    day: row.day,
    name: row.name,
    source: 'company',
    categories: [],
    note: row.note,
    addedByName: row.createdByName,
    revokedFrom: row.revokedFrom,
    orgId: row.id,
  }))

  return [...gazetteRows, ...companyRows].sort((a, b) => {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1
    if (a.source === b.source) return a.name.localeCompare(b.name)
    return a.source === 'gazette' ? -1 : 1
  })
}

/**
 * Splits the calendar at today, because a holidays page is read forwards.
 *
 * `todayIso` is the caller's Colombo date (`toIsoDateInTimeZone`), never the
 * browser's — the same rule every other holiday read follows. Today itself
 * counts as UPCOMING: a day you are currently having off has not passed.
 */
export function splitByDay(
  rows: readonly HolidayCalendarRow[],
  todayIso: string,
): { upcoming: HolidayCalendarRow[]; past: HolidayCalendarRow[] } {
  return {
    upcoming: rows.filter((r) => r.day >= todayIso),
    // Newest first: the day that just went by is the one somebody is asking about.
    past: rows.filter((r) => r.day < todayIso).reverse(),
  }
}

/**
 * Whether this row is a day the studio is actually shut.
 *
 * THE SAME QUESTION COVERAGE ASKS, so the page cannot say one thing while the
 * denominator says another: a gazetted row closes the studio only if the
 * Mercantile list covers it (`excusesWork`), and a company row only while it
 * is in force (`isOrgHolidayInForce` — a cancellation never reaches back over
 * a day that has already passed).
 *
 * A false here is not a defect in the row. Poya, Public and Bank days that
 * the mercantile gazette leaves out are real gazetted days that this office
 * works through, and listing them is how an admin can see that.
 */
export function closesTheStudio(row: HolidayCalendarRow): boolean {
  if (row.source === 'gazette') return excusesWork(row.categories)
  return isOrgHolidayInForce({ day: row.day, revokedFrom: row.revokedFrom })
}

/** Badge text for a gazetted day's categories. */
export const HOLIDAY_CATEGORY_LABEL: Record<HolidayCategory, string> = {
  public: 'Public',
  bank: 'Bank',
  mercantile: 'Mercantile',
  poya: 'Poya',
}
