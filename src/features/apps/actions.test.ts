import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apps, appRoleHistory, users } from '@/db/schema'
import { liveApps } from '@/db/live'

// Exercises the REAL requireCapability -> actor.ts -> capabilities.ts chain
// (mocking only '@/lib/auth', same as bugs/actions.test.ts) so a mismatch
// between what the matrix grants and what the guard additionally demands is
// what these tests actually catch, rather than a mock agreeing with itself.
const {
  authMock,
  managesAppMock,
  insertSpy,
  updateSpy,
  logActivityMock,
  selectRows,
  returningRows,
  selectArgs,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  managesAppMock: vi.fn(),
  insertSpy: vi.fn(),
  updateSpy: vi.fn(),
  logActivityMock: vi.fn(),
  selectRows: new Map<unknown, unknown[]>(),
  returningRows: new Map<unknown, unknown[]>(),
  selectArgs: [] as unknown[],
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
// Only relevant to updateApp's PRE-fix code path; kept mocked (rather than
// exercising the real regex) so the test names the failure mode directly —
// see project-manager.ts's own tests for isProjectManagerRole's patterns.
vi.mock('@/features/apps/project-manager', () => ({ managesApp: managesAppMock }))
// repo-metadata.ts imports the `server-only` package, which isn't installed
// in this project (see model-discovery.ts / live-token.ts's comments on the
// same gap) — loading the real module crashes vitest before any test runs.
// None of these tests pass a repoUrl, so parseGitHubRepo/fetchRepoContext
// are never actually called; the stub only needs to load cleanly.
vi.mock('@/features/apps/repo-metadata', () => ({
  fetchRepoContext: vi.fn(),
  parseGitHubRepo: vi.fn(),
  RepoFetchError: class RepoFetchError extends Error {},
}))
// requireCapability checks a maintenance freeze before consulting the matrix
// for any role the freeze can affect (manager included); stubbed so these
// tests are about the permission matrix, not the maintenance window table.
vi.mock('@/features/maintenance/freeze', () => ({
  maintenanceActiveNow: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/db', () => {
  function selectBuilder(table: unknown) {
    const rows = () => selectRows.get(table) ?? []
    const self: Record<string, unknown> = {}
    for (const method of ['where', 'limit', 'innerJoin', 'leftJoin', 'orderBy', 'groupBy']) {
      self[method] = () => self
    }
    self.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(rows()).then(resolve, reject)
    return self
  }
  function writeBuilder(kind: 'insert' | 'update', table: unknown) {
    let payload: unknown
    const fire = () => (kind === 'insert' ? insertSpy(table, payload) : updateSpy(table, payload))
    let fired = false
    const self: Record<string, unknown> = {
      values: (v: unknown) => {
        payload = v
        return self
      },
      set: (v: unknown) => {
        payload = v
        return self
      },
      where: () => self,
      returning: async () => {
        if (!fired) {
          fire()
          fired = true
        }
        return returningRows.get(table) ?? [{}]
      },
    }
    self.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) => {
      if (!fired) {
        fire()
        fired = true
      }
      return Promise.resolve(undefined).then(resolve, reject)
    }
    return self
  }
  return {
    db: {
      select: (cols?: unknown) => {
        selectArgs.push(cols)
        return { from: (table: unknown) => selectBuilder(table) }
      },
      insert: (table: unknown) => writeBuilder('insert', table),
      update: (table: unknown) => writeBuilder('update', table),
      batch: async (queries: unknown[]) => Promise.all(queries),
    },
  }
})

const { updateApp, archiveApp } = await import('./actions')

const APP_ID = '11111111-1111-4111-8111-111111111111'

const asManager = () => authMock.mockResolvedValue({ user: { id: 'actor-1', role: 'manager' } })
const asAdmin = () => authMock.mockResolvedValue({ user: { id: 'actor-1', role: 'admin' } })

const liveAppRow = {
  id: APP_ID,
  slug: 'ledger',
  name: 'Ledger',
  status: 'active',
  leadId: 'lead-1',
  pmId: 'pm-1',
  description: 'A ledger app',
  repoUrl: null,
  techTags: ['nextjs'],
  aliases: ['LG'],
  internal: false,
}

beforeEach(() => {
  authMock.mockReset()
  managesAppMock.mockReset()
  insertSpy.mockReset()
  updateSpy.mockReset()
  logActivityMock.mockReset()
  selectRows.clear()
  returningRows.clear()
  selectArgs.length = 0
  // Every scoped grant (manager on app.edit / app.archive) reads employment
  // type unconditionally in loadActor, regardless of whether the action is
  // employment-cappable.
  selectRows.set(users, [{ employmentType: 'permanent' }])
  selectRows.set(liveApps, [liveAppRow])
})

describe('updateApp: manager scoped only via a recorded lead role', () => {
  it('lets a manager whose only link is an open app_role_history lead row through, even when the free-text assignment role would not read as manager-shaped', async () => {
    // The bug this guards against: requireCapability('app.edit', {appId})
    // already scopes 'manager' correctly through app_role_history (role in
    // 'pm'/'lead') — that is the matrix's answer. The deleted second conjunct
    // additionally regex-matched assignments.role via isProjectManagerRole,
    // which returns false for a free-text role like "Tech Lead" — so a
    // recorded lead who passed the matrix was denied anyway.
    asManager()
    selectRows.set(appRoleHistory, [{ appId: APP_ID }]) // the open lead interval
    managesAppMock.mockResolvedValue(false) // "Tech Lead" does not match isProjectManagerRole

    const res = await updateApp(APP_ID, { name: 'Ledger Renamed' })

    expect(res).toEqual({ ok: true, data: undefined })
    expect(updateSpy).toHaveBeenCalledWith(apps, { name: 'Ledger Renamed' })
  })
})

describe('archiveApp: resource must reach a scoped grant', () => {
  it('archives when the manager is scoped to the app via app_role_history', async () => {
    // 'app.archive' is 'scoped' for manager, and can() denies a scoped grant
    // asked with no resource — archiveApp used to call requireCapability
    // without one, refusing every scoped manager unconditionally.
    asManager()
    selectRows.set(appRoleHistory, [{ appId: APP_ID }])
    returningRows.set(apps, [{ slug: 'ledger', name: 'Ledger' }])

    const res = await archiveApp(APP_ID)

    expect(res).toEqual({ ok: true, data: undefined })
    expect(updateSpy).toHaveBeenCalledWith(apps, { status: 'archived' })
  })

  it('refuses a manager not scoped to the app', async () => {
    asManager()
    selectRows.set(appRoleHistory, []) // no open pm/lead row anywhere for this actor
    returningRows.set(apps, [{ slug: 'ledger', name: 'Ledger' }])

    const res = await archiveApp(APP_ID)

    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('updateApp: pre-change select for the change-request pre-image', () => {
  it('reads every column the update can change, not just the ones this function currently reads', async () => {
    // A later phase files this SELECT's row as change_requests.payload.before;
    // detectConflict (admin/change-request-appliers.ts) only diffs fields
    // present in `before`, so a narrow select here would let a concurrent
    // edit to an omitted field be silently clobbered.
    asAdmin()

    const res = await updateApp(APP_ID, { name: 'Ledger Renamed' })

    expect(res.ok).toBe(true)
    const cols = selectArgs.at(-1) as Record<string, unknown>
    for (const key of [
      'name', 'slug', 'description', 'repoUrl', 'techTags',
      'aliases', 'status', 'internal', 'leadId', 'pmId',
    ]) {
      expect(cols).toHaveProperty(key)
    }
  })
})
