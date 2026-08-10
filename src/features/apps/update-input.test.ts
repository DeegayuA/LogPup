import { describe, it, expect } from 'vitest'
import { buildAppUpdate } from './update-input'

describe('buildAppUpdate', () => {
  it('rename-only input produces a set with only name', () => {
    const result = buildAppUpdate({ name: 'New Name' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.set).toEqual({ name: 'New Name' })
    }
  })

  it('maps an empty repoUrl to null', () => {
    const result = buildAppUpdate({ repoUrl: '' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.set).toEqual({ repoUrl: null })
    }
  })

  it('rejects an empty object with nothing to update', () => {
    const result = buildAppUpdate({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('Nothing to update')
    }
  })

  it('rejects an invalid status', () => {
    const result = buildAppUpdate({ status: 'bogus' })
    expect(result.ok).toBe(false)
  })
})
