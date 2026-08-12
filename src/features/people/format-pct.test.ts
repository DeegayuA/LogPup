import { describe, expect, it } from 'vitest'
import { formatPct, PCT_CLASS } from '@/features/people/format-pct'

/**
 * The single place an allocation becomes text. It exists so the dashboard, the
 * person page, the timeline and the "as of" view cannot drift into "60%" /
 * "60 %" / "60.0%", and the only way that guarantee holds is if the rounding
 * rule is pinned rather than assumed.
 *
 * Allocations are stored as integers today, so the fractional cases look
 * academic — they are not. `capacityAsOf` sums intervals and the dashboard's
 * optimistic edit does arithmetic on the client, both of which can hand this a
 * float; whichever way it rounds, it must round the same way everywhere.
 */
describe('formatPct', () => {
  it('renders whole numbers with no space before the sign', () => {
    expect(formatPct(0)).toBe('0%')
    expect(formatPct(60)).toBe('60%')
    expect(formatPct(130)).toBe('130%')
  })

  it('rounds half up, consistently', () => {
    expect(formatPct(59.4)).toBe('59%')
    expect(formatPct(59.5)).toBe('60%')
    expect(formatPct(59.6)).toBe('60%')
  })

  it('never emits a decimal point', () => {
    expect(formatPct(33.3333)).not.toContain('.')
  })

  /**
   * AssignmentsCard renders `formatPct(100 - totalPct)` as headroom. Nothing
   * stops that going negative if the band logic is ever changed, and "-5%" is a
   * legible wrong answer where "NaN%" is not — so the negative case is defined
   * rather than left to chance.
   */
  it('keeps the sign on a negative', () => {
    expect(formatPct(-5)).toBe('-5%')
  })
})

describe('PCT_CLASS', () => {
  /**
   * Not decoration: tabular figures are what stop a column of percentages from
   * jittering as values change, and the design rules require tabular-nums on
   * any number that moves. Asserting it here means dropping it is a test
   * failure rather than a slow visual regression nobody files.
   */
  it('pins mono + tabular figures', () => {
    expect(PCT_CLASS).toContain('tabular-nums')
    expect(PCT_CLASS).toContain('font-mono')
  })
})
