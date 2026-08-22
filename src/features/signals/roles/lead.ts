/**
 * What a tech lead is answerable for — including the figure that says the lead
 * has become the bottleneck.
 *
 * A lead's output is mostly other people's throughput, so three of the six
 * figures here are about how fast work moves PAST them rather than how much
 * moves through them. The fourth is `personal WIP`, and it is a headline
 * rather than a footnote on purpose: the failure mode of a good engineer
 * promoted to lead is taking the hard tasks personally, which looks like
 * heroism on any output metric and reads as a queue to everybody waiting.
 *
 * SPEED IS ALWAYS PAIRED WITH ESCAPE. Review throughput can be doubled this
 * afternoon by approving without reading, and nothing in a review count can
 * tell the difference. Defects opened shortly after a completion can, which is
 * why the two ship as a pair and neither is meaningful alone.
 */

import { cannotSay, measured, median, percentile, type Figure } from '../figure'
import { daysBetween, perWorkingDay, share, type Scorecard, type SignalWindow } from './shared'

export type LeadReview = { at: Date; verdict: 'approved' | 'rejected' | 'commented' }

export type LeadCompletion = {
  taskId: string
  createdAt: Date
  completedAt: Date
  /** Bugs filed against this app within DEFECT_WINDOW_DAYS of this completion. */
  defectsAfter: number
}

export type LeadAssignment = {
  /** When it landed on somebody's plate in `todo`. */
  assignedAt: Date
  /** First move out of `todo`, or null if it is still sitting there. */
  firstMovedAt: Date | null
}

export type LeadScorecardInput = {
  userId: string
  window: SignalWindow
  asOf: Date
  reviews: readonly LeadReview[]
  completions: readonly LeadCompletion[]
  assignments: readonly LeadAssignment[]
  /** Tasks assigned to the LEAD themselves, currently `in_progress`. */
  ownInProgress: number
  /** Tasks on this board that went done -> reopened in the window. */
  reopened: number
}

export type LeadScorecard = Scorecard<'lead'>

/**
 * How long after a completion a new bug still counts against it.
 *
 * Fourteen days: long enough that a defect somebody hit in the next sprint is
 * caught, short enough that a bug found in November is not blamed on August's
 * review. It is a proxy and is labelled `inferred` for exactly that reason —
 * a bug filed near a completion is not proof the completion caused it.
 */
export const DEFECT_WINDOW_DAYS = 14

/**
 * Personal in-flight tasks past which a lead is a queue rather than a helper.
 *
 * Not a hard rule and not enforced anywhere — it is the point at which the
 * figure is worth reading twice.
 */
export const LEAD_WIP_CONCERN = 5

export function leadScorecard(input: LeadScorecardInput): LeadScorecard {
  const figures: Figure[] = []

  // --- Speed, and the thing that makes speed meaningless ------------------
  const throughput = perWorkingDay(input.reviews.length, input.window.workingDays)
  figures.push(
    throughput === null
      ? cannotSay({
          key: 'lead.review-throughput',
          label: 'Reviews a day',
          unit: 'perWorkingDay',
          sources: ['change_requests', 'app_comments'],
          counter: 'lead.defect-escape',
          reason: 'No working days in this window.',
        })
      : measured({
          key: 'lead.review-throughput',
          label: 'Reviews a day',
          value: Math.round(throughput * 10) / 10,
          unit: 'perWorkingDay',
          sources: ['change_requests', 'app_comments'],
          counter: 'lead.defect-escape',
        }),
  )

  const escaped = share(
    input.completions.filter((c) => c.defectsAfter > 0).length,
    input.completions.length,
  )
  figures.push(
    escaped === null
      ? cannotSay({
          key: 'lead.defect-escape',
          label: `Completions followed by a bug (${DEFECT_WINDOW_DAYS}d)`,
          unit: 'percent',
          sources: ['bug_reports', 'tasks.completed_at'],
          reason: 'Nothing was completed on this board in the window.',
        })
      : {
          // INFERRED, not measured. A bug filed a week after a completion is
          // near it in time; nothing in this schema says it was caused by it.
          // Labelling it `measured` would let a proxy be argued with as if it
          // were a fact about somebody's judgement.
          key: 'lead.defect-escape',
          label: `Completions followed by a bug (${DEFECT_WINDOW_DAYS}d)`,
          value: escaped,
          unavailable: null,
          basis: 'inferred' as const,
          unit: 'percent' as const,
          sources: ['bug_reports', 'tasks.completed_at'],
        },
  )

  // --- How long work waits before anybody starts it -----------------------
  const started = input.assignments.filter((a) => a.firstMovedAt !== null)
  const unblock = median(started.map((a) => daysBetween(a.assignedAt, a.firstMovedAt as Date)))
  figures.push(
    unblock === null
      ? cannotSay({
          key: 'lead.unblock-latency',
          label: 'Wait before work starts',
          unit: 'days',
          sources: ['activity_log', 'tasks'],
          reason: 'Nothing assigned in this window has been started yet.',
        })
      : measured({
          key: 'lead.unblock-latency',
          label: 'Wait before work starts',
          value: unblock,
          unit: 'days',
          sources: ['activity_log', 'tasks'],
        }),
  )

  // --- Cycle time, at BOTH ends of the distribution -----------------------
  //
  // p50 and p90 together, never p50 alone. The median says what a normal task
  // feels like; p90 says what the worst week of the quarter felt like, and it
  // is the number a team actually complains about. Reporting only the median
  // is how a board with a healthy middle and a horrifying tail reads as fine.
  const cycles = input.completions.map((c) => daysBetween(c.createdAt, c.completedAt))
  const p50 = median(cycles)
  const p90 = percentile(cycles, 90)
  figures.push(
    p50 === null
      ? cannotSay({
          key: 'lead.cycle-p50',
          label: 'Typical time to finish',
          unit: 'days',
          sources: ['tasks.created_at', 'tasks.completed_at'],
          counter: 'lead.cycle-p90',
          reason: 'Nothing was completed on this board in the window.',
        })
      : measured({
          key: 'lead.cycle-p50',
          label: 'Typical time to finish',
          value: p50,
          unit: 'days',
          sources: ['tasks.created_at', 'tasks.completed_at'],
          counter: 'lead.cycle-p90',
        }),
    p90 === null
      ? cannotSay({
          key: 'lead.cycle-p90',
          label: 'Slowest tenth',
          unit: 'days',
          sources: ['tasks.created_at', 'tasks.completed_at'],
          reason: 'Nothing was completed on this board in the window.',
        })
      : measured({
          key: 'lead.cycle-p90',
          label: 'Slowest tenth',
          value: p90,
          unit: 'days',
          sources: ['tasks.created_at', 'tasks.completed_at'],
        }),
  )

  // --- Is the lead the queue ----------------------------------------------
  figures.push(
    measured({
      key: 'lead.personal-wip',
      label: 'Tasks the lead is holding',
      value: input.ownInProgress,
      unit: 'count',
      sources: ['tasks.assignee_id', 'tasks.status'],
    }),
  )

  const reopenRate = share(input.reopened, input.completions.length + input.reopened)
  figures.push(
    reopenRate === null
      ? cannotSay({
          key: 'lead.reopen-rate',
          label: 'Finished work reopened',
          unit: 'percent',
          sources: ['activity_log'],
          reason: 'Nothing finished or reopened on this board in the window.',
        })
      : measured({
          key: 'lead.reopen-rate',
          label: 'Finished work reopened',
          value: reopenRate,
          unit: 'percent',
          sources: ['activity_log'],
        }),
  )

  return { role: 'lead', userId: input.userId, window: input.window, figures }
}
