import { grammarForPrompt } from '@/features/worklog/entry-language'
import {
  ENTRY_CATEGORIES,
  ENTRY_MINUTES_MAX,
  ENTRY_NOTE_MAX,
  validateEntry,
  type EntryCategory,
} from '@/features/worklog/entries'

/**
 * The prompt behind "Draft my hours", and the parser that decides what of the
 * reply is allowed anywhere near a person's worklog.
 *
 * PURE. NO DATABASE, NO MODEL, NO CLOCK — so the guarantees that matter here
 * (invents no task, proposes nothing it was not shown, never exceeds a day) are
 * pinned by tests rather than discovered in production.
 *
 * IT PROPOSES; IT NEVER WRITES. Every row this produces is handed to the person
 * as an editable suggestion carrying `source: 'ai_suggested'`, and reaches the
 * database only through `createWorklogEntry` when they save it. Nothing here
 * calls a write path, and there is deliberately no "accept all" in this module
 * for a caller to reach for. A worklog is a first-person statement about
 * somebody's own day; a machine filling one in unattended would be putting
 * words in their mouth in the one record that is supposed to be theirs.
 *
 * WHAT IT IS ALLOWED TO SEE — AND WHAT IT IS NOT.
 *
 * The evidence pack is meetings attended (with real recorded start and end
 * times), that day's activity-log rows for that person, and the tasks they are
 * assigned and working on. That is the whole of it.
 *
 * MEETING TRANSCRIPTS AND SCREEN KEYFRAMES ARE DELIBERATELY EXCLUDED, and this
 * comment exists so nobody later "improves" the pack by adding them. Both are
 * right there in the database and both would obviously sharpen a draft. They
 * exist to write up MEETINGS. Reading them to reconstruct how a person spent
 * their hours is a different activity with a different name: it turns a tool
 * for remembering your day into a tool for auditing somebody's day, and this
 * design refuses that even at the cost of a rougher draft. If a future feature
 * genuinely needs them, it needs its own consent story first, not a quiet
 * widening of this function's inputs.
 *
 * A MEETING MAY HAVE NO PROJECT, and that is a real case rather than bad data.
 * `meeting_apps` (migration 0040) made the relationship many-to-many, so a
 * company all-hands legitimately belongs to nobody; and `purgeApp` leaves
 * meetings behind with `meetings.app_id` set to null. Either way the person sat
 * in that meeting, so the time counts and the meeting is listed with no project
 * rather than filtered out.
 */

export type DraftMeeting = {
  title: string
  /** Colombo local wall-clock, e.g. "09:30" — formatted by the caller. */
  startLabel: string
  endLabel: string
  minutes: number
  /** Every project the meeting serves. EMPTY IS NORMAL — see above. */
  projects: readonly string[]
}

export type DraftActivityRow = {
  verb: string
  entityType: string
  entityLabel: string
  appName: string | null
}

export type DraftTask = {
  id: string
  title: string
  appName: string | null
}

/**
 * A proposed row, in the shape `createWorklogEntry` takes.
 *
 * `source` is deliberately NOT set here. The action stamps every row it returns
 * with `'ai_suggested'` (see DraftedEntry in entry-ai-actions.ts), so a
 * proposal cannot reach a person — or the table — looking like something they
 * typed, and this pure module has no way to mint a row that claims otherwise.
 */
export type ProposedEntry = {
  minutes: number
  category: EntryCategory
  taskId: string | null
  note: string | null
}

/**
 * Enough rows to describe a day honestly; beyond this it is fragmenting an
 * afternoon into quarter-hours nobody remembers that precisely.
 */
export const MAX_PROPOSED_ENTRIES = 12

/** Whole hours where they are whole, one decimal otherwise. Matches formatHours. */
const hrs = (minutes: number) => String(Math.round((minutes / 60) * 10) / 10)

function meetingLine(meeting: DraftMeeting): string {
  const projects = meeting.projects.length > 0
    ? meeting.projects.join(', ')
    : 'no project on record'
  return `- ${meeting.startLabel}-${meeting.endLabel} (${meeting.minutes} min) ${meeting.title} `
    + `[${projects}]`
}

