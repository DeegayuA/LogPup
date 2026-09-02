import { describe, expect, it } from 'vitest'
import {
  assembleGlanceResponse,
  buildGlanceMap,
  carriedIntoMeeting,
  decideIntelReadable,
  type GlanceFollowupRow,
  type GlanceMeetingRow,
} from './glance-core'
import { glanceFromIntel } from './components/meeting-notes-model'

// ---------------------------------------------------------------------------
// getMeetingGlances' pure core. The server action (glance-actions.ts) is auth
// plus six batched queries around these functions — DB-free by design, the
// same split followups.test.ts relies on — so what is tested here is the
// whole computation: the per-meeting row filtering, the permission decision,
// the parity contract with glanceFromIntel, and the null-for-denied leak
// rule.
//
// Dates are plain local strings, like meeting-glance.test.ts's — calendar-day
// math (overdue, staleness) then behaves identically wherever the test runs,
// which is exactly how the shared production helpers behave too.
// ---------------------------------------------------------------------------

const now = new Date('2026-09-01T10:00:00')

const nextMeetingAt = new Date('2026-09-12T15:00:00')

function meeting(id: string, over: Partial<GlanceMeetingRow> = {}): GlanceMeetingRow {
  return {
    id,
    createdBy: 'creator-1',
    startsAt: new Date('2026-09-01T09:00:00'),
    nextMeetingAt: null,
    ...over,
  }
}

function followup(over: Partial<GlanceFollowupRow> & { id: string }): GlanceFollowupRow {
  return {
    userId: 'u1',
    personName: 'Amali',
    text: `follow-up ${over.id}`,
    kind: 'action',
    status: 'open',
    targetMeetingId: null,
    resolvedInMeetingId: null,
    sourceMeetingId: 'src-early',
    sourceMeetingTitle: 'Retro',
    sourceMeetingStartsAt: new Date('2026-08-11T09:00:00'),
    ...over,
  }
}

/** meeting_ai_notes JSONB for the parity meeting: three mergeable actions
 *  (one overdue as of `now`), two prep questions. */
const notesJson = {
  perPerson: [{ name: 'Amali', points: ['a'], actionItems: ['Book the room'] }],
  deadlines: [
    { item: 'Ship v2', owner: 'Kasun', due: '2026-08-20' },
    { item: 'Send quote', owner: 'Amali', due: '2026-09-10' },
  ],
  questions: [{ person: 'Kasun', questions: ['Did the client sign?', 'Is staging up?'] }],
}
const analyzedAt = new Date('2026-08-30T18:00:00')

describe('carriedIntoMeeting — fetchCarriedFollowups’ per-meeting WHERE, in JS', () => {
  const m = { id: 'm1', startsAt: new Date('2026-09-01T09:00:00') }

  it('carries an open, earlier-sourced, attributed item', () => {
    expect(carriedIntoMeeting(followup({ id: 'f' }), m)).toBe(true)
  })

  it('never carries a meeting’s own follow-ups into itself', () => {
    expect(carriedIntoMeeting(followup({ id: 'f', sourceMeetingId: 'm1' }), m)).toBe(false)
  })

  it('never carries an item whose source is not earlier', () => {
    const later = followup({ id: 'f', sourceMeetingStartsAt: new Date('2026-09-05T09:00:00') })
    expect(carriedIntoMeeting(later, m)).toBe(false)
  })

  it('never carries an unattributed item — there is nobody to carry it to', () => {
    expect(carriedIntoMeeting(followup({ id: 'f', userId: null }), m)).toBe(false)
  })

  it('a pinned item lands ONLY on its target meeting, whatever its source date', () => {
    const pinnedHere = followup({
      id: 'f',
      targetMeetingId: 'm1',
      sourceMeetingStartsAt: new Date('2026-09-05T09:00:00'),
    })
    const pinnedElsewhere = followup({ id: 'g', targetMeetingId: 'other' })
    expect(carriedIntoMeeting(pinnedHere, m)).toBe(true)
    expect(carriedIntoMeeting(pinnedElsewhere, m)).toBe(false)
  })

  it('a resolved item surfaces only on the meeting it was resolved in', () => {
    const resolvedHere = followup({ id: 'f', status: 'resolved', resolvedInMeetingId: 'm1' })
    const resolvedElsewhere = followup({ id: 'g', status: 'resolved', resolvedInMeetingId: 'other' })
    expect(carriedIntoMeeting(resolvedHere, m)).toBe(true)
    expect(carriedIntoMeeting(resolvedElsewhere, m)).toBe(false)
  })
})

