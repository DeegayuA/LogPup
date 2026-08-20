import type { Observation, ObservationKind } from '@/features/worklog/entry-check'

/**
 * The AI half of the worklog cross-check: PHRASING, and nothing else.
 *
 * PURE. NO DATABASE, NO MODEL, NO CLOCK — same contract as entry-check.ts, and
 * for the same reason: the guarantee this module carries has to be pinned by
 * tests that never reach a network.
 *
 * WHAT THIS MODULE IS FOR. `findDiscrepancies` has ALREADY decided what is
 * worth saying about a day. It returns observations that each carry a plain
 * sentence which is safe to render verbatim. The model is asked to rewrite
 * those sentences a little more naturally, and that is the whole job. It is
 * never asked to look at the entries, never asked whether an observation is
 * justified, and never given the chance to add a seventh kind.
 *
 * WHY THE RESTRAINT IS STRUCTURAL RATHER THAN A PROMPT INSTRUCTION. An AI that
 * invents a discrepancy about how somebody spent their working day is worse
 * than no check at all — it accuses a person of something the app cannot
 * actually see. A prompt saying "do not invent" is a request; the three rules
 * below are the enforcement:
 *
 *   1. `buildEntryCheckPrompt` THROWS on an empty observation list, so the
 *      "silence costs nothing" rule cannot be lost to a refactor that forgets
 *      the caller's early return. Zero observations must never reach a model.
 *   2. `applyPhrasing` maps the reply 1:1 onto the observations that were
 *      sent, BY ID. An id we did not send is dropped. An id we did send but
 *      that came back missing, empty, over-long or off-tone keeps its original
 *      sentence. The output array is always the same length, order and kinds
 *      as the input — the model can change WORDS and nothing else.
 *   3. Every number in a rewritten sentence must already appear in that
 *      observation's own facts or its original sentence. A phrase that
 *      introduces a figure nobody computed is rejected outright, because a
 *      fabricated number in "3 hours have no matching activity" is exactly the
 *      kind of quiet wrongness a person cannot check and will not forgive.
 *
 * TONE. The observations are observational by construction (see entry-check.ts)
 * and a rewrite must not undo that. The person was there and the app was not.
 */

/** One line of the reply, before it is trusted. */
export type PhrasedLine = { id: number; message: string }

/**
 * How long a rewritten observation may be. Roughly the length of the longest
 * sentence entry-check.ts already produces, plus room to breathe — long enough
 * that nothing has to be truncated mid-thought, short enough that the model
 * cannot append a paragraph of advice onto a fact.
 */
export const PHRASE_MAX_CHARS = 240

/**
 * Words that turn an observation into an accusation. Rejecting the phrase and
 * keeping the computed sentence costs nothing; letting one through costs the
 * person's trust in the whole feature.
 *
 * Deliberately small. This is a backstop for the prompt, not a content filter:
 * a long list would start rejecting innocent sentences, and the fallback for a
 * rejected phrase is the original wording, which is always fine.
 */
const ACCUSATORY = /\b(lazy|lying|lied|dishonest|slacking|wrong|should have|failed to|padding)\b/i

/** Every number a phrase is allowed to contain, as written. */
function allowedNumbers(observation: Observation): Set<string> {
  const found = new Set<string>()
  const harvest = (text: string) => {
    for (const match of text.matchAll(/\d+(?:\.\d+)?/g)) found.add(match[0])
  }

  // The computed sentence first: it is what the phrase is a rewrite OF, so
  // every figure already in it is fair game ("6.5 hours", "2 entries").
  harvest(observation.message)

  for (const value of Object.values(observation.facts)) {
    if (typeof value === 'number') {
      // Both the raw minutes and the hours the sentence would render them as —
      // a rewrite may reasonably reach for either.
      found.add(String(value))
      found.add(String(Math.round((value / 60) * 10) / 10))
    } else if (typeof value === 'string') {
      harvest(value)
    } else {
      for (const item of value) harvest(item)
    }
  }
  return found
}

/**
 * Is this rewrite of `observation` safe to show?
 *
 * Exported for the tests, which is the point: the rule is the guarantee, so it
 * is asserted directly rather than inferred from applyPhrasing's output.
 */
export function isSafePhrasing(observation: Observation, candidate: string): boolean {
  const phrase = candidate.replace(/\s+/g, ' ').trim()
  if (phrase.length === 0 || phrase.length > PHRASE_MAX_CHARS) return false
  if (ACCUSATORY.test(phrase)) return false

  const allowed = allowedNumbers(observation)
  for (const match of phrase.matchAll(/\d+(?:\.\d+)?/g)) {
    if (!allowed.has(match[0])) return false
  }
  return true
}

