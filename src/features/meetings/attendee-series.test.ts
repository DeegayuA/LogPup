import { describe, expect, it } from 'vitest'
import { sameSeries, seriesKey } from './attendee-series'

describe('seriesKey', () => {
  it('collapses "Standup", "Daily standup" and "Standup (Tue)" to the same key', () => {
    const key = seriesKey('Standup')
    expect(key).toBe('standup')
    expect(seriesKey('Daily standup')).toBe(key)
    expect(seriesKey('Standup (Tue)')).toBe(key)
  })

  it('treats the app name as content, not noise — different apps get different keys', () => {
    const vela = seriesKey('Vela standup')
    const orbit = seriesKey('Orbit standup')
    expect(vela).not.toBeNull()
    expect(orbit).not.toBeNull()
    expect(vela).not.toBe(orbit)
  })

  it('strips Sinhala weekday tokens (the සඳුදා-family)', () => {
    const key = seriesKey('Vela sync')
    expect(seriesKey('Vela sync සඳුදා')).toBe(key) // Monday
    expect(seriesKey('Vela sync අඟහරුවාදා')).toBe(key) // Tuesday
    expect(seriesKey('Vela sync සෙනසුරාදා')).toBe(key) // Saturday
  })

  it('collapses cadence-word, em-dash, date and issue-number spellings of the same title', () => {
    const key = seriesKey('Vela sync')
    expect(seriesKey('Weekly Vela sync — 12/08')).toBe(key)
    expect(seriesKey('Vela sync 2026-08-12')).toBe(key)
    expect(seriesKey('Vela sync #14')).toBe(key)
    expect(seriesKey('Vela sync 12.08.2026')).toBe(key)
  })

  it('strips clock times in several spellings', () => {
    const key = seriesKey('Standup')
    expect(seriesKey('Standup 10:00')).toBe(key)
    expect(seriesKey('Standup 2pm')).toBe(key)
    expect(seriesKey('Standup 2:30 pm')).toBe(key)
  })

  it('strips month names, ordinals, and week/sprint numbers', () => {
    const key = seriesKey('Vela sync')
    expect(seriesKey('Vela sync 1st August')).toBe(key)
    expect(seriesKey('Vela sync w4')).toBe(key)
    expect(seriesKey('Vela sync sprint 3')).toBe(key)
  })

  it('deletes cadence words only — content words like sync/standup/retro survive', () => {
    expect(seriesKey('Daily sync')).toBe('sync')
    expect(seriesKey('Weekly standup')).toBe('standup')
    expect(seriesKey('Monthly retro')).toBe('retro')
    expect(seriesKey('Biweekly sync')).toBe('sync')
    expect(seriesKey('Bi-weekly sync')).toBe('sync')
    expect(seriesKey('Fortnightly sync')).toBe('sync')
  })

  it('returns null for titles that reduce to nothing meaningful', () => {
    expect(seriesKey('')).toBeNull()
    expect(seriesKey('   ')).toBeNull()
    expect(seriesKey('#12')).toBeNull()
    expect(seriesKey('(Tue)')).toBeNull()
    expect(seriesKey('ok')).toBeNull()
  })

  it('returns null when every remaining token is a stopword, even at length >= 3', () => {
    // 'The' clears the 3-character floor on its own but has zero non-stopword
    // tokens, so this exercises a branch the length check alone can't reach.
    expect(seriesKey('The')).toBeNull()
  })

  it('is NFKC- and case-insensitive', () => {
    expect(seriesKey('VELA SYNC')).toBe('vela sync')
    expect(seriesKey('Ｖｅｌａ Ｓｙｎｃ')).toBe('vela sync') // full-width forms
  })
})

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
