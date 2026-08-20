import { google, calendar_v3 } from 'googleapis'

function client(refreshToken: string) {
  const oauth2 = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  )
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.calendar({ version: 'v3', auth: oauth2 })
}

/**
 * The `conferenceData` fragment that asks Google to mint a Meet room, keyed
 * by `requestId` so a retried insert with the same id returns the same room
 * instead of minting a second one. Pulled out as a pure function (rather than
 * inlined in the request body below) purely so the shape can be asserted in
 * a test without an actual network call.
 */
export function buildConferenceDataRequest(requestId: string): calendar_v3.Schema$ConferenceData {
  return {
    createRequest: {
      requestId,
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    },
  }
}

/**
 * Reads the Meet link back off a created/patched event. `hangoutLink` is the
 * flat convenience copy; the `entryPoints` walk is the documented location.
 * Both are checked because Google has moved this between the two across API
 * revisions. Pulled out as a pure function so the read-back logic is
 * testable against a handful of representative event shapes without a live
 * Calendar event to point it at.
 */
export function extractMeetLink(event: calendar_v3.Schema$Event): string | null {
  return (
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri ??
    null
  )
}

export async function createCalendarEvent(opts: {
  refreshToken: string
  title: string
  agenda?: string
  startsAt: Date
  endsAt: Date
  // `optional` is a real, visible invite property (see meeting_attendees.optional)
  // — carried straight through to Google's own `optional` attendee field,
  // same as it's carried to the .ics ROLE parameter in features/meetings/ics.ts.
  attendeeEmails: { email: string; optional: boolean }[]
  /**
   * Ask Google to attach a Meet room to the event. A Meet link cannot be
   * minted on its own — it exists only as a property of a Calendar event —
   * which is why "create a Meet link" in the form is a request carried by the
   * save rather than an immediate fetch (an immediate fetch would need a
   * throwaway event that outlives a cancelled form).
   */
  withMeet?: boolean
}): Promise<{ eventId: string; meetLink: string | null }> {
  const res = await client(opts.refreshToken).events.insert({
    calendarId: 'primary',
    sendUpdates: 'all',
    // Must be 1 for conferenceData to be honoured — at the default 0, Google
    // silently strips it from the request, which reads as "Meet just doesn't
    // work" with no error anywhere.
    conferenceDataVersion: opts.withMeet ? 1 : 0,
    requestBody: {
      summary: opts.title,
      description: opts.agenda,
      start: { dateTime: opts.startsAt.toISOString() },
      end: { dateTime: opts.endsAt.toISOString() },
      attendees: opts.attendeeEmails.map(({ email, optional }) => ({ email, optional })),
      ...(opts.withMeet
        ? { conferenceData: buildConferenceDataRequest(crypto.randomUUID()) }
        : {}),
    },
  })
  return { eventId: res.data.id!, meetLink: extractMeetLink(res.data) }
}

/**
 * Moves an already-created event to a new time window. `events.patch`, not
 * `events.update`: only start/end are sent, so the summary, description and
 * attendee list already on the event survive untouched. `sendUpdates: 'all'`
 * re-notifies the invitees, which is the entire point of a reschedule.
 */
export async function updateCalendarEventTime(opts: {
  refreshToken: string
  eventId: string
  startsAt: Date
  endsAt: Date
}): Promise<void> {
  await client(opts.refreshToken).events.patch({
    calendarId: 'primary',
    eventId: opts.eventId,
    sendUpdates: 'all',
    requestBody: {
      start: { dateTime: opts.startsAt.toISOString() },
      end: { dateTime: opts.endsAt.toISOString() },
    },
  })
}

