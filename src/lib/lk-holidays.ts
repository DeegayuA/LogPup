/**
 * Sri Lankan public, bank, and mercantile holidays.
 *
 * The 26 dates keyed `['public', 'bank', 'mercantile', ...]` below are the
 * 2026 GAZETTE PUBLIC holidays (source: adaderana 2026 holiday calendar).
 * By Sri Lankan convention every gazetted Public holiday is also observed as
 * a Bank and a Mercantile holiday, and every Full Moon Poya Day additionally
 * carries the `'poya'` category (it is literally the day of the full moon).
 * A further three well-established bank/mercantile-only closing days — NOT
 * in the public-holiday gazette list — are appended separately below and
 * marked as such.
 *
 * Sri Lankan holiday categories are gazette-published annually (only 2026 is
 * covered today): both the public-holiday list and the bank/mercantile-only
 * additions should be re-verified — and this file extended with new
 * `yyyy-mm-dd` entries — each year the next gazette is published. No other
 * code needs to change, since every lookup below is keyed by ISO date.
 */

/** A single holiday can be observed under more than one of these at once —
 *  see `getHolidayIconKind` for how the UI collapses that down to one icon. */
export type HolidayCategory = 'public' | 'bank' | 'mercantile' | 'poya'

export type LkHoliday = {
  name: string
  categories: HolidayCategory[]
}

/** Every gazetted Public holiday is also a Bank and Mercantile holiday. */
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
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
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
 * Returns the holiday name if `date` falls on a Sri Lankan holiday. Back-
 * compat wrapper around `getLkHoliday` for callers that only need the name
 * — callers that also need the category (public/bank/mercantile/poya)
 * should use `getLkHoliday` instead.
 */
export function isLkHoliday(date: Date, tz: string = LK_TIMEZONE): string | undefined {
  return getLkHoliday(date, tz)?.name
}

/** True when `date` falls on a Sunday, evaluated in `tz` (default Asia/Colombo). */
export function isLkSunday(date: Date, tz: string = LK_TIMEZONE): boolean {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date) === 'Sun'
}

/** The single icon kind the UI renders for a holiday — one of these ever, never several. */
export type HolidayIconKind = 'poya' | 'public' | 'mercantile'

/**
 * Collapses a holiday's (possibly several) categories down to the one icon
 * kind the UI should show, applying the precedence poya > public >
 * bank/mercantile-only. Returns undefined for a non-holiday.
 */
export function getHolidayIconKind(categories: HolidayCategory[] | undefined): HolidayIconKind | undefined {
  if (!categories || categories.length === 0) return undefined
  if (categories.includes('poya')) return 'poya'
  if (categories.includes('public')) return 'public'
  if (categories.includes('bank') || categories.includes('mercantile')) return 'mercantile'
  return undefined
}
