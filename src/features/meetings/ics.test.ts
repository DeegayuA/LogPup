import { describe, expect, it } from 'vitest'
import {
  buildIcs,
  escapeIcsText,
  foldIcsLine,
  formatIcsUtc,
  googleCalendarUrl,
  icsFileName,
  meetingIcsUid,
  outlookCalendarUrl,
  type IcsEventInput,
} from '@/features/meetings/ics'

const CRLF = '\r\n'

/** Reverses RFC 5545 folding: a CRLF followed by one space is not real content. */
function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, '')
}

/** The document's content lines, with the fold artefacts removed. */
function lines(ics: string): string[] {
  return unfold(ics).split(CRLF).filter(Boolean)
}

function octets(value: string): number {
  return new TextEncoder().encode(value).length
}

const base: IcsEventInput = {
  uid: meetingIcsUid('11111111-2222-3333-4444-555555555555'),
  sequence: 0,
  now: new Date('2026-08-11T09:30:00.000Z'),
  title: 'Sprint planning',
  description: 'Groom the backlog',
  location: 'Room 2',
  url: 'https://meet.google.com/abc-defg-hij',
  startsAt: new Date('2026-08-12T14:00:00.000Z'),
  endsAt: new Date('2026-08-12T15:00:00.000Z'),
  organizer: { name: 'Ada Lovelace', email: 'ada@example.com' },
  attendees: [
    { name: 'Grace Hopper', email: 'grace@example.com' },
    { name: 'Alan Turing', email: 'alan@example.com' },
  ],
}

describe('formatIcsUtc', () => {
  it('renders RFC 5545 UTC date-times', () => {
    expect(formatIcsUtc(new Date('2026-08-12T14:05:09.000Z'))).toBe('20260812T140509Z')
  })

  it('zero-pads every component, including the year', () => {
    expect(formatIcsUtc(new Date('0007-01-02T03:04:05.000Z'))).toBe('00070102T030405Z')
  })

  it('is always UTC, never the host timezone', () => {
    // Same instant, expressed with an offset — must produce the identical UTC stamp.
    expect(formatIcsUtc(new Date('2026-08-12T19:30:00.000+05:30'))).toBe('20260812T140000Z')
  })
})

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon and comma per §3.3.11', () => {
    expect(escapeIcsText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d')
  })

  it('escapes the backslash first so escapes are not double-escaped', () => {
    // A single input backslash must come out as exactly two, not four.
    expect(escapeIcsText('\\')).toBe('\\\\')
  })

  it('turns real newlines into the literal two-character sequence', () => {
    expect(escapeIcsText('one\r\ntwo\nthree\rfour')).toBe('one\\ntwo\\nthree\\nfour')
  })

  it('strips control characters that cannot appear in a content line', () => {
    expect(escapeIcsText('a\u0000b\u0007c\u001fd\u007f')).toBe('abcd')
  })

  it('leaves a colon alone — TEXT values do not escape it', () => {
    expect(escapeIcsText('Join: now')).toBe('Join: now')
  })
})

describe('foldIcsLine', () => {
  it('leaves a line of 75 octets or fewer untouched', () => {
    const line = 'X'.repeat(75)
    expect(foldIcsLine(line)).toBe(line)
  })

  it('folds a longer line with CRLF + a single space', () => {
    const folded = foldIcsLine('X'.repeat(200))
    expect(folded).toContain(CRLF + ' ')
    for (const part of folded.split(CRLF)) expect(octets(part)).toBeLessThanOrEqual(75)
  })

  it('budgets the continuation space inside the 75 octets', () => {
    const folded = foldIcsLine('X'.repeat(200)).split(CRLF)
    expect(octets(folded[0])).toBe(75)
    // 74 payload octets + the leading space = 75.
    expect(folded[1].startsWith(' ')).toBe(true)
    expect(octets(folded[1])).toBe(75)
  })

  it('round-trips: unfolding restores the original line exactly', () => {
    const line = 'SUMMARY:' + 'abcdefghij'.repeat(30)
    expect(unfold(foldIcsLine(line))).toBe(line)
  })

  it('never splits a multi-octet UTF-8 sequence', () => {
    // Each emoji is 4 octets, so the naive 75-octet cut lands mid-character.
    const line = '🐶'.repeat(60)
    const folded = foldIcsLine(line)
    expect(folded).not.toContain('\uFFFD')
    expect(unfold(folded)).toBe(line)
    for (const part of folded.split(CRLF)) expect(octets(part)).toBeLessThanOrEqual(75)
  })

  it('never splits a 3-octet sequence either', () => {
    const line = '日'.repeat(80)
    expect(unfold(foldIcsLine(line))).toBe(line)
    expect(foldIcsLine(line)).not.toContain('\uFFFD')
  })
})

