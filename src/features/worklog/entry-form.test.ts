import { describe, expect, it } from 'vitest'

import { buildEntryPayload, entryFormProblem } from '@/features/worklog/entry-form'
import { validateEntry, ENTRY_MINUTES_MAX, ENTRY_NOTE_MAX } from '@/features/worklog/entries'
import type { EntryFormFields } from '@/features/worklog/entry-form'

const APP = '11111111-1111-4111-8111-111111111111'
const TASK = '22222222-2222-4222-8222-222222222222'

function fields(patch: Partial<EntryFormFields> = {}): EntryFormFields {
  return { minutes: 90, category: 'task', taskId: TASK, appId: null, note: '', ...patch }
}

describe('buildEntryPayload', () => {
  it('sends the task and no project for a task entry', () => {
    expect(buildEntryPayload(fields())).toEqual({
      minutes: 90,
      category: 'task',
      taskId: TASK,
      appId: null,
      note: null,
    })
  })

  // THE CONTROL FOR THE LYING CONTROL. The form used to show a Project select
  // on task entries; resolveEntryAppId ignores it. If this ever passes appId
  // through, the row's project and the task's project have two sources.
  it('drops a chosen project from a task entry, because the server derives it', () => {
    expect(buildEntryPayload(fields({ appId: APP }))?.appId).toBeNull()
  })

  it('sends the project and no task for every other category', () => {
    expect(buildEntryPayload(fields({ category: 'meeting', taskId: TASK, appId: APP }))).toEqual({
      minutes: 90,
      category: 'meeting',
      taskId: null,
      appId: APP,
      note: null,
    })
  })

  it('trims the note and sends a blank one as null', () => {
    expect(buildEntryPayload(fields({ note: '  standup  ' }))?.note).toBe('standup')
    expect(buildEntryPayload(fields({ note: '   ' }))?.note).toBeNull()
  })

  it('is null while the duration box holds nothing readable', () => {
    expect(buildEntryPayload(fields({ minutes: null }))).toBeNull()
  })
})

describe('entryFormProblem', () => {
  it('passes a complete task entry', () => {
    expect(entryFormProblem(fields())).toBeNull()
  })

  it('passes a complete non-task entry with no project at all', () => {
    expect(entryFormProblem(fields({ category: 'admin', taskId: null, appId: null }))).toBeNull()
  })

  // THE BUG. 'task' is the form's default category, so this was the state the
  // form was in the moment it opened: the person typed a time, pressed Add,
  // and the SERVER answered with a sentence about a control the form did not
  // have. Nothing on the client said a word beforehand.
  it('refuses a task entry with no task, in the words the server uses', () => {
    expect(entryFormProblem(fields({ taskId: null }))).toBe('Pick the task that time went to')
  })

  it('asks for a time before anything else', () => {
    expect(entryFormProblem(fields({ minutes: null, taskId: null }))).toBe(
      'Enter a time — "1.5", "90m" and "1h30" all work',
    )
  })

  it('refuses zero and refuses more than a day', () => {
    expect(entryFormProblem(fields({ minutes: 0 }))).toBe('That entry has no time on it')
    expect(entryFormProblem(fields({ minutes: ENTRY_MINUTES_MAX + 1 }))).toBe(
      'A single entry cannot be longer than a day',
    )
  })

  it('refuses a note longer than the column takes', () => {
    expect(entryFormProblem(fields({ note: 'x'.repeat(ENTRY_NOTE_MAX + 1) }))).toBe(
      'That note is too long',
    )
  })
})

// The pair of assertions that justifies `requireAppForTask: false` rather than
// leaving it at its default. If this ever fails, the form and the action have
// stopped agreeing about who supplies a task's project — and the failing half
// would be the form, silently, for every task entry anybody logs.
describe('the form and the action agree', () => {
  it('builds a task payload the action accepts and the strict rule alone would not', () => {
    const payload = buildEntryPayload(fields())!
    expect(validateEntry(payload, { requireAppForTask: false }).ok).toBe(true)
    expect(validateEntry(payload)).toMatchObject({
      ok: false,
      problem: 'app-required-for-task',
    })
  })
})
