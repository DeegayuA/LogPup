import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  apps,
  assignmentHistory,
  assignments,
  meetingNoteSegments,
  meetingScreenshots,
  meetings,
  sprints,
  tasks,
  users,
} from '@/db/schema'
import { liveScreenshots } from '@/db/live'

// Every restore/purge action is admin-gated, returns ActionResult, calls
// logActivity, and ends in a revalidate helper — same mocked-action idiom as
// src/features/admin/set-user-title.test.ts: vi.mock the collaborators with
// chainable stubs + spies, then await import the module under test.
const { authMock, writeSpy, insertSpy, deleteSpy, logActivityMock, blobDelMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  writeSpy: vi.fn(),
  insertSpy: vi.fn(),
  deleteSpy: vi.fn(),
  logActivityMock: vi.fn(),
  blobDelMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('@vercel/blob', () => ({ del: blobDelMock, put: vi.fn(), get: vi.fn() }))
// trash-actions.ts pulls in ai-actions.ts just for the two neutral labels —
// ai-actions.ts itself imports a lot more (auth, Gemini, notifications…), so
// every one of its other collaborators gets stubbed here too, purely so
// `await import('./trash-actions')` below never reaches a real network call.
vi.mock('@/features/gemini/client', () => ({
  DEFAULT_GEMINI_MODEL: 'gemini-test',
  callGemini: vi.fn(),
  callGeminiWithAudio: vi.fn(),
  callGeminiWithImages: vi.fn(),
  GeminiError: class GeminiError extends Error {},
}))
vi.mock('@/features/meetings/actions', () => ({ updateMeetingNotes: vi.fn() }))
vi.mock('@/features/notifications/notify', () => ({
  createNotifications: vi.fn(),
  extractMentionedUserIds: vi.fn(() => []),
}))
vi.mock('@/features/sprints/task-actions', () => ({ createTask: vi.fn() }))

// Per-table state: a SELECT queue (consumed in call order), an UPDATE
// .returning() queue, a DELETE .returning() queue, and an INSERT .returning()
// queue. Every action under test reads/writes a small, known set of tables —
// keying by table reference (not name) mirrors every other mocked-action test
// in this codebase (e.g. `if (table === liveMeetings) …`).
type TableState = {
  select: unknown[][]
  updateReturning: unknown[][]
  deleteReturning: unknown[][]
  insertReturning: unknown[][]
}
const tableState = new Map<unknown, TableState>()
function stateFor(table: unknown): TableState {
  let s = tableState.get(table)
  if (!s) {
    s = { select: [], updateReturning: [], deleteReturning: [], insertReturning: [] }
    tableState.set(table, s)
  }
  return s
}
function resetTableState() {
  tableState.clear()
}

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        const chain = {
          innerJoin: () => chain,
          leftJoin: () => chain,
          where: () => {
            const rows = stateFor(table).select.shift() ?? []
            return {
              then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
                Promise.resolve(rows).then(onFulfilled, onRejected),
              // restoreAssignment's predecessor lookup chains .orderBy().limit()
              // after .where() — same queued rows either way.
              orderBy: () => ({ limit: async () => rows }),
            }
          },
        }
        return chain
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          writeSpy(table, values)
          const rows = stateFor(table).updateReturning.shift() ?? []
          return {
            // Some updates (the assignmentHistory close inside restoreAssignment's
            // batch) never chain .returning() at all and are awaited directly —
            // via db.batch's Promise.all, which needs a thenable here.
            then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(undefined).then(onFulfilled),
            returning: async () => rows,
          }
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        insertSpy(table, values)
        const rows = stateFor(table).insertReturning.shift() ?? []
        return {
          then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(undefined).then(onFulfilled),
          returning: async () => rows,
        }
      },
    }),
    delete: (table: unknown) => {
      deleteSpy(table)
      return {
        where: () => ({
          returning: async () => stateFor(table).deleteReturning.shift() ?? [],
        }),
      }
    },
    batch: async (queries: unknown[]) => Promise.all(queries),
  },
}))

