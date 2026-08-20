import { beforeEach, describe, expect, it, vi } from 'vitest'

// Removing somebody from the workspace is the heaviest thing an admin can do
// to another account — no session, by any provider, until it is undone. The
// UI will hide the control, but a server action stays a directly-callable
// endpoint, so these call removeUser the way an attacker would and assert the
// guard both refuses AND never opens a removal row.
//
// NOT deactivation (setUserActive). That leaves the account able to sign in
// and be told it is deactivated; these tests are about the other state.
const { authMock, insertSpy, selectQueue } = vi.hoisted(() => ({
  authMock: vi.fn(),
  insertSpy: vi.fn(),
  selectQueue: [] as unknown[][],
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: vi.fn() }))
vi.mock('@/db', () => ({
  db: {
    // One shared queue: the action's reads run strictly in source order (the
    // target lookup, then the other-superadmin count only when the target is
    // one), so order is meaningful here in a way it is not in getTrash's
    // Promise.all.
    select: () => ({
      from: () => ({
        where: async () => selectQueue.shift() ?? [],
      }),
    }),
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        insertSpy(values)
      },
    }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  },
}))

const { removeUser } = await import('./actions')

const TARGET_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_ID = '22222222-2222-4222-8222-222222222222'

const asAdmin = () =>
  authMock.mockResolvedValue({ user: { id: ADMIN_ID, role: 'admin', active: true } })

beforeEach(() => {
  authMock.mockReset()
  insertSpy.mockReset()
  selectQueue.length = 0
})

describe('removeUser authorization', () => {
  it('refuses a signed-out caller and opens no removal', async () => {
    authMock.mockResolvedValue(null)
    const res = await removeUser(TARGET_ID)
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('refuses a member calling the action directly and opens no removal', async () => {
    authMock.mockResolvedValue({ user: { id: 'member-1', role: 'member', active: true } })
    const res = await removeUser(TARGET_ID)
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  // Removal is strictly heavier than user.deactivate, which a manager DOES
  // hold for their own team — deciding somebody is no longer part of the
  // studio is not project work, so the manager seat is refused here.
  it('refuses a manager, who may deactivate their own team but not remove anyone', async () => {
    authMock.mockResolvedValue({ user: { id: 'manager-1', role: 'manager', active: true } })
    const res = await removeUser(TARGET_ID)
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('fails closed on a session with no role at all', async () => {
    authMock.mockResolvedValue({ user: { id: 'ghost-1' } })
    const res = await removeUser(TARGET_ID)
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('checks the seat before anything else — junk input still gets the seat refusal', async () => {
    authMock.mockResolvedValue({ user: { id: 'member-1', role: 'member', active: true } })
    const res = await removeUser('not-a-uuid', 'x'.repeat(500))
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

describe('removeUser refusals that protect the workspace', () => {
  it('refuses to remove yourself — the session that would undo it goes with you', async () => {
    asAdmin()
    const res = await removeUser(ADMIN_ID)
    expect(res).toEqual({ ok: false, error: 'Cannot remove your own account' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('refuses the last superadmin, the same guard the role and active changes use', async () => {
    asAdmin()
    selectQueue.push([{ name: 'Only Superadmin', role: 'superadmin' }]) // target
    selectQueue.push([{ count: 0 }]) // no OTHER active, approved superadmin
    const res = await removeUser(TARGET_ID)
    expect(res).toEqual({ ok: false, error: 'Cannot remove the last superadmin' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('allows removing a superadmin while another one is still standing', async () => {
    asAdmin()
    selectQueue.push([{ name: 'One Of Two', role: 'superadmin' }])
    selectQueue.push([{ count: 1 }])
    const res = await removeUser(TARGET_ID)
    expect(res.ok).toBe(true)
    expect(insertSpy).toHaveBeenCalledTimes(1)
  })

  it('never runs the last-superadmin count for an ordinary member', async () => {
    asAdmin()
    selectQueue.push([{ name: 'Ordinary Member', role: 'member' }])
    const res = await removeUser(TARGET_ID)
    expect(res.ok).toBe(true)
    // The count query was never queued; had the action asked for it, the
    // empty queue would have answered [] and the guard would have read
    // "zero other superadmins" and refused.
    expect(selectQueue).toHaveLength(0)
  })

  it('refuses an id that is not a user', async () => {
    asAdmin()
    selectQueue.push([]) // no such row
    const res = await removeUser(TARGET_ID)
    expect(res).toEqual({ ok: false, error: 'That person no longer exists' })
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

describe('what removeUser writes', () => {
  it('opens a removal row naming the remover, and touches nothing else', async () => {
    asAdmin()
    selectQueue.push([{ name: 'Sam', role: 'member' }])
    const res = await removeUser(TARGET_ID, '  Contract ended  ')
    expect(res.ok).toBe(true)
    expect(insertSpy).toHaveBeenCalledWith({
      userId: TARGET_ID,
      removedBy: ADMIN_ID,
      reason: 'Contract ended',
    })
    // The invariant the whole tombstone design rests on: no users.active, no
    // users.role, no work reassigned. If a future edit starts writing any of
    // those, the insert payload above stops being the only write.
    const written = insertSpy.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(written).sort()).toEqual(['reason', 'removedBy', 'userId'])
  })

  it('stores a blank reason as null rather than an empty string', async () => {
    asAdmin()
    selectQueue.push([{ name: 'Sam', role: 'member' }])
    await removeUser(TARGET_ID, '   ')
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ reason: null }))
  })

  it('rejects a reason too long to be a reason', async () => {
    asAdmin()
    const res = await removeUser(TARGET_ID, 'x'.repeat(201))
    expect(res.ok).toBe(false)
    expect(insertSpy).not.toHaveBeenCalled()
  })
})