describe('buildGlanceMap', () => {
  // The parity meeting: notes as above; u1 carries a stale item (Aug 11 →
  // exactly 21 days), an aging one (Aug 12 → 20 days, NOT stale) and one
  // resolved here; u2 has an item pinned to this meeting from a LATER
  // meeting; u3’s item and the unattributed/pinned-away/own-source rows must
  // all fall out.
  const m1 = meeting('m1', { nextMeetingAt })
  const rows: GlanceFollowupRow[] = [
    followup({ id: 'f-stale' }), // u1, Aug 11 — 21 days: the stale boundary
    followup({ id: 'f-aging', sourceMeetingId: 'src-late', sourceMeetingStartsAt: new Date('2026-08-12T09:00:00') }),
    followup({ id: 'f-resolved', status: 'resolved', resolvedInMeetingId: 'm1', sourceMeetingId: 'src-late', sourceMeetingStartsAt: new Date('2026-08-12T09:00:00') }),
    followup({ id: 'f-non-attendee', userId: 'u3', personName: 'Kasun' }),
    followup({ id: 'f-pinned-away', targetMeetingId: 'somewhere-else' }),
    followup({ id: 'f-own-source', sourceMeetingId: 'm1' }),
    followup({ id: 'f-pinned-here', userId: 'u2', personName: 'Nadeesha', targetMeetingId: 'm1', sourceMeetingStartsAt: new Date('2026-09-05T09:00:00') }),
  ]
  const input = {
    meetings: [m1],
    notesRows: [{ meetingId: 'm1', ...notesJson, createdAt: analyzedAt }],
    attendeeRows: [
      { meetingId: 'm1', userId: 'u1' },
      { meetingId: 'm1', userId: 'u2' },
    ],
    followupRows: rows,
    now,
  }

  it('deep-equals glanceFromIntel over the same intel — the parity contract', () => {
    // Written out by value: this is the IntelLike getMeetingIntel builds for
    // exactly these rows (its own pipeline documented in ai-actions.ts —
    // selectCarriedForward over the carried rows and this meeting’s
    // attendees, statuses mapped back on, oldest first within a group).
    const intel = {
      notes: {
        summary: 'We agreed the release slips a week.', // ignored by the glance
        ...notesJson,
        createdAt: analyzedAt,
      },
      prep: [
        {
          items: [
            { status: 'open' as const, fromDate: new Date('2026-08-11T09:00:00') },
            { status: 'open' as const, fromDate: new Date('2026-08-12T09:00:00') },
            { status: 'resolved' as const, fromDate: new Date('2026-08-12T09:00:00') },
          ],
        },
        { items: [{ status: 'open' as const, fromDate: new Date('2026-09-05T09:00:00') }] },
      ],
      nextMeetingAt,
    }

    expect(buildGlanceMap(input).get('m1')).toEqual(glanceFromIntel(intel, now))
  })

  it('counts what the fixture says it should — including the 21-day stale boundary', () => {
    expect(buildGlanceMap(input).get('m1')).toEqual({
      hasNotes: true,
      analyzedAt,
      actions: 3,
      overdueActions: 1,
      openFollowups: 3, // f-stale + f-aging + f-pinned-here; resolved not owed
      staleFollowups: 1, // Aug 11 is exactly FOLLOWUP_STALE_DAYS ago; Aug 12 is not
      questions: 2,
      nextMeetingAt,
    })
  })

  it('a meeting in the same batch shares nothing — counts never bleed across rows', () => {
    const m2 = meeting('m2', { startsAt: new Date('2026-09-02T09:00:00') })
    const map = buildGlanceMap({
      ...input,
      meetings: [m1, m2],
      // m2 has attendees but no notes row and (pinned/own/later rules aside)
      // u1’s open items WOULD carry into it — but m2 lists no attendees here,
      // so nothing is owed at it.
      attendeeRows: input.attendeeRows,
    })
    expect(map.get('m2')).toEqual({
      hasNotes: false,
      analyzedAt: null,
      actions: 0,
      overdueActions: 0,
      openFollowups: 0,
      staleFollowups: 0,
      questions: 0,
      nextMeetingAt: null,
    })
    // And m1’s own numbers are unchanged by the neighbour.
    expect(map.get('m1')?.openFollowups).toBe(3)
  })

  it('never computes a glance for a meeting the gate did not admit', () => {
    // Denied ids never reach `meetings` — the action filters first — so the
    // map simply has no entry, and assembleGlanceResponse turns that into
    // null below.
    expect(buildGlanceMap(input).has('denied-id')).toBe(false)
  })

  it('applies the panel’s per-person cap, oldest first — chips and panel agree', () => {
    // Seven open items for one person: the panel shows the oldest five and
    // says "2 more"; the glance must count the same five, not silently
    // disagree with the panel it opens into.
    const days = ['05', '06', '07', '08', '09', '10', '12']
    const many = days.map((day, index) =>
      followup({
        id: `f-${index}`,
        sourceMeetingId: `src-${index}`,
        sourceMeetingStartsAt: new Date(`2026-08-${day}T09:00:00`),
      }),
    )
    const glance = buildGlanceMap({ ...input, followupRows: many }).get('m1')
    expect(glance?.openFollowups).toBe(5)
    // The five oldest (Aug 5–9) survive the cap, and every one of them is
    // ≥ 21 days before Sep 1 — all stale.
    expect(glance?.staleFollowups).toBe(5)
  })

  it('due today is not overdue — the overdue line is the previous Colombo day', () => {
    const glance = buildGlanceMap({
      ...input,
      followupRows: [],
      notesRows: [
        {
          meetingId: 'm1',
          perPerson: [],
          deadlines: [
            { item: 'Due today', owner: 'Amali', due: '2026-09-01' },
            { item: 'Due yesterday', owner: 'Amali', due: '2026-08-31' },
          ],
          questions: [],
          createdAt: analyzedAt,
        },
      ],
    }).get('m1')
    expect(glance).toMatchObject({ actions: 2, overdueActions: 1 })
  })

  it('shrugs off malformed JSONB — a corrupt notes row is an empty write-up, not a crash', () => {
    const glance = buildGlanceMap({
      ...input,
      followupRows: [],
      notesRows: [
        { meetingId: 'm1', perPerson: 'not-an-array', deadlines: null, questions: 42, createdAt: analyzedAt },
      ],
    }).get('m1')
    expect(glance).toMatchObject({ hasNotes: true, actions: 0, questions: 0 })
  })
})

