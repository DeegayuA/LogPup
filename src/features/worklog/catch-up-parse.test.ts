import { describe, expect, it } from 'vitest'
import {
  CATCH_UP_CATEGORIES,
  MAX_CATCH_UP_DAYS,
  MAX_ENTRIES_PER_DAY,
  buildCatchUpPrompt,
  looksLikeSeveralDays,
  readCatchUpReply,
  summarizeReading,
  type CatchUpCandidateDay,
} from '@/features/worklog/catch-up-parse'
import { ENTRY_MINUTES_MAX } from '@/features/worklog/entries'

const APP_A = '11111111-1111-4111-8111-111111111111'
const APP_B = '22222222-2222-4222-8222-222222222222'
const NOT_MINE = '99999999-9999-4999-8999-999999999999'

const DAYS: CatchUpCandidateDay[] = [
  { day: '2026-08-30', label: 'Sun 30 Aug', fraction: 0, logged: false },
  { day: '2026-09-01', label: 'Tue 1 Sep', fraction: 1, logged: false },
  { day: '2026-09-02', label: 'Wed 2 Sep', fraction: 1, logged: false },
  { day: '2026-09-03', label: 'Thu 3 Sep', fraction: 1, logged: false },
]

const fences = {
  allowedDays: new Set(DAYS.map((d) => d.day)),
  allowedAppIds: new Set([APP_A, APP_B]),
}

const reply = (body: unknown) => JSON.stringify(body)

describe('the prompt', () => {
  const prompt = buildCatchUpPrompt({
    name: 'Deeghayu',
    today: '2026-09-03',
    candidateDays: DAYS,
    apps: [
      { id: APP_A, name: 'Attendance Web App' },
      { id: APP_B, name: 'Solar Monitoring' },
    ],
    text: 'sep 3 - attendance app fixes 4h',
  })

  it('lists every candidate day with its ISO date', () => {
    for (const day of DAYS) expect(prompt).toContain(day.day)
  })

  it('names projects by id, because the id is the fence', () => {
    expect(prompt).toContain(APP_A)
    expect(prompt).toContain('Attendance Web App')
  })

  /* The paste is somebody's own writing and could contain anything, including
     text shaped like instructions. It is fenced between markers and introduced
     as what they wrote, never spliced into the rule list. */
  it('quotes what the person wrote inside markers', () => {
    expect(prompt).toContain('<<<')
    expect(prompt).toContain('sep 3 - attendance app fixes 4h')
    expect(prompt).toContain('>>>')
  })

  it('offers no category that would need a task id', () => {
    expect(CATCH_UP_CATEGORIES).not.toContain('task')
    expect(prompt).not.toContain('taskId')
  })

  it('says in as many words that it may not invent hours or a score', () => {
    expect(prompt).toContain('NEVER INVENT A DURATION')
    expect(prompt).toContain('NEVER INVENT A SCORE')
  })

  it('offers the leave kinds a person may declare, and not the ones filed for them', () => {
    expect(prompt).toContain('casual')
    expect(prompt).toContain('half_day')
    expect(prompt).toContain('short_leave')
    expect(prompt).not.toContain('no_work_assigned')
  })
})

describe('reading the four days back', () => {
  /* The paragraph this whole feature exists for, as the model would return it. */
  const reading = readCatchUpReply(
    reply({
      days: [
        {
          day: '2026-09-03',
          note: 'attendance app fixes (chamari, multi tenet), ML model for SGX, Solar bug fixes',
          percent: null,
          absence: null,
          entries: [
            { minutes: 240, category: 'other', appId: APP_A, note: 'fixes (chamari, multi tenet)' },
            { minutes: 120, category: 'other', appId: null, note: 'ML model for SGX' },
            { minutes: 120, category: 'support', appId: APP_B, note: 'bug fixes' },
          ],
        },
        {
          day: '2026-09-02',
          note: 'fixes, monthly meeting, documenting',
          percent: null,
          absence: null,
          entries: [
            { minutes: 240, category: 'other', appId: APP_A, note: 'fixes' },
            { minutes: 120, category: 'meeting', appId: null, note: 'monthly meeting' },
            { minutes: 120, category: 'admin', appId: null, note: 'documenting' },
          ],
        },
        {
          day: '2026-09-01',
          note: 'pr merge and fixes and development of attendance app',
          percent: null,
          absence: null,
          entries: [],
        },
        {
          day: '2026-08-30',
          note: 'pr merge and fixes and development of attendance app',
          percent: null,
          absence: null,
          entries: [],
        },
      ],
      unresolved: ['SGX'],
    }),
    fences,
  )

  it('finds all four days', () => {
    expect(reading.days.map((d) => d.day)).toEqual([
      '2026-08-30',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ])
  })

  /* The days written as "sep 1 and aug 30 - pr merge and fixes" carry no time
     at all. Two invented hours each would be four hours nobody worked, on the
     record they are paid against. */
  it('leaves a day with no stated time as a note and no entries', () => {
    const sep1 = reading.days.find((d) => d.day === '2026-09-01')
    expect(sep1?.entries).toEqual([])
    expect(sep1?.note).toContain('pr merge')
  })

  it('scores nothing the person did not score', () => {
    expect(reading.days.every((d) => d.percent === null)).toBe(true)
  })

  it('reports what it could not place instead of dropping it', () => {
    expect(reading.unresolved).toEqual(['SGX'])
  })

  it('adds up for the review panel', () => {
    expect(summarizeReading(reading)).toEqual({
      days: 4,
      minutes: 960,
      entries: 6,
      absences: 0,
      scored: 0,
    })
  })
})