/**
 * The FULL patch — everything a guest can see, not just the time.
 *
 * updateCalendarEventTime above sends start/end only, deliberately. That left
 * a hole nothing closed: rename a meeting, rewrite its agenda, add four
 * people, and twenty calendars keep the old title, the old agenda and the old
 * roster forever, with no signal on either side. The LogPup row and the invite
 * guests actually read diverge permanently.
 *
 * Three rules, each preventing a specific loss:
 *
 * - `patch`, NEVER `update`. events.update REPLACES the resource, so a body
 *   without `conferenceData` drops the Meet room — the one field on the event
 *   that cannot be reconstructed from LogPup, because the room is minted by
 *   Google and exists only as a property of the event.
 *
 * - The attendee array REPLACES the whole list, so it must always be built
 *   from the current roster, never as a delta. Google preserves
 *   `responseStatus` for attendees whose email is unchanged and starts new
 *   ones at `needsAction`; a delta send silently drops everyone omitted.
 *
 * - `sendUpdates` is a decision, not a default. 'all' when the time or the
 *   roster changed — the two facts a person needs in their inbox. 'none' when
 *   only the title or agenda moved: the entry on their calendar updates
 *   silently, which is the correct outcome. A twenty-person studio that gets a
 *   Google email every time somebody fixes a typo in an agenda mutes the
 *   calendar, and Google's invite mail is currently the only channel in this
 *   product that reliably reaches anyone.
 */
export async function updateCalendarEvent(opts: {
  refreshToken: string
  eventId: string
  title: string
  agenda?: string
  startsAt: Date
  endsAt: Date
  /** The CURRENT roster in full — see the delta warning above. */
  attendeeEmails: { email: string; optional: boolean }[]
  /**
   * Whether this edit changed the time or the roster. Drives `sendUpdates`,
   * and is the caller's to decide because only the caller knows what moved.
   */
  notify: boolean
}): Promise<void> {
  await client(opts.refreshToken).events.patch({
    calendarId: 'primary',
    eventId: opts.eventId,
    sendUpdates: opts.notify ? 'all' : 'none',
    requestBody: {
      summary: opts.title,
      description: opts.agenda,
      start: { dateTime: opts.startsAt.toISOString() },
      end: { dateTime: opts.endsAt.toISOString() },
      attendees: opts.attendeeEmails.map(({ email, optional }) => ({ email, optional })),
    },
  })
}

/**
 * Turns a googleapis failure into one short, plain sentence a person can act
 * on. Until this existed the whole path was a bare `catch {}` — the meeting
 * saved, the invite silently did not, and the reason was never written down
 * anywhere, which is why "calendar invite failed" survived so many attempts to
 * fix it.
 *
 * Three reasons actually happen, and they need three different fixes — so
 * they must not collapse into the same message:
 *
 *   invalid_grant — the refresh token is dead. A project still in "Testing"
 *     publishing status has its refresh tokens expired by Google after 7 days,
 *     so a token that was issued correctly stops working a week later. Also
 *     covers a grant revoked from the user's Google account page. Fixed by
 *     the user re-connecting Google.
 *   accessNotConfigured / SERVICE_DISABLED — the token and scope are both
 *     fine, but nobody has ever turned the Calendar API on for this Google
 *     Cloud project. Also a 403, but re-consenting does nothing for it — only
 *     an admin flipping it on in Cloud Console does. Caught this in a live
 *     test against a real refresh token: googleapis reports it via
 *     `response.data.error.errors[0].reason` (classic format) *and*
 *     `response.data.error.details[].reason` (ErrorInfo format), never on
 *     the error object itself.
 *   insufficient scopes / 403 — consent was given, but not for Calendar.
 *     Google's granular consent screen lets someone approve sign-in while
 *     leaving the Calendar checkbox unticked, which yields a perfectly valid
 *     token that cannot touch the calendar. Fixed by re-consenting.
 *
 * Never returns anything derived from the token itself.
 */
export type CalendarErrorKey =
  | 'invalid_grant'
  | 'api_disabled'
  | 'insufficient_scope'
  | 'bad_credentials'
  | 'not_found'
  | 'unavailable'
  | 'refused'

