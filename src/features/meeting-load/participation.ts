/**
 * How much anybody actually said — the veto that stops R1 cancelling a
 * conversation.
 *
 * THE MOST IMPORTANT CORRECTION IN THE DESIGN. Without this, R1 CANCEL-REVIEW
 * reads "no tracked outputs" as "no value" and proposes cancelling a design
 * crit where six people argued for forty minutes and wrote nothing down. Output
 * count is a proxy for value; discussion is the check on that proxy, and it is
 * allowed to overrule it.
 *
 * Pure. The caller pre-filters to VOICE segments and this module trusts that
 * filter rather than re-applying one: the source discrimination is a database
 * question (which segments came from a microphone rather than a paste), and a
 * second opinion here would be a second place for it to go wrong.
 */

export interface VoiceSegment {
  meetingId: string
  /** Null when a segment was transcribed but never resolved to a person. It
   *  still happened — somebody spoke — so it counts as a turn while adding
   *  nobody to the distinct-speaker count. */
  speakerId: string | null
}

export interface OccurrenceParticipation {
  meetingId: string
  turns: number
  mappedSpeakers: number
}

export function participationFor(
  meetingId: string,
  voiceSegments: VoiceSegment[],
): OccurrenceParticipation {
  const mine = voiceSegments.filter((segment) => segment.meetingId === meetingId)
  const speakers = new Set<string>()
  for (const segment of mine) {
    if (segment.speakerId !== null) speakers.add(segment.speakerId)
  }
  return { meetingId, turns: mine.length, mappedSpeakers: speakers.size }
}

export interface ParticipationMedians { medianMappedSpeakers: number; medianVoiceTurns: number }

/** Median, not mean: one workshop occurrence should not drag a quiet series
 *  over the line, and one silent week should not drag a busy one under it. */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function seriesParticipationMedians(
  occurrences: OccurrenceParticipation[],
): ParticipationMedians {
  return {
    medianMappedSpeakers: median(occurrences.map((o) => o.mappedSpeakers)),
    medianVoiceTurns: median(occurrences.map((o) => o.turns)),
  }
}

/** "At most two people talking" — a third voice is a discussion. */
export const PARTICIPATION_VETO_MAX_SPEAKERS = 2
/** "Under ten turns" — ten is not low, so the comparison is strict. */
export const PARTICIPATION_VETO_MAX_TURNS = 10

/**
 * Whether this series is quiet enough that "no outputs" might really mean "no
 * value".
 *
 * BOTH conditions, not either: two people can have a long and consequential
 * conversation, and six people can each say one word. Only the intersection —
 * few speakers AND few turns — is weak enough evidence to let R1 speak.
 */
export function isLowParticipation(medians: ParticipationMedians): boolean {
  return medians.medianMappedSpeakers <= PARTICIPATION_VETO_MAX_SPEAKERS
    && medians.medianVoiceTurns < PARTICIPATION_VETO_MAX_TURNS
}
