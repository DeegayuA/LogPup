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

  it('reads a recipient written at the end of the phrase', () => {
    const to = parseTaskIntent('new task to shanika', PEOPLE, TODAY)
    expect(to?.assignee?.id).toBe('u1')
    expect(to?.title).toBe('new task')

    const forName = parseTaskIntent('ship the brief for deeghayu', PEOPLE, TODAY)
    expect(forName?.assignee?.id).toBe('u2')
    expect(forName?.title).toBe('ship the brief')

    // Trailing "@name" — the board composer's old shorthand.
    const at = parseTaskIntent('fix the login flow @deeghayu', PEOPLE, TODAY)
    expect(at?.assignee?.id).toBe('u2')
    expect(at?.title).toBe('fix the login flow')
  })

  it('leaves "to"/"for" alone when the tail is not a person', () => {
    const intent = parseTaskIntent('write docs for the API', PEOPLE, TODAY)
    expect(intent?.assignee).toBeNull()
    expect(intent?.assigneeQuery).toBeNull()
    expect(intent?.title).toBe('write docs for the API')
  })

  it('composes a trailing recipient with a date and an app hint', () => {
    const dated = parseTaskIntent('fix login to shanika friday', PEOPLE, TODAY)
    expect(dated?.assignee?.id).toBe('u1')
    expect(dated?.title).toBe('fix login')
    expect(dated?.due).toBe('2026-08-14')

    // The name can be written on either side of the app hint.
    const beforeApp = parseTaskIntent('fix login to shanika on logpup', PEOPLE, TODAY)
    expect(beforeApp?.assignee?.id).toBe('u1')
    expect(beforeApp?.title).toBe('fix login')
    expect(beforeApp?.appQuery).toBe('logpup')

    const afterApp = parseTaskIntent('fix login on logpup to shanika', PEOPLE, TODAY)
    expect(afterApp?.assignee?.id).toBe('u1')
    expect(afterApp?.title).toBe('fix login')
    expect(afterApp?.appQuery).toBe('logpup')
  })

  it('reports an ambiguous trailing name instead of guessing', () => {
    const intent = parseTaskIntent('fix the build to sam', PEOPLE, TODAY)
    expect(intent?.assignee).toBeNull()
    expect(intent?.ambiguous.map((p) => p.id)).toEqual(['u3', 'u4'])
    expect(intent?.assigneeQuery).toBe('sam')
    expect(intent?.title).toBe('fix the build')
  })

  it('does not let a tail override a name already read from the front', () => {
    const intent = parseTaskIntent('@deeghayu send the deck to shanika', PEOPLE, TODAY)
    expect(intent?.assignee?.id).toBe('u2')
    expect(intent?.title).toBe('send the deck to shanika')
  })

  it('returns null when there is no task left to create', () => {
    expect(parseTaskIntent('a', PEOPLE, TODAY)).toBeNull()
    expect(parseTaskIntent('shanika today', PEOPLE, TODAY)).toBeNull()
  })
})
