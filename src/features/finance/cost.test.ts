import { describe, expect, it } from 'vitest'
import {
  costForEntries,
  effortMix,
  margin,
  rateForPersonOnDay,
  subscriptionAccrued,
  type PersonRate,
  type RoleRate,
} from './cost'

const role = (over: Partial<RoleRate> = {}): RoleRate => ({
  role: 'Engineer',
  hourly: '20.00',
  currency: 'LKR',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  ...over,
})

const person = (over: Partial<PersonRate> = {}): PersonRate => ({
  userId: 'u1',
  hourly: '50.00',
  currency: 'LKR',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  ...over,
})

describe('rateForPersonOnDay', () => {
  it('returns the role rate when no override exists', () => {
    const found = rateForPersonOnDay([role()], [], 'Engineer', 'u1', '2026-06-12')
    expect(found).toEqual({ hourly: 20, currency: 'LKR', source: 'role' })
  })

  // why: the whole point of person_rates. An override that did not win would
  // be a salary column nobody reads.
  it('the person override beats the role rate', () => {
    const found = rateForPersonOnDay([role()], [person()], 'Engineer', 'u1', '2026-06-12')
    expect(found).toEqual({ hourly: 50, currency: 'LKR', source: 'person' })
  })

  it('an override for somebody else does not leak onto this person', () => {
    const found = rateForPersonOnDay(
      [role()], [person({ userId: 'u2' })], 'Engineer', 'u1', '2026-06-12',
    )
    expect(found?.source).toBe('role')
  })

  // why: THE reason rates are intervals. A raise in July must not re-price
  // work done in June — the historical cost report would silently change.
  it('prices a day against the rate in force THAT day, not the newest one', () => {
    const rows = [
      role({ hourly: '20.00', effectiveFrom: '2026-01-01', effectiveTo: '2026-07-01' }),
      role({ hourly: '35.00', effectiveFrom: '2026-07-01', effectiveTo: null }),
    ]
    expect(rateForPersonOnDay(rows, [], 'Engineer', 'u1', '2026-06-30')?.hourly).toBe(20)
    expect(rateForPersonOnDay(rows, [], 'Engineer', 'u1', '2026-07-01')?.hourly).toBe(35)
  })

  // why: half-open [from, to). An inclusive end would let two adjacent rows
  // both claim the boundary day and the answer would depend on array order.
  it('effective_to is exclusive — the closing row does not cover its end day', () => {
    const closed = [role({ effectiveFrom: '2026-01-01', effectiveTo: '2026-07-01' })]
    expect(rateForPersonOnDay(closed, [], 'Engineer', 'u1', '2026-06-30')).not.toBeNull()
    expect(rateForPersonOnDay(closed, [], 'Engineer', 'u1', '2026-07-01')).toBeNull()
  })

  it('effective_from is inclusive — the opening row covers its first day', () => {
    const rows = [role({ effectiveFrom: '2026-07-01' })]
    expect(rateForPersonOnDay(rows, [], 'Engineer', 'u1', '2026-07-01')).not.toBeNull()
    expect(rateForPersonOnDay(rows, [], 'Engineer', 'u1', '2026-06-30')).toBeNull()
  })

  // why: null means CANNOT SAY. A zero here would price a real hour at
  // nothing and land on a cost report as a fact.
  it('returns null — never 0 — when no rate covers the day', () => {
    expect(rateForPersonOnDay([], [], 'Engineer', 'u1', '2026-06-12')).toBeNull()
    const future = [role({ effectiveFrom: '2027-01-01' })]
    expect(rateForPersonOnDay(future, [], 'Engineer', 'u1', '2026-06-12')).toBeNull()
  })

  it('returns null for a role with no rate card, and for a person with no title', () => {
    expect(rateForPersonOnDay([role()], [], 'Designer', 'u1', '2026-06-12')).toBeNull()
    expect(rateForPersonOnDay([role()], [], null, 'u1', '2026-06-12')).toBeNull()
  })

  // why: an expired override must fall back to the role rate, not to nothing.
  // Somebody whose special rate ended is still priced at their role's.
  it('falls back to the role rate on days the override does not cover', () => {
    const rows = [person({ effectiveFrom: '2026-01-01', effectiveTo: '2026-03-01' })]
    expect(rateForPersonOnDay([role()], rows, 'Engineer', 'u1', '2026-02-01')?.source).toBe('person')
    expect(rateForPersonOnDay([role()], rows, 'Engineer', 'u1', '2026-04-01')?.source).toBe('role')
  })

  // why: array order is whatever the query returned. Money must not depend on
  // it, so the latest-starting covering row wins deterministically.
  it('is independent of row order when two rows overlap', () => {
    const older = role({ hourly: '20.00', effectiveFrom: '2026-01-01' })
    const newer = role({ hourly: '35.00', effectiveFrom: '2026-05-01' })
    expect(rateForPersonOnDay([older, newer], [], 'Engineer', 'u1', '2026-06-12')?.hourly).toBe(35)
    expect(rateForPersonOnDay([newer, older], [], 'Engineer', 'u1', '2026-06-12')?.hourly).toBe(35)
  })

  // why: Number('') is 0. A blank numeric column must read as "cannot say",
  // not as a free hour.
  it('treats an unparseable or negative rate as no rate at all', () => {
    for (const bad of ['', '  ', 'abc', -5]) {
      expect(rateForPersonOnDay([role({ hourly: bad })], [], 'Engineer', 'u1', '2026-06-12')).toBeNull()
    }
  })

  it('accepts a genuine zero rate as a real rate', () => {
    const found = rateForPersonOnDay([role({ hourly: '0.00' })], [], 'Engineer', 'u1', '2026-06-12')
    expect(found).toEqual({ hourly: 0, currency: 'LKR', source: 'role' })
  })
})

