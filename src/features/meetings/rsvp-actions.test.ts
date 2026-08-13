import { beforeEach, describe, expect, it, vi } from 'vitest'
import { meetingAttendees } from '@/db/schema'
import { liveMeetings } from '@/db/live'

// respondToMeeting used to read the meeting through liveMeetings but never
// guard on it being missing — so an RSVP write would proceed against a
// trashed (or nonexistent) meeting and logActivity would fire with
// entityLabel: ''. This is the regression test for that fix, matching
// setMeetingLink's existing "meeting not found" guard just below it in
// rsvp-actions.ts. Same mocked-action idiom as
// src/features/admin/set-user-title.test.ts.
const { authMock, writeSpy, logActivityMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  writeSpy: vi.fn(),
  logActivityMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))

let meetingQueue: unknown[][] = []
let attendeeReturningQueue: unknown[][] = []

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => (table === liveMeetings ? meetingQueue.shift() ?? [] : []),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            writeSpy(table, values)
            return attendeeReturningQueue.shift() ?? []
          },
        }),
      }),
    }),
  },
}))

const { respondToMeeting } = await import('./rsvp-actions')

const MEETING_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = 'user-1'

const asUser = () => authMock.mockResolvedValue({ user: { id: USER_ID, role: 'member' } })

beforeEach(() => {
  authMock.mockReset()
  writeSpy.mockReset()
  logActivityMock.mockReset()
  meetingQueue = []
  attendeeReturningQueue = []
})

describe('respondToMeeting', () => {
  it('errs and writes nothing when the meeting is missing or trashed (liveMeetings finds no row)', async () => {
    asUser()
    meetingQueue = [[]] // liveMeetings excludes a trashed meeting — empty read

    const res = await respondToMeeting(MEETING_ID, 'going')

    expect(res).toEqual({ ok: false, error: 'Meeting not found' })
    expect(writeSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('records the RSVP and logs activity with the real meeting title when the meeting is live', async () => {
    asUser()
    meetingQueue = [[{ title: 'Sprint planning' }]]
    attendeeReturningQueue = [[{ userId: USER_ID }]]

    const res = await respondToMeeting(MEETING_ID, 'going')

    expect(res).toEqual({ ok: true, data: undefined })
    expect(writeSpy).toHaveBeenCalledWith(meetingAttendees, { response: 'going' })
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'rsvp', entityLabel: 'Sprint planning', detail: 'going' }),
    )
  })

  it('rejects a signed-out caller and writes nothing', async () => {
    authMock.mockResolvedValue(null)
    const res = await respondToMeeting(MEETING_ID, 'going')
    expect(res).toEqual({ ok: false, error: 'Sign in required' })
    expect(writeSpy).not.toHaveBeenCalled()
  })
})
