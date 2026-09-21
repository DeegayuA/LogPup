import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_REQUESTABLE_FIELDS,
  SUPPORTED_ENTITY_TYPES,
  buildTaskDeadlineSet,
  currentRowFor,
  detectConflict,
  isSupportedEntityType,
} from '@/features/admin/change-request-appliers'

const APP_ID = '33333333-3333-4333-8333-333333333333'

const { selectFields, selectRows } = vi.hoisted(() => ({
  selectFields: [] as unknown[],
  selectRows: [] as unknown[][],
}))
vi.mock('@/db', () => ({
  db: {
    select: (fields: unknown) => {
      selectFields.push(fields)
      return { from: () => ({ where: async () => selectRows.shift() ?? [] }) }
    },
  },
}))

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
    expect(SUPPORTED_ENTITY_TYPES).toEqual(['task', 'sprint', 'meeting', 'worklog', 'app'])
    // 'app' joined the registry for the sign-off feature — a plain spread
    // like sprint/meeting/worklog, gated at filing by APP_REQUESTABLE_FIELDS.
    expect(isSupportedEntityType('app')).toBe(true)
    expect(isSupportedEntityType('task')).toBe(true)
    expect(isSupportedEntityType('bogus')).toBe(false)
  })
})

describe('currentRowFor', () => {
  beforeEach(() => {
    selectFields.length = 0
    selectRows.length = 0
  })

  it('reads an app through liveApps, selecting only the requestable columns', async () => {
    // NOT change_policy (migration 0072 unapplied — see change-request-actions.ts's
    // comment), NOT pmId/leadId (a pm/lead move needs the appRoleHistory
    // close+open pair this single SELECT/applier cannot express).
    selectRows.push([
      { name: 'LogPup', description: 'desc', repoUrl: null, techTags: [], aliases: [], status: 'active', internal: false },
    ])
    const row = await currentRowFor('app', APP_ID)
    expect(row).toEqual({
      name: 'LogPup', description: 'desc', repoUrl: null, techTags: [], aliases: [], status: 'active', internal: false,
    })
    expect(Object.keys(selectFields[0] as object).sort()).toEqual([...APP_REQUESTABLE_FIELDS].sort())
    expect(APP_REQUESTABLE_FIELDS).not.toContain('changePolicy')
    expect(APP_REQUESTABLE_FIELDS).not.toContain('pmId')
    expect(APP_REQUESTABLE_FIELDS).not.toContain('leadId')
  })

  it('reads a task from the raw table, unfiltered by requestable columns', async () => {
    selectRows.push([{ id: 't1', title: 'Ship it' }])
    const row = await currentRowFor('task', 't1')
    expect(row).toEqual({ id: 't1', title: 'Ship it' })
  })

  it('returns null when the row is gone', async () => {
    selectRows.push([])
    expect(await currentRowFor('app', APP_ID)).toBeNull()
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
