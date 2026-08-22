import { describe, expect, it } from 'vitest'

import { summariseRecentDays } from './entry-evidence'

/**
 * The shape of a normal day, as the drafter is shown it.
 *
 * This is the one part of the drafter's context that is pure, and the part most
 * worth pinning: the rounding and the ordering ARE the content, and both are
 * easy to get subtly wrong in a way no integration test would notice — a Map
 * that preserves insertion order rather than key order still produces a
 * plausible-looking list, just of the wrong days.
 */

describe('summariseRecentDays', () => {
  it('folds a day into its categories, largest first', () => {
    expect(
      summariseRecentDays([
        { day: '2026-08-19', minutes: 60, category: 'meeting' },
        { day: '2026-08-19', minutes: 360, category: 'task' },
      ]),
    ).toEqual([{ day: '2026-08-19', summary: '6h task · 1h meeting' }])
  })

  it('adds up several entries of the same kind on one day', () => {
    expect(
      summariseRecentDays([
        { day: '2026-08-19', minutes: 90, category: 'task' },
        { day: '2026-08-19', minutes: 90, category: 'task' },
      ]),
    ).toEqual([{ day: '2026-08-19', summary: '3h task' }])
  })

  it('writes a part-hour compactly, and minutes as minutes', () => {
    expect(
      summariseRecentDays([{ day: '2026-08-19', minutes: 90, category: 'task' }])[0]?.summary,
    ).toBe('1h30 task')
    expect(
      summariseRecentDays([{ day: '2026-08-19', minutes: 45, category: 'admin' }])[0]?.summary,
    ).toBe('45m admin')
  })

  it('orders days newest first even when the rows are not', () => {
    // A Map keeps INSERTION order, not key order — this function has to be
    // right on its own rather than only when handed an already-sorted read.
    expect(
      summariseRecentDays([
        { day: '2026-08-18', minutes: 60, category: 'task' },
        { day: '2026-08-20', minutes: 60, category: 'task' },
        { day: '2026-08-19', minutes: 60, category: 'task' },
      ]).map((entry) => entry.day),
    ).toEqual(['2026-08-20', '2026-08-19', '2026-08-18'])
  })

  it('keeps the most recent days, not the first ones it happened to see', () => {
    const rows = ['2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17'].map((day) => ({
      day,
      minutes: 60,
      category: 'task',
    }))
    expect(summariseRecentDays(rows, 2).map((entry) => entry.day)).toEqual([
      '2026-08-17',
      '2026-08-16',
    ])
  })

  it('is empty for somebody who has logged nothing', () => {
    expect(summariseRecentDays([])).toEqual([])
  })
})
