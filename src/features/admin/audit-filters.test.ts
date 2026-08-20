import { describe, expect, it } from 'vitest'
import {
  AUDIT_MAX_PAGE,
  AUDIT_PAGE_SIZE,
  auditDepthNotice,
  auditEmptyKind,
  auditHref,
  auditPageCount,
  auditQueryString,
  auditRangeLabel,
  auditSortHref,
  clearAuditFiltersHref,
  clearedAuditState,
  colomboDayEnd,
  colomboDayStart,
  defaultAuditDir,
  groupAuditByDay,
  hasAuditFilters,
  nextAuditDir,
  parseAuditParams,
  shouldGroupAuditByDay,
  type AuditParamState,
} from './audit-filters'

// Pure module, zero mocks — the fixture style of trash-grouping.test.ts.
// Everything here is what a hand-edited URL, a shared link or a stale bookmark
// can do to the audit surface, which is precisely the class of bug no
// integration test on this page would catch.

const BASE: AuditParamState = {
  q: '', actor: '', type: '', verb: '', from: '', to: '', self: false,
  sort: 'time', dir: 'desc', page: 1,
}

const UUID = '11111111-2222-4333-8444-555555555555'

describe('parseAuditParams', () => {
  it('an empty URL is the canonical view: no filters, newest first, page one', () => {
    expect(parseAuditParams({})).toEqual(BASE)
  })

  it('reads every filter, and takes the first value of a repeated param', () => {
    expect(
      parseAuditParams({
        q: '  login  ',
        actor: UUID,
        type: 'meeting',
        verb: ['deleted', 'created'],
        from: '2026-08-01',
        to: '2026-08-20',
        self: '1',
        sort: 'actor',
        dir: 'desc',
        page: '3',
      }),
    ).toEqual({
      q: 'login',
      actor: UUID,
      type: 'meeting',
      verb: 'deleted',
      from: '2026-08-01',
      to: '2026-08-20',
      self: true,
      sort: 'actor',
      dir: 'desc',
      page: 3,
    })
  })

  it('a non-UUID actor degrades to unfiltered — it would otherwise be a bind error, not an empty page', () => {
    expect(parseAuditParams({ actor: 'garbage' }).actor).toBe('')
  })

  it('an unrecognised type or verb is KEPT as a filter that matches nothing', () => {
    // Deliberately unlike /activity, which widens to unfiltered. An audit that
    // silently drops a filter answers a question nobody asked.
    const state = parseAuditParams({ type: 'wormhole', verb: 'teleported' })
    expect(state.type).toBe('wormhole')
    expect(state.verb).toBe('teleported')
  })

  it('a bad sort key or direction falls back to the default rather than reaching ORDER BY', () => {
    const state = parseAuditParams({ sort: 'users.name; drop table', dir: 'sideways' })
    expect(state.sort).toBe('time')
    expect(state.dir).toBe('desc')
  })

  it('an omitted direction takes the sort key’s own default', () => {
    expect(parseAuditParams({ sort: 'actor' }).dir).toBe('asc')
    expect(parseAuditParams({ sort: 'entity' }).dir).toBe('asc')
    expect(parseAuditParams({ sort: 'time' }).dir).toBe('desc')
  })

  it('clamps the page into [1, AUDIT_MAX_PAGE] so no URL can ask for an unbounded offset', () => {
    expect(parseAuditParams({ page: '0' }).page).toBe(1)
    expect(parseAuditParams({ page: '-5' }).page).toBe(1)
    expect(parseAuditParams({ page: 'seven' }).page).toBe(1)
    expect(parseAuditParams({ page: '999999' }).page).toBe(1)
    expect(parseAuditParams({ page: String(AUDIT_MAX_PAGE) }).page).toBe(AUDIT_MAX_PAGE)
  })

  it('a malformed date drops that bound only, leaving the other one working', () => {
    expect(parseAuditParams({ from: '2026-13-45', to: '2026-08-20' })).toMatchObject({
      from: '',
      to: '2026-08-20',
    })
  })

  it('swaps a backwards range instead of returning a mystery empty page', () => {
    expect(parseAuditParams({ from: '2026-08-20', to: '2026-08-01' })).toMatchObject({
      from: '2026-08-01',
      to: '2026-08-20',
    })
  })

  it('a whitespace-only search is not a search', () => {
    expect(parseAuditParams({ q: '   ' }).q).toBe('')
  })
})

