import { describe, it, expect } from 'vitest'
import {
  buildActionList,
  dueStatus,
  followupAge,
  glanceFromIntel,
  isSameNoteText,
  parseSpokenDueDate,
  reconcileActionItems,
} from './meeting-notes-model'

const now = new Date('2026-08-12T10:00:00')

describe('parseSpokenDueDate', () => {
  it('reads ISO dates, with or without a time', () => {
    expect(parseSpokenDueDate('2026-08-20')?.getFullYear()).toBe(2026)
    expect(parseSpokenDueDate('2026-08-20')?.getMonth()).toBe(7)
    expect(parseSpokenDueDate('2026-08-20')?.getDate()).toBe(20)
    expect(parseSpokenDueDate('2026-08-20T17:00:00Z')?.getDate()).toBe(20)
  })

  it('reads written-out dates that carry a year', () => {
    expect(parseSpokenDueDate('August 20, 2026')?.getDate()).toBe(20)
    expect(parseSpokenDueDate('Aug 20, 2026')?.getMonth()).toBe(7)
    expect(parseSpokenDueDate('20 August 2026')?.getDate()).toBe(20)
    expect(parseSpokenDueDate('Aug 20 2026.')?.getDate()).toBe(20)
  })

  it('refuses spoken phrases rather than guessing a day', () => {
    expect(parseSpokenDueDate('next Friday')).toBeNull()
    expect(parseSpokenDueDate('end of the month')).toBeNull()
    expect(parseSpokenDueDate('before the client call')).toBeNull()
    expect(parseSpokenDueDate('ASAP')).toBeNull()
  })

  it('refuses ambiguous all-numeric dates', () => {
    // 03/04/2026 is March 4th or April 3rd depending on who said it.
    expect(parseSpokenDueDate('03/04/2026')).toBeNull()
    expect(parseSpokenDueDate('3.4.2026')).toBeNull()
  })

  it('refuses a date with no year', () => {
    expect(parseSpokenDueDate('Aug 20')).toBeNull()
  })

  it('treats blank and missing values as no date', () => {
    expect(parseSpokenDueDate('')).toBeNull()
    expect(parseSpokenDueDate('   ')).toBeNull()
    expect(parseSpokenDueDate(null)).toBeNull()
    expect(parseSpokenDueDate(undefined)).toBeNull()
  })

  it('rejects an impossible calendar date', () => {
    expect(parseSpokenDueDate('2026-02-31')).toBeNull()
  })
})

describe('dueStatus', () => {
  it('classifies real dates around today', () => {
    expect(dueStatus('2026-08-10', now)).toBe('overdue')
    expect(dueStatus('2026-08-12', now)).toBe('today')
    expect(dueStatus('2026-08-14', now)).toBe('soon')
    expect(dueStatus('2026-08-25', now)).toBe('scheduled')
  })

  it('counts a due date earlier today as due today, not overdue', () => {
    expect(dueStatus('2026-08-12T08:00:00', now)).toBe('today')
  })

  it('separates "we could not read it" from "there is no date"', () => {
    expect(dueStatus('sometime next sprint', now)).toBe('unparsed')
    expect(dueStatus(null, now)).toBe('unscheduled')
    expect(dueStatus('', now)).toBe('unscheduled')
  })
})

