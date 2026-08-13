// vitest.config.ts only globs 'src/**/*.test.ts' (no .tsx), and this repo
// has no @testing-library dependency — there is no component-test infra to
// render trash-card.tsx/trash-row-actions.tsx against. Rather than add one
// for this task, the logic worth testing (typed-confirm matching, group
// ordering, the disabled-reason message, the "showing N of M" footnote) was
// pulled out into trash-card-logic.ts as plain functions; this file tests
// those directly, and the components stay thin renderers over them.
import { describe, expect, it } from 'vitest'
import type { TrashGroup } from '@/features/admin/trash-grouping'
import {
  matchesPurgeConfirm,
  orderGroupsForDisplay,
  PURGE_CONFIRM_PHRASE,
  restoreDisabledReason,
  trashCountFootnote,
  TRASH_GROUP_ORDER,
  TRASH_GROUP_TITLES,
} from './trash-card-logic'

describe('matchesPurgeConfirm', () => {
  it('matches the exact phrase', () => {
    expect(matchesPurgeConfirm(PURGE_CONFIRM_PHRASE)).toBe(true)
    expect(matchesPurgeConfirm('delete forever')).toBe(true)
  })

  it('rejects anything else, including near misses', () => {
    expect(matchesPurgeConfirm('Delete Forever')).toBe(false)
    expect(matchesPurgeConfirm('delete forever ')).toBe(false)
    expect(matchesPurgeConfirm(' delete forever')).toBe(false)
    expect(matchesPurgeConfirm('delete-forever')).toBe(false)
    expect(matchesPurgeConfirm('DELETE FOREVER')).toBe(false)
    expect(matchesPurgeConfirm('')).toBe(false)
  })
})

describe('restoreDisabledReason', () => {
  it('names the reason when the parent meeting is trashed', () => {
    expect(restoreDisabledReason({ parentTrashed: true })).toBe('Restore the meeting first')
  })

  it('is null when nothing blocks the restore', () => {
    expect(restoreDisabledReason({ parentTrashed: false })).toBeNull()
  })
})

describe('trashCountFootnote', () => {
  it('is null when every trashed row for the source is already shown', () => {
    expect(trashCountFootnote(3, 3)).toBeNull()
    expect(trashCountFootnote(0, 0)).toBeNull()
  })

  it('is null if, somehow, more is shown than the reported total', () => {
    expect(trashCountFootnote(5, 3)).toBeNull()
  })

  it('names both counts once the bounded SELECT truncated something', () => {
    expect(trashCountFootnote(50, 57)).toBe('Showing latest 50 of 57')
  })
})

describe('orderGroupsForDisplay', () => {
  function group(kind: TrashGroup['kind'], totalCount = 1): TrashGroup {
    return {
      kind,
      rows:
        totalCount > 0
          ? [
              {
                id: kind,
                label: kind,
                context: null,
                deletedByName: null,
                deletedByAvatarUrl: null,
                deletedAt: new Date('2026-08-01T00:00:00Z'),
                parentTrashed: false,
              },
            ]
          : [],
      totalCount,
    }
  }

  it('returns an entry for every kind, in TRASH_GROUP_ORDER, whatever order the input arrives in', () => {
    const input = [group('assignment'), group('meeting'), group('keyframe')]
    const ordered = orderGroupsForDisplay(input)
    expect(ordered.map((g) => g.kind)).toEqual(TRASH_GROUP_ORDER)
  })

  it('fills in a missing kind with an empty group instead of dropping it', () => {
    const ordered = orderGroupsForDisplay([group('meeting')])
    expect(ordered.find((g) => g.kind === 'sprint')).toEqual({
      kind: 'sprint',
      rows: [],
      totalCount: 0,
    })
  })

  it("preserves each group's own rows/totalCount — only reorders", () => {
    const ordered = orderGroupsForDisplay([group('task', 5)])
    const taskGroup = ordered.find((g) => g.kind === 'task')
    expect(taskGroup?.totalCount).toBe(5)
    expect(taskGroup?.rows).toHaveLength(1)
  })

  it('is stable when the input is already empty', () => {
    expect(orderGroupsForDisplay([])).toEqual(
      TRASH_GROUP_ORDER.map((kind) => ({ kind, rows: [], totalCount: 0 })),
    )
  })
})

describe('TRASH_GROUP_TITLES', () => {
  it('has a non-blank title for every kind in TRASH_GROUP_ORDER', () => {
    for (const kind of TRASH_GROUP_ORDER) {
      expect(TRASH_GROUP_TITLES[kind]).toBeTruthy()
    }
  })
})