describe('auditQueryString', () => {
  it('the default view has no query string at all', () => {
    expect(auditQueryString(BASE)).toBe('')
  })

  it('omits a direction that equals the sort key’s default, keeps one that does not', () => {
    expect(auditQueryString({ ...BASE, sort: 'actor', dir: 'asc' })).toBe('sort=actor')
    expect(auditQueryString({ ...BASE, sort: 'actor', dir: 'desc' })).toBe('sort=actor&dir=desc')
    expect(auditQueryString({ ...BASE, sort: 'time', dir: 'asc' })).toBe('dir=asc')
  })

  it('round-trips through parseAuditParams', () => {
    const state: AuditParamState = {
      q: 'login attempt', actor: UUID, type: 'user', verb: 'updated',
      from: '2026-08-01', to: '2026-08-20', self: true,
      sort: 'entity', dir: 'desc', page: 4,
    }
    const parsed = parseAuditParams(
      Object.fromEntries(new URLSearchParams(auditQueryString(state))),
    )
    expect(parsed).toEqual(state)
  })
})

describe('auditHref', () => {
  it('keeps every other filter, so clicking through narrows instead of restarting', () => {
    const current: AuditParamState = { ...BASE, q: 'login', type: 'meeting' }
    expect(auditHref(current, { verb: 'deleted' })).toBe(
      '/admin/audit?q=login&type=meeting&verb=deleted',
    )
  })

  it('resets the page on every change — page four of the old filter is not a page of the new one', () => {
    const current: AuditParamState = { ...BASE, q: 'login', page: 4 }
    expect(auditHref(current, { verb: 'deleted' })).not.toContain('page=')
  })

  it('honours an explicit page, which is what the pager passes', () => {
    expect(auditHref(BASE, { page: 3 })).toBe('/admin/audit?page=3')
  })

  it('a link back to the default view is the bare path', () => {
    expect(auditHref({ ...BASE, q: 'x' }, { q: '' })).toBe('/admin/audit')
  })
})

describe('sorting', () => {
  it('re-pressing the active key flips it; a different key adopts its own default', () => {
    expect(nextAuditDir({ sort: 'time', dir: 'desc' }, 'time')).toBe('asc')
    expect(nextAuditDir({ sort: 'time', dir: 'asc' }, 'time')).toBe('desc')
    expect(nextAuditDir({ sort: 'time', dir: 'asc' }, 'actor')).toBe('asc')
    expect(nextAuditDir({ sort: 'actor', dir: 'desc' }, 'time')).toBe('desc')
  })

  it('a sort link keeps the filters and drops the page', () => {
    const current: AuditParamState = { ...BASE, q: 'login', page: 5 }
    expect(auditSortHref(current, 'actor')).toBe('/admin/audit?q=login&sort=actor')
  })

  it('day grouping holds only while the rows are in chronological order', () => {
    expect(shouldGroupAuditByDay('time')).toBe(true)
    expect(shouldGroupAuditByDay('actor')).toBe(false)
    expect(shouldGroupAuditByDay('entity')).toBe(false)
  })

  it('defaultAuditDir is the one place the entry direction is decided', () => {
    expect(defaultAuditDir('time')).toBe('desc')
    expect(defaultAuditDir('actor')).toBe('asc')
  })
})

describe('clearing filters', () => {
  it('clears every filter and the page, and KEEPS the chosen sort', () => {
    const current: AuditParamState = {
      q: 'login', actor: UUID, type: 'user', verb: 'updated',
      from: '2026-08-01', to: '2026-08-20', self: true,
      sort: 'actor', dir: 'desc', page: 6,
    }
    expect(clearedAuditState(current)).toEqual({ ...BASE, sort: 'actor', dir: 'desc' })
    expect(clearAuditFiltersHref(current)).toBe('/admin/audit?sort=actor&dir=desc')
  })

  it('sort and page are not filters — neither hides a row', () => {
    expect(hasAuditFilters({ ...BASE, sort: 'actor', page: 3 })).toBe(false)
    expect(hasAuditFilters({ ...BASE, self: true })).toBe(true)
    expect(hasAuditFilters({ ...BASE, q: 'x' })).toBe(true)
    expect(hasAuditFilters({ ...BASE, to: '2026-08-01' })).toBe(true)
  })
})

