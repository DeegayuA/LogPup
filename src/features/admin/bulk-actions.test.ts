import { beforeEach, describe, expect, it, vi } from 'vitest'

// Every bulk action DELEGATES to the single-row action, so the row actions are
// mocked and what is asserted is the delegation contract: the right capability
// is demanded once, the right row action is called once per id, refusals come
// back as per-row skips rather than being swallowed, and no row action runs at
// all when the actor is refused up front.
//
// Mocking requireCapability rather than the session (the shape
// clear-test-data.test.ts uses) is deliberate here: the thing worth pinning is
// WHICH capability each batch names, and a session mock would only prove that
// the matrix still agrees with itself.
const {
  requireCapabilityMock,
  archiveAppMock,
  deleteAppMock,
  updateAppMock,
  setUserActiveMock,
  setUserRoleMock,
  setUserEmploymentTypeMock,
  supervisorRowsMock,
} = vi.hoisted(() => ({
  requireCapabilityMock: vi.fn(),
  archiveAppMock: vi.fn(),
  deleteAppMock: vi.fn(),
  updateAppMock: vi.fn(),
  setUserActiveMock: vi.fn(),
  setUserRoleMock: vi.fn(),
  setUserEmploymentTypeMock: vi.fn(),
  supervisorRowsMock: vi.fn(),
}))

vi.mock('@/features/auth/actor', () => ({ requireCapability: requireCapabilityMock }))
vi.mock('@/features/apps/actions', () => ({
  archiveApp: archiveAppMock,
  deleteApp: deleteAppMock,
  updateApp: updateAppMock,
}))
vi.mock('@/features/admin/actions', () => ({
  setUserActive: setUserActiveMock,
  setUserRole: setUserRoleMock,
  setUserEmploymentType: setUserEmploymentTypeMock,
}))
vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => supervisorRowsMock() }) }),
  },
}))

const {
  bulkArchiveApps,
  bulkDeleteApps,
  bulkSetAppLead,
  bulkSetUserActive,
  bulkSetUserEmploymentType,
  bulkSetUserRole,
} = await import('./bulk-actions')

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

const OK = { ok: true, data: undefined } as const
const refuse = (error: string) => ({ ok: false, error }) as const

const asAdmin = () =>
  requireCapabilityMock.mockResolvedValue({ id: 'admin-1', role: 'admin' })
const asNobody = () => requireCapabilityMock.mockResolvedValue(null)

beforeEach(() => {
  vi.clearAllMocks()
  archiveAppMock.mockResolvedValue(OK)
  deleteAppMock.mockResolvedValue(OK)
  updateAppMock.mockResolvedValue(OK)
  setUserActiveMock.mockResolvedValue(OK)
  setUserRoleMock.mockResolvedValue(OK)
  setUserEmploymentTypeMock.mockResolvedValue(OK)
  supervisorRowsMock.mockReturnValue([])
})

describe('capability gates', () => {
  const cases: ReadonlyArray<readonly [string, string, () => Promise<unknown>, () => unknown]> = [
    ['bulkArchiveApps', 'app.archive', () => bulkArchiveApps([A]), () => archiveAppMock],
    ['bulkDeleteApps', 'app.delete', () => bulkDeleteApps([A]), () => deleteAppMock],
    ['bulkSetAppLead', 'app.edit', () => bulkSetAppLead({ ids: [A], leadId: B }), () => updateAppMock],
    ['bulkSetUserActive', 'user.deactivate', () => bulkSetUserActive({ ids: [A], active: false }), () => setUserActiveMock],
    ['bulkSetUserRole', 'user.role.grant', () => bulkSetUserRole({ ids: [A], role: 'member' }), () => setUserRoleMock],
    ['bulkSetUserEmploymentType', 'user.profile.edit', () => bulkSetUserEmploymentType({ ids: [A], employmentType: 'permanent' }), () => setUserEmploymentTypeMock],
  ]

  it.each(cases)('%s demands %s', async (_name, action, run) => {
    asAdmin()
    await run()
    expect(requireCapabilityMock.mock.calls[0][0]).toBe(action)
  })

  it.each(cases)('%s writes nothing when the actor is refused', async (_name, _action, run, delegate) => {
    asNobody()
    const res = await run()
    expect(res).toMatchObject({ ok: false })
    expect(delegate()).not.toHaveBeenCalled()
  })
})

describe('bulkSetAppLead scoping', () => {
  // app.edit is SCOPED for a manager, and a bare capability check fails closed
  // for a scoped grant with no resource. Asking with the whole id list is what
  // lets a manager through for the apps they actually manage; updateApp then
  // refuses the rest per row.
  it('asks with every selected app id, not with no resource at all', async () => {
    asAdmin()
    await bulkSetAppLead({ ids: [A, B], leadId: C })
    expect(requireCapabilityMock).toHaveBeenCalledWith('app.edit', { appIds: [A, B] })
  })

  it('passes a null lead through, because clearing the lead is legitimate', async () => {
    asAdmin()
    await bulkSetAppLead({ ids: [A], leadId: null })
    expect(updateAppMock).toHaveBeenCalledWith(A, { leadId: null })
  })
})