/**
 * The same diagnostic ladder, returning a KEY instead of a sentence.
 *
 * Split out because a failure needs to be RECORDED as well as shown, and a
 * sentence written at failure time is a permanent decision about a reader
 * whose language is not known until read time — LogPup's surfaces are
 * bilingual Sinhala + English. A key survives that; a rendered English string
 * does not. Same reason notifications store a title key rather than a title.
 *
 * describeCalendarError keeps its exported name, its signature and every one
 * of its callers: it is now sentenceFor(classifyCalendarError(error)). The
 * ladder itself — including which branch is checked before which, and why —
 * moved here unchanged.
 */
export function classifyCalendarError(error: unknown): CalendarErrorKey {
  const e = error as
    | {
        code?: unknown
        status?: unknown
        message?: unknown
        response?: {
          data?: {
            error?:
              | string
              | { errors?: { reason?: unknown }[]; details?: { reason?: unknown }[] }
            error_description?: unknown
          }
        }
      }
    | undefined

  const responseError = e?.response?.data?.error
  const oauthError = typeof responseError === 'string' ? responseError : ''
  const message = typeof e?.message === 'string' ? e.message : ''
  const status = typeof e?.code === 'number' ? e.code : typeof e?.status === 'number' ? e.status : 0
  // googleapis nests the actual failure reason inside response.data.error —
  // never on the error object itself, despite that being where an earlier
  // version of this function looked, which meant this check could never
  // match a real response and every 403 fell through to the generic
  // "insufficient scopes" message below regardless of its real cause.
  const nestedError = typeof responseError === 'object' ? responseError : undefined
  const reason = nestedError?.errors?.[0]?.reason
  const detailReason = nestedError?.details?.[0]?.reason

  if (oauthError === 'invalid_grant' || message.includes('invalid_grant')) {
    return 'invalid_grant'
  }
  // Checked before the generic 403 branch below: both are 403s, but only one
  // of them is fixed by re-consenting.
  if (
    reason === 'accessNotConfigured' ||
    detailReason === 'SERVICE_DISABLED' ||
    message.toLowerCase().includes('has not been used in project') ||
    message.toLowerCase().includes('it is disabled')
  ) {
    return 'api_disabled'
  }
  if (
    status === 403 ||
    reason === 'insufficientPermissions' ||
    message.toLowerCase().includes('insufficient authentication scopes')
  ) {
    return 'insufficient_scope'
  }
  if (status === 401 || oauthError === 'invalid_client') {
    return 'bad_credentials'
  }
  if (status === 404) return 'not_found'
  if (status >= 500) return 'unavailable'
  return 'refused'
}

const CALENDAR_ERROR_SENTENCES: Record<CalendarErrorKey, string> = {
  invalid_grant:
    'the organiser’s Google connection has expired — sign out and back in with Google to renew it',
  api_disabled:
    'the Google Calendar API is disabled for LogPup’s Google Cloud project — an admin needs to enable it in Google Cloud Console before Meet links can be created',
  insufficient_scope:
    'LogPup was not granted Google Calendar access — sign in with Google again and tick the Calendar permission',
  bad_credentials: 'Google rejected LogPup’s credentials',
  not_found: 'the event no longer exists in Google Calendar',
  unavailable: 'Google Calendar is unavailable right now',
  refused: 'Google Calendar refused the request',
}

/** The English sentence for a classification. */
export function sentenceFor(key: CalendarErrorKey): string {
  return CALENDAR_ERROR_SENTENCES[key]
}

/**
 * Unchanged for every caller: same name, same signature, same sentences.
 * Only the return type gained a sibling.
 */
export function describeCalendarError(error: unknown): string {
  return sentenceFor(classifyCalendarError(error))
}

export async function deleteCalendarEvent(refreshToken: string, eventId: string): Promise<void> {
  await client(refreshToken).events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all',
  })
}
