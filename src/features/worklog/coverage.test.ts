import { describe, expect, it } from 'vitest'
import { computeCoverage, formatCoverage, type CoverageInput } from '@/features/worklog/coverage'

// A 3.5-day week: Mon/Wed/Fri whole, Saturday half, Tue/Thu/Sun none.
const PART_TIME = { mon: 1, tue: 0, wed: 1, thu: 0, fri: 1, sat: 0.5, sun: 0 }
// 2026-04-13 and -14 are gazetted (lk-holidays.ts); -14 is also an org holiday,
// so the fixture proves a day that is both is still counted once.
const HOLIDAYS = new Set(['2026-04-13', '2026-04-14'])

const input = (over: Partial<CoverageInput> = {}): CoverageInput => ({
  from: '2026-04-06',
  to: '2026-04-20',
  loggedDays: new Set(['2026-04-08', '2026-04-10', '2026-04-17', '2026-04-18']),
  exemptDays: new Set(['2026-04-15']),
  isHoliday: (iso) => HOLIDAYS.has(iso),
  patternFor: () => PART_TIME,
  joinedOn: '2026-04-08',
  today: '2026-04-19',
  ...over,
})

const statusOf = (s: ReturnType<typeof computeCoverage>, day: string) =>
  s.days.find((d) => d.day === day)?.status

describe('computeCoverage', () => {
  it('gives every day in the window exactly one status', () => {
    const s = computeCoverage(input())
    expect(s.days).toHaveLength(14)
    expect(statusOf(s, '2026-04-06')).toBe('not-yet-due') // scheduled, but before the join date
    expect(statusOf(s, '2026-04-07')).toBe('not-yet-due')
    expect(statusOf(s, '2026-04-08')).toBe('logged')
    expect(statusOf(s, '2026-04-09')).toBe('off') // Thursday, pattern 0
    expect(statusOf(s, '2026-04-10')).toBe('logged')
    expect(statusOf(s, '2026-04-11')).toBe('missing') // Saturday half day, not logged
    expect(statusOf(s, '2026-04-12')).toBe('off') // Sunday
    expect(statusOf(s, '2026-04-13')).toBe('off') // holiday beats a full pattern day
    expect(statusOf(s, '2026-04-14')).toBe('off') // gazetted AND org holiday, counted once
    expect(statusOf(s, '2026-04-15')).toBe('exempt') // approved leave
    expect(statusOf(s, '2026-04-16')).toBe('off')
    expect(statusOf(s, '2026-04-17')).toBe('logged')
    expect(statusOf(s, '2026-04-18')).toBe('logged') // Saturday, logged
    expect(statusOf(s, '2026-04-19')).toBe('not-yet-due') // today: rule 2 beats rule 4
  })

  it('counts half days as 0.5 on BOTH sides of the ratio', () => {
    const s = computeCoverage(input())
    expect(s.expected).toBe(4) // 1 + 1 + 0.5 missing Sat + 1 + 0.5 logged Sat
    expect(s.logged).toBe(3.5)
    expect(s.missing).toBe(0.5)
    expect(s.exempt).toBe(1)
    expect(s.off).toBe(5)
    expect(s.notYetDue).toBe(3)
    expect(s.extra).toBe(0)
  })

  it('holds expected === logged + missing', () => {
    const s = computeCoverage(input())
    expect(s.expected).toBe(s.logged + s.missing)
  })

  it('never counts an exempt day against the person', () => {
    // The same window without the approved absence: that day becomes a miss
    // and joins the denominator. This difference IS the feature.
    const s = computeCoverage(input({ exemptDays: new Set() }))
    expect(statusOf(s, '2026-04-15')).toBe('missing')
    expect(s.expected).toBe(5)
    expect(s.missing).toBe(1.5)
  })

  it('does not let a log on an unowed day inflate the denominator', () => {
    const s = computeCoverage(input({
      loggedDays: new Set(['2026-04-08', '2026-04-10', '2026-04-17', '2026-04-18', '2026-04-12']),
    }))
    expect(statusOf(s, '2026-04-12')).toBe('logged') // logged outranks off
    expect(s.extra).toBe(1)
    expect(s.expected).toBe(4) // unchanged
  })

  it('counts work done during approved leave as work, not as leave', () => {
    const s = computeCoverage(input({
      loggedDays: new Set(['2026-04-08', '2026-04-10', '2026-04-15', '2026-04-17', '2026-04-18']),
    }))
    expect(statusOf(s, '2026-04-15')).toBe('logged')
    expect(s.extra).toBe(1)
    expect(s.exempt).toBe(0)
  })

  it('stops expecting work from a departed person', () => {
    // Offboarding closes the open schedule row, so patternFor returns all
    // zeros afterwards. A leaver who still reads 0/20 every month makes every
    // org-health number wrong.
    const ALL_ZERO = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }
    const s = computeCoverage(input({
      patternFor: (iso) => (iso >= '2026-04-15' ? ALL_ZERO : PART_TIME),
    }))
    expect(s.days.filter((d) => d.day >= '2026-04-15' && d.status === 'missing')).toHaveLength(0)
  })

  it('treats an empty window as empty rather than throwing', () => {
    const s = computeCoverage(input({ from: '2026-04-06', to: '2026-04-06' }))
    expect(s.days).toHaveLength(0)
    expect(s.expected).toBe(0)
  })
})