const {
  restoreMeeting,
  restoreTask,
  restoreSprint,
  restoreSegment,
  restoreKeyframe,
  restoreAssignment,
  purgeMeeting,
  purgeTask,
  purgeSprint,
  purgeSegment,
  purgeKeyframe,
} = await import('./trash-actions')
const { keyframeDeleteLabel, noteSegmentDeleteLabel } = await import('@/features/meetings/ai-actions')

const ID = '11111111-1111-4111-8111-111111111111'
const MEETING_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = '33333333-3333-4333-8333-333333333333'
const APP_ID = '44444444-4444-4444-8444-444444444444'
const ADMIN_ID = 'admin-1'

const asAdmin = () => authMock.mockResolvedValue({ user: { id: ADMIN_ID, role: 'admin' } })
const asMember = () => authMock.mockResolvedValue({ user: { id: 'member-1', role: 'member' } })

beforeEach(() => {
  authMock.mockReset()
  writeSpy.mockReset()
  insertSpy.mockReset()
  deleteSpy.mockReset()
  logActivityMock.mockReset()
  blobDelMock.mockReset()
  resetTableState()
})

describe('non-admin callers: every restore and purge action refuses and writes nothing', () => {
  const cases: [string, () => Promise<{ ok: boolean }>][] = [
    ['restoreMeeting', () => restoreMeeting(ID)],
    ['restoreTask', () => restoreTask(ID)],
    ['restoreSprint', () => restoreSprint(ID)],
    ['restoreSegment', () => restoreSegment(ID)],
    ['restoreKeyframe', () => restoreKeyframe(ID)],
    ['restoreAssignment', () => restoreAssignment(ID)],
    ['purgeMeeting', () => purgeMeeting(ID, 'delete forever')],
    ['purgeTask', () => purgeTask(ID, 'delete forever')],
    ['purgeSprint', () => purgeSprint(ID, 'delete forever')],
    ['purgeSegment', () => purgeSegment(ID, 'delete forever')],
    ['purgeKeyframe', () => purgeKeyframe(ID, 'delete forever')],
  ]

  it.each(cases)('%s rejects a member and touches no write/delete', async (_name, run) => {
    asMember()
    const res = await run()
    expect(res.ok).toBe(false)
    expect(writeSpy).not.toHaveBeenCalled()
    expect(insertSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it.each(cases)('%s rejects a signed-out caller', async (_name, run) => {
    authMock.mockResolvedValue(null)
    const res = await run()
    expect(res.ok).toBe(false)
    expect(writeSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
  })
})

describe('restoreMeeting', () => {
  it('errs when the meeting is already live (guarded UPDATE matches 0 rows)', async () => {
    asAdmin()
    stateFor(meetings).updateReturning = [[]]
    const res = await restoreMeeting(ID)
    expect(res.ok).toBe(false)
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('nulls googleEventId, logs restored, and warns that the invite is not re-sent', async () => {
    asAdmin()
    stateFor(meetings).updateReturning = [[{ id: MEETING_ID, title: 'Sprint planning', appId: APP_ID }]]
    stateFor(apps).select = [[{ name: 'LogPup', slug: 'logpup' }]]

    const res = await restoreMeeting(MEETING_ID)

    expect(res.ok).toBe(true)
    expect(writeSpy).toHaveBeenCalledWith(
      meetings,
      expect.objectContaining({ deletedAt: null, deletedBy: null, googleEventId: null }),
    )
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'restored', entityType: 'meeting', entityId: MEETING_ID }),
    )
    if (res.ok) {
      expect(res.data.warning).toMatch(/not re-sent/)
      expect(res.data.warning).toMatch(/Add to calendar/i)
    }
  })
})

describe('restoreTask / restoreSprint', () => {
  it('restoreTask errs when already live', async () => {
    asAdmin()
    stateFor(tasks).updateReturning = [[]]
    const res = await restoreTask(ID)
    expect(res.ok).toBe(false)
  })

  it('restoreTask restores and logs with no pagePath, matching deleteTask', async () => {
    asAdmin()
    stateFor(tasks).updateReturning = [[{ id: ID, title: 'Fix flaky test', appId: APP_ID }]]
    stateFor(apps).select = [[{ slug: 'logpup' }]]
    const res = await restoreTask(ID)
    expect(res.ok).toBe(true)
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'restored', entityType: 'task', entityLabel: 'Fix flaky test' }),
    )
  })

  it('restoreSprint errs when already live (same guarded-UPDATE shape as restoreTask)', async () => {
    asAdmin()
    stateFor(sprints).updateReturning = [[]]
    const res = await restoreSprint(ID)
    expect(res.ok).toBe(false)
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('restoreSprint restores and logs with a pagePath', async () => {
    asAdmin()
    stateFor(sprints).updateReturning = [[{ id: ID, name: 'Sprint 9', appId: APP_ID }]]
    stateFor(apps).select = [[{ slug: 'logpup' }]]
    const res = await restoreSprint(ID)
    expect(res.ok).toBe(true)
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'restored', entityType: 'sprint', pagePath: '/apps/logpup' }),
    )
  })
})

