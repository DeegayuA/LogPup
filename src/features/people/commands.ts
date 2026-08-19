import { History } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * What People contributes. /people itself is a nav row; this is the second
 * page under it, which has no sidebar entry and is otherwise reachable only
 * by knowing the URL or finding the link on /people.
 *
 * Assignment changes (assignUser / updateAssignment / removeAssignment) are
 * admin-only AND need a person and an app, so they stay row actions.
 */
export const commands: CommandDescriptor[] = [
  {
    id: 'people.history',
    label: 'People history',
    keywords: ['allocation history', 'capacity over time', 'who was on what'],
    group: 'navigate',
    icon: History,
    href: '/people/history',
  },
]
