/**
 * What work COST and what a project is WORTH — the maths, and only the maths.
 *
 * PURE AND SYNCHRONOUS, the same contract as coverage.ts and worklog/entries.ts:
 * every input arrives as data, so the whole module is testable without a
 * database, without a clock and without a model. There is deliberately no
 * query, no action and no loader in this folder yet — see the note on
 * person_rates below for why that is a decision rather than an omission.
 *
 * THE ONE RULE EVERYTHING HERE OBEYS: null means "cannot say"; zero means
 * "we can say, and it is nothing". They are different facts and they stay
 * different all the way out to the caller. A cost of 0 tells a reader the work
 * was free. An unknown cost tells them the rate card is incomplete. Collapsing
 * the second into the first is how a cost report becomes a confident lie, and
 * every `| null` in this file exists to stop that.
 *
 * AMOUNTS ARRIVE AS STRINGS. Drizzle hands `numeric` back as a string, on
 * purpose, because money summed as a float drifts. Every function here accepts
 * `string | number`, parses at its boundary, and treats an unparseable value
 * as NO VALUE rather than as zero — `Number('')` is 0, and a blank rate column
 * silently pricing an hour at nothing is exactly the failure this module is
 * built to prevent.
 *
 * NOTHING HERE READS person_rates, AND NOTHING ELSE IN THE REPO DOES EITHER.
 * That table is salary data and needs its own capability; the capability
 * matrix belongs to another session and nobody holds it right now. The maths
 * can land without that decision because it never touches the database — it is
 * handed rows by a caller. Whoever writes that caller writes the gate in the
 * same change.
 */
import { isIsoDay } from '@/features/people/iso-day'

/**
 * One rate, valid over a half-open day interval [effectiveFrom, effectiveTo).
 *
 * The same shape and the same resolution rule as `app_role_history` and
 * `work_schedules`: a row whose `effectiveTo` equals the day does NOT cover
 * it, so two adjacent rows can never both claim the boundary.
 */
type RateInterval = {
  hourly: string | number
  currency: string
  effectiveFrom: string
  effectiveTo: string | null
}

/** A `rate_cards` row: the base rate for a job role. */
export type RoleRate = RateInterval & { role: string }

/**
 * A `person_rates` row: the optional override.
 *
 * SALARY DATA. It may be passed into this module because nothing here renders
 * anything, but a resolved rate must never reach a per-person surface, and
 * cost must never be aggregated per individual — a bar chart of cost by person
 * is a salary chart with extra steps.
 */
export type PersonRate = RateInterval & { userId: string }

/** What an hour cost, and which of the two tables said so. */
export type ResolvedRate = {
  hourly: number
  currency: string
  source: 'person' | 'role'
}

/**
 * An amount from a `numeric` column, as a number — or null when it cannot be
 * read as money.
 *
 * A blank string, a null, a NaN and a negative rate all return null, meaning
 * "cannot say". `Number('')` is 0, which would price an hour at nothing and
 * put that on a report as a fact; a negative hourly rate is corruption, not a
 * discount. A genuine 0 IS kept — an unpaid intern's hour really does cost
 * nothing, and that is a statement somebody made.
 */
function toAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return amount
}

/**
 * Money rounded to cents. Applied ONCE, to a finished total, never per row:
 * rounding each entry and then summing drifts by a cent for every entry, and
 * two screens that round at different points disagree about the same project.
 */
function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * The rate interval covering `iso`, or null.
 *
 * When more than one row covers the day — which the `*_one_open_idx` unique
 * indexes make impossible for OPEN rows but not for badly-closed historical
 * ones — the LATEST-STARTING one wins. This deliberately differs from
 * `patternForDay`, which takes the first match: array order is whatever the
 * query planner returned, and a cost figure that changes with row order is
 * unusable. A schedule read the same way is merely inconsistent; money read
 * that way starts an argument nobody can settle.
 */
