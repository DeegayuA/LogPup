import { describe, expect, it } from 'vitest'

import { applyDueDate, DueDateError, hasSlipped, type DueState } from './due-date'

const fresh: DueState = {
  dueDate: null,
  dueKind: 'target',
  originalDueDate: null,
  dueChangedCount: 0,
}

const dated = (dueDate: string, over: Partial<DueState> = {}): DueState => ({
  ...fresh,
  dueDate,
  originalDueDate: dueDate,
  ...over,
})

describe('original_due_date is written once', () => {
  it('stamps on the first null -> non-null transition', () => {
    expect(applyDueDate(fresh, { dueDate: '2026-08-12' }).originalDueDate).toBe('2026-08-12')
  })

  it('never moves once set, however far the date travels', () => {
    const after = applyDueDate(dated('2026-08-12'), { dueDate: '2026-08-26' })
    expect(after.originalDueDate).toBe('2026-08-12')
    expect(after.dueDate).toBe('2026-08-26')
  })

  it('is not re-stamped when a date is cleared and set again', () => {
    // The operation that would otherwise destroy the answer: clear, then set a
    // later date, and "original" silently becomes the second promise.
    const cleared = applyDueDate(dated('2026-08-12'), { dueDate: null })
    expect(cleared.originalDueDate).toBe('2026-08-12')
    const reset = applyDueDate(
      {
        ...fresh,
        originalDueDate: cleared.originalDueDate,
        dueChangedCount: cleared.dueChangedCount,
      },
      { dueDate: '2026-09-30' },
    )
    expect(reset.originalDueDate).toBe('2026-08-12')
  })

  it('stays null while the task has never had a date', () => {
    expect(applyDueDate(fresh, { dueDate: null }).originalDueDate).toBeNull()
  })
})

describe('due_changed_count counts moves, not writes', () => {
  it('does not count the first set', () => {
    expect(applyDueDate(fresh, { dueDate: '2026-08-12' }).dueChangedCount).toBe(0)
  })

  it('counts a real move', () => {
    expect(applyDueDate(dated('2026-08-12'), { dueDate: '2026-08-26' }).dueChangedCount).toBe(1)
  })

  it('does not count re-saving the same date', () => {
    // A form that submits every field must not inflate the count.
    const state = dated('2026-08-12', { dueChangedCount: 3 })
    expect(applyDueDate(state, { dueDate: '2026-08-12' }).dueChangedCount).toBe(3)
  })

  it('does not count clearing', () => {
    const state = dated('2026-08-12', { dueChangedCount: 2 })
    expect(applyDueDate(state, { dueDate: null }).dueChangedCount).toBe(2)
  })
})

describe('committed requires a counterparty', () => {
  it('refuses a commitment with no note', () => {
    expect(() => applyDueDate(fresh, { dueDate: '2026-08-12', dueKind: 'committed' })).toThrow(
      DueDateError,
    )
  })

  it('refuses a whitespace-only note, which is a note nobody wrote', () => {
    expect(() =>
      applyDueDate(fresh, { dueDate: '2026-08-12', dueKind: 'committed', note: '   ' }),
    ).toThrow(DueDateError)
  })

  it('refuses a commitment with no date', () => {
    expect(() =>
      applyDueDate(fresh, { dueDate: null, dueKind: 'committed', note: 'Promised to Kestrel' }),
    ).toThrow(DueDateError)
  })

  it('accepts a dated commitment with a named counterparty, trimming the note', () => {
    const patch = applyDueDate(fresh, {
      dueDate: '2026-08-12',
      dueKind: 'committed',
      note: '  Promised to Kestrel on the call  ',
    })
    expect(patch.dueKind).toBe('committed')
    expect(patch.dueCommitmentNote).toBe('Promised to Kestrel on the call')
  })

  it('drops the note when a commitment is downgraded to a target', () => {
    const committed: DueState = { ...dated('2026-08-12'), dueKind: 'committed' }
    const patch = applyDueDate(committed, { dueDate: '2026-08-12', dueKind: 'target' })
    expect(patch.dueCommitmentNote).toBeNull()
  })

  it('keeps the existing kind when the caller does not name one', () => {
    const committed: DueState = { ...dated('2026-08-12'), dueKind: 'committed' }
    const patch = applyDueDate(committed, { dueDate: '2026-08-26', note: 'Still Kestrel' })
    expect(patch.dueKind).toBe('committed')
  })

  it('falls back to target when the date is cleared, so a promise cannot outlive its date', () => {
    const committed: DueState = { ...dated('2026-08-12'), dueKind: 'committed' }
    expect(applyDueDate(committed, { dueDate: null }).dueKind).toBe('target')
  })
})

describe('hasSlipped', () => {
  it('is true only when the current date is later than the original', () => {
    expect(hasSlipped({ dueDate: '2026-08-26', originalDueDate: '2026-08-12' })).toBe(true)
    expect(hasSlipped({ dueDate: '2026-08-12', originalDueDate: '2026-08-12' })).toBe(false)
    // Pulled EARLIER is not a slip — finishing sooner than promised is not debt.
    expect(hasSlipped({ dueDate: '2026-08-01', originalDueDate: '2026-08-12' })).toBe(false)
  })

  it('says false rather than guessing when either side is missing', () => {
    expect(hasSlipped({ dueDate: null, originalDueDate: '2026-08-12' })).toBe(false)
    expect(hasSlipped({ dueDate: '2026-08-12', originalDueDate: null })).toBe(false)
  })

  it('compares as strings across a month boundary', () => {
    expect(hasSlipped({ dueDate: '2026-09-01', originalDueDate: '2026-08-31' })).toBe(true)
  })
})
