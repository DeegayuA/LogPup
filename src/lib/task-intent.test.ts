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

  it('reads a bare trailing first name — "fix login shanika"', () => {
    const intent = parseTaskIntent('fix login shanika', PEOPLE, TODAY)
    expect(intent?.assignee?.id).toBe('u1')
    expect(intent?.title).toBe('fix login')
  })

  it('binds a bare trailing FULL name before falling back to one word', () => {
    const intent = parseTaskIntent('ship the brief shanika ayasmanthi', PEOPLE, TODAY)
    expect(intent?.assignee?.id).toBe('u1')
    expect(intent?.title).toBe('ship the brief')
  })

  it('a bare trailing name still combines with a date', () => {
    const intent = parseTaskIntent('fix login shanika tomorrow', PEOPLE, TODAY)
    expect(intent?.assignee?.id).toBe('u1')
    expect(intent?.title).toBe('fix login')
    expect(intent?.due).toBe('2026-08-12')
  })

  it('never steals an ordinary trailing noun as an assignee', () => {
    const intent = parseTaskIntent('fix login page', PEOPLE, TODAY)
    expect(intent?.assignee).toBeNull()
    expect(intent?.assigneeQuery).toBeNull()
    expect(intent?.title).toBe('fix login page')
  })

  it('bare trailing names get the typo fallback too — fuzzy everywhere by decree', () => {
    // Originally strict (a stolen title word being the feared cost); the
    // workspace explicitly chose typo tolerance in every position instead.
    const intent = parseTaskIntent('fix login shanka', PEOPLE, TODAY)
    expect(intent?.assignee?.id).toBe('u1')
    expect(intent?.title).toBe('fix login')
  })

  it('reports a bare trailing first name shared by two people as ambiguous', () => {
    const intent = parseTaskIntent('review the deck sam', PEOPLE, TODAY)
    expect(intent?.assignee).toBeNull()
    expect(intent?.ambiguous.map((p) => p.id).sort()).toEqual(['u3', 'u4'])
    expect(intent?.title).toBe('review the deck')
  })

  it('parses the full phrase: "@name" mid-sentence, date and priority together', () => {
    const intent = parseTaskIntent('fix login @shanika today high', PEOPLE, TODAY)
    expect(intent?.assignee?.id).toBe('u1')
    expect(intent?.title).toBe('fix login')
    expect(intent?.due).toBe('2026-08-11')
    expect(intent?.priority).toBe(3)
    expect(intent?.priorityLabel).toBe('High')
  })

  it('reads a trailing priority word, with or without "priority" around it', () => {
    expect(parseTaskIntent('ship the brief urgent', PEOPLE, TODAY)?.priority).toBe(3)
    expect(parseTaskIntent('audit exports low priority', PEOPLE, TODAY)?.priority).toBe(1)
    expect(parseTaskIntent('audit exports priority medium', PEOPLE, TODAY)?.priority).toBe(2)
  })

  it('reads !priority anywhere, for when the word cannot sit at the end', () => {
    const intent = parseTaskIntent('fix !high the login flow', PEOPLE, TODAY)
    expect(intent?.priority).toBe(3)
    expect(intent?.title).toBe('fix the login flow')
  })

  it('keeps a priority word that is part of the title, not trailing', () => {
    const intent = parseTaskIntent('fix high latency on checkout', PEOPLE, TODAY)
    expect(intent?.priority).toBeNull()
    expect(intent?.title).toContain('high latency')
  })

  it('splits a description off after " -- ", verbatim and unparsed', () => {
    const intent = parseTaskIntent(
      'fix login @shanika high -- 2FA users see a blank screen tomorrow',
      PEOPLE,
      TODAY,
    )
    expect(intent?.assignee?.id).toBe('u1')
    expect(intent?.title).toBe('fix login')
    expect(intent?.priority).toBe(3)
    expect(intent?.description).toBe('2FA users see a blank screen tomorrow')
    // "tomorrow" lives in the description — it must NOT become the due date.
    expect(intent?.due).toBeNull()
  })

  it('selects several people with several @mentions, in typed order', () => {
    const intent = parseTaskIntent('@shanika @deeghayu fix login today', PEOPLE, TODAY)
    expect(intent?.assignees.map((p) => p.id)).toEqual(['u1', 'u2'])
    expect(intent?.assignee?.id).toBe('u1')
    expect(intent?.title).toBe('fix login')
    expect(intent?.due).toBe('2026-08-11')
  })

  it('dedupes the same person mentioned twice', () => {
    const intent = parseTaskIntent('@shanika ship it @shanika', PEOPLE, TODAY)
    expect(intent?.assignees.map((p) => p.id)).toEqual(['u1'])
    expect(intent?.title).toBe('ship it')
  })

  it('one unknown name blocks the whole multi-select rather than partially assigning', () => {
    const intent = parseTaskIntent('@shanika @nobody fix login', PEOPLE, TODAY)
    expect(intent?.assignees).toEqual([])
    expect(intent?.assignee).toBeNull()
    expect(intent?.assigneeQuery).toBe('nobody')
  })

  it('single-assignee forms still fill assignees with one entry', () => {
    const intent = parseTaskIntent('fix login shanika', PEOPLE, TODAY)
    expect(intent?.assignees.map((p) => p.id)).toEqual(['u1'])
  })

  it('never lets a bare name swallow the whole phrase', () => {
    // One word left after the split is required — a phrase that is ONLY a
    // name has no task in it.
    const intent = parseTaskIntent('shanika ayasmanthi', PEOPLE, TODAY)
    expect(intent?.title).not.toBe('')
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

  it('a tail name ADDS an assignee beside the front one, never overrides it', () => {
    // Multi-select semantics: "@deeghayu send the deck to shanika" is a task
    // for both of them. The front name stays first (assignee = deeghayu).
    const intent = parseTaskIntent('@deeghayu send the deck to shanika', PEOPLE, TODAY)
    expect(intent?.assignee?.id).toBe('u2')
    expect(intent?.assignees.map((p) => p.id)).toEqual(['u2', 'u1'])
    expect(intent?.title).toBe('send the deck')
  })

  it('returns null when there is no task left to create', () => {
    expect(parseTaskIntent('a', PEOPLE, TODAY)).toBeNull()
    expect(parseTaskIntent('shanika today', PEOPLE, TODAY)).toBeNull()
  })
})
