import { describe, expect, it } from 'vitest'
import { parseTaskIntent } from './task-intent'

const PEOPLE = [
  { id: 'u1', name: 'Shanika Ayasmanthi' },
  { id: 'u2', name: 'Deeghayu Adhikari' },
  { id: 'u3', name: 'Sam Perera' },
  { id: 'u4', name: 'Sam Fernando' },
]

// Tuesday, 11 Aug 2026 — fixed so weekday math is deterministic.
const TODAY = new Date(2026, 7, 11)

describe('parseTaskIntent', () => {
  it('reads a bare leading name, the task, and a relative date', () => {
    const intent = parseTaskIntent('shanika do this task today', PEOPLE, TODAY)
    expect(intent?.assignee?.id).toBe('u1')
    expect(intent?.title).toBe('this task')
    expect(intent?.due).toBe('2026-08-11')
    expect(intent?.dueLabel).toBe('today')
  })

  it('handles a full name prefix', () => {
    const intent = parseTaskIntent('shanika ayasmanthi ship the roadmap', PEOPLE, TODAY)
    expect(intent?.assignee?.id).toBe('u1')
    expect(intent?.title).toBe('ship the roadmap')
  })

  it('still supports @name and the assign/to command form', () => {
    expect(parseTaskIntent('@deeghayu fix the login flow', PEOPLE, TODAY)?.assignee?.id).toBe('u2')
    const cmd = parseTaskIntent('assign billing copy to deeghayu', PEOPLE, TODAY)
    expect(cmd?.assignee?.id).toBe('u2')
    expect(cmd?.title).toBe('billing copy')
  })

  it('supports the colon form', () => {
    const intent = parseTaskIntent('deeghayu: review the PR', PEOPLE, TODAY)
    expect(intent?.assignee?.id).toBe('u2')
    expect(intent?.title).toBe('review the PR')
  })

  it('resolves tomorrow, weekdays and next-week', () => {
    expect(parseTaskIntent('shanika ping ops tomorrow', PEOPLE, TODAY)?.due).toBe('2026-08-12')
    // Tuesday -> the coming Friday
    expect(parseTaskIntent('shanika ship it by friday', PEOPLE, TODAY)?.due).toBe('2026-08-14')
    // A bare weekday never means today
    expect(parseTaskIntent('shanika ship it tuesday', PEOPLE, TODAY)?.due).toBe('2026-08-18')
    expect(parseTaskIntent('shanika ship it next monday', PEOPLE, TODAY)?.due).toBe('2026-08-24')
    expect(parseTaskIntent('shanika plan next week', PEOPLE, TODAY)?.due).toBe('2026-08-18')
    expect(parseTaskIntent('shanika audit in 3 days', PEOPLE, TODAY)?.due).toBe('2026-08-14')
  })

  it('strips politeness and helper verbs from the title', () => {
    expect(parseTaskIntent('shanika please do the audit', PEOPLE, TODAY)?.title).toBe('the audit')
    expect(parseTaskIntent('shanika needs to call the vendor', PEOPLE, TODAY)?.title).toBe(
      'call the vendor',
    )
  })

  it('flags an ambiguous first name instead of guessing', () => {
    const intent = parseTaskIntent('sam fix the build', PEOPLE, TODAY)
    expect(intent?.assignee).toBeNull()
    expect(intent?.ambiguous.map((p) => p.id)).toEqual(['u3', 'u4'])
    expect(intent?.assigneeQuery).toBe('sam')
  })

  it('leaves unknown leading words in the title', () => {
    const intent = parseTaskIntent('rewrite the onboarding email', PEOPLE, TODAY)
    expect(intent?.assignee).toBeNull()
    expect(intent?.assigneeQuery).toBeNull()
    expect(intent?.title).toBe('rewrite the onboarding email')
  })

  it('pulls out a trailing app hint', () => {
    const intent = parseTaskIntent('shanika fix login on logpup', PEOPLE, TODAY)
    expect(intent?.title).toBe('fix login')
    expect(intent?.appQuery).toBe('logpup')
  })

  it('returns null when there is no task left to create', () => {
    expect(parseTaskIntent('a', PEOPLE, TODAY)).toBeNull()
    expect(parseTaskIntent('shanika today', PEOPLE, TODAY)).toBeNull()
  })
})
