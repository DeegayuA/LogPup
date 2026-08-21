/**
 * What a meeting produced, split by WHO produced it.
 *
 * THE SPLIT IS THE ANTI-GAMING FIX, and it runs the opposite way to intuition.
 * A manual follow-up somebody typed afterwards NEVER counts as an output for
 * R1's purposes. If it did, a series could be immunised against review by one
 * person adding one item after each occurrence — which is effort spent proving
 * a meeting was worthwhile rather than making it so.
 *
 * So `aiDerived` is what the analysis found in the room, and `manual` is
 * tracked separately, shown honestly, and read by no rule.
 *
 * Pure.
 */

export interface OutputFacts {
  meetingId: string
  model: string
  /** meeting_followups with createdBy IS NULL — the AI derived it. */
  aiDerivedFollowups: number
  /** createdBy NOT NULL — a human typed it. Never feeds a rule. */
  manualFollowups: number
  /** Counted by status, never by createdTaskId: a suggestion accepted into a
   *  task that was later deleted was still accepted. */
  acceptedTaskSuggestions: number
  /** meeting_ai_notes.deadlines, raw. Possibly null, absent, or not an array. */
  deadlinesJson: unknown
}

export interface OutputCounts { meetingId: string; model: string; aiDerived: number; manual: number }

/** Guarded rather than trusted: `deadlines` is jsonb, so anything that ever
 *  wrote it — including an older model version — could have put a non-array
 *  there. A count that throws would take down the whole board. */
export function deadlinesCount(deadlinesJson: unknown): number {
  return Array.isArray(deadlinesJson) ? deadlinesJson.length : 0
}

export function splitOutputs(facts: OutputFacts): OutputCounts {
  return {
    meetingId: facts.meetingId,
    model: facts.model,
    aiDerived:
      facts.aiDerivedFollowups + facts.acceptedTaskSuggestions + deadlinesCount(facts.deadlinesJson),
    manual: facts.manualFollowups,
  }
}

/** How much of a series was analysed at all. Zero when nothing happened, rather
 *  than a division by zero dressed up as a percentage. */
export function coverageOf(analyzedCount: number, totalCount: number): number {
  return totalCount === 0 ? 0 : analyzedCount / totalCount
}

export interface ModelSegment { model: string; occurrences: OutputCounts[] }

/**
 * Split a series' occurrences at every model boundary.
 *
 * NO RULE MAY COMPARE ACROSS SEGMENTS. Two Gemini versions do not extract
 * follow-ups at the same rate, so "outputs fell after week 3" is a statement
 * about the upgrade, not about the meeting — and proposing somebody shorten a
 * meeting because their model changed is the kind of wrong that destroys trust
 * in every other suggestion.
 *
 * The returned shape has no cross-segment field ON PURPOSE. A consumer that
 * wanted to compare two segments would have to write that comparison itself,
 * in the open, rather than reading a number this module handed it.
 *
 * Input is newest-first, so a run of one model is contiguous.
 */
export function partitionByModel(occurrencesNewestFirst: OutputCounts[]): ModelSegment[] {
  const segments: ModelSegment[] = []
  for (const occurrence of occurrencesNewestFirst) {
    const current = segments[segments.length - 1]
    if (current && current.model === occurrence.model) current.occurrences.push(occurrence)
    else segments.push({ model: occurrence.model, occurrences: [occurrence] })
  }
  return segments
}
