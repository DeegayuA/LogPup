import { it, expect } from 'vitest'
import { adminNavItems, getVisibleNavItems, navItems, progressNavItem } from './nav-items'

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

it('progress stays out of the nav for a seat that was not granted it', () => {
  const hrefs = getVisibleNavItems(false).map((item) => item.href)
  expect(hrefs).not.toContain(progressNavItem.href)
})

it('a granted seat gets progress after the workspace rows and before Manage', () => {
  const items = getVisibleNavItems(true, true)
  expect(items).toEqual([...navItems, progressNavItem, ...adminNavItems])
})

it('progress and admin are independent gates — a PM gets progress without Manage', () => {
  const hrefs = getVisibleNavItems(false, true).map((item) => item.href)
  expect(hrefs).toContain(progressNavItem.href)
  for (const admin of adminNavItems) expect(hrefs).not.toContain(admin.href)
})

it('every jump letter is unique across the rows a single person can see', () => {
  const keys = getVisibleNavItems(true, true)
    .map((item) => item.key)
    .filter((key): key is string => Boolean(key))
  expect(new Set(keys).size).toBe(keys.length)
})