/**
 * The prompt for "draft the day's hours from what LogPup already saw".
 *
 * `scheduledMinutes` is `number | null` and there is NO DEFAULT. Null means the
 * day's length is genuinely unknown, and the prompt then says so rather than
 * quietly proposing eight hours: a draft built against an invented working day
 * is how a person ends up correcting the app's assumption instead of recording
 * their own. When it IS known it is given as a target, never as a quota to be
 * padded out to — the rules below say that in as many words.
 *
 * `alreadyLoggedMinutes` exists so a second run of the draft on a partly-filled
 * day proposes the REMAINDER instead of a duplicate set. A draft that silently
 * doubled somebody's Tuesday would be worse than no draft.
 */
export function buildEntryDraftPrompt(input: {
  name: string
  day: string
  scheduledMinutes: number | null
  onApprovedAbsence: boolean
  alreadyLoggedMinutes: number
  meetings: readonly DraftMeeting[]
  activity: readonly DraftActivityRow[]
  tasks: readonly DraftTask[]
  /** Pre-rendered commit lines (commitPromptLines, github/commits.ts), oldest
   *  first. Empty both when they pushed nothing AND when the GitHub
   *  integration isn't set up — which is why the section is omitted rather
   *  than saying "no commits": absence of the integration must never read to
   *  the model as "they wrote no code that day". */
  commits: readonly string[]
}): string {
  const meetings = input.meetings.length > 0
    ? `Meetings they were on, with the times actually recorded:\n${input.meetings.map(meetingLine).join('\n')}`
    : 'No meetings recorded for them that day.'

  const activity = input.activity.length > 0
    ? 'What LogPup recorded them doing that day:\n' + input.activity
      .map((row) => `- ${row.verb} ${row.entityType}: ${row.entityLabel}`
        + `${row.appName ? ` (${row.appName})` : ''}`)
      .join('\n')
    : 'LogPup recorded no other activity for them that day.'

  const commits = input.commits.length > 0
    ? `Code they pushed that day (commit subjects, oldest first):\n${input.commits.join('\n')}`
    : ''

  const tasks = input.tasks.length > 0
    ? 'Tasks assigned to them and in progress — these ids are the ONLY ones you may use:\n'
      + input.tasks
        .map((task) => `- ${task.id} — ${task.title}${task.appName ? ` (${task.appName})` : ''}`)
        .join('\n')
    : 'They have no tasks assigned and in progress, so no entry may name a task.'

  const schedule = input.scheduledMinutes === null || input.scheduledMinutes <= 0
    ? 'How long their day was scheduled to be is NOT KNOWN. Propose only what the '
      + 'evidence supports and do not aim at any total.'
    : `Their day was scheduled for ${input.scheduledMinutes} minutes (${hrs(input.scheduledMinutes)} hours). `
      + 'That is context, NOT a quota — do not invent work to reach it.'

  const absence = input.onApprovedAbsence
    ? 'They had APPROVED LEAVE on this day. Propose only time the evidence above actually '
      + 'shows; a day of leave with nothing recorded should come back as an empty list.\n'
    : ''

  const already = input.alreadyLoggedMinutes > 0
    ? `They have already logged ${input.alreadyLoggedMinutes} minutes for this day. Propose only what is `
      + 'MISSING on top of that, never a replacement for it.\n'
    : ''

  return `You are proposing how ${input.name} spent ${input.day}, for them to correct before they save it. These are suggestions they will edit, not a record of anything.

${meetings}

${activity}
${commits ? `\n${commits}\n` : ''}
${tasks}

${schedule}
${absence}${already}
Rules:
- Use ONLY the evidence above. NEVER invent a meeting, a task, an hour or a piece of work that is not listed.
- Every entry is {"minutes": whole minutes, "category": one of ${ENTRY_CATEGORIES.join(' | ')}, "taskId": one of the ids above or null, "note": one short line or null}.
- category "task" REQUIRES a taskId from the list above. Every other category must have taskId null. A meeting is not a task.
- Time in a meeting is category "meeting". Use the recorded minutes; do not round them up.
- A meeting with no project is still real time they spent. Include it.
- Prefer FEWER, larger entries. At most ${MAX_PROPOSED_ENTRIES} entries, and never more than ${ENTRY_MINUTES_MAX} minutes in total.
- If the evidence does not support a full day, propose the short day. Leaving hours unaccounted for is correct and honest; padding is not.
- If there is no evidence at all, return an empty list. Do not guess what they did.
- Notes are at most ${ENTRY_NOTE_MAX} characters, factual, and in the first person as ${input.name}.
- This is a Sri Lankan team that code-switches between Sinhala and English. Write notes in English and keep task, project and meeting names exactly as they appear above.
- Choose the category the way the person's own typing is read, so a proposal and a hand-typed line
  never come back as different kinds of the same work:
${grammarForPrompt()}

Respond as JSON, exactly this shape: {"entries": [{"minutes": number, "category": string, "taskId": string | null, "note": string | null}]}`
}

