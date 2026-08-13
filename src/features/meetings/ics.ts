/**
 * iCalendar (RFC 5545) generation for meeting invites.
 *
 * This module is deliberately PURE and dependency-free: no database, no
 * `new Date()`, no environment. Everything time-dependent is injected by the
 * caller (`now`, `sequence`), so the output is byte-for-byte reproducible and
 * unit-testable. That is the whole point of it existing separately from the
 * Google Calendar path in features/calendar/google-calendar.ts — a `.ics` file
 * needs no OAuth token, no third-party API and no network, so it cannot fail
 * the way that path has been failing.
 *
 * The two things almost every hand-rolled generator gets wrong, and which make
 * a file silently invalid in Outlook, are handled explicitly below:
 *   1. Line endings MUST be CRLF (RFC 5545 §3.1), including the final one.
 *   2. Lines longer than 75 OCTETS (not characters) MUST be folded, and a
 *      fold must never land inside a multi-octet UTF-8 sequence.
 */

/** RFC 5545 §3.1: content lines are delimited by CRLF, never bare LF. */
const CRLF = '\r\n'

/**
 * Control characters that cannot appear in a content line. CR and LF are
 * deliberately absent — those carry meaning and are converted, not dropped.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/**
 * RFC 5545 §3.1: "Lines of text SHOULD NOT be longer than 75 octets,
 * excluding the line break." Octets, not characters — an emoji in a meeting
 * title is four of these on its own.
 */
const MAX_LINE_OCTETS = 75

const PRODID = '-//LogPup//Meetings//EN'

/** Domain half of the UID. Not resolved or contacted — it only has to be stable. */
const UID_DOMAIN = 'logpup.app'

export type IcsPerson = {
  name?: string | null
  email: string
  /** ROLE=OPT-PARTICIPANT instead of the default REQ-PARTICIPANT. */
  optional?: boolean
}

export type IcsEventInput = {
  /** Stable per meeting — see `meetingIcsUid`. Same UID = update, not duplicate. */
  uid: string
  /**
   * RFC 5545 §3.8.7.4. MUST increase whenever a REQUEST is re-issued for a
   * changed event, or clients will ignore the update as stale. Injected rather
   * than derived here so this module stays clock-free.
   */
  sequence: number
  /** Generation time, injected. Becomes DTSTAMP. */
  now: Date
  title: string
  description?: string | null
  /** Physical location, or the video-call URL when there is no room. */
  location?: string | null
  /** Video-call link. Emitted as URL, and appended to DESCRIPTION for clients that ignore URL. */
  url?: string | null
  startsAt: Date
  endsAt: Date
  organizer: IcsPerson
  attendees: IcsPerson[]
}

/**
 * Stable UID for a meeting. Derived purely from the meeting's primary key, so
 * re-downloading the invite after an edit updates the existing event in the
 * attendee's calendar instead of adding a second copy of it.
 */
export function meetingIcsUid(meetingId: string): string {
  return `${meetingId}@${UID_DOMAIN}`
}

/**
 * RFC 5545 §3.3.5 (UTC date-time): `YYYYMMDDTHHMMSSZ`. Built from the UTC
 * getters rather than by slicing `toISOString()` so it is obvious that the
 * local timezone of whatever machine runs this can never leak in.
 */
