import { FOLLOWUP_STALE_DAYS } from '@/features/people/followup-split'
import type { PersonStat } from '@/features/people/person-stats'
import type { TaskLoad } from '@/features/people/task-workload'

/**
 * The four numbers at the top of the dashboard — the signed-in user's own
 * morning briefing, before any team data. Same shape and tone rules as the
 * person page's stat row (person-stats.ts): built as data in a tested module,
 * every value derived from the same summaries the cards below render, tone
 * spent only on meaning and always restated in words by `meta`.
 *
 * Four, not the person page's seven: the dashboard tile row shares the page
 * with three more zones, and lifetime totals (done count, apps spanned)
 * belong on the person page, not in a briefing.
 */
export type MyDayInput = {
  tasks: TaskLoad
  followupsOwed: number
  /** Age of the oldest open debt, or null when they owe nothing. */
  oldestOwedDays: number | null
  meetingsToday: number
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

export function buildMyDayStats(input: MyDayInput): PersonStat[] {
  const { tasks, followupsOwed, oldestOwedDays, meetingsToday } = input
  return [
    {
      key: 'due-soon',
      label: 'Due soon',
      value: tasks.dueSoon,
      meta: tasks.dueSoon > 0 ? 'today & this week' : 'nothing pressing',
      tone: tasks.dueSoon > 0 ? 'warn' : 'normal',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: tasks.overdue,
      meta:
        tasks.overdue > 0 && tasks.oldestOverdueDays !== null
          ? `oldest ${plural(tasks.oldestOverdueDays, 'day', 'days')} late`
          : 'nothing late',
      tone: tasks.overdue > 0 ? 'alert' : 'normal',
    },
    {
      key: 'owed',
      label: 'I owe',
      value: followupsOwed,
      meta:
        followupsOwed === 0
          ? 'all answered'
          : oldestOwedDays !== null && oldestOwedDays >= FOLLOWUP_STALE_DAYS
            ? `oldest ${plural(oldestOwedDays, 'day', 'days')} old`
            : 'follow-ups open',
      tone:
        followupsOwed === 0
          ? 'normal'
          : oldestOwedDays !== null && oldestOwedDays >= FOLLOWUP_STALE_DAYS
            ? 'alert'
            : 'warn',
    },
    {
      key: 'meetings-today',
      label: 'Meetings today',
      value: meetingsToday,
      meta: meetingsToday === 0 ? 'clear calendar' : 'on the calendar',
      tone: 'normal',
    },
  ]
}
