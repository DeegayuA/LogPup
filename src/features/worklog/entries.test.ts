import { describe, expect, it } from 'vitest'

import {
  ENTRY_CATEGORIES,
  ENTRY_MINUTES_MAX,
  accountedFraction,
  formatHours,
  totalMinutes,
  validateEntry,
  type EntryInput,
} from './entries'

const entry = (minutes: number) => ({ minutes })

describe('totalMinutes', () => {
  it('sums a day', () => {
    expect(totalMinutes([entry(90), entry(30), entry(120)])).toBe(240)
  })

  it('is 0 for a day with no entries, not NaN', () => {
    expect(totalMinutes([])).toBe(0)
  })

  it('stays exact across many half-hours — the reason minutes are integers', () => {
    // The same day expressed in hours (0.5 x 17) drifts off 8.5 in binary
    // floating point; in minutes it cannot.
    const halves = Array.from({ length: 17 }, () => entry(30))
    expect(totalMinutes(halves)).toBe(510)
  })
})

describe('formatHours', () => {
  it('renders 90 minutes as 1.5', () => {
    expect(formatHours(90)).toBe('1.5')
  })

  it('drops a trailing .0 — a full day reads 8, never 8.0', () => {
    expect(formatHours(480)).toBe('8')
  })

  it('rounds to one decimal', () => {
    expect(formatHours(100)).toBe('1.7')
  })

  it('renders an empty day as 0', () => {
    expect(formatHours(0)).toBe('0')
  })

  it('returns a bare number with no unit, so "6.5 / 8" formats as one phrase', () => {
    expect(formatHours(390)).toBe('6.5')
  })
})

describe('accountedFraction', () => {
  it('divides logged by scheduled', () => {
    expect(accountedFraction(390, 480)).toBeCloseTo(0.8125)
  })

  it('returns null rather than dividing by a zero scheduled day', () => {
    // Sunday, a holiday, or approved leave. 0, 1 and Infinity are all lies
    // about a day nobody owed work on.
    expect(accountedFraction(120, 0)).toBeNull()
  })

  it('returns null for a negative or non-finite schedule instead of a nonsense ratio', () => {
    expect(accountedFraction(120, -60)).toBeNull()
    expect(accountedFraction(120, Number.NaN)).toBeNull()
  })

  it('returns null — never a number — when the day length is unknown, so a caller must handle it', () => {
    // There is no minutes-per-full-day constant in this repo and this module
    // must not invent one: whether a full day is 8h, 8.5h or 9h is a pending
    // product decision. "Cannot say" is the honest answer and it is in the
    // return type so no caller can render an assumed denominator by accident.
    const unknown: number = 0
    expect(accountedFraction(300, unknown)).toBeNull()
  })

  it('does NOT clamp at 1 — a ten-hour eight-hour day really is 1.25', () => {
    // Clamping would hide the long day the cross-check exists partly to
    // notice. The UI caps the bar, not the number.
    expect(accountedFraction(600, 480)).toBeCloseTo(1.25)
  })

  it('is 0 for a day with nothing logged against a real schedule', () => {
    expect(accountedFraction(0, 480)).toBe(0)
  })
})

describe('validateEntry: the category/task rule', () => {
  const base: EntryInput = { minutes: 60, category: 'task', taskId: 'task-1' }

  it('accepts a task entry that names its task', () => {
    expect(validateEntry(base)).toEqual({ ok: true })
  })

  it('REQUIRES a task when the category is task', () => {
    const result = validateEntry({ ...base, taskId: null })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.problem).toBe('task-required')
  })

  it('treats an empty-string task id as no task', () => {
    const result = validateEntry({ ...base, taskId: '' })
    expect(result.ok === false && result.problem).toBe('task-required')
  })

  it('treats an omitted taskId as no task', () => {
    const result = validateEntry({ minutes: 60, category: 'task' })
    expect(result.ok === false && result.problem).toBe('task-required')
  })

  it.each(ENTRY_CATEGORIES.filter((c) => c !== 'task'))(
    'FORBIDS a task on a %s entry — a meeting must not borrow a task identity',
    (category) => {
      const result = validateEntry({ minutes: 60, category, taskId: 'task-1' })
      expect(result.ok === false && result.problem).toBe('task-forbidden')
    },
  )

  it.each(ENTRY_CATEGORIES.filter((c) => c !== 'task'))(
    'accepts a %s entry with no task — non-task time is first-class',
    (category) => {
      expect(validateEntry({ minutes: 60, category })).toEqual({ ok: true })
    },
  )

  it('rejects a category that is not one of the seven', () => {
    const result = validateEntry({ minutes: 60, category: 'napping' })
    expect(result.ok === false && result.problem).toBe('unknown-category')
  })
})

describe('validateEntry: minutes', () => {
  it('rejects a fractional duration — the column is an integer', () => {
    const result = validateEntry({ minutes: 90.5, category: 'admin' })
    expect(result.ok === false && result.problem).toBe('minutes-not-whole')
  })

  it('rejects zero — an entry with no time on it records nothing', () => {
    const result = validateEntry({ minutes: 0, category: 'admin' })
    expect(result.ok === false && result.problem).toBe('minutes-too-small')
  })

  it('rejects a negative duration', () => {
    const result = validateEntry({ minutes: -30, category: 'admin' })
    expect(result.ok === false && result.problem).toBe('minutes-too-small')
  })

  it('rejects more than a calendar day, catching 90 typed as 900... and worse', () => {
    const result = validateEntry({ minutes: ENTRY_MINUTES_MAX + 1, category: 'admin' })
    expect(result.ok === false && result.problem).toBe('minutes-too-large')
  })

  it('accepts exactly 24 hours at the boundary', () => {
    expect(validateEntry({ minutes: ENTRY_MINUTES_MAX, category: 'other' })).toEqual({ ok: true })
  })

  it('accepts one minute at the boundary', () => {
    expect(validateEntry({ minutes: 1, category: 'other' })).toEqual({ ok: true })
  })
})

describe('validateEntry: note', () => {
  it('rejects an over-long note', () => {
    const result = validateEntry({ minutes: 60, category: 'other', note: 'x'.repeat(501) })
    expect(result.ok === false && result.problem).toBe('note-too-long')
  })

  it('accepts a missing note — one line is optional', () => {
    expect(validateEntry({ minutes: 60, category: 'other', note: null })).toEqual({ ok: true })
  })
})
