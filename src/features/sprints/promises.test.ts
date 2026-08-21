import { describe, expect, it } from 'vitest'

import { gradePromises, promisesSummary, slipLineFor, type PromiseRow } from './promises'

// Wed 2026-08-19. Saturday is a working day here, so the counts below say so.
const TODAY = '2026-08-19'
const noHolidays = () => false

const row = (over: Partial<PromiseRow> = {}): PromiseRow => ({
  id: 'a',
  title: 'Ship the export',
  dueCommitmentNote: 'Promised to Kestrel on the call',
  dueDate: '2026-08-26',
  originalDueDate: '2026-08-26',
  dueChangedCount: 0,
  status: 'todo',
  assigneeName: 'Nimal',
  ...over,
})

describe('slipLineFor', () => {
  it('names the original date when the promise has not moved', () => {
    expect(slipLineFor(row({ originalDueDate: '2026-08-12' }))).toBe('promised 12 Aug')
  })

  it('counts the moves, and says "time" for one of them', () => {
    expect(slipLineFor(row({ originalDueDate: '2026-08-12', dueChangedCount: 1 }))).toBe(
      'promised 12 Aug · moved 1 time',
    )
    expect(slipLineFor(row({ originalDueDate: '2026-08-12', dueChangedCount: 3 }))).toBe(
      'promised 12 Aug · moved 3 times',
    )
  })

  it('says NOTHING for a task that predates migration 0049', () => {
    // Those rows were dated before original_due_date existed, so they never
    // received a stamp. Silence is the honest render — deriving "promised 26
    // Aug" from the current date would invent a first promise that may never
    // have been made. See due-date.ts.
    expect(slipLineFor(row({ originalDueDate: null, dueChangedCount: 4 }))).toBeNull()
  })

  it('formats a single-digit day without padding', () => {
    expect(slipLineFor(row({ originalDueDate: '2026-09-05' }))).toBe('promised 5 Sep')
  })
})

describe('gradePromises orders by how loud, then by when', () => {
  it('puts a breach above an overdue, and both above what is merely coming', () => {
    const graded = gradePromises(
      [
        row({ id: 'soon', dueDate: '2026-08-21' }),
        row({ id: 'breached', dueDate: '2026-08-17' }),
        row({ id: 'today', dueDate: TODAY }),
        row({ id: 'overdue', dueDate: '2026-08-18' }),
      ],
      TODAY,
      noHolidays,
    )
    expect(graded.map((p) => p.id)).toEqual(['breached', 'overdue', 'today', 'soon'])
  })

  it('ranks by RUNG before date, where the two disagree', () => {
    // The discriminating case, and the only one there is: rung and date are
    // otherwise collinear (breaches are old, due-soon is future), so every
    // other fixture passes under a date-only sort too. A DONE task carrying
    // the oldest date grades 'none' and must sort LAST — under a date-only
    // sort it would lead the list.
    //
    // Written after a positive control: breaking the rung comparison left the
    // original tests green, which meant they were checking nothing.
    const graded = gradePromises(
      [
        row({ id: 'ancient-done', dueDate: '2026-01-01', status: 'done' }),
        row({ id: 'breached', dueDate: '2026-08-17' }),
      ],
      TODAY,
      noHolidays,
    )
    expect(graded.map((p) => p.id)).toEqual(['breached', 'ancient-done'])
  })

  it('orders by date within a rung — the next thing to break comes first', () => {
    const graded = gradePromises(
      [row({ id: 'later', dueDate: '2026-08-24' }), row({ id: 'sooner', dueDate: '2026-08-20' })],
      TODAY,
      noHolidays,
    )
    expect(graded.map((p) => p.id)).toEqual(['sooner', 'later'])
  })

  it('sorts an undated promise last within its rung', () => {
    const graded = gradePromises(
      [row({ id: 'undated', dueDate: null }), row({ id: 'far', dueDate: '2026-12-25' })],
      TODAY,
      noHolidays,
    )
    // Both grade 'none'; the dated one still leads, because a promise with no
    // date is the weakest kind there is.
    expect(graded.map((p) => p.id)).toEqual(['far', 'undated'])
  })

  it('grades a finished promise silent, however far past its date', () => {
    const [graded] = gradePromises(
      [row({ dueDate: '2026-01-01', status: 'done' })],
      TODAY,
      noHolidays,
    )
    expect(graded.step).toBe('none')
  })

  it('carries the slip line onto the graded row', () => {
    const [graded] = gradePromises(
      [row({ originalDueDate: '2026-08-12', dueChangedCount: 2 })],
      TODAY,
      noHolidays,
    )
    expect(graded.slipLine).toBe('promised 12 Aug · moved 2 times')
  })
})

describe('promisesSummary counts what is wrong, not what exists', () => {
  const graded = (rows: PromiseRow[]) => gradePromises(rows, TODAY, noHolidays)

  it('says so plainly when there are none', () => {
    expect(promisesSummary(graded([]))).toBe('No promises on this project yet.')
  })

  it('reports a clean list without implying a problem', () => {
    expect(promisesSummary(graded([row({ dueDate: '2026-08-21' })]))).toBe(
      '1 open promise, none late.',
    )
  })

  it('leads with the breaches when there are any', () => {
    const summary = promisesSummary(
      graded([
        row({ id: '1', dueDate: '2026-08-17' }), // breached
        row({ id: '2', dueDate: '2026-08-18' }), // overdue
        row({ id: '3', dueDate: '2026-08-21' }), // due-soon
      ]),
    )
    expect(summary).toBe('1 breached, 1 overdue of 3 open promises.')
  })

  it('omits a category with nothing in it rather than printing a zero', () => {
    expect(promisesSummary(graded([row({ id: '1', dueDate: '2026-08-18' })]))).toBe(
      '1 overdue of 1 open promise.',
    )
  })
})
