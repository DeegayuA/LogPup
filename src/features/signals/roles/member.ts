/**
 * Everybody else: the person doing the work the other three roles are about.
 *
 * The most conventional card here, and still built with the same refusals. No
 * commit count is presented as productivity — it appears because its ABSENCE
 * is informative (a null tells somebody to link their GitHub account), not
 * because more commits are better. No line counts. No utilisation.
 *
 * `accountedMinutes` deserves its own note. Elsewhere in this repo it is
 * rendered as "Accounted" and the schema comment forbids ever labelling,
 * exporting or tiling it as a percent, because coverage of a scheduled day and
 * a self-scored judgement of that day are different questions that got the
 * same `%` sign once and confused everybody. That ruling holds here: this card
 * reports accounted MINUTES against expected minutes and names it coverage,
 * and it never appears beside `daily_worklogs.percent`.
 */

import { cannotSay, measured, median, percentile, type Figure } from '../figure'
import { daysBetween, perWorkingDay, share, type Scorecard, type SignalWindow } from './shared'

export type MemberCompletion = { createdAt: Date; completedAt: Date }

export type MemberScorecardInput = {
  userId: string
  window: SignalWindow
  completions: readonly MemberCompletion[]
  /**
   * Null when this app cannot see their code at all — no GitHub App
   * configured, or no `users.github_login` set. NEVER zero for that case:
   * "wrote no code" and "we cannot see their code" are different sentences
   * about a person, and only one of them is true.
   */
  commits: number | null
  /** Why commits are null, in words the person can act on. */
  commitsUnavailable: string | null
  /** Minutes logged in the window, by category. */
  minutesByCategory: Readonly<Record<string, number>>
  /** Minutes the schedule expected — working days x the daily expectation. */
  expectedMinutes: number
  /** Sum of `assignments.allocation_pct` across their projects. */
  allocationPct: number
}

export type MemberScorecard = Scorecard<'member'>

export function memberScorecard(input: MemberScorecardInput): MemberScorecard {
  const figures: Figure[] = []

  const cycles = input.completions.map((c) => daysBetween(c.createdAt, c.completedAt))
  const p50 = median(cycles)
  const p90 = percentile(cycles, 90)
  figures.push(
    p50 === null
      ? cannotSay({
          key: 'member.cycle-p50',
          label: 'Typical time to finish',
          unit: 'days',
          sources: ['tasks.created_at', 'tasks.completed_at'],
          counter: 'member.cycle-p90',
          reason: 'No tracked task of theirs finished in this window.',
        })
      : measured({
          key: 'member.cycle-p50',
          label: 'Typical time to finish',
          value: p50,
          unit: 'days',
          sources: ['tasks.created_at', 'tasks.completed_at'],
          counter: 'member.cycle-p90',
        }),
    p90 === null
      ? cannotSay({
          key: 'member.cycle-p90',
          label: 'Slowest tenth',
          unit: 'days',
          sources: ['tasks.created_at', 'tasks.completed_at'],
          reason: 'No tracked task of theirs finished in this window.',
        })
      : measured({
          key: 'member.cycle-p90',
          label: 'Slowest tenth',
          value: p90,
          unit: 'days',
          sources: ['tasks.created_at', 'tasks.completed_at'],
        }),
  )

  const rate = perWorkingDay(input.completions.length, input.window.workingDays)
  figures.push(
    rate === null
      ? cannotSay({
          key: 'member.completions',
          label: 'Tasks finished a day',
          unit: 'perWorkingDay',
          sources: ['tasks.completed_at'],
          reason: 'No working days in this window — leave, or a closed period.',
        })
      : measured({
          key: 'member.completions',
          label: 'Tasks finished a day',
          value: Math.round(rate * 10) / 10,
          unit: 'perWorkingDay',
          sources: ['tasks.completed_at'],
        }),
  )

  figures.push(
    input.commits === null
      ? cannotSay({
          key: 'member.commits',
          label: 'Commits',
          unit: 'count',
          sources: ['github/evidence.ts'],
          reason: input.commitsUnavailable ?? 'This workspace cannot see their commits.',
        })
      : measured({
          key: 'member.commits',
          label: 'Commits',
          value: input.commits,
          unit: 'count',
          sources: ['github/evidence.ts'],
        }),
  )

  // WHAT THE TIME WENT INTO, never a judgement about the mix. A quarter spent
  // mostly on 'support' is what an on-call rotation looks like, and a card
  // that scored 'task' higher than 'review' would be telling seniors to stop
  // reviewing.
  const logged = Object.values(input.minutesByCategory).reduce((a, b) => a + b, 0)
  const taskShare = share(input.minutesByCategory.task ?? 0, logged)
  figures.push(
    taskShare === null
      ? cannotSay({
          key: 'member.effort-task-share',
          label: 'Time on tracked tasks',
          unit: 'percent',
          sources: ['worklog_entries.category'],
          reason: 'No time logged in this window.',
        })
      : measured({
          key: 'member.effort-task-share',
          label: 'Time on tracked tasks',
          value: taskShare,
          unit: 'percent',
          sources: ['worklog_entries.category'],
        }),
  )

  const coverage = share(logged, input.expectedMinutes)
  figures.push(
    coverage === null
      ? cannotSay({
          key: 'member.coverage',
          label: 'Day accounted for',
          unit: 'percent',
          sources: ['worklog_entries.minutes', 'work_schedules'],
          reason: 'Nothing was expected of them in this window.',
        })
      : measured({
          key: 'member.coverage',
          label: 'Day accounted for',
          value: coverage,
          unit: 'percent',
          sources: ['worklog_entries.minutes', 'work_schedules'],
        }),
  )

  figures.push(
    measured({
      key: 'member.allocation',
      label: 'Allocated across projects',
      value: input.allocationPct,
      unit: 'percent',
      sources: ['assignments.allocation_pct'],
    }),
  )

  return { role: 'member', userId: input.userId, window: input.window, figures }
}
