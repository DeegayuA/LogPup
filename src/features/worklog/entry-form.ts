import {
  validateEntry,
  type EntryCategory,
  type EntryInput,
} from '@/features/worklog/entries'

/**
 * What the add-an-entry form sends, and why it cannot send.
 *
 * WHY THIS IS A MODULE AND NOT THREE LINES IN THE CARD. The form shipped with
 * `category` defaulting to 'task' and no way to name a task, so the very first
 * thing anybody typed came back as "Pick the task that time went to" — a
 * message naming a control that was not on the screen. The rule was never
 * wrong; the form simply did not apply it, which is the exact drift
 * entry-actions.ts warns about in its header ("the action and any UI that
 * pre-validates cannot drift into two different answers"). It cannot drift now
 * because both sides run `validateEntry`.
 *
 * PURE AND SYNCHRONOUS, like entries.ts: the form's decision is data in, data
 * out, so the case that was broken is a test rather than a click.
 */

export type EntryFormFields = {
  /** Parsed minutes, or null while the box holds nothing readable. */
  minutes: number | null
  category: EntryCategory
  /** The chosen task, for task entries only. */
  taskId: string | null
  /** The chosen project, for everything BUT task entries — see below. */
  appId: string | null
  note: string
}

/**
 * The payload for `createWorklogEntry`, or null when there is no time on it.
 *
 * A TASK ENTRY DELIBERATELY SENDS NO appId. `resolveEntryAppId` in
 * entry-actions.ts reads the project off the task itself and ignores anything
 * the client supplied, so sending one would put a value on the wire that the
 * save path throws away — and the form was doing exactly that: it showed a
 * Project select on task entries whose answer never reached the row. Deriving
 * it server-side is what keeps the hours attributed after the task is deleted
 * (migration 0050), and a second, client-chosen source for the same field is
 * how the two quietly disagree.
 *
 * Every other category sends its appId and no task: a meeting may or may not
 * be about a project, and admin time usually is not.
 */
/**
 * The category is narrowed back to `EntryCategory` on the way out. `EntryInput`
 * widens it to `string & {}` on purpose — that is what lets `validateEntry`
 * be the thing that rejects an unknown category — but a form whose Select is
 * built from ENTRY_CATEGORIES can only ever hold a real one, and handing the
 * action the wide type would make every caller re-narrow it.
 */
export function buildEntryPayload(
  fields: EntryFormFields,
): (Omit<EntryInput, 'category'> & { minutes: number; category: EntryCategory }) | null {
  if (fields.minutes === null) return null
  const isTask = fields.category === 'task'
  return {
    minutes: fields.minutes,
    category: fields.category,
    taskId: isTask ? fields.taskId : null,
    appId: isTask ? null : fields.appId,
    note: fields.note.trim() || null,
  }
}

/**
 * The sentence to show for why this cannot be added yet, or null when it can.
 *
 * `requireAppForTask: false` is the same choice the AI draft path makes, and
 * for the same stated reason: this caller does not supply a task's project
 * because the save path derives it. Holding the form to a rule the action
 * itself fulfils would refuse every task entry — which, before this module,
 * is precisely what happened one step later, on the server, after the person
 * had already pressed Add.
 */
export function entryFormProblem(fields: EntryFormFields): string | null {
  const payload = buildEntryPayload(fields)
  if (!payload) return 'Enter a time — "1.5", "90m" and "1h30" all work'
  const result = validateEntry(payload, { requireAppForTask: false })
  return result.ok ? null : result.message
}
