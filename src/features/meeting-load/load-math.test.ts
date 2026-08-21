import { describe, expect, it } from 'vitest'
import { DURATION_CLAMP_HOURS, invitedHoursFor, rsvpAdoption } from './load-math'

const at = (iso: string) => new Date(iso)

describe('invitedHoursFor', () => {
  it('multiplies duration by everybody who has not declined', () => {
    const result = invitedHoursFor({
      meetingId: 'm1',
      startsAt: at('2026-08-21T09:00:00Z'),
      endsAt: at('2026-08-21T11:00:00Z'),
      attendeeResponses: ['going', 'going', 'maybe', 'pending', 'going', 'declined'],
    })
    expect(result.hours).toBe(10) // 2h x 5 non-declined
    expect(result.clamped).toBe(false)
    expect(result.flagged).toBe(false)
  })

  it('treats pending as invited — it measures widget adoption, not intent', () => {
    const result = invitedHoursFor({
      meetingId: 'm1',
      startsAt: at('2026-08-21T09:00:00Z'),
      endsAt: at('2026-08-21T10:00:00Z'),
      attendeeResponses: ['pending', 'pending'],
    })
    expect(result.hours).toBe(2)
  })

  it('clamps an implausible duration and says it did', () => {
    const result = invitedHoursFor({
      meetingId: 'm1',
      startsAt: at('2026-08-21T00:00:00Z'),
      endsAt: at('2026-08-21T10:00:00Z'),
      attendeeResponses: ['going', 'going', 'going'],
    })
    expect(result.hours).toBe(DURATION_CLAMP_HOURS * 3)
    expect(result.clamped).toBe(true)
  })

  it('contributes zero for a zero-length meeting, flagged rather than silent', () => {
    const result = invitedHoursFor({
      meetingId: 'm1',
      startsAt: at('2026-08-21T09:00:00Z'),
      endsAt: at('2026-08-21T09:00:00Z'),
      attendeeResponses: ['going'],
    })
    expect(result.hours).toBe(0)
    expect(result.flagged).toBe(true)
  })

  it('contributes zero for a reversed meeting, never a negative', () => {
    // A negative would make a week's total smaller than its parts, which is a
    // number nobody could reconcile against the drill-down.
    const result = invitedHoursFor({
      meetingId: 'm1',
      startsAt: at('2026-08-21T11:00:00Z'),
      endsAt: at('2026-08-21T09:00:00Z'),
      attendeeResponses: ['going', 'going'],
    })
    expect(result.hours).toBe(0)
    expect(result.flagged).toBe(true)
  })

  it('is zero with nobody invited, without flagging a valid duration', () => {
    const result = invitedHoursFor({
      meetingId: 'm1',
      startsAt: at('2026-08-21T09:00:00Z'),
      endsAt: at('2026-08-21T10:00:00Z'),
      attendeeResponses: [],
    })
    expect(result.hours).toBe(0)
    expect(result.flagged).toBe(false)
  })
})

describe('rsvpAdoption', () => {
  const meeting = (attendees: { userId: string; response: 'pending' | 'going' | 'maybe' | 'declined' }[]) =>
    ({ meetingId: 'm1', createdBy: 'organizer', attendees })

  it('counts a pending invitee who is not the organizer', () => {
    const result = rsvpAdoption([meeting([
      { userId: 'a', response: 'pending' },
      { userId: 'b', response: 'going' },
    ])])
    expect(result).toEqual({ pending: 1, total: 2, rate: 0.5 })
  })

  it('excludes the organizer’s own row, even at pending', () => {
    // 'pending' is genuinely unsettable through the UI for the creator, so
    // counting it would put a floor under every adoption figure that has
    // nothing to do with adoption.
    const result = rsvpAdoption([meeting([
      { userId: 'organizer', response: 'pending' },
      { userId: 'a', response: 'going' },
    ])])
    expect(result).toEqual({ pending: 0, total: 1, rate: 0 })
  })

  it('counts every attendee toward the total whatever they answered', () => {
    const result = rsvpAdoption([meeting([
      { userId: 'a', response: 'declined' },
      { userId: 'b', response: 'maybe' },
      { userId: 'c', response: 'pending' },
    ])])
    expect(result.total).toBe(3)
  })

  it('is zero, not NaN, with no attendees at all', () => {
    expect(rsvpAdoption([meeting([])])).toEqual({ pending: 0, total: 0, rate: 0 })
    expect(rsvpAdoption([])).toEqual({ pending: 0, total: 0, rate: 0 })
  })

  it('adds up across meetings', () => {
    const result = rsvpAdoption([
      meeting([{ userId: 'a', response: 'pending' }]),
      { meetingId: 'm2', createdBy: 'other', attendees: [{ userId: 'b', response: 'going' }] },
    ])
    expect(result).toEqual({ pending: 1, total: 2, rate: 0.5 })
  })
})