describe('decideIntelReadable — canReadMeetingIntel’s four arms, batched', () => {
  const base = {
    meeting: { id: 'm1', createdBy: 'creator-1' },
    meetingAppIds: ['app-1', 'app-2'],
    managedAppIds: new Set<string>(),
    attendedMeetingIds: new Set<string>(),
  }

  it('admits an admin', () => {
    expect(
      decideIntelReadable({ ...base, viewer: { id: 'someone', role: 'admin' } }),
    ).toBe(true)
  })

  it('admits the creator', () => {
    expect(
      decideIntelReadable({ ...base, viewer: { id: 'creator-1', role: 'member' } }),
    ).toBe(true)
  })

  it('admits the PM of ANY of the meeting’s projects', () => {
    expect(
      decideIntelReadable({
        ...base,
        viewer: { id: 'pm', role: 'member' },
        managedAppIds: new Set(['app-2']),
      }),
    ).toBe(true)
  })

  it('admits an attendee — and only of the meetings they actually attend', () => {
    const viewer = { id: 'guest', role: 'member' as const }
    expect(
      decideIntelReadable({ ...base, viewer, attendedMeetingIds: new Set(['m1']) }),
    ).toBe(true)
    expect(
      decideIntelReadable({ ...base, viewer, attendedMeetingIds: new Set(['m2']) }),
    ).toBe(false)
  })

  it('turns everyone else away — a visible meeting is not a readable transcript', () => {
    expect(
      decideIntelReadable({ ...base, viewer: { id: 'bystander', role: 'member' } }),
    ).toBe(false)
  })

  it('managing an app the meeting is NOT on admits nobody', () => {
    expect(
      decideIntelReadable({
        ...base,
        viewer: { id: 'pm', role: 'member' },
        managedAppIds: new Set(['app-9']),
      }),
    ).toBe(false)
  })
})

describe('assembleGlanceResponse — the leak rule', () => {
  it('answers null for denied and unknown ids, indistinguishably', () => {
    const glances = buildGlanceMap({
      meetings: [meeting('m1')],
      notesRows: [],
      attendeeRows: [],
      followupRows: [],
      now,
    })
    const map = assembleGlanceResponse(['m1', 'denied-id', 'no-such-meeting'], glances)
    expect(map['m1']).not.toBeNull()
    expect(map['denied-id']).toBeNull()
    expect(map['no-such-meeting']).toBeNull()
    // Nothing in the shape distinguishes the two nulls.
    expect(map['denied-id']).toEqual(map['no-such-meeting'])
  })

  it('keys every requested id and nothing else', () => {
    const map = assembleGlanceResponse(['a', 'b'], new Map())
    expect(Object.keys(map).sort()).toEqual(['a', 'b'])
  })
})
