import { describe, expect, it } from 'vitest'

import {
  buildEntryDraftPrompt,
  MAX_PROPOSED_ENTRIES,
  parseDraftedEntries,
  type DraftMeeting,
  type DraftTask,
} from './entry-draft-prompt'
import { ENTRY_MINUTES_MAX } from './entries'

const TASK_A = '11111111-1111-4111-8111-111111111111'
const TASK_B = '22222222-2222-4222-8222-222222222222'
const INVENTED = '33333333-3333-4333-8333-333333333333'

const tasks: DraftTask[] = [
  { id: TASK_A, title: 'Ship the calendar', appName: 'LogPup' },
  { id: TASK_B, title: 'Fix the login redirect', appName: 'SCADA' },
]

const meetings: DraftMeeting[] = [
  { title: 'Sprint planning', startLabel: '09:30', endLabel: '10:30', minutes: 60, projects: ['LogPup'] },
  { title: 'All hands', startLabel: '15:00', endLabel: '15:45', minutes: 45, projects: [] },
]

const activity = [
  { verb: 'completed', entityType: 'task', entityLabel: 'Ship the calendar', appName: 'LogPup' },
  { verb: 'commented', entityType: 'meeting', entityLabel: 'Sprint planning', appName: null },
]

const prompt = (over: Partial<Parameters<typeof buildEntryDraftPrompt>[0]> = {}) =>
  buildEntryDraftPrompt({
    name: 'Nadeesha',
    day: '2026-08-20',
    scheduledMinutes: 480,
    onApprovedAbsence: false,
    alreadyLoggedMinutes: 0,
    meetings,
    activity,
    tasks,
    commits: [],
    ...over,
  })

const reply = (entries: unknown[]) => JSON.stringify({ entries })

describe('buildEntryDraftPrompt', () => {
  it('names pushed code only when commit lines exist', () => {
    // Omitted, not "no commits": an unconfigured GitHub integration and a
    // day without code look identical here, and only one of them is true.
    expect(prompt()).not.toContain('Code they pushed')
    const withCommits = prompt({ commits: ['- [acme/kestrel] fix: rate limiter drift'] })
    expect(withCommits).toContain('Code they pushed that day')
    expect(withCommits).toContain('- [acme/kestrel] fix: rate limiter drift')
  })

  it('lists meetings with the times actually recorded', () => {
    expect(prompt()).toContain('09:30-10:30 (60 min) Sprint planning')
  })

  it('keeps a meeting with NO project, and says so rather than dropping it', () => {
    // A meeting can serve several projects or none (0040), and purgeApp leaves
    // meetings behind unlinked. The person still sat in it.
    const text = prompt()
    expect(text).toContain('All hands')
    expect(text).toContain('no project on record')
    expect(text).toMatch(/meeting with no project is still real time/i)
  })

  it('fences the task ids to the ones it was shown', () => {
    const text = prompt()
    expect(text).toContain(TASK_A)
    expect(text).toContain('ONLY ones you may use')
  })

  it('says plainly when there is no task to name', () => {
    expect(prompt({ tasks: [] })).toContain('no entry may name a task')
  })

  it('restates the category/task rule the action will enforce anyway', () => {
    const text = prompt()
    expect(text).toContain('category "task" REQUIRES a taskId')
    expect(text).toContain('A meeting is not a task.')
  })

  it('gives the scheduled day as context and explicitly not as a quota', () => {
    const text = prompt()
    expect(text).toContain('480 minutes (8 hours)')
    expect(text).toMatch(/NOT a quota/)
    expect(text).toMatch(/Leaving hours unaccounted for is correct and honest/)
  })

  it('says the day length is NOT KNOWN rather than assuming one', () => {
    // There is no default working day anywhere on this path. A draft built
    // against an invented denominator makes the person correct the app's
    // assumption instead of recording their own day.
    const text = prompt({ scheduledMinutes: null })
    expect(text).toContain('NOT KNOWN')
    expect(text).not.toContain('480')
    expect(text).not.toMatch(/\b8 hours\b/)
  })

  it('treats a zero-length day the same as an unknown one', () => {
    expect(prompt({ scheduledMinutes: 0 })).toContain('NOT KNOWN')
  })

  it('names approved leave, so a leave day is not padded out', () => {
    expect(prompt({ onApprovedAbsence: true })).toContain('APPROVED LEAVE')
  })

  it('asks for the remainder when something is already logged', () => {
    const text = prompt({ alreadyLoggedMinutes: 120 })
    expect(text).toContain('already logged 120 minutes')
    expect(text).toContain('never a replacement for it')
  })

  it('says nothing about already-logged time on an untouched day', () => {
    expect(prompt()).not.toContain('already logged')
  })

  it('forbids inventing, and forbids guessing at an empty day', () => {
    const text = prompt()
    expect(text).toMatch(/NEVER invent/)
    expect(text).toMatch(/Do not guess what they did/)
  })

  it('never mentions transcripts or keyframes — they are not in the pack', () => {
    expect(prompt()).not.toMatch(/transcript|keyframe|screenshot|recording of/i)
  })
})

