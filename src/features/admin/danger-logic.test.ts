import { describe, expect, it } from 'vitest'
import type { TrashGroup, TrashKind, TrashRow } from '@/features/admin/trash-grouping'
import {
  DANGER_BATCH_LIMIT,
  MAX_BACKUP_DOWNLOAD_BYTES,
  PURGEABLE_TRASH_KINDS,
  backupFilename,
  backupSummary,
  backupTooLarge,
  deleteMeetingPhrase,
  deleteMeetingSummary,
  emptyTrashPhrase,
  emptyTrashSummary,
  formatBytes,
  matchesConfirm,
  normalizeConfirm,
  planBatch,
  purgeProgressMessage,
  purgeQueue,
  purgeableTrashTotal,
  resetAppPhrase,
  resetAppSummary,
  wipeRecordingsPhrase,
  wipeRecordingsSummary,
} from '@/features/admin/danger-logic'

// Pure module, zero mocks — same shape as trash-grouping.test.ts. Everything
// here is hand-built data in, plain values out.

function row(id: string): TrashRow {
  return {
    id,
    label: id,
    context: null,
    deletedByName: null,
    deletedByAvatarUrl: null,
    deletedAt: new Date('2026-08-01T00:00:00Z'),
    parentTrashed: false,
  }
}

function group(kind: TrashKind, ids: string[], totalCount = ids.length): TrashGroup {
  return { kind, rows: ids.map(row), totalCount }
}

describe('typed confirmations', () => {
  it('ignores case and surrounding/repeated whitespace', () => {
    expect(matchesConfirm('  Logpup  ', 'logpup')).toBe(true)
    expect(matchesConfirm('EMPTY   12   ITEMS', 'empty 12 items')).toBe(true)
  })

  it('normalizes to a single canonical form', () => {
    expect(normalizeConfirm('  Wipe\t 3   Keyframes ')).toBe('wipe 3 keyframes')
  })

  it('never matches an empty expected phrase, however it was typed', () => {
    // The guard that stops a target with a blank name being confirmed by
    // leaving the box empty — the state a picker is in before anything is
    // chosen.
    expect(matchesConfirm('', '')).toBe(false)
    expect(matchesConfirm('   ', '   ')).toBe(false)
    expect(matchesConfirm('anything', '')).toBe(false)
  })

  it('refuses a near miss', () => {
    expect(matchesConfirm('logpu', 'logpup')).toBe(false)
    expect(matchesConfirm('delete forever', 'empty 3 items')).toBe(false)
  })
})

describe('phrases are specific to the run, not a constant word', () => {
  it('bakes the count into the workspace-wide phrases', () => {
    // THE interlock: a phrase typed against yesterday's count does not confirm
    // today's run.
    expect(matchesConfirm(emptyTrashPhrase(12), emptyTrashPhrase(13))).toBe(false)
    expect(matchesConfirm(wipeRecordingsPhrase(12), wipeRecordingsPhrase(13))).toBe(false)
  })

  it('says item/items and keyframe/keyframes correctly', () => {
    expect(emptyTrashPhrase(1)).toBe('empty 1 item')
    expect(emptyTrashPhrase(0)).toBe('empty 0 items')
    expect(emptyTrashPhrase(37)).toBe('empty 37 items')
    expect(wipeRecordingsPhrase(1)).toBe('wipe 1 keyframe')
    expect(wipeRecordingsPhrase(412)).toBe('wipe 412 keyframes')
  })

  it('uses the project address for a reset', () => {
    expect(resetAppPhrase('logpup')).toBe('logpup')
  })

  it('uses the meeting title, falling back to the id when it is blank', () => {
    expect(deleteMeetingPhrase({ title: 'Weekly sync', id: 'abc' })).toBe('Weekly sync')
    expect(deleteMeetingPhrase({ title: '   ', id: 'abc' })).toBe('abc')
    expect(deleteMeetingPhrase({ title: '', id: 'abc' })).toBe('abc')
  })
})

describe('blast radius summaries', () => {
  it('marks only the two recoverable controls reversible', () => {
    expect(backupSummary().reversible).toBe(true)
    expect(deleteMeetingSummary('Weekly sync').reversible).toBe(true)
    expect(resetAppSummary('LogPup', { sprints: 2, tasks: 9 }).reversible).toBe(false)
    expect(wipeRecordingsSummary(4).reversible).toBe(false)
    expect(emptyTrashSummary(4).reversible).toBe(false)
  })

  it('the export destroys nothing at all', () => {
    expect(backupSummary().destroys).toEqual([])
  })

  it('every summary names something that survives', () => {
    // A control that lists only what it takes makes the operator reconstruct
    // the other half from memory, and the other half is what distinguishes
    // these controls from each other.
    for (const radius of [
      backupSummary(),
      deleteMeetingSummary('Weekly sync'),
      resetAppSummary('LogPup', { sprints: 1, tasks: 1 }),
      wipeRecordingsSummary(1),
      emptyTrashSummary(1),
    ]) {
      expect(radius.survives.length).toBeGreaterThan(0)
    }
  })

  it('reset counts the board it is about to take', () => {
    const radius = resetAppSummary('LogPup', { sprints: 2, tasks: 9 })
    expect(radius.destroys.join(' ')).toContain('9 tasks')
    expect(radius.destroys.join(' ')).toContain('2 sprints')
    expect(radius.survives.join(' ')).toContain('meetings')
  })

  it('the recordings wipe says the notes survive and the transcripts are untouched', () => {
    const radius = wipeRecordingsSummary(4)
    expect(radius.survives.join(' ')).toContain('AI write-up')
    expect(radius.survives.join(' ')).toContain('transcripts')
  })

  it('emptying the trash says removed assignments stay', () => {
    // There is no purgeAssignment to call, so the copy has to admit it rather
    // than implying the bin came out clean.
    expect(emptyTrashSummary(3).survives.join(' ')).toContain('assignments')
  })
})