function coveringRate(
  rows: readonly RateInterval[],
  iso: string,
): { hourly: number; currency: string } | null {
  let best: RateInterval | null = null
  for (const row of rows) {
    // Lexicographic comparison on YYYY-MM-DD IS chronological comparison, so
    // no parsing happens here at all — the same trick iso-day.ts documents.
    if (row.effectiveFrom > iso) continue
    if (row.effectiveTo !== null && row.effectiveTo <= iso) continue
    if (best === null || row.effectiveFrom > best.effectiveFrom) best = row
  }
  if (best === null) return null
  const hourly = toAmount(best.hourly)
  if (hourly === null) return null
  return { hourly, currency: best.currency }
}

/**
 * What one person's hour cost ON A GIVEN DAY.
 *
 * The person override beats the role rate for the days it covers; its absence
 * — the normal case, and the one that must stay normal — means the role's
 * rate. An override that has EXPIRED falls back to the role rate rather than
 * to nothing: somebody whose special rate ended is still priced at their role.
 *
 * THE RATE IN FORCE THAT DAY, NEVER TODAY'S. This is the entire reason
 * `rate_cards` is a table of intervals instead of a column. A rate that were
 * simply edited would silently re-price every hour ever worked, so last
 * quarter's finished project would change cost, months after it closed,
 * because somebody got a raise this week.
 *
 * `role` is `users.title` and may be null (a person with no job title on
 * record); such a person is priceable only by an override.
 *
 * RETURNS NULL WHEN NO RATE COVERS THE DAY. Null means "cannot say", never
 * zero — an hour nobody has priced is not a free hour.
 */
export function rateForPersonOnDay(
  roleRates: readonly RoleRate[],
  personRates: readonly PersonRate[],
  role: string | null,
  userId: string,
  iso: string,
): ResolvedRate | null {
  const override = coveringRate(personRates.filter((row) => row.userId === userId), iso)
  if (override !== null) return { ...override, source: 'person' }

  if (role === null || role === '') return null
  const base = coveringRate(roleRates.filter((row) => row.role === role), iso)
  if (base !== null) return { ...base, source: 'role' }

  return null
}

/** The minimum an entry must carry to be costed. */
export type CostableEntry = { minutes: number }

/**
 * What a set of entries cost, and how much of it could not be priced.
 *
 * `unpricedMinutes` is not a diagnostic — it is half the answer. A cost with
 * a third of the hours missing from it is not a smaller cost, it is a
 * different claim, and a caller that renders `amount` without reading
 * `fullyPriced` is publishing the wrong number.
 */
export type CostBreakdown = {
  /**
   * The priced hours as money, rounded to cents — or NULL when no honest
   * single figure exists: nothing could be priced, or the entries resolved to
   * more than one currency. Never 0 standing in for either.
   */
  amount: number | null
  /** Null whenever `amount` is null. Every money figure carries its currency. */
  currency: string | null
  pricedMinutes: number
  unpricedMinutes: number
  /** True when every minute got a rate. The flag a UI must check before it prints `amount`. */
  fullyPriced: boolean
  /** True when two currencies turned up, which this module refuses to add. */
  mixedCurrency: boolean
}

/**
 * Σ (minutes ÷ 60 × that day's rate).
 *
 * Each entry is priced against ITS OWN resolved rate — the caller supplies
 * `rateResolver`, normally a closure over `rateForPersonOnDay` — so a month
 * spanning a raise costs what it actually cost, rather than being blended
 * against one average that is wrong for both halves.
 *
 * NO ENTRY IS EVER SILENTLY DROPPED. An entry the resolver cannot price adds
 * its minutes to `unpricedMinutes`; omitting it would make a partial cost look
 * complete, which is the one way this function could mislead somebody.
 *
 * NO ENTRIES AT ALL genuinely is zero cost, and reports 0 — that is a fact,
 * not an unknown, and it stays distinguishable from "we could not price any
 * of this", which reports null.
 *
 * CURRENCIES ARE NOT SUMMED. One workspace currency is the v1 assumption; if a
 * second appears, this refuses to produce a figure rather than adding numbers
 * that do not add.
 */
