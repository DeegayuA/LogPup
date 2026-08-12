import { capacityBand } from '@/features/people/components/capacity-bar'
import { FOLLOWUP_STALE_DAYS } from '@/features/people/followup-split'
import type { TaskLoad } from '@/features/people/task-workload'

/**
 * The row of numbers across the top of a person page — the answer to "are they
 * overloaded and what do they owe" before you read a single card.
 *
 * Built as DATA, not as JSX, for two reasons. First, it is the one piece of
 * this page with real branching (which figure is alarming, what the sub-line
 * says, whether a meta line exists at all), so it belongs in a tested module
 * rather than inline in a component. Second, the tiles must never contradict
 * the sections below them: every value here is derived from the same summaries
 * the cards render, so there is no second definition of "overdue" to drift.
 *
 * TONE IS MEANING, NEVER DECORATION. 'alert' is spent only on a number that
 * means someone has to do something (over 100% allocated, work already late,
 * a debt sitting open); 'warn' marks the 80–99% band, which is a heads-up
 * rather than a problem. Everything else is muted chrome. The tone is also
 * reinforced in words by `meta` — colour alone cannot carry it (WCAG 1.4.1),
 * and the near/over pair is precisely what a red/green-blind reader cannot
 * separate.
 */

export type StatTone = 'normal' | 'warn' | 'alert'

export type PersonStat = {
  key: string
  label: string
  value: number
  /** Rendered immediately after the number, e.g. '%'. */
  suffix?: string
  /** One short line under the label. Carries the tone in words. */
  meta?: string
  tone: StatTone
}

export type PersonStatsInput = {
  totalPct: number
  assignmentCount: number
  tasks: TaskLoad
  doneCount: number
  totalTaskCount: number
  meetingsAttended: number
  meetingsWindowDays: number
  followupsOwed: number
  followupsAwaiting: number
  /** Age of their oldest open debt, or null when they owe nothing. */
  followupsOldestOwedDays: number | null
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function allocationMeta(totalPct: number, assignmentCount: number): string {
  const band = capacityBand(totalPct)
  if (band === 'over') return `over by ${totalPct - 100}%`
  if (assignmentCount === 0) return 'not assigned'
  if (band === 'near') return 'near capacity'
  return `${100 - totalPct}% headroom`
}

export function buildPersonStats(input: PersonStatsInput): PersonStat[] {
  const band = capacityBand(input.totalPct)

  return [
    {
      key: 'allocation',
      label: 'Allocated',
      value: input.totalPct,
      suffix: '%',
      meta: allocationMeta(input.totalPct, input.assignmentCount),
      tone: band === 'over' ? 'alert' : band === 'near' ? 'warn' : 'normal',
    },
    {
      key: 'open',
      label: 'Open tasks',
      value: input.tasks.open,
      meta:
        input.tasks.open === 0
          ? 'nothing on their plate'
          : `across ${plural(input.tasks.apps, 'app', 'apps')}`,
      tone: 'normal',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: input.tasks.overdue,
      // The age of the worst offender is the difference between "late" and
      // "abandoned", and it is the one number that changes what you do next.
      meta:
        input.tasks.oldestOverdueDays === null
          ? 'nothing late'
          : `oldest ${plural(input.tasks.oldestOverdueDays, 'day', 'days')} late`,
      tone: input.tasks.overdue > 0 ? 'alert' : 'normal',
    },
    {
      key: 'due-soon',
      label: 'Due this week',
      value: input.tasks.dueSoon,
      meta: input.tasks.dueSoon === 0 ? 'nothing scheduled' : 'next 7 days',
      tone: 'normal',
    },
    {
      key: 'done',
      label: 'Done',
      // Lifetime, not a 30-day rate: `tasks` records no completion timestamp,
      // so "closed recently" cannot be computed without inventing it. Saying
      // "all time" is better than shipping a number that means something else.
      value: input.doneCount,
      meta:
        input.totalTaskCount === 0
          ? 'never assigned a task'
          : `of ${input.totalTaskCount} ever assigned`,
      tone: 'normal',
    },
    {
      key: 'meetings',
      label: 'Meetings',
      value: input.meetingsAttended,
      // "Not declined", stated. `meeting_attendees.response` defaults to
      // 'pending' and most people never touch it, so this figure counts
      // meetings they did not say no to — it is not a register. A tile that
      // said only "last 30 days" would be read as attendance, which is a
      // stronger claim than the data supports.
      meta: `not declined, ${input.meetingsWindowDays}d`,
      tone: 'normal',
    },
    {
      key: 'followups',
      label: 'Owes',
      value: input.followupsOwed,
      meta: followupMeta(input),
      // Graded, not binary. An item raised in this morning's standup is not an
      // emergency, and spending the danger token on it would make the tile red
      // on almost every page — at which point red stops meaning anything. The
      // threshold is FOLLOWUP_STALE_DAYS, the same one the card flags rows
      // with, so tile and row turn red together or not at all.
      tone: followupTone(input.followupsOwed, input.followupsOldestOwedDays),
    },
  ]
}

function followupTone(owed: number, oldestOwedDays: number | null): StatTone {
  if (owed === 0) return 'normal'
  return (oldestOwedDays ?? 0) >= FOLLOWUP_STALE_DAYS ? 'alert' : 'warn'
}

/**
 * The sub-line always names the reason for the tone in words — a reader who
 * cannot separate amber from red still gets "oldest 21 days open" rather than
 * a bare count they have to interpret from the colour.
 */
function followupMeta(input: PersonStatsInput): string {
  if (input.followupsOwed > 0) {
    return input.followupsOldestOwedDays === null
      ? 'open follow-ups'
      : `oldest ${plural(input.followupsOldestOwedDays, 'day', 'days')} open`
  }
  return input.followupsAwaiting > 0 ? `waiting on ${input.followupsAwaiting}` : 'all settled'
}
