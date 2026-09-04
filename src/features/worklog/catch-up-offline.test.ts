import { describe, expect, it } from 'vitest'
import { readCatchUpTextOffline } from '@/features/worklog/catch-up-offline'
import type { CatchUpCandidateDay } from '@/features/worklog/catch-up-parse'
import type { AliasedApp } from '@/features/apps/app-aliases'

const APPS: AliasedApp[] = [
  { id: 'attendance', name: 'Attendance Web App', aliases: ['SGX', 'syntax genie'] },
  { id: 'solarsim', name: 'Solar Sim - Chloride Exide', aliases: [] },
  { id: 'carecode', name: 'CareCode', aliases: [] },
]

/* Aug 28 to Sep 4, the window the box actually offered. */
const DAYS: CatchUpCandidateDay[] = [
  { day: '2026-08-28', label: 'Fri 28 Aug', fraction: 1, logged: false, loggedMinutes: 0 },
  { day: '2026-08-29', label: 'Sat 29 Aug', fraction: 0.5, logged: false, loggedMinutes: 0 },
  { day: '2026-08-30', label: 'Sun 30 Aug', fraction: 0, logged: false, loggedMinutes: 0 },
  { day: '2026-08-31', label: 'Mon 31 Aug', fraction: 1, logged: false, loggedMinutes: 0 },
  { day: '2026-09-01', label: 'Tue 1 Sep', fraction: 1, logged: false, loggedMinutes: 0 },
  { day: '2026-09-02', label: 'Wed 2 Sep', fraction: 1, logged: false, loggedMinutes: 0 },
  { day: '2026-09-03', label: 'Thu 3 Sep', fraction: 1, logged: false, loggedMinutes: 0 },
  { day: '2026-09-04', label: 'Fri 4 Sep', fraction: 1, logged: false, loggedMinutes: 0 },
]

const read = (text: string) =>
  readCatchUpTextOffline({ text, today: '2026-09-04', candidateDays: DAYS, apps: APPS })

/* THE PASTE. Verbatim, including both misspellings and the bracketed comma. */
const PASTE =
  'sep 3 - attendance app fixes (chamari, multi tenet) 4h, ML model for SGX 2h,  ' +
  'bug fixes in Solar app 2h, sep 2 - fixes in attendace app 4h, monthly meeting 2h, ' +
  'documenting 2h, sep 1 and aug 30 - pr merge and fixes and development of attedance app'

describe('the real four-day paste, with no model at all', () => {
  const reading = read(PASTE)

  it('finds all four days', () => {
    expect(reading.days.map((d) => d.day)).toEqual([
      '2026-08-30',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ])
  })

  it('reads Sep 3 as three entries totalling eight hours', () => {
    const day = reading.days.find((d) => d.day === '2026-09-03')!
    expect(day.entries.map((e) => e.minutes)).toEqual([240, 120, 120])
  })

  /* The bracketed comma in "(chamari, multi tenet)" split this into two
     fragments before splitItems tracked depth — the first with no duration at
     all, the second reading "multi tenet) 4h". */
  it('keeps a bracketed list inside its own entry', () => {
    const day = reading.days.find((d) => d.day === '2026-09-03')!
    expect(day.entries[0].note).toContain('chamari, multi tenet')
    expect(day.entries[0].minutes).toBe(240)
  })

  it('attributes the projects, misspellings and abbreviations included', () => {
    const sep3 = reading.days.find((d) => d.day === '2026-09-03')!
    expect(sep3.entries[0].appId).toBe('attendance')
    expect(sep3.entries[1].appId).toBe('attendance') // "SGX"
    expect(sep3.entries[2].appId).toBe('solarsim') // "Solar app"

    const sep2 = reading.days.find((d) => d.day === '2026-09-02')!
    expect(sep2.entries[0].appId).toBe('attendance') // "attendace app"
  })

  it('reads Sep 2 as three entries and categorises the meeting', () => {
    const day = reading.days.find((d) => d.day === '2026-09-02')!
    expect(day.entries.map((e) => e.minutes)).toEqual([240, 120, 120])
    expect(day.entries[1].category).toBe('meeting')
  })

  /* "sep 1 and aug 30 - …" is two days sharing one description. */
  it('gives both days of an "and" range the same work', () => {
    const sep1 = reading.days.find((d) => d.day === '2026-09-01')!
    const aug30 = reading.days.find((d) => d.day === '2026-08-30')!
    expect(sep1.note).toContain('pr merge')
    expect(aug30.note).toContain('pr merge')
  })

  /* The hours are what an invoice is built from. "pr merge and fixes" names no
     time, so it stays a note. */
  it('invents no hours for the days that named none', () => {
    expect(reading.days.find((d) => d.day === '2026-09-01')!.entries).toEqual([])
    expect(reading.days.find((d) => d.day === '2026-08-30')!.entries).toEqual([])
  })

  it('invents no score anywhere', () => {
    expect(reading.days.every((d) => d.percent === null)).toBe(true)
  })
})

describe('dates people write', () => {
  it('reads a day-first date', () => {
    expect(read('3 sep 2h standup').days[0].day).toBe('2026-09-03')
  })

  it('reads an ISO date', () => {
    expect(read('2026-09-02 2h standup').days[0].day).toBe('2026-09-02')
  })

  it('reads a weekday as the most recent one', () => {
    expect(read('monday 2h standup').days[0].day).toBe('2026-08-31')
  })

  it('reads yesterday as the last day before today', () => {
    expect(read('yesterday 2h standup').days[0].day).toBe('2026-09-03')
  })

  it('files an undated line against the newest day rather than losing it', () => {
    expect(read('2h reviewed the feeder model').days[0].day).toBe('2026-09-04')
  })

  /* A date outside the window is somebody logging further back than the box
     reaches. Reported, never silently dropped. */
  it('reports a date it cannot place', () => {
    const reading = read('mar 2 - 4h old work')
    expect(reading.unresolved).toContain('mar 2')
  })
})

describe('leave written in the day itself', () => {
  it('reads casual leave', () => {
    const day = read('sep 2 - casual leave').days[0]
    expect(day.absence?.kind).toBe('casual')
  })

  it('prefers the longer phrase', () => {
    expect(read('sep 2 - short leave, 4h fixes').days[0].absence?.kind).toBe('short_leave')
  })

  it('lets a half day still carry its hours', () => {
    const day = read('sep 2 - half day, 4h attendance app fixes').days[0]
    expect(day.absence?.kind).toBe('half_day')
    expect(day.entries).toHaveLength(1)
  })
})

describe('what it refuses to do', () => {
  it('reads nothing out of an empty paste', () => {
    expect(read('   ')).toEqual({ days: [], unresolved: [] })
  })

  it('never exceeds a day in one day', () => {
    const reading = read('sep 3 - 20h one, 10h two')
    const total = reading.days[0].entries.reduce((sum, e) => sum + e.minutes, 0)
    expect(total).toBeLessThanOrEqual(24 * 60)
  })

  it('merges a day named twice instead of losing half of it', () => {
    const reading = read('sep 3 - 2h morning, sep 3 - 3h afternoon')
    expect(reading.days).toHaveLength(1)
    expect(reading.days[0].entries.map((e) => e.minutes)).toEqual([120, 180])
  })

  it('proposes no task entries, which would claim hours against nothing', () => {
    const reading = read('sep 3 - 2h built the importer')
    expect(reading.days[0].entries.every((e) => e.category !== 'task')).toBe(true)
  })
})