describe('the day fence', () => {
  it('drops a day it was never offered', () => {
    const reading = readCatchUpReply(
      reply({
        days: [
          { day: '2027-09-03', note: 'next year', percent: null, absence: null, entries: [] },
          { day: '2026-09-03', note: 'this one', percent: null, absence: null, entries: [] },
        ],
      }),
      fences,
    )
    expect(reading.days.map((d) => d.day)).toEqual(['2026-09-03'])
  })

  it('keeps the first of two objects for the same day', () => {
    const reading = readCatchUpReply(
      reply({
        days: [
          { day: '2026-09-03', note: 'first', percent: null, absence: null, entries: [] },
          { day: '2026-09-03', note: 'second', percent: 100, absence: null, entries: [] },
        ],
      }),
      fences,
    )
    expect(reading.days).toHaveLength(1)
    expect(reading.days[0].note).toBe('first')
  })

  it('caps how many days one paste can carry', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      day: '2026-09-03',
      note: `n${i}`,
      percent: null,
      absence: null,
      entries: [],
    }))
    expect(readCatchUpReply(reply({ days: many }), fences).days.length).toBeLessThanOrEqual(
      MAX_CATCH_UP_DAYS,
    )
  })
})

describe('the project fence', () => {
  /* The failure this exists for is not a broken foreign key — it is a
     CONFIDENT MISMATCH landing somebody's four hours on a project they have
     never touched, with nothing in the row to say it was a guess. */
  it('keeps the entry but forgets a project it was not shown', () => {
    const reading = readCatchUpReply(
      reply({
        days: [
          {
            day: '2026-09-03',
            note: null,
            percent: null,
            absence: null,
            entries: [{ minutes: 240, category: 'other', appId: NOT_MINE, note: 'fixes' }],
          },
        ],
      }),
      fences,
    )
    expect(reading.days[0].entries).toEqual([
      { minutes: 240, category: 'other', appId: null, note: 'fixes' },
    ])
  })
})

describe('what an entry has to be to survive', () => {
  const one = (entry: unknown) =>
    readCatchUpReply(
      reply({
        days: [{ day: '2026-09-03', note: 'x', percent: null, absence: null, entries: [entry] }],
      }),
      fences,
    ).days[0]?.entries ?? []

  it('drops a task row, which would claim hours against nothing', () => {
    expect(one({ minutes: 60, category: 'task', appId: APP_A, note: 'x' })).toEqual([])
  })

  it('drops a category that is not a category', () => {
    expect(one({ minutes: 60, category: 'vibes', appId: null, note: 'x' })).toEqual([])
  })

  it('drops an entry with no minutes at all', () => {
    expect(one({ category: 'other', appId: APP_A, note: 'x' })).toEqual([])
  })

  it('drops a zero-minute entry', () => {
    expect(one({ minutes: 0, category: 'other', appId: null, note: 'x' })).toEqual([])
  })

  it('rounds a fractional minute rather than losing the row', () => {
    expect(one({ minutes: 92.5, category: 'other', appId: null, note: 'x' })[0].minutes).toBe(93)
  })

  it('never lets one day exceed a day', () => {
    const reading = readCatchUpReply(
      reply({
        days: [
          {
            day: '2026-09-03',
            note: null,
            percent: null,
            absence: null,
            entries: [
              { minutes: ENTRY_MINUTES_MAX, category: 'other', appId: null, note: 'all of it' },
              { minutes: 60, category: 'other', appId: null, note: 'and one more' },
            ],
          },
        ],
      }),
      fences,
    )
    const total = reading.days[0].entries.reduce((sum, e) => sum + e.minutes, 0)
    expect(total).toBeLessThanOrEqual(ENTRY_MINUTES_MAX)
    expect(reading.days[0].entries).toHaveLength(1)
  })

  it('caps the rows on one day', () => {
    const entries = Array.from({ length: 20 }, () => ({
      minutes: 30,
      category: 'other',
      appId: null,
      note: 'x',
    }))
    const reading = readCatchUpReply(
      reply({ days: [{ day: '2026-09-03', note: null, percent: null, absence: null, entries }] }),
      fences,
    )
    expect(reading.days[0].entries.length).toBeLessThanOrEqual(MAX_ENTRIES_PER_DAY)
  })

  it('keeps the good rows when one beside them is malformed', () => {
    const reading = readCatchUpReply(
      reply({
        days: [
          {
            day: '2026-09-03',
            note: null,
            percent: null,
            absence: null,
            entries: [
              { minutes: 60, category: 'other', appId: APP_A, note: 'good' },
              'not an object',
              { minutes: 60, category: 'meeting', appId: null, note: 'also good' },
            ],
          },
        ],
      }),
      fences,
    )
    expect(reading.days[0].entries.map((e) => e.note)).toEqual(['good', 'also good'])
  })
})

