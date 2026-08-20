import { describe, expect, it } from 'vitest'
import {
  applyAuditNlPatch,
  auditNlSchema,
  buildAuditNlPrompt,
  isEmptyAuditNlPatch,
} from '@/features/admin/audit-nl'
import { parseAuditParams } from '@/features/admin/audit-filters'

const current = parseAuditParams({})

describe('auditNlSchema', () => {
  it('drops an entity type the log does not have', () => {
    // The failure this prevents: an invented type filters to nothing, and the
    // page then says "no such activity" about a question it never really
    // asked. Dropped, the chips show what actually applied instead.
    const parsed = auditNlSchema.parse({ type: 'invoice', q: 'invoice' })
    expect(parsed.type).toBeUndefined()
    expect(parsed.q).toBe('invoice')
  })

  it('drops a verb outside the log vocabulary', () => {
    expect(auditNlSchema.parse({ verb: 'yeeted' }).verb).toBeUndefined()
  })

  it('keeps a real type and verb', () => {
    const parsed = auditNlSchema.parse({ type: 'meeting', verb: 'deleted' })
    expect(parsed.type).toBe('meeting')
    expect(parsed.verb).toBe('deleted')
  })

  it('has no actor key at all — a model asked for a uuid invents one', () => {
    // A fabricated uuid is not an empty result, it is Postgres 22P02 at bind
    // time: a crash screen on the audit page. Names go in `q`, which matches
    // the actor's name in SQL.
    const parsed = auditNlSchema.parse({ actor: '11111111-1111-4111-8111-111111111111' })
    expect('actor' in parsed).toBe(false)
  })

  it('rejects a malformed date rather than filtering by it', () => {
    expect(auditNlSchema.parse({ from: 'last tuesday' }).from).toBeUndefined()
    expect(auditNlSchema.parse({ from: '2026-08-01' }).from).toBe('2026-08-01')
  })
})

describe('buildAuditNlPrompt', () => {
  it('gives the model the closed vocabularies rather than asking it to guess', () => {
    const prompt = buildAuditNlPrompt('what did alex delete', '2026-08-20')
    expect(prompt).toContain('meeting')
    expect(prompt).toContain('deleted')
    expect(prompt).toContain('2026-08-20')
    expect(prompt).toContain('what did alex delete')
  })

  it('takes today as an argument — a pure module must not read a clock', () => {
    // "last week" resolves against Colombo's day, which the caller owns.
    expect(buildAuditNlPrompt('q', '2026-01-01')).toContain('2026-01-01')
  })
})

describe('applyAuditNlPatch', () => {
  it('keeps the sort and direction the reader chose', () => {
    const sorted = { ...current, sort: 'actor' as const, dir: 'asc' as const }
    const next = applyAuditNlPatch(sorted, { verb: 'deleted' })
    expect(next.sort).toBe('actor')
    expect(next.dir).toBe('asc')
  })

  it('returns to page one, because the result just changed shape', () => {
    const deep = { ...current, page: 4 }
    expect(applyAuditNlPatch(deep, { verb: 'deleted' }).page).toBe(1)
  })

  it('leaves filters the patch did not mention', () => {
    const filtered = { ...current, actor: '11111111-1111-4111-8111-111111111111' }
    expect(applyAuditNlPatch(filtered, { verb: 'deleted' }).actor).toBe(filtered.actor)
  })
})

describe('isEmptyAuditNlPatch', () => {
  it('is true for the empty object a model returns for "show everything"', () => {
    expect(isEmptyAuditNlPatch({})).toBe(true)
    expect(isEmptyAuditNlPatch({ q: '   ' })).toBe(true)
  })

  it('is false when self is explicitly false — that is a real filter', () => {
    expect(isEmptyAuditNlPatch({ self: false })).toBe(false)
  })
})
