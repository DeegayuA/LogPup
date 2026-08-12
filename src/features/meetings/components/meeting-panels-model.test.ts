import { describe, expect, it } from 'vitest'
import {
  clearFilters,
  countByKind,
  filterItems,
  groupByKind,
  hasActiveFilters,
  matchesFilters,
  NO_FILTERS,
  personNamesMatch,
  resolveDensity,
  resolvePanelOpen,
  resolveSummaryLanguage,
  splitBilingualSummary,
  toggleKind,
  type ActiveFilters,
  type FilterableItem,
  type PersonFilterOption,
} from './meeting-panels-model'

const PEOPLE: PersonFilterOption[] = [
  { id: 'u1', name: 'Nadeesha Perera' },
  { id: 'u2', name: 'Shakya Silva' },
]

function item(kind: FilterableItem['kind'], personNames: string[] = []): FilterableItem {
  return { kind, personNames }
}

describe('personNamesMatch', () => {
  it('matches an exact name', () => {
    expect(personNamesMatch('Shakya Silva', 'Shakya Silva')).toBe(true)
  })
  it('matches a first-name prefix of a full attendee name', () => {
    expect(personNamesMatch('Nadeesha', 'Nadeesha Perera')).toBe(true)
    expect(personNamesMatch('Nadeesha Perera', 'Nadeesha')).toBe(true)
  })
  it('is case- and whitespace-insensitive', () => {
    expect(personNamesMatch('  shakya   silva ', 'Shakya Silva')).toBe(true)
  })
  it('does not match a different person sharing a substring', () => {
    expect(personNamesMatch('Amal', 'Kamal Perera')).toBe(false)
  })
  it('rejects empty input', () => {
    expect(personNamesMatch('', 'Shakya Silva')).toBe(false)
    expect(personNamesMatch('Shakya', '')).toBe(false)
  })
})

describe('matchesFilters — the combined filter predicate', () => {
  it('matches everything when no filters are active', () => {
    const rows = [item('action', ['Shakya Silva']), item('term'), item('discussion', [])]
    for (const row of rows) expect(matchesFilters(row, NO_FILTERS, PEOPLE)).toBe(true)
  })

  it('kind filter alone: excludes non-matching kinds regardless of person', () => {
    const filters: ActiveFilters = { personId: null, kinds: new Set(['action']) }
    expect(matchesFilters(item('action', ['Shakya Silva']), filters, PEOPLE)).toBe(true)
    expect(matchesFilters(item('discussion', ['Shakya Silva']), filters, PEOPLE)).toBe(false)
  })

  it('person filter alone: keeps only items attributed to that attendee', () => {
    const filters: ActiveFilters = { personId: 'u2', kinds: null }
    expect(matchesFilters(item('action', ['Shakya Silva']), filters, PEOPLE)).toBe(true)
    expect(matchesFilters(item('action', ['Nadeesha Perera']), filters, PEOPLE)).toBe(false)
  })

  it('person filter hides person-scoped items with no owner at all', () => {
    const filters: ActiveFilters = { personId: 'u2', kinds: null }
    expect(matchesFilters(item('action', []), filters, PEOPLE)).toBe(false)
  })

  it('person filter never hides glossary terms — they belong to nobody in particular', () => {
    const filters: ActiveFilters = { personId: 'u2', kinds: null }
    expect(matchesFilters(item('term', []), filters, PEOPLE)).toBe(true)
  })

  it('an unresolvable person id matches everything rather than hiding silently', () => {
    const filters: ActiveFilters = { personId: 'ghost', kinds: null }
    expect(matchesFilters(item('action', ['Shakya Silva']), filters, PEOPLE)).toBe(true)
  })

  it('combined: both must pass', () => {
    const filters: ActiveFilters = { personId: 'u2', kinds: new Set(['action']) }
    expect(matchesFilters(item('action', ['Shakya Silva']), filters, PEOPLE)).toBe(true)
    // right kind, wrong person
    expect(matchesFilters(item('action', ['Nadeesha Perera']), filters, PEOPLE)).toBe(false)
    // right person, wrong kind
    expect(matchesFilters(item('discussion', ['Shakya Silva']), filters, PEOPLE)).toBe(false)
  })

  it('clearing filters restores "matches everything"', () => {
    const narrowed: ActiveFilters = { personId: 'u2', kinds: new Set(['action']) }
    expect(hasActiveFilters(narrowed)).toBe(true)
    const cleared = clearFilters()
    expect(hasActiveFilters(cleared)).toBe(false)
    expect(matchesFilters(item('discussion', ['Nadeesha Perera']), cleared, PEOPLE)).toBe(true)
  })

  it('a filter that matches nothing returns an empty filtered list', () => {
    const rows = [item('action', ['Nadeesha Perera']), item('term')]
    const filters: ActiveFilters = { personId: 'u2', kinds: new Set(['action']) }
    expect(filterItems(rows, filters, PEOPLE)).toEqual([])
  })
})

