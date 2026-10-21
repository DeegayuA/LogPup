import { describe, expect, it } from 'vitest'
import {
  assembleWorklogDays,
  groupByUser,
  parseWorklogBatchBody,
  parseWorklogParams,
  type WorklogEntryInput,
  type WorklogHeaderInput,
} from './worklog'

const entry = (over: Partial<WorklogEntryInput>): WorklogEntryInput => ({
  id: 'e1',
  day: '2026-10-20',
  minutes: 60,
  category: 'task',
  billable: false,
  note: null,
  taskId: null,
  taskTitle: null,
  appName: null,
  appSlug: null,
  ...over,
})
const header = (over: Partial<WorklogHeaderInput>): WorklogHeaderInput => ({
  day: '2026-10-20',
  percent: 100,
  scoreSource: 'self',
  note: null,
  ...over,
})

describe('assembleWorklogDays', () => {
  it('joins a day header with its entries and totals the minutes', () => {
    const days = assembleWorklogDays(
      [header({ note: 'attendance app issues' })],
      [entry({ id: 'a', minutes: 120 }), entry({ id: 'b', minutes: 120, appName: 'Attendance Web App', appSlug: 'attendance' })],
    )
    expect(days).toHaveLength(1)
    expect(days[0]).toMatchObject({ day: '2026-10-20', percent: 100, note: 'attendance app issues', minutes: 240 })
    expect(days[0].entries.map((e) => e.id)).toEqual(['a', 'b'])
    expect(days[0].entries[1].app).toEqual({ name: 'Attendance Web App', slug: 'attendance' })
  })

  // Logging time never requires the header row (schema comment on worklog_entries), and a day can
  // be scored with no entries — both must appear.
  it('keeps a day that has only entries, and a day that has only a header', () => {
    const days = assembleWorklogDays([header({ day: '2026-10-19' })], [entry({ day: '2026-10-18' })])
    expect(days.map((d) => d.day)).toEqual(['2026-10-19', '2026-10-18'])
    expect(days.find((d) => d.day === '2026-10-18')).toMatchObject({ percent: null, scoreSource: null, minutes: 60 })
    expect(days.find((d) => d.day === '2026-10-19')).toMatchObject({ minutes: 0, entries: [] })
  })

  it('lists days newest first', () => {
    const days = assembleWorklogDays([header({ day: '2026-10-01' }), header({ day: '2026-10-15' })], [])
    expect(days.map((d) => d.day)).toEqual(['2026-10-15', '2026-10-01'])
  })

  it('names the task when time was booked to one', () => {
    const [day] = assembleWorklogDays([], [entry({ taskId: 't1', taskTitle: 'Fix gauge' })])
    expect(day.entries[0].task).toEqual({ id: 't1', title: 'Fix gauge' })
  })
})

describe('parseWorklogParams', () => {
  const p = (q: string) => parseWorklogParams(new URLSearchParams(q))

  it('accepts a valid range and normalises the email', () => {
    expect(p('email=%20A@Gmail.com&from=2026-10-01&to=2026-10-31')).toEqual({
      ok: true,
      email: 'a@gmail.com',
      from: '2026-10-01',
      to: '2026-10-31',
    })
  })

  it('refuses a missing or malformed date', () => {
    expect(p('email=a@b.c&from=2026-10-01').ok).toBe(false)
    expect(p('email=a@b.c&from=2026-10-1&to=2026-10-31').ok).toBe(false)
    expect(p('email=a@b.c&from=2026-13-01&to=2026-10-31').ok).toBe(false)
    expect(p('email=a@b.c&from=2026-02-01&to=2026-02-31').ok).toBe(false)
  })

  it('refuses a reversed range', () => {
    expect(p('email=a@b.c&from=2026-10-31&to=2026-10-01').ok).toBe(false)
  })

  // Bounded so one request can never become a full history scan.
  it('refuses a range longer than 62 days', () => {
    expect(p('email=a@b.c&from=2026-01-01&to=2026-03-15').ok).toBe(false)
    expect(p('email=a@b.c&from=2026-09-01&to=2026-10-31').ok).toBe(true)
  })
})

describe('parseWorklogBatchBody', () => {
  const ok = { emails: ['A@x.com', 'b@x.com'], from: '2026-10-01', to: '2026-10-31' }

  it('normalises and de-duplicates emails, keeping first-seen order', () => {
    const r = parseWorklogBatchBody({ ...ok, emails: [' A@x.com', 'b@x.com', 'a@X.com'] })
    expect(r).toEqual({ ok: true, emails: ['a@x.com', 'b@x.com'], from: '2026-10-01', to: '2026-10-31' })
  })

  it('drops non-strings and blanks rather than failing the batch', () => {
    const r = parseWorklogBatchBody({ ...ok, emails: ['a@x.com', 7, null, '  '] })
    expect(r.ok && r.emails).toEqual(['a@x.com'])
  })

  it('applies the same date rules as the single-person endpoint', () => {
    expect(parseWorklogBatchBody({ ...ok, from: '2026-02-31' }).ok).toBe(false)
    expect(parseWorklogBatchBody({ ...ok, from: '2026-10-31', to: '2026-10-01' }).ok).toBe(false)
    expect(parseWorklogBatchBody({ ...ok, from: '2026-01-01', to: '2026-03-15' }).ok).toBe(false)
  })

  it('refuses a missing email list, an empty one, and more than 500', () => {
    expect(parseWorklogBatchBody({ from: ok.from, to: ok.to }).ok).toBe(false)
    expect(parseWorklogBatchBody({ ...ok, emails: [] }).ok).toBe(false)
    const many = Array.from({ length: 501 }, (_, i) => `p${i}@x.com`)
    expect(parseWorklogBatchBody({ ...ok, emails: many }).ok).toBe(false)
  })

  it('refuses a body that is not an object', () => {
    expect(parseWorklogBatchBody(null).ok).toBe(false)
    expect(parseWorklogBatchBody('x').ok).toBe(false)
  })
})

describe('groupByUser', () => {
  it('buckets rows by userId and gives an empty list to a user with none', () => {
    const m = groupByUser(['u1', 'u2'], [{ userId: 'u1', v: 1 }, { userId: 'u1', v: 2 }])
    expect(m.get('u1')?.map((r) => r.v)).toEqual([1, 2])
    expect(m.get('u2')).toEqual([])
  })
})
