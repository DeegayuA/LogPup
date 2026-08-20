'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { callGemini } from '@/features/gemini/client'
import { resolveChain } from '@/features/gemini/model-choice'
import { aiFeatureDisabledMessage, getAiPrefs } from '@/features/gemini/prefs'
import { listActiveUsers } from '@/features/people/queries'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import {
  MAX_PASTE_TASKS,
  resolveAssigneeName,
  type PastedTaskDraft,
} from '@/features/sprints/paste-plan'

/** Roughly four pages of minutes — past this the paste needs trimming, and
 *  saying so beats silently feeding the model half a document. */
const MAX_PASTE_CHARS = 8000

const inputSchema = z
  .string()
  .min(1, 'Nothing to draft from')
  .max(MAX_PASTE_CHARS, 'That paste is too long to draft from — trim it under 8,000 characters')

/**
 * What the model is allowed to hand back, per task. Parsed, never trusted —
 * same rule as suggestSprint. `title` is strict (a draft with no usable title
 * is no draft); the side fields fall back to null instead of failing the
 * whole batch over one malformed date.
 */
const draftSchema = z.object({
  title: z.string().min(1).max(140),
  assignee: z.string().max(120).nullable().catch(null),
  due: z.iso.date().nullable().catch(null),
  priority: z.number().int().min(0).max(3).nullable().catch(null),
  description: z.string().max(2000).nullable().catch(null),
})

// Generous ceiling on the parse (a chatty model), hard cap after (the review
// panel and the createTask loop are sized for MAX_PASTE_TASKS).
const responseSchema = z.object({ tasks: z.array(draftSchema).min(1).max(60) })

/**
 * SPLIT A PASTED PARAGRAPH OR MEETING NOTE INTO TASK DRAFTS.
 *
 * The composer's local line split (paste-plan.ts) already handles pasted
 * lists for free; this is the path for prose — "Shanika will fix login and
 * Sam updates the docs by Friday" — where lines are not tasks. Mirrors
 * suggestSprint exactly: callGemini + responseJson + zod parse + resolveChain
 * + getAiPrefs gate, on the SAME 'sprint-draft' feature preference and the
 * caller's own Gemini keys, so Settings prices and toggles it with the rest
 * of the sprint drafting it belongs to. No new AI_FEATURES entry.
 *
 * READ-ONLY + HUMAN-CONFIRMED. This never creates a task: it fills the review
 * panel and the person edits, unticks or discards rows. The trust boundary
 * stays at createTask, which validates as if the model did not exist.
 *
 * Assignee names come back as text and are resolved HERE against the real
 * roster (resolveAssigneeName): an unmatched or ambiguous name stays visible
 * as words with no id, never a guessed person.
 */
export async function draftTasksFromPaste(
  rawText: unknown,
): Promise<ActionResult<PastedTaskDraft[]>> {
  const session = await auth()
  if (!session?.user?.id) return err('Sign in required')

  const disabled = await aiFeatureDisabledMessage(session.user.id, 'sprint-draft')
  if (disabled) return err(disabled)

  const parsedInput = inputSchema.safeParse(rawText)
  if (!parsedInput.success) return err(parsedInput.error.issues[0].message)
  const text = parsedInput.data

  // The whole workspace, not the app team — same roster the composer resolves
  // typed names against, and for the same reason: "@shanika" naming a real
  // person who is simply not on this app must resolve, not vanish.
  const people = await listActiveUsers()
  const today = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)

  const prompt = [
    'Split the pasted text below into discrete, actionable tasks for a software team, as JSON:',
    '{"tasks": [{"title": string, "assignee": string | null, "due": "YYYY-MM-DD" | null, "priority": 0 | 1 | 2 | 3 | null, "description": string | null}]}',
    '',
    'Rules:',
    '- Only tasks the text actually states or clearly implies. Never invent work.',
    `- At most ${MAX_PASTE_TASKS} tasks. Titles are short imperatives, max 140 characters.`,
    '- "assignee" must be copied EXACTLY from the people list below when the text names who does it; otherwise null. Never guess.',
    `- "due" only when the text states or clearly implies a date. Today is ${today} (Asia/Colombo).`,
    '- "priority": 3 urgent, 2 high, 1 low — only when the text says so; otherwise null.',
    '- "description" only for detail that does not fit the title; otherwise null.',
    '- Keep the language of each task as written — do not translate.',
    '',
    people.length > 0 ? `People:\n${people.map((person) => `- ${person.name}`).join('\n')}` : 'People: (none)',
    '',
    'Pasted text:',
    text,
  ].join('\n')

  try {
    const prefs = await getAiPrefs(session.user.id)
    const { text: response } = await callGemini(session.user.id, [{ text: prompt }], {
      models: resolveChain('sprint-draft', prefs['sprint-draft'].model),
      responseJson: true,
      feature: 'sprint.draft',
    })
    const parsed = responseSchema.safeParse(JSON.parse(response))
    if (!parsed.success) return err('The draft came back malformed — try again')

    const drafts: PastedTaskDraft[] = parsed.data.tasks
      .slice(0, MAX_PASTE_TASKS)
      .map((task) => {
        const resolved = resolveAssigneeName(task.assignee ?? null, people)
        return {
          title: task.title,
          description: task.description ?? null,
          dueDate: task.due ?? null,
          priority: task.priority ?? 0,
          assigneeId: resolved.id,
          assigneeName: task.assignee?.trim() || null,
        }
      })
    return ok(drafts)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/no.*key/i.test(message)) {
      return err('Add a Gemini API key in Profile → Gemini API keys to draft tasks')
    }
    return err('Could not draft tasks right now — try again')
  }
}
