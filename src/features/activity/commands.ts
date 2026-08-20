import { History, Search } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'
import { activityParams } from '@/features/activity/filters'

/**
 * What Activity contributes: ways INTO the trail with a filter already set.
 *
 * Its old exemption — "no palette-invocable action; its page is already a nav
 * row" — described the page, not the surface. /activity is entirely URL-state
 * driven (person, type, app, from, to, q), so every useful question is a
 * distinct destination, and reaching them by hand means landing on the
 * unfiltered feed and rebuilding the filter each time.
 *
 * Every URL is built through activityParams() rather than by string
 * concatenation. That builder is what keeps the eight filter params consistent
 * with what the page parses; a hand-written query string is a second opinion
 * about the same contract and drifts the first time a param is renamed.
 */

/** Today in Asia/Colombo, which is the day the whole product counts by. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date())
}

/* activityParams takes COMPLETE state, not a partial — every filter field is
   required — so a command that sets only a date range still has to say that
   the other four are empty. That is the builder being strict on purpose: an
   optional field would let a caller forget one and silently inherit whatever
   the page had. */
function range(from: string, to: string) {
  return { person: '', type: '', app: '', q: '', from, to }
}

function shiftDays(iso: string, delta: number): string {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

export const commands: CommandDescriptor[] = [
  {
    id: 'activity.today',
    label: "Today's changes",
    keywords: ['activity', 'audit', 'what changed', 'trail'],
    group: 'navigate',
    icon: History,
    get href() {
      const day = today()
      return `/activity?${activityParams(range(day, day))}`
    },
  },
  {
    id: 'activity.week',
    label: 'Changes this week',
    keywords: ['activity', 'audit', 'last seven days', 'recent changes'],
    group: 'navigate',
    icon: History,
    get href() {
      const day = today()
      return `/activity?${activityParams(range(shiftDays(day, -6), day))}`
    },
  },
  {
    id: 'activity.search',
    label: 'Search the audit trail',
    keywords: ['who changed', 'find a change', 'history', 'audit search'],
    group: 'navigate',
    icon: Search,
    href: '/activity',
  },
]
