import { describe, expect, it } from 'vitest'
import { formatMoney, splitByForce, type RoleRateRow } from './rate-intervals'

const row = (over: Partial<RoleRateRow> = {}): RoleRateRow => ({
  id: 'r1',
  role: 'Engineer',
  hourly: '20.00',
  currency: 'LKR',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  setByName: 'Admin',
  ...over,
})

describe('splitByForce', () => {
  // why: half-open [from, to) — a row that STARTS today has already begun.
  it('a row whose effectiveFrom is today is in force, not scheduled', () => {
    const { inForce, scheduled, history } = splitByForce([row({ effectiveFrom: '2026-06-01' })], '2026-06-01')
    expect(inForce).toHaveLength(1)
    expect(scheduled).toHaveLength(0)
    expect(history).toHaveLength(0)
  })

  // why: half-open the other direction — a row that ENDS today no longer covers today.
  it('a row whose effectiveTo is today is history, not in force', () => {
    const { inForce, history } = splitByForce(
      [row({ effectiveFrom: '2026-01-01', effectiveTo: '2026-06-01' })],
      '2026-06-01',
    )
    expect(inForce).toHaveLength(0)
    expect(history).toHaveLength(1)
  })

  it('a future effectiveFrom lands in scheduled', () => {
    const { scheduled, inForce, history } = splitByForce(
      [row({ effectiveFrom: '2026-12-01' })],
      '2026-06-01',
    )
    expect(scheduled).toHaveLength(1)
    expect(inForce).toHaveLength(0)
    expect(history).toHaveLength(0)
  })

  it('an open row that has already started is in force', () => {
    const { inForce } = splitByForce([row({ effectiveFrom: '2026-01-01', effectiveTo: null })], '2026-06-01')
    expect(inForce).toHaveLength(1)
  })
})

describe('formatMoney', () => {
  it('formats the driver string form with grouping and two decimals', () => {
    expect(formatMoney('12500.00', 'LKR')).toBe('12,500.00 LKR')
  })

  it('pads a short decimal string without a lossy Number() round-trip', () => {
    // A value with more significant digits than a JS number can round-trip
    // losslessly past 2^53 would break under Number() — string ops don't care.
    expect(formatMoney('123456789012345.10', 'LKR')).toBe('123,456,789,012,345.10 LKR')
  })

  it('handles a negative amount', () => {
    expect(formatMoney('-500.50', 'LKR')).toBe('-500.50 LKR')
  })

  it('accepts the number form too, via toFixed(2)', () => {
    expect(formatMoney(1234.5, 'LKR')).toBe('1,234.50 LKR')
  })
})
