import { Settings } from 'lucide-react'
import type { NavItem } from '@/components/shell/nav-items'

/**
 * The Settings row, in the same shape every other nav row uses.
 *
 * Declared here rather than appended to `navItems` in
 * components/shell/nav-items.ts so the feature owns its own destination —
 * but it is still ONE declaration imported by both nav surfaces (the desktop
 * Sidebar and the MobileNav sheet), which is the property that actually
 * matters: the two can't drift.
 *
 * No `key` hint: the "G <letter>" shortcuts are for the workspace
 * destinations you bounce between all day, and Settings is not one of them.
 * Adding a shortcut nobody presses only makes the real ones harder to spot.
 */
export const settingsNavItem: NavItem = {
  href: '/settings',
  label: 'Settings',
  icon: Settings,
}