export function costForEntries<E extends CostableEntry>(
  entries: readonly E[],
  rateResolver: (entry: E) => ResolvedRate | null,
): CostBreakdown {
  let pricedMinutes = 0
  let unpricedMinutes = 0
  let total = 0
  let currency: string | null = null
  let mixedCurrency = false

  for (const entry of entries) {
    const rate = rateResolver(entry)
    if (rate === null) {
      unpricedMinutes += entry.minutes
      continue
    }
    if (currency === null) currency = rate.currency
    else if (currency !== rate.currency) mixedCurrency = true
    pricedMinutes += entry.minutes
    total += (entry.minutes / 60) * rate.hourly
  }

  if (mixedCurrency) {
    return { amount: null, currency: null, pricedMinutes, unpricedMinutes, fullyPriced: false, mixedCurrency: true }
  }
  if (pricedMinutes === 0 && unpricedMinutes > 0) {
    return { amount: null, currency: null, pricedMinutes: 0, unpricedMinutes, fullyPriced: false, mixedCurrency: false }
  }
  return {
    amount: roundMoney(total),
    currency,
    pricedMinutes,
    unpricedMinutes,
    fullyPriced: unpricedMinutes === 0,
    mixedCurrency: false,
  }
}

/** The subscription half of a `project_value` row. */
export type SubscriptionValue = {
  subscriptionMonthly: string | number | null
  subscriptionFrom: string | null
  /** EXCLUSIVE, like every other interval here: the subscription runs up to but not including this day. */
  subscriptionTo: string | null
  currency: string
}

export type SubscriptionAccrual = {
  months: number
  amount: number
  currency: string
  /** The day each accrued month began, ascending — so a caller can chart or explain the figure. */
  monthsStarting: string[]
}

/** Whether a year has 29 days in February. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function daysInMonth(year: number, monthIndex: number): number {
  return monthIndex === 1 && isLeapYear(year) ? 29 : MONTH_LENGTHS[monthIndex]
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

/**
 * `iso` shifted by whole months, clamping to the last day of a short month.
 *
 * ALWAYS COMPUTED FROM THE ORIGINAL START, never from the previous result.
 * A subscription beginning 31 January accrues on 31 Jan, 28 Feb, 31 Mar, 30
 * Apr — stepping from each result instead would clamp once and then bill the
 * 28th forever, quietly moving every future invoice date.
 *
 * Done with integer arithmetic rather than `Date`, which has no timezone to
 * get wrong and cannot slide 31 February into 3 March the way `Date.UTC` does.
 */
function addMonthsIso(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const absoluteMonth = year * 12 + (month - 1) + months
  const targetYear = Math.floor(absoluteMonth / 12)
  const targetMonth = absoluteMonth - targetYear * 12
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth))
  return `${pad(targetYear, 4)}-${pad(targetMonth + 1, 2)}-${pad(clampedDay, 2)}`
}

/**
 * A subscription is a range, not a ledger — 100 years of monthly accrual is
 * far past any real contract and stops a corrupt bound from hanging a render.
 */
const MAX_ACCRUAL_MONTHS = 1200

/**
 * What a monthly subscription has earned over the window `[from, to)`.
 *
 * COMPUTED AT READ TIME FROM THE DATE RANGE. There are deliberately no
 * per-month rows anywhere: a missed cron would silently under-report revenue,
 * and an under-report looks exactly like a quiet month, so nobody would catch
 * it. The range is the source of truth and it cannot fall behind.
 *
 * A month accrues on its ANNIVERSARY — a retainer starting on the 15th earns
 * on the 15th of each month, not on the 1st. Snapping to calendar months would
 * hand a client a free fortnight or bill them for one they had not had.
 * Anniversaries are counted once BEGUN (billed in advance, the norm for a
 * retainer), which is why the window end is exclusive.
 *
 * RETURNS NULL WHEN THERE IS NO SUBSCRIPTION — no monthly amount, no start
 * date, or a date malformed enough that any answer would be invented. "No
 * subscription" is not "earned nothing", and a caller must be able to print
 * the difference. A subscription that simply has not started yet returns zero
 * months, which IS a real answer.
 *
 * Never call this alongside a contract value without saying which is which:
 * a fixed-price build and a monthly retainer are different kinds of money, and
 * summing them into one "worth" figure is the two-numbers-under-one-name
 * disease docs/kpi-inventory.md already catalogues thirteen instances of.
 */
