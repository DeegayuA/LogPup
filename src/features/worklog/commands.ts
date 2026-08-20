import { CalendarOff } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * What Work log contributes to the command center.
 *
 * The old exemption said "logging happens on its page, which is a nav row",
 * and that stopped being true when the page grew a calendar, a day panel and
 * an absence dialog: there are now destinations INSIDE /worklog that the nav
 * row cannot reach. A stale exemption is exactly what registry.test.ts exists
 * to catch, so it is retired rather than reworded.
 *
 * Writing an entry is deliberately NOT here. upsertDailyWorklog is self-only
 * by design — nobody logs a day for somebody else — and a palette row that
 * needed a percentage and a note would be a form pretending to be a command.
 * Nor is a "log today" row: the nav registry already reaches /worklog, and a
 * second row with the same destination is duplication — it shadowed the nav
 * row's "G W" chip, which is how the drift test found it. Only the absence
 * dialog earns a row, because it is a destination the nav row cannot reach.
 */
export const commands: CommandDescriptor[] = [
  {
    id: 'worklog.absence',
    label: 'Declare an absence',
    keywords: ['leave', 'holiday', 'time off', 'sick', 'absent'],
    group: 'create',
    icon: CalendarOff,
    /* The page reads this param and opens the dialog on arrival, the same way
       /apps?new=1 and /meetings?new=1 do. */
    href: '/worklog?absence=1',
  },
]