describe('restoreSegment / restoreKeyframe: blocked while the parent meeting is trashed', () => {
  it('restoreSegment errs with "Restore the meeting first" and never reaches the UPDATE', async () => {
    asAdmin()
    stateFor(meetingNoteSegments).select = [
      [{ meetingId: MEETING_ID, meetingTitle: 'Standup', meetingDeletedAt: new Date('2026-08-01') }],
    ]
    const res = await restoreSegment(ID)
    expect(res).toEqual({ ok: false, error: 'Restore the meeting first' })
    expect(writeSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('restoreKeyframe errs with "Restore the meeting first" before checking the cap', async () => {
    asAdmin()
    stateFor(meetingScreenshots).select = [
      [{ meetingId: MEETING_ID, meetingTitle: 'Standup', meetingDeletedAt: new Date('2026-08-01') }],
    ]
    const res = await restoreKeyframe(ID)
    expect(res).toEqual({ ok: false, error: 'Restore the meeting first' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('restoreSegment restores a note whose meeting is live', async () => {
    asAdmin()
    stateFor(meetingNoteSegments).select = [[{ meetingId: MEETING_ID, meetingTitle: 'Standup', meetingDeletedAt: null }]]
    stateFor(meetingNoteSegments).updateReturning = [[{ id: ID }]]
    const res = await restoreSegment(ID)
    expect(res.ok).toBe(true)
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityLabel: noteSegmentDeleteLabel('Standup') }),
    )
  })
})

describe('restoreKeyframe: the live cap', () => {
  it('errs when restoring would exceed MAX_KEYFRAMES_PER_MEETING', async () => {
    asAdmin()
    stateFor(meetingScreenshots).select = [[{ meetingId: MEETING_ID, meetingTitle: 'Standup', meetingDeletedAt: null }]]
    stateFor(liveScreenshots).select = [[{ total: 60 }]]
    const res = await restoreKeyframe(ID)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/cap/)
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('restores when the live count is under the cap', async () => {
    asAdmin()
    stateFor(meetingScreenshots).select = [[{ meetingId: MEETING_ID, meetingTitle: 'Standup', meetingDeletedAt: null }]]
    stateFor(liveScreenshots).select = [[{ total: 5 }]]
    stateFor(meetingScreenshots).updateReturning = [[{ id: ID }]]
    const res = await restoreKeyframe(ID)
    expect(res.ok).toBe(true)
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityLabel: keyframeDeleteLabel('Standup') }),
    )
  })
})

describe('restoreAssignment', () => {
  it('errs, writing nothing, when the tombstone id is not an open removed row', async () => {
    asAdmin()
    stateFor(assignmentHistory).select = [[]]
    const res = await restoreAssignment(ID)
    expect(res.ok).toBe(false)
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('conflict: errs and writes nothing when a live assignment row already exists', async () => {
    asAdmin()
    const tombstone = {
      id: ID,
      userId: USER_ID,
      appId: APP_ID,
      role: 'Engineer',
      allocationPct: 0,
      effectiveFrom: new Date('2026-08-01T00:00:00Z'),
      effectiveTo: null,
      changeKind: 'removed',
    }
    stateFor(assignmentHistory).select = [[tombstone]]
    stateFor(assignments).select = [[{ id: 'live-assignment-1' }]]

    const res = await restoreAssignment(ID)

    expect(res).toEqual({ ok: false, error: 'They are already assigned to this app' })
    expect(insertSpy).not.toHaveBeenCalled()
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('recovers the pre-removal role/allocationPct from the closed predecessor and restores', async () => {
    asAdmin()
    const effectiveFrom = new Date('2026-08-01T00:00:00Z')
    const tombstone = {
      id: ID,
      userId: USER_ID,
      appId: APP_ID,
      role: 'Engineer', // carried over by buildHistoryEntry even on a tombstone
      allocationPct: 0, // forced to 0 on the tombstone — NOT what gets restored
      effectiveFrom,
      effectiveTo: null,
      changeKind: 'removed',
    }
    stateFor(assignmentHistory).select = [
      [tombstone], // tombstone lookup
      [{ role: 'Engineer', allocationPct: 60 }], // predecessor (the real figure)
    ]
    stateFor(assignments).select = [[]] // no live row — no conflict
    stateFor(assignments).insertReturning = [[{ id: 'new-assignment-1' }]]
    stateFor(apps).select = [[{ name: 'LogPup', slug: 'logpup' }]]
    stateFor(users).select = [[{ name: 'Jordan' }]]

    const res = await restoreAssignment(ID)

    expect(res).toEqual({ ok: true, data: undefined })
    expect(insertSpy).toHaveBeenCalledWith(
      assignments,
      expect.objectContaining({ userId: USER_ID, appId: APP_ID, role: 'Engineer', allocationPct: 60 }),
    )
    expect(writeSpy).toHaveBeenCalledWith(
      assignmentHistory,
      expect.objectContaining({ effectiveTo: expect.any(Date) }),
    )
    expect(insertSpy).toHaveBeenCalledWith(
      assignmentHistory,
      expect.objectContaining({ changeKind: 'assigned', allocationPct: 60 }),
    )
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'restored', entityType: 'assignment', entityLabel: 'Jordan' }),
    )
  })
})

describe('purges: confirm string is checked before any delete', () => {
  const cases: [string, (confirm: string) => Promise<{ ok: boolean }>][] = [
    ['purgeMeeting', (c) => purgeMeeting(ID, c)],
    ['purgeTask', (c) => purgeTask(ID, c)],
    ['purgeSprint', (c) => purgeSprint(ID, c)],
    ['purgeSegment', (c) => purgeSegment(ID, c)],
    ['purgeKeyframe', (c) => purgeKeyframe(ID, c)],
  ]

  it.each(cases)('%s errs on a missing/wrong confirm string before touching the DB', async (_name, run) => {
    asAdmin()
    const wrong = await run('')
    expect(wrong.ok).toBe(false)
    const alsoWrong = await run('DELETE FOREVER')
    expect(alsoWrong.ok).toBe(false)
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(blobDelMock).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })
})

describe('purgeMeeting', () => {
  it('collects every screenshot blob pathname before deleting, cascade or not', async () => {
    asAdmin()
    stateFor(meetingScreenshots).select = [[{ blobPathname: 'meeting-keyframes/a.jpg' }, { blobPathname: 'meeting-keyframes/b.jpg' }]]
    stateFor(meetings).deleteReturning = [[{ id: MEETING_ID, title: 'Standup', appId: APP_ID }]]
    stateFor(apps).select = [[{ name: 'LogPup', slug: 'logpup' }]]

    const res = await purgeMeeting(MEETING_ID, 'delete forever')

    expect(res.ok).toBe(true)
    expect(deleteSpy).toHaveBeenCalledWith(meetings)
    expect(blobDelMock).toHaveBeenCalledWith('meeting-keyframes/a.jpg')
    expect(blobDelMock).toHaveBeenCalledWith('meeting-keyframes/b.jpg')
    expect(logActivityMock).toHaveBeenCalledWith(expect.objectContaining({ verb: 'purged', entityType: 'meeting' }))
  })

  it('a concurrent restore (0 rows deleted) stops before touching any blob', async () => {
    asAdmin()
    stateFor(meetingScreenshots).select = [[{ blobPathname: 'meeting-keyframes/a.jpg' }]]
    stateFor(meetings).deleteReturning = [[]]

    const res = await purgeMeeting(MEETING_ID, 'delete forever')

    expect(res.ok).toBe(false)
    expect(blobDelMock).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })
})

describe('purgeKeyframe', () => {
  it('deletes the row then best-effort deletes its one blob', async () => {
    asAdmin()
    stateFor(meetingScreenshots).select = [[{ meetingId: MEETING_ID, meetingTitle: 'Standup', blobPathname: 'meeting-keyframes/x.jpg' }]]
    stateFor(meetingScreenshots).deleteReturning = [[{ id: ID }]]

    const res = await purgeKeyframe(ID, 'delete forever')

    expect(res.ok).toBe(true)
    expect(blobDelMock).toHaveBeenCalledWith('meeting-keyframes/x.jpg')
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'purged', entityLabel: keyframeDeleteLabel('Standup') }),
    )
  })

  it('a concurrent restore (0 rows deleted) performs NO blob del()', async () => {
    asAdmin()
    stateFor(meetingScreenshots).select = [[{ meetingId: MEETING_ID, meetingTitle: 'Standup', blobPathname: 'meeting-keyframes/x.jpg' }]]
    stateFor(meetingScreenshots).deleteReturning = [[]]

    const res = await purgeKeyframe(ID, 'delete forever')

    expect(res.ok).toBe(false)
    expect(blobDelMock).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })
})

