import { describe, expect, it } from 'vitest'
import { describeNextMeeting, nextMeetingDueDate, parseColomboWallClock } from './next-meeting'

describe('nextMeetingDueDate', () => {
  it('is null when the room never agreed a next meeting', () => {
    expect(nextMeetingDueDate(null)).toBeNull()
    expect(nextMeetingDueDate(undefined)).toBeNull()
  })

  it('is null for an unparseable date rather than throwing at a call site', () => {
    expect(nextMeetingDueDate(new Date('nope'))).toBeNull()
  })

  it('takes the Colombo day', () => {
    // 08:00 in Colombo on 1 Sep is 02:30 UTC the same day — the easy case.
    expect(nextMeetingDueDate(new Date('2026-09-01T02:30:00Z'))).toBe('2026-09-01')
  })

  it('does not file work a day early for an early-morning meeting', () => {
    // 03:00 Colombo on 1 Sep is 21:30Z on 31 Aug, so the naive
    // toISOString().slice(0, 10) reads "2026-08-31" for a meeting everyone in
    // the room would call the 1st.
    const earlyMorningColombo = new Date('2026-08-31T21:30:00Z')
    expect(earlyMorningColombo.toISOString().slice(0, 10)).toBe('2026-08-31')
    expect(nextMeetingDueDate(earlyMorningColombo)).toBe('2026-09-01')
  })

  it('honours an explicit timezone, so the rule is testable rather than hard-wired', () => {
    expect(nextMeetingDueDate(new Date('2026-08-31T21:30:00Z'), 'UTC')).toBe('2026-08-31')
  })
})

describe('describeNextMeeting', () => {
  const now = new Date('2026-08-26T06:00:00Z') // 11:30 Colombo, Wed 26 Aug

  it('words a date a week out in whole days', () => {
    const out = describeNextMeeting(new Date('2026-09-01T09:30:00Z'), now)
    expect(out.iso).toBe('2026-09-01')
    expect(out.day).toBe('Tue 1 Sep')
    expect(out.relative).toBe('in 6 days')
    expect(out.past).toBe(false)
  })

  it('renders the time in the business timezone, not the runner-s', () => {
    // 09:30Z is 15:00 in Colombo.
    expect(describeNextMeeting(new Date('2026-09-01T09:30:00Z'), now).time).toBe('3:00 pm')
  })

  it('counts calendar days, so a meeting 21 hours away is still tomorrow', () => {
    // 03:30Z on 27 Aug is 09:00 Colombo the next day.
    expect(describeNextMeeting(new Date('2026-08-27T03:30:00Z'), now).relative).toBe('tomorrow')
  })

  it('counts calendar days, so a meeting late tonight is still today', () => {
    // 17:30Z is 23:00 Colombo the same day — further off in hours, same day.
    expect(describeNextMeeting(new Date('2026-08-26T17:30:00Z'), now).relative).toBe('today')
  })

  it('marks a passed agreement rather than presenting it as still ahead', () => {
    const out = describeNextMeeting(new Date('2026-08-18T09:30:00Z'), now)
    expect(out.past).toBe(true)
    expect(out.relative).toBe('8 days ago')
  })

  it('treats a moment earlier today as past while still reading as today', () => {
    const out = describeNextMeeting(new Date('2026-08-26T03:00:00Z'), now)
    expect(out.past).toBe(true)
    expect(out.relative).toBe('today')
  })

  it('omits the year within this year and prints it across a year boundary', () => {
    expect(describeNextMeeting(new Date('2026-12-30T09:30:00Z'), now).day).toBe('Wed 30 Dec')
    expect(describeNextMeeting(new Date('2027-01-04T09:30:00Z'), now).day).toBe('Mon 4 Jan 2027')
  })
})

describe('parseColomboWallClock', () => {
  it('reads a wall clock as Colombo time, not the server-s', () => {
    // 15:00 in Colombo is 09:30 UTC. Bare `new Date('2026-09-01T15:00')` on a
    // UTC server would give 15:00Z — 8:30pm Colombo, five and a half hours late.
    expect(parseColomboWallClock('2026-09-01T15:00')?.toISOString()).toBe('2026-09-01T09:30:00.000Z')
  })

  it('handles a time that belongs to the previous UTC day', () => {
    // 03:00 Colombo on 1 Sep is 21:30Z on 31 Aug.
    expect(parseColomboWallClock('2026-09-01T03:00')?.toISOString()).toBe('2026-08-31T21:30:00.000Z')
  })

  it('handles midnight, where the formatted hour can come back as 24', () => {
    expect(parseColomboWallClock('2026-09-01T00:00')?.toISOString()).toBe('2026-08-31T18:30:00.000Z')
  })

  it('is identity in UTC, so the correction is an offset and not a constant', () => {
    expect(parseColomboWallClock('2026-09-01T15:00', 'UTC')?.toISOString()).toBe(
      '2026-09-01T15:00:00.000Z',
    )
  })

  it('refuses anything that is not exactly that shape', () => {
    for (const bad of [
      '',
      'next Monday',
      '2026-09-01',
      '2026-09-01T15:00:00',
      '2026-09-01 15:00',
      '2026-09-01T15:00Z',
    ]) {
      expect(parseColomboWallClock(bad)).toBeNull()
    }
  })

  it('refuses a date that is not a real moment', () => {
    expect(parseColomboWallClock('2026-02-31T10:00')?.toISOString()).not.toBe(
      '2026-02-31T04:30:00.000Z',
    )
  })

  it('tolerates surrounding whitespace from the model', () => {
    expect(parseColomboWallClock('  2026-09-01T15:00 ')?.toISOString()).toBe(
      '2026-09-01T09:30:00.000Z',
    )
  })
})
