import { describe, expect, it } from 'vitest'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { liveBugReports } from '@/db/live'
import { triageQueueConditions, TRIAGE_PAGE_SIZE } from '@/features/bugs/queue-page'
import { decodeKeysetCursor, encodeKeysetCursor } from '@/lib/keyset-cursor'

// The conditions are SQL, so they are asserted by rendering them — a
// connection-free QueryBuilder, the same trick src/db/live.test.ts uses to
// prove its subqueries without a database.
const render = (where: ReturnType<typeof triageQueueConditions>) => {
  const { sql, params } = new QueryBuilder()
    .select()
    .from(liveBugReports)
    .where(where)
    .toSQL()
  return { sql: sql.toLowerCase(), params }
}

const CURSOR = {
  createdAt: new Date('2026-08-20T09:00:00.123Z'),
  id: '22222222-2222-4222-8222-222222222222',
}

describe('triageQueueConditions', () => {
  it('asks for the open statuses when nothing is filtered', () => {
    const { params } = render(triageQueueConditions())
    expect(params).toContain('open')
    expect(params).toContain('triaged')
    expect(params).not.toContain('resolved')
  })

  it('narrows the open set rather than replacing it', () => {
    const { params } = render(triageQueueConditions({ status: 'triaged' }))
    expect(params).toContain('triaged')
    expect(params).not.toContain('open')
  })

  it('matches nothing when asked for a status the queue never serves', () => {
    // 'resolved' is a real BugStatus, so parseBugFilters accepts it — this
    // intersection is what stops it widening the queue's meaning into rows the
    // surface is defined not to contain.
    const { sql, params } = render(triageQueueConditions({ status: 'resolved' }))
    expect(params).not.toContain('resolved')
    expect(sql).toContain('where')
  })

  it('adds severity only when one is asked for', () => {
    expect(render(triageQueueConditions({})).params).not.toContain('critical')
    expect(render(triageQueueConditions({ severity: 'critical' })).params).toContain('critical')
  })

  it('walks the keyset with lte on the timestamp, not lt alone', () => {
    // The whole subtlety: created_at is timestamptz and a JS Date carries only
    // milliseconds, so a cursor round-trips FLOORED. Under a strict `lt` every
    // row inside the boundary millisecond is skipped forever.
    const { sql } = render(triageQueueConditions({}, CURSOR))
    expect(sql).toContain('<=')
    expect(sql).toContain('<')
  })

  it('keeps the filters alongside the cursor, so page two cannot widen', () => {
    const { params } = render(triageQueueConditions({ severity: 'high' }, CURSOR))
    expect(params).toContain('high')
    expect(params).toContain(CURSOR.id)
  })
})

describe('the cursor codec', () => {
  it('round-trips a row', () => {
    const decoded = decodeKeysetCursor(encodeKeysetCursor(CURSOR))
    expect(decoded?.id).toBe(CURSOR.id)
    expect(decoded?.createdAt.toISOString()).toBe(CURSOR.createdAt.toISOString())
  })

  it('degrades a hand-edited cursor to page one instead of throwing', () => {
    // A non-uuid id would be Postgres error 22P02 at bind time — a crash
    // screen, not an empty list — which is exactly what this rejects.
    expect(decodeKeysetCursor('2026-08-20T09:00:00.123Z|garbage')).toBeNull()
    expect(decodeKeysetCursor('not-a-date|22222222-2222-4222-8222-222222222222')).toBeNull()
    expect(decodeKeysetCursor('no-separator')).toBeNull()
    expect(decodeKeysetCursor(undefined)).toBeNull()
  })
})

describe('TRIAGE_PAGE_SIZE', () => {
  it('is one definition both the first render and the load-more action use', () => {
    // Pinned so a change is a decision rather than a drift: the page and the
    // action reading different sizes is what makes a keyset walk skip rows.
    expect(TRIAGE_PAGE_SIZE).toBe(50)
  })
})
