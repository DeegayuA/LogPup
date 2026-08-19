import { beforeEach, describe, expect, it, vi } from 'vitest'
import { meetings, users } from '@/db/schema'
import { liveMeetings } from '@/db/live'

// deleteMeeting is soft-delete (D3): the row is marked deletedAt/deletedBy,
// never removed. Same mocked-action idiom as
// src/features/admin/set-user-title.test.ts — vi.mock the collaborators with
// chainable stubs + a writeSpy, then await import the module under test.
const { authMock, writeSpy, deleteSpy, logActivityMock, deleteCalendarEventMock, blobDelMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    writeSpy: vi.fn(),
    deleteSpy: vi.fn(),
    logActivityMock: vi.fn(),
    deleteCalendarEventMock: vi.fn(),
    blobDelMock: vi.fn(),
  }))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
vi.mock('@/features/calendar/google-calendar', () => ({
  createCalendarEvent: vi.fn(),
  deleteCalendarEvent: deleteCalendarEventMock,
  describeCalendarError: vi.fn(() => 'an unknown error'),
  updateCalendarEventTime: vi.fn(),
}))
// deleteMeeting no longer imports @vercel/blob at all (the keyframe sweep
// was removed) — mocked anyway so a regression that reintroduces a blob
// delete would fail this test loudly rather than silently reconnecting.
vi.mock('@vercel/blob', () => ({ del: blobDelMock, put: vi.fn(), get: vi.fn() }))

// Two distinct tables get read in deleteMeeting: `meetings` (meetingById)
// and, only when the meeting has a googleEventId, `users` (the creator's
// refresh token). Queues are consumed in call order per table.
let meetingQueue: unknown[][] = []
let userQueue: unknown[][] = []
let updateReturningQueue: unknown[][] = []

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        // meetingById (deleteMeeting's read) goes through liveMeetings (D4)
        // — the write below is still the raw `meetings` table, which is
        // what writeSpy asserts against.
        where: async () => {
          if (table === liveMeetings) return meetingQueue.shift() ?? []
          if (table === users) return userQueue.shift() ?? []
          return []
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            writeSpy(table, values)
            return updateReturningQueue.shift() ?? []
          },
        }),
      }),
    }),
    delete: deleteSpy,
  },
}))

const { deleteMeeting } = await import('./actions')

const MEETING_ID = '11111111-1111-4111-8111-111111111111'
const CREATOR_ID = 'creator-1'

const ADMIN_ID = 'admin-1'

const asCreator = () => authMock.mockResolvedValue({ user: { id: CREATOR_ID, role: 'member' } })
const asOther = () => authMock.mockResolvedValue({ user: { id: 'someone-else', role: 'member' } })
// Deletion is admin-only, organiser or not — see the gate in deleteMeeting.
// The creator is therefore NOT a sufficient actor for a delete test here, and
// that is the one way this file differs from the edit/reschedule tests.
const asAdmin = () => authMock.mockResolvedValue({ user: { id: ADMIN_ID, role: 'admin' } })

function baseMeeting(overrides: Record<string, unknown> = {}) {
  return {
    id: MEETING_ID,
    title: 'Sprint standup',
    appId: null,
    createdBy: CREATOR_ID,
    googleEventId: null,
    ...overrides,
  }
}

beforeEach(() => {
  authMock.mockReset()
  writeSpy.mockReset()
  deleteSpy.mockReset()
  logActivityMock.mockReset()
  deleteCalendarEventMock.mockReset()
  blobDelMock.mockReset()
  meetingQueue = []
  userQueue = []
  updateReturningQueue = []
})

describe('deleteMeeting', () => {
  it('rejects a non-admin caller and writes nothing', async () => {
    asOther()
    meetingQueue = [[baseMeeting()]]
    const res = await deleteMeeting(MEETING_ID)
    expect(res).toEqual({ ok: false, error: 'Not allowed to delete this meeting' })
    expect(writeSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  // The organiser is the interesting rejection, not a random member: they may
  // edit and reschedule this very meeting, so "can manage it" reads like "can
  // delete it" until this test says otherwise.
  it('rejects the meeting’s own creator when they are not an admin', async () => {
    asCreator()
    meetingQueue = [[baseMeeting()]]
    const res = await deleteMeeting(MEETING_ID)
    expect(res).toEqual({ ok: false, error: 'Not allowed to delete this meeting' })
    expect(writeSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('a second delete of an already-trashed meeting returns err and does no further write', async () => {
    asAdmin()
    meetingQueue = [[baseMeeting()]]
    // isNull(deletedAt) guard matched nothing — someone else already trashed it.
    updateReturningQueue = [[]]
    const res = await deleteMeeting(MEETING_ID)
    expect(res).toEqual({ ok: false, error: 'Meeting not found' })
    expect(writeSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('marks the row deleted, still deletes the Google Calendar event, and never touches Blob storage', async () => {
    asAdmin()
    meetingQueue = [[baseMeeting({ googleEventId: 'event-123' })]]
    userQueue = [[{ googleRefreshToken: 'refresh-xyz' }]]
    updateReturningQueue = [[{ id: MEETING_ID }]]

    const res = await deleteMeeting(MEETING_ID)

    expect(res).toEqual({ ok: true, data: undefined })
    expect(deleteCalendarEventMock).toHaveBeenCalledWith('refresh-xyz', 'event-123')
    expect(blobDelMock).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(writeSpy).toHaveBeenCalledWith(
      meetings,
      expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: ADMIN_ID }),
    )
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'deleted', entityType: 'meeting', entityId: MEETING_ID }),
    )
  })
})
