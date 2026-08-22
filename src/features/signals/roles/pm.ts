/**
 * What a project manager is answerable for, measured only over the window they
 * actually held the job.
 *
 * A PM does not write the code, so counting output would measure their team.
 * What they own is the difference between what the studio SAID it would do and
 * what it did: promises kept, questions answered, meetings worth attending,
 * and whether anybody is stuck. Every figure below is one of those, and every
 * one of them is paired with the metric that degrades if it is gamed.
 *
 * ATTRIBUTION IS AS-OF, ALWAYS. The caller resolves tenure from
 * `app_role_history`'s half-open intervals and passes only the rows inside it.
 * A PM who inherited a project last Tuesday is not answerable for a deadline
 * agreed in March, and a design that could not express that would make taking
 * over a troubled project a career risk — which is the opposite of what a
 * studio needs from its managers.
 */

import { cannotSay, measured, median, type Figure } from '../figure'
import { daysBetween, share, type Scorecard, type SignalWindow } from './shared'

/** A task that carried a real promise: `due_kind = 'committed'`. */
export type CommittedTask = {
  /** The date first written down, from `tasks.original_due_date`. */
  originalDueDate: string
  /** Null while still open. */
  completedAt: Date | null
  /** `tasks.due_changed_count` — how often the date moved after being set. */
  dueChangedCount: number
}

export type PmFollowup = {
  openedAt: Date
  resolvedAt: Date | null
  /** Null means resolved with nothing written down — see the counter below. */
  resolutionNote: string | null
}

export type PmCheckin = {
  updatedAt: Date
  /** `checkinGap` from sprints/checkins.ts — how far self-report sits from the board. */
  gap: number | null
}

export type PmBlockedTask = {
  /** Assigned, still in `todo`. Unassigned work is a backlog, not a blockage. */
  createdAt: Date
}

export type PmScorecardInput = {
  userId: string
  window: SignalWindow
  asOf: Date
  committed: readonly CommittedTask[]
  followups: readonly PmFollowup[]
  checkins: readonly PmCheckin[]
  blocked: readonly PmBlockedTask[]
  /** Days after which a check-in stops being current. */
  checkinStaleDays: number
}

export type PmScorecard = Scorecard<'pm'>

