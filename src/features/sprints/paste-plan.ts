import { planFor } from '@/features/sprints/composer-plan'
import type { IntentPerson } from '@/lib/task-intent'

/**
 * Shared shapes and pure logic for the composer's bulk-paste path.
 *
 * Kept free of React and of the server action so the two halves of the
 * feature — the instant local line split the review panel opens with, and the
 * Gemini restructuring behind the "Draft tasks with AI" button — produce the
 * SAME row shape and are unit-tested directly (this repo has no
 * component-test harness; see composer-plan.ts for the same split).
 */

export type PastedTaskDraft = {
  title: string
  description: string | null
  /** ISO `yyyy-mm-dd`, or null. */
  dueDate: string | null
  /** 0–3; 0 means none — same scale as tasks.priority. */
  priority: number
  /** Resolved workspace user id, or null (unassigned OR unmatched name). */
  assigneeId: string | null
  /**
   * The name as written or as the model returned it, kept even when it did
   * not resolve — the review panel says "no match" in words instead of
   * silently dropping a person the paste plainly named.
   */
  assigneeName: string | null
}

/** A paste is "bulk" (worth a review panel instead of landing in the input)
 *  from two lines up, or from one paragraph-sized line — the two shapes a
 *  meeting note arrives in. */
export const PASTE_MIN_LINES = 2
export const PASTE_MIN_PARAGRAPH_CHARS = 200

/** Ceiling on drafted rows, local and AI alike — a hundred-line paste should
 *  be reviewed in slices, not fired at createTask in one loop. */
export const MAX_PASTE_TASKS = 20

export function isBulkPaste(text: string): boolean {
  const lines = nonEmptyLines(text)
  return lines.length >= PASTE_MIN_LINES || text.trim().length >= PASTE_MIN_PARAGRAPH_CHARS
}

function nonEmptyLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** "- fix login", "* fix login", "3. fix login", "• fix login" → "fix login".
 *  Pasted lists carry their markers, and a marker makes a poor task title. */
function stripListMarker(line: string): string {
  return line.replace(/^(?:[-*•–]|\d{1,3}[.)])\s+/, '')
}

/**
 * The instant, free half: one task per pasted line, each line read by the
 * SAME parser the composer already runs on every keystroke (planFor), so
 * "@shanika friday high" in a pasted list resolves exactly as it would have
 * typed. No model call, no cost — the AI button in the panel is for pastes
 * this per-line reading gets wrong (prose, paragraphs, minutes).
 *
 * Multi-assignee lines keep only the first name: the review panel is a draft
 * to edit, and one row per person would silently multiply the count the
 * header just announced.
 */
export function splitPasteLocally(
  text: string,
  people: IntentPerson[],
  today: Date,
): PastedTaskDraft[] {
  return nonEmptyLines(text)
    .map(stripListMarker)
    .filter(Boolean)
    .slice(0, MAX_PASTE_TASKS)
    .map((line): PastedTaskDraft | null => {
      const plan = planFor(line, people, today)
      if (!plan) return null
      const assignee = plan.assignees[0] ?? plan.assignee ?? null
      return {
        title: plan.title,
        description: plan.description,
        dueDate: plan.due,
        priority: plan.priority ?? 0,
        assigneeId: assignee?.id ?? null,
        assigneeName: assignee?.name ?? plan.unresolvedQuery ?? null,
      }
    })
    .filter((draft): draft is PastedTaskDraft => draft !== null)
}

/**
 * Maps a name (from the model, or typed) onto the workspace roster.
 *
 * Deliberately stricter than fuzzy search: an exact full-name match wins; a
 * single unambiguous prefix (whole name or any name part) is accepted;
 * anything else — no match, or two Sams — resolves to null with
 * `matched: false`, and the caller shows the name with a "no match" note.
 * Guessing an assignee is the one mistake a review panel can't surface.
 */
export function resolveAssigneeName(
  name: string | null | undefined,
  people: IntentPerson[],
): { id: string | null; matched: boolean } {
  const query = name?.trim().toLowerCase()
  if (!query) return { id: null, matched: true }

  const exact = people.filter((person) => person.name.trim().toLowerCase() === query)
  if (exact.length === 1) return { id: exact[0].id, matched: true }
  if (exact.length > 1) return { id: null, matched: false }

  const loose = people.filter((person) => {
    const full = person.name.trim().toLowerCase()
    return full.startsWith(query) || full.split(/\s+/).some((part) => part.startsWith(query))
  })
  if (loose.length === 1) return { id: loose[0].id, matched: true }
  return { id: null, matched: false }
}
