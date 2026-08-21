import type { ComponentType } from 'react'
import { adminNavItems, navItems } from '@/components/shell/nav-items'
import { isAdminRole } from '@/features/auth/capabilities'
import { settingsNavItem } from '@/features/settings/nav'
import { commands as appsCommands } from '@/features/apps/commands'
import { commands as activityCommands } from '@/features/activity/commands'
import { commands as authCommands } from '@/features/auth/commands'
import { commands as bugsCommands } from '@/features/bugs/commands'
import { commands as intelCommands } from '@/features/intel/commands'
import { commands as maintenanceCommands } from '@/features/maintenance/commands'
import { commands as geminiCommands } from '@/features/gemini/commands'
import { commands as meetingsCommands } from '@/features/meetings/commands'
import { commands as notificationsCommands } from '@/features/notifications/commands'
import { commands as peopleCommands } from '@/features/people/commands'
import { commands as settingsCommands } from '@/features/settings/commands'
import { commands as worklogCommands } from '@/features/worklog/commands'
import type { CommandApi, CommandDescriptor, PaletteContext } from './types'

/**
 * Every static row the command center can show. Single source of truth for
 * the palette the same way components/shell/nav-items.ts is for navigation —
 * the palette maps over this instead of keeping its own copies, so the two
 * can't drift out of sync.
 *
 * ADDING A FEATURE? If it can do anything from a bare query — create a thing,
 * flip a switch, reach a page the sidebar does not list — put a `commands.ts`
 * in your feature directory exporting `commands: CommandDescriptor[]`, and add
 * one import line below. registry.test.ts fails the build if a feature
 * directory has neither a commands.ts nor an entry in its NO_COMMANDS list, so
 * a feature cannot quietly ship invisible to the palette. Most features
 * legitimately have nothing to add — say so there, with a reason.
 *
 * What does NOT belong here: anything needing an id the palette does not have
 * (a meetingId, a taskId, a typed confirm phrase, a file). Those are row
 * actions on the thing itself.
 *
 * Destinations are NOT listed by hand. They are derived from the nav registry
 * below, so a sidebar row, its "G <key>" hint, the key handler and the palette
 * chip are all the same declaration — the drift that made the Work log row
 * advertise a jump nothing listened for.
 */
const FEATURE_COMMANDS: CommandDescriptor[] = [
  ...activityCommands,
  ...appsCommands,
  ...authCommands,
  ...bugsCommands,
  ...geminiCommands,
  ...intelCommands,
  ...maintenanceCommands,
  ...meetingsCommands,
  ...notificationsCommands,
  ...peopleCommands,
  ...settingsCommands,
  ...worklogCommands,
]

/** A row, with everything state-dependent already decided. */
export type ResolvedCommand = {
  id: string
  label: string
  group: CommandDescriptor['group']
  icon: ComponentType<{ className?: string }>
  shortcut?: string
  href?: string
  run?: (api: CommandApi, ctx: PaletteContext) => void | Promise<void>
}

/** Group order in the list. Create sits above destinations, as it does today. */
const GROUP_ORDER: Record<CommandDescriptor['group'], number> = {
  create: 10,
  navigate: 20,
  command: 30,
}

function labelOf(command: CommandDescriptor, ctx: PaletteContext): string {
  return typeof command.label === 'function' ? command.label(ctx) : command.label
}

/**
 * One matching rule for every static row.
 *
 * Before the registry there were four: page labels matched by substring, the
 * theme rows had a special `'theme'.includes(q)` escape hatch, sign-out
 * matched against a fused `'sign out log out'` haystack (so the query "out l"
 * hit it), and the shortcuts row against a four-word one. Same idea, one
 * implementation: the label plus whatever the feature listed as keywords.
 */
function matches(command: CommandDescriptor, ctx: PaletteContext, q: string): boolean {
  if (!q) return true
  const haystack = [labelOf(command, ctx), ...(command.keywords ?? [])]
  return haystack.some((text) => text.toLowerCase().includes(q))
}

/**
 * The destinations, read off the nav registry.
 *
 * The chip is printed only while the jumps are switched on, so a chip is
 * always a promise that those two keys work — see the go-shortcuts opt-out
 * (WCAG 2.1.4) in the palette.
 */
function navCommands(ctx: PaletteContext): CommandDescriptor[] {
  const rows = [
    ...navItems,
    settingsNavItem,
    /* Admin's own nav list, gated through the shared predicate rather than a
       `role === 'admin'` comparison — that comparison goes silently false for
       superadmin under the widened enum, dropping /admin out of the palette
       for the one seat that certainly has it. */
    ...(isAdminRole(ctx.user.role) ? adminNavItems : []),
  ]
  return rows.map((item) => ({
    id: `nav.${item.href}`,
    label: item.label,
    group: 'navigate' as const,
    icon: item.icon,
    shortcut: item.key && ctx.goShortcutsOn ? `G ${item.key.toUpperCase()}` : undefined,
    href: item.href,
  }))
}

/** Every static row this person can use right now, in render order. */
export function paletteCommands(ctx: PaletteContext, query = ''): ResolvedCommand[] {
  const q = query.trim().toLowerCase()
  return [...navCommands(ctx), ...FEATURE_COMMANDS]
    .filter((command) => command.visible?.(ctx) ?? true)
    .filter((command) => matches(command, ctx, q))
    .sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group])
    .map((command) => ({
      id: command.id,
      label: labelOf(command, ctx),
      group: command.group,
      icon: command.icon,
      shortcut: command.shortcut,
      href: command.href,
      run: command.run,
    }))
}

/** Unfiltered, for the drift test and for anything that needs to count rows. */
export const ALL_FEATURE_COMMANDS: readonly CommandDescriptor[] = FEATURE_COMMANDS