describe('parseDraftedEntries', () => {
  const allowed = new Set([TASK_A, TASK_B])

  it('keeps well-formed rows', () => {
    const out = parseDraftedEntries(reply([
      { minutes: 60, category: 'meeting', taskId: null, note: 'Sprint planning' },
      { minutes: 180, category: 'task', taskId: TASK_A, note: 'Calendar work' },
    ]), allowed)
    expect(out).toEqual([
      { minutes: 60, category: 'meeting', taskId: null, note: 'Sprint planning' },
      { minutes: 180, category: 'task', taskId: TASK_A, note: 'Calendar work' },
    ])
  })

  it('DROPS a row naming a task id it was never shown', () => {
    // A hallucinated uuid would either break the foreign key at save time or,
    // far worse, land on a real task in somebody else's project.
    const out = parseDraftedEntries(reply([
      { minutes: 120, category: 'task', taskId: INVENTED, note: 'Something' },
    ]), allowed)
    expect(out).toEqual([])
  })

  it('drops an invented-task row rather than rewriting it into a task-less entry', () => {
    const out = parseDraftedEntries(reply([
      { minutes: 120, category: 'task', taskId: INVENTED, note: 'Something' },
      { minutes: 60, category: 'review', taskId: null, note: 'Code review' },
    ]), allowed)
    expect(out).toEqual([{ minutes: 60, category: 'review', taskId: null, note: 'Code review' }])
  })

  it('enforces the category/task rule through validateEntry, not a second opinion', () => {
    const out = parseDraftedEntries(reply([
      { minutes: 60, category: 'task', taskId: null, note: 'no task' },
      { minutes: 60, category: 'meeting', taskId: TASK_A, note: 'meeting borrowing a task' },
    ]), allowed)
    expect(out).toEqual([])
  })

  it('rejects an unknown category', () => {
    expect(parseDraftedEntries(reply([{ minutes: 60, category: 'napping', taskId: null, note: null }]), allowed))
      .toEqual([])
  })

  it('rounds fractional minutes rather than failing the whole row', () => {
    const out = parseDraftedEntries(reply([{ minutes: 92.5, category: 'admin', taskId: null, note: null }]), allowed)
    expect(out[0].minutes).toBe(93)
  })

  it('keeps the good rows when one row is malformed', () => {
    const out = parseDraftedEntries(reply([
      'not an object',
      { minutes: 'ninety', category: 'admin' },
      { minutes: 90, category: 'admin', taskId: null, note: null },
    ]), allowed)
    expect(out).toHaveLength(1)
    expect(out[0].minutes).toBe(90)
  })

  it('normalises an empty note and an empty task id to null', () => {
    const out = parseDraftedEntries(reply([{ minutes: 30, category: 'other', taskId: '', note: '  ' }]), allowed)
    expect(out).toEqual([{ minutes: 30, category: 'other', taskId: null, note: null }])
  })

  it(`caps the proposal at ${MAX_PROPOSED_ENTRIES} entries`, () => {
    const rows = Array.from({ length: MAX_PROPOSED_ENTRIES + 5 }, () => ({
      minutes: 15, category: 'other', taskId: null, note: null,
    }))
    expect(parseDraftedEntries(reply(rows), allowed)).toHaveLength(MAX_PROPOSED_ENTRIES)
  })

  it('never proposes more than a day in total', () => {
    const out = parseDraftedEntries(reply([
      { minutes: ENTRY_MINUTES_MAX, category: 'other', taskId: null, note: null },
      { minutes: 60, category: 'other', taskId: null, note: null },
    ]), allowed)
    expect(out).toHaveLength(1)
    expect(out.reduce((sum, e) => sum + e.minutes, 0)).toBeLessThanOrEqual(ENTRY_MINUTES_MAX)
  })

  it('returns nothing at all for a reply that is not JSON, or is the wrong shape', () => {
    expect(parseDraftedEntries('I could not work that out', allowed)).toEqual([])
    expect(parseDraftedEntries(JSON.stringify({ rows: [] }), allowed)).toEqual([])
    expect(parseDraftedEntries(JSON.stringify({ entries: 'none' }), allowed)).toEqual([])
  })

  it('returns nothing when the model correctly proposed nothing', () => {
    expect(parseDraftedEntries(reply([]), allowed)).toEqual([])
  })
})
