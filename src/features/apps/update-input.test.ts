import { describe, it, expect } from 'vitest'
import { buildAppUpdate, summarizeAppChanges, type AppBeforeState } from './update-input'

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

  it('maps an empty description to null', () => {
    const result = buildAppUpdate({ description: '' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.set).toEqual({ description: null })
    }
  })

  it('omitting description leaves the key absent from set', () => {
    const result = buildAppUpdate({ name: 'New Name' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.set).not.toHaveProperty('description')
      expect(result.set).toEqual({ name: 'New Name' })
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

  it('accepts a PM change and rejects a non-uuid PM', () => {
    const ok = buildAppUpdate({ pmId: '11111111-1111-4111-8111-111111111111' })
    expect(ok.ok).toBe(true)
    const bad = buildAppUpdate({ pmId: 'not-a-uuid' })
    expect(bad.ok).toBe(false)
  })
})

describe('summarizeAppChanges', () => {
  const before: AppBeforeState = {
    status: 'active',
    leadId: 'lead-1',
    pmId: 'pm-1',
  }

  it('produces no entry when nothing in the set differs from before', () => {
    // The settings form resubmits every field on every save, whether or not
    // the admin touched it — this is the case that must not pollute /activity.
    const result = summarizeAppChanges(before, { pmId: 'pm-1', status: 'active' })
    expect(result).toEqual({ detail: null, metadata: null })
  })

  it('produces no entry for an update that touches unrelated fields only', () => {
    const result = summarizeAppChanges(before, { name: 'New Name' })
    expect(result).toEqual({ detail: null, metadata: null })
  })

  it('records a PM change with the resolved name', () => {
    const result = summarizeAppChanges(before, { pmId: 'pm-2' }, { pmName: 'Jane Doe' })
    expect(result.detail).toBe('PM to Jane Doe')
    expect(result.metadata).toEqual({ pmId: { from: 'pm-1', to: 'pm-2' } })
  })

  it('falls back to a generic label when the new PM has no resolvable name', () => {
    const result = summarizeAppChanges(before, { pmId: 'pm-2' })
    expect(result.detail).toBe('PM to an unknown member')
  })

  it('records a lead change, including clearing it to no lead', () => {
    const result = summarizeAppChanges(before, { leadId: null })
    expect(result.detail).toBe('lead to no lead')
    expect(result.metadata).toEqual({ leadId: { from: 'lead-1', to: null } })
  })

  it('records a lead change to a named person', () => {
    const result = summarizeAppChanges(before, { leadId: 'lead-2' }, { leadName: 'Nuwan' })
    expect(result.detail).toBe('lead to Nuwan')
    expect(result.metadata).toEqual({ leadId: { from: 'lead-1', to: 'lead-2' } })
  })

  it('does not log a lead change when the new value equals the old one', () => {
    const result = summarizeAppChanges(before, { leadId: 'lead-1' }, { leadName: 'Someone' })
    expect(result).toEqual({ detail: null, metadata: null })
  })

  it('combines multiple simultaneous changes into one detail string', () => {
    const result = summarizeAppChanges(
      before,
      { status: 'archived', pmId: 'pm-2' },
      { pmName: 'Jane Doe' },
    )
    expect(result.detail).toBe('status to archived, PM to Jane Doe')
    expect(result.metadata).toEqual({
      status: { from: 'active', to: 'archived' },
      pmId: { from: 'pm-1', to: 'pm-2' },
    })
  })
})
