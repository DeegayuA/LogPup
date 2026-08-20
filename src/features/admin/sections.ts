import type { Action, Actor } from '@/features/auth/capabilities'
import { can } from '@/features/auth/capabilities'

/**
 * The admin area's sections, and the capability each one requires.
 *
 * ONE list, read by both the nav and the route guards, so the two cannot
 * disagree. A nav that offers a section the guard refuses is a bug report; a
 * guard that permits a section the nav hides is a feature nobody finds.
 */
export type AdminSection = {
  href: string
  label: string
  description: string
  capability: Action
  /** Rendered apart from the rest, below a rule. */
  danger?: boolean
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    href: '/admin',
    label: 'Overview',
    description: 'Org health, coverage and what is waiting on someone',
    capability: 'admin.view',
  },
  {
    href: '/admin/people',
    label: 'People',
    description: 'Seats, status, schedules and scope',
    // NOT user.view.directory — that is the /people page, which an editor and
    // a member both legitimately hold. This section manages seats, so it asks
    // the narrower question: user.view.detail is 'all' for staff and auditor
    // and 'scoped' below, and a scoped grant asked without a resource fails
    // closed. Admin, manager and auditor in; editor, member, stakeholder out.
    capability: 'user.view.detail',
  },
  {
    href: '/admin/approvals',
    label: 'Approvals',
    description: 'Signups, change requests and leave, in one queue',
    capability: 'request.review',
  },
  {
    href: '/admin/apps',
    label: 'Apps',
    description: 'Projects, assignments and stakeholder access',
    capability: 'app.edit',
  },
  {
    href: '/admin/bugs',
    label: 'Bugs',
    description: 'Every open bug in the workspace, newest first',
    // NOT admin.view. bug.view is 'all' for staff, manager and auditor and
    // 'scoped' for editor and member — and a scoped grant asked with no
    // resource fails closed, which is the right answer for a workspace-wide
    // queue: an editor reads the bugs on their own projects' tabs, not
    // everybody's in one list.
    capability: 'bug.view',
  },
  {
    href: '/admin/absences',
    label: 'Absences',
    description: 'Leave, work schedules and company holidays',
    capability: 'absence.view',
  },
  {
    href: '/admin/holidays',
    label: 'Holidays',
    description: 'Company-wide shutdown days, on top of the gazetted calendar',
    capability: 'holiday.manage',
  },
  {
    href: '/admin/audit',
    label: 'Audit trail',
    description: 'Every change, with who made it and when',
    capability: 'audit.view',
  },
  {
    href: '/admin/trash',
    label: 'Trash',
    description: 'Deleted items, and putting them back',
    capability: 'trash.view',
  },
  {
    href: '/admin/danger',
    label: 'Danger zone',
    description: 'Irreversible workspace operations',
    capability: 'danger.dbclear',
    danger: true,
  },
]

/** Sections this actor may actually open. */
export function visibleSections(actor: Actor): AdminSection[] {
  return ADMIN_SECTIONS.filter((s) => can(actor, s.capability))
}
