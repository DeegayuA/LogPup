import { describe, expect, it } from 'vitest'
import {
  bugFilterHref,
  bugReportInput,
  bugTriageInput,
  parseBugFilters,
} from './report-input'

// Pure schema rules and the URL contract, no mocks — the split
// apps/create-input.test.ts makes for the same reason: these are the rules a
// 'use server' module cannot be unit tested through.

const validReport = {
  appId: '11111111-1111-4111-8111-111111111111',
  title: 'Sprint switcher forgets the backlog',
  description: 'Picked Backlog, chose a sprint, landed back on Overview.',
  pagePath: '/apps/logpup?tab=roadmap&sprint=backlog',
}

describe('bugReportInput', () => {
  it('accepts a full report', () => {
    expect(bugReportInput.safeParse(validReport).success).toBe(true)
  })

  it('has no severity field at all', () => {
    // The reporter describes, the triager rates — see the bug_severity comment
    // in schema.ts. A severity sent from the report form must be dropped
    // rather than honoured, or the field is back by the side door.
    const parsed = bugReportInput.parse({ ...validReport, severity: 'critical' })
    expect(parsed).not.toHaveProperty('severity')
  })

  it('refuses a report that says nothing', () => {
    // "it's broken" as the entire description is the one thing triage cannot
    // recover from later.
    expect(bugReportInput.safeParse({ ...validReport, description: 'broken' }).success).toBe(false)
    expect(bugReportInput.safeParse({ ...validReport, title: 'bug' }).success).toBe(false)
  })

  it('trims before it measures', () => {
    const parsed = bugReportInput.parse({ ...validReport, title: '  Login loop  ' })
    expect(parsed.title).toBe('Login loop')
    expect(bugReportInput.safeParse({ ...validReport, title: '     ' }).success).toBe(false)
  })

  it('files without a page path rather than losing the report', () => {
    // The one caller that can legitimately omit it is a client that failed to
    // read its own route; losing the whole report over a missing breadcrumb
    // would be the wrong trade.
    expect(bugReportInput.safeParse({ ...validReport, pagePath: undefined }).success).toBe(true)
  })

  it('refuses a page path that is not a path inside this app', () => {
    // The stored value is rendered as a link in the triage queue.
    // `//evil.example` is protocol-relative: every browser treats it as
    // another origin, which turns a bug report into an off-site link somebody
    // else clicks.
    for (const pagePath of ['//evil.example/steal', 'https://evil.example', 'apps/logpup', '']) {
      expect(bugReportInput.safeParse({ ...validReport, pagePath }).success, pagePath).toBe(false)
    }
  })

  it('refuses a page path longer than the column expects', () => {
    expect(
      bugReportInput.safeParse({ ...validReport, pagePath: `/${'a'.repeat(600)}` }).success,
    ).toBe(false)
  })
})

describe('bugTriageInput', () => {
  const bugId = '22222222-2222-4222-8222-222222222222'

  it('accepts any one of the three fields on its own', () => {
    expect(bugTriageInput.safeParse({ bugId, status: 'triaged' }).success).toBe(true)
    expect(bugTriageInput.safeParse({ bugId, severity: 'critical' }).success).toBe(true)
    expect(bugTriageInput.safeParse({ bugId, assignedTo: null }).success).toBe(true)
  })

  it('leaves an unsent field missing rather than defaulting it', () => {
    // The whole point of the partial shape: a status change must not quietly
    // reset the severity somebody set five minutes ago.
    const parsed = bugTriageInput.parse({ bugId, status: 'in_progress' })
    expect(parsed).not.toHaveProperty('severity')
    expect(parsed).not.toHaveProperty('assignedTo')
  })

  it('tells absent apart from null on the assignee', () => {
    // null is "unassign", absent is "leave it alone". Collapsing the two makes
    // unassigning impossible or makes every status change unassign.
    expect(bugTriageInput.parse({ bugId, assignedTo: null }).assignedTo).toBeNull()
    expect(bugTriageInput.parse({ bugId, status: 'closed' }).assignedTo).toBeUndefined()
  })

  it('refuses a call that changes nothing', () => {
    const result = bugTriageInput.safeParse({ bugId })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Nothing to change')
  })

  it('refuses a status or severity outside the enum', () => {
    expect(bugTriageInput.safeParse({ bugId, status: 'wontfix' }).success).toBe(false)
    expect(bugTriageInput.safeParse({ bugId, severity: 'urgent' }).success).toBe(false)
  })
})

describe('parseBugFilters', () => {
  it('reads both filters out of the URL', () => {
    expect(parseBugFilters({ bugStatus: 'open', bugSeverity: 'critical' })).toEqual({
      status: 'open',
      severity: 'critical',
    })
  })

  it('is empty when nothing is asked for', () => {
    expect(parseBugFilters({})).toEqual({})
  })

  it('drops a junk value instead of erroring', () => {
    // A stale or hand-edited link should show the unfiltered list, never an
    // error page.
    expect(parseBugFilters({ bugStatus: 'wontfix' })).toEqual({})
  })

  it('keeps the good half of a half-junk URL', () => {
    // Parsed per field, so one bad param does not cost you the other filter.
    expect(parseBugFilters({ bugStatus: 'open', bugSeverity: 'urgent' })).toEqual({
      status: 'open',
    })
  })

  it('takes the first value when a param repeats', () => {
    expect(parseBugFilters({ bugStatus: ['triaged', 'closed'] })).toEqual({ status: 'triaged' })
  })
})

describe('bugFilterHref', () => {
  it('always names the tab, so a filter link never bounces to Overview', () => {
    expect(bugFilterHref('ledger', {}, {})).toBe('/apps/ledger?tab=bugs')
  })

  it('keeps the filter you are not changing', () => {
    expect(bugFilterHref('ledger', { severity: 'high' }, { status: 'open' })).toBe(
      '/apps/ledger?tab=bugs&bugStatus=open&bugSeverity=high',
    )
  })

  it('clears one filter with undefined and leaves the other alone', () => {
    // This is what the "All" chip is: an explicit undefined, which is why
    // `patch` spreads over `current` rather than being merged conditionally.
    expect(
      bugFilterHref('ledger', { status: 'open', severity: 'high' }, { status: undefined }),
    ).toBe('/apps/ledger?tab=bugs&bugSeverity=high')
  })

  it('leaves no empty params behind when both are cleared', () => {
    expect(bugFilterHref('ledger', { status: 'open' }, { status: undefined })).toBe(
      '/apps/ledger?tab=bugs',
    )
  })
})
