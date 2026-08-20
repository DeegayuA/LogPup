import { beforeEach, describe, expect, it, vi } from 'vitest'
import { liveApps, liveMeetings, liveScreenshots, liveSprints, liveTasks } from '@/db/live'
import { meetingScreenshots, sprints, tasks, users } from '@/db/schema'
import type { TrashGroup, TrashKind, TrashRow } from '@/features/admin/trash-grouping'
import { emptyTrashPhrase, wipeRecordingsPhrase } from '@/features/admin/danger-logic'

// The danger zone's five actions, tested the way clear-test-data.test.ts tests
// the sixth: no database, a fake `db` that answers reads from a queue keyed by
// the table each SELECT names, and spies on the collaborators that actually
// destroy things.
//
// What is worth asserting here is NOT that a purge deletes a row — trash-
// actions.ts owns that and is allowlisted for it. It is the three things this
// file decides: who is refused, whether the typed phrase gates the run, and in
// WHICH ORDER the purges go out. That order is load-bearing (a container
// purged before its children reports "nothing purged" for work that happened)
// and is invisible to every other test in the repo.

const APP_ID = '11111111-1111-4111-8111-111111111111'
const MEETING_ID = '22222222-2222-4222-8222-222222222222'

const {
  authMock,
  logActivityMock,
  getTrashMock,
  buildSnapshotMock,
  encryptSnapshotMock,
  deleteMeetingMock,
  purgeSpies,
  reads,
  updateCalls,
  fakeDb,
} = vi.hoisted(() => {
  /** Queued read answers: first entry whose table (and, when given, selected
   *  field) matches a SELECT wins. A field is needed because one table is read
   *  twice per action with different projections — a COUNT and then the ids. */
  const reads: { table: unknown; field?: string; rows: unknown[] }[] = []
  const updateCalls: { table: unknown; values: Record<string, unknown> }[] = []

  const fakeDb = {
    select(fields?: Record<string, unknown>) {
      const names = fields ? Object.keys(fields) : []
      let rows: unknown[] = []
      const builder: Record<string, unknown> = {
        from(table: unknown) {
          const index = reads.findIndex(
            (r) => r.table === table && (r.field === undefined || names.includes(r.field)),
          )
          rows = index === -1 ? [] : reads.splice(index, 1)[0].rows
          return builder
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(rows).then(resolve, reject)
        },
      }
      for (const chained of ['where', 'orderBy', 'limit', 'groupBy', 'innerJoin', 'leftJoin']) {
        builder[chained] = () => builder
      }
      return builder
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where: async () => {
              updateCalls.push({ table, values })
            },
          }
        },
      }
    },
  }

  // Deliberately untyped spies: each is re-armed per test with an ok or an
  // err, and pinning the success shape here would make the failure cases a
  // type error rather than a scenario.
  const purgeResult = () => vi.fn()
  return {
    authMock: vi.fn(),
    logActivityMock: vi.fn(),
    getTrashMock: vi.fn(),
    buildSnapshotMock: vi.fn(),
    encryptSnapshotMock: vi.fn(),
    deleteMeetingMock: vi.fn(),
    purgeSpies: {
      purgeApp: purgeResult(),
      purgeBug: purgeResult(),
      purgeKeyframe: purgeResult(),
      purgeMeeting: purgeResult(),
      purgeSegment: purgeResult(),
      purgeSprint: purgeResult(),
      purgeTask: purgeResult(),
    },
    reads,
    updateCalls,
    fakeDb,
  }
})

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('@/db', () => ({ db: fakeDb }))
vi.mock('@/features/admin/trash-queries', () => ({ getTrash: getTrashMock }))
vi.mock('@/features/admin/backup', () => ({
  buildSnapshot: buildSnapshotMock,
  encryptSnapshot: encryptSnapshotMock,
}))
vi.mock('@/features/meetings/actions', () => ({ deleteMeeting: deleteMeetingMock }))
vi.mock('@/features/admin/trash-actions', () => purgeSpies)

