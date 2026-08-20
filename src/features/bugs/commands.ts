import { Bug } from 'lucide-react'
import { can, type Actor } from '@/features/auth/capabilities'
import type { CommandDescriptor, PaletteContext } from '@/features/search/registry/types'

/**
 * What Bugs contributes to the command center.
 *
 * ONE ROW, and it is a destination the sidebar does not list. "Report a bug"
 * is deliberately NOT here: filing needs a project, the palette has no
 * selected project, and a create row that lands you somewhere to pick one is
 * slower than the affordance already sitting on the app page. The row that
 * IS worth a keystroke is the queue — the thing a triager opens ten times a
 * day and can currently only reach by walking through /admin.
 *
 * GATED THROUGH `can`, NOT `isAdminRole`. The apps and admin rows use the
 * predicate because "is this person staff" is genuinely what they ask;
 * `bug.view` is not a staff question — it is 'all' for manager and auditor
 * too, and scoped below that. Asking the matrix gets those four seats right
 * and keeps this row honest when a grant changes, which a role list cannot.
 *
 * Presentation only, as every `visible` in this registry is: /admin/bugs
 * guards itself on arrival.
 *
 * `can` is safe on this side of the boundary — capabilities.ts is pure and
 * synchronous with no database and no next/headers, which is exactly why it
 * was written that way (see its header).
 */

/**
 * Scope is deliberately EMPTY here.
 *
 * The palette knows a session, not an actor: resolving which projects someone
 * reaches is one database query per request, and this module runs in the
 * client bundle where there is no database at all. `can` fails a scoped grant
 * closed when the resource is missing, so an editor or member — whose
 * `bug.view` is scoped — does not get the workspace-wide queue offered to
 * them, which is the correct answer rather than a lucky one.
 */
const EMPTY_SCOPE: ReadonlySet<string> = new Set()

function actorFor(ctx: PaletteContext): Actor {
  return { id: ctx.user.id, role: ctx.user.role, scopeAppIds: EMPTY_SCOPE }
}

export const commands: CommandDescriptor[] = [
  {
    id: 'bugs.triage-queue',
    label: 'Bug triage',
    keywords: ['bugs', 'defects', 'open bugs', 'broken', 'issues', 'triage'],
    group: 'navigate',
    icon: Bug,
    href: '/admin/bugs',
    visible: (ctx) => can(actorFor(ctx), 'bug.view'),
  },
]