describe('costForEntries', () => {
  const rate = (hourly: number) => ({ hourly, currency: 'LKR', source: 'role' as const })

  it('sums minutes divided by 60 times that entry\'s rate', () => {
    const entries = [{ minutes: 90 }, { minutes: 30 }]
    const cost = costForEntries(entries, () => rate(20))
    expect(cost.amount).toBe(40)
    expect(cost.currency).toBe('LKR')
    expect(cost.pricedMinutes).toBe(120)
    expect(cost.fullyPriced).toBe(true)
  })

  it('prices each entry against its own rate, not one blended number', () => {
    const entries = [{ minutes: 60, who: 'a' }, { minutes: 60, who: 'b' }]
    const cost = costForEntries(entries, (e) => rate(e.who === 'a' ? 10 : 30))
    expect(cost.amount).toBe(40)
  })

  // why: silently dropping unpriced hours makes a partial cost look complete.
  // The gap is the number a reader most needs.
  it('surfaces unpriced minutes rather than omitting them', () => {
    const entries = [{ minutes: 60, priced: true }, { minutes: 120, priced: false }]
    const cost = costForEntries(entries, (e) => (e.priced ? rate(20) : null))
    expect(cost.amount).toBe(20)
    expect(cost.pricedMinutes).toBe(60)
    expect(cost.unpricedMinutes).toBe(120)
    expect(cost.fullyPriced).toBe(false)
  })

  // why: 0 would read as "this project cost nothing", which is a claim.
  it('reports null — never 0 — when nothing could be priced', () => {
    const cost = costForEntries([{ minutes: 480 }], () => null)
    expect(cost.amount).toBeNull()
    expect(cost.unpricedMinutes).toBe(480)
    expect(cost.fullyPriced).toBe(false)
  })

  // why: no hours genuinely IS no cost. That is a fact, not an unknown, and
  // it must stay distinguishable from the case above.
  it('reports 0 for no entries at all', () => {
    const cost = costForEntries([], () => null)
    expect(cost.amount).toBe(0)
    expect(cost.unpricedMinutes).toBe(0)
    expect(cost.fullyPriced).toBe(true)
  })

  // why: two currencies cannot be added. Refusing beats inventing a rate.
  it('refuses to sum across currencies', () => {
    const entries = [{ minutes: 60, c: 'LKR' }, { minutes: 60, c: 'USD' }]
    const cost = costForEntries(entries, (e) => ({ hourly: 10, currency: e.c, source: 'role' as const }))
    expect(cost.mixedCurrency).toBe(true)
    expect(cost.amount).toBeNull()
    expect(cost.currency).toBeNull()
    expect(cost.fullyPriced).toBe(false)
  })

  it('rounds the total once, to cents', () => {
    const entries = [{ minutes: 1 }, { minutes: 1 }, { minutes: 1 }]
    const cost = costForEntries(entries, () => rate(10))
    // 3 x (1/60 x 10) = 0.5 exactly; per-entry rounding would give 0.51.
    expect(cost.amount).toBe(0.5)
  })
})