const {
  deleteMeetingFromDanger,
  emptyTrash,
  exportWorkspaceBackup,
  loadDangerTargets,
  resetApp,
  wipeMeetingRecordings,
} = await import('./danger-actions')

// --- fixtures --------------------------------------------------------------

function trashRow(id: string): TrashRow {
  return {
    id,
    label: id,
    context: null,
    deletedByName: null,
    deletedByAvatarUrl: null,
    deletedAt: new Date('2026-08-01T00:00:00Z'),
    parentTrashed: false,
  }
}

function trashGroup(kind: TrashKind, ids: string[]): TrashGroup {
  return { kind, rows: ids.map(trashRow), totalCount: ids.length }
}

/** All six purge spies' calls, flattened into (name, id) in call order. */
function purgeOrder(): [string, string][] {
  return Object.entries(purgeSpies)
    .flatMap(([name, spy]) =>
      spy.mock.calls.map(
        (call, i) => [name, call[0] as string, spy.mock.invocationCallOrder[i]] as const,
      ),
    )
    .sort((a, b) => a[2] - b[2])
    .map(([name, id]) => [name, id])
}

const asSuperadmin = () =>
  authMock.mockResolvedValue({ user: { id: APP_ID, role: 'superadmin' } })
const asMember = () => authMock.mockResolvedValue({ user: { id: APP_ID, role: 'member' } })

beforeEach(() => {
  authMock.mockReset()
  logActivityMock.mockReset()
  getTrashMock.mockReset()
  buildSnapshotMock.mockReset()
  encryptSnapshotMock.mockReset()
  deleteMeetingMock.mockReset()
  for (const spy of Object.values(purgeSpies)) {
    spy.mockReset()
    spy.mockResolvedValue({ ok: true, data: undefined })
  }
  reads.length = 0
  updateCalls.length = 0
  // Every cappable action reads the actor's employment type; permanent caps
  // nothing, which is the pre-cap behaviour.
  reads.push({ table: users, rows: [{ employmentType: 'permanent' }] })
  vi.stubEnv('BACKUP_ENCRYPTION_KEY', 'test-key')
})

// --- guards ----------------------------------------------------------------

