import { it, expect } from 'vitest'
import { adminNavItems, getVisibleNavItems, navItems } from './nav-items'

it('non-admin sees only the primary nav items', () => {
  expect(getVisibleNavItems(false)).toEqual(navItems)
})

it('non-admin result excludes every admin-only href', () => {
  const hrefs = getVisibleNavItems(false).map((item) => item.href)
  for (const admin of adminNavItems) {
    expect(hrefs).not.toContain(admin.href)
  }
})

it('admin sees the primary nav items plus the admin-only items', () => {
  expect(getVisibleNavItems(true)).toEqual([...navItems, ...adminNavItems])
})

it('admin result includes every admin-only href', () => {
  const hrefs = getVisibleNavItems(true).map((item) => item.href)
  for (const admin of adminNavItems) {
    expect(hrefs).toContain(admin.href)
  }
})
