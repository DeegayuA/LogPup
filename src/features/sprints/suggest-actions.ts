'use server'

import { z } from 'zod'
import { and, desc, eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { meetingAiNotes, meetings, sprints, tasks } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { callGemini } from '@/features/gemini/client'

export type SprintSuggestion = { name: string; goal: string }

/**
 * What the model is allowed to hand back. Parsed, never trusted: a malformed
 * response becomes a user-facing error, not a crash or a silently empty form.
 * Bounds mirror the sprint form's own limits so a suggestion can never be
 * un-submittable.
 */
const suggestionSchema = z.object({
  name: z.string().min(2).max(60),
  goal: z.string().min(4).max(300),
})

/**
 * DRAFT A SPRINT'S NAME AND GOAL from what the app has actually been doing.
 *
 * The wiring is the point: the model sees three things this codebase already
 * records, linked here for the first time —
 *
 * - **The backlog and stragglers**: open task titles (capped), which say what
 *   the next stretch of work IS.
 * - **Prior sprint names + goals**: so the suggestion continues the naming
 *   convention ("Sprint 12", "Hardening", …) instead of inventing a new one.
 * - **Recent meeting write-ups**: the AI summaries already stored on this
 *   app's meetings, which carry the decisions the backlog has not caught up
 *   with yet.
 *
 * READ-ONLY + HUMAN-CONFIRMED. This never creates a sprint: it fills two form
 * fields and the person edits or discards them. The trust boundary stays at
 * `createSprint`, which validates as if the model did not exist.
 *
 * Costs one Gemini call on the CALLER's own keys (the same pool as meeting
 * notes — see gemini/client.ts key rolling). No keys → a plain error that
 * names the fix.
 */
export async function suggestSprint(appId: unknown): Promise<ActionResult<SprintSuggestion>> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')

  const parsedId = z.uuid().safeParse(appId)
  if (!parsedId.success) return err('Invalid app')

  // Three small reads, batched — same rule as every page in this codebase:
  // never serialize what can run together.
  const [openTasks, pastSprints, recentNotes] = await Promise.all([
    db
      .select({ title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(and(eq(tasks.appId, parsedId.data), ne(tasks.status, 'done')))
      .orderBy(desc(tasks.createdAt))
      .limit(25),
    db
      .select({ name: sprints.name, goal: sprints.goal })
      .from(sprints)
      .where(eq(sprints.appId, parsedId.data))
      .orderBy(desc(sprints.startDate))
      .limit(5),
    db
      .select({ title: meetings.title, summary: meetingAiNotes.summary })
      .from(meetingAiNotes)
      .innerJoin(meetings, eq(meetings.id, meetingAiNotes.meetingId))
      .where(eq(meetings.appId, parsedId.data))
      .orderBy(desc(meetings.startsAt))
      .limit(3),
  ])

  if (openTasks.length === 0 && recentNotes.length === 0) {
    return err('Nothing to draft from yet — add a few tasks or hold a meeting first')
  }

  const prompt = [
    'Draft a sprint name and sprint goal for a software team, as JSON: {"name": string, "goal": string}.',
    'The name must be short (under 8 words). If previous sprint names follow a pattern (numbering, themes), continue that pattern.',
    'The goal is 1-2 sentences, concrete, about the outcomes the open work and recent decisions point to. No marketing language.',
    '',
    pastSprints.length > 0
      ? `Previous sprints, newest first:\n${pastSprints
          .map((sprint) => `- ${sprint.name}${sprint.goal ? ` — ${sprint.goal}` : ''}`)
          .join('\n')}`
      : 'This is the first sprint for this app.',
    '',
    openTasks.length > 0
      ? `Open tasks:\n${openTasks.map((task) => `- [${task.status}] ${task.title}`).join('\n')}`
      : 'No open tasks.',
    '',
    recentNotes.length > 0
      ? `Recent meeting write-ups:\n${recentNotes
          // Summaries can be long; the first ~600 chars carry the decisions.
          .map((note) => `## ${note.title}\n${(note.summary ?? '').slice(0, 600)}`)
          .join('\n')}`
      : '',
  ].join('\n')

  try {
    const { text } = await callGemini(session.user.id, [{ text: prompt }], { responseJson: true })
    const parsed = suggestionSchema.safeParse(JSON.parse(text))
    if (!parsed.success) return err('The draft came back malformed — try again')
    return ok(parsed.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/no.*key/i.test(message)) {
      return err('Add a Gemini API key in Profile → Gemini API keys to draft sprints')
    }
    return err('Could not draft a sprint right now — try again')
  }
}
