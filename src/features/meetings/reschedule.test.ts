import { describe, it, expect } from 'vitest'
import { dayKeyToDate, moveMeetingToDay } from './reschedule'

describe('dayKeyToDate', () => {
  it('parses a yyyy-MM-dd key as local midnight', () => {
    const date = dayKeyToDate('2026-03-06')
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(2)
    expect(date?.getDate()).toBe(6)
    expect(date?.getHours()).toBe(0)
  })

  it('rejects a malformed key', () => {
    expect(dayKeyToDate('nope')).toBeNull()
    expect(dayKeyToDate('2026-3-6')).toBeNull()
    expect(dayKeyToDate('')).toBeNull()
  })

  it('rejects a date that does not exist', () => {
    expect(dayKeyToDate('2026-02-30')).toBeNull()
    expect(dayKeyToDate('2026-13-01')).toBeNull()
  })
})

describe('moveMeetingToDay', () => {
  const day = (key: string) => dayKeyToDate(key)!

  it('keeps the start time of day', () => {
    const { startsAt } = moveMeetingToDay(
      new Date(2026, 2, 2, 10, 30),
      new Date(2026, 2, 2, 11, 30),
      day('2026-03-06'),
    )
    expect(startsAt.getDate()).toBe(6)
    expect(startsAt.getHours()).toBe(10)
    expect(startsAt.getMinutes()).toBe(30)
  })

  it('preserves the duration', () => {
    const from = new Date(2026, 2, 2, 9, 0)
    const to = new Date(2026, 2, 2, 10, 45)
    const moved = moveMeetingToDay(from, to, day('2026-03-09'))
    expect(moved.endsAt.getTime() - moved.startsAt.getTime()).toBe(to.getTime() - from.getTime())
  })

  it('keeps a meeting that runs past midnight intact', () => {
    const from = new Date(2026, 2, 2, 23, 30)
    const to = new Date(2026, 2, 3, 0, 30)
    const moved = moveMeetingToDay(from, to, day('2026-03-10'))
    expect(moved.startsAt.getDate()).toBe(10)
    expect(moved.endsAt.getDate()).toBe(11)
    expect(moved.endsAt.getHours()).toBe(0)
  })

  it('is a no-op when the target day is the meeting day', () => {
    const from = new Date(2026, 2, 2, 9, 0)
    const to = new Date(2026, 2, 2, 10, 0)
    const moved = moveMeetingToDay(from, to, day('2026-03-02'))
    expect(moved.startsAt.getTime()).toBe(from.getTime())
    expect(moved.endsAt.getTime()).toBe(to.getTime())
  })
})
