/**
 * Sri Lankan public holidays.
 *
 * Dates are gazette-published annually by the Sri Lankan government (this
 * list is sourced from the adaderana 2026 gazette) and only 2026 is covered
 * today. Extend this map with additional `yyyy-mm-dd` entries once each
 * year's gazette is published — no other code needs to change, since every
 * lookup below is keyed by ISO date.
 */
export const LK_HOLIDAYS: Record<string, string> = {
  '2026-01-03': 'Duruthu Full Moon Poya Day',
  '2026-01-15': 'Tamil Thai Pongal Day',
  '2026-02-01': 'Navam Full Moon Poya Day',
  '2026-02-04': 'Independence Day',
  '2026-02-15': 'Maha Shivaratri Day',
  '2026-03-02': 'Medin Full Moon Poya Day',
  '2026-03-21': 'Eid-ul-Fitr',
  '2026-04-01': 'Bak Full Moon Poya Day',
  '2026-04-03': 'Good Friday',
  '2026-04-13': 'Day before Sinhala and Tamil New Year',
  '2026-04-14': 'Sinhala and Tamil New Year Day',
  '2026-05-01': 'Vesak Full Moon Poya Day / Labour Day',
  '2026-05-02': 'Day after Vesak Full Moon Poya Day',
  '2026-05-28': 'Eid al-Adha',
  '2026-05-30': 'Adhi Poson Full Moon Poya Day',
  '2026-06-29': 'Poson Full Moon Poya Day',
  '2026-07-29': 'Esala Full Moon Poya Day',
  '2026-08-26': 'Milad-un-Nabi',
  '2026-08-27': 'Nikini Full Moon Poya Day',
  '2026-09-26': 'Binara Full Moon Poya Day',
  '2026-10-25': 'Vap Full Moon Poya Day',
  '2026-11-08': 'Deepavali Festival Day',
  '2026-11-24': 'Ill Full Moon Poya Day',
  '2026-12-23': 'Unduvap Full Moon Poya Day',
  '2026-12-25': 'Christmas Day',
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
 * Returns the holiday name if `date` falls on a Sri Lankan public holiday,
 * keyed by the calendar date in `tz` (default Asia/Colombo) rather than the
 * server/UTC date, which can drift a day around the timezone boundary.
 */
export function isLkHoliday(date: Date, tz: string = LK_TIMEZONE): string | undefined {
  return LK_HOLIDAYS[toIsoDateInTimeZone(date, tz)]
}

/** True when `date` falls on a Sunday, evaluated in `tz` (default Asia/Colombo). */
export function isLkSunday(date: Date, tz: string = LK_TIMEZONE): boolean {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date) === 'Sun'
}
