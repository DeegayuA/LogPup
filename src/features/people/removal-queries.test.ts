import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { users } from '@/db/schema'

// The db import is a lazy Proxy that would try to reach Neon the moment a
// query is awaited. Nothing under test here awaits one — notRemoved and
// toRemovalMap are both connection-free — so the stub only has to exist.
vi.mock('@/db', () => ({ db: {} }))

const { notRemoved, toRemovalMap } = await import('./removal-queries')

const dialect = new PgDialect()
const sqlOf = (fragment: Parameters<PgDialect['sqlToQuery']>[0]) => dialect.sqlToQuery(fragment).sql

describe('notRemoved', () => {
  const predicate = () => sqlOf(notRemoved(users.id))

  it('is a NOT EXISTS against user_deletions, correlated to the column it was given', () => {
    const sql = predicate()
    expect(sql).toContain('not exists')
    expect(sql).toContain('"user_deletions"')
    expect(sql).toContain('"users"."id"')
  })

  // The partial unique index user_deletions_one_open_idx only covers rows
  // where restored_at IS NULL, so a predicate that forgot this clause would
  // keep hiding somebody who had already been restored — and would do it
  // silently, since the row it matched is real.
  it('only counts OPEN removals — a closed interval must not exclude anyone', () => {
    expect(predicate()).toContain('"restored_at" is null')
  })

  // The whole design rests on the users table NOT being filtered globally
  // (see the comment on userDeletions in db/schema.ts): this is a WHERE
  // fragment a caller opts into, never a replacement table.
  it('touches nothing but user_deletions — it never joins or wraps users', () => {
    expect(predicate()).not.toContain('from "users"')
  })
})

describe('toRemovalMap', () => {
  const at = new Date('2026-08-01T00:00:00Z')

  it('keys by user id and keeps who removed them and why', () => {
    const map = toRemovalMap([
      { userId: 'u1', removedAt: at, removedBy: 'admin-1', reason: 'Contract ended' },
    ])
    expect(map.get('u1')).toEqual({ removedAt: at, removedBy: 'admin-1', reason: 'Contract ended' })
  })

  it('carries a null remover rather than dropping the row', () => {
    // removed_by is nullable ON DELETE no action: losing the remover's own
    // account must not erase the record that somebody was removed.
    const map = toRemovalMap([{ userId: 'u1', removedAt: at, removedBy: null, reason: null }])
    expect(map.has('u1')).toBe(true)
    expect(map.get('u1')?.removedBy).toBeNull()
  })

  it('answers "not removed" for anyone absent, which is almost everyone', () => {
    expect(toRemovalMap([]).get('u1')).toBeUndefined()
  })
})
