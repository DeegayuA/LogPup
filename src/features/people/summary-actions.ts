'use server'

import { z } from 'zod'
import { loadActor } from '@/features/auth/actor'
import { GeminiError, callGemini } from '@/features/gemini/client'
import { resolveChain } from '@/features/gemini/model-choice'
import { aiFeatureDisabledMessage, getAiPrefs } from '@/features/gemini/prefs'
import { ok, err, type ActionResult } from '@/lib/action-result'
import {
  getPersonFollowups,
  getPersonMeetings,
  getPersonOverview,
  getPersonWorkload,
} from '@/features/people/queries'
import {
  buildPersonSummaryPrompt,
  derivePersonSummary,
  factsFromPersonViews,
  type PersonSummary,
  type PersonSummaryFacts,
} from '@/features/people/summary'

/**
 * The short read at the top of a person's page.
 *
 * Same access rule as the page itself: any active, approved account may look —
 * loadActor is the whole gate, exactly as the person page has no can() check.
 * A summary that required more than the page it sits on would be a tile
 * colleagues see and a hole where it should be for everyone else.
 *
 * Briefing-shaped (see getBriefing in intel/actions.ts): rules always produce
 * a summary from the page's own numbers, and the model — when the feature is
 * on and a key works — rewrites THAT FACT SHEET, never raw rows. Every
 * failure lands on the derived text, so this surface cannot show an error
 * where a person's name should be.
 */
export async function getPersonSummary(personId: string): Promise<ActionResult<PersonSummary>> {
  const actor = await loadActor()
  if (!actor) return err('Not allowed')
  if (!z.uuid().safeParse(personId).success) return err('No one to summarise')

  let facts: PersonSummaryFacts
  try {
    const [overview, workload, followups, meetings] = await Promise.all([
      getPersonOverview(personId),
      getPersonWorkload(personId),
      getPersonFollowups(personId),
      getPersonMeetings(personId, actor.id),
    ])
    if (!overview) return err('No one to summarise')

    facts = factsFromPersonViews({ overview, workload, followups, meetings })
  } catch (error) {
    console.error('[people] summary facts failed:', error)
    return err('Could not read this person’s work right now — try again')
  }

  const now = new Date()
  const derived = (): PersonSummary => ({
    text: derivePersonSummary(facts),
    source: 'derived',
    model: null,
    generatedAtIso: now.toISOString(),
  })

  const disabled = await aiFeatureDisabledMessage(actor.id, 'person-summary')
  if (disabled) return ok(derived())

  try {
    const prefs = await getAiPrefs(actor.id)
    const { text, model } = await callGemini(
      actor.id,
      [{ text: buildPersonSummaryPrompt(facts) }],
      {
        models: resolveChain('person-summary', prefs['person-summary'].model),
        feature: 'person.summary',
      },
    )
    const written = text.trim()
    if (!written) return ok(derived())
    return ok({ text: written, source: 'ai', model, generatedAtIso: now.toISOString() })
  } catch (error) {
    if (!(error instanceof GeminiError)) {
      console.error('[people] summary generation failed:', error)
    }
    return ok(derived())
  }
}