describe('leave read out of the text', () => {
  it('proposes a self-declarable kind', () => {
    const reading = readCatchUpReply(
      reply({
        days: [
          {
            day: '2026-09-02',
            note: null,
            percent: null,
            absence: { kind: 'casual', reason: 'family thing' },
            entries: [],
          },
        ],
      }),
      fences,
    )
    expect(reading.days[0].absence).toEqual({ kind: 'casual', reason: 'family thing' })
  })

  /* 'no_work_assigned' is a statement about the studio failing to give somebody
     work. A model filing it on their behalf turns a grievance into a form field
     they never filled in. */
  it('refuses a kind only an admin may file', () => {
    const reading = readCatchUpReply(
      reply({
        days: [
          {
            day: '2026-09-02',
            note: 'quiet day',
            percent: null,
            absence: { kind: 'no_work_assigned', reason: null },
            entries: [],
          },
        ],
      }),
      fences,
    )
    expect(reading.days[0].absence).toBeNull()
  })

  it('lets a half day carry hours as well, because half of it was worked', () => {
    const reading = readCatchUpReply(
      reply({
        days: [
          {
            day: '2026-09-02',
            note: 'half day, dentist',
            percent: null,
            absence: { kind: 'half_day', reason: null },
            entries: [{ minutes: 240, category: 'other', appId: APP_A, note: 'morning' }],
          },
        ],
      }),
      fences,
    )
    expect(reading.days[0].absence?.kind).toBe('half_day')
    expect(reading.days[0].entries).toHaveLength(1)
  })
})

describe('which reader the box should offer', () => {
  /* The paragraph at the top of catch-up-parse.ts, which is what started all
     of this. If this one is read as a single line, the box keeps the last
     fragment and silently loses three days of somebody's work. */
  it('recognises the four-day paste', () => {
    expect(
      looksLikeSeveralDays(
        'sep 3 - attendance app fixes (chamari, multi tenet) 4h, ML model for SGX 2h, ' +
          'bug fixes in Solar app 2h, sep 2 - fixes in attendace app 4h, monthly meeting 2h, ' +
          'documenting 2h, sep 1 and aug 30 - pr merge and fixes and development of attedance app',
      ),
    ).toBe(true)
  })

  it('recognises a single date on its own', () => {
    expect(looksLikeSeveralDays('sep 2 fixes 4h')).toBe(true)
    expect(looksLikeSeveralDays('2026-09-02 fixes 4h')).toBe(true)
    expect(looksLikeSeveralDays('yesterday I finished the migration')).toBe(true)
    expect(looksLikeSeveralDays('monday standup 1h')).toBe(true)
  })

  it('recognises a line break', () => {
    expect(looksLikeSeveralDays('fixes 4h\nmeeting 2h')).toBe(true)
  })

  /* Paying a model to read what a regex reads instantly and for free, and
     making somebody wait for it, is the failure on this side. */
  it('leaves one ordinary line to the instant reader', () => {
    expect(looksLikeSeveralDays('80% 2h reviewed the feeder model for SCADA')).toBe(false)
    expect(looksLikeSeveralDays('4h attendance app fixes')).toBe(false)
    expect(looksLikeSeveralDays('')).toBe(false)
    expect(looksLikeSeveralDays('   ')).toBe(false)
  })

  /* "may" is a month and an ordinary English verb. It only counts as a date
     when a number follows it, which is what the pattern requires. */
  it('does not mistake an ordinary sentence for a date', () => {
    expect(looksLikeSeveralDays('2h may need another pass on the parser')).toBe(false)
    expect(looksLikeSeveralDays('1h marked the decision as final')).toBe(false)
  })
})

describe('a reply that is not a reply', () => {
  it('reads nothing out of prose', () => {
    expect(readCatchUpReply('I could not do that', fences)).toEqual({ days: [], unresolved: [] })
  })

  it('reads nothing out of an empty object', () => {
    expect(readCatchUpReply('{}', fences)).toEqual({ days: [], unresolved: [] })
  })

  it('drops a day object that says nothing at all', () => {
    const reading = readCatchUpReply(
      reply({
        days: [{ day: '2026-09-03', note: null, percent: null, absence: null, entries: [] }],
      }),
      fences,
    )
    expect(reading.days).toEqual([])
  })

  it('ignores a percent outside 0–100 rather than clamping it', () => {
    const reading = readCatchUpReply(
      reply({ days: [{ day: '2026-09-03', note: 'x', percent: 900, absence: null, entries: [] }] }),
      fences,
    )
    expect(reading.days[0].percent).toBeNull()
  })

  it('snaps a percent to the score control steps', () => {
    const reading = readCatchUpReply(
      reply({ days: [{ day: '2026-09-03', note: 'x', percent: 62, absence: null, entries: [] }] }),
      fences,
    )
    expect(reading.days[0].percent).toBe(60)
  })
})
