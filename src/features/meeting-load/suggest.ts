/**
 * The suggestion engine — R1 to R5, computed live, never stored.
 *
 * WHAT EVERY RULE HAS IN COMMON. Each one reduces meetings that ALREADY EXIST
 * (R6 COVER-TOGETHER, which prevents one that does not, lives in
 * `meetings/coverage.ts` and joins this queue from there). Each is phrased as a
 * question rather than a verdict, because none of them can see what a meeting
 * was for. And each is ADVISORY: accepting one records intent and deep-links
 * into a flow the organizer already owns. Nothing here mutates a meeting, an
 * end time, or an attendee row.
 *
 * NO STORAGE. Open suggestions are recomputed on every render from the numbers
 * on screen; only decisions persist. A stored suggestion goes stale silently,
 * and a stale accusation about somebody's meeting is worse than none.
 *
 * NO RSVP INPUT REACHES ANY RULE, structurally — see `ALLOWED_OCCURRENCE_KEYS`.
 * The .ics invites carry RSVP=TRUE and mail clients never write back, so
 * "pending" measures widget adoption, not intent. A rule that read it would
 * propose cancelling meetings the whole team attends.
 *
 * Pure: no clock, no I/O, no database.
 */

import {
  isLowParticipation,
  seriesParticipationMedians,
  type OccurrenceParticipation,
} from '@/features/meeting-load/participation'
import { purposeToken, purposesCompatible } from '@/features/meetings/series-key'

export type SuggestionKind =
  | 'cancel_review' | 'shorten' | 'share_slot' | 'record_or_review' | 'trim_invite'

export interface AnalyzedOccurrence {
  meetingId: string
  model: string
  /** From density.ts's `splitOutputs`. `manual` is deliberately not on this
   *  type: no rule may read it (see density.ts's anti-gaming note). */
  aiDerivedOutputs: number
  mappedSpeakers: number
  voiceTurns: number
  /** e.g. "2026-W07", for R3's same-week check. */
  isoWeek: string
  /** Sum of hardEvidenceCount across this occurrence's A1 candidates. 0 before
   *  the recommender has any data, which is what keeps R5 silent on day one. */
  hardEvidencePool: number
  /**
   * R5 ONLY, and `undefined` is a load-bearing value.
   *
   * `undefined` means the caller STRUCTURALLY WITHHELD names, and R5 must not
   * fire when it is undefined on any occurrence in scope. This is how the
   * org-facing build makes R5 impossible without a redaction step somebody
   * could forget: `queries.ts` simply never populates the field, so the leak
   * cannot be reintroduced by omission — only by deliberately adding code.
   */
  zeroEvidenceInviteeIds?: string[]
}

export interface SeriesMetrics {
  groupKey: string
  seriesKey: string
  /** The series' display title, for the purpose-token veto in R3. */
  title: string
  appId: string | null
  mergeable: boolean
  established: boolean
  activeRecently: boolean
  organizerId: string
  occurrenceCountInWindow: number
  medianDurationMinutes: number
  invitedHoursPerWeek: number
  /** min(4, occurrenceCountInWindow) — the denominator of coverage. */
  consideredCountLast4: number
  /** Only the ANALYZED occurrences among the last 4, newest first. */
  last4Analyzed: AnalyzedOccurrence[]
  /** Full invite sets of the most recent 3 occurrences, newest first (R3). */
  last3InviteSets: string[][]
}

export interface Suggestion {
  kind: SuggestionKind
  targetKey: string
  groupKeys: string[]
  organizerIds: string[]
  copy: string
  /** The exact numbers shown. Becomes the decision's jsonb snapshot verbatim,
   *  so what somebody decided against is recoverable later. */
  evidence: Record<string, unknown>
}

/**
 * The type-level half of "no waste metric reaches the engine".
 *
 * Asserted as a test rather than left to inspection: a field added to
 * `AnalyzedOccurrence` without a matching entry here fails the build, which is
 * the only kind of guard that cannot rot. `response`, `pending`, `declined` and
 * `attendance` are the words that must never appear.
 */
