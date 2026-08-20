import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assignmentHistory,
  meetingNoteSegments,
  meetingScreenshots,
  meetings,
  sprints,
  tasks,
  userDeletions,
} from '@/db/schema'

// getTrash() fires one bounded row-SELECT + one COUNT per source, all inside
// a single Promise.all. Each table gets an independent {rows, count} queue —
// not one shared call-order queue — because six row-selects (terminated by
// .limit()) and six COUNT selects (terminated by awaiting .where() directly)
// interleave through Promise.all's microtask scheduling in a way that is NOT
// simply their literal left-to-right order in the source; keying by table +
// which terminal method fired sidesteps that entirely.
type TableQueues = { rows: unknown[][]; count: unknown[][] }
const tableQueues = new Map<unknown, TableQueues>()
function qFor(table: unknown): TableQueues {
  let q = tableQueues.get(table)
  if (!q) {
    q = { rows: [], count: [] }
    tableQueues.set(table, q)
  }
  return q
}

vi.mock('@/db', () => ({
  db: {
    select: () => {
      let fromTable: unknown
      const chain = {
        from: (t: unknown) => {
          fromTable = t
          return chain
        },
        leftJoin: () => chain,
        innerJoin: () => chain,
        where: () => ({
          then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve(qFor(fromTable).count.shift() ?? []).then(onFulfilled, onRejected),
          orderBy: () => ({
            limit: async () => qFor(fromTable).rows.shift() ?? [],
          }),
        }),
      }
      return chain
    },
  },
}))

const { getTrash } = await import('./trash-queries')

beforeEach(() => {
  tableQueues.clear()
})

describe('getTrash', () => {
  it('returns all nine groups, in kind order, even when every source is empty', async () => {
    const groups = await getTrash()
    // 'app' leads deliberately, not alphabetically: a deleted project is the
    // only kind that can explain the others (its meetings and sprints leave
    // every view with it), so it is read first. Same order as TRASH_KINDS and
    // TRASH_GROUP_ORDER — all three move together, or the card renders one
    // order while the data layer returns another.
    expect(groups.map((g) => g.kind)).toEqual([
      'app', 'meeting', 'task', 'sprint', 'bug', 'segment', 'keyframe', 'assignment', 'person',
    ])
    for (const g of groups) {
      expect(g.rows).toEqual([])
      expect(g.totalCount).toBe(0)
    }
  })

  it('shapes a meeting row and reports totalCount separately from the bounded rows shown', async () => {
    qFor(meetings).rows = [
      [
        {
          id: 'm1',
          title: 'Sprint planning',
          appName: 'LogPup',
          deletedAt: new Date('2026-08-01T00:00:00Z'),
          deletedByName: 'Alex',
          deletedByAvatarUrl: null,
        },
      ],
    ]
    qFor(meetings).count = [[{ total: 73 }]]

    const groups = await getTrash()
    const meetingGroup = groups.find((g) => g.kind === 'meeting')!

    expect(meetingGroup.rows).toHaveLength(1)
    expect(meetingGroup.rows[0]).toMatchObject({ id: 'm1', label: 'Sprint planning', context: 'LogPup' })
    expect(meetingGroup.totalCount).toBe(73)
  })

  it('a trashed segment carries the neutral label and the nesting flag, never its content', async () => {
    qFor(meetingNoteSegments).rows = [
      [
        {
          id: 'seg1',
          meetingTitle: 'Retro',
          appName: null,
          meetingDeletedAt: new Date('2026-07-01T00:00:00Z'), // parent meeting also trashed
          deletedAt: new Date('2026-08-01T00:00:00Z'),
          deletedByName: null,
          deletedByAvatarUrl: null,
        },
      ],
    ]
    qFor(meetingNoteSegments).count = [[{ total: 1 }]]

    const groups = await getTrash()
    const segmentGroup = groups.find((g) => g.kind === 'segment')!

    expect(segmentGroup.rows[0].label).toBe('a note segment in Retro')
    expect(segmentGroup.rows[0].parentTrashed).toBe(true)
  })

  it('an open removed assignment_history row becomes the assignment group', async () => {
    qFor(assignmentHistory).rows = [
      [
        {
          id: 'ah1',
          personName: 'Jordan',
          appName: 'LogPup',
          role: 'Engineer',
          deletedAt: new Date('2026-08-01T00:00:00Z'),
          deletedByName: 'Admin Alex',
          deletedByAvatarUrl: null,
        },
      ],
    ]
    qFor(assignmentHistory).count = [[{ total: 2 }]]

    const groups = await getTrash()
    const assignmentGroup = groups.find((g) => g.kind === 'assignment')!

    expect(assignmentGroup.rows[0]).toMatchObject({ id: 'ah1', label: 'Jordan', context: 'LogPup · Engineer' })
    expect(assignmentGroup.totalCount).toBe(2)
  })

  it('shapes tasks and sprints by their own title/name fields', async () => {
    qFor(tasks).rows = [
      [{ id: 't1', title: 'Fix flaky test', appName: 'LogPup', deletedAt: new Date(), deletedByName: null, deletedByAvatarUrl: null }],
    ]
    qFor(sprints).rows = [
      [{ id: 's1', name: 'Sprint 9', appName: 'LogPup', deletedAt: new Date(), deletedByName: null, deletedByAvatarUrl: null }],
    ]

    const groups = await getTrash()
    expect(groups.find((g) => g.kind === 'task')!.rows[0].label).toBe('Fix flaky test')
    expect(groups.find((g) => g.kind === 'sprint')!.rows[0].label).toBe('Sprint 9')
  })

  it('an open user_deletions row becomes the person group, keyed by the interval', async () => {
    qFor(userDeletions).rows = [
      [
        {
          // The user_deletions row, NOT the user — a person can be removed
          // and restored more than once, and restorePerson closes ONE
          // interval, so the interval is what the row has to be keyed by.
          id: 'ud1',
          personName: 'Sam',
          reason: 'Contract ended',
          deletedAt: new Date('2026-08-01T00:00:00Z'),
          deletedByName: 'Admin Alex',
          deletedByAvatarUrl: null,
        },
      ],
    ]
    qFor(userDeletions).count = [[{ total: 3 }]]

    const groups = await getTrash()
    const personGroup = groups.find((g) => g.kind === 'person')!

    expect(personGroup.rows[0]).toMatchObject({
      id: 'ud1',
      label: 'Sam',
      context: 'Contract ended',
      // Nothing contains a person, and their work never went anywhere — so
      // there is never a parent to restore first.
      parentTrashed: false,
    })
    expect(personGroup.totalCount).toBe(3)
  })

  it('shapes a trashed keyframe with the neutral label and never a blob URL', async () => {
    qFor(meetingScreenshots).rows = [
      [
        {
          id: 'kf1',
          meetingTitle: 'Standup',
          appName: 'LogPup',
          meetingDeletedAt: null,
          deletedAt: new Date(),
          deletedByName: null,
          deletedByAvatarUrl: null,
        },
      ],
    ]

    const groups = await getTrash()
    const keyframeGroup = groups.find((g) => g.kind === 'keyframe')!
    expect(keyframeGroup.rows[0].label).toBe('a screen keyframe in Standup')
    expect(Object.keys(keyframeGroup.rows[0])).not.toContain('blobUrl')
    expect(Object.keys(keyframeGroup.rows[0])).not.toContain('blobPathname')
  })
})
