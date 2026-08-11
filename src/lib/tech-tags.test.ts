import { describe, expect, it } from 'vitest'
import {
  CURATED_TECH_TAGS,
  canonicalizeTag,
  filterTagSuggestions,
  mergeTagSources,
} from './tech-tags'

describe('CURATED_TECH_TAGS', () => {
  it('has no duplicates', () => {
    expect(new Set(CURATED_TECH_TAGS).size).toBe(CURATED_TECH_TAGS.length)
  })

  it('has no case-insensitive duplicates either', () => {
    const lower = CURATED_TECH_TAGS.map((tag) => tag.toLowerCase())
    expect(new Set(lower).size).toBe(lower.length)
  })

  it('has no empty strings', () => {
    for (const tag of CURATED_TECH_TAGS) {
      expect(tag.trim().length).toBeGreaterThan(0)
    }
  })

  it('is sorted alphabetically', () => {
    const sorted = [...CURATED_TECH_TAGS].sort((a, b) => a.localeCompare(b))
    expect(CURATED_TECH_TAGS).toEqual(sorted)
  })

  it('is a genuinely useful set, not a token handful', () => {
    expect(CURATED_TECH_TAGS.length).toBeGreaterThan(50)
  })
})

describe('canonicalizeTag', () => {
  const known = ['Next.js', 'TypeScript', 'PostgreSQL']

  it('returns the exact match unchanged', () => {
    expect(canonicalizeTag('Next.js', known)).toBe('Next.js')
  })

  it('canonicalizes a case-insensitive match to the known casing', () => {
    expect(canonicalizeTag('next.js', known)).toBe('Next.js')
    expect(canonicalizeTag('NEXT.JS', known)).toBe('Next.js')
    expect(canonicalizeTag('postgresql', known)).toBe('PostgreSQL')
  })

  it('passes an unknown tag through unchanged (trimmed)', () => {
    expect(canonicalizeTag('Astro', known)).toBe('Astro')
  })

  it('trims whitespace before comparing and returning', () => {
    expect(canonicalizeTag('  next.js  ', known)).toBe('Next.js')
    expect(canonicalizeTag('  Astro  ', known)).toBe('Astro')
  })

  it('returns an empty string for whitespace-only input', () => {
    expect(canonicalizeTag('   ', known)).toBe('')
  })
})

describe('filterTagSuggestions', () => {
  const known = ['Next.js', 'Nuxt', 'Node.js', 'NestJS', 'PostgreSQL', 'Python']

  it('matches by case-insensitive substring', () => {
    expect(filterTagSuggestions('next', known, [])).toEqual(['Next.js'])
    expect(filterTagSuggestions('NEXT', known, [])).toEqual(['Next.js'])
    expect(filterTagSuggestions('.js', known, [])).toEqual(['Next.js', 'Node.js'])
  })

  it('matches a substring anywhere in the tag, not just a prefix', () => {
    expect(filterTagSuggestions('sql', known, [])).toEqual(['PostgreSQL'])
  })

  it('excludes tags already selected, case-insensitively', () => {
    expect(filterTagSuggestions('n', known, ['next.js'])).not.toContain('Next.js')
    expect(filterTagSuggestions('n', known, ['Nuxt'])).not.toContain('Nuxt')
  })

  it('respects the cap', () => {
    expect(filterTagSuggestions('n', known, [], 2)).toHaveLength(2)
  })

  it('returns nothing for an empty or whitespace-only query', () => {
    expect(filterTagSuggestions('', known, [])).toEqual([])
    expect(filterTagSuggestions('   ', known, [])).toEqual([])
  })

  it('returns nothing when nothing matches', () => {
    expect(filterTagSuggestions('zzz', known, [])).toEqual([])
  })
})

describe('mergeTagSources', () => {
  it('deduplicates case-insensitively, preferring curated casing', () => {
    const merged = mergeTagSources(['Next.js'], ['next.js', 'Astro'])
    expect(merged).toEqual(['Astro', 'Next.js'])
  })

  it('keeps workspace-only tags with their original casing', () => {
    const merged = mergeTagSources(['TypeScript'], ['legacy-cobol-bridge'])
    expect(merged).toContain('legacy-cobol-bridge')
  })

  it('drops empty/whitespace-only workspace entries', () => {
    const merged = mergeTagSources(['TypeScript'], ['', '   '])
    expect(merged).toEqual(['TypeScript'])
  })

  it('returns a sorted, deduplicated result', () => {
    const merged = mergeTagSources(['Beta', 'Alpha'], ['gamma'])
    expect(merged).toEqual(['Alpha', 'Beta', 'gamma'])
  })
})
