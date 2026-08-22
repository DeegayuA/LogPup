import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RETENTION_POLICY,
  planRetention,
  pruneReason,
  retentionCutoffs,
  summarizeRetention,
} from './retention'

// One fixed instant for the whole file. Every expectation below is a real
// timestamp compared against a real cutoff — nothing here mocks a clock,
// because `now` is an argument precisely so it never has to.
const NOW = new Date('2026-08-22T09:00:00.000Z')
const DAY_MS = 86_400_000

/** `days` before NOW, to the millisecond. */
function ago(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS)
}

describe('retentionCutoffs', () => {
  it('measures both windows from the same instant', () => {
    expect(retentionCutoffs(NOW)).toEqual({
      dismissedBefore: new Date('2026-07-23T09:00:00.000Z'), // 30 days
      createdBefore: new Date('2026-05-24T09:00:00.000Z'), // 90 days
    })
  })

  it('honours a caller-supplied policy', () => {
    expect(retentionCutoffs(NOW, { dismissedDays: 7, maxAgeDays: 14 })).toEqual({
      dismissedBefore: new Date('2026-08-15T09:00:00.000Z'),
      createdBefore: new Date('2026-08-08T09:00:00.000Z'),
    })
  })

  it('throws on an Invalid Date instead of returning cutoffs nothing matches', () => {
    // The silent version of this bug is a tick that reports "0 pruned" every
    // day forever while looking perfectly healthy.
    expect(() => retentionCutoffs(new Date('not a date'))).toThrow(RangeError)
  })

  it('throws on a zero or negative window instead of condemning today rows', () => {
    expect(() => retentionCutoffs(NOW, { dismissedDays: 0, maxAgeDays: 90 })).toThrow(RangeError)
    expect(() => retentionCutoffs(NOW, { dismissedDays: 30, maxAgeDays: -1 })).toThrow(RangeError)
  })
})

describe('pruneReason', () => {
  it('prunes a row dismissed longer ago than the dismissed window', () => {
    expect(pruneReason({ createdAt: ago(32), dismissedAt: ago(31) }, NOW)).toBe('dismissed')
  })

  it('keeps a row dismissed inside the window', () => {
    expect(pruneReason({ createdAt: ago(30), dismissedAt: ago(29) }, NOW)).toBeNull()
  })

  it('keeps a row sitting exactly on its cutoff for one more tick', () => {
    expect(pruneReason({ createdAt: ago(40), dismissedAt: ago(30) }, NOW)).toBeNull()
    expect(pruneReason({ createdAt: ago(90), dismissedAt: null }, NOW)).toBeNull()
  })

  it('ages out a row past the ceiling that was never dismissed', () => {
    expect(pruneReason({ createdAt: ago(91), dismissedAt: null }, NOW)).toBe('aged-out')
  })

  it('keeps an undismissed row inside the ceiling', () => {
    expect(pruneReason({ createdAt: ago(89), dismissedAt: null }, NOW)).toBeNull()
  })

  it('ages out an unread, never-dismissed row — the deliberate half of the policy', () => {
    // Stated as a test rather than left to be discovered: the ceiling is not
    // conditional on the reader having seen the row.
    expect(pruneReason({ createdAt: ago(200), dismissedAt: null }, NOW)).toBe('aged-out')
  })

  it('ages out an old row dismissed only yesterday', () => {
    // The dismissed window has not expired; the ceiling still applies.
    expect(pruneReason({ createdAt: ago(200), dismissedAt: ago(1) }, NOW)).toBe('aged-out')
  })

  it('reports `dismissed` when a row satisfies both rules', () => {
    expect(pruneReason({ createdAt: ago(200), dismissedAt: ago(40) }, NOW)).toBe('dismissed')
  })

  it('applies a caller-supplied policy rather than the default', () => {
    const row = { createdAt: ago(20), dismissedAt: ago(10) }
    expect(pruneReason(row, NOW)).toBeNull()
    expect(pruneReason(row, NOW, { dismissedDays: 7, maxAgeDays: 90 })).toBe('dismissed')
    expect(pruneReason(row, NOW, { dismissedDays: 30, maxAgeDays: 14 })).toBe('aged-out')
  })
})

describe('planRetention', () => {
  const rows = [
    { id: 'keep-fresh', createdAt: ago(1), dismissedAt: null },
    { id: 'keep-recently-dismissed', createdAt: ago(5), dismissedAt: ago(2) },
    { id: 'prune-dismissed', createdAt: ago(45), dismissedAt: ago(44) },
    { id: 'keep-old-unread-but-inside-ceiling', createdAt: ago(80), dismissedAt: null },
    { id: 'prune-aged-out', createdAt: ago(120), dismissedAt: null },
  ]

  it('splits candidates into what goes and what stays, with the rule attached', () => {
    const plan = planRetention(rows, NOW)
    expect(plan.prune).toEqual([
      { row: rows[2], reason: 'dismissed' },
      { row: rows[4], reason: 'aged-out' },
    ])
    expect(plan.keep.map((r) => r.id)).toEqual([
      'keep-fresh',
      'keep-recently-dismissed',
      'keep-old-unread-but-inside-ceiling',
    ])
  })

  it('agrees with pruneReason row for row', () => {
    // The batch path resolves the cutoffs once instead of per row; this is the
    // assertion that the optimisation did not change the answer.
    const plan = planRetention(rows, NOW)
    const condemned = new Map(plan.prune.map((d) => [d.row.id, d.reason]))
    for (const row of rows) {
      expect(condemned.get(row.id) ?? null).toBe(pruneReason(row, NOW))
    }
  })

  it('returns the rows themselves, so the caller still has their ids', () => {
    const plan = planRetention(rows, NOW)
    expect(plan.prune.map((d) => d.row.id)).toEqual(['prune-dismissed', 'prune-aged-out'])
  })

  it('handles an empty batch without touching the clock', () => {
    expect(planRetention([], NOW)).toEqual({ prune: [], keep: [] })
  })

  it('throws on an unusable policy rather than planning a mass delete', () => {
    expect(() => planRetention(rows, NOW, { dismissedDays: 30, maxAgeDays: 0 })).toThrow(RangeError)
  })
})

describe('summarizeRetention', () => {
  it('counts each rule separately', () => {
    const plan = planRetention(
      [
        { createdAt: ago(45), dismissedAt: ago(44) },
        { createdAt: ago(50), dismissedAt: ago(40) },
        { createdAt: ago(120), dismissedAt: null },
      ],
      NOW,
    )
    expect(summarizeRetention(plan.prune)).toEqual({ dismissed: 2, 'aged-out': 1 })
  })

  it('reports an explicit 0 for a rule that condemned nothing', () => {
    // 0 and "absent" are different answers, and this response is the only
    // place either is ever visible.
    expect(summarizeRetention([])).toEqual({ dismissed: 0, 'aged-out': 0 })
  })
})

describe('DEFAULT_RETENTION_POLICY', () => {
  it('is the pair of windows the cron route ships with', () => {
    // Pinned by value: changing either number is a product decision about how
    // long somebody's inbox remembers, not a tuning knob.
    expect(DEFAULT_RETENTION_POLICY).toEqual({ dismissedDays: 30, maxAgeDays: 90 })
  })
})