/** One row of the reply, before anything about it is trusted. */
function readRow(item: unknown): { minutes: unknown; category: unknown; taskId: unknown; note: unknown } | null {
  if (typeof item !== 'object' || item === null) return null
  const row = item as Record<string, unknown>
  return { minutes: row.minutes, category: row.category, taskId: row.taskId, note: row.note }
}

/**
 * The reply, reduced to rows that are actually proposable.
 *
 * EVERY ROW IS VALIDATED AGAINST THE SAME RULES A TYPED ROW FACES —
 * `validateEntry` from entries.ts, not a second opinion written here — so a
 * proposal cannot be shaped in a way the person could not have typed
 * themselves, and cannot slip past the category/task rule on its way in.
 *
 * `allowedTaskIds` IS THE FENCE THAT MATTERS. The model is shown a list of task
 * ids and told to use only those; this drops any row naming an id that was not
 * on the list. Without it a hallucinated uuid would either fail the foreign key
 * at save time (an unexplainable error on the person's screen) or, far worse,
 * hit a real task belonging to somebody else's project.
 *
 * A BAD ROW IS DROPPED, NOT FATAL. Nine sensible proposals and one malformed
 * one should still save the person nine rows of typing — and each survivor is
 * individually valid, so dropping the tenth cannot corrupt the rest.
 *
 * The total is capped at one day. A model that proposed 30 hours has
 * misunderstood something, and the rows past the ceiling are the ones to lose.
 */
export function parseDraftedEntries(
  raw: string,
  allowedTaskIds: ReadonlySet<string>,
): ProposedEntry[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  const list = (parsed as { entries?: unknown })?.entries
  if (!Array.isArray(list)) return []

  const out: ProposedEntry[] = []
  let total = 0

  for (const item of list) {
    if (out.length >= MAX_PROPOSED_ENTRIES) break

    const row = readRow(item)
    if (!row) continue
    if (typeof row.minutes !== 'number' || typeof row.category !== 'string') continue

    // Round before validating, not after: a model that answered 92.5 meant 93
    // minutes, and `validateEntry` rejects a non-integer outright.
    const minutes = Math.round(row.minutes)
    const taskId = typeof row.taskId === 'string' && row.taskId !== '' ? row.taskId : null
    const note = typeof row.note === 'string' && row.note.trim() !== '' ? row.note.trim() : null

    // The id fence, BEFORE validateEntry: a task-category row naming an
    // invented id must be dropped, never quietly rewritten into a task-less
    // entry that claims the same hours against nothing.
    if (taskId !== null && !allowedTaskIds.has(taskId)) continue

    const candidate = {
      minutes,
      category: row.category as EntryCategory,
      taskId,
      note,
    }
    // requireAppForTask: false — a proposal is not a saved row. The model is
    // shown task ids and never apps; entry-actions.ts derives the project
    // from the task at save time and ignores any client-supplied one. Holding
    // a draft to that rule would drop every task row the model proposed.
    if (!validateEntry(candidate, { requireAppForTask: false }).ok) continue
    if (total + minutes > ENTRY_MINUTES_MAX) continue

    total += minutes
    out.push(candidate)
  }

  return out
}
