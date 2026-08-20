import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { liveApps } from '@/db/live'
import { activityLog, users } from '@/db/schema'
import type { Actor } from '@/features/auth/capabilities'
import type { AuditParamState } from './audit-filters'

/**
 * Two jobs, matching the two ways this module can be wrong.
 *
 * 1. SQL SHAPE, rendered with a connection-free QueryBuilder. The audit log is
 *    the record of who did what, so the load-bearing property is that no
 *    request value ever becomes SQL — every filter must show up in `params`,
 *    never in the statement text, and ORDER BY must only ever be one of three
 *    whitelisted columns. The hostile strings below are FIXTURES: `@/db` is
 *    mocked, nothing is ever executed, and the assertion is precisely that
 *    they stay inert bind values.
 * 2. BEHAVIOUR, over that mocked `@/db` (the trash-queries.test.ts pattern):
 *    the capability guard, the row shaping, and the separately-reported total.
 */

// Row queries end at .offset(); count queries are awaited at .where() (or at
// .from(), for the unfiltered total); the facet queries end at .orderBy().
// Keying by terminal method rather than by call order sidesteps the way
// Promise.all interleaves them.
const rowQueue: unknown[][] = []
const countQueue: unknown[][] = []
const distinctQueue: unknown[][] = []
let selectCalls = 0

