import { Layers, NotebookPen, Plus } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * What Meetings contributes to the command center. Navigation to /meetings
 * comes from the nav registry; this is the part that needs no row selected.
 *
 * Deliberately short: almost everything else in this feature (reschedule,
 * record, resolve a follow-up, replace text) needs a meetingId the palette
 * does not have. Those belong on the meeting, not in the palette. What is here
 * is what needs no row selected.
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
  {
    id: 'meetings.quick-note',
    label: 'Quick note',
    keywords: ['note', 'notes', 'jot', 'scratchpad', 'notebook', 'capture'],
    group: 'create',
    icon: NotebookPen,
    // The header's split pill owns the actual gesture (private-from-birth
    // meeting, sole attendee: you, lands with the write-up open) — see
    // MeetingHeaderActions.handleQuickNote. This href only asks it to fire:
    // /meetings reads ?new-note=1 the same way it reads ?new=1.
    href: '/meetings?view=list&new-note=1',
  },
  {
    id: 'meetings.load',
    label: 'Meeting load',
    // The words somebody would type when they have the PROBLEM, not the ones
    // they would type if they already knew the feature existed — nobody
    // searches for a rule they have never heard of.
    keywords: ['fewer meetings', 'merge', 'combine', 'load', 'coverage', 'too many meetings'],
    group: 'navigate',
    icon: Layers,
    href: '/meetings/load',
    // No `visible`: the route decides for itself and says so in words. A row
    // that vanished would leave somebody who was told about this page unable
    // to find out why they cannot reach it.
  },
]
