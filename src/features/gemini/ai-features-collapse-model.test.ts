import { describe, expect, it } from 'vitest'
import {
  AI_FEATURES_EVENT,
  AI_FEATURES_HASH,
  AI_FEATURES_STORAGE_KEY,
  aiFeaturesToggleLabel,
  formatAiFeaturesSummaryBadge,
  resolveAiFeaturesOpen,
} from './ai-features-collapse-model'

describe('resolveAiFeaturesOpen', () => {
  it('defaults to false when no storage is present', () => {
    expect(resolveAiFeaturesOpen(null)).toBe(false)
    expect(resolveAiFeaturesOpen(undefined)).toBe(false)
    expect(resolveAiFeaturesOpen('')).toBe(false)
  })

  it('reads affirmative stored preference', () => {
    expect(resolveAiFeaturesOpen('true')).toBe(true)
    expect(resolveAiFeaturesOpen('false')).toBe(false)
  })

  it('treats corrupted stored values as collapsed', () => {
    expect(resolveAiFeaturesOpen('1')).toBe(false)
    expect(resolveAiFeaturesOpen('True')).toBe(false)
    expect(resolveAiFeaturesOpen('yes')).toBe(false)
  })

  it('expands if hash matches #ai-features regardless of stored value', () => {
    expect(resolveAiFeaturesOpen(null, '#ai-features')).toBe(true)
    expect(resolveAiFeaturesOpen('false', '#ai-features')).toBe(true)
    expect(resolveAiFeaturesOpen('true', '#ai-features')).toBe(true)
    expect(resolveAiFeaturesOpen(null, '#something-else')).toBe(false)
  })
})

describe('formatAiFeaturesSummaryBadge', () => {
  it('formats call count when calls > 0', () => {
    expect(formatAiFeaturesSummaryBadge(15, 8, 8)).toBe('15 calls in 30d')
    expect(formatAiFeaturesSummaryBadge(1, 7, 8)).toBe('1 calls in 30d')
  })

  it('formats active count when zero calls logged', () => {
    expect(formatAiFeaturesSummaryBadge(0, 8, 8)).toBe('8 of 8 active')
    expect(formatAiFeaturesSummaryBadge(0, 0, 8)).toBe('0 of 8 active')
  })
})

describe('aiFeaturesToggleLabel', () => {
  it('returns Collapse when open and Expand when collapsed', () => {
    expect(aiFeaturesToggleLabel(true)).toBe('Collapse')
    expect(aiFeaturesToggleLabel(false)).toBe('Expand')
  })
})

describe('constants', () => {
  it('maintains expected keys', () => {
    expect(AI_FEATURES_STORAGE_KEY).toBe('logpup:ai-features-open')
    expect(AI_FEATURES_EVENT).toBe('logpup:ai-features-toggle')
    expect(AI_FEATURES_HASH).toBe('#ai-features')
  })
})
