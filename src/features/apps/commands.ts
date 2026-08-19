import { Plus } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * What Apps contributes to the command center.
 *
 * Navigation to /apps is not here — destinations come from the nav registry
 * (components/shell/nav-items.ts) so the sidebar hint and the palette chip
 * can never disagree. This file is for the things Apps can DO from a bare
 * query, with no row selected first.
 */
export const commands: CommandDescriptor[] = [
  {
    id: 'apps.new',
    label: 'New app',
    keywords: ['create app', 'add project', 'register app'],
    group: 'create',
    icon: Plus,
    // Opens the New app dialog on arrival — app/(app)/apps/page.tsx reads ?new=1.
    href: '/apps?new=1',
    // Presentation only. createApp() re-checks the role server-side; this just
    // keeps a row nobody can use out of a member's palette.
    visible: (ctx) => ctx.user.role === 'admin',
  },
]