describe('buildActionList', () => {
  it('merges the deadline and the per-person item that describe one commitment', () => {
    const rows = buildActionList(
      {
        deadlines: [{ item: 'Send the revised quote.', owner: '', due: '2026-08-20' }],
        perPerson: [{ name: 'Nadeesha', points: ['…'], actionItems: ['send the revised quote'] }],
      },
      now,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      text: 'Send the revised quote.',
      owner: 'Nadeesha',
      due: '2026-08-20',
      status: 'scheduled',
    })
  })

  it('keeps items that exist in only one of the two sources', () => {
    const rows = buildActionList(
      {
        deadlines: [{ item: 'Ship v2', owner: 'Kasun', due: '2026-08-25' }],
        perPerson: [{ name: 'Amali', points: [], actionItems: ['Book the room'] }],
      },
      now,
    )
    expect(rows.map((r) => [r.text, r.owner, r.status])).toEqual([
      ['Ship v2', 'Kasun', 'scheduled'],
      ['Book the room', 'Amali', 'unscheduled'],
    ])
  })

  it('orders by urgency: overdue, today, soon, dated, then undated', () => {
    const rows = buildActionList(
      {
        deadlines: [
          { item: 'Later', owner: 'A', due: '2026-09-30' },
          { item: 'Overdue', owner: 'B', due: '2026-08-01' },
          { item: 'Soon', owner: 'C', due: '2026-08-14' },
          { item: 'Today', owner: 'D', due: '2026-08-12' },
          { item: 'Phrase', owner: 'E', due: 'when the client replies' },
        ],
        perPerson: [{ name: 'F', points: [], actionItems: ['No date at all'] }],
      },
      now,
    )
    expect(rows.map((r) => r.text)).toEqual([
      'Overdue',
      'Today',
      'Soon',
      'Later',
      'Phrase',
      'No date at all',
    ])
  })

  it('sorts equally-ranked dated rows by their date', () => {
    const rows = buildActionList(
      {
        deadlines: [
          { item: 'Second', owner: 'A', due: '2026-09-30' },
          { item: 'First', owner: 'B', due: '2026-08-25' },
        ],
        perPerson: [],
      },
      now,
    )
    expect(rows.map((r) => r.text)).toEqual(['First', 'Second'])
  })

  it('does not let a second mention blank an owner or a date it already has', () => {
    const rows = buildActionList(
      {
        deadlines: [{ item: 'Fix the lighting', owner: 'Ruwan', due: '2026-08-20' }],
        perPerson: [{ name: 'Ruwan', points: [], actionItems: ['Fix the lighting'] }],
      },
      now,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].owner).toBe('Ruwan')
    expect(rows[0].due).toBe('2026-08-20')
  })

  it('joins a spoken first name to the full name the model used elsewhere', () => {
    const rows = buildActionList(
      {
        deadlines: [{ item: 'Send the deck', owner: 'Nadeesha', due: '2026-08-20' }],
        perPerson: [
          { name: 'Nadeesha Perera', points: [], actionItems: ['Send the deck'] },
        ],
      },
      now,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ owner: 'Nadeesha', due: '2026-08-20' })
  })

  it('keeps two people who were handed the same-worded job as two rows', () => {
    // The failure this guards: merging on text alone deleted one of the two
    // assignments outright, so a person walked away not knowing they owed it.
    const rows = buildActionList(
      {
        deadlines: [{ item: 'Update the status doc', owner: 'Ruwan', due: '2026-08-20' }],
        perPerson: [
          { name: 'Amali', points: [], actionItems: ['Update the status doc'] },
        ],
      },
      now,
    )
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => [row.owner, row.due])).toEqual([
      ['Ruwan', '2026-08-20'],
      ['Amali', null],
    ])
    // Distinct React keys, or the second row would be dropped from the DOM.
    expect(new Set(rows.map((row) => row.key)).size).toBe(2)
  })

  it('does not treat two similar first names as the same person', () => {
    const rows = buildActionList(
      {
        deadlines: [{ item: 'Call the vendor', owner: 'Amal', due: '2026-08-20' }],
        perPerson: [{ name: 'Kamal', points: [], actionItems: ['Call the vendor'] }],
      },
      now,
    )
    expect(rows).toHaveLength(2)
  })

  it('drops empty text and empty owners', () => {
    const rows = buildActionList(
      {
        deadlines: [{ item: '   ', owner: 'A', due: '2026-08-20' }],
        perPerson: [{ name: '  ', points: [], actionItems: ['Real item'] }],
      },
      now,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ text: 'Real item', owner: null })
  })

  it('returns nothing for notes with no commitments', () => {
    expect(buildActionList({ deadlines: [], perPerson: [] }, now)).toEqual([])
  })
})

