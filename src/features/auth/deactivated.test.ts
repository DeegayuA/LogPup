import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROLE_GRANTS, type Action, type UserRole } from '@/features/auth/capabilities'

/**
 * A DEACTIVATED ACCOUNT HOLDS NO CAPABILITY, proven at the construction site.
 *
 * The redirect in src/proxy.ts and the one in the (app) layout are the UI
 * half of deactivation, and hiding a page is presentation — an attacker, or
 * simply a stale open tab, posts straight to the server action. This is the
 * other half: `loadActor` and `requireCapability` are the only two places an
 * `Actor` is ever made, so a refusal here is a refusal everywhere, including
 * in the actions nobody has written yet.
 */

const getSessionMock = vi.fn()
const selectSpy = vi.fn()

vi.mock('@/lib/session', () => ({ getSession: getSessionMock }))

const chain = (rows: unknown[]) => {
  const p: Record<string, unknown> = {}
  const self = () => p
  p.from = self
  p.where = async () => rows
  return p
}

vi.mock('@/db', () => ({
  db: {
    select: () => {
      selectSpy()
      // Serves both reads actor.ts makes: the employment-type lookup and the
      // scope lookup, whichever the action under test drives it to.
      return chain([{ employmentType: 'permanent', appId: 'app-1' }])
    },
  },
}))

const { loadActor, requireCapability } = await import('@/features/auth/actor')

const session = (over: { role?: UserRole; active?: boolean } = {}) => ({
  user: {
    id: 'u-1',
    email: 'someone@altavision.lk',
    role: 'superadmin' as UserRole,
    status: 'approved' as const,
    active: true,
    mustChangePassword: false,
    ...over,
  },
})

/**
 * One action per grant level, because the levels take different code paths
 * through requireCapability: 'all' and 'own' answer from the session without
 * touching the database, 'scoped' goes on to load the scope set. A guard
 * placed on only one of those paths would pass a narrower test than this.
 */
const SAMPLE: Array<{ action: Action; role: UserRole }> = [
  { action: 'user.create', role: 'superadmin' }, // all
  { action: 'worklog.write.own', role: 'member' }, // own
  { action: 'task.edit', role: 'editor' }, // scoped
  { action: 'app.view', role: 'admin' }, // a read, not a write
  { action: 'danger.dbclear', role: 'superadmin' }, // the heaviest seat there is
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireCapability, deactivated', () => {
  it.each(SAMPLE)('refuses $action for a deactivated $role', async ({ action, role }) => {
    getSessionMock.mockResolvedValue(session({ role, active: false }))
    await expect(requireCapability(action, { ownerId: 'u-1', appId: 'app-1' })).resolves.toBeNull()
  })

  it.each(SAMPLE)('still grants $action to the same active $role', async ({ action, role }) => {
    // The control. Without it, a guard that refused everything unconditionally
    // would pass the block above and nobody would notice until the app died.
    getSessionMock.mockResolvedValue(session({ role, active: true }))
    await expect(requireCapability(action, { ownerId: 'u-1', appId: 'app-1' })).resolves.not.toBeNull()
  })

  it('refuses before spending a query', async () => {
    // 'user.approve' is cappable, so an active superadmin reaches the
    // employment-type read. A deactivated one must never get that far: the
    // answer cannot change, and a deactivated session should cost nothing.
    getSessionMock.mockResolvedValue(session({ active: false }))
    await requireCapability('user.approve')
    expect(selectSpy).not.toHaveBeenCalled()
  })

  it('refuses every action in the matrix, not a hand-picked few', async () => {
    getSessionMock.mockResolvedValue(session({ role: 'superadmin', active: false }))
    for (const action of Object.keys(ROLE_GRANTS) as Action[]) {
      await expect(
        requireCapability(action, { ownerId: 'u-1', appId: 'app-1' }),
      ).resolves.toBeNull()
    }
  })
})

describe('loadActor, deactivated', () => {
  it('builds no actor at all', async () => {
    getSessionMock.mockResolvedValue(session({ active: false }))
    await expect(loadActor()).resolves.toBeNull()
  })

  it('builds one for the same active session', async () => {
    getSessionMock.mockResolvedValue(session({ active: true }))
    await expect(loadActor()).resolves.toMatchObject({ id: 'u-1', role: 'superadmin' })
  })

  it('does not read the database for a deactivated session', async () => {
    getSessionMock.mockResolvedValue(session({ role: 'editor', active: false }))
    await loadActor()
    expect(selectSpy).not.toHaveBeenCalled()
  })
})