describe('toggleKind', () => {
  it('starting from "all" (null), excludes exactly the toggled kind', () => {
    const next = toggleKind(null, 'term')
    expect(next).toEqual(new Set(['action', 'question', 'discussion', 'carried-forward']))
  })
  it('toggling the same kind back in returns to "all" (null)', () => {
    const once = toggleKind(null, 'term')
    const twice = toggleKind(once, 'term')
    expect(twice).toBeNull()
  })
})

describe('groupByKind / countByKind — the section grouping/counting function', () => {
  it('groups mixed-kind items, including kinds with zero items', () => {
    const rows = [
      item('action', ['a']),
      item('action', ['b']),
      item('term'),
      item('carried-forward', ['c']),
    ]
    const groups = groupByKind(rows)
    expect(groups.action).toHaveLength(2)
    expect(groups.term).toHaveLength(1)
    expect(groups.question).toHaveLength(0)
    expect(groups.discussion).toHaveLength(0)
    expect(groups['carried-forward']).toHaveLength(1)
  })

  it('counts mirror the group lengths', () => {
    const rows = [item('question', ['a']), item('question', ['b']), item('discussion', ['c'])]
    expect(countByKind(rows)).toEqual({
      action: 0,
      question: 2,
      discussion: 1,
      term: 0,
      'carried-forward': 0,
    })
  })

  it('handles empty input', () => {
    expect(countByKind([])).toEqual({
      action: 0,
      question: 0,
      discussion: 0,
      term: 0,
      'carried-forward': 0,
    })
  })
})

describe('resolveSummaryLanguage — language-preference resolution', () => {
  it('accepts a valid stored value', () => {
    expect(resolveSummaryLanguage('si')).toBe('si')
    expect(resolveSummaryLanguage('both')).toBe('both')
    expect(resolveSummaryLanguage('en')).toBe('en')
  })
  it('defaults to English when nothing is stored', () => {
    expect(resolveSummaryLanguage(null)).toBe('en')
  })
  it('falls back to the default on an invalid stored value', () => {
    expect(resolveSummaryLanguage('fr')).toBe('en')
    expect(resolveSummaryLanguage('')).toBe('en')
    expect(resolveSummaryLanguage('undefined')).toBe('en')
  })
})

describe('resolveDensity', () => {
  it('accepts "compact"', () => {
    expect(resolveDensity('compact')).toBe('compact')
  })
  it('defaults to comfortable for null or garbage', () => {
    expect(resolveDensity(null)).toBe('comfortable')
    expect(resolveDensity('cozy')).toBe('comfortable')
  })
})

describe('resolvePanelOpen', () => {
  it('round-trips explicit 1/0', () => {
    expect(resolvePanelOpen('1', false)).toBe(true)
    expect(resolvePanelOpen('0', true)).toBe(false)
  })
  it('falls back to the panel-specific default when nothing is stored', () => {
    expect(resolvePanelOpen(null, true)).toBe(true)
    expect(resolvePanelOpen(null, false)).toBe(false)
  })
  it('falls back to the default on a garbage stored value', () => {
    expect(resolvePanelOpen('yes', true)).toBe(true)
  })
})

describe('splitBilingualSummary', () => {
  it('returns everything as English when there is no Sinhala block', () => {
    const md = 'Decisions made.\n\nNext steps for the team.'
    expect(splitBilingualSummary(md)).toEqual({ en: md, si: '' })
  })

  it('splits an English block followed by a duplicate Sinhala block', () => {
    const en = 'Decisions made: ship the redesign this week.'
    const si = 'තීරණ: මෙම සතියේ නැවත සැලසුම නිකුත් කරන්න.'
    const md = `${en}\n\n${si}`
    expect(splitBilingualSummary(md)).toEqual({ en, si })
  })

  it('handles a Sinhala-only summary', () => {
    const si = 'සාරාංශය සම්පූර්ණයෙන්ම සිංහලෙන් පමණි.'
    expect(splitBilingualSummary(si)).toEqual({ en: '', si })
  })

  it('returns empty buckets for null/empty input', () => {
    expect(splitBilingualSummary(null)).toEqual({ en: '', si: '' })
    expect(splitBilingualSummary('   ')).toEqual({ en: '', si: '' })
  })

  it('keeps a mixed, Latin-majority code-switched block in English', () => {
    const md = 'We agreed to deploy the sprint build (the "sprint" එක) on Friday.'
    expect(splitBilingualSummary(md)).toEqual({ en: md, si: '' })
  })
})
