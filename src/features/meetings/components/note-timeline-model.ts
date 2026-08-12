// Pure logic behind inline-editing one action item on the note timeline
// (note-timeline.tsx): which record an edit must actually land on, how to
// build a partial-update payload for it, and how to classify a due-date
// string the model wrote. Colocated with the component and free of
// DB/network calls — same convention as meeting-notes-model.ts and
// meeting-panels-model.ts, and reuses meeting-notes-model.ts's due-date
// parsing rather than a second copy of them.

import { format } from 'date-fns'
import { parseSpokenDueDate } from '@/features/meetings/components/meeting-notes-model'

/* --- which record an edit lands on -------------------------------------- */

export type ActionItemEditTarget =
  | { kind: 'suggestion'; id: string }
  | { kind: 'task'; id: string }

export type ActionItemLike = {
  id: string
  status: 'open' | 'accepted' | 'dismissed'
  createdTaskId: string | null
}

/**
 * Which record an edit to one action-item row must actually write to.
 *
 * A row not yet accepted IS the suggestion — editing it changes
 * `suggestedUserId`/`suggestedDueDate`/`text` directly (see
 * updateTaskSuggestion in ai-actions.ts). A row the auto-assign pass already
 * turned into a real task is display-only on the suggestion row from here
 * on — the task itself (assigneeId/dueDate/title) is what the sprint board
 * reads, so an edit has to land THERE (via the existing updateTask action)
 * or the write-up and the board would disagree about who owns this and when
 * it's due. `dismissed`, and an `accepted` row with no task yet (accepting
 * always sets createdTaskId, but never assume it held), return null: nothing
 * on that row is safe to write to.
 */
export function resolveActionItemEditTarget(item: ActionItemLike): ActionItemEditTarget | null {
  if (item.status === 'open') return { kind: 'suggestion', id: item.id }
  if (item.status === 'accepted' && item.createdTaskId) return { kind: 'task', id: item.createdTaskId }
  return null
}

/* --- partial-update payload construction --------------------------------- */

/**
 * What one edit to a row can change. `undefined` on any key means "untouched
 * — leave it out of the save"; `null` on `dueDate` means "clear it". Those
 * two must never collapse into the same wire value, or a save that clears a
 * due date becomes indistinguishable from one that never mentioned it.
 */
export type ActionItemEditPatch = {
  title?: string
  assigneeId?: string | null
  dueDate?: string | null
}

export type SuggestionUpdatePayload = {
  text?: string
  suggestedUserId?: string | null
  suggestedDueDate?: string | null
}

export type TaskUpdatePayload = {
  title?: string
  assigneeId?: string | null
  dueDate?: string | null
}

/**
 * Builds updateTaskSuggestion's payload from a patch, carrying over ONLY the
 * keys the caller actually set. This codebase has been bitten twice by a
 * `.set()` built from a fully-populated object silently overwriting fields
 * nobody meant to touch — a key simply absent from the returned object is
 * what keeps that from happening here too.
 */
export function buildSuggestionUpdatePayload(patch: ActionItemEditPatch): SuggestionUpdatePayload {
  const payload: SuggestionUpdatePayload = {}
  if (patch.title !== undefined) payload.text = patch.title
  if (patch.assigneeId !== undefined) payload.suggestedUserId = patch.assigneeId
  if (patch.dueDate !== undefined) payload.suggestedDueDate = patch.dueDate
  return payload
}

/** Same partial-update discipline as buildSuggestionUpdatePayload, for the
 *  already-a-task path (updateTask's field names). */
export function buildTaskUpdatePayload(patch: ActionItemEditPatch): TaskUpdatePayload {
  const payload: TaskUpdatePayload = {}
  if (patch.title !== undefined) payload.title = patch.title
  if (patch.assigneeId !== undefined) payload.assigneeId = patch.assigneeId
  if (patch.dueDate !== undefined) payload.dueDate = patch.dueDate
  return payload
}

/* --- unresolved due-date hints -------------------------------------------- */

export type DueDateClassification =
  | { kind: 'resolved'; iso: string }
  | { kind: 'unresolved'; raw: string }

/**
 * Classifies a free-text due-date string the same way meeting-notes-model.ts's
 * merged Action-items panel already does (parseSpokenDueDate) — reused
 * rather than reimplemented, so "is this a real date" never has two answers
 * in this codebase. A real, unambiguous date (ISO, or a written-out date that
 * carries a year) resolves to its ISO day; a spoken phrase like "next Friday"
 * — or a model-generated string naming several candidate times at once, e.g.
 * "Today at 4:30 PM, 5:00 PM, or 5:50 PM" — classifies as unresolved and is
 * returned verbatim, never guessed into a date.
 *
 * `meeting_task_suggestions.suggested_due_date` is itself always ISO-or-null
 * by the time it is stored (normalizeDueDate in notes.ts is strict-ISO-only,
 * guarding a Postgres `date` column that cannot hold anything else) — this
 * classifier is for the model's ORIGINAL, looser phrase, which
 * normalizeDueDate would have rejected outright. See findDueDateHint below
 * for where that phrase still exists to classify.
 */
export function classifyDueDateInput(raw: string): DueDateClassification {
  const parsed = parseSpokenDueDate(raw)
  if (parsed) return { kind: 'resolved', iso: format(parsed, 'yyyy-MM-dd') }
  return { kind: 'unresolved', raw }
}

export type DeadlineHintSource = { item: string; due: string }

/** Lowercased, whitespace-collapsed, trailing punctuation dropped — the same
 *  normalization meeting-notes-model.ts's buildActionList merge uses. */
function normalizeForMatch(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!;:]+$/, '')
}

/**
 * Looks for the model's own due-date phrase for a suggestion that has none
 * stored (`suggestedDueDate` is null). One analysis pass writes the same
 * real-world commitment into two separate, unlinked shapes: the structured
 * `actionItems[]` that become task suggestions (suggestedDueDate normalized
 * to strict ISO-or-null before it is ever stored — see normalizeDueDate) and
 * the free-text `deadlines[]` the merged Action-items panel renders as-is
 * (see meeting-notes-model.ts). A date phrase normalizeDueDate rejected —
 * "August 20, 2026" (a real date in a format normalizeDueDate doesn't
 * accept), or a genuinely unparseable "Today at 4:30 PM, 5:00 PM, or 5:50
 * PM" — can still be sitting right there in `deadlines[]`, under the same
 * wording. Matched by EXACT normalized text only, never fuzzy or substring:
 * two different commitments can legitimately share nothing but similar
 * first few words, and a wrong hint is worse than none at all.
 */
export function findDueDateHint(
  suggestionText: string,
  deadlines: DeadlineHintSource[],
): string | null {
  const needle = normalizeForMatch(suggestionText)
  const match = deadlines.find((deadline) => normalizeForMatch(deadline.item) === needle)
  const raw = match?.due?.trim()
  return raw ? raw : null
}
