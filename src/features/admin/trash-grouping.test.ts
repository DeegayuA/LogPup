import { describe, expect, it } from 'vitest'
import { keyframeDeleteLabel, noteSegmentDeleteLabel } from '@/features/meetings/note-labels'
import {
  buildAssignmentTrashRow,
  buildKeyframeTrashRow,
  buildMeetingTrashRow,
  buildSegmentTrashRow,
  buildSprintTrashRow,
  buildTaskTrashRow,
  toTrashGroup,
} from './trash-grouping'

const DELETED_AT = new Date('2026-08-01T12:00:00Z')

describe('trash row builders: label/context shaping', () => {
  it('a meeting row uses the title as the label and the app as context', () => {
    const row = buildMeetingTrashRow({
      id: 'm1',
      title: 'Sprint planning',
      appName: 'LogPup',
      deletedAt: DELETED_AT,
      deletedByName: 'Alex',
      deletedByAvatarUrl: null,
    })
    expect(row).toEqual({
      id: 'm1',
      label: 'Sprint planning',
      context: 'LogPup',
      deletedByName: 'Alex',
      deletedByAvatarUrl: null,
      deletedAt: DELETED_AT,
      parentTrashed: false,
    })
  })

  it('a task row carries its app as context and is never parent-trashed', () => {
    const row = buildTaskTrashRow({
      id: 't1',
      title: 'Fix the flaky test',
      appName: 'LogPup',
      deletedAt: DELETED_AT,
      deletedByName: 'Alex',
      deletedByAvatarUrl: 'https://example.com/a.png',
    })
    expect(row.label).toBe('Fix the flaky test')
    expect(row.context).toBe('LogPup')
    expect(row.parentTrashed).toBe(false)
  })

  it('a sprint row uses its name as the label', () => {
    const row = buildSprintTrashRow({
      id: 's1',
      name: 'Sprint 12',
      appName: null,
      deletedAt: DELETED_AT,
      deletedByName: null,
      deletedByAvatarUrl: null,
    })
    expect(row.label).toBe('Sprint 12')
    expect(row.context).toBeNull()
  })
})

describe('segment/keyframe rows: neutral label, never content', () => {
  const rawSegment = {
    id: 'seg1',
    meetingTitle: 'Sprint planning',
    appName: 'LogPup',
    meetingDeletedAt: null,
    deletedAt: DELETED_AT,
    deletedByName: 'Alex',
    deletedByAvatarUrl: null,
  }

  it('a segment row label is the neutral placeholder, not any note content', () => {
    const row = buildSegmentTrashRow(rawSegment)
    expect(row.label).toBe('a note segment in Sprint planning')
    // The neutral placeholder never contains anything a caller could have
    // supplied as note text — nothing in the raw row (which deliberately
    // carries no `content` field at all) leaks into the label.
    expect(row.label).not.toContain('undefined')
    expect(Object.keys(rawSegment)).not.toContain('content')
  })

  it('a keyframe row label is the neutral placeholder, not the image', () => {
    const row = buildKeyframeTrashRow({ ...rawSegment, id: 'kf1' })
    expect(row.label).toBe('a screen keyframe in Sprint planning')
    expect(Object.keys(rawSegment)).not.toContain('blobUrl')
    expect(Object.keys(rawSegment)).not.toContain('blobPathname')
  })

  // Cross-check against the shared module directly, not just a hardcoded
  // string — this is what actually stops trash-grouping.ts's builders and
  // note-labels.ts (also used by ai-actions.ts) from silently drifting into
  // two different neutral labels. Before note-labels.ts existed, both sides
  // carried their OWN copy of these two functions and nothing caught a
  // divergence between them.
  it('a segment row label is exactly noteSegmentDeleteLabel from the shared module', () => {
    const row = buildSegmentTrashRow(rawSegment)
    expect(row.label).toBe(noteSegmentDeleteLabel(rawSegment.meetingTitle))
  })

  it('a keyframe row label is exactly keyframeDeleteLabel from the shared module', () => {
    const row = buildKeyframeTrashRow({ ...rawSegment, id: 'kf1' })
    expect(row.label).toBe(keyframeDeleteLabel(rawSegment.meetingTitle))
  })

  it('parentTrashed is false when the parent meeting is live', () => {
    const row = buildSegmentTrashRow(rawSegment)
    expect(row.parentTrashed).toBe(false)
  })

  it('parentTrashed is true when the parent meeting is itself trashed (nesting)', () => {
    const row = buildSegmentTrashRow({ ...rawSegment, meetingDeletedAt: new Date('2026-07-01T00:00:00Z') })
    expect(row.parentTrashed).toBe(true)
  })

  it('a keyframe nested under a trashed meeting also reports parentTrashed', () => {
    const row = buildKeyframeTrashRow({ ...rawSegment, id: 'kf2', meetingDeletedAt: new Date('2026-07-01T00:00:00Z') })
    expect(row.parentTrashed).toBe(true)
  })

  it('two different meeting titles never collide on the same neutral label', () => {
    const a = buildSegmentTrashRow({ ...rawSegment, meetingTitle: 'Standup' })
    const b = buildSegmentTrashRow({ ...rawSegment, meetingTitle: 'Retro' })
    expect(a.label).not.toBe(b.label)
  })
})

describe('assignment trash row', () => {
  it('labels with the removed person and folds app + role into context', () => {
    const row = buildAssignmentTrashRow({
      id: 'ah1',
      personName: 'Jordan',
      appName: 'LogPup',
      role: 'Engineer',
      deletedAt: DELETED_AT,
      deletedByName: 'Admin Alex',
      deletedByAvatarUrl: null,
    })
    expect(row.label).toBe('Jordan')
    expect(row.context).toBe('LogPup · Engineer')
    expect(row.parentTrashed).toBe(false)
  })

  it('falls back to just the role when there is no app name', () => {
    const row = buildAssignmentTrashRow({
      id: 'ah2',
      personName: 'Jordan',
      appName: null,
      role: 'Engineer',
      deletedAt: DELETED_AT,
      deletedByName: null,
      deletedByAvatarUrl: null,
    })
    expect(row.context).toBe('Engineer')
  })

  it('falls back to a placeholder label when the person is unresolvable', () => {
    const row = buildAssignmentTrashRow({
      id: 'ah3',
      personName: null,
      appName: 'LogPup',
      role: 'Engineer',
      deletedAt: DELETED_AT,
      deletedByName: null,
      deletedByAvatarUrl: null,
    })
    expect(row.label).toBe('Unknown user')
  })
})

describe('toTrashGroup', () => {
  it('groups rows under a kind and carries the total separately from what is shown', () => {
    const group = toTrashGroup(
      'meeting',
      [
        { id: 'm1', title: 'A', appName: null, deletedAt: DELETED_AT, deletedByName: null, deletedByAvatarUrl: null },
        { id: 'm2', title: 'B', appName: null, deletedAt: DELETED_AT, deletedByName: null, deletedByAvatarUrl: null },
      ],
      57,
      buildMeetingTrashRow,
    )
    expect(group.kind).toBe('meeting')
    expect(group.rows).toHaveLength(2)
    // "showing latest N of M": N = rows.length (bounded by the caller's
    // per-source LIMIT), M = totalCount (the real, unbounded count).
    expect(group.totalCount).toBe(57)
  })

  it('an empty source still reports its (zero) total rather than being omitted', () => {
    const group = toTrashGroup('sprint', [], 0, buildSprintTrashRow)
    expect(group).toEqual({ kind: 'sprint', rows: [], totalCount: 0 })
  })
})