describe('buildIcs', () => {
  it('uses CRLF everywhere and never a bare LF', () => {
    const ics = buildIcs(base)
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n')
    expect(ics.replace(/\r\n/g, '')).not.toContain('\r')
  })

  it('terminates the final content line with CRLF', () => {
    expect(buildIcs(base).endsWith(CRLF)).toBe(true)
  })

  it('keeps every physical line within 75 octets', () => {
    const ics = buildIcs({ ...base, title: 'Quarterly planning — ' + 'very long '.repeat(20) })
    for (const line of ics.split(CRLF)) expect(octets(line)).toBeLessThanOrEqual(75)
  })

  it('emits the required calendar and event properties', () => {
    const out = lines(buildIcs(base))
    expect(out[0]).toBe('BEGIN:VCALENDAR')
    expect(out.at(-1)).toBe('END:VCALENDAR')
    expect(out).toContain('VERSION:2.0')
    expect(out).toContain('CALSCALE:GREGORIAN')
    expect(out).toContain('METHOD:REQUEST')
    expect(out).toContain('BEGIN:VEVENT')
    expect(out).toContain('END:VEVENT')
    expect(out.some((l) => l.startsWith('PRODID:'))).toBe(true)
    expect(out).toContain('UID:11111111-2222-3333-4444-555555555555@logpup.app')
    expect(out).toContain('DTSTAMP:20260811T093000Z')
    expect(out).toContain('DTSTART:20260812T140000Z')
    expect(out).toContain('DTEND:20260812T150000Z')
    expect(out).toContain('SEQUENCE:0')
    expect(out).toContain('SUMMARY:Sprint planning')
    expect(out).toContain('LOCATION:Room 2')
  })

  it('names the organizer with a CAL-ADDRESS', () => {
    expect(lines(buildIcs(base))).toContain('ORGANIZER;CN="Ada Lovelace":mailto:ada@example.com')
  })

  it('emits exactly one ATTENDEE line per attendee, with RSVP requested', () => {
    const attendeeLines = lines(buildIcs(base)).filter((l) => l.startsWith('ATTENDEE'))
    expect(attendeeLines).toHaveLength(2)
    expect(attendeeLines[0]).toBe(
      'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="Grace Hopper":mailto:grace@example.com',
    )
    expect(attendeeLines[1]).toContain('mailto:alan@example.com')
  })

  it('marks an optional attendee ROLE=OPT-PARTICIPANT and leaves required attendees alone', () => {
    const attendeeLines = lines(
      buildIcs({
        ...base,
        attendees: [
          { name: 'Grace Hopper', email: 'grace@example.com', optional: true },
          { name: 'Alan Turing', email: 'alan@example.com', optional: false },
          { name: 'Ada King', email: 'ada.king@example.com' },
        ],
      }),
    ).filter((l) => l.startsWith('ATTENDEE'))
    expect(attendeeLines[0]).toContain('ROLE=OPT-PARTICIPANT')
    expect(attendeeLines[0]).not.toContain('ROLE=REQ-PARTICIPANT')
    expect(attendeeLines[1]).toContain('ROLE=REQ-PARTICIPANT')
    // `optional` omitted entirely (no invite-list flag written yet) still
    // renders as required — the RFC 5545 default and today's only behaviour.
    expect(attendeeLines[2]).toContain('ROLE=REQ-PARTICIPANT')
  })

  it('handles a meeting with no attendees', () => {
    const out = lines(buildIcs({ ...base, attendees: [] }))
    expect(out.filter((l) => l.startsWith('ATTENDEE'))).toHaveLength(0)
    expect(out).toContain('BEGIN:VEVENT')
  })

  it('escapes text values inside the document', () => {
    const ics = buildIcs({
      ...base,
      title: 'Roadmap, Q3; final',
      description: 'Line one\nLine two, with C:\\path',
    })
    const out = lines(ics)
    expect(out).toContain('SUMMARY:Roadmap\\, Q3\\; final')
    const description = out.find((l) => l.startsWith('DESCRIPTION:'))
    expect(description).toContain('Line one\\nLine two\\, with C:\\\\path')
  })

  it('appends the join link to the description and emits URL', () => {
    const out = lines(buildIcs(base))
    expect(out.find((l) => l.startsWith('DESCRIPTION:'))).toContain(
      'Join: https://meet.google.com/abc-defg-hij',
    )
    expect(out).toContain('URL:https://meet.google.com/abc-defg-hij')
  })

  it('omits optional properties rather than emitting empty ones', () => {
    const out = lines(buildIcs({ ...base, description: null, location: null, url: null }))
    expect(out.some((l) => l.startsWith('DESCRIPTION'))).toBe(false)
    expect(out.some((l) => l.startsWith('LOCATION'))).toBe(false)
    expect(out.some((l) => l.startsWith('URL'))).toBe(false)
  })

  it('carries the injected sequence so an update supersedes the first invite', () => {
    expect(lines(buildIcs({ ...base, sequence: 4 }))).toContain('SEQUENCE:4')
  })

  it('floors a fractional sequence and never emits a negative one', () => {
    expect(lines(buildIcs({ ...base, sequence: 2.9 }))).toContain('SEQUENCE:2')
    expect(lines(buildIcs({ ...base, sequence: -5 }))).toContain('SEQUENCE:0')
  })

  it('is deterministic — no hidden clock or randomness', () => {
    expect(buildIcs(base)).toBe(buildIcs(base))
  })

  it('keeps the UID stable across regenerations so updates replace, not duplicate', () => {
    const first = lines(buildIcs(base)).find((l) => l.startsWith('UID:'))
    const later = lines(
      buildIcs({ ...base, sequence: 3, title: 'Sprint planning (moved)', now: new Date() }),
    ).find((l) => l.startsWith('UID:'))
    expect(first).toBe(later)
  })

  it('rejects an event that cannot be represented', () => {
    expect(() => buildIcs({ ...base, title: '   ' })).toThrow(/title/)
    expect(() => buildIcs({ ...base, endsAt: base.startsAt })).toThrow(/end after it starts/)
    expect(() => buildIcs({ ...base, startsAt: new Date('nope') })).toThrow(/valid start and end/)
  })
})