export const ALLOWED_OCCURRENCE_KEYS = [
  'aiDerivedOutputs', 'hardEvidencePool', 'isoWeek', 'mappedSpeakers',
  'meetingId', 'model', 'voiceTurns', 'zeroEvidenceInviteeIds',
] as const

// --- thresholds, each one a judgment call worth arguing with ----------------

/** Below three occurrences there is no pattern, only a couple of meetings. */
export const R1_MIN_OCCURRENCES = 3
/** Half the recent occurrences must be on the record before "no outputs" is a
 *  statement about the meeting rather than about the recording. */
export const R1_MIN_COVERAGE = 0.5
/** Under 45 minutes there is nothing to give back. */
export const R2_MIN_DURATION_MINUTES = 45
export const R2_MAX_MEDIAN_OUTPUTS = 1
export const R2_MAX_MEDIAN_TURNS = 20
export const DURATION_STEP_MINUTES = 15
/** Four fifths of an invite list in common is the same room twice. */
export const R3_MIN_JACCARD = 0.8
export const R3_MAX_DURATION_MINUTES = 30
export const R3_MIN_SAME_WEEK = 3
/** Four invited-hours a week is a working day of somebody's time. */
export const R4_MIN_HOURS_PER_WEEK = 4
export const R4_MAX_COVERAGE = 0.25
export const R5_MIN_ANALYZED_OF_LAST_3 = 2
export const R5_MIN_ZERO_EVIDENCE_INVITEES = 2

const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

const coverage = (series: SeriesMetrics) =>
  series.consideredCountLast4 === 0 ? 0 : series.last4Analyzed.length / series.consideredCountLast4

/** One decimal, so "6h/week" reads like a number somebody said out loud rather
 *  than a float. */
const oneDecimal = (value: number) => Math.round(value * 10) / 10

/**
 * GATES, applied to every rule without exception.
 *
 * Established: two occurrences in the window, or there is no series to judge.
 * Active recently: something in the last 45 days. This is what ages out the
 * abandoned half of a title-edit fork, which would otherwise sit here forever
 * as a perfectly established series nobody holds any more.
 */
function passesGates(series: SeriesMetrics): boolean {
  return series.established && series.activeRecently
}

// --- R1 CANCEL-REVIEW -------------------------------------------------------

/**
 * A series on the record, producing nothing, with barely anyone talking.
 *
 * THREE THINGS HAVE TO BE TRUE, and the third is the one that matters. Without
 * the participation veto this rule proposes cancelling a forty-turn design crit
 * because nobody filed a follow-up afterwards. Output count is a proxy for
 * value; discussion is the check on that proxy.
 *
 * Only AI-DERIVED outputs count. A manual follow-up typed after the meeting is
 * effort spent proving the meeting mattered, and letting it clear this rule
 * would make the engine trivially gameable.
 *
 * The copy is a REVIEW QUESTION carrying its own caveat, never "this meeting is
 * worthless": the selection bias (unrecorded series are invisible here) is
 * printed on the card rather than left for somebody to discover.
 */
function ruleCancelReview(series: SeriesMetrics): Suggestion | null {
  if (series.occurrenceCountInWindow < R1_MIN_OCCURRENCES) return null
  if (series.last4Analyzed.length < 2) return null
  if (coverage(series) < R1_MIN_COVERAGE) return null
  if (!series.last4Analyzed.every((o) => o.aiDerivedOutputs === 0)) return null

  const participation: OccurrenceParticipation[] = series.last4Analyzed.map((o) => ({
    meetingId: o.meetingId, turns: o.voiceTurns, mappedSpeakers: o.mappedSpeakers,
  }))
  const medians = seriesParticipationMedians(participation)
  if (!isLowParticipation(medians)) return null

  return {
    kind: 'cancel_review',
    targetKey: `cancel_review:${series.groupKey}`,
    groupKeys: [series.groupKey],
    organizerIds: [series.organizerId],
    copy:
      `Review: ${series.occurrenceCountInWindow} recorded occurrences, no tracked outputs, `
      + 'little discussion — cancel or move async? (Unrecorded series are not evaluated.)',
    evidence: {
      occurrenceCountInWindow: series.occurrenceCountInWindow,
      analyzedCount: series.last4Analyzed.length,
      consideredCountLast4: series.consideredCountLast4,
      coverage: coverage(series),
      medianMappedSpeakers: medians.medianMappedSpeakers,
      medianVoiceTurns: medians.medianVoiceTurns,
    },
  }
}

