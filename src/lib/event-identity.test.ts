import { describe, expect, it } from 'vitest'

import {
  REASON_SENTENCE,
  attendeeOverlap,
  canAutoMerge,
  identifyEvent,
  normaliseTitle,
  titleSimilarity,
  type CandidateEvent,
  type CandidateMeeting,
  type IdentityReason,
} from './event-identity'

const AT = Date.UTC(2026, 7, 19, 9, 0) // Wed 19 Aug 2026, 09:00Z
const HOUR = 60 * 60 * 1000

const meeting = (over: Partial<CandidateMeeting> = {}): CandidateMeeting => ({
  title: 'Kestrel weekly sync',
  startsAtMs: AT,
  endsAtMs: AT + HOUR,
  attendeeEmails: ['nimal@example.test', 'shanika@example.test'],
  ...over,
})

const event = (over: Partial<CandidateEvent> = {}): CandidateEvent => ({
  eventId: 'gcal-1',
  title: 'Kestrel weekly sync',
  startsAtMs: AT,
  endsAtMs: AT + HOUR,
  attendeeEmails: ['nimal@example.test', 'shanika@example.test'],
  ...over,
})

describe('a confirmed link outranks every heuristic', () => {
  it('is the same event when the id is among the known links', () => {
    expect(identifyEvent(meeting(), event(), ['gcal-1'])).toEqual({
      verdict: 'same',
      reason: 'linked',
    })
  })

  it('holds the link even when nothing else agrees', () => {
    // Renamed, moved by a week, different people — an entirely ordinary edit.
    // A heuristic must never overturn a fact somebody established.
    const id = identifyEvent(
      meeting(),
      event({
        title: 'Something else entirely',
        startsAtMs: AT + 7 * 24 * HOUR,
        endsAtMs: AT + 7 * 24 * HOUR + HOUR,
        attendeeEmails: ['nobody@example.test'],
      }),
      ['gcal-1'],
    )
    expect(id.verdict).toBe('same')
  })

  it('is different when the meeting is linked to some OTHER event', () => {
    expect(identifyEvent(meeting(), event({ eventId: 'gcal-2' }), ['gcal-1'])).toEqual({
      verdict: 'different',
      reason: 'linked-elsewhere',
    })
  })

  it('accepts several links, since one meeting can be seen from two accounts', () => {
    expect(
      identifyEvent(meeting(), event({ eventId: 'gcal-2' }), ['gcal-1', 'gcal-2']).verdict,
    ).toBe('same')
  })
})

describe('time gates everything', () => {
  it('treats a few minutes of drift as the same slot', () => {
    expect(identifyEvent(meeting(), event({ startsAtMs: AT + 4 * 60 * 1000 })).verdict).toBe('same')
  })

  it('calls a different hour a different meeting, however identical the title', () => {
    expect(identifyEvent(meeting(), event({ startsAtMs: AT + 3 * HOUR }))).toEqual({
      verdict: 'different',
      reason: 'different-time',
    })
  })

  it('separates two occurrences of the same weekly series', () => {
    // THE case the time gate exists for: next week's stand-up is identical in
    // every respect except when it happens.
    const nextWeek = AT + 7 * 24 * HOUR
    expect(
      identifyEvent(meeting(), event({ startsAtMs: nextWeek, endsAtMs: nextWeek + HOUR })).verdict,
    ).toBe('different')
  })
})

