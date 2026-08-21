import { describe, expect, it } from 'vitest'
import type { ProjectRoleTone } from '@/lib/project-roles'
import { buildEntrySuggestions, type SuggestionInput } from './entry-suggestions'

const roles = (entries: [string, ProjectRoleTone][]) => new Map(entries)

const EMPTY: SuggestionInput = { meetings: [], tasksTouched: [], roleByApp: roles([]) }

describe('buildEntrySuggestions', () => {
  it('carries the project tag, so an accepted suggestion renders as a linked pill', () => {
    const [s] = buildEntrySuggestions({
      ...EMPTY,
      meetings: [{ title: 'Sprint 14 check-in', minutes: 41, appName: 'Kestrel' }],
    })
    // Round-trips through splitNoteAppTags — see note-app-tags.ts.
    expect(s.text).toBe('Sprint 14 check-in (41 min) [Kestrel]')
  })

  it('omits the duration when nobody recorded one, rather than inventing 0 min', () => {
    const [s] = buildEntrySuggestions({
      ...EMPTY,
      meetings: [{ title: 'Ad-hoc sync', minutes: null, appName: null }],
    })
    expect(s.text).toBe('Ad-hoc sync')
  })

  // THE DISCRIMINATING CASE. Every other assertion in this file would also
  // pass under a role-blind sort, because meetings carry minutes and tasks do
  // not, so "meetings first" and "longest first" agree on a natural day. This
  // is the one shape where the two algorithms MUST disagree: identical input,
  // only the role differs, and the order flips.
  const oneMeetingOneTask: Omit<SuggestionInput, 'roleByApp'> = {
    meetings: [{ title: 'SE intern interview', minutes: 30, appName: 'Kestrel' }],
    tasksTouched: [{ id: 't1', title: 'OAuth 2.0 PKCE audit', appName: 'Kestrel' }],
  }

  it('puts the meeting first for someone who LEADS the project', () => {
    const out = buildEntrySuggestions({
      ...oneMeetingOneTask,
      roleByApp: roles([['Kestrel', 'reviewer']]),
    })
    expect(out.map((s) => s.source)).toEqual(['meeting', 'task'])
  })

  it('puts the task first for someone who BUILDS on the same project, same day', () => {
    const out = buildEntrySuggestions({
      ...oneMeetingOneTask,
      roleByApp: roles([['Kestrel', 'member']]),
    })
    expect(out.map((s) => s.source)).toEqual(['task', 'meeting'])
  })

  it('treats a manager like a lead — both days are about people, not tickets', () => {
    const out = buildEntrySuggestions({
      ...oneMeetingOneTask,
      roleByApp: roles([['Kestrel', 'manager']]),
    })
    expect(out[0].source).toBe('meeting')
  })

  it('ranks the project someone leads above the one they build on', () => {
    const out = buildEntrySuggestions({
      meetings: [{ title: 'Apollo standup', minutes: 15, appName: 'Apollo' }],
      tasksTouched: [{ id: 't1', title: 'Kestrel migration', appName: 'Kestrel' }],
      roleByApp: roles([
        ['Kestrel', 'member'],
        ['Apollo', 'reviewer'],
      ]),
    })
    expect(out.map((s) => s.appName)).toEqual(['Apollo', 'Kestrel'])
  })

  it('never offers the same sentence twice, and the meeting keeps its duration', () => {
    const out = buildEntrySuggestions({
      ...EMPTY,
      meetings: [{ title: 'Design review', minutes: 25, appName: 'Tessera' }],
      tasksTouched: [{ id: 't1', title: 'Design review (25 min)', appName: 'Tessera' }],
    })
    expect(out).toHaveLength(1)
    expect(out[0].source).toBe('meeting')
  })

  it('suggests nothing on a day with no evidence, rather than a plausible day', () => {
    // A note is a first-person statement. A suggestion that fabricates a day
    // is one that gets accepted unread.
    expect(buildEntrySuggestions(EMPTY)).toEqual([])
  })

  it('leaves a project the person has no role on unranked rather than guessing', () => {
    const out = buildEntrySuggestions({
      ...EMPTY,
      meetings: [{ title: 'All-hands', minutes: 60, appName: null }],
      tasksTouched: [{ id: 't1', title: 'Untagged chore', appName: null }],
    })
    expect(out.every((s) => s.role === null)).toBe(true)
    // No role means no lead band, so the build ordering applies: task first.
    expect(out.map((s) => s.source)).toEqual(['task', 'meeting'])
  })
})
