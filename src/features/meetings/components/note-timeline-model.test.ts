import { describe, it, expect } from 'vitest'
import {
  buildSuggestionUpdatePayload,
  buildTaskUpdatePayload,
  classifyDueDateInput,
  findDueDateHint,
  resolveActionItemEditTarget,
} from './note-timeline-model'

describe('resolveActionItemEditTarget', () => {
  it('routes an open suggestion to itself', () => {
    expect(
      resolveActionItemEditTarget({ id: 'sug-1', status: 'open', createdTaskId: null }),
    ).toEqual({ kind: 'suggestion', id: 'sug-1' })
  })

  it('routes an accepted (auto-assigned) suggestion to its created task', () => {
    expect(
      resolveActionItemEditTarget({ id: 'sug-1', status: 'accepted', createdTaskId: 'task-9' }),
    ).toEqual({ kind: 'task', id: 'task-9' })
  })

  it('refuses a dismissed suggestion', () => {
    expect(resolveActionItemEditTarget({ id: 'sug-1', status: 'dismissed', createdTaskId: null })).toBeNull()
  })

  it('refuses an accepted suggestion with no task on it (should not happen, but never assume)', () => {
    expect(resolveActionItemEditTarget({ id: 'sug-1', status: 'accepted', createdTaskId: null })).toBeNull()
  })
})

describe('buildSuggestionUpdatePayload', () => {
  it('omits every key an edit did not touch', () => {
    expect(buildSuggestionUpdatePayload({})).toEqual({})
  })

  it('carries only the title through as `text`', () => {
    expect(buildSuggestionUpdatePayload({ title: 'Update the deploy doc' })).toEqual({
      text: 'Update the deploy doc',
    })
  })

  it('distinguishes clearing the due date from never mentioning it', () => {
    expect(buildSuggestionUpdatePayload({ dueDate: null })).toEqual({ suggestedDueDate: null })
    expect(buildSuggestionUpdatePayload({})).not.toHaveProperty('suggestedDueDate')
  })

  it('carries every field when all three are set', () => {
    expect(
      buildSuggestionUpdatePayload({ title: 'Ship it', assigneeId: 'user-1', dueDate: '2026-08-20' }),
    ).toEqual({ text: 'Ship it', suggestedUserId: 'user-1', suggestedDueDate: '2026-08-20' })
  })

  it('distinguishes unassigning from never mentioning the assignee', () => {
    expect(buildSuggestionUpdatePayload({ assigneeId: null })).toEqual({ suggestedUserId: null })
    expect(buildSuggestionUpdatePayload({})).not.toHaveProperty('suggestedUserId')
  })
})

describe('buildTaskUpdatePayload', () => {
  it('omits every key an edit did not touch', () => {
    expect(buildTaskUpdatePayload({})).toEqual({})
  })

  it('carries the title through unchanged (no field rename, unlike the suggestion path)', () => {
    expect(buildTaskUpdatePayload({ title: 'Ship it' })).toEqual({ title: 'Ship it' })
  })

  it('distinguishes clearing the due date from never mentioning it', () => {
    expect(buildTaskUpdatePayload({ dueDate: null })).toEqual({ dueDate: null })
    expect(buildTaskUpdatePayload({})).not.toHaveProperty('dueDate')
  })

  it('carries every field when all three are set', () => {
    expect(buildTaskUpdatePayload({ title: 'Ship it', assigneeId: 'user-1', dueDate: '2026-08-20' })).toEqual({
      title: 'Ship it',
      assigneeId: 'user-1',
      dueDate: '2026-08-20',
    })
  })
})

describe('classifyDueDateInput', () => {
  it('resolves a real ISO date', () => {
    expect(classifyDueDateInput('2026-08-20')).toEqual({ kind: 'resolved', iso: '2026-08-20' })
  })

  it('resolves a written-out date that carries a year', () => {
    expect(classifyDueDateInput('August 20, 2026')).toEqual({ kind: 'resolved', iso: '2026-08-20' })
  })

  it('classifies a model-generated multi-candidate string as unresolved, verbatim', () => {
    expect(classifyDueDateInput('Today at 4:30 PM, 5:00 PM, or 5:50 PM')).toEqual({
      kind: 'unresolved',
      raw: 'Today at 4:30 PM, 5:00 PM, or 5:50 PM',
    })
  })

  it('classifies an ordinary spoken phrase as unresolved', () => {
    expect(classifyDueDateInput('next Friday')).toEqual({ kind: 'unresolved', raw: 'next Friday' })
  })
})

describe('findDueDateHint', () => {
  const deadlines = [
    { item: 'Update the deploy doc', due: 'Today at 4:30 PM, 5:00 PM, or 5:50 PM' },
    { item: 'Send the client invoice.', due: 'August 20, 2026' },
  ]

  it('matches on exact normalized text', () => {
    expect(findDueDateHint('update the deploy doc', deadlines)).toBe(
      'Today at 4:30 PM, 5:00 PM, or 5:50 PM',
    )
  })

  it('ignores case, whitespace and trailing punctuation', () => {
    expect(findDueDateHint('  Send the client invoice  ', deadlines)).toBe('August 20, 2026')
  })

  it('returns null when nothing matches, rather than guessing', () => {
    expect(findDueDateHint('Book the venue', deadlines)).toBeNull()
  })

  it('returns null when the matching deadline has no due text', () => {
    expect(findDueDateHint('Undated item', [{ item: 'Undated item', due: '' }])).toBeNull()
  })
})
