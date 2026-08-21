import { describe, expect, it } from 'vitest'
import type {
  PerAppLoadRow, SeriesTableRow, WeeklyLoadRow,
} from './queries'
import type { AnalyzedOccurrence } from './suggest'
import { suggest, type SeriesMetrics } from './suggest'

/**
 * The visibility boundary, asserted rather than trusted.
 *
 * The design's requirement is "type-level, not a remember-to-call function": a
 * forgotten redaction has to be a build error, not a dashboard leak. These
 * tests pin both halves of that — the org-facing row types cannot NAME anybody,
 * and the org-facing series metrics cannot make R5 fire.
 *
 * Rows are asserted with `Object.keys` on a real value, matching the
 * recommender's own `toRedactedView` test precedent: `toBeUndefined()` passes
 * for a key that is present and undefined, which is exactly the case a
 * redaction bug produces.
 */

const NAMEY = ['userId', 'user_id', 'organizerId', 'organizer_id', 'decidedBy', 'decided_by', 'name']

function expectNoNames(row: Record<string, unknown>) {
  for (const key of Object.keys(row)) {
    expect(NAMEY, `org-facing row exposes "${key}"`).not.toContain(key)
  }
}

describe('org-facing row types name nobody', () => {
  it('the weekly load table', () => {
    const row: WeeklyLoadRow = {
      weekStartIso: '2026-08-17',
      invitedHours: 12,
      meetingCount: 4,
      coverage: 0.5,
      noAgendaCount: 1,
      noAppCount: 2,
      overlapHours: 1.5,
      rsvpAdoption: { pending: 1, total: 4, rate: 0.25 },
    }
    expectNoNames(row)
    // The overlap figure is a TEAM total. computeCollisions also returns a
    // per-user map, and this type is the proof it never reaches an org surface.
    expect(Object.keys(row)).not.toContain('perUserOverlapHours')
  })

  it('the per-project breakdown', () => {
    const row: PerAppLoadRow = { appId: 'app-1', appName: 'Vela', invitedHours: 9 }
    // `appName` is a project, not a person — the only name any org surface
    // carries.
    expect(Object.keys(row).filter((k) => NAMEY.includes(k))).toEqual([])
  })

  it('the series table — churn is a count, never who came and went', () => {
    const row: SeriesTableRow = {
      groupKey: 'vela standup|app-1',
      seriesKey: 'vela standup',
      appId: 'app-1',
      occurrenceCount: 4,
      invitedHoursPerOccurrence: 2.5,
      medianDurationMinutes: 30,
      churnCount: 3,
      aiDerivedOutputs: 2,
      manualOutputs: 1,
      medianMappedSpeakers: 2,
      medianVoiceTurns: 8,
      coverage: 0.75,
    }
    expectNoNames(row)
    // At nine people, "who joined and who left" de-anonymises instantly. The
    // count says the series has not settled on who it is for; the names would
    // say something about individuals.
    expect(Object.keys(row)).not.toContain('joined')
    expect(Object.keys(row)).not.toContain('left')
  })

  it('refuses an organizerId at build time', () => {
    // @ts-expect-error — adding a person to an org-facing row must break the
    // build rather than quietly widening what the dashboard can show.
    const widened: PerAppLoadRow = { appId: 'a', appName: 'Vela', invitedHours: 1, organizerId: 'u1' }
    expect(widened.appName).toBe('Vela')
  })
})

describe('R5 cannot fire from the org-facing path', () => {
  const occurrence = (over: Partial<AnalyzedOccurrence> = {}): AnalyzedOccurrence => ({
    meetingId: 'm1',
    model: 'gemini-2.5',
    aiDerivedOutputs: 1,
    mappedSpeakers: 3,
    voiceTurns: 20,
    isoWeek: '2026-W34',
    hardEvidencePool: 5,
    ...over,
  })

  const series = (last4Analyzed: AnalyzedOccurrence[]): SeriesMetrics => ({
    groupKey: 'vela standup|app-1',
    seriesKey: 'vela standup',
    title: 'Vela standup',
    appId: 'app-1',
    mergeable: true,
    established: true,
    activeRecently: true,
    organizerId: 'user-1',
    occurrenceCountInWindow: 4,
    medianDurationMinutes: 30,
    invitedHoursPerWeek: 1,
    consideredCountLast4: 4,
    last4Analyzed,
    last3InviteSets: [['a', 'b'], ['a', 'b'], ['a', 'b']],
  })

  it('stays silent when the caller never populated the names', () => {
    // This fixture satisfies every numeric threshold R5 has. The ONLY thing
    // missing is the field the org-facing gather deliberately never sets — so
    // the redaction is a shape, not a filter somebody could delete.
    const withheld = series([
      occurrence({ meetingId: 'a' }), occurrence({ meetingId: 'b' }), occurrence({ meetingId: 'c' }),
    ])
    expect(suggest([withheld], new Set()).map((s) => s.kind)).not.toContain('trim_invite')
  })

  it('fires only once names are deliberately supplied', () => {
    // The mirror of the test above, and the reason it is convincing: the same
    // fixture with the field populated DOES fire, so the silence above is the
    // redaction working rather than an unrelated threshold blocking it.
    const named = series([
      occurrence({ meetingId: 'a', zeroEvidenceInviteeIds: ['x', 'y'] }),
      occurrence({ meetingId: 'b', zeroEvidenceInviteeIds: ['x', 'y'] }),
      occurrence({ meetingId: 'c', zeroEvidenceInviteeIds: ['x', 'y'] }),
    ])
    expect(suggest([named], new Set()).map((s) => s.kind)).toContain('trim_invite')
  })

  it('treats an empty array as a real answer, not as withheld', () => {
    // "Nobody had zero evidence" and "you were not told" are different facts.
    // Both produce no suggestion, but for different reasons — and conflating
    // them in the type is what would make the guard removable by accident.
    const nobody = series([
      occurrence({ meetingId: 'a', zeroEvidenceInviteeIds: [] }),
      occurrence({ meetingId: 'b', zeroEvidenceInviteeIds: [] }),
    ])
    expect(suggest([nobody], new Set()).map((s) => s.kind)).not.toContain('trim_invite')
  })
})
