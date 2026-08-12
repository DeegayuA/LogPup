import { describe, expect, it } from 'vitest'
import { parseMeetingIntent } from './meeting-intent'

const PEOPLE = [
  { id: 'u1', name: 'Shanika Ayasmanthi' },
  { id: 'u2', name: 'Deeghayu Adhikari' },
  { id: 'u3', name: 'Sam Perera' },
  { id: 'u4', name: 'Sam Fernando' },
]

// Tuesday, 11 Aug 2026, 09:00 — fixed so weekday and "today" math is stable.
const NOW = new Date(2026, 7, 11, 9, 0)

/** Local-time Date for the August 2026 test month. */
function aug(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 7, day, hour, minute)
}

describe('parseMeetingIntent', () => {
  it('reads title, relative day, time and a "with" list', () => {
    const intent = parseMeetingIntent('standup tomorrow 10am with shanika and deeghayu', PEOPLE, NOW)
    expect(intent?.title).toBe('standup')
    expect(intent?.startsAt).toEqual(aug(12, 10))
    // No duration given, so the meeting runs the default hour.
    expect(intent?.endsAt).toEqual(aug(12, 11))
    expect(intent?.attendeeNames).toEqual(['shanika', 'deeghayu'])
    expect(intent?.attendees.map((a) => a.id)).toEqual(['u1', 'u2'])
    expect(intent?.ambiguous).toEqual([])
    expect(intent?.unresolved).toEqual([])
  })

  it('reads a time range, a weekday and a trailing app that precedes "with"', () => {
    const intent = parseMeetingIntent(
      'design review friday 2-3pm on LogPup with shanika',
      PEOPLE,
      NOW,
    )
    expect(intent?.title).toBe('design review')
    // The meridiem written once at the end governs both halves of the range.
    expect(intent?.startsAt).toEqual(aug(14, 14))
    expect(intent?.endsAt).toEqual(aug(14, 15))
    expect(intent?.appQuery).toBe('LogPup')
    // The parser never resolves the app — the caller owns the app list.
    expect(intent?.appName).toBeNull()
    expect(intent?.attendees.map((a) => a.id)).toEqual(['u1'])
  })

  it('reads a dotted time, "next monday" and an explicit duration', () => {
    const intent = parseMeetingIntent('1:1 with deeghayu next monday 9.30am for 45m', PEOPLE, NOW)
    // "1:1" is not a clock time and must survive in the title.
    expect(intent?.title).toBe('1:1')
    expect(intent?.startsAt).toEqual(aug(24, 9, 30))
    expect(intent?.endsAt).toEqual(aug(24, 10, 15))
    expect(intent?.attendees.map((a) => a.id)).toEqual(['u2'])
  })

  it('reads a bare today + time with no attendees', () => {
    const intent = parseMeetingIntent('retro today 4pm', PEOPLE, NOW)
    expect(intent?.title).toBe('retro')
    expect(intent?.startsAt).toEqual(aug(11, 16))
    expect(intent?.endsAt).toEqual(aug(11, 17))
    expect(intent?.attendeeNames).toEqual([])
    expect(intent?.attendees).toEqual([])
  })

  it('understands 24-hour clock times and ranges that span the meridiem', () => {
    const twentyFour = parseMeetingIntent('sync 14:00', PEOPLE, NOW)
    expect(twentyFour?.startsAt).toEqual(aug(11, 14))
    expect(twentyFour?.endsAt).toEqual(aug(11, 15))

    const spelled = parseMeetingIntent('planning 10am-11:30am', PEOPLE, NOW)
    expect(spelled?.startsAt).toEqual(aug(11, 10))
    expect(spelled?.endsAt).toEqual(aug(11, 11, 30))

    // "11-1pm" cannot be 11pm-1pm, so the start falls back to the morning.
    const crossing = parseMeetingIntent('review 11-1pm', PEOPLE, NOW)
    expect(crossing?.startsAt).toEqual(aug(11, 11))
    expect(crossing?.endsAt).toEqual(aug(11, 13))

    const written = parseMeetingIntent('handover from 2 to 3pm', PEOPLE, NOW)
    expect(written?.startsAt).toEqual(aug(11, 14))
    expect(written?.endsAt).toEqual(aug(11, 15))
  })

  it('honours minute and hour durations', () => {
    expect(parseMeetingIntent('retro today 4pm for 45m', PEOPLE, NOW)?.endsAt).toEqual(
      aug(11, 16, 45),
    )
    expect(parseMeetingIntent('call 2pm for 1h', PEOPLE, NOW)?.endsAt).toEqual(aug(11, 15))
    expect(parseMeetingIntent('workshop 10am for 90 mins', PEOPLE, NOW)?.endsAt).toEqual(
      aug(11, 11, 30),
    )
    expect(parseMeetingIntent('kickoff 10am for 30 minutes', PEOPLE, NOW)?.endsAt).toEqual(
      aug(11, 10, 30),
    )
  })

  it('resolves weekdays the way the task parser does', () => {
    expect(parseMeetingIntent('retro friday 3pm', PEOPLE, NOW)?.startsAt).toEqual(aug(14, 15))
    // A bare weekday never means today.
    expect(parseMeetingIntent('retro tuesday 3pm', PEOPLE, NOW)?.startsAt).toEqual(aug(18, 15))
    expect(parseMeetingIntent('retro next monday 3pm', PEOPLE, NOW)?.startsAt).toEqual(aug(24, 15))
    expect(parseMeetingIntent('planning next week 10am', PEOPLE, NOW)?.startsAt).toEqual(aug(18, 10))
  })

  // Regression: "tommorow" was left in the title and the meeting silently
  // landed on today, which reads as a broken scheduler rather than a typo.
  it.each(['tommorow', 'tommorrow', 'tomorow', 'tmrw', 'tmr'])(
    'reads "%s" as tomorrow',
    (spelling) => {
      const intent = parseMeetingIntent(`standup ${spelling} 10am`, PEOPLE, NOW)
      expect(intent?.startsAt).toEqual(aug(12, 10))
      // The date word must also be stripped from the title, or the meeting ends
      // up named after the day it is on.
      expect(intent?.title).toBe('standup')
    },
  )

  it('falls back to a 9am start when a day is given without a time', () => {
    const intent = parseMeetingIntent('standup tomorrow', PEOPLE, NOW)
    expect(intent?.title).toBe('standup')
    expect(intent?.startsAt).toEqual(aug(12, 9))
    expect(intent?.endsAt).toEqual(aug(12, 10))
  })

  it('leaves both times null when neither a day nor a time was written', () => {
    const intent = parseMeetingIntent('budget chat with shanika', PEOPLE, NOW)
    expect(intent?.title).toBe('budget chat')
    expect(intent?.startsAt).toBeNull()
    expect(intent?.endsAt).toBeNull()
    expect(intent?.attendees.map((a) => a.id)).toEqual(['u1'])
  })

  it('flags ambiguous and unknown names instead of guessing', () => {
    const ambiguous = parseMeetingIntent('sync tomorrow 10am with sam', PEOPLE, NOW)
    expect(ambiguous?.attendees).toEqual([])
    expect(ambiguous?.ambiguous).toEqual(['sam'])

    const unknown = parseMeetingIntent('sync tomorrow 10am with bob', PEOPLE, NOW)
    expect(unknown?.attendees).toEqual([])
    expect(unknown?.unresolved).toEqual(['bob'])
  })

  it('splits attendees on commas, "and" and "&" without repeating anyone', () => {
    const intent = parseMeetingIntent(
      'sync 10am with shanika, sam perera & shanika ayasmanthi and deeghayu',
      PEOPLE,
      NOW,
    )
    expect(intent?.attendeeNames).toEqual([
      'shanika',
      'sam perera',
      'shanika ayasmanthi',
      'deeghayu',
    ])
    expect(intent?.attendees.map((a) => a.id)).toEqual(['u1', 'u3', 'u2'])
  })

  it('keeps the app hint out of the attendee list', () => {
    const intent = parseMeetingIntent('standup 10am with shanika on logpup', PEOPLE, NOW)
    expect(intent?.title).toBe('standup')
    expect(intent?.attendeeNames).toEqual(['shanika'])
    expect(intent?.appQuery).toBe('logpup')
  })

  it('strips scheduling filler and the "at" before a time', () => {
    const intent = parseMeetingIntent('schedule a standup tomorrow at 10am', PEOPLE, NOW)
    expect(intent?.title).toBe('standup')
    expect(intent?.startsAt).toEqual(aug(12, 10))
  })

  it('lifts a pasted link out of the title, without its trailing punctuation', () => {
    const intent = parseMeetingIntent(
      'standup tomorrow 10am https://meet.google.com/abc-defg-hij.',
      PEOPLE,
      NOW,
    )
    // The sentence-ending period is not part of the link.
    expect(intent?.meetingUrl).toBe('https://meet.google.com/abc-defg-hij')
    expect(intent?.title).toBe('standup')
    expect(intent?.startsAt).toEqual(aug(12, 10))
  })

  it('takes a link from the middle of a phrase without disturbing the rest', () => {
    const intent = parseMeetingIntent(
      'sync https://zoom.us/j/9876543210 with shanika at 2pm',
      PEOPLE,
      NOW,
    )
    expect(intent?.meetingUrl).toBe('https://zoom.us/j/9876543210')
    expect(intent?.title).toBe('sync')
    expect(intent?.startsAt).toEqual(aug(11, 14))
    expect(intent?.attendees.map((a) => a.id)).toEqual(['u1'])
  })

  it('reads a link alongside attendees and a time range in one line', () => {
    const intent = parseMeetingIntent(
      'design review friday 2-3pm https://teams.microsoft.com/l/meetup-join/19 with shanika and deeghayu',
      PEOPLE,
      NOW,
    )
    expect(intent?.meetingUrl).toBe('https://teams.microsoft.com/l/meetup-join/19')
    expect(intent?.title).toBe('design review')
    expect(intent?.startsAt).toEqual(aug(14, 14))
    expect(intent?.endsAt).toEqual(aug(14, 15))
    expect(intent?.attendees.map((a) => a.id)).toEqual(['u1', 'u2'])
  })

  it('takes the link out before the clock reader runs, so a port is not a time', () => {
    const intent = parseMeetingIntent('war room https://meet.example.com:8443/room today', PEOPLE, NOW)
    expect(intent?.meetingUrl).toBe('https://meet.example.com:8443/room')
    expect(intent?.title).toBe('war room')
    // ":8443" must not be read as 8:44 — the day-only 9am fallback still applies.
    expect(intent?.startsAt).toEqual(aug(11, 9))
  })

  it('leaves the link null when the phrase has none', () => {
    expect(parseMeetingIntent('standup tomorrow 10am with shanika', PEOPLE, NOW)?.meetingUrl).toBeNull()
  })

  it('returns null when nothing is left to title the meeting', () => {
    expect(parseMeetingIntent('tomorrow 10am with shanika', PEOPLE, NOW)).toBeNull()
    expect(parseMeetingIntent('   ', PEOPLE, NOW)).toBeNull()
    expect(parseMeetingIntent('', PEOPLE, NOW)).toBeNull()
  })
})
