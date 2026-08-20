import { History, Users } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'
import {
  COHORT_VIEWS,
  COHORT_VIEW_HINT,
  COHORT_VIEW_LABEL,
  DEFAULT_COHORT_VIEW,
} from '@/features/people/cohort-params'

/**
 * What People contributes. /people itself is a nav row; this is the second
 * page under it, which has no sidebar entry and is otherwise reachable only
 * by knowing the URL or finding the link on /people.
 *
 * Assignment changes (assignUser / updateAssignment / removeAssignment) are
 * admin-only AND need a person and an app, so they stay row actions.
 */
/**
 * One row per cohort view, DERIVED from COHORT_VIEWS rather than listed again.
 *
 * /people is entirely URL-state driven, so each view is a real destination —
 * and reaching one by hand means landing on the roster and clicking across.
 * Deriving means a fifth view added to that array arrives in the palette
 * without anyone remembering this file, which is the same property the nav
 * registry gives the sidebar.
 *
 * The keywords come from COHORT_VIEW_HINT — the sentence already written to
 * say what each view ANSWERS. A person searching "who is on two projects"
 * should find Shared, and that phrasing already exists rather than needing a
 * second, drifting copy here.
 *
 * The default view is skipped: `/people?view=people` and `/people` are the
 * same page, and the nav registry already reaches it. A row for it would
 * shadow that nav row's jump chip — the duplicate-destination trap documented
 * beside the drift test's chip assertion.
 */
const COHORT_COMMANDS: CommandDescriptor[] = COHORT_VIEWS.filter(
  (view) => view !== DEFAULT_COHORT_VIEW,
).map((view) => ({
  id: `people.${view}`,
  label: `People — ${COHORT_VIEW_LABEL[view]}`,
  keywords: [COHORT_VIEW_HINT[view], 'allocation', 'capacity', 'who is on what'],
  group: 'navigate' as const,
  icon: Users,
  href: `/people?view=${view}`,
}))

export const commands: CommandDescriptor[] = [
  ...COHORT_COMMANDS,
  {
    id: 'people.history',
    label: 'People history',
    keywords: ['allocation history', 'capacity over time', 'who was on what'],
    group: 'navigate',
    icon: History,
    href: '/people/history',
  },
]