describe('a supervisory seat', () => {
  // A tech lead who assigns and monitors produces no worklog rows. Reporting
  // them 'missing' every working day is both false and poisonous: one wrong
  // row drags every org-level coverage number with it.
  const supervisory = () => computeCoverage(input({ logsWork: false }))

  it('owes nothing, on every day, without claiming they are not working', () => {
    const s = supervisory()
    // 'logged' still appears — a supervisory person who files a log has it
    // counted. What must never appear is 'missing'.
    const allowed = new Set(['not-required', 'not-yet-due', 'logged'])
    expect(s.days.every((d) => allowed.has(d.status))).toBe(true)
    expect(s.days.some((d) => d.status === 'missing')).toBe(false)
    // 'off' would claim nobody works that day. They work; they do not log.
    expect(s.days.some((d) => d.status === 'off')).toBe(false)
  })

  it('has an empty denominator rather than a zero one', () => {
    const s = supervisory()
    expect(s.expected).toBe(0)
    expect(s.missing).toBe(0)
  })

  it('says so in words instead of rendering 0/0', () => {
    expect(formatCoverage(supervisory())).toBe('Not required to log')
  })

  it('still counts a log they file anyway', () => {
    const s = supervisory()
    expect(s.extra).toBeGreaterThan(0)
    expect(s.days.find((d) => d.day === '2026-04-08')?.status).toBe('logged')
  })

  it('leaves a normal person completely unchanged', () => {
    // logsWork defaults true, so every existing caller behaves as before.
    expect(computeCoverage(input()).expected).toBe(4)
  })
})

describe('formatCoverage', () => {
  it('always shows numerator and denominator', () => {
    expect(formatCoverage(computeCoverage(input())))
      .toBe('3.5/4 expected days logged · 1 exempt')
  })

  it('strips a trailing .0 but keeps a real half', () => {
    const whole = computeCoverage(input({
      patternFor: () => ({ mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 0, sun: 0 }),
    }))
    expect(formatCoverage(whole)).not.toMatch(/\.0/)
  })

  it('names extra logs when there are any', () => {
    const s = computeCoverage(input({
      loggedDays: new Set(['2026-04-08', '2026-04-10', '2026-04-17', '2026-04-18', '2026-04-12']),
    }))
    expect(formatCoverage(s)).toContain('1 extra')
  })

  it('never renders a bare percentage', () => {
    expect(formatCoverage(computeCoverage(input()))).not.toContain('%')
  })
})
