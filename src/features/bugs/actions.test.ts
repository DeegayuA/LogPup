import { beforeEach, describe, expect, it, vi } from 'vitest'
import { liveApps } from '@/db/live'
import { bugReports } from '@/db/schema'

// What is worth asserting about these three actions is WHO is refused and WHAT
// is written — so the mock records the values handed to db.insert().values()
// and db.update().set(), which is the whole behaviour, and needs no database.
// Modelled on admin/clear-test-data.test.ts, down to mocking '@/lib/auth'
// (requireCapability reaches it through the memoised getSession).
//
// The reads are mocked at the module boundary rather than through a fake
// query builder: getBugScope exists precisely so a scoped capability check has
// its resource before it asks, and stubbing it is how a test can say "this bug
// is on app-1" in one line.

const { authMock, getBugScopeMock, insertSpy, updateSpy, logActivityMock, selectRows } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    getBugScopeMock: vi.fn(),
    insertSpy: vi.fn(),
    updateSpy: vi.fn(),
    logActivityMock: vi.fn(),
    selectRows: new Map<unknown, unknown[]>(),
  }))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('@/features/bugs/queries', () => ({ getBugScope: getBugScopeMock }))
vi.mock('@/db', () => {
  // One builder shape for every read: the rows come from whatever table the
  // query selected `from`, so a test says what a table contains rather than
  // what the fifth chained call should return.
  function builder(table: unknown) {
    const rows = () => selectRows.get(table) ?? []
    const self: Record<string, unknown> = {}
    for (const method of ['where', 'limit', 'innerJoin', 'leftJoin', 'orderBy', 'groupBy']) {
      self[method] = () => self
    }
    self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows()).then(resolve, reject)
    return self
  }
  return {
    db: {
      select: () => ({ from: (table: unknown) => builder(table) }),
      insert: (table: unknown) => ({
        values: (values: unknown) => ({
          returning: async () => {
            insertSpy(table, values)
            return [{ id: 'bug-1' }]
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (values: unknown) => ({
          where: () => ({
            returning: async () => {
              updateSpy(table, values)
              return [{ id: 'bug-1' }]
            },
          }),
        }),
      }),
    },
  }
})

const { deleteBug, reportBug, triageBug, updateBugContent } = await import('./actions')

const APP_ID = '11111111-1111-4111-8111-111111111111'
const BUG_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = '33333333-3333-4333-8333-333333333333'

const as = (role: string) => authMock.mockResolvedValue({ user: { id: 'actor-1', role } })

/** The values handed to the single insert / update this action performs. */
const inserted = () => insertSpy.mock.calls[0]?.[1] as Record<string, unknown> | undefined
const updated = () => updateSpy.mock.calls[0]?.[1] as Record<string, unknown> | undefined

const report = (over: Record<string, unknown> = {}) => ({
  appId: APP_ID,
  title: 'Sprint switcher forgets the backlog',
  description: 'Picked Backlog, chose a sprint, landed back on Overview.',
  pagePath: '/apps/ledger?tab=roadmap',
  ...over,
})

beforeEach(() => {
  authMock.mockReset()
  insertSpy.mockReset()
  updateSpy.mockReset()
  logActivityMock.mockReset()
  getBugScopeMock.mockReset()
  selectRows.clear()
  // The live app the bug is filed against. Absent from the map = not found.
  selectRows.set(liveApps, [{ id: APP_ID, name: 'Ledger', slug: 'ledger' }])
  getBugScopeMock.mockResolvedValue({
    appId: APP_ID,
    appName: 'Ledger',
    appSlug: 'ledger',
    title: 'Sprint switcher forgets the backlog',
    status: 'open',
  })
})

describe('reportBug guards', () => {
  it('lets a member file one, on a project they need not be on', async () => {
    // bug.report is the one write granted 'all' to a member: the person best
    // placed to describe a break is often someone outside the project who
    // tripped over it. No resource is passed, and none should be needed.
    as('member')
    const res = await reportBug(report())
    expect(res.ok).toBe(true)
    expect(insertSpy).toHaveBeenCalledOnce()
  })

  it('refuses a stakeholder and writes nothing', async () => {
    as('stakeholder')
    const res = await reportBug(report())
    // NOT 'Admins only': the only seats this can refuse are stakeholder,
    // auditor and signed out, for whom that sentence would be untrue.
    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('refuses an auditor and writes nothing', async () => {
    as('auditor')
    const res = await reportBug(report())
    expect(res.ok).toBe(false)
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('refuses when nobody is signed in', async () => {
    authMock.mockResolvedValue(null)
    expect((await reportBug(report())).ok).toBe(false)
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

describe('reportBug writes', () => {
  it('records the app, the words and the reporter', async () => {
    as('member')
    await reportBug(report())
    expect(insertSpy.mock.calls[0]?.[0]).toBe(bugReports)
    expect(inserted()).toMatchObject({
      appId: APP_ID,
      title: 'Sprint switcher forgets the backlog',
      pagePath: '/apps/ledger?tab=roadmap',
      reportedBy: 'actor-1',
    })
  })

  it('never writes a severity', async () => {
    // The reporter describes, the triager rates (bug_severity in schema.ts).
    // The column default stands until somebody decides otherwise.
    as('admin')
    await reportBug(report({ severity: 'critical' }))
    expect(inserted()).not.toHaveProperty('severity')
  })

  it('stores a null page path rather than dropping the report', async () => {
    as('member')
    const res = await reportBug(report({ pagePath: undefined }))
    expect(res.ok).toBe(true)
    expect(inserted()?.pagePath).toBeNull()
  })

  it('refuses an off-site page path and writes nothing', async () => {
    as('member')
    const res = await reportBug(report({ pagePath: '//evil.example/steal' }))
    expect(res.ok).toBe(false)
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('refuses to file against a project that is not live', async () => {
    // Read through liveApps, so a trashed project answers "not found" — a bug
    // filed against one would be a row no surface could ever show.
    as('member')
    selectRows.set(liveApps, [])
    expect(await reportBug(report())).toEqual({ ok: false, error: 'App not found' })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('logs the bug against the project it is about', async () => {
    as('member')
    await reportBug(report())
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'created', entityType: 'bug', appId: APP_ID }),
    )
  })
})

describe('triageBug guards', () => {
  it('refuses a member, who may file but not judge', async () => {
    as('member')
    const res = await triageBug({ bugId: BUG_ID, status: 'triaged' })
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('lets a superadmin through', async () => {
    as('superadmin')
    expect((await triageBug({ bugId: BUG_ID, severity: 'critical' })).ok).toBe(true)
  })

  it('refuses an editor whose scope does not cover the project', async () => {
    // bug.triage is 'scoped' for editor, and loadActor resolves scope from
    // assignments — none here, so the set is empty and `can` says no.
    as('editor')
    const res = await triageBug({ bugId: BUG_ID, status: 'triaged' })
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('answers "not found" for a bug that is trashed or gone, before asking permission', async () => {
    as('superadmin')
    getBugScopeMock.mockResolvedValue(null)
    expect(await triageBug({ bugId: BUG_ID, status: 'closed' })).toEqual({
      ok: false,
      error: 'Bug not found',
    })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('refuses a call that changes nothing', async () => {
    as('superadmin')
    const res = await triageBug({ bugId: BUG_ID })
    expect(res).toEqual({ ok: false, error: 'Nothing to change' })
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('triageBug writes', () => {
  it('stamps resolved_at when the bug is settled', async () => {
    as('admin')
    await triageBug({ bugId: BUG_ID, status: 'resolved' })
    expect(updated()?.status).toBe('resolved')
    expect(updated()?.resolvedAt).toBeInstanceOf(Date)
  })

  it('clears resolved_at when the bug is reopened', async () => {
    // Derived from the status, never set by hand: otherwise a reopened bug
    // keeps a resolution date from the last time somebody closed it.
    as('admin')
    await triageBug({ bugId: BUG_ID, status: 'open' })
    expect(updated()?.resolvedAt).toBeNull()
  })

  it('leaves status and resolved_at alone when only the severity moves', async () => {
    as('admin')
    await triageBug({ bugId: BUG_ID, severity: 'critical' })
    expect(updated()).not.toHaveProperty('status')
    expect(updated()).not.toHaveProperty('resolvedAt')
    expect(updated()?.severity).toBe('critical')
  })

  it('can unassign, which is a null and not an absence', async () => {
    as('admin')
    await triageBug({ bugId: BUG_ID, assignedTo: null })
    expect(updated()).toHaveProperty('assignedTo', null)
  })

  it('assigns to a person by id', async () => {
    as('admin')
    await triageBug({ bugId: BUG_ID, assignedTo: USER_ID })
    expect(updated()?.assignedTo).toBe(USER_ID)
  })

  it('names the project and the defect in the trail, never a person', async () => {
    // A bug attributed to a person, even indirectly, is how a team stops
    // filing them.
    as('admin')
    await triageBug({ bugId: BUG_ID, status: 'triaged' })
    const logged = logActivityMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(logged.entityType).toBe('bug')
    expect(logged.entityLabel).toBe('Sprint switcher forgets the backlog')
    expect(logged.appName).toBe('Ledger')
    expect(logged.detail).toBe('status to Triaged')
  })
})

describe('deleteBug', () => {
  it('refuses an editor and writes nothing', async () => {
    // bug.delete stops at manager: removing the report of a problem is a
    // heavier act than deciding how bad the problem is.
    as('editor')
    expect(await deleteBug(BUG_ID)).toEqual({ ok: false, error: 'Admins only' })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('refuses a member and writes nothing', async () => {
    as('member')
    expect((await deleteBug(BUG_ID)).ok).toBe(false)
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('is a soft delete: it updates the row, it does not remove it', async () => {
    as('admin')
    const res = await deleteBug(BUG_ID)
    expect(res.ok).toBe(true)
    expect(updateSpy.mock.calls[0]?.[0]).toBe(bugReports)
    expect(updated()?.deletedAt).toBeInstanceOf(Date)
    expect(updated()?.deletedBy).toBe('actor-1')
  })

  it('rejects an id that is not a uuid without reading anything', async () => {
    as('admin')
    expect(await deleteBug('not-a-uuid')).toEqual({ ok: false, error: 'Bug not found' })
    expect(getBugScopeMock).not.toHaveBeenCalled()
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('logs the deletion against the project', async () => {
    as('admin')
    await deleteBug(BUG_ID)
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'deleted', entityType: 'bug', detail: 'moved to trash' }),
    )
  })
})

describe('updateBugContent', () => {
  it('refuses a member: rewriting a report is a triage act, not a filing one', async () => {
    // bug.report is granted 'all' from member up so anyone can FILE one. What
    // a report says afterwards is the queue's index, and bug.triage owns it.
    as('member')
    const res = await updateBugContent({ bugId: BUG_ID, title: 'Sprint switcher loses the backlog' })
    expect(res.ok).toBe(false)
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('refuses an empty edit rather than writing a no-op row', async () => {
    as('admin')
    // Both fields omitted — what a caller that forgot to diff its form sends.
    // The refusal is the zod refine's, not the type system's: the input type
    // has both optional, so nothing here is a compile error.
    const res = await updateBugContent({ bugId: BUG_ID })
    expect(res).toEqual({ ok: false, error: 'Nothing to change' })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('refuses a title the reporting form would have refused', async () => {
    // The bounds are lifted from bugReportInput, so this is really asserting
    // that the two schemas cannot drift apart.
    as('admin')
    const res = await updateBugContent({ bugId: BUG_ID, title: 'ugh' })
    expect(res.ok).toBe(false)
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('writes only the field that changed, and bumps updatedAt', async () => {
    as('admin')
    const res = await updateBugContent({ bugId: BUG_ID, title: 'Sprint switcher loses the backlog' })
    expect(res.ok).toBe(true)
    const set = updated()!
    expect(set.title).toBe('Sprint switcher loses the backlog')
    // Absent, not null: a title fix must not blank a description nobody sent.
    expect('description' in set).toBe(false)
    expect(set.updatedAt).toBeInstanceOf(Date)
  })

  it('leaves status, severity and resolvedAt alone — that is triageBug s job', async () => {
    as('admin')
    await updateBugContent({ bugId: BUG_ID, description: 'Happens in Chrome and Safari, every time.' })
    const set = updated()!
    expect('status' in set).toBe(false)
    expect('severity' in set).toBe(false)
    expect('resolvedAt' in set).toBe(false)
  })

  it('logs the edit against the OLD title, so the feed stays findable', async () => {
    as('admin')
    await updateBugContent({ bugId: BUG_ID, title: 'Sprint switcher loses the backlog' })
    const entry = logActivityMock.mock.calls[0][0]
    expect(entry.entityLabel).toBe('Sprint switcher forgets the backlog')
    expect(entry.detail).toBe('edited the title')
    expect(entry.metadata.title).toEqual({
      from: 'Sprint switcher forgets the backlog',
      to: 'Sprint switcher loses the backlog',
    })
  })

  it('reports a bug that is gone rather than claiming success', async () => {
    as('admin')
    getBugScopeMock.mockResolvedValue(null)
    const res = await updateBugContent({ bugId: BUG_ID, title: 'Anything at all here' })
    expect(res).toEqual({ ok: false, error: 'Bug not found' })
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
