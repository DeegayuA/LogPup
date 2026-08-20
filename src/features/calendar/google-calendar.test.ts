import { beforeEach, describe, expect, it, vi } from 'vitest'

// One shared spy standing in for events.patch. Declared through vi.hoisted so
// the vi.mock factory below — which is hoisted above every import — can close
// over it without a TDZ error.
const google = vi.hoisted(() => ({ patch: vi.fn() }))

vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: class { setCredentials() {} } },
    calendar: () => ({ events: { patch: google.patch } }),
  },
  calendar_v3: {},
}))

import {
  buildConferenceDataRequest,
  classifyCalendarError,
  describeCalendarError,
  extractMeetLink,
  sentenceFor,
  updateCalendarEvent,
  type CalendarErrorKey,
} from './google-calendar'

describe('buildConferenceDataRequest', () => {
  it('asks for a hangoutsMeet room keyed by the given requestId', () => {
    // `conferenceDataVersion=1` (a request-level, not requestBody-level,
    // parameter — see createCalendarEvent) is what actually makes Google
    // honour this fragment; this only asserts the fragment's own shape.
    expect(buildConferenceDataRequest('req-123')).toEqual({
      createRequest: {
        requestId: 'req-123',
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    })
  })

  it('carries a different requestId through unchanged, so retries stay idempotent', () => {
    // A retried insert of the *same* event with the same requestId returns
    // the same room instead of minting a second one — which only holds if
    // this function doesn't generate its own id.
    expect(buildConferenceDataRequest('req-abc').createRequest?.requestId).toBe('req-abc')
    expect(buildConferenceDataRequest('req-xyz').createRequest?.requestId).toBe('req-xyz')
  })
})

describe('extractMeetLink', () => {
  it('reads the flat hangoutLink convenience field when present', () => {
    expect(extractMeetLink({ hangoutLink: 'https://meet.google.com/abc-defg-hij' })).toBe(
      'https://meet.google.com/abc-defg-hij',
    )
  })

  it('falls back to the video entry point in conferenceData when hangoutLink is absent', () => {
    expect(
      extractMeetLink({
        conferenceData: {
          entryPoints: [
            { entryPointType: 'phone', uri: 'tel:+1-555-0100' },
            { entryPointType: 'video', uri: 'https://meet.google.com/xyz-uvwx-rst' },
          ],
        },
      }),
    ).toBe('https://meet.google.com/xyz-uvwx-rst')
  })

  it('prefers hangoutLink over conferenceData when both are present', () => {
    expect(
      extractMeetLink({
        hangoutLink: 'https://meet.google.com/from-hangout-link',
        conferenceData: {
          entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/from-entry-point' }],
        },
      }),
    ).toBe('https://meet.google.com/from-hangout-link')
  })

  it('returns null when the event has no conferencing at all — the common case for withMeet: false', () => {
    expect(extractMeetLink({})).toBeNull()
    expect(extractMeetLink({ conferenceData: {} })).toBeNull()
    expect(extractMeetLink({ conferenceData: { entryPoints: [] } })).toBeNull()
  })

  it('returns null when conferenceData has entry points but none of them are video', () => {
    expect(
      extractMeetLink({
        conferenceData: { entryPoints: [{ entryPointType: 'phone', uri: 'tel:+1-555-0100' }] },
      }),
    ).toBeNull()
  })
})

/** Builds a gaxios-shaped rejection the way googleapis actually throws it. */
function gaxiosError(opts: {
  code?: number
  message?: string
  errors?: { reason?: string }[]
  details?: { reason?: string }[]
}) {
  return {
    code: opts.code,
    message: opts.message ?? '',
    response: {
      data: {
        error: {
          code: opts.code,
          message: opts.message ?? '',
          errors: opts.errors,
          details: opts.details,
        },
      },
    },
  }
}

describe('describeCalendarError', () => {
  it('recognises a dead refresh token (invalid_grant) and points at reconnecting', () => {
    expect(describeCalendarError({ message: 'invalid_grant: Token has been expired or revoked.' })).toBe(
      'the organiser’s Google connection has expired — sign out and back in with Google to renew it',
    )
    expect(
      describeCalendarError({ response: { data: { error: 'invalid_grant' } } }),
    ).toBe('the organiser’s Google connection has expired — sign out and back in with Google to renew it')
  })

  it('tells the admin to enable the API when the Cloud project has never turned Calendar on', () => {
    // The exact shape a live call against a real refresh token returned:
    // reason lives at response.data.error.errors[0].reason (classic format)
    // — never on the error object itself.
    const error = gaxiosError({
      code: 403,
      message:
        'Google Calendar API has not been used in project 123 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=123 then retry.',
      errors: [{ reason: 'accessNotConfigured' }],
    })
    expect(describeCalendarError(error)).toBe(
      'the Google Calendar API is disabled for LogPup’s Google Cloud project — an admin needs to enable it in Google Cloud Console before Meet links can be created',
    )
  })

  it('also catches the disabled-API case via the ErrorInfo details[].reason shape', () => {
    const error = gaxiosError({
      code: 403,
      message: 'Cloud Console reports the service is off.',
      details: [{ reason: 'SERVICE_DISABLED' }],
    })
    expect(describeCalendarError(error)).toBe(
      'the Google Calendar API is disabled for LogPup’s Google Cloud project — an admin needs to enable it in Google Cloud Console before Meet links can be created',
    )
  })

  it('does NOT tell the user to re-consent for a disabled API — that would not fix it', () => {
    const error = gaxiosError({ code: 403, errors: [{ reason: 'accessNotConfigured' }] })
    expect(describeCalendarError(error)).not.toMatch(/sign in with Google again/)
  })

  it('recognises a genuinely insufficient scope and asks the user to re-consent', () => {
    const error = gaxiosError({ code: 403, errors: [{ reason: 'insufficientPermissions' }] })
    expect(describeCalendarError(error)).toBe(
      'LogPup was not granted Google Calendar access — sign in with Google again and tick the Calendar permission',
    )
  })

  it('also recognises insufficient scope from the bare message text', () => {
    const error = gaxiosError({ code: 403, message: 'Request had insufficient authentication scopes.' })
    expect(describeCalendarError(error)).toBe(
      'LogPup was not granted Google Calendar access — sign in with Google again and tick the Calendar permission',
    )
  })

  it('falls back to the scope message for an unrecognised 403, same as before', () => {
    const error = gaxiosError({ code: 403, message: 'Forbidden' })
    expect(describeCalendarError(error)).toBe(
      'LogPup was not granted Google Calendar access — sign in with Google again and tick the Calendar permission',
    )
  })

  it('recognises bad client credentials', () => {
    expect(describeCalendarError({ code: 401 })).toBe('Google rejected LogPup’s credentials')
    expect(describeCalendarError({ response: { data: { error: 'invalid_client' } } })).toBe(
      'Google rejected LogPup’s credentials',
    )
  })

  it('recognises a deleted-upstream event', () => {
    expect(describeCalendarError({ code: 404 })).toBe('the event no longer exists in Google Calendar')
  })

  it('recognises a Google-side outage', () => {
    expect(describeCalendarError({ code: 503 })).toBe('Google Calendar is unavailable right now')
  })

  it('falls back to a generic refusal for anything unrecognised', () => {
    expect(describeCalendarError({})).toBe('Google Calendar refused the request')
    expect(describeCalendarError(new Error('boom'))).toBe('Google Calendar refused the request')
    expect(describeCalendarError(null)).toBe('Google Calendar refused the request')
  })

  it('never echoes anything derived from the token', () => {
    const secretLookingToken = '1//09-SUPER-SECRET-REFRESH-TOKEN-abcdEFGH'
    const error = { message: `refresh failed for ${secretLookingToken}`, code: 400 }
    expect(describeCalendarError(error)).not.toContain(secretLookingToken)
  })
})

describe('classifyCalendarError', () => {
  // The ladder used to exist only as sentences, so nothing could record WHY a
  // calendar write failed without storing an English paragraph. These pin the
  // keys; the describeCalendarError suite above already pins the sentences,
  // and both must keep agreeing.
  it.each([
    ['a dead refresh token', { message: 'invalid_grant: Token has been expired or revoked.' }, 'invalid_grant'],
    ['the OAuth body form', { response: { data: { error: 'invalid_grant' } } }, 'invalid_grant'],
    ['a disabled Calendar API, classic format', { code: 403, response: { data: { error: { errors: [{ reason: 'accessNotConfigured' }] } } } }, 'api_disabled'],
    ['a disabled Calendar API, ErrorInfo format', { code: 403, response: { data: { error: { details: [{ reason: 'SERVICE_DISABLED' }] } } } }, 'api_disabled'],
    ['an unticked Calendar checkbox', { code: 403 }, 'insufficient_scope'],
    ['rejected credentials', { code: 401 }, 'bad_credentials'],
    ['an event already gone', { code: 404 }, 'not_found'],
    ['Google being down', { code: 503 }, 'unavailable'],
    ['anything else', {}, 'refused'],
  ] as const)('classifies %s', (_label, error, key) => {
    expect(classifyCalendarError(error)).toBe(key)
  })

  it('checks the disabled-API 403 before the generic 403, since both are 403s', () => {
    // Order is load-bearing: only one of the two is fixed by re-consenting,
    // and telling someone to re-consent for a disabled API sends them round a
    // loop that cannot possibly work.
    const disabled = { code: 403, response: { data: { error: { errors: [{ reason: 'accessNotConfigured' }] } } } }
    expect(classifyCalendarError(disabled)).toBe('api_disabled')
    expect(classifyCalendarError(disabled)).not.toBe('insufficient_scope')
  })
})

describe('sentenceFor', () => {
  it('has a sentence for every key, so no classification renders as blank', () => {
    const keys: CalendarErrorKey[] = [
      'invalid_grant',
      'api_disabled',
      'insufficient_scope',
      'bad_credentials',
      'not_found',
      'unavailable',
      'refused',
    ]
    for (const key of keys) {
      expect(sentenceFor(key)).toBeTruthy()
    }
  })

  it('is what describeCalendarError now returns, for every caller unchanged', () => {
    const error = { code: 404 }
    expect(describeCalendarError(error)).toBe(sentenceFor(classifyCalendarError(error)))
  })
})

describe('updateCalendarEvent', () => {
  beforeEach(() => google.patch.mockReset())

  const base = {
    refreshToken: 'tok',
    eventId: 'evt-1',
    title: 'Sprint 14 check-in',
    agenda: 'Migration journal',
    startsAt: new Date('2026-08-20T09:30:00Z'),
    endsAt: new Date('2026-08-20T10:11:00Z'),
    attendeeEmails: [
      { email: 'a@example.com', optional: false },
      { email: 'b@example.com', optional: true },
    ],
  }

  it('patches rather than replaces, so the Meet room survives', async () => {
    await updateCalendarEvent({ ...base, notify: true })
    // The body carries no conferenceData. Through events.update that would
    // DROP the Meet room — the one field on the event LogPup cannot rebuild,
    // because Google mints it and it exists only as a property of the event.
    const body = google.patch.mock.calls[0][0].requestBody
    expect(body.conferenceData).toBeUndefined()
    expect(google.patch).toHaveBeenCalledTimes(1)
  })

  it('sends the whole roster, never a delta', async () => {
    await updateCalendarEvent({ ...base, notify: true })
    // Google replaces the attendee list wholesale and silently drops anyone
    // omitted, so a delta send un-invites people nobody chose to un-invite.
    expect(google.patch.mock.calls[0][0].requestBody.attendees).toEqual([
      { email: 'a@example.com', optional: false },
      { email: 'b@example.com', optional: true },
    ])
  })

  it('emails guests when the time or roster moved', async () => {
    await updateCalendarEvent({ ...base, notify: true })
    expect(google.patch.mock.calls[0][0].sendUpdates).toBe('all')
  })

  it('stays silent for a title or agenda edit', async () => {
    // A studio that gets a Google email every time someone fixes a typo in an
    // agenda mutes the calendar — and Google's invite mail is the only channel
    // in this product that reliably reaches anyone.
    await updateCalendarEvent({ ...base, notify: false })
    expect(google.patch.mock.calls[0][0].sendUpdates).toBe('none')
  })

  it('carries the title and agenda a guest actually reads', async () => {
    await updateCalendarEvent({ ...base, notify: false })
    const body = google.patch.mock.calls[0][0].requestBody
    expect(body.summary).toBe('Sprint 14 check-in')
    expect(body.description).toBe('Migration journal')
  })
})