// --- R2 SHORTEN -------------------------------------------------------------

/**
 * A long series that consistently fills less than its slot.
 *
 * COMPARED ONLY AGAINST ITS OWN HISTORY, never an org-wide density threshold: a
 * research sync and a standup produce artifacts at wildly different rates, and
 * a shared yardstick would flag the quieter kind of work for being quiet.
 *
 * THE SAME MODEL THROUGHOUT. Two Gemini versions do not extract at the same
 * rate, so a model change mid-window makes "outputs fell" a statement about the
 * upgrade. Suppressed rather than adjusted for, because there is no honest
 * adjustment.
 *
 * The proposed duration goes in `evidence`, not in the copy: the design gives
 * no exact sentence for R2, and inventing one that reads as spec-given is how a
 * wording nobody approved becomes permanent.
 */
function ruleShorten(series: SeriesMetrics): Suggestion | null {
  if (series.medianDurationMinutes < R2_MIN_DURATION_MINUTES) return null
  if (series.last4Analyzed.length < 2) return null

  // Newest-first, so the current model's run is the leading contiguous block.
  const model = series.last4Analyzed[0].model
  const sameModel = series.last4Analyzed.filter((o) => o.model === model)
  if (sameModel.length < 2) return null
  if (sameModel.length !== series.last4Analyzed.length) return null

  const medianOutputs = median(sameModel.map((o) => o.aiDerivedOutputs))
  const medianTurns = median(sameModel.map((o) => o.voiceTurns))
  if (medianOutputs > R2_MAX_MEDIAN_OUTPUTS) return null
  if (medianTurns >= R2_MAX_MEDIAN_TURNS) return null

  const proposedMinutes = Math.max(
    DURATION_STEP_MINUTES,
    series.medianDurationMinutes - DURATION_STEP_MINUTES,
  )

  return {
    kind: 'shorten',
    targetKey: `shorten:${series.groupKey}`,
    groupKeys: [series.groupKey],
    organizerIds: [series.organizerId],
    copy:
      `${series.medianDurationMinutes} minutes booked, and its own recent occurrences filled `
      + `less — would ${proposedMinutes} be enough?`,
    evidence: {
      medianDurationMinutes: series.medianDurationMinutes,
      proposedMinutes,
      model,
      analyzedOnSameModel: sameModel.length,
      medianAiDerivedOutputs: medianOutputs,
      medianVoiceTurns: medianTurns,
    },
  }
}

// --- R3 SHARE-A-SLOT --------------------------------------------------------

/** |intersection| / |union| over two series' combined recent invite sets. */
export function inviteJaccard(a: string[][], b: string[][]): number {
  const left = new Set(a.flat())
  const right = new Set(b.flat())
  if (left.size === 0 && right.size === 0) return 0
  let shared = 0
  for (const id of left) if (right.has(id)) shared += 1
  const union = left.size + right.size - shared
  return union === 0 ? 0 : shared / union
}

const sameWeekCount = (a: SeriesMetrics, b: SeriesMetrics): number => {
  const weeks = new Set(b.last4Analyzed.map((o) => o.isoWeek))
  return a.last4Analyzed.filter((o) => weeks.has(o.isoWeek)).length
}

/**
 * Two short series, the same people, the same week, the same kind of thing.
 *
 * THE PURPOSE VETO IS WHAT MAKES THIS SAFE. Identical invite lists meeting
 * twice a week is what a standup and a retro look like from the outside, and
 * merging them would destroy both. The token list is shared with R6 through
 * `series-key.ts`, so the two rules cannot disagree about whether two things
 * are the same kind of conversation.
 *
 * A NULL-APP SERIES NEVER MATCHES, including against another null-app series:
 * with no project in common there is nothing to say two meetings are two halves
 * of, and "both belong to nothing" is not a shared context.
 *
 * The copy is a QUESTION, never a redundancy claim.
 */