describe('trash purge order', () => {
  it('puts every child kind before the container that cascades it away', () => {
    const at = (kind: TrashKind) => PURGEABLE_TRASH_KINDS.indexOf(kind)
    // meeting_note_segments/meeting_screenshots cascade from meetings, and
    // sprints/tasks cascade from apps (schema.ts). Reversing either pair makes
    // the later purge report "nothing purged" for work that did happen.
    expect(at('segment')).toBeLessThan(at('meeting'))
    expect(at('keyframe')).toBeLessThan(at('meeting'))
    expect(at('task')).toBeLessThan(at('app'))
    expect(at('sprint')).toBeLessThan(at('app'))
  })

  it('excludes assignments, which have no purge action', () => {
    expect(PURGEABLE_TRASH_KINDS).not.toContain('assignment')
  })

  it('counts only purgeable kinds', () => {
    const groups = [
      group('meeting', ['m1'], 4),
      group('assignment', ['a1'], 9),
      group('task', ['t1', 't2'], 2),
    ]
    expect(purgeableTrashTotal(groups)).toBe(6)
  })

  it('flattens the queue in purge order and drops assignments', () => {
    const groups = [
      group('app', ['app-1']),
      group('assignment', ['assign-1']),
      group('meeting', ['meet-1']),
      group('keyframe', ['kf-1']),
    ]
    expect(purgeQueue(groups)).toEqual([
      { kind: 'keyframe', id: 'kf-1' },
      { kind: 'meeting', id: 'meet-1' },
      { kind: 'app', id: 'app-1' },
    ])
  })

  it('tolerates a kind the trash has no rows for', () => {
    expect(purgeQueue([group('task', ['t1'])])).toEqual([{ kind: 'task', id: 't1' }])
  })
})

describe('bounded work', () => {
  it('splits into a batch and a remainder', () => {
    const items = Array.from({ length: 7 }, (_, i) => i)
    expect(planBatch(items, 3)).toEqual({ batch: [0, 1, 2], remaining: 4 })
  })

  it('takes everything when the limit is not reached', () => {
    expect(planBatch([1, 2], 5)).toEqual({ batch: [1, 2], remaining: 0 })
  })

  it('never reports a negative remainder or a fractional limit', () => {
    expect(planBatch([1, 2, 3], 0)).toEqual({ batch: [], remaining: 3 })
    expect(planBatch([1, 2, 3], -4)).toEqual({ batch: [], remaining: 3 })
    expect(planBatch([1, 2, 3], 2.7)).toEqual({ batch: [1, 2], remaining: 1 })
  })

  it('defaults to the ceiling one invocation is allowed', () => {
    const items = Array.from({ length: DANGER_BATCH_LIMIT + 5 }, (_, i) => i)
    expect(planBatch(items).batch).toHaveLength(DANGER_BATCH_LIMIT)
    expect(planBatch(items).remaining).toBe(5)
  })

  it('tells the operator when there is more to do', () => {
    expect(
      purgeProgressMessage({ purged: 50, skipped: 0, remaining: 290 }, { one: 'item', many: 'items' }),
    ).toBe('Deleted 50 items — 290 still to go, run it again')
    expect(
      purgeProgressMessage({ purged: 1, skipped: 2, remaining: 0 }, { one: 'item', many: 'items' }),
    ).toBe('Deleted 1 item')
  })
})

describe('backup download', () => {
  it('refuses only above the payload ceiling', () => {
    expect(backupTooLarge(MAX_BACKUP_DOWNLOAD_BYTES)).toBe(false)
    expect(backupTooLarge(MAX_BACKUP_DOWNLOAD_BYTES + 1)).toBe(true)
  })

  it('stays under the platform response limit it exists to pre-empt', () => {
    expect(MAX_BACKUP_DOWNLOAD_BYTES).toBeLessThan(4.5 * 1024 * 1024)
  })

  it('names the file .enc, and with no character a filesystem rejects', () => {
    const name = backupFilename(new Date('2026-08-20T14:05:09.123Z'))
    expect(name).toBe('logpup-backup-2026-08-20T14-05-09Z.json.enc')
    expect(name).not.toContain(':')
  })

  it('formats sizes people can compare', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})
