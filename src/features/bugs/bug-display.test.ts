import { describe, expect, it } from 'vitest'
import { bugSeverity, bugStatus } from '@/db/schema'
import {
  BUG_SEVERITIES,
  BUG_STATUSES,
  OPEN_BUG_STATUSES,
  SETTLED_BUG_STATUSES,
  SEVERITIES_WORST_FIRST,
  bugSeverityBadgeVariant,
  bugSeverityLabel,
  bugStatusBadgeVariant,
  bugStatusLabel,
  isOpenBugStatus,
  isSettledBugStatus,
} from './bug-display'

// Pure module, zero mocks — the fixture style of trash-grouping.test.ts.
// Importing the schema here is deliberate and is the point of the first
// block: bug-display.ts writes its two value lists out by hand so components
// can print "Critical" without dragging drizzle into the browser bundle, and
// this file is what stops that copy drifting from the pg enums it mirrors.

describe('the value lists still match the pg enums', () => {
  it('severities match bug_severity, in declaration order', () => {
    // IN ORDER, not as a set. Postgres sorts an enum by declaration, which is
    // what makes `order by severity desc` mean "critical first" in
    // queries.ts and search-providers.ts. Reorder the enum and those queries
    // silently start sorting by something else; this is the tripwire.
    expect([...BUG_SEVERITIES]).toEqual([...bugSeverity.enumValues])
  })

  it('statuses match bug_status, in declaration order', () => {
    // Same reason: `order by status asc` is "open first" only because open is
    // declared first.
    expect([...BUG_STATUSES]).toEqual([...bugStatus.enumValues])
  })
})

describe('display order', () => {
  it('offers severities worst first', () => {
    // A person picking a severity is deciding how bad it is; the ladder should
    // start at the top, not at "low".
    expect(SEVERITIES_WORST_FIRST).toEqual(['critical', 'high', 'medium', 'low'])
  })

  it('leaves the stored order untouched while doing it', () => {
    // The reverse must not mutate the source array — that would flip the order
    // every SQL ordering in the feature depends on, at import time, once.
    expect([...BUG_SEVERITIES]).toEqual(['low', 'medium', 'high', 'critical'])
  })
})

describe('open vs settled', () => {
  it('counts open, triaged and in progress as still somebody problem', () => {
    expect([...OPEN_BUG_STATUSES]).toEqual(['open', 'triaged', 'in_progress'])
  })

  it('splits the statuses exactly in two, with nothing missing or shared', () => {
    // The tab badge counts one side and the list underneath renders the same
    // side. A status that fell out of both — or into both — is how a badge
    // saying 3 ends up over a list of 4.
    expect([...OPEN_BUG_STATUSES, ...SETTLED_BUG_STATUSES].sort()).toEqual([...BUG_STATUSES].sort())
    expect(OPEN_BUG_STATUSES.some((status) => SETTLED_BUG_STATUSES.includes(status))).toBe(false)
  })

  it('agrees with itself on every status', () => {
    for (const status of BUG_STATUSES) {
      expect(isOpenBugStatus(status)).toBe(!isSettledBugStatus(status))
    }
  })

  it('treats resolved and closed as settled', () => {
    // triageBug stamps resolved_at from exactly this predicate, so getting it
    // wrong writes a resolution date onto a bug nobody resolved.
    expect(isSettledBugStatus('resolved')).toBe(true)
    expect(isSettledBugStatus('closed')).toBe(true)
    expect(isSettledBugStatus('in_progress')).toBe(false)
  })
})

describe('labels', () => {
  it('names every severity and every status', () => {
    for (const severity of BUG_SEVERITIES) {
      expect(bugSeverityLabel(severity)).toMatch(/^[A-Z]/)
    }
    for (const status of BUG_STATUSES) {
      expect(bugStatusLabel(status)).toMatch(/^[A-Z]/)
    }
  })

  it('writes in_progress as prose, not as a column name', () => {
    expect(bugStatusLabel('in_progress')).toBe('In progress')
  })
})

describe('badge variants', () => {
  it('gives every value a variant', () => {
    for (const severity of BUG_SEVERITIES) {
      expect(bugSeverityBadgeVariant(severity)).toBeTruthy()
    }
    for (const status of BUG_STATUSES) {
      expect(bugStatusBadgeVariant(status)).toBeTruthy()
    }
  })

  it('spends the loudest treatment on critical and on unlooked-at', () => {
    // Variant is weight, not identity: the two ladders descend from loud to
    // quiet so a list reads as a shape before it reads as words.
    expect(bugSeverityBadgeVariant('critical')).toBe('destructive')
    expect(bugSeverityBadgeVariant('low')).toBe('outline')
    expect(bugStatusBadgeVariant('open')).toBe('default')
    expect(bugStatusBadgeVariant('closed')).toBe('ghost')
  })

  it('never gives a settled status the loudest variant', () => {
    // "Resolved" shouting louder than "Open" would invert the whole list.
    for (const status of SETTLED_BUG_STATUSES) {
      expect(bugStatusBadgeVariant(status)).not.toBe('destructive')
      expect(bugStatusBadgeVariant(status)).not.toBe('default')
    }
  })
})