describe('purgeTask / purgeSprint / purgeSegment: guarded delete + no-op on concurrent restore', () => {
  it('purgeTask purges a still-trashed task', async () => {
    asAdmin()
    stateFor(tasks).deleteReturning = [[{ id: ID, title: 'Old task', appId: APP_ID }]]
    const res = await purgeTask(ID, 'delete forever')
    expect(res.ok).toBe(true)
    expect(logActivityMock).toHaveBeenCalledWith(expect.objectContaining({ verb: 'purged', entityType: 'task' }))
  })

  it('purgeTask no-ops when the guarded delete matches 0 rows', async () => {
    asAdmin()
    stateFor(tasks).deleteReturning = [[]]
    const res = await purgeTask(ID, 'delete forever')
    expect(res.ok).toBe(false)
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('purgeSprint purges a still-trashed sprint', async () => {
    asAdmin()
    stateFor(sprints).deleteReturning = [[{ id: ID, name: 'Sprint 3', appId: APP_ID }]]
    stateFor(apps).select = [[{ slug: 'logpup' }]]
    const res = await purgeSprint(ID, 'delete forever')
    expect(res.ok).toBe(true)
  })

  it('purgeSprint no-ops when the guarded delete matches 0 rows', async () => {
    asAdmin()
    stateFor(sprints).deleteReturning = [[]]
    const res = await purgeSprint(ID, 'delete forever')
    expect(res.ok).toBe(false)
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('purgeSegment purges a note whose parent meeting still exists', async () => {
    asAdmin()
    stateFor(meetingNoteSegments).select = [[{ meetingId: MEETING_ID, meetingTitle: 'Standup' }]]
    stateFor(meetingNoteSegments).deleteReturning = [[{ id: ID }]]
    const res = await purgeSegment(ID, 'delete forever')
    expect(res.ok).toBe(true)
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityLabel: noteSegmentDeleteLabel('Standup') }),
    )
  })

  it('purgeSegment no-ops when the guarded delete matches 0 rows', async () => {
    asAdmin()
    stateFor(meetingNoteSegments).select = [[{ meetingId: MEETING_ID, meetingTitle: 'Standup' }]]
    stateFor(meetingNoteSegments).deleteReturning = [[]]
    const res = await purgeSegment(ID, 'delete forever')
    expect(res.ok).toBe(false)
    expect(logActivityMock).not.toHaveBeenCalled()
  })
})
