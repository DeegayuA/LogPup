import { Plus } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * What Meetings contributes to the command center. Navigation to /meetings
 * comes from the nav registry; this is the part that needs no row selected.
 *
 * Deliberately one entry: almost everything else in this feature
 * (reschedule, record, resolve a follow-up, replace text) needs a meetingId
 * the palette does not have. Those belong on the meeting, not in the palette.
 */
export const commands: CommandDescriptor[] = [
  {
    id: 'meetings.new',
    label: 'New meeting',
    keywords: ['schedule', 'book', 'create meeting'],
    group: 'create',
    icon: Plus,
    // app/(app)/meetings/page.tsx opens the form when ?new=1 is present.
    href: '/meetings?new=1',
    // No `visible`: any authenticated member may create a meeting
    // (features/meetings/actions.ts says so at createMeeting).
  },
]
