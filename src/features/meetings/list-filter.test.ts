import { describe, it, expect } from 'vitest'
import { matchesListFilter, parseListFilter, type ListFilter } from './list-filter'
import type { AttendeeResponse } from '@/features/meetings/components/meeting-glance'
import type { MeetingGlance } from '@/features/meetings/components/meeting-notes-model'

const VIEWER = 'viewer-1'

function attendee(id: string, response: AttendeeResponse) {
  return { id, response }
}

function meeting(...attendees: { id: string; response: AttendeeResponse }[]) {
  return { attendees }
}

function glance(overrides: Partial<MeetingGlance> = {}): MeetingGlance {
  return {
    hasNotes: true,
    analyzedAt: null,
    actions: 0,
    overdueActions: 0,
    openFollowups: 0,
    staleFollowups: 0,
    questions: 0,
    nextMeetingAt: null,
    ...overrides,
  }
}

describe('parseListFilter', () => {
  it('accepts each of the four filters the tiles write', () => {
    const filters: ListFilter[] = ['waiting', 'overdue', 'followups', 'questions']
    for (const filter of filters) expect(parseListFilter(filter)).toBe(filter)
  })

  it('treats an absent param as no filter', () => {
    expect(parseListFilter(null)).toBeNull()
  })

  it('treats an empty param as no filter', () => {
    expect(parseListFilter('')).toBeNull()
  })

  it('degrades an unknown value to no filter rather than an empty list', () => {
    // "stuck" is a row chip, not a filter — the grammar must reject it.
    expect(parseListFilter('stuck')).toBeNull()
    expect(parseListFilter('rsvp')).toBeNull()
  })

  it('is exact-match: the app never writes mixed case, so mixed case is a stale URL', () => {
    expect(parseListFilter('Waiting')).toBeNull()
    expect(parseListFilter('OVERDUE')).toBeNull()
  })
})

describe('matchesListFilter — waiting', () => {
  it('matches when the viewer is invited and has not answered', () => {
    const m = meeting(attendee(VIEWER, 'pending'), attendee('other', 'going'))
    expect(matchesListFilter('waiting', m, VIEWER, undefined)).toBe(true)
  })

  it('does not match once the viewer has answered, whatever the answer', () => {
    for (const response of ['going', 'maybe', 'declined'] as const) {
      expect(matchesListFilter('waiting', meeting(attendee(VIEWER, response)), VIEWER, undefined)).toBe(
        false,
      )
    }
  })

  it('does not match when the viewer is not invited, even if others are pending', () => {
    const m = meeting(attendee('other-1', 'pending'), attendee('other-2', 'pending'))
    expect(matchesListFilter('waiting', m, VIEWER, undefined)).toBe(false)
  })

  it('does not match a meeting with no attendees at all', () => {
    expect(matchesListFilter('waiting', meeting(), VIEWER, undefined)).toBe(false)
  })

  it('answers synchronously — the glance argument is irrelevant in every state', () => {
    const m = meeting(attendee(VIEWER, 'pending'))
    expect(matchesListFilter('waiting', m, VIEWER, undefined)).toBe(true)
    expect(matchesListFilter('waiting', m, VIEWER, null)).toBe(true)
    expect(matchesListFilter('waiting', m, VIEWER, glance())).toBe(true)
  })
})

describe('matchesListFilter — glance-backed tri-state', () => {
  const glanceFilters: ListFilter[] = ['overdue', 'followups', 'questions']
  const everything = glance({ overdueActions: 2, openFollowups: 3, questions: 4 })

  it('a pending glance (undefined) never matches — the batch is still counting', () => {
    for (const filter of glanceFilters) {
      expect(matchesListFilter(filter, meeting(), VIEWER, undefined)).toBe(false)
    }
  })

  it('a null glance never matches — asked, nothing to show (or permission-denied)', () => {
    for (const filter of glanceFilters) {
      expect(matchesListFilter(filter, meeting(), VIEWER, null)).toBe(false)
    }
  })

  it('a resolved glance matches on its own counts', () => {
    for (const filter of glanceFilters) {
      expect(matchesListFilter(filter, meeting(), VIEWER, everything)).toBe(true)
    }
  })

  it('overdue reads overdueActions and nothing else', () => {
    expect(matchesListFilter('overdue', meeting(), VIEWER, glance({ overdueActions: 1 }))).toBe(true)
    expect(
      matchesListFilter('overdue', meeting(), VIEWER, glance({ openFollowups: 5, questions: 5 })),
    ).toBe(false)
  })

  it('followups reads openFollowups and nothing else', () => {
    expect(matchesListFilter('followups', meeting(), VIEWER, glance({ openFollowups: 1 }))).toBe(true)
    expect(
      matchesListFilter('followups', meeting(), VIEWER, glance({ overdueActions: 5, questions: 5 })),
    ).toBe(false)
  })

  it('questions reads questions and nothing else', () => {
    expect(matchesListFilter('questions', meeting(), VIEWER, glance({ questions: 1 }))).toBe(true)
    expect(
      matchesListFilter('questions', meeting(), VIEWER, glance({ overdueActions: 5, openFollowups: 5 })),
    ).toBe(false)
  })

  it('ignores the viewer entirely — glance counts are meeting facts, not viewer facts', () => {
    const m = meeting(attendee(VIEWER, 'pending'))
    expect(matchesListFilter('overdue', m, VIEWER, glance())).toBe(false)
  })
})
