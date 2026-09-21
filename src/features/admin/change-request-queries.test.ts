import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor, UserRole } from '@/features/auth/capabilities'

// getApprovalsInbox is one SELECT with two joins, filtered in memory through
// the real mayReview — same "fake db, real routing" idiom as
// change-request-actions.test.ts. What's worth pinning here is the leadId
// join itself: the column lives on `apps`, not `changeRequests`, and a
// broken join would silently make every app-entity request look lead-less
// (mayReview degrading it to admin-only) rather than throwing.
const { rows } = vi.hoisted(() => ({ rows: [] as unknown[][] }))

vi.mock('@/db', () => ({
  db: {
    select: () => {
      const chain: Record<string, unknown> = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: () => chain,
        orderBy: () => ({
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(rows.shift() ?? []).then(resolve, reject),
        }),
        limit: () => chain,
      }
      return chain
    },
  },
}))

const { getApprovalsInbox } = await import('./change-request-queries')

const actor = (id: string, role: UserRole, scoped: string[] = []): Actor => ({
  id, role, scopeAppIds: new Set(scoped),
})

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'cr-1',
  requesterId: 'pm-1',
  requesterName: 'PM One',
  entityType: 'app',
  entityId: 'app-1',
  entityLabel: 'LogPup',
  operation: 'edit',
  reason: 'rename',
  appId: 'app-1',
  status: 'pending',
  createdAt: new Date('2026-09-01'),
  payload: {},
  leadId: 'lead-1',
  ...over,
})

beforeEach(() => {
  rows.length = 0
})

describe('getApprovalsInbox — app-entity leadId join', () => {
  it('drops an app-entity row for a co-PM who is not its lead', async () => {
    rows.push([row()])
    const inbox = await getApprovalsInbox(actor('co-pm', 'manager', ['app-1']))
    expect(inbox).toHaveLength(0)
  })

  it('keeps the row for the app’s named lead', async () => {
    rows.push([row()])
    const inbox = await getApprovalsInbox(actor('lead-1', 'manager', ['app-1']))
    expect(inbox).toHaveLength(1)
    expect(inbox[0].id).toBe('cr-1')
  })

  it('keeps the row for an admin regardless of lead', async () => {
    rows.push([row()])
    const inbox = await getApprovalsInbox(actor('a1', 'admin'))
    expect(inbox).toHaveLength(1)
  })

  it('never leaks leadId or payload onto the returned row', async () => {
    rows.push([row()])
    const inbox = await getApprovalsInbox(actor('lead-1', 'manager', ['app-1']))
    expect(inbox[0]).not.toHaveProperty('leadId')
    expect(inbox[0]).not.toHaveProperty('payload')
  })
})
