import { describe, expect, it } from 'vitest'
import { buildConferenceDataRequest, describeCalendarError, extractMeetLink } from './google-calendar'

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
