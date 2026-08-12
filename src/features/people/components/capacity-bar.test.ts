import { describe, expect, it } from 'vitest'
import { capacityBand, NEAR_CAPACITY_PCT } from '@/features/people/components/capacity-bar'

/**
 * `capacityBand` decides the one thing on a person page that means "act": which
 * of three bands a total allocation falls in. It is consumed in four places —
 * the meter's fill and aria-label, the sentence under it, the "Allocated" stat
 * tile's tone, and its `meta` wording — so an off-by-one here would show a
 * green bar and the words "over by 0%" on the same row.
 *
 * The boundaries are the whole test. 80 is near (inclusive), 100 is still
 * normal-not-over (a person exactly full is not over-committed), 101 is over.
 * That asymmetry is deliberate and easy to "tidy" into `>=`, which is why it is
 * pinned here rather than left to the reader of the ternary.
 */
describe('capacityBand', () => {
  it('treats an unassigned person as normal', () => {
    expect(capacityBand(0)).toBe('normal')
  })

  it('is normal right up to the near threshold', () => {
    expect(capacityBand(NEAR_CAPACITY_PCT - 1)).toBe('normal')
  })

  it('is near AT the threshold, not one past it', () => {
    expect(capacityBand(NEAR_CAPACITY_PCT)).toBe('near')
  })

  it('stays near across the whole 80–100 band', () => {
    expect(capacityBand(95)).toBe('near')
    expect(capacityBand(99)).toBe('near')
  })

  it('does not call an exactly-full person over capacity', () => {
    expect(capacityBand(100)).toBe('near')
  })

  it('is over from 101 up', () => {
    expect(capacityBand(101)).toBe('over')
    expect(capacityBand(130)).toBe('over')
  })

  /**
   * Nothing validates that assignments sum to something sane, so a bad edit or
   * a stale row can produce a negative or absurd total. The band must still be
   * a band — the meter clamps the width, but the words come from here.
   */
  it('degrades sanely on nonsense totals', () => {
    expect(capacityBand(-10)).toBe('normal')
    expect(capacityBand(10_000)).toBe('over')
  })
})
