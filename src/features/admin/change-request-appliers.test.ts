import { describe, expect, it } from 'vitest'
import {
  SUPPORTED_ENTITY_TYPES,
  buildTaskDeadlineSet,
  detectConflict,
  isSupportedEntityType,
} from '@/features/admin/change-request-appliers'

describe('detectConflict', () => {
  it('passes when the row still matches the pre-image', () => {
    const before = { title: 'Ship the thing', assigneeId: 'u1' }
    expect(detectConflict(before, { title: 'Ship the thing', assigneeId: 'u1', other: 9 })).toBeNull()
  })

  it('names the field that moved under the request', () => {
    const before = { title: 'Ship the thing', assigneeId: 'u1' }
    expect(detectConflict(before, { title: 'Ship it', assigneeId: 'u1' })).toBe('title')
  })

  it('treats a vanished row as a conflict', () => {
    expect(detectConflict({ title: 'x' }, null)).toBe('row no longer exists')
  })

  it('compares dates by value, not by reference', () => {
    const when = new Date('2026-04-08T00:00:00Z')
    expect(detectConflict({ startsAt: when }, { startsAt: new Date(when) })).toBeNull()
    expect(detectConflict({ startsAt: when }, { startsAt: new Date('2026-04-09T00:00:00Z') }))
      .toBe('startsAt')
  })

  it('treats a null that became a value as a conflict', () => {
    expect(detectConflict({ assigneeId: null }, { assigneeId: 'u2' })).toBe('assigneeId')
  })
})

describe('SUPPORTED_ENTITY_TYPES', () => {
  it('is closed — an unsupported type is refused at filing time', () => {
    // A generic applier is impossible on neon-http: db.batch needs statically
    // built statements. Refusing late, at approval, would strand the request.
    expect(SUPPORTED_ENTITY_TYPES).toEqual(['task', 'sprint', 'meeting', 'worklog'])
    expect(isSupportedEntityType('app')).toBe(false)
    expect(isSupportedEntityType('task')).toBe(true)
  })
})

describe('buildTaskDeadlineSet', () => {
  // A task that already has a date AND a stamped original — the state every
  // task reaches after its first due date is set. Rows predating migration
  // 0049 carry a date with no original, and applyDueDate deliberately never
  // back-fills one: the first promise is unknowable after the fact.
  const current = {
    dueDate: '2026-08-12',
    dueKind: 'target',
    originalDueDate: '2026-08-12',
    dueChangedCount: 0,
  }
  const undated = { dueDate: null, dueKind: 'target', originalDueDate: null, dueChangedCount: 0 }

  it('leaves an edit that never mentions the deadline alone', () => {
    // applyDueDate counts every change it is handed, and a rename is not a
    // slip — so a title-only request must not enter the helper at all.
    const after = { title: 'Ship the thing' }
    expect(buildTaskDeadlineSet(after, current)).toEqual(after)
  })

  it('stamps the original date when an approval first gives a task one', () => {
    // The hole this closes: the generic spread wrote dueDate straight to the
    // row, so an approved request was the ONE write path that never recorded
    // what the date had originally been.
    const set = buildTaskDeadlineSet({ dueDate: '2026-08-26' }, undated)
    expect(set.originalDueDate).toBe('2026-08-26')
    // First-set is not a move — there was nothing to move from.
    expect(set.dueChangedCount).toBe(0)
  })

  it('counts an approved slip and leaves the original alone', () => {
    const set = buildTaskDeadlineSet({ dueDate: '2026-08-26' }, current)
    expect(set.originalDueDate).toBe('2026-08-12')
    expect(set.dueChangedCount).toBe(1)
  })

  it('refuses a committed date with no note, in front of the reviewer', () => {
    // Loudly, not by downgrading to 'target': a commitment nobody was promised
    // is what makes the grade meaningless.
    expect(() =>
      buildTaskDeadlineSet({ dueDate: '2026-09-01', dueKind: 'committed' }, current),
    ).toThrow()
  })

  it('keeps the rest of the edit alongside the rebuilt deadline', () => {
    const set = buildTaskDeadlineSet({ title: 'Renamed', dueDate: '2026-08-26' }, current)
    expect(set.title).toBe('Renamed')
    expect(set.dueDate).toBe('2026-08-26')
  })

  it('reads a Date from the driver and an ISO string from jsonb alike', () => {
    const fromDriver = { ...current, originalDueDate: new Date('2026-08-12T00:00:00Z') }
    expect(buildTaskDeadlineSet({ dueDate: '2026-08-26' }, fromDriver).originalDueDate).toBe(
      '2026-08-12',
    )
  })
})
