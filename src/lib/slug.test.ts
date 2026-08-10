import { describe, it, expect } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('lowercases, hyphenates, strips symbols', () => {
    expect(slugify('LogPup  API v2!')).toBe('logpup-api-v2')
  })
  it('trims leading/trailing hyphens', () => {
    expect(slugify('--Hello--')).toBe('hello')
  })
})
