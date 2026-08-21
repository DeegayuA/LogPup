import { describe, expect, it } from 'vitest'
import { purposeToken, purposesCompatible, seriesKey } from './series-key'

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

describe('purposeToken', () => {
  it('names the purpose an ordinary title carries', () => {
    expect(purposeToken('Vela standup')).toBe('standup')
    expect(purposeToken('Orbit retro')).toBe('retro')
    expect(purposeToken('Sprint planning')).toBe('planning')
    expect(purposeToken('Design crit')).toBe('crit')
    expect(purposeToken('Client demo')).toBe('demo')
    expect(purposeToken('Vela sync')).toBe('sync')
    expect(purposeToken('Outage postmortem')).toBe('postmortem')
    expect(purposeToken('Project handover')).toBe('handover')
  })

  it('returns null for a title naming no purpose — the common case, and not a failure', () => {
    expect(purposeToken('Vela')).toBeNull()
    expect(purposeToken('Budget')).toBeNull()
    expect(purposeToken('')).toBeNull()
  })

  it('folds a second spelling onto the same purpose', () => {
    expect(purposeToken('Sprint retrospective')).toBe('retro')
    expect(purposeToken('Outage post-mortem')).toBe('postmortem')
    expect(purposeToken('Daily stand-up')).toBe('standup')
    expect(purposeToken('Vela hand-over')).toBe('handover')
  })

  it('reads Sinhala purposes as the same token as their English word', () => {
    expect(purposeToken('Vela සමාලෝචනය')).toBe('review')
    expect(purposeToken('Vela සැලසුම')).toBe('planning')
    expect(purposeToken('Vela ප්‍රදර්ශනය')).toBe('demo')
    // The whole point of mapping rather than listing separately: a Sinhala
    // review and an English review are ONE purpose, so they never veto.
    expect(purposesCompatible(purposeToken('Vela සමාලෝචනය'), purposeToken('Vela review'))).toBe(true)
  })

  it('reads the 1:1 family, which does not survive normalisation', () => {
    expect(purposeToken('Nuwan 1:1')).toBe('1:1')
    expect(purposeToken('Nuwan 1-1')).toBe('1:1')
    expect(purposeToken('Nuwan 1 on 1')).toBe('1:1')
    expect(purposeToken('One on one with Nuwan')).toBe('1:1')
    // seriesKey collapses the colon to a space, which is exactly why the
    // raw-title regex exists — this documents the shape it rescues.
    expect(seriesKey('Nuwan 1:1')).toBe('nuwan 1 1')
  })

  it('answers the same however a two-purpose title was worded', () => {
    expect(purposeToken('Sprint review and retro')).toBe(purposeToken('Retro and sprint review'))
  })

  it('never matches a purpose word inside a larger word', () => {
    expect(purposeToken('Syncopation workshop')).toBeNull()
    expect(purposeToken('Reviewer training')).toBeNull()
  })
})

describe('purposesCompatible', () => {
  it('lets a null purpose join anything — the veto is permissive by design', () => {
    expect(purposesCompatible(null, null)).toBe(true)
    expect(purposesCompatible(null, 'standup')).toBe(true)
    expect(purposesCompatible('standup', null)).toBe(true)
  })

  it('lets the same purpose share one meeting', () => {
    expect(purposesCompatible('sync', 'sync')).toBe(true)
  })

  it('refuses two different named purposes — the crossing R3 and R6 both forbid', () => {
    expect(purposesCompatible('standup', 'retro')).toBe(false)
    expect(purposesCompatible('1:1', 'planning')).toBe(false)
    expect(purposesCompatible('demo', 'crit')).toBe(false)
  })
})
