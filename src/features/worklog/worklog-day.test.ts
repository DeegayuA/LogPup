import { describe, expect, it } from 'vitest'
import { isFutureWorkDay, resolveWorkDay, summarizeWorklogs, worklogDaysBack } from './worklog-day'

describe('resolveWorkDay', () => {
  it('uses the Colombo calendar day, not UTC', () => {
    // 19:30Z is 01:00 the NEXT day in Asia/Colombo (+05:30). A UTC-derived
    // day would file this under the 13th, which is the bug this exists to
    // prevent — people log at the end of their evening.
    expect(resolveWorkDay(new Date('2026-08-13T19:30:00Z'))).toBe('2026-08-14')
  })

  it('keeps a mid-morning Colombo time on the same day', () => {
    expect(resolveWorkDay(new Date('2026-08-13T04:30:00Z'))).toBe('2026-08-13')
  })
})

describe('isFutureWorkDay', () => {
  it('rejects tomorrow', () => {
    expect(isFutureWorkDay('2026-08-15', new Date('2026-08-13T04:30:00Z'))).toBe(true)
  })

  it('accepts today and the past', () => {
    const now = new Date('2026-08-13T04:30:00Z')
    expect(isFutureWorkDay('2026-08-13', now)).toBe(false)
    expect(isFutureWorkDay('2026-08-01', now)).toBe(false)
  })
})

describe('worklogDaysBack', () => {
  it('starts at today and walks backwards', () => {
    const days = worklogDaysBack(3, new Date('2026-08-13T04:30:00Z'))
    expect(days).toEqual(['2026-08-13', '2026-08-12', '2026-08-11'])
  })

  it('crosses a month boundary correctly', () => {
    const days = worklogDaysBack(2, new Date('2026-08-01T04:30:00Z'))
    expect(days).toEqual(['2026-08-01', '2026-07-31'])
  })
})

describe('summarizeWorklogs', () => {
  it('averages only the days that were logged', () => {
    const out = summarizeWorklogs([{ percent: 80 }, { percent: 60 }])
    expect(out.logged).toBe(2)
    expect(out.averagePercent).toBe(70)
  })

  it('reports no average when nothing is logged', () => {
    expect(summarizeWorklogs([]).averagePercent).toBeNull()
    expect(summarizeWorklogs([]).logged).toBe(0)
  })

  it('rounds to a whole percent', () => {
    expect(summarizeWorklogs([{ percent: 80 }, { percent: 75 }]).averagePercent).toBe(78)
  })
})
