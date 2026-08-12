import { describe, expect, it } from 'vitest'
import {
  assignmentActivityTitle,
  groupActivityByDay,
  mergeActivity,
  relativeDayLabel,
  type AppActivityItem,
} from '@/features/apps/activity'

function item(partial: Partial<AppActivityItem> & Pick<AppActivityItem, 'id' | 'at'>): AppActivityItem {
  return {
    kind: 'comment',
    actorName: null,
    actorAvatarUrl: null,
    title: 'something',
    detail: null,
    href: null,
    ...partial,
  }
}

describe('mergeActivity', () => {
  it('interleaves sources newest first', () => {
    const merged = mergeActivity(
      [
        [item({ id: 'a', at: new Date('2026-08-10T09:00:00Z') })],
        [item({ id: 'b', at: new Date('2026-08-12T09:00:00Z'), kind: 'task' })],
        [item({ id: 'c', at: new Date('2026-08-11T09:00:00Z'), kind: 'meeting' })],
      ],
      10,
    )
    expect(merged.map((entry) => entry.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks identical timestamps deterministically by kind then id', () => {
    const at = new Date('2026-08-12T09:00:00Z')
    const first = mergeActivity(
      [
        [item({ id: 'z', at, kind: 'task' })],
        [item({ id: 'a', at, kind: 'task' })],
        [item({ id: 'm', at, kind: 'comment' })],
      ],
      10,
    )
    const second = mergeActivity(
      [
        [item({ id: 'm', at, kind: 'comment' })],
        [item({ id: 'a', at, kind: 'task' })],
        [item({ id: 'z', at, kind: 'task' })],
      ],
      10,
    )
    expect(first.map((entry) => entry.id)).toEqual(['m', 'a', 'z'])
    expect(second.map((entry) => entry.id)).toEqual(first.map((entry) => entry.id))
  })

  it('applies the limit after merging, not per source', () => {
    const merged = mergeActivity(
      [
        [
          item({ id: 'old1', at: new Date('2026-01-01T00:00:00Z') }),
          item({ id: 'old2', at: new Date('2026-01-02T00:00:00Z') }),
        ],
        [item({ id: 'new', at: new Date('2026-08-12T00:00:00Z'), kind: 'task' })],
      ],
      1,
    )
    expect(merged.map((entry) => entry.id)).toEqual(['new'])
  })

  it('handles an entirely empty feed', () => {
    expect(mergeActivity([[], []], 10)).toEqual([])
  })
})

describe('groupActivityByDay', () => {
  const toDay = (date: Date) => date.toISOString().slice(0, 10)

  it('groups consecutive items of the same day together', () => {
    const groups = groupActivityByDay(
      [
        item({ id: '1', at: new Date('2026-08-12T18:00:00Z') }),
        item({ id: '2', at: new Date('2026-08-12T09:00:00Z') }),
        item({ id: '3', at: new Date('2026-08-11T09:00:00Z') }),
      ],
      toDay,
    )
    expect(groups.map((group) => group.day)).toEqual(['2026-08-12', '2026-08-11'])
    expect(groups[0].items.map((entry) => entry.id)).toEqual(['1', '2'])
  })

  it('uses the injected day function, not the server timezone', () => {
    const groups = groupActivityByDay([item({ id: '1', at: new Date('2026-08-12T00:00:00Z') })], () => 'fixed-day')
    expect(groups[0].day).toBe('fixed-day')
  })

  it('returns nothing for an empty feed', () => {
    expect(groupActivityByDay([], toDay)).toEqual([])
  })
})

describe('assignmentActivityTitle', () => {
  it('phrases each change kind distinctly', () => {
    expect(assignmentActivityTitle('assigned', 'Priya', 50)).toBe('Priya joined at 50%')
    expect(assignmentActivityTitle('updated', 'Priya', 30)).toBe('Priya moved to 30%')
    expect(assignmentActivityTitle('removed', 'Priya', 0)).toBe('Priya came off the app')
  })
})

describe('relativeDayLabel', () => {
  it('names today and yesterday', () => {
    expect(relativeDayLabel('2026-08-11', '2026-08-11')).toBe('Today')
    expect(relativeDayLabel('2026-08-10', '2026-08-11')).toBe('Yesterday')
  })

  it('returns null for anything older, leaving the format to the caller', () => {
    expect(relativeDayLabel('2026-08-09', '2026-08-11')).toBeNull()
    expect(relativeDayLabel('2026-07-11', '2026-08-11')).toBeNull()
  })

  it('returns null for a FUTURE day rather than calling it "Yesterday"', () => {
    // A meeting row carries created_at, but nothing stops a source from
    // handing the feed a timestamp ahead of `today`; -1 must not be mistaken
    // for 1 by an abs() somewhere.
    expect(relativeDayLabel('2026-08-12', '2026-08-11')).toBeNull()
  })

  it('crosses a month boundary', () => {
    expect(relativeDayLabel('2026-07-31', '2026-08-01')).toBe('Yesterday')
  })

  it('crosses a year boundary', () => {
    expect(relativeDayLabel('2025-12-31', '2026-01-01')).toBe('Yesterday')
  })

  it('is timezone-independent: the answer comes from the strings, not the clock', () => {
    // The regression: the old implementation ran the group key (Colombo) past
    // date-fns `isToday`, which reads the MACHINE's timezone. A Colombo day
    // that has already begun while the server is still on the previous UTC day
    // used to lose its "Today" heading entirely.
    const colomboToday = '2026-08-12'
    expect(relativeDayLabel(colomboToday, colomboToday)).toBe('Today')
    expect(relativeDayLabel('2026-08-11', colomboToday)).toBe('Yesterday')
  })
})
