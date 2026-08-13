import { describe, expect, it } from 'vitest'
import { parseTaskIntent } from '@/lib/task-intent'

const PEOPLE = [
  { id: 'u1', name: 'Shanika Ayasmanthi' },
  { id: 'u2', name: 'Deeghayu Adhikari' },
  { id: 'u3', name: 'Sam Perera' },
  { id: 'u4', name: 'Sam Fernando' },
]
const TODAY = new Date(2026, 7, 11) // Tuesday 11 Aug 2026

describe('parseTaskIntent — multi-assignee, fuzzy names, fuzzy priority', () => {
  it('binds two leading bare names: "shanika deeghayu fix login"', () => {
    const intent = parseTaskIntent('shanika deeghayu fix login', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignees.map(p => p.id)).toEqual(['u1', 'u2'])
    expect(intent?.title).toBe('fix login')
  })

  it('binds names joined with "and": "shanika and deeghayu fix login"', () => {
    const intent = parseTaskIntent('shanika and deeghayu fix login', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignees.map(p => p.id)).toEqual(['u1', 'u2'])
    expect(intent?.title).toBe('fix login')
  })

  it('binds trailing names joined with "or", selecting both: "fix login shanika or deeghayu"', () => {
    const intent = parseTaskIntent('fix login shanika or deeghayu', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignees.map(p => p.id).sort()).toEqual(['u1', 'u2'])
    expect(intent?.title).toBe('fix login')
  })

  it('strips the connecting "to" before an assignee pair: "fix login to shanika and deeghayu"', () => {
    const intent = parseTaskIntent('fix login to shanika and deeghayu', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignees.map(p => p.id)).toEqual(['u1', 'u2'])
    expect(intent?.title).toBe('fix login')
  })

  it('binds comma-separated names: "shanika, deeghayu fix login"', () => {
    const intent = parseTaskIntent('shanika, deeghayu fix login', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignees.map(p => p.id)).toEqual(['u1', 'u2'])
    expect(intent?.title).toBe('fix login')
  })

  it('fuzzy-matches a leading bare typo without @: "shanka fix login"', () => {
    const intent = parseTaskIntent('shanka fix login', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignee?.id).toBe('u1')
    expect(intent?.title).toBe('fix login')
  })

  it('fuzzy-matches a trailing bare typo: "fix login shanka"', () => {
    const intent = parseTaskIntent('fix login shanka', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignee?.id).toBe('u1')
    expect(intent?.title).toBe('fix login')
  })

  it('never steals an ordinary noun far from every name: "fix login page"', () => {
    const intent = parseTaskIntent('fix login page', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignees.map(p => p.id)).toEqual([])
    expect(intent?.assignee).toBeNull()
    expect(intent?.assigneeQuery).toBeNull()
    expect(intent?.title).toBe('fix login page')
  })

  it('combines multi-assignee with due date and priority: "shanika deeghayu fix login today high"', () => {
    const intent = parseTaskIntent('shanika deeghayu fix login today high', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignees.map(p => p.id)).toEqual(['u1', 'u2'])
    expect(intent?.title).toBe('fix login')
    expect(intent?.due).toBe('2026-08-11')
    expect(intent?.priority).toBe(3)
  })

  it('mixes @-mention and bare name: "@shanika deeghayu fix login"', () => {
    const intent = parseTaskIntent('@shanika deeghayu fix login', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignees.map(p => p.id)).toEqual(['u1', 'u2'])
    expect(intent?.title).toBe('fix login')
  })

  it('reports ambiguity when a bare name matches two people: "review the deck sam"', () => {
    const intent = parseTaskIntent('review the deck sam', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignee).toBeNull()
    expect(intent?.ambiguous.map(p => p.id).sort()).toEqual(['u3', 'u4'])
    expect(intent?.title).toBe('review the deck')
  })

  it('handles the assign-verb form with a pair: "assign billing copy to shanika and deeghayu"', () => {
    const intent = parseTaskIntent('assign billing copy to shanika and deeghayu', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignees.map(p => p.id)).toEqual(['u1', 'u2'])
    expect(intent?.title).toBe('billing copy')
  })

  it('fuzzy-matches a one-slip priority with the same first letter: "fix login hgh"', () => {
    const intent = parseTaskIntent('fix login hgh', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.priority).toBe(3)
    expect(intent?.title).toBe('fix login')
  })

  it('does not fuzzy-match a priority across a different first letter: "fix loading slow"', () => {
    const intent = parseTaskIntent('fix loading slow', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.priority).toBeNull()
    expect(intent?.title).toBe('fix loading slow')
  })

  it('binds a full name first, then the next name: "shanika ayasmanthi deeghayu ship it"', () => {
    const intent = parseTaskIntent('shanika ayasmanthi deeghayu ship it', PEOPLE, TODAY)
    expect(intent).not.toBeNull()
    expect(intent?.assignees.map(p => p.id)).toEqual(['u1', 'u2'])
    expect(intent?.title).toBe('ship it')
  })
})
