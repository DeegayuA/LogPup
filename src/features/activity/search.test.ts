import { describe, expect, it } from 'vitest'
import { activityRowSearchText, fuzzyActivityFallback, rankActivityMatches } from './search'
import type { ActivityRow } from './types'

type Row = { id: string; text: string }
const text = (row: Row) => row.text

describe('rankActivityMatches', () => {
  it('ranks an exact word match above a same-length elongated match', () => {
    const exact: Row = { id: 'exact', text: 'Prabuddha moved task Fix meeting scheduler' }
    // "meeting" is still a literal substring of "meetings" — it passes the
    // keep-gate — but the WORD itself only partially matches.
    const nearMatch: Row = { id: 'near', text: 'Prabuddha moved task Fix meetings scheduler' }
    const result = rankActivityMatches([nearMatch, exact], 'meeting', text)
    expect(result.map((r) => r.id)).toEqual(['exact', 'near'])
  })

  it('orders multiple matches by descending similarity', () => {
    const rows: Row[] = [
      { id: 'weaker', text: 'renamed sprint meetings-followup' },
      { id: 'stronger', text: 'created meeting Weekly sync' },
    ]
    expect(rankActivityMatches(rows, 'meeting', text).map((r) => r.id)).toEqual([
      'stronger',
      'weaker',
    ])
  })

  it('drops rows containing none of the query tokens', () => {
    const rows: Row[] = [{ id: 'a', text: 'unrelated sprint update' }]
    expect(rankActivityMatches(rows, 'meeting', text)).toEqual([])
  })

  it('returns rows unchanged for an empty or whitespace-only query', () => {
    const rows: Row[] = [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }]
    expect(rankActivityMatches(rows, '   ', text)).toBe(rows)
  })

  it('does not crash on an empty row list', () => {
    expect(rankActivityMatches([], 'meeting', text)).toEqual([])
  })
})

describe('fuzzyActivityFallback', () => {
  it('finds a misspelled query against the correctly-spelled row', () => {
    const rows: Row[] = [{ id: 'a', text: 'created meeting Weekly sync' }]
    expect(fuzzyActivityFallback(rows, 'meetign', text).map((r) => r.id)).toEqual(['a'])
  })

  it('returns nothing for a genuinely unrelated query — the threshold is not that loose', () => {
    const rows: Row[] = [{ id: 'a', text: 'created meeting Weekly sync' }]
    expect(fuzzyActivityFallback(rows, 'xyzzybanana', text)).toEqual([])
  })

  it('returns no rows for an empty or whitespace-only query', () => {
    const rows: Row[] = [{ id: 'a', text: 'created meeting Weekly sync' }]
    expect(fuzzyActivityFallback(rows, '   ', text)).toEqual([])
  })

  it('does not crash on an empty row list', () => {
    expect(fuzzyActivityFallback([], 'meetign', text)).toEqual([])
  })

  it('rescues a misspelled Sinhala query the same way it rescues English typos', () => {
    // An ASCII-only word splitter deletes every Sinhala character, so pure
    // Sinhala rows were skipped outright and Sinhala typos found nothing.
    const rows: Row[] = [{ id: 'a', text: 'රැස්වීම් සටහන් updated' }]
    expect(fuzzyActivityFallback(rows, 'රැස්වම', text).map((r) => r.id)).toEqual(['a'])
  })
})

describe('activityRowSearchText', () => {
  it('joins the searchable columns and drops nulls', () => {
    const row: ActivityRow = {
      id: '1',
      actorId: 'u1',
      actorName: 'Deeghayu',
      actorAvatarUrl: null,
      verb: 'moved',
      entityType: 'task',
      entityId: 't1',
      entityLabel: 'Fix login',
      appId: null,
      appName: null,
      pagePath: null,
      detail: null,
      metadata: null,
      createdAt: new Date('2026-08-12T00:00:00Z'),
    }
    expect(activityRowSearchText(row)).toBe('Fix login moved task')
  })
})