describe('reconcileActionItems', () => {
  const rows = buildActionList(
    {
      deadlines: [{ item: 'Send the revised quote to the client', owner: 'Nadeesha', due: '2026-08-20' }],
      perPerson: [{ name: 'Kasun', points: [], actionItems: ['Book the venue for the launch'] }],
    },
    now,
  )

  it('treats an item with a matching suggestion as tracked, not untracked', () => {
    const { tracked, untracked } = reconcileActionItems(rows, [
      { id: 's1', text: 'Send the revised quote to the client' },
      { id: 's2', text: 'Book the venue for the launch' },
    ])
    expect(tracked.map((r) => r.text)).toEqual([
      'Send the revised quote to the client',
      'Book the venue for the launch',
    ])
    expect(untracked).toEqual([])
  })

  it('surfaces an item with no matching suggestion as untracked', () => {
    const { tracked, untracked } = reconcileActionItems(rows, [{ id: 's1', text: 'Completely unrelated thing' }])
    expect(tracked).toEqual([])
    expect(untracked.map((r) => r.text)).toEqual([
      'Send the revised quote to the client',
      'Book the venue for the launch',
    ])
  })

  it('matches reworded near-duplicates via the shared follow-up similarity helper, not exact text', () => {
    // Same words, reordered and re-punctuated — followupTaskSimilarity (token
    // overlap) clears FOLLOWUP_TASK_MATCH_THRESHOLD even though the strings
    // differ character-for-character.
    const { tracked, untracked } = reconcileActionItems(rows, [
      { id: 's1', text: 'Send revised quote to the client' },
      { id: 's2', text: 'Book venue for the launch event' },
    ])
    expect(tracked).toHaveLength(2)
    expect(untracked).toEqual([])
  })

  it('does not match on a handful of shared filler words alone', () => {
    const { tracked, untracked } = reconcileActionItems(rows, [
      { id: 's1', text: 'Send the client an invoice for last month' },
    ])
    expect(tracked).toEqual([])
    expect(untracked).toHaveLength(2)
  })

  it('is safe with empty rows and empty suggestions', () => {
    expect(reconcileActionItems([], [])).toEqual({ tracked: [], untracked: [] })
    expect(reconcileActionItems([], [{ id: 's1', text: 'anything' }])).toEqual({ tracked: [], untracked: [] })
    expect(reconcileActionItems(rows, [])).toEqual({ tracked: [], untracked: rows })
  })
})

describe('isSameNoteText', () => {
  it('matches text that differs only in surrounding or repeated whitespace', () => {
    expect(isSameNoteText('  We agreed to  ship\n on Friday ', 'We agreed to ship on Friday')).toBe(
      true,
    )
  })

  it('does not match text that was edited', () => {
    expect(isSameNoteText('We agreed to ship on Friday', 'We agreed to ship on Monday')).toBe(false)
  })

  it('never matches when either side is missing', () => {
    expect(isSameNoteText(null, 'anything')).toBe(false)
    expect(isSameNoteText('anything', undefined)).toBe(false)
    expect(isSameNoteText('', '')).toBe(false)
  })
})

describe('followupAge', () => {
  it('names the age in days and grades it', () => {
    expect(followupAge(new Date('2026-08-12T09:00:00'), now)).toMatchObject({
      days: 0,
      tone: 'fresh',
      label: 'Raised today',
    })
    expect(followupAge(new Date('2026-08-11T09:00:00'), now).label).toBe('Carried 1 day')
    expect(followupAge(new Date('2026-08-08T09:00:00'), now)).toMatchObject({
      days: 4,
      tone: 'fresh',
      label: 'Carried 4 days',
    })
    expect(followupAge(new Date('2026-08-04T09:00:00'), now).tone).toBe('aging')
    expect(followupAge(new Date('2026-07-01T09:00:00'), now).tone).toBe('stale')
  })

  it('never reports a negative age for a future-dated source meeting', () => {
    expect(followupAge(new Date('2026-08-20T09:00:00'), now)).toMatchObject({
      days: 0,
      tone: 'fresh',
    })
  })
})

describe('glanceFromIntel', () => {
  const notes = {
    summary: 'We agreed the release slips a week.',
    perPerson: [{ name: 'Amali', points: ['a'], actionItems: ['Book the room'] }],
    deadlines: [
      { item: 'Ship v2', owner: 'Kasun', due: '2026-08-01' },
      { item: 'Send quote', owner: 'Amali', due: '2026-08-30' },
    ],
    questions: [{ person: 'Kasun', questions: ['Did the client sign?', 'Is staging up?'] }],
    createdAt: new Date('2026-08-11T18:00:00'),
  }

  it('summarizes notes, actions, overdue actions and follow-ups', () => {
    const glance = glanceFromIntel(
      {
        notes,
        prep: [
          {
            items: [
              { status: 'open', fromDate: new Date('2026-08-11T09:00:00') },
              { status: 'open', fromDate: new Date('2026-06-01T09:00:00') },
              { status: 'resolved', fromDate: new Date('2026-06-01T09:00:00') },
            ],
          },
        ],
      },
      now,
    )
    expect(glance).toEqual({
      hasNotes: true,
      analyzedAt: notes.createdAt,
      actions: 3,
      overdueActions: 1,
      openFollowups: 2,
      staleFollowups: 1,
      questions: 2,
    })
  })

  it('reports an un-analyzed meeting as having produced nothing', () => {
    expect(glanceFromIntel({ notes: null, prep: [] }, now)).toEqual({
      hasNotes: false,
      analyzedAt: null,
      actions: 0,
      overdueActions: 0,
      openFollowups: 0,
      staleFollowups: 0,
      questions: 0,
    })
  })
})