describe('subscriptionAccrued', () => {
  const sub = (over: Record<string, unknown> = {}) => ({
    subscriptionMonthly: '100.00',
    subscriptionFrom: '2026-01-01',
    subscriptionTo: null,
    currency: 'LKR',
    ...over,
  })

  it('accrues one month per monthly anniversary inside the window', () => {
    const got = subscriptionAccrued(sub(), '2026-01-01', '2026-04-01')
    expect(got?.months).toBe(3)
    expect(got?.amount).toBe(300)
    expect(got?.monthsStarting).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
  })

  // why: half-open window. The month starting on `to` has not begun.
  it('the window end is exclusive', () => {
    expect(subscriptionAccrued(sub(), '2026-01-01', '2026-01-01')?.months).toBe(0)
    expect(subscriptionAccrued(sub(), '2026-01-01', '2026-01-02')?.months).toBe(1)
  })

  it('counts nothing before the subscription starts', () => {
    const got = subscriptionAccrued(sub({ subscriptionFrom: '2026-03-15' }), '2026-01-01', '2026-04-01')
    expect(got?.months).toBe(1)
    expect(got?.monthsStarting).toEqual(['2026-03-15'])
  })

  // why: a mid-month start bills on the 15th, not on the 1st. Snapping to
  // calendar months would hand the client a free fortnight or charge for one.
  it('accrues from a mid-month start on that day of each month', () => {
    const got = subscriptionAccrued(sub({ subscriptionFrom: '2026-01-15' }), '2026-01-01', '2026-04-01')
    expect(got?.monthsStarting).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })

  // why: there is no 31 February. Clamping from the ORIGINAL start (not from
  // the previous result) keeps March on the 31st instead of drifting to the
  // 28th for the rest of the contract.
  it('clamps a 31st start to a short month without drifting afterwards', () => {
    const got = subscriptionAccrued(sub({ subscriptionFrom: '2026-01-31' }), '2026-01-01', '2026-05-01')
    expect(got?.monthsStarting).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('handles a leap February', () => {
    const got = subscriptionAccrued(sub({ subscriptionFrom: '2028-01-31' }), '2028-01-01', '2028-03-01')
    expect(got?.monthsStarting).toEqual(['2028-01-31', '2028-02-29'])
  })

  // why: subscription_to is exclusive, like every other interval here.
  it('stops at an ended subscription', () => {
    const got = subscriptionAccrued(
      sub({ subscriptionTo: '2026-03-01' }), '2026-01-01', '2026-12-01',
    )
    expect(got?.months).toBe(2)
    expect(got?.monthsStarting).toEqual(['2026-01-01', '2026-02-01'])
  })

  it('crosses a year boundary', () => {
    const got = subscriptionAccrued(sub({ subscriptionFrom: '2026-11-01' }), '2026-11-01', '2027-02-01')
    expect(got?.monthsStarting).toEqual(['2026-11-01', '2026-12-01', '2027-01-01'])
  })

  // why: "no subscription" is not "earned nothing". A caller must be able to
  // print "no subscription" rather than a confident zero.
  it('returns null when there is no subscription at all', () => {
    expect(subscriptionAccrued(sub({ subscriptionMonthly: null }), '2026-01-01', '2026-04-01')).toBeNull()
    expect(subscriptionAccrued(sub({ subscriptionFrom: null }), '2026-01-01', '2026-04-01')).toBeNull()
  })

  it('returns null rather than sliding a malformed date', () => {
    expect(subscriptionAccrued(sub({ subscriptionFrom: '2026-02-31' }), '2026-01-01', '2026-04-01')).toBeNull()
    expect(subscriptionAccrued(sub(), 'not-a-day', '2026-04-01')).toBeNull()
  })

  // why: a live subscription with a zero-length or inverted window is a real
  // read (a report for a day that has not started), not an error.
  it('returns zero months — not null — for a subscription that has not started', () => {
    const got = subscriptionAccrued(sub({ subscriptionFrom: '2027-01-01' }), '2026-01-01', '2026-04-01')
    expect(got?.months).toBe(0)
    expect(got?.amount).toBe(0)
  })
})

describe('margin', () => {
  it('is value minus cost when both sides exist', () => {
    expect(margin(1000, 400)).toBe(600)
    expect(margin('1000.00', 1400)).toBe(-400)
  })

  // why: the spec's hardest rule. A margin against an unstated contract value
  // is a made-up number, and 0 is the most convincing made-up number there is.
  it('is null when either side is missing — never a number against nothing', () => {
    expect(margin(null, 400)).toBeNull()
    expect(margin(1000, null)).toBeNull()
    expect(margin(null, null)).toBeNull()
    expect(margin(undefined, 400)).toBeNull()
    expect(margin('', 400)).toBeNull()
  })

  it('keeps a genuine zero on either side', () => {
    expect(margin(0, 400)).toBe(-400)
    expect(margin(1000, 0)).toBe(1000)
  })
})

describe('effortMix', () => {
  it('gives each category its share of the minutes', () => {
    const mix = effortMix([
      { minutes: 60, category: 'task' },
      { minutes: 60, category: 'task' },
      { minutes: 60, category: 'meeting' },
      { minutes: 120, category: 'review' },
    ])
    expect(mix.totalMinutes).toBe(300)
    expect(mix.byCategory).toEqual([
      { category: 'review', minutes: 120, share: 0.4 },
      { category: 'task', minutes: 120, share: 0.4 },
      { category: 'meeting', minutes: 60, share: 0.2 },
    ])
  })

  // why: "no data" beats a row of zeroes. Inventing a 0% bar for every
  // category states that nobody did any of it, which is not what an empty
  // range means.
  it('invents no categories for an empty range', () => {
    expect(effortMix([])).toEqual({ totalMinutes: 0, byCategory: [] })
  })

  it('shares sum to 1', () => {
    const mix = effortMix([
      { minutes: 100, category: 'task' },
      { minutes: 200, category: 'admin' },
      { minutes: 33, category: 'support' },
    ])
    const sum = mix.byCategory.reduce((total, row) => total + row.share, 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  // why: a chart's row order must not change because the query returned rows
  // in a different order.
  it('orders by minutes descending, then category, regardless of input order', () => {
    const rows = [
      { minutes: 10, category: 'support' },
      { minutes: 10, category: 'admin' },
      { minutes: 30, category: 'task' },
    ]
    const forward = effortMix(rows).byCategory.map((row) => row.category)
    const backward = effortMix([...rows].reverse()).byCategory.map((row) => row.category)
    expect(forward).toEqual(['task', 'admin', 'support'])
    expect(backward).toEqual(forward)
  })

  // why: this is the one figure here that needs no rates, which is why it can
  // ship before the capability decision that gates everything else.
  it('needs no money at all', () => {
    expect(effortMix([{ minutes: 480, category: 'task' }]).byCategory[0].share).toBe(1)
  })
})