function ruleShareSlot(a: SeriesMetrics, b: SeriesMetrics): Suggestion | null {
  if (!a.mergeable || !b.mergeable) return null
  if (a.appId === null || b.appId === null) return null
  if (a.appId !== b.appId) return null
  if (a.medianDurationMinutes > R3_MAX_DURATION_MINUTES) return null
  if (b.medianDurationMinutes > R3_MAX_DURATION_MINUTES) return null
  if (!purposesCompatible(purposeToken(a.title), purposeToken(b.title))) return null

  const jaccard = inviteJaccard(a.last3InviteSets, b.last3InviteSets)
  if (jaccard < R3_MIN_JACCARD) return null

  // Both directions: "these two met in the same week" has to hold from each
  // side's own analysed occurrences, or one busy series would carry a quiet one.
  if (sameWeekCount(a, b) < R3_MIN_SAME_WEEK) return null
  if (sameWeekCount(b, a) < R3_MIN_SAME_WEEK) return null

  // Sorted, so the pair has one identity whichever order it was compared in —
  // otherwise dismissing it once would leave the mirror image still showing.
  const pair = [a.groupKey, b.groupKey].sort()
  return {
    kind: 'share_slot',
    targetKey: `share_slot:${pair.join('+')}`,
    groupKeys: pair,
    organizerIds: [a.organizerId, b.organizerId],
    copy: 'Same people, same week — could these share one slot?',
    evidence: {
      jaccard,
      appId: a.appId,
      medianDurationMinutes: [a.medianDurationMinutes, b.medianDurationMinutes],
      sameWeekOccurrences: sameWeekCount(a, b),
    },
  }
}

// --- R4 RECORD-OR-REVIEW ----------------------------------------------------

/**
 * An expensive series nobody has ever recorded.
 *
 * THIS CLOSES THE IMMUNITY LOOPHOLE. Every other rule needs analysed
 * occurrences, so without R4 the way to make a series unreviewable is simply to
 * never record it — and silence becomes strictly safe. This makes it cost
 * something: a series burning four invited-hours a week with nothing on the
 * record gets asked which it wants to be.
 *
 * Both conditions are independently required. Expensive-and-recorded is fine;
 * unrecorded-and-cheap is nobody's problem.
 */
function ruleRecordOrReview(series: SeriesMetrics): Suggestion | null {
  if (series.invitedHoursPerWeek < R4_MIN_HOURS_PER_WEEK) return null
  const cover = coverage(series)
  if (cover >= R4_MAX_COVERAGE) return null

  const hours = oneDecimal(series.invitedHoursPerWeek)
  return {
    kind: 'record_or_review',
    targetKey: `record_or_review:${series.groupKey}`,
    groupKeys: [series.groupKey],
    organizerIds: [series.organizerId],
    copy: `${hours}h/week with no record — worth recording, or worth reviewing?`,
    evidence: {
      invitedHoursPerWeek: series.invitedHoursPerWeek,
      coverage: cover,
      analyzedCount: series.last4Analyzed.length,
      consideredCountLast4: series.consideredCountLast4,
    },
  }
}

// --- R5 TRIM-INVITE ---------------------------------------------------------

/**
 * People invited to every occurrence who have never once been part of one.
 *
 * THE MOST DANGEROUS RULE IN THE ENGINE, and the guards reflect it. It names
 * individuals, and at nine people "2 invitees with no evidence" de-anonymises
 * in seconds — so it renders only to the series organizer and to admins, never
 * anywhere org-facing, and its count is excluded from every aggregate.
 *
 * INTERSECTION ACROSS OCCURRENCES, not union: somebody quiet in one meeting of
 * three is a person having a quiet week, not a person in the wrong room.
 *
 * AND IT CANNOT FIRE WITHOUT NAMES IT WAS GIVEN. `zeroEvidenceInviteeIds`
 * undefined on any occurrence in scope means the caller withheld them, and this
 * returns null rather than working around it. That is what makes the org-facing
 * query safe by construction instead of safe by remembering.
 */
