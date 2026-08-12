import { beforeEach, describe, expect, it, vi } from 'vitest'
import { meetingNoteSegments, meetingScreenshots, meetings } from '@/db/schema'

// deleteMeetingKeyframe and deleteNoteSegment are soft-delete (D3): the row
// is marked deletedAt/deletedBy, never removed. Same mocked-action idiom as
// src/features/admin/set-user-title.test.ts. ai-actions.ts pulls in a lot of
// this feature's other modules just by being imported — each is stubbed
// below so importing it here never reaches a real network call or a real DB
// connection.
const { authMock, writeSpy, deleteSpy, logActivityMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  writeSpy: vi.fn(),
  deleteSpy: vi.fn(),
  logActivityMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/features/activity/log', () => ({ logActivity: logActivityMock }))
// Neither function under test touches Blob storage — the keyframe delete's
// del() call was removed in this conversion. Mocked anyway so a regression
// that reintroduces one fails this file loudly instead of quietly passing.
vi.mock('@vercel/blob', () => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }))
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

// Three distinct tables get read across these two actions: `meetingScreenshots`
// (deleteMeetingKeyframe's own row), `meetingNoteSegments` (deleteNoteSegment's
// own row), and `meetings` (both go through canManageMeeting). Queues are
// consumed in call order per table.
let meetingQueue: unknown[][] = []
let screenshotQueue: unknown[][] = []
let segmentQueue: unknown[][] = []
let updateReturningQueue: unknown[][] = []

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => {
          if (table === meetings) return meetingQueue.shift() ?? []
          if (table === meetingScreenshots) return screenshotQueue.shift() ?? []
          if (table === meetingNoteSegments) return segmentQueue.shift() ?? []
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

const { deleteMeetingKeyframe, deleteNoteSegment, keyframeDeleteLabel, noteSegmentDeleteLabel } =
  await import('./ai-actions')

const MEETING_ID = '44444444-4444-4444-8444-444444444444'
const SCREENSHOT_ID = '55555555-5555-4555-8555-555555555555'
const SEGMENT_ID = '66666666-6666-4666-8666-666666666666'
const CREATOR_ID = 'creator-1'

const asCreator = () => authMock.mockResolvedValue({ user: { id: CREATOR_ID, role: 'member' } })
const asOther = () => authMock.mockResolvedValue({ user: { id: 'someone-else', role: 'member' } })

function baseMeeting(overrides: Record<string, unknown> = {}) {
  return { id: MEETING_ID, title: 'Sprint planning', createdBy: CREATOR_ID, ...overrides }
}

beforeEach(() => {
  authMock.mockReset()
  writeSpy.mockReset()
  deleteSpy.mockReset()
  logActivityMock.mockReset()
  meetingQueue = []
  screenshotQueue = []
  segmentQueue = []
  updateReturningQueue = []
})

describe('neutral entity labels', () => {
  it('keyframeDeleteLabel names the meeting, never the image', () => {
    expect(keyframeDeleteLabel('Sprint planning')).toBe('a screen keyframe in Sprint planning')
  })

  it('noteSegmentDeleteLabel names the meeting, never the note content', () => {
    expect(noteSegmentDeleteLabel('Sprint planning')).toBe('a note segment in Sprint planning')
  })
})

describe('deleteMeetingKeyframe', () => {
  it('rejects a caller who is neither the creator nor an admin, and writes nothing', async () => {
    asOther()
    screenshotQueue = [[{ id: SCREENSHOT_ID, meetingId: MEETING_ID, blobPathname: 'x.jpg' }]]
    meetingQueue = [[baseMeeting()]]
    const res = await deleteMeetingKeyframe(SCREENSHOT_ID)
    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('a second delete of an already-trashed keyframe returns err and does no further write', async () => {
    asCreator()
    screenshotQueue = [[{ id: SCREENSHOT_ID, meetingId: MEETING_ID, blobPathname: 'x.jpg' }]]
    meetingQueue = [[baseMeeting()]]
    // isNull(deletedAt) guard matched nothing — already trashed.
    updateReturningQueue = [[]]
    const res = await deleteMeetingKeyframe(SCREENSHOT_ID)
    expect(res).toEqual({ ok: false, error: 'Not found' })
    expect(writeSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('marks the row deleted with a neutral activity label, never the image content', async () => {
    asCreator()
    screenshotQueue = [[{ id: SCREENSHOT_ID, meetingId: MEETING_ID, blobPathname: 'x.jpg' }]]
    meetingQueue = [[baseMeeting()]]
    updateReturningQueue = [[{ id: SCREENSHOT_ID }]]

    const res = await deleteMeetingKeyframe(SCREENSHOT_ID)

    expect(res).toEqual({ ok: true, data: undefined })
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(writeSpy).toHaveBeenCalledWith(
      meetingScreenshots,
      expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: CREATOR_ID }),
    )
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        verb: 'deleted',
        entityLabel: 'a screen keyframe in Sprint planning',
      }),
    )
  })
})

describe('deleteNoteSegment', () => {
  it('refuses to delete a voice (transcript) segment', async () => {
    asCreator()
    segmentQueue = [[{ id: SEGMENT_ID, meetingId: MEETING_ID, source: 'voice' }]]
    const res = await deleteNoteSegment(SEGMENT_ID)
    expect(res).toEqual({ ok: false, error: 'The recorded transcript can’t be deleted' })
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('rejects a caller who is neither the creator nor an admin, and writes nothing', async () => {
    asOther()
    segmentQueue = [[{ id: SEGMENT_ID, meetingId: MEETING_ID, source: 'typed' }]]
    meetingQueue = [[baseMeeting()]]
    const res = await deleteNoteSegment(SEGMENT_ID)
    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('a second delete of an already-trashed segment returns err and does no further write', async () => {
    asCreator()
    segmentQueue = [[{ id: SEGMENT_ID, meetingId: MEETING_ID, source: 'typed' }]]
    meetingQueue = [[baseMeeting()]]
    updateReturningQueue = [[]]
    const res = await deleteNoteSegment(SEGMENT_ID)
    expect(res).toEqual({ ok: false, error: 'Not found' })
    expect(writeSpy).toHaveBeenCalledTimes(1)
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('marks the row deleted with a neutral activity label, never the note content', async () => {
    asCreator()
    segmentQueue = [[{ id: SEGMENT_ID, meetingId: MEETING_ID, source: 'typed' }]]
    meetingQueue = [[baseMeeting()]]
    updateReturningQueue = [[{ id: SEGMENT_ID }]]

    const res = await deleteNoteSegment(SEGMENT_ID)

    expect(res).toEqual({ ok: true, data: undefined })
    expect(writeSpy).toHaveBeenCalledWith(
      meetingNoteSegments,
      expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: CREATOR_ID }),
    )
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        verb: 'deleted',
        entityLabel: 'a note segment in Sprint planning',
      }),
    )
  })
})
