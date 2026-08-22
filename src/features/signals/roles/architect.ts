/**
 * The hardest role in the studio to measure, and a scorecard that says so on
 * its own face.
 *
 * An architect's work is mostly a sentence said in a meeting that stopped six
 * people building the wrong thing. There is no row for that. Every artifact
 * metric available — commits, tasks, tickets — measures the thing an architect
 * is specifically paid NOT to spend their time on, so a conventional dashboard
 * ranks the best architect in the building last.
 *
 * TWO CONSEQUENCES, both deliberate.
 *
 * First, VOICE IS THE PRIMARY OUTPUT here, not a supplement.
 * `meeting-load/participation.ts` already established the principle for a
 * different feature — "output count is a proxy for value; discussion is the
 * check on that proxy, and it is allowed to overrule it" — and this role is
 * where that stops being a safeguard and becomes the measurement.
 *
 * Second, the card carries a `caveat` that renders WITH the numbers. Not a
 * tooltip, not a footnote in a spec: a reader deciding something about a
 * person needs the words "this role leaves the least trace" in the same
 * eyeful as the figures, or the figures will be read as complete.
 */

import { cannotSay, inferred, measured, median, type Figure } from '../figure'
import { share, type Scorecard, type SignalWindow } from './shared'

export type ArchitectMeeting = {
  meetingId: string
  /** Voice turns this person took. Zero is a real answer; the meeting happened. */
  voiceTurns: number
  /** Turns by everybody, for the share. Zero when nothing was transcribed. */
  totalTurns: number
  /** False when the meeting was never recorded — see the null handling below. */
  transcribed: boolean
}

export type ArchitectScorecardInput = {
  userId: string
  window: SignalWindow
  /** change_requests this person approved or rejected. */
  decisions: number
  /** Comments they left on work carrying a committed deadline. */
  commentsOnCommitted: number
  meetings: readonly ArchitectMeeting[]
  /** Committed-due tasks in their apps that got any review from them. */
  committedReviewed: number
  committedTotal: number
  /** Follow-ups where `created_by` is this person — a human asking for something. */
  followupsAuthored: number
  /** Distinct apps they touched in the window. */
  appsTouched: number
}

export type ArchitectScorecard = Scorecard<'architect'>

/**
 * Distinct projects past which an architect is spread rather than deployed.
 *
 * A counter-metric, not an achievement. Breadth is the one number on this card
 * that gets WORSE as it rises, and it is here because every other figure
 * improves with it: an architect who attends everything comments on
 * everything, and looks maximally productive right up to the point where they
 * are not thinking about anything.
 */
export const ARCHITECT_BREADTH_CONCERN = 6

export function architectScorecard(input: ArchitectScorecardInput): ArchitectScorecard {
  const figures: Figure[] = []

  figures.push(
    measured({
      key: 'architect.decisions',
      label: 'Decisions recorded',
      value: input.decisions + input.commentsOnCommitted,
      unit: 'count',
      sources: ['change_requests', 'app_comments'],
      counter: 'architect.breadth',
    }),
  )

  // --- The primary output -------------------------------------------------
  //
  // Only TRANSCRIBED meetings count in the denominator. An untranscribed
  // meeting is not a meeting where nobody spoke; it is a meeting nobody
  // recorded, and folding those in would make an architect's score depend on
  // whether somebody else pressed record.
  const heard = input.meetings.filter((m) => m.transcribed && m.totalTurns > 0)
  const turnShare = median(heard.map((m) => Math.round((m.voiceTurns / m.totalTurns) * 100)))
  figures.push(
    turnShare === null
      ? cannotSay({
          key: 'architect.voice-share',
          label: 'Share of the conversation',
          unit: 'percent',
          sources: ['meeting_speakers', 'meeting-load/participation.ts'],
          reason:
            heard.length === 0 && input.meetings.length > 0
              ? 'None of their meetings were recorded — nothing to hear.'
              : 'No meetings attended in this window.',
        })
      : inferred({
          key: 'architect.voice-share',
          label: 'Share of the conversation',
          value: turnShare,
          unit: 'percent',
          sources: ['meeting_speakers', 'meeting-load/participation.ts'],
        }),
  )

  const coverage = share(input.committedReviewed, input.committedTotal)
  figures.push(
    coverage === null
      ? cannotSay({
          key: 'architect.review-coverage',
          label: 'Committed work they looked at',
          unit: 'percent',
          sources: ['tasks.due_kind', 'app_comments', 'change_requests'],
          reason: 'Nothing in their projects carried a committed deadline.',
        })
      : measured({
          key: 'architect.review-coverage',
          label: 'Committed work they looked at',
          value: coverage,
          unit: 'percent',
          sources: ['tasks.due_kind', 'app_comments', 'change_requests'],
        }),
  )

  // `created_by` is non-null only for follow-ups a person added by hand — the
  // AI-derived rows leave it null, which the schema comment calls out as
  // making this column the "was a human asking for this?" flag. So this counts
  // things somebody deliberately chased, not things a model noticed.
  figures.push(
    measured({
      key: 'architect.followups-authored',
      label: 'Follow-ups they raised',
      value: input.followupsAuthored,
      unit: 'count',
      sources: ['meeting_followups.created_by'],
    }),
  )

  figures.push(
    measured({
      key: 'architect.breadth',
      label: 'Projects touched',
      value: input.appsTouched,
      unit: 'count',
      sources: ['activity_log.app_id'],
    }),
  )

  return {
    role: 'architect',
    userId: input.userId,
    window: input.window,
    figures,
    caveat:
      'This role leaves the least machine-readable trace of any in the studio. The strongest '
      + 'evidence of an architect’s week — the design that was talked out of being built — is '
      + 'not in any of these numbers. Read them as a starting point for a conversation, never '
      + 'as a summary of the work.',
  }
}
