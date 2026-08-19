import { describe, expect, it } from 'vitest'
import {
  SUPPORTED_ENTITY_TYPES,
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