describe('capability guards', () => {
  // Every one of these is superadmin-only except the backup (admin too), so a
  // member is refused by all six and nothing destructive is reached.
  const calls: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
    ['exportWorkspaceBackup', () => exportWorkspaceBackup()],
    ['deleteMeetingFromDanger', () => deleteMeetingFromDanger(MEETING_ID, 'anything')],
    ['resetApp', () => resetApp(APP_ID, 'anything')],
    ['wipeMeetingRecordings', () => wipeMeetingRecordings('anything')],
    ['emptyTrash', () => emptyTrash('anything')],
    ['loadDangerTargets', () => loadDangerTargets()],
  ]

  it.each(calls)('%s refuses a member and touches nothing', async (_name, run) => {
    asMember()
    await expect(run()).resolves.toEqual({ ok: false, error: 'Admins only' })
    expect(purgeOrder()).toEqual([])
    expect(updateCalls).toEqual([])
    expect(deleteMeetingMock).not.toHaveBeenCalled()
    expect(buildSnapshotMock).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it.each(calls)('%s refuses a signed-out caller', async (_name, run) => {
    authMock.mockResolvedValue(null)
    await expect(run()).resolves.toEqual({ ok: false, error: 'Admins only' })
  })
})

// --- empty trash -----------------------------------------------------------

describe('emptyTrash', () => {
  const groups = [
    trashGroup('app', ['app-1']),
    trashGroup('meeting', ['meet-1']),
    trashGroup('keyframe', ['kf-1']),
    trashGroup('assignment', ['assign-1']),
  ]

  it('refuses a phrase built from a different count, and purges nothing', async () => {
    asSuperadmin()
    getTrashMock.mockResolvedValue(groups)
    // Three purgeable rows, so the phrase is "empty 3 items". A phrase typed
    // against a stale count is the interlock this control exists to have.
    const res = await emptyTrash(emptyTrashPhrase(2))
    expect(res).toEqual({ ok: false, error: expect.stringContaining('empty 3 items') })
    expect(purgeOrder()).toEqual([])
  })

  it('purges children before the containers that cascade them away', async () => {
    asSuperadmin()
    getTrashMock.mockResolvedValue(groups)
    const res = await emptyTrash(emptyTrashPhrase(3))
    expect(res).toEqual({ ok: true, data: { purged: 3, skipped: 0, remaining: 0 } })
    expect(purgeOrder()).toEqual([
      ['purgeKeyframe', 'kf-1'],
      ['purgeMeeting', 'meet-1'],
      ['purgeApp', 'app-1'],
    ])
  })

  it('leaves removed assignments alone — there is no purge for them', async () => {
    asSuperadmin()
    getTrashMock.mockResolvedValue(groups)
    await emptyTrash(emptyTrashPhrase(3))
    expect(purgeOrder().map(([, id]) => id)).not.toContain('assign-1')
  })

  it('counts an already-gone row as skipped rather than failing the run', async () => {
    asSuperadmin()
    getTrashMock.mockResolvedValue(groups)
    purgeSpies.purgeKeyframe.mockResolvedValue({
      ok: false,
      error: 'Not found, or it was restored — nothing purged',
    })
    const res = await emptyTrash(emptyTrashPhrase(3))
    expect(res).toEqual({ ok: true, data: { purged: 2, skipped: 1, remaining: 0 } })
  })

  it('aborts with a permission message when the purge itself is refused', async () => {
    // danger.trash.empty and trash.purge are the same seat today, so this can
    // only happen if the two grants drift apart — reporting "0 purged" then
    // would read as "there was nothing to do".
    asSuperadmin()
    getTrashMock.mockResolvedValue(groups)
    purgeSpies.purgeKeyframe.mockResolvedValue({ ok: false, error: 'Admins only' })
    const res = await emptyTrash(emptyTrashPhrase(3))
    expect(res).toEqual({ ok: false, error: expect.stringContaining('trash.purge') })
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('says so when there is nothing to empty', async () => {
    asSuperadmin()
    getTrashMock.mockResolvedValue([trashGroup('assignment', ['assign-1'])])
    expect(await emptyTrash('empty 0 items')).toEqual({
      ok: false,
      error: 'The trash is already empty',
    })
  })

  it('records one activity row for the whole run', async () => {
    asSuperadmin()
    getTrashMock.mockResolvedValue(groups)
    await emptyTrash(emptyTrashPhrase(3))
    expect(logActivityMock).toHaveBeenCalledTimes(1)
    expect(logActivityMock.mock.calls[0][0]).toMatchObject({ verb: 'purged', entityLabel: 'the trash' })
  })
})

// --- reset a project's board ----------------------------------------------

describe('resetApp', () => {
  function seedBoard(taskIds: string[], sprintIds: string[]) {
    reads.push({ table: liveApps, rows: [{ id: APP_ID, name: 'LogPup', slug: 'logpup' }] })
    reads.push({ table: liveTasks, field: 'id', rows: taskIds.map((id) => ({ id })) })
    reads.push({ table: liveSprints, field: 'id', rows: sprintIds.map((id) => ({ id })) })
  }

  it('demands the project address, not a constant word', async () => {
    asSuperadmin()
    seedBoard(['t1'], ['s1'])
    const res = await resetApp(APP_ID, 'DELETE')
    expect(res).toEqual({ ok: false, error: expect.stringContaining('logpup') })
    expect(updateCalls).toEqual([])
    expect(purgeOrder()).toEqual([])
  })

  it('marks the rows deleted before purging them, tasks before sprints', async () => {
    asSuperadmin()
    seedBoard(['t1', 't2'], ['s1'])
    const res = await resetApp(APP_ID, 'logpup')
    expect(res.ok).toBe(true)
    // Phase 1: an ordinary soft delete, which is what makes a run that dies
    // halfway leave restorable rows in Trash rather than a half-deleted board.
    expect(updateCalls.map((c) => c.table)).toEqual([tasks, sprints])
    // Phase 2: the guarded hard delete, at the one file allowed to do it.
    expect(purgeOrder()).toEqual([
      ['purgeTask', 't1'],
      ['purgeTask', 't2'],
      ['purgeSprint', 's1'],
    ])
  })

  it('accepts the address whatever case it was typed in', async () => {
    asSuperadmin()
    seedBoard(['t1'], [])
    expect((await resetApp(APP_ID, '  LogPup  ')).ok).toBe(true)
  })

  it('refuses a project that is already trashed or gone', async () => {
    asSuperadmin()
    reads.push({ table: liveApps, rows: [] })
    expect(await resetApp(APP_ID, 'logpup')).toEqual({
      ok: false,
      error: 'Not found, or it is already in Trash',
    })
  })

  it('says so when the board is already empty', async () => {
    asSuperadmin()
    seedBoard([], [])
    expect(await resetApp(APP_ID, 'logpup')).toEqual({
      ok: false,
      error: 'LogPup already has an empty board',
    })
    expect(updateCalls).toEqual([])
  })

  it('rejects a malformed id before reading anything', async () => {
    asSuperadmin()
    expect(await resetApp('not-a-uuid', 'logpup')).toEqual({ ok: false, error: 'Invalid project' })
  })
})

// --- wipe recordings -------------------------------------------------------

describe('wipeMeetingRecordings', () => {
  function seedKeyframes(ids: string[]) {
    reads.push({ table: liveScreenshots, field: 'total', rows: [{ total: ids.length }] })
    reads.push({ table: liveScreenshots, field: 'id', rows: ids.map((id) => ({ id })) })
  }

  it('demands a phrase carrying this moment count', async () => {
    asSuperadmin()
    seedKeyframes(['kf-1', 'kf-2'])
    const res = await wipeMeetingRecordings(wipeRecordingsPhrase(9))
    expect(res).toEqual({ ok: false, error: expect.stringContaining('wipe 2 keyframes') })
    expect(updateCalls).toEqual([])
    expect(purgeSpies.purgeKeyframe).not.toHaveBeenCalled()
  })

  it('soft-deletes the keyframes, then purges each one', async () => {
    asSuperadmin()
    seedKeyframes(['kf-1', 'kf-2'])
    const res = await wipeMeetingRecordings(wipeRecordingsPhrase(2))
    expect(res).toEqual({ ok: true, data: { purged: 2, skipped: 0, remaining: 0 } })
    expect(updateCalls.map((c) => c.table)).toEqual([meetingScreenshots])
    expect(purgeOrder()).toEqual([
      ['purgeKeyframe', 'kf-1'],
      ['purgeKeyframe', 'kf-2'],
    ])
  })

  it('says so when there is nothing recorded', async () => {
    asSuperadmin()
    reads.push({ table: liveScreenshots, field: 'total', rows: [{ total: 0 }] })
    expect(await wipeMeetingRecordings('wipe 0 keyframes')).toEqual({
      ok: false,
      error: 'There are no keyframes to wipe',
    })
  })
})

// --- delete one meeting ----------------------------------------------------

describe('deleteMeetingFromDanger', () => {
  function seedMeeting(title: string) {
    reads.push({ table: liveMeetings, rows: [{ id: MEETING_ID, title }] })
  }

  it('demands the meeting title', async () => {
    asSuperadmin()
    seedMeeting('Weekly sync')
    const res = await deleteMeetingFromDanger(MEETING_ID, 'Weekly')
    expect(res).toEqual({ ok: false, error: expect.stringContaining('Weekly sync') })
    expect(deleteMeetingMock).not.toHaveBeenCalled()
  })

  it('delegates the delete rather than reimplementing it', async () => {
    // deleteMeeting owns the scoped capability check, the Google Calendar
    // cancellation and the soft delete. Reimplementing any of that here is how
    // the calendar half gets forgotten.
    asSuperadmin()
    seedMeeting('Weekly sync')
    deleteMeetingMock.mockResolvedValue({ ok: true, data: undefined })
    const res = await deleteMeetingFromDanger(MEETING_ID, 'weekly sync')
    expect(res).toEqual({ ok: true, data: { title: 'Weekly sync' } })
    expect(deleteMeetingMock).toHaveBeenCalledWith(MEETING_ID)
  })

  it('writes no activity row of its own', async () => {
    // deleteMeeting already logs one, and its own comment records the
    // duplicate-row bug a second call recreates.
    asSuperadmin()
    seedMeeting('Weekly sync')
    deleteMeetingMock.mockResolvedValue({ ok: true, data: undefined })
    await deleteMeetingFromDanger(MEETING_ID, 'Weekly sync')
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('passes the delegate refusal straight back', async () => {
    asSuperadmin()
    seedMeeting('Weekly sync')
    deleteMeetingMock.mockResolvedValue({ ok: false, error: 'Not allowed to delete this meeting' })
    expect(await deleteMeetingFromDanger(MEETING_ID, 'Weekly sync')).toEqual({
      ok: false,
      error: 'Not allowed to delete this meeting',
    })
  })

  it('refuses a meeting already in Trash', async () => {
    asSuperadmin()
    reads.push({ table: liveMeetings, rows: [] })
    expect(await deleteMeetingFromDanger(MEETING_ID, 'anything')).toEqual({
      ok: false,
      error: 'Not found, or it is already in Trash',
    })
  })
})

// --- backup export ---------------------------------------------------------

describe('exportWorkspaceBackup', () => {
  it('refuses without an encryption key, before building the snapshot', async () => {
    // No plaintext fallback, ever — and no full-table read to discover it.
    asSuperadmin()
    vi.stubEnv('BACKUP_ENCRYPTION_KEY', '')
    const res = await exportWorkspaceBackup()
    expect(res).toEqual({ ok: false, error: expect.stringContaining('BACKUP_ENCRYPTION_KEY') })
    expect(buildSnapshotMock).not.toHaveBeenCalled()
  })

  it('reuses backup.ts rather than re-serialising the database', async () => {
    asSuperadmin()
    buildSnapshotMock.mockResolvedValue({ version: 1 })
    encryptSnapshotMock.mockReturnValue(Buffer.from('cipher'))
    const res = await exportWorkspaceBackup()
    expect(res.ok).toBe(true)
    expect(buildSnapshotMock).toHaveBeenCalledTimes(1)
    expect(encryptSnapshotMock).toHaveBeenCalledWith({ version: 1 })
    if (res.ok) {
      expect(res.data.filename).toMatch(/\.json\.enc$/)
      expect(Buffer.from(res.data.base64, 'base64').toString()).toBe('cipher')
      expect(res.data.byteSize).toBe(6)
    }
  })

  it('logs the export even though it destroys nothing', async () => {
    asSuperadmin()
    buildSnapshotMock.mockResolvedValue({})
    encryptSnapshotMock.mockReturnValue(Buffer.from('x'))
    await exportWorkspaceBackup()
    expect(logActivityMock.mock.calls[0][0]).toMatchObject({
      verb: 'exported',
      entityLabel: 'workspace backup',
    })
  })

  it('refuses in words rather than hitting the platform response limit', async () => {
    asSuperadmin()
    buildSnapshotMock.mockResolvedValue({})
    encryptSnapshotMock.mockReturnValue(Buffer.alloc(5 * 1024 * 1024))
    const res = await exportWorkspaceBackup()
    expect(res).toEqual({ ok: false, error: expect.stringContaining('too large') })
    expect(logActivityMock).not.toHaveBeenCalled()
  })
})