function thenFrom(queue: unknown[][]) {
  return (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(queue.shift() ?? []).then(onFulfilled, onRejected)
}

vi.mock('@/db', () => {
  const chain: Record<string, unknown> = {}
  Object.assign(chain, {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: async () => rowQueue.shift() ?? [],
    then: thenFrom(countQueue),
  })
  const distinctChain: Record<string, unknown> = {}
  Object.assign(distinctChain, {
    from: () => distinctChain,
    innerJoin: () => distinctChain,
    orderBy: () => distinctChain,
    then: thenFrom(distinctQueue),
  })
  return {
    db: {
      select: () => {
        selectCalls += 1
        return chain
      },
      selectDistinct: () => distinctChain,
    },
  }
})

const {
  auditConditions,
  auditOrderBy,
  auditSearchCondition,
  countAuditTrail,
  listAuditFacets,
  listAuditTrail,
} = await import('./audit-queries')

const BASE: AuditParamState = {
  q: '', actor: '', type: '', verb: '', from: '', to: '', self: false,
  sort: 'time', dir: 'desc', page: 1,
}

const ADMIN: Actor = { id: 'u-admin', role: 'admin', scopeAppIds: new Set() }
const AUDITOR: Actor = { id: 'u-aud', role: 'auditor', scopeAppIds: new Set() }
const MEMBER: Actor = { id: 'u-mem', role: 'member', scopeAppIds: new Set() }
const MANAGER: Actor = { id: 'u-mgr', role: 'manager', scopeAppIds: new Set(['app-1']) }

// The literal an injection attempt would have to produce to be dangerous.
// Assembled rather than written out so the assertion below is about the
// STATEMENT, not about this file's own text.
const HOSTILE_TAIL = ['drop', 'table', 'activity_log'].join(' ')

/** The real statement this module builds, rendered without a connection. */
function render(state: AuditParamState) {
  const qb = new QueryBuilder()
  return qb
    .select({ id: activityLog.id })
    .from(activityLog)
    .innerJoin(users, eq(users.id, activityLog.actorId))
    .leftJoin(liveApps, eq(activityLog.appId, liveApps.id))
    .where(auditConditions(state))
    .orderBy(...auditOrderBy(state.sort, state.dir))
    .toSQL()
}

beforeEach(() => {
  rowQueue.length = 0
  countQueue.length = 0
  distinctQueue.length = 0
  selectCalls = 0
})

describe('auditConditions — no filter value ever becomes SQL', () => {
  it('an unfiltered read has no WHERE clause at all', () => {
    expect(auditConditions(BASE)).toBeUndefined()
  })

  it('an injection-shaped search lands entirely in the bind params', () => {
    const hostile = `'; ${HOSTILE_TAIL}; --`
    const { sql, params } = render({ ...BASE, q: hostile })
    expect(sql).not.toContain(HOSTILE_TAIL)
    // Search tokenises on whitespace, so the attempt arrives as four inert
    // ilike patterns rather than one — every one of them a bind value, with
    // its LIKE metacharacters (the `_` in activity_log) escaped on the way.
    expect(params).toEqual(
      expect.arrayContaining(["%';%", '%drop%', '%table%', '%activity\\_log;%', '%--%']),
    )
    // Every column the search covers is a placeholder comparison.
    expect(sql).toContain('$1')
  })

  it('a hostile filter value cannot reach a column name either', () => {
    const { sql, params } = render({
      ...BASE,
      type: `user"; ${HOSTILE_TAIL}; --`,
      verb: 'deleted',
      actor: '11111111-2222-4333-8444-555555555555',
    })
    expect(sql).not.toContain(HOSTILE_TAIL)
    expect(params).toContain(`user"; ${HOSTILE_TAIL}; --`)
    expect(params).toContain('deleted')
    expect(params).toContain('11111111-2222-4333-8444-555555555555')
  })

  it('escapes LIKE metacharacters so "50%" searches for a literal 50%', () => {
    const { params } = render({ ...BASE, q: '50% a_b' })
    expect(params).toContain('%50\\%%')
    expect(params).toContain('%a\\_b%')
  })

  it('tokenises on whitespace: every token must match, each across every column', () => {
    expect(auditSearchCondition('alex')).toBeDefined()
    expect(auditSearchCondition('alex login')).toBeDefined()
    const { params } = render({ ...BASE, q: 'alex login' })
    expect(params).toEqual(expect.arrayContaining(['%alex%', '%login%']))
    // Seven searchable columns, once per token.
    expect(params.filter((p) => p === '%alex%')).toHaveLength(7)
  })

  it('an empty or whitespace-only search is not a condition', () => {
    expect(auditSearchCondition('')).toBeUndefined()
    expect(auditSearchCondition('   ')).toBeUndefined()
  })

  it('a one-day range binds that whole day at the business timezone’s edges', () => {
    // Bound as values, and as INSTANTS: a `from`/`to` of the same day must
    // still cover 24 hours, or "everything that happened on the 1st" silently
    // means "everything at exactly 00:00". Drizzle renders a timestamptz bind
    // as its ISO string, which is what lands in params.
    const { params } = render({ ...BASE, from: '2026-08-01', to: '2026-08-01' })
    expect(params).toEqual(['2026-07-31T18:30:00.000Z', '2026-08-01T18:29:59.999Z'])
  })

  it('the self-approved filter compares a literal this module owns, never request text', () => {
    const { sql, params } = render({ ...BASE, self: true })
    expect(sql).toContain("->>'selfApproved' = 'true'")
    expect(params).toEqual([])
  })
})

describe('auditOrderBy — a closed whitelist, always a total order', () => {
  it('time sorts on created_at and breaks ties on id', () => {
    const { sql } = render({ ...BASE, sort: 'time', dir: 'desc' })
    const order = sql.slice(sql.indexOf('order by')).toLowerCase()
    expect(order).toContain('"created_at" desc')
    expect(order).toContain('"id" desc')
  })

  it('actor sorts on the joined user name, then falls back to time and id', () => {
    const { sql } = render({ ...BASE, sort: 'actor', dir: 'asc' })
    const order = sql.slice(sql.indexOf('order by')).toLowerCase()
    expect(order).toContain('"name" asc')
    expect(order).toContain('"created_at" desc')
    expect(order).toContain('"id" desc')
  })

  it('entity sorts on type then label, and still ends on a unique key', () => {
    const { sql } = render({ ...BASE, sort: 'entity', dir: 'desc' })
    const order = sql.slice(sql.indexOf('order by')).toLowerCase()
    expect(order).toContain('"entity_type" desc')
    expect(order).toContain('"entity_label" desc')
    expect(order).toContain('"id" desc')
  })

  it('every whitelisted key produces an ordering; nothing else can be asked for', () => {
    for (const sort of ['time', 'actor', 'entity'] as const) {
      for (const dir of ['asc', 'desc'] as const) {
        expect(auditOrderBy(sort, dir).length).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

describe('listAuditTrail', () => {
  it('refuses an actor without audit.view, and never touches the database to do it', async () => {
    const page = await listAuditTrail(MEMBER, BASE)
    expect(page).toMatchObject({ rows: [], total: 0 })
    expect(selectCalls).toBe(0)
  })

  it('refuses a MANAGER: audit.view is scoped there, and there is no per-app slice of an audit', async () => {
    const page = await listAuditTrail(MANAGER, BASE)
    expect(page.rows).toEqual([])
    expect(selectCalls).toBe(0)
  })

  it('lets an auditor read it', async () => {
    rowQueue.push([])
    countQueue.push([{ total: 0 }])
    await listAuditTrail(AUDITOR, BASE)
    expect(selectCalls).toBe(2)
  })

  it('reports the matching total separately from the bounded page of rows', async () => {
    rowQueue.push([row({ id: 'a1' })])
    countQueue.push([{ total: 312 }])

    const page = await listAuditTrail(ADMIN, { ...BASE, page: 2 })

    expect(page.rows).toHaveLength(1)
    expect(page.total).toBe(312)
    expect(page.page).toBe(2)
    expect(page.pageSize).toBe(50)
  })

  it('surfaces metadata.selfApproved as a flag — the whole reason this read exists', async () => {
    rowQueue.push([
      row({ id: 'a1', metadata: { selfApproved: true } }),
      row({ id: 'a2', metadata: { selfApproved: false } }),
      row({ id: 'a3', metadata: null }),
      // Truthy-but-not-true must NOT read as signed: an audit flag that fires
      // on a stray string is a false accusation.
      row({ id: 'a4', metadata: { selfApproved: 'yes' } }),
    ])
    countQueue.push([{ total: 4 }])

    const page = await listAuditTrail(ADMIN, BASE)
    expect(page.rows.map((r) => r.selfApproved)).toEqual([true, false, false, false])
  })

  it('keeps the metadata payload on the row so the detail disclosure has something to open', async () => {
    rowQueue.push([row({ id: 'a1', metadata: { before: 'todo', after: 'doing' } })])
    countQueue.push([{ total: 1 }])
    const page = await listAuditTrail(ADMIN, BASE)
    expect(page.rows[0].metadata).toEqual({ before: 'todo', after: 'doing' })
  })

  it('a missing count row is zero, not NaN', async () => {
    rowQueue.push([])
    countQueue.push([])
    const page = await listAuditTrail(ADMIN, BASE)
    expect(page.total).toBe(0)
  })
})

describe('countAuditTrail', () => {
  it('is the unfiltered total, and is refused to an actor without the capability', async () => {
    expect(await countAuditTrail(MEMBER)).toBe(0)
    expect(selectCalls).toBe(0)

    countQueue.push([{ total: 4120 }])
    expect(await countAuditTrail(ADMIN)).toBe(4120)
  })
})

describe('listAuditFacets', () => {
  it('is empty for an actor who cannot read the trail', async () => {
    expect(await listAuditFacets(MEMBER)).toEqual({ actors: [], verbs: [], types: [] })
    expect(selectCalls).toBe(0)
  })

  it('dedupes the verb/type pairs into two sorted vocabularies taken from the LOG', async () => {
    distinctQueue.push([{ id: 'u1', name: 'Alex' }])
    distinctQueue.push([
      { verb: 'updated', entityType: 'task' },
      { verb: 'created', entityType: 'task' },
      { verb: 'updated', entityType: 'meeting' },
      // A one-off verb no constant knows about still has to be filterable.
      { verb: 'teleported', entityType: 'wormhole' },
    ])

    const facets = await listAuditFacets(AUDITOR)
    expect(facets.actors).toEqual([{ id: 'u1', name: 'Alex' }])
    expect(facets.verbs).toEqual(['created', 'teleported', 'updated'])
    expect(facets.types).toEqual(['meeting', 'task', 'wormhole'])
  })
})

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    actorId: 'u1',
    actorName: 'Alex',
    actorAvatarUrl: null,
    verb: 'updated',
    entityType: 'task',
    entityId: 't1',
    entityLabel: 'Fix login',
    appId: null,
    appName: null,
    pagePath: null,
    detail: null,
    metadata: null,
    createdAt: new Date('2026-08-20T04:00:00Z'),
    ...overrides,
  }
}
