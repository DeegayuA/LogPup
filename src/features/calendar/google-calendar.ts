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
export function describeCalendarError(error: unknown): string {
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
    return 'the organiser’s Google connection has expired — sign out and back in with Google to renew it'
  }
  // Checked before the generic 403 branch below: both are 403s, but only one
  // of them is fixed by re-consenting.
  if (
    reason === 'accessNotConfigured' ||
    detailReason === 'SERVICE_DISABLED' ||
    message.toLowerCase().includes('has not been used in project') ||
    message.toLowerCase().includes('it is disabled')
  ) {
    return 'the Google Calendar API is disabled for LogPup’s Google Cloud project — an admin needs to enable it in Google Cloud Console before Meet links can be created'
  }
  if (
    status === 403 ||
    reason === 'insufficientPermissions' ||
    message.toLowerCase().includes('insufficient authentication scopes')
  ) {
    return 'LogPup was not granted Google Calendar access — sign in with Google again and tick the Calendar permission'
  }
  if (status === 401 || oauthError === 'invalid_client') {
    return 'Google rejected LogPup’s credentials'
  }
  if (status === 404) return 'the event no longer exists in Google Calendar'
  if (status >= 500) return 'Google Calendar is unavailable right now'
  return 'Google Calendar refused the request'
}

export async function deleteCalendarEvent(refreshToken: string, eventId: string): Promise<void> {
  await client(refreshToken).events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all',
  })
}
