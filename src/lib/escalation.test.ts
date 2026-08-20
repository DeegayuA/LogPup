import { describe, expect, it } from 'vitest'

import {
  BREACH_WORKING_DAYS,
  DUE_SOON_WORKING_DAYS,
  NOTIFYING_STEPS,
  STEP_NOTIFICATION_KIND,
  escalationStep,
  notificationKindFor,
  type EscalationStep,
} from './escalation'

// 2026-08-17 Mon … 2026-08-23 Sun. 2026-08-22 is a Saturday (a half day here,
// still a working day); 2026-08-23 is a Sunday.
const MON = '2026-08-17'
const WED = '2026-08-19'

const step = (over: Partial<Parameters<typeof escalationStep>[0]> = {}) =>
  escalationStep({
    dueDate: null,
    dueKind: 'target',
    status: 'todo',
    todayIso: WED,
    // No holidays by default, so the cases below read as pure weekday maths.
    isHoliday: () => false,
    ...over,
  })

describe('items that are never escalated', () => {
  it('an undated item has no rung, whatever its status', () => {
    expect(step({ dueDate: null })).toBe('none')
    expect(step({ dueDate: null, status: 'in_progress' })).toBe('none')
  })

  it('a finished item is silent even when long past a committed date', () => {
    for (const status of ['done', 'archived', 'resolved', 'cancelled']) {
      expect(step({ dueDate: '2026-01-01', dueKind: 'committed', status })).toBe('none')
    }
  })

  it('a date far in the future is quiet until it comes into range', () => {
    expect(step({ dueDate: '2026-12-25' })).toBe('none')
  })
})

describe('the rungs, by where the date sits', () => {
  it('today is due-today, whatever the kind', () => {
    expect(step({ dueDate: WED })).toBe('due-today')
    expect(step({ dueDate: WED, dueKind: 'committed' })).toBe('due-today')
  })

  it('tomorrow is due-soon', () => {
    expect(step({ dueDate: '2026-08-20' })).toBe('due-soon')
  })

  it('a target past its date is overdue and stays overdue', () => {
    // Two working days late — a committed date breaches here; a target has no
    // counterparty, so it has nothing to breach.
    expect(step({ dueDate: MON })).toBe('overdue')
    expect(step({ dueDate: '2026-01-01' })).toBe('overdue')
  })

  it('a committed date one working day late is overdue, not yet breached', () => {
    // Tuesday's date, viewed on Wednesday.
    expect(step({ dueDate: '2026-08-18', dueKind: 'committed' })).toBe('overdue')
  })

  it('a committed date two working days late is breached', () => {
    expect(step({ dueDate: MON, dueKind: 'committed' })).toBe('breached')
  })
})

describe('the window is measured in WORKING days, not calendar days', () => {
  /* THE STUDIO WEEK IS SIX DAYS. Saturday is a half day here and therefore a
     WORKING day (working-days.ts: 1 Mon-Fri, 0.5 Sat, 0 Sun) — so a weekend
     costs one working day, not two. Every count below is written out because
     the intuition of a five-day week gets all of them wrong, and did on the
     first pass. */

  it('counts Sunday, and only Sunday, out of the due-soon window', () => {
    // From Monday the 17th: Tue 1, Wed 2, Thu 3, Fri 4, Sat 5, (Sun), Mon 6,
    // Tue 7 — so the 25th is the seventh working day and the boundary.
    expect(step({ dueDate: '2026-08-25', todayIso: MON })).toBe('due-soon')
    // The 26th is the eighth, and outside.
    expect(step({ dueDate: '2026-08-26', todayIso: MON })).toBe('none')
  })

  it('a holiday pulls a later date INTO the window, because it removes working time', () => {
    // Closing Thursday the 20th drops the 26th from eight working days out to
    // seven. That is the right direction: a holiday does not postpone the
    // deadline, it takes away a day in which to meet it, so the item becomes
    // more urgent rather than less.
    expect(
      step({
        dueDate: '2026-08-26',
        todayIso: MON,
        isHoliday: (iso) => iso === '2026-08-20',
      }),
    ).toBe('due-soon')
  })

  it('a Friday promise is breached by Monday, because Saturday worked', () => {
    // Fri 14 -> Mon 17: Sat 15 is the first working day late and Mon 17 the
    // second. On a five-day week this would still be merely overdue.
    expect(step({ dueDate: '2026-08-14', dueKind: 'committed', todayIso: MON })).toBe('breached')
  })

  it('closing the Saturday holds that same promise at overdue', () => {
    // The same Friday date, with Sat 15 closed: only Monday counts, so one
    // working day late and not yet a breach.
    expect(
      step({
        dueDate: '2026-08-14',
        dueKind: 'committed',
        todayIso: MON,
        isHoliday: (iso) => iso === '2026-08-15',
      }),
    ).toBe('overdue')
  })
})

describe('the step -> notification map', () => {
  const ALL_STEPS: EscalationStep[] = ['none', 'due-soon', 'due-today', 'overdue', 'breached']

  it('is total over the step union, so a new rung cannot be added silently', () => {
    for (const s of ALL_STEPS) {
      expect(Object.hasOwn(STEP_NOTIFICATION_KIND, s)).toBe(true)
    }
    expect(Object.keys(STEP_NOTIFICATION_KIND).sort()).toEqual([...ALL_STEPS].sort())
  })

  it('has exactly three notifying rungs — due-today is render-only', () => {
    expect(NOTIFYING_STEPS).toEqual(['due-soon', 'overdue', 'breached'])
    expect(notificationKindFor('due-today')).toBeNull()
    expect(notificationKindFor('none')).toBeNull()
  })

  it('names each notifying rung', () => {
    expect(notificationKindFor('due-soon')).toBe('deadline.due_soon')
    expect(notificationKindFor('overdue')).toBe('deadline.overdue')
    expect(notificationKindFor('breached')).toBe('deadline.breached')
  })
})

describe('the constants are the ones the spec names', () => {
  it('seven working days, and two before a breach', () => {
    expect(DUE_SOON_WORKING_DAYS).toBe(7)
    expect(BREACH_WORKING_DAYS).toBe(2)
  })
})
