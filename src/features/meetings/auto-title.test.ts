import { describe, expect, it } from 'vitest'

import { autoMeetingTitle, isAutoMeetingTitle } from './auto-title'

/** 2026-08-12T04:30:00Z = 10:00 in Asia/Colombo (UTC+5:30). */
const AUG_12_10AM_LK = new Date('2026-08-12T04:30:00.000Z')

describe('autoMeetingTitle', () => {
  it('combines the project name with the local date and time', () => {
    expect(autoMeetingTitle({ appName: 'Vela', startsAt: AUG_12_10AM_LK })).toBe(
      'Vela · 12 Aug 10:00',
    )
  })

  it('renders in Colombo time, not UTC — the half-hour offset is the tell', () => {
    // 23:00Z on the 11th is already 04:30 on the 12th in Colombo. A formatter
    // that quietly used UTC would render "11 Aug 23:00" here.
    expect(
      autoMeetingTitle({ appName: 'Vela', startsAt: new Date('2026-08-11T23:00:00.000Z') }),
    ).toBe('Vela · 12 Aug 04:30')
  })

  it('honours an injected time zone so the output never depends on the machine', () => {
    expect(
      autoMeetingTitle({ appName: 'Vela', startsAt: AUG_12_10AM_LK, timeZone: 'UTC' }),
    ).toBe('Vela · 12 Aug 04:30')
  })

  it('uses 24-hour time with a padded hour', () => {
    expect(
      autoMeetingTitle({ appName: 'Orbit', startsAt: new Date('2026-08-12T01:05:00.000Z') }),
    ).toBe('Orbit · 12 Aug 06:35')
  })

  it('returns an empty string when no app is chosen yet', () => {
    expect(autoMeetingTitle({ appName: null, startsAt: AUG_12_10AM_LK })).toBe('')
    expect(autoMeetingTitle({ appName: '   ', startsAt: AUG_12_10AM_LK })).toBe('')
  })

  it('falls back to the bare app name when the date is unusable', () => {
    expect(autoMeetingTitle({ appName: 'Vela', startsAt: new Date('nonsense') })).toBe('Vela')
  })

  it('trims a padded app name rather than emitting double spaces', () => {
    expect(autoMeetingTitle({ appName: '  Vela  ', startsAt: AUG_12_10AM_LK })).toBe(
      'Vela · 12 Aug 10:00',
    )
  })
})

describe('isAutoMeetingTitle', () => {
  it('recognises its own output, including for multi-word app names', () => {
    expect(isAutoMeetingTitle(autoMeetingTitle({ appName: 'Vela', startsAt: AUG_12_10AM_LK }))).toBe(true)
    expect(
      isAutoMeetingTitle(autoMeetingTitle({ appName: 'Vela CRM', startsAt: AUG_12_10AM_LK })),
    ).toBe(true)
  })

  it('leaves a human-written title alone', () => {
    expect(isAutoMeetingTitle('Payments migration kickoff')).toBe(false)
    expect(isAutoMeetingTitle('Vela weekly')).toBe(false)
    expect(isAutoMeetingTitle('')).toBe(false)
  })

  it('does not claim a title that merely mentions a date', () => {
    // No separator, so a person typing this keeps it.
    expect(isAutoMeetingTitle('Retro 12 Aug 10:00')).toBe(false)
  })

  it('still recognises its output when the user added surrounding whitespace', () => {
    expect(isAutoMeetingTitle('  Vela · 12 Aug 10:00  ')).toBe(true)
  })
})
