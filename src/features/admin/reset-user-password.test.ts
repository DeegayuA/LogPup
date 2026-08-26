import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STARTER_PASSWORD, resetPasswordFor } from '@/features/admin/starter-password'
import { verifyPassword } from '@/lib/password'

// Resetting somebody's password is taking control of their account, so the
// guard is the feature. These call resetUserPassword the way an attacker
// would — no UI, no dropdown that was hidden from them — and assert it both
// REFUSES and never reaches the database. Same idiom as set-user-title.test.ts.
const { authMock, writeSpy, logSpy } = vi.hoisted(() => ({
  authMock: vi.fn(),
  writeSpy: vi.fn(),
  logSpy: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logSpy }))
vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({ where: async () => [{ name: 'Target Person', active: true }] }),
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

const { resetUserPassword } = await import('./actions')

const TARGET_ID = '11111111-1111-4111-8111-111111111111'
const ADMIN_ID = '22222222-2222-4222-8222-222222222222'

const signedInAs = (id: string, role: string) =>
  authMock.mockResolvedValue({ user: { id, role, active: true } })

beforeEach(() => {
  authMock.mockReset()
  writeSpy.mockReset()
  logSpy.mockReset()
})

describe('who may reset a password', () => {
  it('lets an admin reset somebody else', async () => {
    signedInAs(ADMIN_ID, 'admin')

    const res = await resetUserPassword(TARGET_ID)

    expect(res.ok).toBe(true)
    expect(writeSpy).toHaveBeenCalledOnce()
  })

  it('lets a superadmin reset somebody else', async () => {
    signedInAs(ADMIN_ID, 'superadmin')

    expect((await resetUserPassword(TARGET_ID)).ok).toBe(true)
  })

  it.each(['manager', 'editor', 'member', 'stakeholder', 'auditor'])(
    'refuses a %s, and never touches the database',
    async (role) => {
      signedInAs(ADMIN_ID, role)

      const res = await resetUserPassword(TARGET_ID)

      expect(res.ok).toBe(false)
      expect(writeSpy).not.toHaveBeenCalled()
    },
  )

  it('refuses a signed-out caller', async () => {
    authMock.mockResolvedValue(null)

    expect((await resetUserPassword(TARGET_ID)).ok).toBe(false)
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('refuses an admin resetting their OWN account', async () => {
    // Otherwise the workspace's own operator ends up behind a password every
    // colleague knows, having locked themselves out to get there. /profile is
    // the route for your own password and it always was.
    signedInAs(ADMIN_ID, 'admin')

    const res = await resetUserPassword(ADMIN_ID)

    expect(res.ok).toBe(false)
    expect(writeSpy).not.toHaveBeenCalled()
  })
})

describe('what the reset actually writes', () => {
  beforeEach(() => signedInAs(ADMIN_ID, 'admin'))

  it('stores a HASH, never the password itself', async () => {
    await resetUserPassword(TARGET_ID)

    const written = writeSpy.mock.calls[0][0] as { passwordHash: string }
    expect(written.passwordHash).not.toContain(STARTER_PASSWORD)
    expect(verifyPassword(STARTER_PASSWORD, written.passwordHash)).toBe(true)
  })

  it('salts, so two resets of the same password store different hashes', async () => {
    await resetUserPassword(TARGET_ID)
    await resetUserPassword(TARGET_ID)

    const [first, second] = writeSpy.mock.calls.map(
      (call) => (call[0] as { passwordHash: string }).passwordHash,
    )
    expect(first).not.toBe(second)
  })

  it('forces a change on next sign-in — the whole mitigation', async () => {
    // Without this the workspace-wide known password stays live on the account
    // indefinitely. src/proxy.ts pins a session carrying the flag to /profile,
    // so the reset password is only ever usable to set a real one.
    await resetUserPassword(TARGET_ID)

    expect(writeSpy.mock.calls[0][0]).toMatchObject({ mustChangePassword: true })
  })

  it('returns the password so the admin can read it out', async () => {
    const res = await resetUserPassword(TARGET_ID)

    expect(res.ok && res.data.password).toBe(resetPasswordFor())
  })

  it('records who did it, and never logs the password', async () => {
    // An audit row naming a live credential would put it in a table far more
    // people can read than can reset it.
    await resetUserPassword(TARGET_ID)

    expect(logSpy).toHaveBeenCalledOnce()
    const entry = logSpy.mock.calls[0][0] as Record<string, unknown>
    expect(entry).toMatchObject({ actorId: ADMIN_ID, entityType: 'user', entityId: TARGET_ID })
    expect(JSON.stringify(entry)).not.toContain(STARTER_PASSWORD)
  })
})

describe('the starter password itself', () => {
  it('is what resetPasswordFor hands out', () => {
    expect(resetPasswordFor()).toBe(STARTER_PASSWORD)
  })

  it('is a SHARED constant, which is the documented tradeoff', () => {
    // Pinned deliberately. Two calls returning the same value is the whole
    // risk: between a reset and that person's next sign-in, anyone who knows
    // their email can sign in as them. If this ever becomes per-user random,
    // this test SHOULD fail — and the failure is the reminder to delete it and
    // surface the value the way add-user-dialog.tsx already does.
    expect(resetPasswordFor()).toBe(resetPasswordFor())
  })
})