export function subscriptionAccrued(
  value: SubscriptionValue,
  from: string,
  to: string,
): SubscriptionAccrual | null {
  const monthly = toAmount(value.subscriptionMonthly)
  if (monthly === null) return null

  const start = value.subscriptionFrom
  if (start === null || !isIsoDay(start)) return null
  // Returns null rather than throwing the way iso-day.ts does: this sits under
  // a report, and a malformed stored date should read as "cannot say" rather
  // than take a page down.
  if (!isIsoDay(from) || !isIsoDay(to)) return null
  const end = value.subscriptionTo
  if (end !== null && !isIsoDay(end)) return null

  const monthsStarting: string[] = []
  for (let step = 0; step < MAX_ACCRUAL_MONTHS; step += 1) {
    const day = addMonthsIso(start, step)
    if (day >= to) break
    if (end !== null && day >= end) break
    if (day >= from) monthsStarting.push(day)
  }

  return {
    months: monthsStarting.length,
    amount: roundMoney(monthsStarting.length * monthly),
    currency: value.currency,
    monthsStarting,
  }
}

/**
 * Value minus cost.
 *
 * NULL WHENEVER EITHER SIDE IS MISSING. A margin computed against an unstated
 * contract value is a made-up number, and zero is the most convincing made-up
 * number there is — it reads as "we broke even" when the truth is "nobody has
 * told us what this is worth". A genuine 0 on either side is kept and used.
 *
 * The caller decides WHICH value goes in. Contract value and accrued
 * subscription must not be added together first; margin against each, labelled
 * as such, is two honest numbers where the sum would be one dishonest one.
 */
export function margin(
  value: string | number | null | undefined,
  cost: string | number | null | undefined,
): number | null {
  const worth = toAmount(value)
  const spent = toAmount(cost)
  if (worth === null || spent === null) return null
  return roundMoney(worth - spent)
}

export type EffortShare<C extends string> = {
  category: C
  minutes: number
  /** A FRACTION of the total, not a percent. The UI formats it; this does not. */
  share: number
}

export type EffortMix<C extends string> = {
  totalMinutes: number
  byCategory: EffortShare<C>[]
}

/**
 * Share of minutes by category — task, meeting, review, support, admin,
 * learning, other.
 *
 * NEEDS NO MONEY AT ALL, which is why it is the first thing here that can
 * ship: it is blocked by neither the rate card nor the capability decision
 * that gates every other figure in this module, and it is often the most
 * actionable chart of the lot.
 *
 * DELIBERATELY GENERIC OVER THE CATEGORY. This module does not import
 * `ENTRY_CATEGORIES`, and does not keep a second copy of it either: the caller
 * passes whatever categories its rows carry and gets its own union back. The
 * pg enum stays the single source of truth for what the values are, and
 * finance never becomes a second place they have to be updated.
 *
 * CATEGORIES ABSENT FROM THE RANGE ARE ABSENT FROM THE RESULT — no row of
 * zeroes is invented. An empty range means "no data", not "nobody did any of
 * these things", and a chart should say so.
 *
 * Ordered by minutes descending, then category name, so a chart's rows do not
 * reshuffle because a query came back in a different order.
 */
export function effortMix<C extends string>(
  entries: readonly { minutes: number; category: C }[],
): EffortMix<C> {
  const minutesByCategory = new Map<C, number>()
  let totalMinutes = 0
  for (const entry of entries) {
    minutesByCategory.set(entry.category, (minutesByCategory.get(entry.category) ?? 0) + entry.minutes)
    totalMinutes += entry.minutes
  }

  // A zero denominator must never divide. With no minutes there is nothing to
  // take a share of, and the empty list says that better than NaN or 0 would.
  if (totalMinutes === 0) return { totalMinutes: 0, byCategory: [] }

  const byCategory = [...minutesByCategory.entries()]
    .map(([category, minutes]) => ({ category, minutes, share: minutes / totalMinutes }))
    .sort((a, b) => b.minutes - a.minutes || a.category.localeCompare(b.category))

  return { totalMinutes, byCategory }
}
