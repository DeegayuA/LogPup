import { describe, expect, it } from 'vitest'
import { ADMIN_SECTIONS, visibleSections } from '@/features/admin/sections'
import type { Actor, UserRole } from '@/features/auth/capabilities'

const actor = (role: UserRole): Actor => ({ id: 'a', role, scopeAppIds: new Set() })
const hrefs = (role: UserRole) => visibleSections(actor(role)).map((s) => s.href)

describe('visibleSections', () => {
  it('shows a superadmin everything, danger zone included', () => {
    expect(hrefs('superadmin')).toEqual(ADMIN_SECTIONS.map((s) => s.href))
  })

  it('shows an admin everything except the danger zone', () => {
    expect(hrefs('admin')).not.toContain('/admin/danger')
    expect(hrefs('admin')).toContain('/admin/trash')
  })

  it('gives an auditor read sections and no danger zone', () => {
    const seen = hrefs('auditor')
    expect(seen).toContain('/admin/audit')
    expect(seen).toContain('/admin/trash')
    expect(seen).not.toContain('/admin/danger')
    expect(seen).not.toContain('/admin/approvals')
  })

  it('gives a stakeholder nothing at all', () => {
    // The client seat must not learn the admin area exists.
    expect(hrefs('stakeholder')).toEqual([])
  })

  it('gives editor and member nothing at all', () => {
    expect(hrefs('editor')).toEqual([])
    expect(hrefs('member')).toEqual([])
  })

  it('gives a manager the sections their scope makes sense of', () => {
    const seen = hrefs('manager')
    expect(seen).toContain('/admin')
    expect(seen).toContain('/admin/people')
    expect(seen).not.toContain('/admin/danger')
  })
})
