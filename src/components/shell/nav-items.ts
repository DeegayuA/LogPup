import type { ComponentType } from 'react'
import { AppWindow, CalendarDays, History, LayoutDashboard, ShieldCheck, Users } from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** "G <key>" keyboard shortcut hint shown on hover/focus, if any. */
  key?: string
}

// Primary nav, shown to every signed-in user. Single source of truth for
// every surface that renders navigation — the desktop Sidebar and the
// mobile navigation sheet (MobileNav) both map over this instead of
// keeping their own copies, so the two can't drift out of sync.
export const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, key: 'D' },
  { href: '/apps', label: 'Apps', icon: AppWindow, key: 'A' },
  { href: '/people', label: 'People', icon: Users, key: 'P' },
  { href: '/meetings', label: 'Meetings', icon: CalendarDays, key: 'M' },
  { href: '/activity', label: 'Activity', icon: History },
]

// Admin-only nav, appended after the primary nav. Gated on `isAdmin` the
// same way in every surface — see getVisibleNavItems below.
export const adminNavItems: NavItem[] = [{ href: '/admin', label: 'Admin', icon: ShieldCheck }]

// All nav items visible to a user with the given permission level, primary
// nav first. Exists mainly so the admin gate is one pure function instead
// of a copy-pasted `isAdmin ? [...] : [...]` in each nav surface.
export function getVisibleNavItems(isAdmin: boolean): NavItem[] {
  return isAdmin ? [...navItems, ...adminNavItems] : navItems
}
