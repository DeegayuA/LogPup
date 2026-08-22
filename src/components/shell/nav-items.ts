import type { ComponentType } from 'react'
import {
  AppWindow,
  CalendarDays,
  GaugeCircle,
  History,
  LayoutDashboard,
  NotebookPen,
  ShieldCheck,
  Users,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  /**
   * Letter for the "g then <key>" jump, if any. This is the single source of
   * truth for it end to end: the sidebar row renders it as a hint, the command
   * center builds its key handler from the same field (GO_TARGETS in
   * features/search/components/command-center.tsx), and the palette's "Go to"
   * list and its chips are derived from this array as well (navCommands in
   * features/search/registry/commands.ts). One row here yields a destination,
   * a working shortcut and a chip teaching it, together. Letters must be
   * unique across this list.
   */
  key?: string
}

// Primary nav, shown to every signed-in user. Single source of truth for
// every surface that renders navigation — the desktop Sidebar and the
// mobile navigation sheet (MobileNav) both map over this instead of
// keeping their own copies, so the two can't drift out of sync.
export const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, key: 'D' },
  // Second, and high on purpose: this is the one page somebody is asked to
  // open every working day, and a daily habit buried under Activity is a
  // daily habit nobody forms.
  { href: '/worklog', label: 'Work log', icon: NotebookPen, key: 'W' },
  // Third, beside the two pages opened every morning, because it answers the
  // question asked before any of the registers below are worth opening: what
  // needs attention today. Open to every signed-in seat — it only restates
  // rows the dashboard already shows the same reader — so it belongs in this
  // ungated list rather than beside Progress.
  { href: '/apps', label: 'Apps', icon: AppWindow, key: 'A' },
  { href: '/people', label: 'People', icon: Users, key: 'P' },
  { href: '/meetings', label: 'Meetings', icon: CalendarDays, key: 'M' },
  // V rather than A, which Apps holds — it is the letter people reach for in
  // "actiVity" once the obvious one is gone. Every other primary destination
  // has a jump letter; this one had none, so the palette listed it without a
  // shortcut and the row never showed one.
  { href: '/activity', label: 'Activity', icon: History, key: 'V' },
]

/**
 * /progress — the studio-wide "who did what, where, how far" view.
 *
 * NOT in `navItems`, and not in `adminNavItems` either, because it fits
 * neither gate: the page is open to anyone whose seat can read somebody
 * else's work log (admin, superadmin, auditor, and the scoped seats —
 * manager and editor), and closed to a member, who is redirected to their
 * own /worklog. A row in `navItems` would offer every member a destination
 * that bounces them; a row in `adminNavItems` would hide it from the PM it
 * was built for.
 *
 * The predicate lives with the page, not here: the (app) layout asks
 * `effectiveGrant(role, employmentType, 'worklog.view')` — the SAME
 * expression the page redirects on — and passes the answer down. One
 * question, asked once, so the row and the page cannot disagree about who
 * may see it.
 *
 * 'R' rather than P (People holds it) — the letter left in "pRogress".
 */
export const progressNavItem: NavItem = {
  href: '/progress',
  label: 'Progress',
  icon: GaugeCircle,
  key: 'R',
}

// Admin-only nav, appended after the primary nav. Gated on `isAdmin` the
// same way in every surface — see getVisibleNavItems below.
export const adminNavItems: NavItem[] = [{ href: '/admin', label: 'Admin', icon: ShieldCheck }]

// All nav items visible to a user with the given permission level, primary
// nav first. Exists mainly so the admin gate is one pure function instead
// of a copy-pasted `isAdmin ? [...] : [...]` in each nav surface.
export function getVisibleNavItems(isAdmin: boolean, canSeeProgress = false): NavItem[] {
  // Progress sits after the workspace destinations and before Manage: it is
  // still a place you go to look at work, not a place you go to administer
  // it. Optional parameter so the four existing call sites and their tests
  // keep their meaning — "no answer given" reads as "not granted", which is
  // the safe direction for a row that leads to a gated page.
  const primary = canSeeProgress ? [...navItems, progressNavItem] : navItems
  return isAdmin ? [...primary, ...adminNavItems] : primary
}
