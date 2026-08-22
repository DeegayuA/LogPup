import { describe, expect, it } from 'vitest'
import type { Actor, UserRole } from '@/features/auth/capabilities'
import { canReviewWorklogDay, worklogDayAppIds } from '@/features/worklog/review-rules'

const FALCON = 'app-falcon'
const KESTREL = 'app-kestrel'
const APPS = [
  { id: FALCON, name: 'Falcon', slug: 'falcon' },
  { id: KESTREL, name: 'Kestrel', slug: 'kestrel' },
]

const actor = (role: UserRole, scope: string[] = [], id = 'reviewer'): Actor => ({
  id,
  role,
  scopeAppIds: new Set(scope),
})

describe('which projects a day is about', () => {
  it('takes them from the hour entries', () => {
    expect(worklogDayAppIds([{ appId: FALCON }, { appId: null }], null, APPS)).toEqual([FALCON])
  })

  // Somebody who wrote "[Falcon] fixed the importer" and logged no hours has
  // still said the day was about Falcon.
  it('takes them from the note tags when no hours were logged', () => {
    expect(worklogDayAppIds([], 'fixed the importer [Falcon]', APPS)).toEqual([FALCON])
  })

  it('unions both, without duplicating', () => {
    const ids = worklogDayAppIds([{ appId: FALCON }], 'paired on it [Kestrel]', APPS)
    expect(new Set(ids)).toEqual(new Set([FALCON, KESTREL]))
  })

  // A tag naming no real project cannot hand anybody reach.
  it('ignores a tag that names nothing', () => {
    expect(worklogDayAppIds([], 'admin stuff [Nonexistent]', APPS)).toEqual([])
  })
})

describe('who may review a day', () => {
  const falconDay = { userId: 'author', appIds: [FALCON] }

  it('lets an admin review anything, including a day about no project', () => {
    expect(canReviewWorklogDay(actor('admin'), falconDay)).toBe(true)
    expect(canReviewWorklogDay(actor('admin'), { userId: 'author', appIds: [] })).toBe(true)
    expect(canReviewWorklogDay(actor('superadmin'), falconDay)).toBe(true)
  })

  // A manager's scope comes from app_role_history — the pm and lead roles.
  it('lets a lead or PM review a day about their project', () => {
    expect(canReviewWorklogDay(actor('manager', [FALCON]), falconDay)).toBe(true)
  })

  it('refuses a lead a day about a project they do not run', () => {
    expect(canReviewWorklogDay(actor('manager', [KESTREL]), falconDay)).toBe(false)
  })

  // "other users can review if something about their project" — editors and
  // members get there through assignments.
  it('lets somebody working on the project review it', () => {
    expect(canReviewWorklogDay(actor('editor', [FALCON]), falconDay)).toBe(true)
    expect(canReviewWorklogDay(actor('member', [FALCON]), falconDay)).toBe(true)
  })

  it('refuses somebody with no connection to the project', () => {
    expect(canReviewWorklogDay(actor('member', [KESTREL]), falconDay)).toBe(false)
    expect(canReviewWorklogDay(actor('member', []), falconDay)).toBe(false)
  })

  /**
   * A day naming no project is nobody's to review but an admin's. A scoped
   * seat asked about it finds no overlap and fails closed — which is the right
   * answer rather than an oversight, and this is the test that says so.
   */
  it('fails closed for a scoped seat on a day about nothing', () => {
    const noProject = { userId: 'author', appIds: [] }
    expect(canReviewWorklogDay(actor('manager', [FALCON]), noProject)).toBe(false)
    expect(canReviewWorklogDay(actor('editor', [FALCON]), noProject)).toBe(false)
  })

  // Reading everything and changing nothing is the auditor's whole shape, and
  // a review is a change. A client seat commenting on an employee's day is a
  // conversation that does not belong in this product.
  it('refuses an auditor and a stakeholder outright', () => {
    expect(canReviewWorklogDay(actor('auditor', [FALCON]), falconDay)).toBe(false)
    expect(canReviewWorklogDay(actor('stakeholder', [FALCON]), falconDay)).toBe(false)
  })

  describe('your own day', () => {
    const ownDay = { userId: 'me', appIds: [FALCON] }

    it('is not reviewable by you, however much reach you have', () => {
      expect(canReviewWorklogDay(actor('admin', [], 'me'), ownDay)).toBe(false)
      expect(canReviewWorklogDay(actor('manager', [FALCON], 'me'), ownDay)).toBe(false)
    })

    // The one exception, and the same one the absence flow makes: a
    // sole-superadmin workspace must not be a place where nothing is signable.
    it('except by a superadmin, who holds request.review.self', () => {
      expect(canReviewWorklogDay(actor('superadmin', [], 'me'), ownDay)).toBe(true)
    })
  })
})
