import { describe, it, expect } from 'vitest'
import { filterMeetingsBySearch } from './list-search'

type Row = {
  title: string
  agenda: string | null
  attendees: { name: string }[]
  apps: { name: string }[]
}

function row(title: string, extras: Partial<Omit<Row, 'title'>> = {}): Row {
  return { title, agenda: null, attendees: [], apps: [], ...extras }
}

function titles(rows: Row[]): string[] {
  return rows.map((r) => r.title)
}

describe('filterMeetingsBySearch — query emptiness', () => {
  const meetings = [row('Sprint planning'), row('Retro')]

  it('returns the input array identity for an empty query', () => {
    expect(filterMeetingsBySearch(meetings, '')).toBe(meetings)
  })

  it('returns the input array identity for a whitespace-only query', () => {
    expect(filterMeetingsBySearch(meetings, '   ')).toBe(meetings)
    expect(filterMeetingsBySearch(meetings, '\t\n')).toBe(meetings)
  })

  it('returns a filtered copy, not the input, once the query says anything', () => {
    const result = filterMeetingsBySearch(meetings, 'sprint')
    expect(result).not.toBe(meetings)
    expect(titles(result)).toEqual(['Sprint planning'])
  })
})

describe('filterMeetingsBySearch — English', () => {
  const meetings = [
    row('Sprint planning', { agenda: 'Velocity and the release cut' }),
    row('Design review', { attendees: [{ name: 'Nimal Perera' }] }),
    row('All hands', { apps: [{ name: 'LogPup' }, { name: 'Uptime' }] }),
  ]

  it('matches case-insensitively in both directions', () => {
    expect(titles(filterMeetingsBySearch(meetings, 'SPRINT'))).toEqual(['Sprint planning'])
    expect(titles(filterMeetingsBySearch(meetings, 'design REVIEW'))).toEqual(['Design review'])
  })

  it('searches the agenda', () => {
    expect(titles(filterMeetingsBySearch(meetings, 'release cut'))).toEqual(['Sprint planning'])
  })

  it('searches attendee names', () => {
    expect(titles(filterMeetingsBySearch(meetings, 'perera'))).toEqual(['Design review'])
  })

  it('searches app names', () => {
    expect(titles(filterMeetingsBySearch(meetings, 'logpup'))).toEqual(['All hands'])
  })

  it('trims the query before matching', () => {
    expect(titles(filterMeetingsBySearch(meetings, '  sprint  '))).toEqual(['Sprint planning'])
  })

  it('returns nothing for a query no field contains', () => {
    expect(filterMeetingsBySearch(meetings, 'quarterly')).toEqual([])
  })

  it('does not match across the seam between two fields', () => {
    // Title ends "…planning", agenda begins "Velocity…" — a concatenated
    // haystack would let this phantom phrase match.
    expect(filterMeetingsBySearch(meetings, 'planning velocity')).toEqual([])
  })
})

describe('filterMeetingsBySearch — Sinhala', () => {
  // ZWJ conjunct ශ්‍රී, built from escapes (ශ ් ZWJ ර ී) so an editor or
  // formatter that strips invisible characters cannot silently hollow the
  // tests out. Plain literals elsewhere in this block are safe because the
  // needle and haystack come from the same source text.
  const sri = '\u0DC1\u0DCA\u200D\u0DBB\u0DD3'

  const meetings = [
    // රැස්වීම carries a ස + ් (U+0DCA al-lakuna) + ව cluster mid-word.
    row('සතියේ රැස්වීම', { agenda: 'මම කිව්ව විදිහට task board එක හදන්න' }),
    row(sri + ' ලංකා කණ්ඩායම', { attendees: [{ name: 'නිමල් පෙරේරා' }] }),
    row('Deploy සාකච්ඡාව', { agenda: 'build එක deploy කරන්න' }),
  ]

  it('matches a query containing al-lakuna (U+0DCA) sequences', () => {
    const query = 'රැස්වීම'
    expect(query).toContain('්')
    expect(titles(filterMeetingsBySearch(meetings, query))).toEqual(['සතියේ රැස්වීම'])
    // The bare cluster tail ව් (ව + al-lakuna) is a legitimate substring too.
    expect(titles(filterMeetingsBySearch(meetings, 'ව්ව'))).toEqual([
      'සතියේ රැස්වීම',
    ])
  })

  it('matches a ZWJ conjunct, joiner and all', () => {
    expect(titles(filterMeetingsBySearch(meetings, sri))).toEqual([sri + ' ලංකා කණ්ඩායම'])
  })

  it('keeps the ZWJ significant — the joiner-less spelling is a different string', () => {
    // ශ්රී without the joiner renders differently and IS different: folding
    // must not strip the ZWJ to be lenient, per the bilingual rules.
    const sriWithoutJoiner = '\u0DC1\u0DCA\u0DBB\u0DD3'
    expect(filterMeetingsBySearch(meetings, sriWithoutJoiner)).toEqual([])
  })

  it('folds composed and decomposed spellings of the same letter together (NFC)', () => {
    // කෝ typed as ක + kombuva + aela-pilla + al-lakuna (U+0DD9 U+0DCF U+0DCA)
    // is the same letter as precomposed ක + U+0DDD — different keyboards emit
    // different sequences for the same visible word.
    const composedRows = [row('කෝපි break')]
    const decomposedQuery = '\u0D9A\u0DD9\u0DCF\u0DCA\u0DB4\u0DD2'
    expect(decomposedQuery).not.toBe('\u0D9A\u0DDD\u0DB4\u0DD2')
    expect(titles(filterMeetingsBySearch(composedRows, decomposedQuery))).toEqual([
      'කෝපි break',
    ])
  })

  it('folds decomposed Latin diacritics the same way', () => {
    const rows = [row('Café sync')]
    expect(titles(filterMeetingsBySearch(rows, 'café'))).toEqual(['Café sync'])
  })

  it('searches Sinhala attendee names', () => {
    expect(titles(filterMeetingsBySearch(meetings, 'නිමල්'))).toEqual([sri + ' ලංකා කණ්ඩායම'])
  })

  it('matches inside a code-switched field, across the script boundary', () => {
    expect(titles(filterMeetingsBySearch(meetings, 'එක deploy'))).toEqual(['Deploy සාකච්ඡාව'])
  })

  it('finds every row a code-switched term appears in, whatever the field', () => {
    expect(titles(filterMeetingsBySearch(meetings, 'deploy'))).toEqual(['Deploy සාකච්ඡාව'])
    expect(titles(filterMeetingsBySearch(meetings, 'එක'))).toEqual([
      'සතියේ රැස්වීම',
      'Deploy සාකච්ඡාව',
    ])
  })
})
