import { google } from 'googleapis'

function client(refreshToken: string) {
  const oauth2 = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  )
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.calendar({ version: 'v3', auth: oauth2 })
}

export async function createCalendarEvent(opts: {
  refreshToken: string
  title: string
  agenda?: string
  startsAt: Date
  endsAt: Date
  attendeeEmails: string[]
}): Promise<{ eventId: string }> {
  const res = await client(opts.refreshToken).events.insert({
    calendarId: 'primary',
    sendUpdates: 'all',
    requestBody: {
      summary: opts.title,
      description: opts.agenda,
      start: { dateTime: opts.startsAt.toISOString() },
      end: { dateTime: opts.endsAt.toISOString() },
      attendees: opts.attendeeEmails.map((email) => ({ email })),
    },
  })
  return { eventId: res.data.id! }
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
 * The two reasons that actually happen with an unverified Google Cloud app
 * requesting the sensitive `calendar.events` scope:
 *
 *   invalid_grant — the refresh token is dead. A project still in "Testing"
 *     publishing status has its refresh tokens expired by Google after 7 days,
 *     so a token that was issued correctly stops working a week later. Also
 *     covers a grant revoked from the user's Google account page.
 *   insufficient scopes / 403 — consent was given, but not for Calendar.
 *     Google's granular consent screen lets someone approve sign-in while
 *     leaving the Calendar checkbox unticked, which yields a perfectly valid
 *     token that cannot touch the calendar.
 *
 * Never returns anything derived from the token itself.
 */
export function describeCalendarError(error: unknown): string {
  const e = error as
    | {
        code?: unknown
        status?: unknown
        message?: unknown
        response?: { data?: { error?: unknown; error_description?: unknown } }
        errors?: { reason?: unknown }[]
      }
    | undefined

  const oauthError = typeof e?.response?.data?.error === 'string' ? e.response.data.error : ''
  const message = typeof e?.message === 'string' ? e.message : ''
  const status = typeof e?.code === 'number' ? e.code : typeof e?.status === 'number' ? e.status : 0
  const reason = e?.errors?.[0]?.reason

  if (oauthError === 'invalid_grant' || message.includes('invalid_grant')) {
    return 'the organiser’s Google connection has expired — sign out and back in with Google to renew it'
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
