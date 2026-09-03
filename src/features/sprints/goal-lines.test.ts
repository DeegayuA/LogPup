import { describe, expect, it } from 'vitest'
import { parseSprintGoal } from './goal-lines'

describe('parseSprintGoal', () => {
  it('is empty for null, undefined and whitespace', () => {
    expect(parseSprintGoal(null)).toEqual({ kind: 'empty' })
    expect(parseSprintGoal(undefined)).toEqual({ kind: 'empty' })
    expect(parseSprintGoal('   \n  \n')).toEqual({ kind: 'empty' })
  })

  it('leaves a one-line goal exactly as it renders today', () => {
    expect(parseSprintGoal('Ship the payroll system')).toEqual({
      kind: 'prose',
      text: 'Ship the payroll system',
    })
  })

  it('recovers the list the old <p> flattened', () => {
    // The verbatim shape of the September sprint on attendance-web-app, which
    // is what sent this module into existence.
    const goal = [
      '- Link LogPup with the attendance app',
      '- Multi-tenant system finished',
      '- Fix bugs in SLH attendance system',
      '- Payroll system (SLH and AVS)',
    ].join('\n')

    expect(parseSprintGoal(goal)).toEqual({
      kind: 'list',
      items: [
        'Link LogPup with the attendance app',
        'Multi-tenant system finished',
        'Fix bugs in SLH attendance system',
        'Payroll system (SLH and AVS)',
      ],
    })
  })

  it('accepts the other markers people type', () => {
    expect(parseSprintGoal('* one\n• two\n1. three\n2) four')).toEqual({
      kind: 'list',
      items: ['one', 'two', 'three', 'four'],
    })
  })

  it('ignores blank lines between bullets', () => {
    expect(parseSprintGoal('- one\n\n- two\n')).toEqual({ kind: 'list', items: ['one', 'two'] })
  })

  it('does not mistake a leading minus for a bullet', () => {
    // No space after the marker, so these are numbers, not list items.
    expect(parseSprintGoal('-15% latency\n-10% cost')).toEqual({
      kind: 'prose',
      text: '-15% latency\n-10% cost',
    })
  })

  it('does not mistake a numbered sentence for a list item', () => {
    expect(parseSprintGoal('Phase 2.Rollout')).toEqual({ kind: 'prose', text: 'Phase 2.Rollout' })
  })

  it('keeps a single dashed line as prose rather than a one-item list', () => {
    expect(parseSprintGoal('- ship it')).toEqual({ kind: 'prose', text: '- ship it' })
  })

  it('keeps a mixed block as prose, preserving its breaks', () => {
    // Promoting the opening line to a bullet would assert a structure the
    // author did not type.
    expect(parseSprintGoal('Close out Q3:\n- payroll\n- multi-tenant')).toEqual({
      kind: 'prose',
      text: 'Close out Q3:\n- payroll\n- multi-tenant',
    })
  })

  it('falls back to prose when the markers have no text behind them', () => {
    expect(parseSprintGoal('- \n- ')).toEqual({ kind: 'prose', text: '-\n-' })
  })

  it('trims indentation without losing the marker', () => {
    expect(parseSprintGoal('   - one\n   - two')).toEqual({ kind: 'list', items: ['one', 'two'] })
  })
})