describe('meetingIcsUid', () => {
  it('is stable and globally qualified', () => {
    expect(meetingIcsUid('abc')).toBe('abc@logpup.app')
    expect(meetingIcsUid('abc')).toBe(meetingIcsUid('abc'))
  })
})

describe('icsFileName', () => {
  it('slugifies the title', () => {
    expect(icsFileName('Sprint planning')).toBe('sprint-planning.ics')
  })

  it('cannot produce a path segment or break a header', () => {
    expect(icsFileName('../../etc/passwd "x"')).toBe('etc-passwd-x.ics')
    expect(icsFileName('a/b\\c')).toBe('a-b-c.ics')
  })

  it('falls back when a title slugifies to nothing', () => {
    expect(icsFileName('日本語')).toBe('meeting.ics')
    expect(icsFileName('')).toBe('meeting.ics')
  })
})

describe('googleCalendarUrl', () => {
  it('builds a template URL with encoded parameters', () => {
    const url = new URL(googleCalendarUrl(base))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Sprint planning')
    expect(url.searchParams.get('dates')).toBe('20260812T140000Z/20260812T150000Z')
    expect(url.searchParams.get('location')).toBe('Room 2')
    expect(url.searchParams.get('details')).toContain('Join: https://meet.google.com/abc-defg-hij')
  })

  it('encodes characters that would otherwise break the query string', () => {
    const raw = googleCalendarUrl({ ...base, title: 'Q3 & Q4 / plan?', location: null, url: null })
    expect(raw).not.toContain('&amp;')
    expect(raw.split('?')[1]).not.toContain('/plan?')
    expect(new URL(raw).searchParams.get('text')).toBe('Q3 & Q4 / plan?')
  })
})

describe('outlookCalendarUrl', () => {
  it('builds an Office 365 compose deeplink', () => {
    const url = new URL(outlookCalendarUrl(base))
    expect(url.origin).toBe('https://outlook.office.com')
    expect(url.pathname).toBe('/calendar/0/deeplink/compose')
    expect(url.searchParams.get('path')).toBe('/calendar/action/compose')
    expect(url.searchParams.get('rru')).toBe('addevent')
    expect(url.searchParams.get('subject')).toBe('Sprint planning')
    expect(url.searchParams.get('startdt')).toBe('2026-08-12T14:00:00.000Z')
    expect(url.searchParams.get('enddt')).toBe('2026-08-12T15:00:00.000Z')
  })

  it('can target personal Outlook.com instead', () => {
    expect(new URL(outlookCalendarUrl(base, 'outlook-com')).origin).toBe(
      'https://outlook.live.com',
    )
  })
})
