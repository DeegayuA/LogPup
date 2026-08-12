// The judgement the unified Roadmap spine makes about one sprint: is it
// ahead, behind, late, or finished — and the two quiet gaps that make a plan
// slip regardless of the dates.
//
// This module deliberately owns very little. Every number it needs already
// exists as tested, shared logic, and re-deriving any of them here would
// create a second answer to the same question:
//
//   time elapsed      → sprintDayProgress   (apps/app-health.ts)
//   work completed    → completionPct       (apps/app-health.ts)
//   "how far behind"  → BURN_GAP_THRESHOLD  (apps/app-health.ts)
//   self-report gap   → checkinGap          (sprints/checkins.ts)
//
// The one time-versus-work threshold in the product is BURN_GAP_THRESHOLD.
// AppSprintBand draws its bar against it and appHealth scores its verdict on
// it; a spine that used its own number would quietly disagree with both — the
// exact drift the comment in app-sprint-band.tsx warns about.
//
// What IS new here: collapsing phase + burn gap + emptiness into a single
// label a bar can wear, and counting unowned/undated work.

import {
  BURN_GAP_THRESHOLD,
  completionPct,
  sprintDayProgress,
  type AppTaskCounts,
  type SprintProgress,
} from '@/features/apps/app-health'

/** Board counts, in the shape getBoard and ActiveSprintSummary already produce. */
export type StatusCounts = { todo: number; in_progress: number; done: number }

/**
 * app-health speaks in `AppTaskCounts`; the board speaks in per-status counts.
 * One adapter, so neither side has to learn the other's shape.
 */
export function toTaskCounts(counts: StatusCounts, overdue = 0): AppTaskCounts {
  return {
    todo: counts.todo,
    in_progress: counts.in_progress,
    done: counts.done,
    total: counts.todo + counts.in_progress + counts.done,
    // Nothing this module derives reads `overdue` — completionPct and the
    // burn gap are about done-versus-total. It is on AppTaskCounts for the
    // app card's health verdict, so callers that HAVE the number can pass it
    // through rather than the type forcing a lie here.
    overdue,
  }
}

export type SprintHealth = 'not-started' | 'on-track' | 'behind' | 'overdue' | 'complete'

export type SprintRead = {
  health: SprintHealth
  /** 0-100 of the work finished — completionPct. */
  donePct: number
  /** Elapsed time and phase — sprintDayProgress. */
  progress: SprintProgress
  total: number
  done: number
  remaining: number
  /** One plain sentence naming the situation. Never a bare adjective. */
  summary: string
}

/**
 * The whole read on one sprint.
 *
 * Order matters and is the interesting part: "finished" outranks "late", and
 * "late" outranks "behind". A sprint past its end date with work left is
 * overdue — calling that "behind" would understate a deadline that has
 * already gone, and calling a sprint that finished early "behind" because it
 * ran out of days would be simply wrong.
 */
export function readSprint(
  sprint: { startDate: string; endDate: string; status?: 'planned' | 'active' | 'done' },
  counts: StatusCounts,
  today: string,
): SprintRead {
  const tasks = toTaskCounts(counts)
  const progress = sprintDayProgress(sprint.startDate, sprint.endDate, today)
  const donePct = completionPct(tasks)
  const remaining = tasks.todo + tasks.in_progress
  const base = { donePct, progress, total: tasks.total, done: tasks.done, remaining }

  if (tasks.total > 0 && remaining === 0) {
    return { ...base, health: 'complete', summary: `All ${tasks.total} done.` }
  }
  // A sprint somebody CLOSED is finished business, whatever is left on it —
  // teams routinely close a sprint and carry a few cards forward, and calling
  // that "overdue" would leave a permanent red bar on every past sprint the
  // app has ever run. appHealth guards the same judgement the same way
  // (`current.status !== 'done'`), and the guard belongs here rather than in
  // each caller for exactly that reason.
  if (sprint.status === 'done') {
    return {
      ...base,
      health: 'complete',
      summary:
        remaining === 0
          ? `Closed with all ${tasks.total} done.`
          : `Closed with ${remaining} of ${tasks.total} carried forward.`,
    }
  }
  if (progress.phase === 'ended') {
    return {
      ...base,
      health: 'overdue',
      summary:
        tasks.total === 0
          ? 'Ended with nothing planned in it.'
          : `Ended with ${remaining} of ${tasks.total} unfinished.`,
    }
  }
  if (progress.phase === 'upcoming') {
    return {
      ...base,
      health: 'not-started',
      summary:
        tasks.total === 0
          ? 'Starts soon — nothing planned in it yet.'
          : `Starts soon with ${tasks.total} planned.`,
    }
  }
  // An EMPTY running sprint is never "behind": 0% of no work is not evidence
  // of anything, and painting it as at-risk would flag every sprint the
  // moment it opened.
  if (tasks.total > 0 && progress.pct - donePct >= BURN_GAP_THRESHOLD) {
    return {
      ...base,
      health: 'behind',
      // Both halves of the comparison, because the point IS the gap: a reader
      // told only "behind" has to go and find the numbers themselves.
      summary: `${progress.pct}% of the time gone, ${donePct}% of the work done.`,
    }
  }
  return {
    ...base,
    health: 'on-track',
    summary:
      tasks.total === 0
        ? 'Running with nothing planned in it.'
        : `${tasks.done} of ${tasks.total} done, ${daysLeftPhrase(progress.remainingDays)}.`,
  }
}

/**
 * `remainingDays` is "end − today", so 0 means the sprint ends TODAY — not
 * that it is out of time. Saying "0 days left" about a day someone still has
 * to work in reads as a deadline already missed.
 */
function daysLeftPhrase(remainingDays: number): string {
  if (remainingDays <= 0) return 'ends today'
  return `${remainingDays} ${remainingDays === 1 ? 'day' : 'days'} left`
}

export type PlanGaps = {
  /** Unfinished work with nobody on it. */
  unassigned: number
  /** Unfinished work with no due date. */
  undated: number
}

/**
 * The two quiet ways a sprint slips: work nobody owns, and work with no date.
 * Counted over UNFINISHED tasks only — a finished card with no assignee is a
 * bookkeeping detail, not a risk worth a number on screen.
 */
export function planGaps(
  tasks: {
    assignee: { id: string } | null
    dueDate: string | null
    status: 'todo' | 'in_progress' | 'done'
  }[],
): PlanGaps {
  const open = tasks.filter((task) => task.status !== 'done')
  return {
    unassigned: open.filter((task) => task.assignee === null).length,
    undated: open.filter((task) => task.dueDate === null).length,
  }
}
