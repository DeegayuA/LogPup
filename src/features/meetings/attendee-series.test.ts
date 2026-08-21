import { describe, expect, it } from 'vitest'
import { sameSeries } from './attendee-series'

describe('sameSeries', () => {
  const withApp = (title: string, appId: string | null) => ({ title, appId })

  it('requires equal key AND equal appId', () => {
    expect(sameSeries(withApp('Standup', 'app-1'), withApp('Daily standup', 'app-1'))).toBe(true)
  })

  it('treats different appIds as different series even with the same key', () => {
    expect(sameSeries(withApp('Standup', 'app-1'), withApp('Standup', 'app-2'))).toBe(false)
  })

  it('treats both-null appId as equal', () => {
    expect(sameSeries(withApp('Standup', null), withApp('Daily standup', null))).toBe(true)
  })

  it('never matches when either title has a null key — two unnameable titles are not the same series', () => {
    expect(sameSeries(withApp('#12', null), withApp('#12', null))).toBe(false)
    expect(sameSeries(withApp('#12', 'app-1'), withApp('Standup', 'app-1'))).toBe(false)
  })
})
