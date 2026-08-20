/**
 * Sri Lankan public, bank, and mercantile holidays.
 *
 * The 26 dates keyed `[...PUBLIC]` / `[...PUBLIC_POYA]` below are the 2026
 * GAZETTE PUBLIC holidays (source: adaderana 2026 holiday calendar). Every
 * Full Moon Poya Day additionally carries the `'poya'` category (it is
 * literally the day of the full moon). A further three well-established
 * bank/mercantile-only closing days — NOT in the public-holiday gazette list
 * — are appended separately below and marked as such.
 *
 * Sri Lankan holiday categories are gazette-published annually (only 2026 is
 * covered today): the public-holiday list, the mercantile subset (see the
 * warning on `PUBLIC` below) and the bank/mercantile-only additions should
 * all be re-verified — and this file extended with new `yyyy-mm-dd` entries
 * — each year the next gazette is published. No other code needs to change,
 * since every lookup below is keyed by ISO date.
 *
 * ONLY 'mercantile' MEANS A DAY OFF. The Mercantile list (Shop and Office
 * Employees Act) is the one that shuts this studio; a bank-only closing day
 * is an ordinary working day for everybody here, and a Poya day the
 * mercantile gazette leaves out is one too. Two questions therefore live in
 * this file and must never be swapped:
 *
 *   LEGAL EFFECT — does this day excuse work? `isMercantileHoliday(iso)`,
 *                  or `excusesWork(categories)` when the record is in hand.
 *                  This is what coverage and the backfill prompt ask.
 *   CALENDAR FACT — is anything gazetted this day? `getLkHoliday(date)` /
 *                  `getLkHolidayName(date)`. This is what a calendar asks, so
 *                  it still marks Poya on a day the office is open.
 */

/** A single holiday can be observed under more than one of these at once —
 *  see `getHolidayIconKind` for how the UI collapses that down to one icon. */
export type HolidayCategory = 'public' | 'bank' | 'mercantile' | 'poya'

export type LkHoliday = {
  name: string
  categories: HolidayCategory[]
}

/**
 * ⚠ THE MERCANTILE SUBSET BELOW IS AN APPROXIMATION — NOT GAZETTE-VERIFIED.
 *
 * In Sri Lankan practice the Mercantile holiday list (declared under the Shop
 * and Office Employees Act) is a SUBSET of the Public holiday list, published
 * in its own gazette annually — it is NOT the same list. Notably most Full
 * Moon Poya Days are public and bank holidays but NOT mercantile holidays,
 * while Vesak is all three.
 *
 * This file does not encode that subset, because we do not have the 2026
 * mercantile gazette to hand and will not guess it. Instead `PUBLIC` DERIVES
 * `'mercantile'` FROM `'public'` — i.e. it asserts every gazetted public
 * holiday is also a mercantile holiday, which is knowingly too generous for
 * some poya days. Treat any 'Mercantile holiday' label the UI shows for a
 * public holiday as unverified until someone checks the gazette.
 *
 * THAT APPROXIMATION IS NOW LOAD-BEARING: `'mercantile'` is the single
 * category that excuses work, so every date it over-claims is a date the
 * studio hands out as a day off that the law does not.
 *
 * To correct a date once the gazette is known: replace `[...PUBLIC]` /
 * `[...PUBLIC_POYA]` on that entry with an explicit array that simply omits
 * `'mercantile'` (e.g. `['public', 'bank', 'poya']`). Nothing else changes —
 * `getHolidayIconKind` already distinguishes mercantile from bank-only days,
 * and `isMercantileHoliday` reads the array rather than the key, so the
 * correction is a DATA edit. It is not free, though: coverage recomputes at
 * read time, so a day that loses `'mercantile'` becomes a day people
 * retroactively owed work for. See the note on `isMercantileHoliday`.
 */
const PUBLIC: readonly HolidayCategory[] = ['public', 'bank', 'mercantile']
/** ...and a Full Moon Poya Day carries 'poya' on top of that. */
const PUBLIC_POYA: readonly HolidayCategory[] = ['public', 'bank', 'mercantile', 'poya']