describe('same slot, and what the other signals say', () => {
  it('merges on a matching title with nothing objecting', () => {
    expect(identifyEvent(meeting(), event())).toEqual({
      verdict: 'same',
      reason: 'title-and-slot',
    })
  })

  it('ignores a reply prefix and punctuation', () => {
    expect(identifyEvent(meeting(), event({ title: 'Re: Kestrel — weekly sync!' })).verdict).toBe(
      'same',
    )
  })

  it('will not decide when the durations disagree materially', () => {
    // Fifteen minutes where we expected an hour: possibly a different booking
    // that happens to start together.
    expect(identifyEvent(meeting(), event({ endsAtMs: AT + 15 * 60 * 1000 }))).toEqual({
      verdict: 'uncertain',
      reason: 'duration-gap',
    })
  })

  it('will not decide when the same title shares nobody', () => {
    expect(
      identifyEvent(meeting(), event({ attendeeEmails: ['someone@other.test', 'else@other.test'] })),
    ).toEqual({ verdict: 'uncertain', reason: 'no-attendee-overlap' })
  })

  it('still merges when one side lists no attendees at all', () => {
    // Absence of evidence: an empty roster is common and must not read as
    // disagreement, or every uninvited meeting looks like a different one.
    expect(identifyEvent(meeting(), event({ attendeeEmails: [] })).verdict).toBe('same')
  })

  it('asks rather than decides when titles are partly alike', () => {
    // "Kestrel weekly sync" vs "Kestrel weekly review": two of three tokens
    // shared, which scores 0.5 — above the weak threshold and below the strong
    // one. Exactly the band where a rename and a coincidence are
    // indistinguishable, so the answer is a question.
    expect(identifyEvent(meeting(), event({ title: 'Kestrel weekly review' }))).toEqual({
      verdict: 'uncertain',
      reason: 'weak-title',
    })
  })

  it('falls through to the people when the titles barely overlap', () => {
    // "Kestrel design review" shares only "kestrel" — 1 of 5 tokens, 0.2 —
    // which is below the weak threshold, so the attendees decide that this is
    // worth asking about rather than the words.
    expect(identifyEvent(meeting(), event({ title: 'Kestrel design review' }))).toEqual({
      verdict: 'uncertain',
      reason: 'attendees-only',
    })
  })

  it('asks when the people match but the words do not', () => {
    expect(identifyEvent(meeting(), event({ title: 'Budget call' }))).toEqual({
      verdict: 'uncertain',
      reason: 'attendees-only',
    })
  })

  it('is different when only the start time coincides', () => {
    expect(
      identifyEvent(meeting(), event({ title: 'Budget call', attendeeEmails: ['x@other.test'] })),
    ).toEqual({ verdict: 'different', reason: 'no-signal' })
  })
})

describe('only a certainty merges silently', () => {
  it('permits same and refuses everything else', () => {
    expect(canAutoMerge({ verdict: 'same', reason: 'linked' })).toBe(true)
    expect(canAutoMerge({ verdict: 'uncertain', reason: 'weak-title' })).toBe(false)
    expect(canAutoMerge({ verdict: 'different', reason: 'no-signal' })).toBe(false)
  })

  it('has a sentence for every reason, so an uncertain match can be explained', () => {
    const reasons: IdentityReason[] = [
      'linked',
      'linked-elsewhere',
      'different-time',
      'title-and-slot',
      'duration-gap',
      'no-attendee-overlap',
      'weak-title',
      'attendees-only',
      'no-signal',
    ]
    for (const reason of reasons) expect(REASON_SENTENCE[reason]).toBeTruthy()
    expect(Object.keys(REASON_SENTENCE).sort()).toEqual([...reasons].sort())
  })
})

describe('the scoring helpers', () => {
  it('normalises across scripts, not just ASCII', () => {
    // A Sinhala title must survive normalisation with its letters intact.
    expect(normaliseTitle('සති සමාලෝචනය!')).toBe('සති සමාලෝචනය')
    expect(normaliseTitle('Re: Weekly — Sync ✅')).toBe('weekly sync')
  })

  it('scores title similarity regardless of word order', () => {
    expect(titleSimilarity('Kestrel weekly sync', 'Weekly sync Kestrel')).toBe(1)
  })

  it('scores an empty title as no evidence rather than a match', () => {
    expect(titleSimilarity('', 'anything')).toBe(0)
  })

  it('returns null overlap when either roster is empty', () => {
    expect(attendeeOverlap([], ['a@x.test'])).toBeNull()
    expect(attendeeOverlap(['a@x.test'], [])).toBeNull()
  })

  it('measures overlap against the smaller roster and ignores case', () => {
    expect(attendeeOverlap(['A@x.test'], ['a@x.test', 'b@x.test'])).toBe(1)
    expect(attendeeOverlap(['a@x.test', 'b@x.test'], ['a@x.test', 'c@x.test'])).toBe(0.5)
  })
})
