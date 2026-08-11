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

export async function deleteCalendarEvent(refreshToken: string, eventId: string): Promise<void> {
  await client(refreshToken).events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all',
  })
}