describe('auditEmptyKind', () => {
  it('no filters and no rows means the trail is empty, not that the filters are wrong', () => {
    expect(auditEmptyKind({ anyFilter: false, unfilteredTotal: null })).toBe('no-data')
  })

  it('filters on, but the table itself is empty: still "no data" — clearing them would not help', () => {
    expect(auditEmptyKind({ anyFilter: true, unfilteredTotal: 0 })).toBe('no-data')
  })

  it('filters on and rows exist elsewhere: the filters are what is hiding them', () => {
    expect(auditEmptyKind({ anyFilter: true, unfilteredTotal: 412 })).toBe('no-match')
  })

  it('filters on and the unfiltered count was not asked: blame the filters, the one thing the reader can change', () => {
    expect(auditEmptyKind({ anyFilter: true, unfilteredTotal: null })).toBe('no-match')
  })

  it('a stale ?page= past the last page is neither — the trail is fine, the link is not', () => {
    // The bug this pins: without the page check, a bookmarked page 5 of a
    // 60-row trail rendered "Nothing recorded yet", which is a flat lie about
    // the workspace and offers the reader nothing to do about it.
    expect(auditEmptyKind({ anyFilter: false, unfilteredTotal: null, matchingTotal: 60, page: 5 }))
      .toBe('past-end')
    expect(auditEmptyKind({ anyFilter: true, unfilteredTotal: 900, matchingTotal: 60, page: 5 }))
      .toBe('past-end')
  })

  it('page one is never "past the end", however the counts read', () => {
    expect(auditEmptyKind({ anyFilter: false, unfilteredTotal: null, matchingTotal: 0, page: 1 }))
      .toBe('no-data')
  })

  it('a deep page of a genuinely empty result is still about the filters, not the page', () => {
    expect(auditEmptyKind({ anyFilter: true, unfilteredTotal: 900, matchingTotal: 0, page: 5 }))
      .toBe('no-match')
  })
})

describe('counting and bounds', () => {
  it('states the range rather than truncating in silence', () => {
    expect(auditRangeLabel({ page: 2, shown: 50, total: 312 })).toBe('Showing 51–100 of 312')
    expect(auditRangeLabel({ page: 7, shown: 12, total: 312 })).toBe('Showing 301–312 of 312')
  })

  it('says "all" when the page is the whole answer', () => {
    expect(auditRangeLabel({ page: 1, shown: 3, total: 3 })).toBe('Showing all 3 entries')
    expect(auditRangeLabel({ page: 1, shown: 1, total: 1 })).toBe('Showing all 1 entry')
  })

  it('an empty result says so instead of counting to zero', () => {
    expect(auditRangeLabel({ page: 1, shown: 0, total: 0 })).toBe('No entries')
  })

  it('page count never drops below one, so an empty trail still renders a pager-free page one', () => {
    expect(auditPageCount(0)).toBe(1)
    expect(auditPageCount(1)).toBe(1)
    expect(auditPageCount(AUDIT_PAGE_SIZE)).toBe(1)
    expect(auditPageCount(AUDIT_PAGE_SIZE + 1)).toBe(2)
  })

  it('warns only once the result set runs past what paging can reach', () => {
    const reachable = AUDIT_MAX_PAGE * AUDIT_PAGE_SIZE
    expect(auditDepthNotice(reachable)).toBeNull()
    expect(auditDepthNotice(reachable + 1)).toContain('Narrow the date range')
  })
})

describe('groupAuditByDay', () => {
  const at = (iso: string) => ({ id: iso, createdAt: new Date(iso) })

  it('buckets consecutive rows by business-timezone day and labels the recent two', () => {
    const now = new Date('2026-08-20T06:00:00Z')
    const groups = groupAuditByDay(
      [
        at('2026-08-20T05:00:00Z'), // 10:30 Colombo, today
        at('2026-08-20T04:00:00Z'),
        at('2026-08-19T04:00:00Z'),
        at('2026-08-17T04:00:00Z'),
      ],
      now,
    )
    expect(groups.map((g) => [g.dayIso, g.relativeLabel, g.rows.length])).toEqual([
      ['2026-08-20', 'Today', 2],
      ['2026-08-19', 'Yesterday', 1],
      ['2026-08-17', '', 1],
    ])
  })

  it('buckets an oldest-first page just as correctly — a day is broken by a change of day, not by direction', () => {
    const now = new Date('2026-08-20T06:00:00Z')
    const groups = groupAuditByDay([at('2026-08-17T04:00:00Z'), at('2026-08-19T04:00:00Z')], now)
    expect(groups.map((g) => g.dayIso)).toEqual(['2026-08-17', '2026-08-19'])
  })

  it('an instant after Colombo midnight but before UTC midnight files under the LOCAL day', () => {
    // 2026-08-19T20:00Z is 01:30 on the 20th in Colombo. Bucketing in UTC
    // would file it a day early and put it under the wrong header.
    const groups = groupAuditByDay([at('2026-08-19T20:00:00Z')], new Date('2026-08-20T06:00:00Z'))
    expect(groups[0].dayIso).toBe('2026-08-20')
    expect(groups[0].relativeLabel).toBe('Today')
  })

  it('no rows, no groups', () => {
    expect(groupAuditByDay([], new Date())).toEqual([])
  })
})

describe('colombo day bounds', () => {
  it('a one-day range covers that whole calendar day in the business timezone', () => {
    expect(colomboDayStart('2026-08-20').toISOString()).toBe('2026-08-19T18:30:00.000Z')
    expect(colomboDayEnd('2026-08-20').toISOString()).toBe('2026-08-20T18:29:59.999Z')
  })
})