describe('delegation', () => {
  it('calls the row action once per id', async () => {
    asAdmin()
    const res = await bulkArchiveApps([A, B, C])
    expect(archiveAppMock.mock.calls.map(([id]) => id)).toEqual([A, B, C])
    expect(res).toEqual({ ok: true, data: { attempted: 3, succeeded: [A, B, C], skipped: [] } })
  })

  it('de-duplicates ids so one row is never acted on twice', async () => {
    asAdmin()
    await bulkArchiveApps([A, A, B])
    expect(archiveAppMock).toHaveBeenCalledTimes(2)
  })

  it('forwards the acknowledgement flag to setUserActive', async () => {
    asAdmin()
    await bulkSetUserActive({ ids: [A], active: false, acknowledgeUntransferred: true })
    expect(setUserActiveMock).toHaveBeenCalledWith(A, false, true)
  })

  it('defaults the acknowledgement to false, so open work still blocks a row', async () => {
    asAdmin()
    await bulkSetUserActive({ ids: [A], active: false })
    expect(setUserActiveMock).toHaveBeenCalledWith(A, false, false)
  })
})

describe('partial success is reported, not swallowed', () => {
  // The guard this exists for: setUserRole refuses the last superadmin and the
  // actor's own row. A batch must come back saying so, per id.
  it('keeps the reason each refused row gave', async () => {
    asAdmin()
    setUserRoleMock.mockImplementation(async (id: string) => {
      if (id === B) return refuse('Cannot change your own account')
      if (id === C) return refuse('Cannot remove the last superadmin')
      return OK
    })
    const res = await bulkSetUserRole({ ids: [A, B, C], role: 'member' })
    expect(res).toEqual({
      ok: true,
      data: {
        attempted: 3,
        succeeded: [A],
        skipped: [
          { id: B, reason: 'Cannot change your own account' },
          { id: C, reason: 'Cannot remove the last superadmin' },
        ],
      },
    })
  })

  it('turns a thrown row into a skip instead of losing the whole batch', async () => {
    asAdmin()
    deleteAppMock.mockImplementation(async (id: string) => {
      if (id === A) throw new Error('boom')
      return OK
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await bulkDeleteApps([A, B])
    expect(res).toMatchObject({
      ok: true,
      data: { succeeded: [B], skipped: [{ id: A, reason: 'Something went wrong' }] },
    })
  })

  it('runs rows one at a time, so a check-then-write guard still holds', async () => {
    asAdmin()
    let inFlight = 0
    let overlapped = false
    setUserActiveMock.mockImplementation(async () => {
      inFlight += 1
      if (inFlight > 1) overlapped = true
      await Promise.resolve()
      inFlight -= 1
      return OK
    })
    await bulkSetUserActive({ ids: [A, B, C], active: false })
    expect(overlapped).toBe(false)
  })
})

describe('bulkSetUserEmploymentType preserves the supervisor', () => {
  // setUserEmploymentType writes `supervisorId ?? null`, so a batch that sent
  // nothing would wipe every selected person's supervisor as a side effect.
  it('hands each person their existing supervisor back', async () => {
    asAdmin()
    supervisorRowsMock.mockReturnValue([
      { id: A, supervisorId: C },
      { id: B, supervisorId: null },
    ])
    await bulkSetUserEmploymentType({ ids: [A, B], employmentType: 'probation' })
    expect(setUserEmploymentTypeMock).toHaveBeenCalledWith({
      userId: A,
      employmentType: 'probation',
      supervisorId: C,
    })
    expect(setUserEmploymentTypeMock).toHaveBeenCalledWith({
      userId: B,
      employmentType: 'probation',
      supervisorId: null,
    })
  })
})

describe('input validation', () => {
  it('refuses an empty selection', async () => {
    asAdmin()
    expect(await bulkArchiveApps([])).toEqual({ ok: false, error: 'Select at least one row' })
    expect(archiveAppMock).not.toHaveBeenCalled()
  })

  it('refuses a malformed id rather than handing it to the database', async () => {
    asAdmin()
    expect(await bulkArchiveApps(['not-a-uuid'])).toEqual({ ok: false, error: 'Invalid id' })
    expect(archiveAppMock).not.toHaveBeenCalled()
  })

  it('caps the blast radius of one batch', async () => {
    asAdmin()
    const many = Array.from({ length: 201 }, (_, i) =>
      `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`,
    )
    expect(await bulkArchiveApps(many)).toEqual({
      ok: false,
      error: 'Select 200 rows or fewer for one batch',
    })
    expect(archiveAppMock).not.toHaveBeenCalled()
  })

  it('refuses a seat that is not a real role', async () => {
    asAdmin()
    const res = await bulkSetUserRole({ ids: [A], role: 'wizard' })
    expect(res).toMatchObject({ ok: false })
    expect(setUserRoleMock).not.toHaveBeenCalled()
  })
})
