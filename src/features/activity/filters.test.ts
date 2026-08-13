import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import {
  activityConditions,
  activityParams,
  activitySearchCondition,
  decodeActivityCursor,
  encodeActivityCursor,
} from './filters'

// activityConditions returns drizzle SQL objects — opaque, but their
// PRESENCE/ABSENCE per input is the composition rule worth pinning down, and
// the cursor codec is pure string work either way.
//
// activitySearchCondition's content (which columns, how tokens combine,
// escaping) is NOT just presence/absence, so those tests go one level deeper
// and render the SQL — PgDialect is the same dialect the real `db` uses, just
// invoked directly instead of through a live connection, so this stays a
// no-database test.
const dialect = new PgDialect()

describe('activityConditions', () => {
  it('returns undefined for no filters and no cursor — the unfiltered firehose', () => {
    expect(activityConditions({})).toBeUndefined()
  })

  it('builds a condition when any single filter is present', () => {
    expect(activityConditions({ actorId: 'a' })).toBeDefined()
    expect(activityConditions({ entityType: 'task' })).toBeDefined()
    expect(activityConditions({ appId: 'x' })).toBeDefined()
    expect(activityConditions({ from: new Date() })).toBeDefined()
    expect(activityConditions({ to: new Date() })).toBeDefined()
    expect(activityConditions({ q: 'meeting' })).toBeDefined()
  })

  it('a whitespace-only q does not turn an otherwise-unfiltered trail into a filtered one', () => {
    expect(activityConditions({ q: '   ' })).toBeUndefined()
  })

  it('builds a condition for a cursor alone (page two of the firehose)', () => {
    expect(
      activityConditions({}, { createdAt: new Date(), id: 'row-id' }),
    ).toBeDefined()
  })
})

describe('activitySearchCondition', () => {
  it('returns undefined for an empty or whitespace-only query', () => {
    expect(activitySearchCondition('')).toBeUndefined()
    expect(activitySearchCondition('   ')).toBeUndefined()
  })

  it('matches a single token against every searchable column, case-insensitively', () => {
    const cond = activitySearchCondition('MeetING')
    expect(cond).toBeDefined()
    const { sql, params } = dialect.sqlToQuery(cond!)
    // ilike, not like — case-insensitivity is structural, not a runtime flag.
    expect(sql).toContain('ilike')
    expect(sql).toContain('"entity_label"')
    expect(sql).toContain('"detail"')
    expect(sql).toContain('"verb"')
    expect(sql).toContain('"entity_type"')
    // The token itself is passed through verbatim (as a bound param, not
    // lowercased) — ilike does the case folding, not this function.
    expect(params).toEqual(['%MeetING%', '%MeetING%', '%MeetING%', '%MeetING%'])
  })

  it('ANDs multiple tokens together — every token must match somewhere', () => {
    const { sql, params } = dialect.sqlToQuery(activitySearchCondition('team standup')!)
    expect(sql).toContain(' and ')
    expect(params).toEqual([
      '%team%',
      '%team%',
      '%team%',
      '%team%',
      '%standup%',
      '%standup%',
      '%standup%',
      '%standup%',
    ])
  })

  it('collapses repeated whitespace between tokens', () => {
    const a = dialect.sqlToQuery(activitySearchCondition('team   standup')!)
    const b = dialect.sqlToQuery(activitySearchCondition('team standup')!)
    expect(a.params).toEqual(b.params)
  })

  it('escapes % and _ so a query containing them matches literally, not as wildcards', () => {
    const { params } = dialect.sqlToQuery(activitySearchCondition('50%_off')!)
    expect(params[0]).toBe('%50\\%\\_off%')
  })
})

describe('activityParams', () => {
  it('omits params for empty/unset filters, including q', () => {
    expect(
      activityParams({ person: '', type: '', app: '', from: '', to: '', q: '' }).toString(),
    ).toBe('')
  })

  it('round-trips every filter, q included, alongside a cursor', () => {
    const params = activityParams(
      { person: 'p1', type: 'task', app: 'a1', from: '2026-08-01', to: '2026-08-12', q: 'meetign' },
      '2026-08-12T10:30:00.000Z|22222222-2222-4222-8222-222222222222',
    )
    // Round-tripped through URLSearchParams' own (de)serialization, the way
    // the browser and the server's searchParams parser actually see it —
    // not just read back off the object that built it.
    const roundTripped = new URLSearchParams(params.toString())
    expect(roundTripped.get('person')).toBe('p1')
    expect(roundTripped.get('type')).toBe('task')
    expect(roundTripped.get('app')).toBe('a1')
    expect(roundTripped.get('from')).toBe('2026-08-01')
    expect(roundTripped.get('to')).toBe('2026-08-12')
    expect(roundTripped.get('q')).toBe('meetign')
    expect(roundTripped.get('before')).toBe(
      '2026-08-12T10:30:00.000Z|22222222-2222-4222-8222-222222222222',
    )
  })

  it('carries q into the Load-more link even when no other filter is set — the classic bug', () => {
    const params = activityParams(
      { person: '', type: '', app: '', from: '', to: '', q: 'meetign' },
      '2026-08-12T10:30:00.000Z|22222222-2222-4222-8222-222222222222',
    )
    expect(new URLSearchParams(params.toString()).get('q')).toBe('meetign')
  })
})

describe('activity cursor codec', () => {
  it('round-trips', () => {
    const row = {
      createdAt: new Date('2026-08-12T10:30:00.000Z'),
      id: '22222222-2222-4222-8222-222222222222',
    }
    const decoded = decodeActivityCursor(encodeActivityCursor(row))
    expect(decoded?.id).toBe(row.id)
    expect(decoded?.createdAt.getTime()).toBe(row.createdAt.getTime())
  })

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['no separator', '2026-08-12T10:30:00.000Z'],
    ['bad date', 'yesterday|some-id'],
    ['missing id', '2026-08-12T10:30:00.000Z|'],
    // Not merely cosmetic: activity_log.id is a Postgres `uuid` column, so a
    // non-uuid id reaching the query is error 22P02 raised at bind time — a
    // 500, not an empty page. Rejecting it here is what keeps the "degrades
    // to page one" contract true.
    ['non-uuid id', '2026-08-12T10:30:00.000Z|garbage'],
    ['truncated uuid', '2026-08-12T10:30:00.000Z|22222222-2222-4222-8222-2222222222'],
    ['uuid with trailing junk', '2026-08-12T10:30:00.000Z|22222222-2222-4222-8222-222222222222x'],
  ])('degrades %s to null instead of crashing', (_name, raw) => {
    expect(decodeActivityCursor(raw as string | undefined)).toBeNull()
  })
})
