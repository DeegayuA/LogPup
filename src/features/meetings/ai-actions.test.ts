import { beforeEach, describe, expect, it, vi } from 'vitest'
import { meetingNoteSegments, meetingScreenshots, meetingTaskSuggestions, tasks } from '@/db/schema'
import { liveMeetings, liveNoteSegments, liveScreenshots, liveTasks } from '@/db/live'

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
  // The model-routing table (features/gemini/models.ts) is imported for its
  // side-effect-free constants by anything that reaches ai-actions, and it
  // re-exports these two off the client. Absent from the mock they are
  // `undefined` at module scope, which fails the whole FILE at import time —
  // and it surfaces here and in trash-actions.test.ts as two unrelated-looking
  // suite failures rather than one missing export.
  FALLBACK_GEMINI_MODEL: 'gemini-test-fallback',
  GEMINI_MODEL_FALLBACK_ORDER: ['gemini-test', 'gemini-test-fallback'],
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

// Distinct tables get read across these three actions: `meetingScreenshots`
// (deleteMeetingKeyframe's own row), `meetingNoteSegments` (deleteNoteSegment's
// own row), `meetingTaskSuggestions` and `tasks` (undoAutoAcceptedSuggestion),
// and `meetings` (all three go through canManageMeeting) — the last three
// reads go through the live subqueries as of D4 (see the mock below). Queues
// are consumed in call order per table.
let meetingQueue: unknown[][] = []
let screenshotQueue: unknown[][] = []
let segmentQueue: unknown[][] = []
let suggestionQueue: unknown[][] = []
let taskQueue: unknown[][] = []
let updateReturningQueue: unknown[][] = []

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        // Reads go through the live subqueries (D4: canManageMeeting via
        // liveMeetings, deleteMeetingKeyframe/uploadMeetingKeyframe via
        // liveScreenshots, deleteNoteSegment via liveNoteSegments,
        // undoAutoAcceptedSuggestion's task lookup via liveTasks) —
        // meetingTaskSuggestions isn't itself soft-deleted, so it stays the
        // raw table. Writes below still use the raw tables, which is what
        // writeSpy asserts against.
        where: async () => {
          if (table === liveMeetings) return meetingQueue.shift() ?? []
          if (table === liveScreenshots) return screenshotQueue.shift() ?? []
          if (table === liveNoteSegments) return segmentQueue.shift() ?? []
          if (table === meetingTaskSuggestions) return suggestionQueue.shift() ?? []
          if (table === liveTasks) return taskQueue.shift() ?? []
          return []
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        // writeSpy fires here, not inside .returning(), so a write is
        // recorded even for a caller (undoAutoAcceptedSuggestion's
        // meetingTaskSuggestions update) that never chains .returning() at
        // all and just awaits the .where(...) call directly.
        where: () => {
          writeSpy(table, values)
          return { returning: async () => updateReturningQueue.shift() ?? [] }
        },
      }),
    }),
    delete: deleteSpy,
  },
}))

const {
  deleteMeetingKeyframe,
  deleteNoteSegment,
  undoAutoAcceptedSuggestion,
  keyframeDeleteLabel,
  noteSegmentDeleteLabel,
} = await import('./ai-actions')

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
  suggestionQueue = []
  taskQueue = []
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

// undoAutoAcceptedSuggestion is the sixth conversion (not one of the five
// named in the brief, but a real db.delete(tasks) call this file also had —
// `tasks` is a soft-deleted table, so leaving it hard-deleted would have
// kept check 4 red for this whole file). Same soft-delete rigor as the other
// five: authorization rejection, the double-guard no-op, and the happy path
// — which here also has to prove the meetingTaskSuggestions state reset
// (status back to 'open', createdTaskId cleared) still happens alongside the
// soft delete.
const SUGGESTION_ID = '77777777-7777-4777-8777-777777777777'
const TASK_ID = '88888888-8888-4888-8888-888888888888'
const APP_ID = 'app-1'

function baseSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: SUGGESTION_ID,
    meetingId: MEETING_ID,
    status: 'accepted',
    acceptedBy: null,
    createdTaskId: TASK_ID,
    text: 'Fix the flaky test',
    suggestedUserId: 'assignee-1',
    suggestedDueDate: null,
    ...overrides,
  }
}

// Matches what suggestionToTaskPayload (notes.ts) reconstructs from
// baseSuggestion() above, so canUndoAutoAssign sees the task as untouched
// since the auto-assign pass created it — i.e. eligible for undo.
function baseTask(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    status: 'todo',
    title: 'Fix the flaky test',
    assigneeId: 'assignee-1',
    dueDate: null,
    ...overrides,
  }
}

describe('undoAutoAcceptedSuggestion', () => {
  it('rejects a caller who is neither the meeting creator nor an admin, and writes nothing', async () => {
    asOther()
    suggestionQueue = [[baseSuggestion()]]
    meetingQueue = [[baseMeeting({ appId: APP_ID })]]
    const res = await undoAutoAcceptedSuggestion(SUGGESTION_ID)
    expect(res).toEqual({ ok: false, error: 'Not allowed' })
    expect(writeSpy).not.toHaveBeenCalled()
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('a second undo of an already-trashed task returns err and does no further write', async () => {
    asCreator()
    suggestionQueue = [[baseSuggestion()]]
    meetingQueue = [[baseMeeting({ appId: APP_ID })]]
    taskQueue = [[baseTask()]]
    // isNull(deletedAt) guard matched nothing — already trashed.
    updateReturningQueue = [[]]

    const res = await undoAutoAcceptedSuggestion(SUGGESTION_ID)

    expect(res).toEqual({ ok: false, error: 'That task no longer exists' })
    expect(writeSpy).toHaveBeenCalledTimes(1)
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(logActivityMock).not.toHaveBeenCalled()
  })

  it('soft-deletes the auto-created task and resets the suggestion back to a manual card', async () => {
    asCreator()
    suggestionQueue = [[baseSuggestion()]]
    meetingQueue = [[baseMeeting({ appId: APP_ID })]]
    taskQueue = [[baseTask()]]
    updateReturningQueue = [[{ id: TASK_ID }]]

    const res = await undoAutoAcceptedSuggestion(SUGGESTION_ID)

    expect(res).toEqual({ ok: true, data: undefined })
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(writeSpy).toHaveBeenCalledWith(
      tasks,
      expect.objectContaining({ deletedAt: expect.any(Date), deletedBy: CREATOR_ID }),
    )
    expect(writeSpy).toHaveBeenCalledWith(meetingTaskSuggestions, {
      status: 'open',
      createdTaskId: null,
      acceptedBy: null,
    })
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ verb: 'reopened', entityType: 'suggestion', entityId: SUGGESTION_ID }),
    )
  })
})