/** What one observation looks like on its way INTO the prompt. */
function promptLine(observation: Observation, id: number): string {
  const facts = Object.entries(observation.facts)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(' | ') : String(value)}`)
    .join(', ')
  return `${id}. kind=${observation.kind}, tone=${observation.severity}\n`
    + `   facts: ${facts}\n`
    + `   current wording: ${observation.message}`
}

/**
 * The prompt, built ENTIRELY from what `findDiscrepancies` returned.
 *
 * The model never sees the entries, the meetings, the activity log or the
 * schedule — only the observations and their computed facts. It therefore has
 * nothing to reason FROM even if it were asked to, which is a stronger promise
 * than any instruction in the text below.
 *
 * THROWS on an empty list rather than returning an unusable prompt. Zero
 * observations is the common case and must cost nothing at all: no prompt, no
 * request, no ledger row. Making that a throw means the caller's early return
 * is load-bearing code rather than an optimisation somebody can tidy away.
 */
export function buildEntryCheckPrompt(input: {
  name: string
  day: string
  observations: readonly Observation[]
}): string {
  if (input.observations.length === 0) {
    throw new Error(
      'buildEntryCheckPrompt called with no observations. Silence is the common case: '
      + 'when findDiscrepancies returns nothing, do not call the model at all.',
    )
  }

  const lines = input.observations.map((o, i) => promptLine(o, i + 1)).join('\n\n')

  return `You are rewording notes that LogPup will show ${input.name} about the time entries they just saved for ${input.day}. They wrote those entries about their own day.

${lines}

Every note above has ALREADY been decided by a calculation. Your only job is the wording.

Rules:
- Return one rewording for EVERY id above, and for NO other id. Do not merge two notes, do not split one, do not add a note of your own.
- Say only what that note's facts say. NEVER introduce a number, a task, a meeting or a conclusion that is not in its facts or its current wording.
- OBSERVATIONAL, never accusatory. The person was there; LogPup was not. Describe what the app can see and stop. Never say they were wrong, never tell them what they should have done, never guess why.
- tone=note is a quiet remark — being heads-down for hours is normal work, not a finding. tone=question is worth a glance because the likely explanation is a correctable slip in the entry (a mistyped duration, one entry saved twice, a meeting nobody logged).
- One sentence, at most 25 words, plain English. No markdown, no bullets, no emoji.
- These are HOURS OF LOGGED TIME. They are not a score and not a percentage of anything — never describe them as one.
- This is a Sri Lankan team that code-switches between Sinhala and English. Write in English and keep task, project and meeting names exactly as they appear above.

Respond as JSON, exactly this shape: {"observations": [{"id": number, "message": string}]}`
}

/** Everything applyPhrasing is willing to read out of a reply. */
function readLines(raw: string): PhrasedLine[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  const list = (parsed as { observations?: unknown })?.observations
  if (!Array.isArray(list)) return []

  const lines: PhrasedLine[] = []
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue
    const { id, message } = item as { id?: unknown; message?: unknown }
    if (typeof id !== 'number' || !Number.isInteger(id)) continue
    if (typeof message !== 'string') continue
    lines.push({ id, message })
  }
  return lines
}

/**
 * The reply, folded back onto the observations it was asked about.
 *
 * THE RETURN IS ALWAYS `observations` — same length, same order, same kinds,
 * same severities, same facts. Only `message` can differ, and only where the
 * rewrite passed `isSafePhrasing`. Anything else the model sent is DROPPED
 * rather than rendered: an id nobody asked about is not an extra insight, it
 * is the model deciding something about somebody's working day on its own.
 *
 * A reply that is not JSON, or is JSON of the wrong shape, is not an error —
 * it costs the nicer wording and nothing else, because every observation
 * already arrived with a sentence that is safe to show.
 */
export function applyPhrasing(
  observations: readonly Observation[],
  raw: string,
): Observation[] {
  const byId = new Map<number, string>()
  for (const line of readLines(raw)) {
    // First writer wins: a duplicated id is the model answering twice, and
    // silently preferring the later answer would hide that it did.
    if (!byId.has(line.id)) byId.set(line.id, line.message)
  }

  return observations.map((observation, index) => {
    const candidate = byId.get(index + 1)
    if (candidate === undefined || !isSafePhrasing(observation, candidate)) return observation
    return { ...observation, message: candidate.replace(/\s+/g, ' ').trim() }
  })
}

/** Re-exported so a UI can narrow on kinds without importing two modules. */
export type { Observation, ObservationKind }