export function pmScorecard(input: PmScorecardInput): PmScorecard {
  const figures: Figure[] = []

  // --- Promises kept, and the counter that stops it being gamed -----------
  //
  // Measured against ORIGINAL_DUE_DATE, never the current one. That column
  // exists precisely because moving a deadline destroys every other answer to
  // "what did we originally say", and a hit rate computed against the latest
  // date is a hit rate that can be made perfect by editing dates.
  const settled = input.committed.filter((t) => t.completedAt !== null)
  const onTime = settled.filter(
    (t) => t.completedAt !== null && isoOf(t.completedAt) <= t.originalDueDate,
  ).length
  const hitRate = share(onTime, settled.length)
  figures.push(
    hitRate === null
      ? cannotSay({
          key: 'pm.commitment-integrity',
          label: 'Commitments kept',
          unit: 'percent',
          sources: ['tasks.original_due_date', 'tasks.completed_at'],
          counter: 'pm.due-changes',
          reason: 'No committed deadlines closed in this window.',
        })
      : measured({
          key: 'pm.commitment-integrity',
          label: 'Commitments kept',
          value: hitRate,
          unit: 'percent',
          sources: ['tasks.original_due_date', 'tasks.completed_at'],
          counter: 'pm.due-changes',
        }),
  )

  figures.push(
    measured({
      key: 'pm.due-changes',
      label: 'Deadline moves',
      value: input.committed.reduce((sum, t) => sum + t.dueChangedCount, 0),
      unit: 'count',
      sources: ['tasks.due_changed_count'],
    }),
  )

  // --- Questions answered, and whether an answer was actually given -------
  const closed = input.followups.filter((f) => f.resolvedAt !== null)
  const latency = median(
    closed.map((f) => daysBetween(f.openedAt, f.resolvedAt as Date)),
  )
  figures.push(
    latency === null
      ? cannotSay({
          key: 'pm.followup-latency',
          label: 'Follow-up closing time',
          unit: 'days',
          sources: ['meeting_followups'],
          counter: 'pm.followup-unanswered',
          reason: 'Nothing was closed in this window.',
        })
      : measured({
          key: 'pm.followup-latency',
          label: 'Follow-up closing time',
          value: latency,
          unit: 'days',
          sources: ['meeting_followups'],
          counter: 'pm.followup-unanswered',
        }),
  )

  // THE COUNTER TO SPEED. A follow-up can be closed in one second by pressing
  // resolve, and the fastest possible latency is the one where nobody ever
  // wrote what came of it. `resolutionNote` is nullable on purpose (a resolve
  // with no note is still a resolve), which makes this the honest check on the
  // figure above rather than a second opinion about it.
  const unanswered = share(
    closed.filter((f) => (f.resolutionNote ?? '').trim().length === 0).length,
    closed.length,
  )
  figures.push(
    unanswered === null
      ? cannotSay({
          key: 'pm.followup-unanswered',
          label: 'Closed with no answer written',
          unit: 'percent',
          sources: ['meeting_followups.resolution_note'],
          reason: 'Nothing was closed in this window.',
        })
      : measured({
          key: 'pm.followup-unanswered',
          label: 'Closed with no answer written',
          value: unanswered,
          unit: 'percent',
          sources: ['meeting_followups.resolution_note'],
        }),
  )

  // --- Does the PM know where their team actually is ----------------------
  const fresh = input.checkins.filter(
    (c) => daysBetween(c.updatedAt, input.asOf) <= input.checkinStaleDays,
  ).length
  const freshness = share(fresh, input.checkins.length)
  figures.push(
    freshness === null
      ? cannotSay({
          key: 'pm.checkin-freshness',
          label: 'Team check-ins current',
          unit: 'percent',
          sources: ['sprint_checkins.updated_at'],
          counter: 'pm.checkin-gap',
          reason: 'Nobody on this project has a sprint to check in on.',
        })
      : measured({
          key: 'pm.checkin-freshness',
          label: 'Team check-ins current',
          value: freshness,
          unit: 'percent',
          sources: ['sprint_checkins.updated_at'],
          counter: 'pm.checkin-gap',
        }),
  )

  // THE COUNTER TO CHASING. Freshness rises when a PM nags people to update a
  // number; it says nothing about whether the number is true. The gap between
  // self-report and the board is what says that, and a PM collecting fresh
  // reports that disagree with reality has made the problem worse.
  const gaps = input.checkins.map((c) => c.gap).filter((g): g is number => g !== null)
  const medianGap = median(gaps.map(Math.abs))
  figures.push(
    medianGap === null
      ? cannotSay({
          key: 'pm.checkin-gap',
          label: 'Report vs board gap',
          unit: 'percent',
          sources: ['sprints/checkins.ts checkinGap'],
          reason: 'No check-in has a board to compare against yet.',
        })
      : measured({
          key: 'pm.checkin-gap',
          label: 'Report vs board gap',
          value: medianGap,
          unit: 'percent',
          sources: ['sprints/checkins.ts checkinGap'],
        }),
  )

  // --- Is anybody stuck ---------------------------------------------------
  //
  // The OLDEST, not the count: ten cards a day old is a healthy backlog, and
  // one card sitting assigned-and-untouched for six weeks is a person quietly
  // blocked. A mean would hide the second inside the first.
  const oldest = input.blocked.length
    ? Math.max(...input.blocked.map((t) => daysBetween(t.createdAt, input.asOf)))
    : null
  figures.push(
    oldest === null
      ? cannotSay({
          key: 'pm.oldest-blocked',
          label: 'Oldest untouched assignment',
          unit: 'days',
          sources: ['tasks'],
          reason: 'Nothing is sitting assigned and untouched.',
        })
      : measured({
          key: 'pm.oldest-blocked',
          label: 'Oldest untouched assignment',
          value: oldest,
          unit: 'days',
          sources: ['tasks'],
        }),
  )

  return { role: 'pm', userId: input.userId, window: input.window, figures }
}

/** The Colombo calendar day of an instant, matching every other day key here. */
function isoOf(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}
