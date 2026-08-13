import { describe, expect, it } from 'vitest'
import { activityFilterHref, describeActivityFilters, isoDayLabel } from './describe'
import type { ActivityParamState } from './filters'

const EMPTY: ActivityParamState = { person: '', type: '', app: '', from: '', to: '', q: '' }

describe('isoDayLabel', () => {
  it('spells out an ISO calendar day without touching Date', () => {
    expect(isoDayLabel('2026-08-13')).toBe('Aug 13')
    expect(isoDayLabel('2026-01-01')).toBe('Jan 1')
    expect(isoDayLabel('2026-12-31')).toBe('Dec 31')
  })

  it('passes anything malformed through verbatim rather than inventing a date', () => {
    expect(isoDayLabel('')).toBe('')
    expect(isoDayLabel('nonsense')).toBe('nonsense')
    expect(isoDayLabel('2026-13-01')).toBe('2026-13-01')
    expect(isoDayLabel('2026-00-01')).toBe('2026-00-01')
  })
})

describe('describeActivityFilters', () => {
  it('says what the page IS when nothing is narrowed', () => {
    expect(describeActivityFilters({})).toBe('Every change across the team, newest first.')
  })

  it('names a lone type filter instead of reading as unfiltered', () => {
    expect(describeActivityFilters({ entityType: 'task' })).toBe('task changes, newest first.')
  })

  it('names the person and the app', () => {
    expect(describeActivityFilters({ personName: 'Prabuddha', appName: 'LogPup' })).toBe(
      'Changes by Prabuddha in LogPup, newest first.',
    )
  })

  it('reads a single day as "on", not as a range', () => {
    expect(describeActivityFilters({ from: '2026-08-13', to: '2026-08-13' })).toBe(
      'Changes on Aug 13, newest first.',
    )
  })

  it('reads open-ended bounds as since / up to', () => {
    expect(describeActivityFilters({ from: '2026-08-01' })).toBe(
      'Changes since Aug 1, newest first.',
    )
    expect(describeActivityFilters({ to: '2026-08-01' })).toBe(
      'Changes up to Aug 1, newest first.',
    )
  })

  it('composes every filter at once in a fixed order', () => {
    expect(
      describeActivityFilters({
        personName: 'Prabuddha',
        entityType: 'meeting',
        appName: 'LogPup',
        from: '2026-08-01',
        to: '2026-08-13',
        q: 'standup',
      }),
    ).toBe(
      'meeting changes by Prabuddha in LogPup matching “standup” between Aug 1 and Aug 13, newest first.',
    )
  })
})

describe('activityFilterHref', () => {
  it('keeps every other active filter so clicking through NARROWS', () => {
    const href = activityFilterHref({ ...EMPTY, app: 'app-1', q: 'login' }, { person: 'u-1' })
    const params = new URL(href, 'https://x').searchParams
    expect(params.get('person')).toBe('u-1')
    expect(params.get('app')).toBe('app-1')
    expect(params.get('q')).toBe('login')
  })

  it('never carries a pagination cursor into a new question', () => {
    // `before` is not part of ActivityParamState at all, which is what makes
    // this structurally true — asserted so a future field can't quietly add it.
    const href = activityFilterHref(EMPTY, { type: 'task' })
    expect(href).toBe('/activity?type=task')
    expect(href).not.toContain('before')
  })

  it('falls back to the bare route when the patch clears the last filter', () => {
    expect(activityFilterHref({ ...EMPTY, person: 'u-1' }, { person: '' })).toBe('/activity')
  })

  it('sets both day bounds for a day marker', () => {
    const href = activityFilterHref(EMPTY, { from: '2026-08-13', to: '2026-08-13' })
    const params = new URL(href, 'https://x').searchParams
    expect(params.get('from')).toBe('2026-08-13')
    expect(params.get('to')).toBe('2026-08-13')
  })
})