export function formatIcsUtc(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0')
  return (
    pad(date.getUTCFullYear(), 4) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

/**
 * RFC 5545 §3.3.11 (TEXT): backslash, semicolon and comma are escaped, and a
 * literal newline becomes the two-character sequence `\n`. Backslash goes
 * first — escaping it after the others would double-escape the escapes we just
 * added. Control characters are stripped: they are not representable in a
 * content line and some parsers abort the whole file on one.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(CONTROL_CHARS, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * RFC 5545 §3.1 line folding. Splits a content line into runs of at most 75
 * octets, joined by CRLF + a single space. The space is itself part of the
 * continuation line and counts toward its 75, hence the 74-octet budget for
 * every chunk after the first.
 *
 * The fold point is walked back off any UTF-8 continuation byte (`10xxxxxx`)
 * so a multi-octet character is never sliced in half — the failure mode there
 * is a corrupt title rather than a rejected file, which is worse because it
 * looks like it worked.
 */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= MAX_LINE_OCTETS) return line

  const decoder = new TextDecoder()
  const chunks: string[] = []
  let offset = 0
  let budget = MAX_LINE_OCTETS

  while (offset < bytes.length) {
    let end = Math.min(offset + budget, bytes.length)
    while (end > offset + 1 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--
    chunks.push(decoder.decode(bytes.subarray(offset, end)))
    offset = end
    budget = MAX_LINE_OCTETS - 1
  }

  return chunks.join(CRLF + ' ')
}

/**
 * RFC 6868 §3.2 escaping for a quoted parameter value (used for CN). A double
 * quote cannot appear inside a quoted string at all, so it becomes `^'`.
 */
function quoteParam(value: string): string {
  const cleaned = value
    .replace(CONTROL_CHARS, '')
    .replace(/\^/g, '^^')
    .replace(/\n/g, '^n')
    .replace(/"/g, "^'")
  return `"${cleaned}"`
}

/** `ORGANIZER;CN="Ada":mailto:ada@example.com` */
function personLine(property: string, person: IcsPerson, extraParams: string[] = []): string {
  const params = [...extraParams]
  if (person.name) params.push(`CN=${quoteParam(person.name)}`)
  const prefix = params.length > 0 ? `${property};${params.join(';')}` : property
  return `${prefix}:mailto:${person.email}`
}

/**
 * Builds a complete VCALENDAR document with a single VEVENT and
 * `METHOD:REQUEST`, ready to be served as `text/calendar`.
 *
 * Throws on an event that cannot be represented (empty title, non-finite or
 * inverted times) rather than emitting a file that a calendar client will
 * quietly discard — a hard error here surfaces in a test or a 500, which is
 * findable, whereas a silently-ignored invite is exactly the class of bug this
 * whole module exists to end.
 */
export function buildIcs(input: IcsEventInput): string {
  if (!input.title.trim()) throw new Error('ICS event requires a title')
  if (!Number.isFinite(input.startsAt.getTime()) || !Number.isFinite(input.endsAt.getTime())) {
    throw new Error('ICS event requires valid start and end times')
  }
  if (input.endsAt.getTime() <= input.startsAt.getTime()) {
    throw new Error('ICS event must end after it starts')
  }

  const descriptionParts: string[] = []
  if (input.description?.trim()) descriptionParts.push(input.description.trim())
  if (input.url?.trim()) descriptionParts.push(`Join: ${input.url.trim()}`)
  const description = descriptionParts.join('\n\n')

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${formatIcsUtc(input.now)}`,
    `DTSTART:${formatIcsUtc(input.startsAt)}`,
    `DTEND:${formatIcsUtc(input.endsAt)}`,
    `SEQUENCE:${Math.max(0, Math.trunc(input.sequence))}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    `SUMMARY:${escapeIcsText(input.title.trim())}`,
  ]

  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`)
  if (input.location?.trim()) lines.push(`LOCATION:${escapeIcsText(input.location.trim())}`)
  if (input.url?.trim()) lines.push(`URL:${input.url.trim()}`)

  lines.push(personLine('ORGANIZER', input.organizer))
  for (const attendee of input.attendees) {
    lines.push(
      personLine('ATTENDEE', attendee, [
        'CUTYPE=INDIVIDUAL',
        attendee.optional ? 'ROLE=OPT-PARTICIPANT' : 'ROLE=REQ-PARTICIPANT',
        'PARTSTAT=NEEDS-ACTION',
        'RSVP=TRUE',
      ]),
    )
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  // Trailing CRLF included: RFC 5545 terminates every content line, the last
  // one too. Outlook is the client that notices when it is missing.
  return lines.map(foldIcsLine).join(CRLF) + CRLF
}

/**
 * A safe, recognisable download name: `standup-with-design.ics`. Anything that
 * is not alphanumeric collapses to a hyphen, so a title full of slashes or
 * quotes can never produce a path segment or break the Content-Disposition
 * header it ends up in.
 */
export function icsFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'meeting'}.ics`
}

export type CalendarLinkInput = {
  title: string
  description?: string | null
  location?: string | null
  url?: string | null
  startsAt: Date
  endsAt: Date
}

function linkDetails(input: CalendarLinkInput): string {
  const parts: string[] = []
  if (input.description?.trim()) parts.push(input.description.trim())
  if (input.url?.trim()) parts.push(`Join: ${input.url.trim()}`)
  return parts.join('\n\n')
}

/**
 * Google Calendar's "template" URL — a prefilled event-compose screen the user
 * saves themselves. No OAuth, no API, no scopes: it is a plain GET with query
 * parameters, which is why it works for every user regardless of how they
 * signed in to LogPup.
 */
export function googleCalendarUrl(input: CalendarLinkInput): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${formatIcsUtc(input.startsAt)}/${formatIcsUtc(input.endsAt)}`,
  })
  const details = linkDetails(input)
  if (details) params.set('details', details)
  if (input.location?.trim()) params.set('location', input.location.trim())
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Outlook.com / Office 365 "compose" deeplink. Same idea as the Google one:
 * pure query parameters, no auth handshake of ours involved.
 */
export function outlookCalendarUrl(
  input: CalendarLinkInput,
  variant: 'office365' | 'outlook-com' = 'office365',
): string {
  const host =
    variant === 'office365' ? 'https://outlook.office.com' : 'https://outlook.live.com'
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: input.title,
    startdt: input.startsAt.toISOString(),
    enddt: input.endsAt.toISOString(),
  })
  const details = linkDetails(input)
  if (details) params.set('body', details)
  if (input.location?.trim()) params.set('location', input.location.trim())
  return `${host}/calendar/0/deeplink/compose?${params.toString()}`
}
