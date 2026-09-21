import { Coins } from 'lucide-react'
import { can, type Actor } from '@/features/auth/capabilities'
import type { CommandDescriptor, PaletteContext } from '@/features/search/registry/types'

/**
 * What Finance contributes to the command center.
 *
 * ONE ROW, the /admin/rates destination — the only reason this feature has a
 * commands.ts at all. `/admin/insights` is already reachable through the
 * ADMIN_SECTIONS-derived rows the sidebar's Manage menu offers; /admin/rates
 * is not (ADMIN_SECTIONS feeds the sidebar, not the palette — see
 * adminNavItems in components/shell/nav-items.ts), so without this row the
 * page is unreachable from ⌘K.
 *
 * GATED THROUGH `can`, NEVER `role === 'admin'` or `isAdminRole` — finance.view
 * is the exact question this row asks, and the registry's own tripwire exists
 * because a bare role comparison silently drops the highest-privilege seat
 * when the role enum widens.
 *
 * NO AMOUNTS in the label or keywords: this row is a destination, not a
 * figure, and ⌘K caches and matches client-side.
 */

/**
 * Scope is deliberately EMPTY, same reasoning as bugs/commands.ts: this
 * module runs in the client bundle, where there is no database to resolve
 * which projects someone reaches. finance.view has no scoped arm (it is
 * 'all' for admin/superadmin and 'none' for everyone else), so an empty
 * scope loses nothing here.
 */
const EMPTY_SCOPE: ReadonlySet<string> = new Set()

function actorFor(ctx: PaletteContext): Actor {
  return { id: ctx.user.id, role: ctx.user.role, scopeAppIds: EMPTY_SCOPE }
}

export const commands: CommandDescriptor[] = [
  {
    id: 'finance.rates',
    label: 'Rates and project value',
    group: 'navigate',
    icon: Coins,
    href: '/admin/rates',
    keywords: [
      'rate',
      'rates',
      'hourly',
      'rate card',
      'project value',
      'contract',
      'subscription',
      'billing',
    ],
    visible: (ctx) => can(actorFor(ctx), 'finance.view'),
  },
]