export const LK_HOLIDAYS: Record<string, LkHoliday> = {
  '2026-01-03': { name: 'Duruthu Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-01-15': { name: 'Tamil Thai Pongal Day', categories: [...PUBLIC] },
  '2026-02-01': { name: 'Navam Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-02-04': { name: 'Independence Day', categories: [...PUBLIC] },
  '2026-02-15': { name: 'Maha Shivaratri Day', categories: [...PUBLIC] },
  '2026-03-02': { name: 'Medin Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-03-21': { name: 'Eid-ul-Fitr', categories: [...PUBLIC] },
  '2026-04-01': { name: 'Bak Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-04-03': { name: 'Good Friday', categories: [...PUBLIC] },
  '2026-04-13': { name: 'Day before Sinhala and Tamil New Year', categories: [...PUBLIC] },
  '2026-04-14': { name: 'Sinhala and Tamil New Year Day', categories: [...PUBLIC] },
  '2026-05-01': { name: 'Vesak Full Moon Poya Day / Labour Day', categories: [...PUBLIC_POYA] },
  // The day *after* the full moon — not itself a poya day, so it stays out
  // of the 'poya' category despite the name still mentioning it.
  '2026-05-02': { name: 'Day after Vesak Full Moon Poya Day', categories: [...PUBLIC] },
  '2026-05-28': { name: 'Eid al-Adha', categories: [...PUBLIC] },
  '2026-05-30': { name: 'Adhi Poson Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-06-29': { name: 'Poson Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-07-29': { name: 'Esala Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-08-26': { name: 'Milad-un-Nabi', categories: [...PUBLIC] },
  '2026-08-27': { name: 'Nikini Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-09-26': { name: 'Binara Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-10-25': { name: 'Vap Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-11-08': { name: 'Deepavali Festival Day', categories: [...PUBLIC] },
  '2026-11-24': { name: 'Ill Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-12-23': { name: 'Unduvap Full Moon Poya Day', categories: [...PUBLIC_POYA] },
  '2026-12-25': { name: 'Christmas Day', categories: [...PUBLIC] },

  // Bank/mercantile-only closing days below: well-established Sri Lankan
  // practice, but NOT in the public-holiday gazette list — verify annually.
  //
  // The two bank closings are gazetted days that are ORDINARY WORKING DAYS
  // here: they shut the banks, not the office. They stay in the map so the
  // calendar can still show them; `isMercantileHoliday` is what keeps them
  // out of everyone's coverage.
  '2026-01-01': { name: "New Year's Day", categories: ['bank', 'mercantile'] },
  '2026-06-30': { name: 'Bank Half-Year Closing', categories: ['bank'] },
  '2026-12-31': { name: 'Bank Annual Closing', categories: ['bank'] },
}

/** IANA timezone used for all "what calendar day is it in Sri Lanka" checks. */
export const LK_TIMEZONE = 'Asia/Colombo'

/**
 * Formats `date` as a `yyyy-mm-dd` string using the wall-clock day in
 * `timeZone`, not the server/browser's local timezone or UTC. This matters
 * right at the timezone boundary: a UTC instant can already be "tomorrow" in
 * Colombo (UTC+5:30), so naive `toISOString().slice(0, 10)` would read the
 * wrong day.
 */
export function toIsoDateInTimeZone(date: Date, timeZone: string = LK_TIMEZONE): string {
  const parts = isoDateFormatter(timeZone).formatToParts(date)

  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/*
 * Building an `Intl.DateTimeFormat` compiles a locale/timezone pattern and is
 * by far the expensive half of these helpers; formatting with one already
 * built is cheap. A formatter is immutable and determined entirely by its
 * options, so one per timezone for the life of the module is both safe and
 * enough. This matters because the calendar's day headers call
 * `getLkHoliday` + `isLkSunday` once per visible day, on every render.
 */
const isoDateFormatters = new Map<string, Intl.DateTimeFormat>()
const weekdayFormatters = new Map<string, Intl.DateTimeFormat>()

function isoDateFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = isoDateFormatters.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  isoDateFormatters.set(timeZone, formatter)
  return formatter
}

function weekdayFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = weekdayFormatters.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' })
  weekdayFormatters.set(timeZone, formatter)
  return formatter
}

/**
 * Returns the full holiday record — name and categories — for `date`, or
 * undefined if `date` isn't a Sri Lankan holiday. Keyed by the calendar date
 * in `tz` (default Asia/Colombo) rather than the server/UTC date, which can
 * drift a day around the timezone boundary.
 */
export function getLkHoliday(date: Date, tz: string = LK_TIMEZONE): LkHoliday | undefined {
  return LK_HOLIDAYS[toIsoDateInTimeZone(date, tz)]
}

/**
 * CALENDAR FACT: the name of whatever is gazetted on `date`, or undefined.
 *
 * Named for what it returns rather than as a question, because the question
 * it used to be spelled as — `isLkHoliday` — reads exactly like "is this day
 * off", which it never answered: a bank-only closing day is gazetted and
 * still a working day. Ask `isMercantileHoliday` for that.
 */
export function getLkHolidayName(date: Date, tz: string = LK_TIMEZONE): string | undefined {
  return getLkHoliday(date, tz)?.name
}

/**
 * LEGAL EFFECT: does a gazetted day with these categories excuse work?
 *
 * Only the Mercantile list (Shop and Office Employees Act) closes shops and
 * offices, so only `'mercantile'` answers yes. Public and Poya are how a day
 * is announced, not who gets it off — and both are already implied by
 * mercantile where the gazette grants it. A bank closing day is a normal
 * working day at a software studio.
 *
 * Takes the categories rather than a date so the UI can ask the SAME question
 * of a row it already has, and can therefore never label a day differently
 * from the way coverage counts it.
 */
export function excusesWork(categories: readonly HolidayCategory[] | undefined): boolean {
  return categories?.includes('mercantile') ?? false
}

/**
 * LEGAL EFFECT, keyed by ISO day: is `iso` a day nobody owes work for?
 *
 * THE ONE FUNCTION THAT DECIDES. `working-days.ts` defaults to it and every
 * caller that composes company holidays on top starts from it, so "which
 * gazette list means a day off" is answered here and nowhere else. Do not
 * substitute `iso in LK_HOLIDAYS`: that is the calendar fact, and it hands
 * out the bank closings as leave.
 *
 * RETROACTIVE BY CONSTRUCTION. Coverage recomputes from this at read time, so
 * a date that gains or loses `'mercantile'` changes what people owed in the
 * past as well as the future. Unlike `org_holidays` — where a cancelled row
 * keeps `revoked_from` precisely so a day already taken cannot be un-held
 * (drizzle/0042) — the gazette is a constant with no effective dates. If the
 * studio genuinely closed on a day this now counts as worked, record it as a
 * company holiday; that is a real row with an author and a note, which is the
 * only way the exemption survives being explained.
 */
export function isMercantileHoliday(iso: string): boolean {
  return excusesWork(LK_HOLIDAYS[iso]?.categories)
}

/** True when `date` falls on a Sunday, evaluated in `tz` (default Asia/Colombo). */
export function isLkSunday(date: Date, tz: string = LK_TIMEZONE): boolean {
  return weekdayFormatter(tz).format(date) === 'Sun'
}

/** The single icon kind the UI renders for a holiday — one of these ever, never several. */
export type HolidayIconKind = 'poya' | 'public' | 'mercantile' | 'bank'

/**
 * Collapses a holiday's (possibly several) categories down to the one icon
 * kind the UI should show, applying the precedence
 * poya > public > mercantile > bank. Returns undefined for a non-holiday.
 *
 * Mercantile outranks bank because a day that closes shops and offices
 * (mercantile) is more relevant to this team's planning than one that only
 * closes banks — so a day that is both reads as 'Mercantile holiday'. The
 * bank kind is therefore what's left: bank-only closing days, which affect
 * payments but not whether anyone is at their desk.
 */
export function getHolidayIconKind(categories: HolidayCategory[] | undefined): HolidayIconKind | undefined {
  if (!categories || categories.length === 0) return undefined
  if (categories.includes('poya')) return 'poya'
  if (categories.includes('public')) return 'public'
  if (categories.includes('mercantile')) return 'mercantile'
  if (categories.includes('bank')) return 'bank'
  return undefined
}

/**
 * Every icon kind that applies to a day, most-distinctive first — so a day that
 * is a Poya AND a Public AND a Mercantile holiday shows all three glyphs rather
 * than collapsing to one. `mercantile` and `bank` are mutually exclusive (a day
 * that closes offices is mercantile; one that only closes banks is bank-only),
 * so at most one of those two ever appears.
 */
export function getHolidayIconKinds(categories: HolidayCategory[] | undefined): HolidayIconKind[] {
  if (!categories || categories.length === 0) return []
  const kinds: HolidayIconKind[] = []
  if (categories.includes('poya')) kinds.push('poya')
  if (categories.includes('public')) kinds.push('public')
  if (categories.includes('mercantile')) kinds.push('mercantile')
  else if (categories.includes('bank')) kinds.push('bank')
  return kinds
}
