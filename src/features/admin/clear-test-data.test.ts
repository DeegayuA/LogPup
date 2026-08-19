import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activityLog,
  apps,
  assignments,
  dailyWorklogs,
  meetingAttendeeRecommendations,
  meetingAttendees,
  meetings,
  sprints,
  tasks,
  users,
} from '@/db/schema'

// clearTestData is the "Clear database" tool, and the only thing worth
// asserting about it is WHICH tables it names. Every table here is reached by
// a bare `db.delete(table)` with no predicate, so a table's presence in the
// call list is the entire behaviour — recording the table references handed to
// db.delete() tests exactly that, without a database.
//
// The bug this file was written for: daily_worklogs was missing. It is the one
// per-person table with no cascade into it from anything the wipe deletes (its
// only FK is user_id, and users are deliberately kept so the acting admin is
// not locked out), so unlike sprint_checkins it does not disappear for free —
// and /worklog went on replaying a cleared workspace's history.
const { authMock, deleteSpy } = vi.hoisted(() => ({
  authMock: vi.fn(),
  deleteSpy: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: vi.fn() }))
vi.mock('@/db', () => ({
  db: {
    delete: async (table: unknown) => {
      deleteSpy(table)
    },
  },
}))

const { clearTestData } = await import('./actions')

/** Table references passed to db.delete(), in call order. */
const deletedTables = () => deleteSpy.mock.calls.map(([table]) => table)

function confirmForm(value = 'CLEAR'): FormData {
  const form = new FormData()
  form.set('confirm', value)
  return form
}

// Clearing the database is 'danger.dbclear', which is superadmin-only: it is
// one of exactly three powers that separate superadmin from admin. The old
// two-role model had no seat above admin, so this used to be an admin test.
const asSuperadmin = () =>
  authMock.mockResolvedValue({ user: { id: 'superadmin-1', role: 'superadmin' } })

beforeEach(() => {
  authMock.mockReset()
  deleteSpy.mockReset()
  // Read through process.env on every call (dbClearEnabled), so stubbing it
  // per-test is enough — no module reset needed.
  vi.stubEnv('ENABLE_DB_CLEAR', '1')
})

describe('clearTestData table coverage', () => {
  // Named one per table rather than as a single set comparison: when someone
  // drops a line from the delete sequence, the failure should say which table
  // stopped being cleared, not print two unordered lists to diff by eye.
  const mustClear: ReadonlyArray<readonly [string, unknown]> = [
    ['apps', apps],
    ['assignments', assignments],
    ['sprints', sprints],
    ['tasks', tasks],
    ['meetings', meetings],
    ['meeting_attendees', meetingAttendees],
    ['meeting_attendee_recommendations', meetingAttendeeRecommendations],
    // The regression: see the file header.
    ['daily_worklogs', dailyWorklogs],
  ]

  it.each(mustClear)('clears %s', async (_name, table) => {
    asSuperadmin()
    const res = await clearTestData(null, confirmForm())
    expect(res.ok).toBe(true)
    expect(deletedTables()).toContain(table)
  })

  it('keeps users and the activity trail', async () => {
    asSuperadmin()
    await clearTestData(null, confirmForm())
    // Users survive so the admin who ran the wipe can still sign in;
    // activity_log survives because a wipe is the event an audit trail most
    // needs to have recorded. Both are decisions, so both get a test.
    expect(deletedTables()).not.toContain(users)
    expect(deletedTables()).not.toContain(activityLog)
  })

  it('deletes meeting children before meetings, so no FK is violated', async () => {
    asSuperadmin()
    await clearTestData(null, confirmForm())
    const order = deletedTables()
    expect(order.indexOf(meetingAttendeeRecommendations)).toBeLessThan(order.indexOf(meetings))
    expect(order.indexOf(meetingAttendees)).toBeLessThan(order.indexOf(meetings))
  })
})

describe('clearTestData guards', () => {
  it('refuses a member and deletes nothing', async () => {
    authMock.mockResolvedValue({ user: { id: 'member-1', role: 'member' } })
    const res = await clearTestData(null, confirmForm())
    expect(res).toEqual({ ok: false, error: 'Admins only' })
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('refuses when ENABLE_DB_CLEAR is unset and deletes nothing', async () => {
    vi.stubEnv('ENABLE_DB_CLEAR', '')
    asSuperadmin()
    const res = await clearTestData(null, confirmForm())
    expect(res.ok).toBe(false)
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('refuses without the typed confirmation and deletes nothing', async () => {
    asSuperadmin()
    const res = await clearTestData(null, confirmForm('clear'))
    expect(res).toEqual({ ok: false, error: 'Type CLEAR to confirm' })
    expect(deleteSpy).not.toHaveBeenCalled()
  })
})
