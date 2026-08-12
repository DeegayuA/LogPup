import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JOB_ROLE_MAX_LENGTH } from '@/lib/job-roles'

// Job role (users.title) is admin-only. The UI hides the control from
// non-admins, but a server action keeps a stable, directly-callable endpoint —
// so these tests call setUserTitle the way an attacker would, with no UI
// involved, and assert the guard both refuses AND never reaches the database.
const { authMock, writeSpy } = vi.hoisted(() => ({
  authMock: vi.fn(),
  writeSpy: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// The activity trail is bookkeeping, not the write under test — stubbed out
// so these tests keep asserting on exactly one thing: the users update.
vi.mock('@/features/activity/log', () => ({ logActivity: vi.fn() }))
vi.mock('@/db', () => ({
  db: {
    // The action reads the target's name to label its activity row.
    select: () => ({
      from: () => ({
        where: async () => [{ name: 'Target Person' }],
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          writeSpy(values)
        },
      }),
    }),
  },
}))

const { setUserTitle } = await import('./actions')

const TARGET_ID = '11111111-1111-4111-8111-111111111111'

const asAdmin = () => authMock.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
const asMember = () => authMock.mockResolvedValue({ user: { id: 'member-1', role: 'member' } })

beforeEach(() => {
  authMock.mockReset()
  writeSpy.mockReset()
})

describe('setUserTitle authorization', () => {
  it('rejects a signed-out caller and writes nothing', async () => {
    authMock.mockResolvedValue(null)
    const res = await setUserTitle(TARGET_ID, 'CTO')
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('rejects a member calling the action directly and writes nothing', async () => {
    asMember()
    const res = await setUserTitle(TARGET_ID, 'CTO')
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('rejects a member trying to retitle their own row and writes nothing', async () => {
    asMember()
    const res = await setUserTitle(TARGET_ID, 'Engineering Manager')
    expect(res.ok).toBe(false)
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('fails closed on a session with no role at all', async () => {
    authMock.mockResolvedValue({ user: { id: 'ghost-1' } })
    const res = await setUserTitle(TARGET_ID, 'CTO')
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('checks the role before anything else — a member gets the same refusal for junk input', async () => {
    asMember()
    const res = await setUserTitle('not-a-uuid', 'A'.repeat(JOB_ROLE_MAX_LENGTH + 1))
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(writeSpy).not.toHaveBeenCalled()
  })
})

describe('setUserTitle as an admin', () => {
  it('writes the trimmed job role', async () => {
    asAdmin()
    const res = await setUserTitle(TARGET_ID, '  Product Manager  ')
    expect(res).toEqual({ ok: true, data: undefined })
    expect(writeSpy).toHaveBeenCalledWith({ title: 'Product Manager' })
  })

  it('clears the job role when given a blank string', async () => {
    asAdmin()
    const res = await setUserTitle(TARGET_ID, '   ')
    expect(res.ok).toBe(true)
    expect(writeSpy).toHaveBeenCalledWith({ title: null })
  })

  it('rejects an over-length job role without writing', async () => {
    asAdmin()
    const res = await setUserTitle(TARGET_ID, 'A'.repeat(JOB_ROLE_MAX_LENGTH + 1))
    expect(res).toEqual({
      ok: false,
      error: `Job role must be ${JOB_ROLE_MAX_LENGTH} characters or fewer`,
    })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('rejects a non-string payload without writing', async () => {
    asAdmin()
    const res = await setUserTitle(TARGET_ID, { title: 'CTO' })
    expect(res.ok).toBe(false)
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('rejects a malformed user id without writing', async () => {
    asAdmin()
    const res = await setUserTitle('../../etc/passwd', 'CTO')
    expect(res).toEqual({ ok: false, error: 'Invalid user' })
    expect(writeSpy).not.toHaveBeenCalled()
  })
})
