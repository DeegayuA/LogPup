/**
 * Turning "what did Alex delete last week" into the audit page's own filters.
 *
 * THE ONE RULE THIS MODULE EXISTS TO ENFORCE: the model may only ever produce
 * a filter state the deterministic filter bar could have produced itself. It
 * proposes VALUES for existing params — never a query, never SQL, never a row
 * set — and everything it proposes is validated against the same vocabularies
 * `parseAuditParams` accepts before it reaches a URL.
 *
 * WHY THAT SHAPE, and not "ask the model for matching rows". An audit log is
 * the record of who did what. A natural-language layer returning ROWS could
 * return a confidently wrong slice of it — the reviewer asks about deletions,
 * gets a plausible list that quietly omits two, and has no way to tell.
 * Constraining the model to filter params means a bad parse shows up as
 * visibly wrong CHIPS over a visibly different result count, on a page where
 * the reader can correct them by hand. The failure becomes legible instead of
 * silent, which is the only version of this feature worth having.
 *
 * Pure and model-free: this builds the prompt and validates the reply. The
 * call itself lives in audit-nl-actions.ts, so every rule here is testable
 * without a key.
 */

import { z } from 'zod'
import { ACTIVITY_ENTITY_TYPES, ACTIVITY_VERBS } from '@/features/activity/types'
import type { AuditParamState } from '@/features/admin/audit-filters'

/** The verbs the log actually writes, as a tuple so zod can build an enum from
 *  them without a second copy of the list living here. */
const VERB_VALUES = [...ACTIVITY_VERBS] as [string, ...string[]]

/**
 * What the model is allowed to set.
 *
 * NOT `sort`, `dir` or `page`: those are how the reader is moving through a
 * result, not what the result IS, and rewriting them from a sentence would
 * throw away the column somebody had just clicked. NOT `actor` either — it is
 * a uuid, and a model asked for one will happily invent a well-formed one.
 * Naming a person is handled as free text in `q`, which matches the actor's
 * name in SQL (audit-queries.ts) and cannot crash the page the way a
 * fabricated uuid would (Postgres 22P02, raised at bind time).
 */
export const auditNlSchema = z.object({
  q: z.string().trim().max(200).optional(),
  // Open vocabularies in the database, but a CLOSED set here: an invented
  // entity type filters to nothing and reads as "there is no such activity",
  // exactly the confident falsehood this feature must not produce. Anything
  // outside the list is dropped, and the chips then show what actually applied.
  type: z.enum(ACTIVITY_ENTITY_TYPES).optional().catch(undefined),
  verb: z.enum(VERB_VALUES).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  self: z.boolean().optional().catch(undefined),
})

export type AuditNlPatch = z.infer<typeof auditNlSchema>

/**
 * The instruction sent to the model.
 *
 * `today` is passed in rather than read here, because "last week" resolves
 * against the workspace's day in Asia/Colombo (toIsoDateInTimeZone) and a pure
 * module must not reach for a clock.
 */
export function buildAuditNlPrompt(question: string, today: string): string {
  return [
    'You convert a question about an audit log into FILTER VALUES for an existing form.',
    'Return JSON with only these keys, omitting any you cannot fill confidently:',
    '',
    '  q      free text matched against the actor name, the entity label, the detail and the verb',
    '  type   one of: ' + ACTIVITY_ENTITY_TYPES.join(', '),
    '  verb   one of: ' + ACTIVITY_VERBS.join(', '),
    '  from   yyyy-mm-dd, inclusive',
    '  to     yyyy-mm-dd, inclusive',
    '  self   true only when the question is specifically about people approving their own requests',
    '',
    `Today is ${today}. Resolve relative dates against it: "last week" is the seven days`,
    'ending today, "yesterday" is a single day where from and to are equal.',
    '',
    'RULES:',
    '- Never invent a type or verb outside the lists above. If the question names something',
    '  not on them, put the word in q instead and leave type and verb out.',
    "- Never put a person's name in anything but q.",
    '- Omit a key rather than guessing. An omitted filter shows everything, which is honest;',
    '  a guessed one hides rows the reader was asking for.',
    '- Return {} if the question does not describe a filter at all.',
    '',
    `QUESTION: ${question}`,
  ].join('\n')
}

/**
 * Applies a validated patch to the state the reader currently has.
 *
 * ADDITIVE over the current filters, with one exception: `page` returns to 1,
 * because staying on page 4 of a result set that just changed shape shows a
 * slice of something nobody asked for, and often nothing at all. Sort and
 * direction are kept — they are the reader's choice, not the model's.
 */
export function applyAuditNlPatch(current: AuditParamState, patch: AuditNlPatch): AuditParamState {
  return {
    ...current,
    q: patch.q ?? current.q,
    type: patch.type ?? current.type,
    verb: patch.verb ?? current.verb,
    from: patch.from ?? current.from,
    to: patch.to ?? current.to,
    self: patch.self ?? current.self,
    page: 1,
  }
}

/**
 * Whether a patch would narrow anything at all.
 *
 * A model returning `{}` for "show me everything" is behaving correctly, and
 * the caller has to say so rather than appearing to do nothing — the reader
 * typed a sentence and is owed an answer about what became of it.
 */
export function isEmptyAuditNlPatch(patch: AuditNlPatch): boolean {
  return (
    !patch.q?.trim() &&
    !patch.type &&
    !patch.verb &&
    !patch.from &&
    !patch.to &&
    patch.self === undefined
  )
}
