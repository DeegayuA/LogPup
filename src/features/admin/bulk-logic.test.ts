import { describe, expect, it } from 'vitest'
import {
  bulkResultTone,
  csvCell,
  csvFilename,
  describeBulkResult,
  groupSkipReasons,
  headerSelectionState,
  isSelected,
  pruneSelection,
  selectRange,
  summarizeOutcomes,
  toCsv,
  toggleAllSelected,
  toggleSelected,
  type BulkOutcome,
} from './bulk-logic'

const APPS = { one: 'app', many: 'apps' }

describe('selection: toggle', () => {
  it('adds an unselected id and removes a selected one', () => {
    expect(toggleSelected([], 'a')).toEqual(['a'])
    expect(toggleSelected(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('leaves the rest of the selection alone', () => {
    expect(toggleSelected(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('isSelected answers membership', () => {
    expect(isSelected(['a'], 'a')).toBe(true)
    expect(isSelected(['a'], 'b')).toBe(false)
  })
})

describe('selection: shift-click range', () => {
  const ordered = ['a', 'b', 'c', 'd', 'e']

  it('selects everything between the anchor and the target', () => {
    expect(selectRange(['b'], ordered, 'b', 'd')).toEqual(['b', 'c', 'd'])
  })

  it('works upwards as well as downwards', () => {
    expect(selectRange(['d'], ordered, 'd', 'b')).toEqual(['d', 'b', 'c'])
  })

  // The rule that matters: a range never takes rows away. There is no undo
  // for a selection, so a drag that deselected outside itself would lose
  // picks the operator had already made.
  it('never removes ids outside the range', () => {
    expect(selectRange(['e'], ordered, 'a', 'b')).toEqual(['e', 'a', 'b'])
  })

  it('does not duplicate ids already selected', () => {
    expect(selectRange(['b', 'c'], ordered, 'a', 'c')).toEqual(['b', 'c', 'a'])
  })

  it('degrades to a plain toggle when the anchor has gone', () => {
    expect(selectRange([], ordered, 'zz', 'c')).toEqual(['c'])
  })
})

describe('selection: header select-all', () => {
  it('selects every visible row when none are selected', () => {
    expect(toggleAllSelected([], ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('clears only the visible rows, keeping hidden ones selected', () => {
    // The header acts on what is on screen; a filtered-out row that was
    // already selected is not the header checkbox's business.
    expect(toggleAllSelected(['a', 'b', 'hidden'], ['a', 'b'])).toEqual(['hidden'])
  })

  it('completes a partial selection rather than clearing it', () => {
    expect(toggleAllSelected(['a'], ['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('reports none / partial / all', () => {
    expect(headerSelectionState([], ['a', 'b'])).toBe('none')
    expect(headerSelectionState(['a'], ['a', 'b'])).toBe('partial')
    expect(headerSelectionState(['a', 'b'], ['a', 'b'])).toBe('all')
  })

  it('is "none" when there is nothing to select', () => {
    expect(headerSelectionState(['a'], [])).toBe('none')
  })
})

describe('selection: pruning after a refresh', () => {
  it('drops ids whose rows are gone', () => {
    expect(pruneSelection(['a', 'b'], ['b', 'c'])).toEqual(['b'])
  })

  it('keeps the order of what survives', () => {
    expect(pruneSelection(['c', 'a', 'b'], ['a', 'b', 'c'])).toEqual(['c', 'a', 'b'])
  })
})

describe('partial results', () => {
  const outcomes: BulkOutcome[] = [
    { id: 'a', ok: true },
    { id: 'b', ok: false, reason: 'Cannot change your own account' },
    { id: 'c', ok: false, reason: 'Cannot remove the last superadmin' },
    { id: 'd', ok: false, reason: 'Cannot change your own account' },
  ]

  it('splits succeeded from skipped and keeps every reason', () => {
    expect(summarizeOutcomes(outcomes)).toEqual({
      attempted: 4,
      succeeded: ['a'],
      skipped: [
        { id: 'b', reason: 'Cannot change your own account' },
        { id: 'c', reason: 'Cannot remove the last superadmin' },
        { id: 'd', reason: 'Cannot change your own account' },
      ],
    })
  })

  it('groups skips by reason, commonest first', () => {
    const report = summarizeOutcomes(outcomes)
    expect(groupSkipReasons(report.skipped)).toEqual([
      { reason: 'Cannot change your own account', ids: ['b', 'd'] },
      { reason: 'Cannot remove the last superadmin', ids: ['c'] },
    ])
  })
})

describe('describeBulkResult: a batch may not overstate itself', () => {
  it('says the plain count only when nothing was refused', () => {
    const report = summarizeOutcomes([
      { id: 'a', ok: true },
      { id: 'b', ok: true },
    ])
    expect(describeBulkResult(report, 'archived', APPS)).toBe('2 apps archived')
    expect(bulkResultTone(report)).toBe('success')
  })

  // The regression this whole module exists to prevent: a batch where the
  // guards refused half the rows must never read as a clean success.
  it('names the skips when some rows were refused', () => {
    const report = summarizeOutcomes([
      { id: 'a', ok: true },
      { id: 'b', ok: false, reason: 'Cannot change your own account' },
    ])
    expect(describeBulkResult(report, 'archived', APPS)).toBe('1 app archived, 1 skipped')
    expect(bulkResultTone(report)).toBe('warning')
  })

  it('says nothing happened when nothing happened', () => {
    const report = summarizeOutcomes([
      { id: 'a', ok: false, reason: 'nope' },
      { id: 'b', ok: false, reason: 'nope' },
    ])
    expect(describeBulkResult(report, 'archived', APPS)).toBe('Nothing archived — 2 apps skipped')
    expect(bulkResultTone(report)).toBe('error')
  })

  it('singularises both halves', () => {
    const report = summarizeOutcomes([{ id: 'a', ok: true }])
    expect(describeBulkResult(report, 'deleted', APPS)).toBe('1 app deleted')
  })
})

describe('csvCell', () => {
  it('passes plain values through', () => {
    expect(csvCell('LogPup')).toBe('LogPup')
    expect(csvCell(42)).toBe('42')
    expect(csvCell(true)).toBe('true')
  })

  it('renders null and undefined as empty', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Smith, Alex')).toBe('"Smith, Alex"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
  })

  // A tag somebody typed as =HYPERLINK(...) is a formula the moment this file
  // opens in a spreadsheet. The apostrophe is the standard defusing.
  it('defuses spreadsheet formulas in string cells', () => {
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell('+44 7700 900000')).toBe("'+44 7700 900000")
    expect(csvCell('@handle')).toBe("'@handle")
    expect(csvCell('-lead')).toBe("'-lead")
  })

  it('leaves negative NUMBERS alone — they are data, not an attack', () => {
    expect(csvCell(-3)).toBe('-3')
  })
})

describe('toCsv', () => {
  it('writes a header row and CRLF line endings', () => {
    expect(toCsv(['Name', 'Email'], [['Alex', 'alex@x.com'], ['Bo', null]])).toBe(
      'Name,Email\r\nAlex,alex@x.com\r\nBo,',
    )
  })

  it('emits just the header for an empty selection', () => {
    expect(toCsv(['Name'], [])).toBe('Name')
  })
})

describe('csvFilename', () => {
  it('dates the file so downloads sort', () => {
    expect(csvFilename('apps', new Date('2026-08-20T09:30:00Z'))).toBe('apps-2026-08-20.csv')
  })
})
