'use server'

import { z } from 'zod'
import { requireCapability } from '@/features/auth/actor'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { callGemini } from '@/features/gemini/client'
import { resolveChain } from '@/features/gemini/model-choice'
import { getAiPrefs } from '@/features/gemini/prefs'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import {
  applyAuditNlPatch,
  auditNlSchema,
  buildAuditNlPrompt,
  isEmptyAuditNlPatch,
} from '@/features/admin/audit-nl'
import {
  auditQueryString,
  parseAuditParams,
  type AuditParamState,
} from '@/features/admin/audit-filters'

/**
 * "Ask in words" for the audit page.
 *
 * THE MODEL NEVER SEES THE AUDIT LOG. It is sent the question and two closed
 * vocabularies, and it returns filter VALUES — so this feature cannot leak the
 * record of who did what into a prompt, and cannot answer with rows it
 * invented. What comes back is validated in audit-nl.ts, applied to the
 * reader's current filters, and serialised through the SAME `auditQueryString`
 * the filter bar uses. The result is a URL the deterministic form could have
 * produced by hand, which is what makes a bad parse visible as wrong chips
 * rather than a silently wrong slice of the record.
 *
 * Gated on `audit.view`, the capability that already decides who may read this
 * page. There is nothing separate to grant: somebody who can read the log can
 * ask a question about it, and somebody who cannot never reaches here.
 */

const askInput = z.object({
  question: z.string().trim().min(3).max(300),
  /** The reader's current URL params, so the patch lands on what they see. */
  params: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
})

export type AuditAskResult = {
  /** Where the page should navigate. Already serialised, already validated. */
  href: string
  /** The state behind that href, so the caller can show what actually applied. */
  state: AuditParamState
}

export async function askAuditFilters(input: {
  question: string
  params?: Record<string, string | string[]>
}): Promise<ActionResult<AuditAskResult>> {
  const actor = await requireCapability('audit.view')
  if (!actor) return err('Admins only')

  const parsed = askInput.safeParse(input)
  if (!parsed.success) return err('Ask a question of at least a few words.')

  // Read straight off the prefs already in hand rather than calling
  // aiFeatureDisabledMessage: that helper re-reads the same row to answer the
  // same question, and this action needs `prefs` a line later anyway for the
  // model choice.
  const prefs = await getAiPrefs(actor.id)
  if (!prefs['audit-filter'].enabled) return err('This AI feature is off in your Settings.')

  const current = parseAuditParams(parsed.data.params ?? {})
  // Colombo's today, not the server's: "last week" has to mean the same seven
  // days here as every other date on the page (lk-holidays.ts owns that rule).
  const today = toIsoDateInTimeZone(new Date())

  let text: string
  try {
    ;({ text } = await callGemini(
      actor.id,
      [{ text: buildAuditNlPrompt(parsed.data.question, today) }],
      {
        models: resolveChain('audit-filter', prefs['audit-filter'].model),
        responseJson: true,
        feature: 'audit.filter',
      },
    ))
  } catch (error) {
    // callGemini throws GeminiError carrying messages already written for
    // people ("No active Gemini API keys — add one in Profile."), so they pass
    // straight through rather than being flattened into a generic failure.
    return err(error instanceof Error ? error.message : 'The request failed — try again')
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    console.error('[audit] askAuditFilters: model returned non-JSON', text.slice(0, 200))
    return err('Could not read that as a filter — try rephrasing, or set the filters directly.')
  }

  const patch = auditNlSchema.safeParse(raw)
  if (!patch.success) {
    return err('Could not read that as a filter — try rephrasing, or set the filters directly.')
  }
  if (isEmptyAuditNlPatch(patch.data)) {
    // Said out loud rather than navigating to an unchanged page: the reader
    // typed a sentence, and "nothing happened" with no explanation reads as a
    // broken feature.
    return err('That did not describe a filter. Try naming a person, an action, or a date range.')
  }

  const state = applyAuditNlPatch(current, patch.data)
  const query = auditQueryString(state)
  return ok({ href: query ? `/admin/audit?${query}` : '/admin/audit', state })
}