function ruleTrimInvite(series: SeriesMetrics): Suggestion | null {
  const lastThree = series.last4Analyzed.slice(0, 3)
  if (lastThree.length < R5_MIN_ANALYZED_OF_LAST_3) return null
  if (series.last4Analyzed.reduce((sum, o) => sum + o.hardEvidencePool, 0) <= 0) return null

  // The structural redaction guard. Never soften this into a filter or a
  // default: an empty array means "nobody had zero evidence", undefined means
  // "you were not told", and treating them alike is the leak.
  if (lastThree.some((o) => o.zeroEvidenceInviteeIds === undefined)) return null

  let shared: string[] | null = null
  for (const occurrence of lastThree) {
    const ids = new Set(occurrence.zeroEvidenceInviteeIds ?? [])
    shared = shared === null
      ? Array.from(ids)
      : shared.filter((id) => ids.has(id))
  }
  const names = (shared ?? []).sort()
  if (names.length < R5_MIN_ZERO_EVIDENCE_INVITEES) return null

  return {
    kind: 'trim_invite',
    targetKey: `trim_invite:${series.groupKey}`,
    groupKeys: [series.groupKey],
    organizerIds: [series.organizerId],
    copy:
      `No recorded evidence for ${names.length} invitees `
      + `(${lastThree.length} of ${lastThree.length} occurrences analyzed) — make them optional?`,
    evidence: {
      zeroEvidenceInviteeIds: names,
      analyzedOfLast3: lastThree.length,
      hardEvidencePool: series.last4Analyzed.reduce((sum, o) => sum + o.hardEvidencePool, 0),
    },
  }
}

// --- the engine -------------------------------------------------------------

/**
 * Every open suggestion, in a fixed order.
 *
 * `decidedKeys` holds EVERY decided key regardless of status: accepted and
 * dismissed both mean "somebody has answered this", and re-asking would be the
 * engine nagging. A title edit forks the groupKey and legitimately mints a
 * fresh identity — that is documented behaviour, not a leak in the filter.
 */
export function suggest(
  seriesTable: SeriesMetrics[],
  decidedKeys: ReadonlySet<string>,
): Suggestion[] {
  const eligible = seriesTable.filter(passesGates)
  const found: Suggestion[] = []

  for (const series of eligible) {
    const rules: Array<(series: SeriesMetrics) => Suggestion | null> = [
      ruleCancelReview, ruleShorten, ruleRecordOrReview, ruleTrimInvite,
    ]
    for (const rule of rules) {
      const suggestion = rule(series)
      if (suggestion) found.push(suggestion)
    }
  }

  // Sorted pairwise so each pair is considered once, in a stable order.
  const ordered = [...eligible].sort((a, b) => a.groupKey.localeCompare(b.groupKey))
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const suggestion = ruleShareSlot(ordered[i], ordered[j])
      if (suggestion) found.push(suggestion)
    }
  }

  return found
    .filter((suggestion) => !decidedKeys.has(suggestion.targetKey))
    .sort((a, b) => a.targetKey.localeCompare(b.targetKey))
}

/**
 * The one line the org at large ever sees: "2 suggestions with organizers,
 * ~6h/week potential."
 *
 * TRIM-INVITE IS EXCLUDED FROM BOTH NUMBERS. "The count never appears on any
 * org surface in any form" includes the aggregate — a dashboard figure that
 * moves when somebody's invite list is questioned is still a signal about that
 * person, just a slower one.
 *
 * `potentialHoursPerWeek` counts only what a decision could plausibly return,
 * and only from the series' own evidence.
 */
export function aggregateSuggestions(
  suggestions: Suggestion[],
): { count: number; potentialHoursPerWeek: number } {
  const countable = suggestions.filter((s) => s.kind !== 'trim_invite')
  const potentialHoursPerWeek = countable.reduce((sum, suggestion) => {
    const hours = suggestion.evidence.invitedHoursPerWeek
    return sum + (typeof hours === 'number' ? hours : 0)
  }, 0)
  return { count: countable.length, potentialHoursPerWeek: oneDecimal(potentialHoursPerWeek) }
}
