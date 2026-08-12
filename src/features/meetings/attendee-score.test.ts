import { describe, expect, it } from 'vitest'
import {
  scoreCandidate,
  tierAll,
  REASON_TEMPLATES,
  CAVEAT_TEMPLATES,
  type CandidateFacts,
  type ScoreContext,
  type ScoredCandidate,
  type Tier,
  type ReasonCode,
  type CaveatCode,
} from './attendee-score'

// ---------------------------------------------------------------------------
// Fixture builders. Every CandidateFacts field is spelled out explicitly
// (never `...defaults` spread) in the family-specific tests below so each
// test reads as "this is exactly the evidence this candidate has" — matching
// the house style already used in followups.test.ts / agenda-topics.test.ts.
// ---------------------------------------------------------------------------

const MEETING_DAY = new Date('2026-08-12T09:00:00.000Z')
const TODAY = new Date('2026-08-12T09:00:00.000Z')

function daysBefore(days: number): Date {
  return new Date(MEETING_DAY.getTime() - days * 24 * 60 * 60 * 1000)
}

function baseCtx(overrides: Partial<ScoreContext> = {}): ScoreContext {
  return {
    today: TODAY,
    meetingDay: MEETING_DAY,
    surface: 'pre',
    meetingTitle: 'Vela Weekly',
    meetingAgenda: 'Review the checkout flow mockups and the QA sign-off before release.',
    appId: 'app-vela',
    appIdInferred: false,
    appName: 'Vela',
    appTechTags: ['react', 'postgres'],
    poolSize: 12,
    seriesTitle: 'Vela Weekly',
    seriesOccurrenceCount: 6,
    aiUnavailable: false,
    ...overrides,
  }
}

function baseFacts(overrides: Partial<CandidateFacts> = {}): CandidateFacts {
  return {
    userId: 'u1',
    roleTokens: [],
    isOrganizer: false,
    followups: [],
    pinnedFollowups: [],
    openTasks: [],
    runningSprint: null,
    discussionMeetings: [],
    voiceMeetings: [],
    unresolvedVoiceMeetingsCount: 0,
    isLead: false,
    assignment: null,
    leadAllowlistRoleHeuristic: false,
    attendance: null,
    attendedPreviousOccurrence: false,
    previousOccurrenceDate: null,
    aiRelevance: null,
    existingAttendeeRow: false,
    selfOptIn: false,
    candidateJoinedAt: null,
    isReturner: false,
    ...overrides,
  }
}

const tierRank: Record<Tier, number> = { skip: 0, optional: 1, required: 2 }

// ---------------------------------------------------------------------------
// E1 — open follow-ups
// ---------------------------------------------------------------------------

describe('E1 — open follow-ups', () => {
  it('human-added item scores base 12 at full recency', () => {
    const facts = baseFacts({
      followups: [
        {
          id: 'f1',
          humanAdded: true,
          kind: 'question',
          sourceMeetingTitle: 'Vela Weekly',
          sourceMeetingStartsAt: daysBefore(1),
          attribution: 'resolved',
          resolvedInThisMeeting: false,
          text: 'confirm the SLA wording',
        },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(12)
    expect(scored.hardEvidenceCount).toBe(1)
  })

  it('AI-derived item scores base 6', () => {
    const facts = baseFacts({
      followups: [
        {
          id: 'f1',
          humanAdded: false,
          kind: 'question',
          sourceMeetingTitle: 'Vela Weekly',
          sourceMeetingStartsAt: daysBefore(1),
          attribution: 'resolved',
          resolvedInThisMeeting: false,
          text: 'check the invoice export',
        },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(6)
  })

  it("kind:'action' adds +2", () => {
    const facts = baseFacts({
      followups: [
        {
          id: 'f1',
          humanAdded: true,
          kind: 'action',
          sourceMeetingTitle: 'Vela Weekly',
          sourceMeetingStartsAt: daysBefore(1),
          attribution: 'resolved',
          resolvedInThisMeeting: false,
          text: 'ship the fix',
        },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(14)
  })

  it('recency multipliers: <=14d x1.0, <=45d x0.75, <=120d x0.5, >120d x0.25', () => {
    const build = (days: number) =>
      baseFacts({
        followups: [
          {
            id: 'f1',
            humanAdded: true,
            kind: 'question',
            sourceMeetingTitle: 'Vela Weekly',
            sourceMeetingStartsAt: daysBefore(days),
            attribution: 'resolved',
            resolvedInThisMeeting: false,
            text: 'x',
          },
        ],
      })
    expect(scoreCandidate(build(14), baseCtx({ appId: null })).scoreDet).toBe(12)
    expect(scoreCandidate(build(45), baseCtx({ appId: null })).scoreDet).toBe(9)
    expect(scoreCandidate(build(120), baseCtx({ appId: null })).scoreDet).toBe(6)
    expect(scoreCandidate(build(200), baseCtx({ appId: null })).scoreDet).toBe(3)
  })

  it('orphan (unresolved userId) unambiguous human match scores at 0.5x and IS hard evidence', () => {
    const facts = baseFacts({
      followups: [
        {
          id: 'f1',
          humanAdded: true,
          kind: 'question',
          sourceMeetingTitle: 'Vela Weekly',
          sourceMeetingStartsAt: daysBefore(1),
          attribution: 'orphan',
          resolvedInThisMeeting: false,
          text: 'x',
        },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(6)
    expect(scored.hardEvidenceCount).toBe(1)
  })

  it('orphan AI-derived match scores at 0.5x but is NOT hard evidence', () => {
    const facts = baseFacts({
      followups: [
        {
          id: 'f1',
          humanAdded: false,
          kind: 'question',
          sourceMeetingTitle: 'Vela Weekly',
          sourceMeetingStartsAt: daysBefore(1),
          attribution: 'orphan',
          resolvedInThisMeeting: false,
          text: 'x',
        },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(3)
    expect(scored.hardEvidenceCount).toBe(0)
  })

  it('retro: resolvedInThisMeeting applies a x1.25 multiplier (answered in the room proves need)', () => {
    const facts = baseFacts({
      followups: [
        {
          id: 'f1',
          humanAdded: true,
          kind: 'question',
          sourceMeetingTitle: 'Vela Weekly',
          sourceMeetingStartsAt: daysBefore(1),
          attribution: 'resolved',
          resolvedInThisMeeting: true,
          text: 'x',
        },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null, surface: 'retro' }))
    expect(scored.scoreDet).toBe(15)
    expect(scored.reasons.some((r) => r.code === 'followup_answered_here')).toBe(true)
  })

  it('the x1.25 retro multiplier does NOT apply outside the retro surface', () => {
    const facts = baseFacts({
      followups: [
        {
          id: 'f1',
          humanAdded: true,
          kind: 'question',
          sourceMeetingTitle: 'Vela Weekly',
          sourceMeetingStartsAt: daysBefore(1),
          attribution: 'resolved',
          resolvedInThisMeeting: true,
          text: 'x',
        },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null, surface: 'pre' }))
    expect(scored.scoreDet).toBe(12)
  })

  it('caps the family at 30 even with many items', () => {
    const followups = Array.from({ length: 10 }, (_, i) => ({
      id: `f${i}`,
      humanAdded: true,
      kind: 'action' as const,
      sourceMeetingTitle: 'Vela Weekly',
      sourceMeetingStartsAt: daysBefore(1),
      attribution: 'resolved' as const,
      resolvedInThisMeeting: false,
      text: 'x',
    }))
    const scored = scoreCandidate(baseFacts({ followups }), baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(30)
  })

  it('no follow-ups contributes exactly 0, never a penalty', () => {
    const scored = scoreCandidate(baseFacts(), baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(0)
    expect(scored.tier).toBe('skip')
  })

  it('I5 (review round 1 regression): items from DIFFERENT source meetings are never attributed to one meeting', () => {
    // Reproduced by the reviewer: items from Vela Weekly, Orbit Retro and
    // Client Sync all rendered as "Owes 3 open item(s) from Vela Weekly (11
    // Aug)" — disprovable by opening either of the other two meetings. Each
    // source meeting now gets its own, individually truthful reason line.
    const facts = baseFacts({
      followups: [
        { id: 'f1', humanAdded: true, kind: 'question', sourceMeetingTitle: 'Vela Weekly', sourceMeetingStartsAt: daysBefore(1), attribution: 'resolved', resolvedInThisMeeting: false, text: 'confirm the SLA wording' },
        { id: 'f2', humanAdded: true, kind: 'question', sourceMeetingTitle: 'Orbit Retro', sourceMeetingStartsAt: daysBefore(10), attribution: 'resolved', resolvedInThisMeeting: false, text: 'follow up with the vendor' },
        { id: 'f3', humanAdded: true, kind: 'question', sourceMeetingTitle: 'Client Sync', sourceMeetingStartsAt: daysBefore(20), attribution: 'resolved', resolvedInThisMeeting: false, text: 'send the revised quote' },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    const openReasons = scored.reasons.filter((r) => r.code === 'followup_open')
    expect(openReasons).toHaveLength(3) // one per distinct source meeting
    const bySource = new Map(openReasons.map((r) => [r.en, r]))
    const velaLine = [...bySource.keys()].find((en) => en.includes('Vela Weekly'))
    const orbitLine = [...bySource.keys()].find((en) => en.includes('Orbit Retro'))
    const clientLine = [...bySource.keys()].find((en) => en.includes('Client Sync'))
    expect(velaLine).toBeTruthy()
    expect(orbitLine).toBeTruthy()
    expect(clientLine).toBeTruthy()
    // Every meeting's own line cites only its own item — never another meeting's text.
    expect(velaLine).toContain('confirm the SLA wording')
    expect(velaLine).not.toContain('follow up with the vendor')
    expect(velaLine).not.toContain('send the revised quote')
    expect(orbitLine).toContain('follow up with the vendor')
    expect(orbitLine).not.toContain('confirm the SLA wording')
    expect(clientLine).toContain('send the revised quote')
    // Each line reports its OWN count (1), never the total across all sources.
    for (const r of openReasons) expect(r.en).toMatch(/Owes 1 open item/)
    // Family total is still 30 (recency-decayed 12+12+12, capped) and lives on exactly one line.
    expect(scored.scoreDet).toBe(30)
    expect(openReasons.filter((r) => r.points > 0)).toHaveLength(1)
  })
})

describe('E1b — pinned follow-up (hard override, not points)', () => {
  it('forces required unconditionally, contributes 0 points, and is hard evidence', () => {
    const facts = baseFacts({
      pinnedFollowups: [{ id: 'p1', text: 'send the staging creds', pinnedByName: 'Nuwan', pinnedOnDate: daysBefore(2) }],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.tier).toBe('required')
    expect(scored.scoreDet).toBe(0)
    expect(scored.hardEvidenceCount).toBe(1)
    expect(scored.reasons.find((r) => r.code === 'followup_pinned')?.points).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// E2 — open tasks
// ---------------------------------------------------------------------------

describe('E2 — open tasks', () => {
  it('4 per open task, capped at 12', () => {
    const openTasks = [
      { id: 't1', inProgress: false },
      { id: 't2', inProgress: false },
      { id: 't3', inProgress: false },
      { id: 't4', inProgress: false },
    ]
    const scored = scoreCandidate(baseFacts({ openTasks }), baseCtx())
    expect(scored.scoreDet).toBe(12) // 4*4=16 capped to 12
  })

  it('+2 per in-progress task, capped at 4', () => {
    const openTasks = [
      { id: 't1', inProgress: true },
      { id: 't2', inProgress: true },
      { id: 't3', inProgress: true },
    ]
    // open: 3*4=12 (already at cap 12), inProgress: 3*2=6 capped to 4 => 16, under family cap 20
    const scored = scoreCandidate(baseFacts({ openTasks }), baseCtx())
    expect(scored.scoreDet).toBe(16)
  })

  it('flat +4 sprint bonus when >=1 open task sits in the running sprint (not per task)', () => {
    const openTasks = [{ id: 't1', inProgress: false }]
    const runningSprint = { name: 'Sprint 12', endDate: daysBefore(-7), openTaskCount: 1 }
    const scored = scoreCandidate(baseFacts({ openTasks, runningSprint }), baseCtx())
    expect(scored.scoreDet).toBe(8) // 4 (open) + 4 (sprint bonus)
    expect(scored.reasons.find((r) => r.code === 'task_sprint')).toBeTruthy()
  })

  it('caps the whole family at 20', () => {
    const openTasks = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, inProgress: true }))
    const runningSprint = { name: 'Sprint 12', endDate: daysBefore(-7), openTaskCount: 1 }
    const scored = scoreCandidate(baseFacts({ openTasks, runningSprint }), baseCtx())
    expect(scored.scoreDet).toBe(20)
  })

  it('zero tasks contributes exactly 0', () => {
    const scored = scoreCandidate(baseFacts(), baseCtx())
    expect(scored.scoreDet).toBe(0)
  })

  it('each open task row counts as hard evidence', () => {
    const openTasks = [{ id: 't1', inProgress: false }]
    const scored = scoreCandidate(baseFacts({ openTasks }), baseCtx())
    expect(scored.hardEvidenceCount).toBe(1)
  })

  it('is UNAVAILABLE (0, no penalty) when the meeting has no app', () => {
    const openTasks = [{ id: 't1', inProgress: false }, { id: 't2', inProgress: false }]
    const scored = scoreCandidate(baseFacts({ openTasks }), baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(0)
    expect(scored.hardEvidenceCount).toBe(0)
  })

  it('retrospective surface caps the family at 10, not 20', () => {
    const openTasks = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, inProgress: true }))
    const scored = scoreCandidate(baseFacts({ openTasks }), baseCtx({ surface: 'retro' }))
    expect(scored.scoreDet).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// E3 — role/topic match
// ---------------------------------------------------------------------------

describe('E3 — role/topic match', () => {
  it('primary hit scores 14 and is hard evidence', () => {
    const facts = baseFacts({ roleTokens: ['UI/UX Designer'] })
    const ctx = baseCtx({ meetingAgenda: 'Review the checkout flow mockups before launch.' })
    const scored = scoreCandidate(facts, ctx)
    expect(scored.scoreDet).toBe(14)
    expect(scored.hardEvidenceCount).toBe(1)
    expect(scored.reasons.find((r) => r.code === 'role_topic')?.points).toBe(14)
  })

  it('adjacent hit scores 7 and is NOT hard evidence', () => {
    const facts = baseFacts({ roleTokens: ['Product Manager'] })
    const ctx = baseCtx({ meetingAgenda: 'Design review for the checkout flow.' })
    const scored = scoreCandidate(facts, ctx)
    expect(scored.scoreDet).toBe(7)
    expect(scored.hardEvidenceCount).toBe(0)
  })

  it('tech-tag-only hit (no role match) scores 3 with an honest, role-free reason', () => {
    // I6 (review round 1): this branch used to reuse `role_topic`'s "...their
    // role is {role}." template with `role` set to the APP NAME (there is no
    // candidate role to cite for a techTag hit), rendering "their role is
    // Vela." — a falsehood the old assertion (scoreDet===3 only) never read
    // far enough to catch. `role_topic_tech` gets its own honest template.
    const facts = baseFacts({ roleTokens: ['Finance'] })
    const ctx = baseCtx({ meetingAgenda: 'A quick chat about react and the release date.', appTechTags: ['react'] })
    const scored = scoreCandidate(facts, ctx)
    expect(scored.scoreDet).toBe(3)
    expect(scored.hardEvidenceCount).toBe(0)
    const reason = scored.reasons.find((r) => r.code === 'role_topic_tech')
    expect(reason).toBeTruthy()
    expect(reason?.en).toContain('Vela')
    expect(reason?.en).not.toMatch(/their role is Vela/i)
    expect(reason?.en.toLowerCase()).not.toContain('role')
    // The old, wrong 'role_topic' code must never fire for a tech-tag-only hit.
    expect(scored.reasons.some((r) => r.code === 'role_topic')).toBe(false)
  })

  it('no hit contributes 0, never a penalty', () => {
    const facts = baseFacts({ roleTokens: ['Finance'] })
    const ctx = baseCtx({ meetingAgenda: 'A quick chat about the weekend.', appTechTags: [] })
    const scored = scoreCandidate(facts, ctx)
    expect(scored.scoreDet).toBe(0)
  })

  it('required floor: primary hit + assigned to the app -> required regardless of points', () => {
    const facts = baseFacts({
      roleTokens: ['UI/UX Designer'],
      assignment: { allocationPct: 5 },
    })
    const ctx = baseCtx({ meetingAgenda: 'Review the checkout flow mockups before launch.' })
    const scored = scoreCandidate(facts, ctx)
    expect(scored.tier).toBe('required')
  })

  it('primary hit WITHOUT app assignment does not trip the required floor by itself', () => {
    const facts = baseFacts({ roleTokens: ['UI/UX Designer'] })
    const ctx = baseCtx({ meetingAgenda: 'Review the checkout flow mockups before launch.' })
    const scored = scoreCandidate(facts, ctx)
    // 14 det points, 1 hard evidence -> below the 30-point required threshold, and no R6 floor fires
    expect(scored.tier).not.toBe('required')
  })

  it('falls back to title tokens with no agenda, and contributes 0 when the title is under 3 non-stopword words', () => {
    const facts = baseFacts({ roleTokens: ['UI/UX Designer'] })
    const ctx = baseCtx({ meetingTitle: 'Sync', meetingAgenda: null })
    const scored = scoreCandidate(facts, ctx)
    expect(scored.scoreDet).toBe(0)
    expect(scored.caveats.some((c) => c.code === 'thin_evidence')).toBe(true)
  })

  it('an inferred app applies the x0.6 confidence multiplier, and prefixes the reason "Inferred:"', () => {
    const facts = baseFacts({ roleTokens: ['UI/UX Designer'] })
    const ctx = baseCtx({
      meetingAgenda: 'Review the checkout flow mockups before launch.',
      appIdInferred: true,
    })
    const scored = scoreCandidate(facts, ctx)
    expect(scored.scoreDet).toBe(8) // round(14*0.6)
    expect(scored.caveats.some((c) => c.code === 'inferred_app')).toBe(true)
    // M5 (review round 1): spec ("Degradation", NO appId) says every E2/E3/E6
    // reason under a low-confidence inferred app is prefixed "inferred:" verbatim.
    const roleTopicReason = scored.reasons.find((r) => r.code === 'role_topic')
    expect(roleTopicReason?.en.startsWith('Inferred:')).toBe(true)
  })

  it('I4 (review round 1): the required floor does NOT fire off an INFERRED app', () => {
    // Reproduced by the reviewer: appIdInferred true + designer role + 'mockups'
    // in the agenda + 5% allocation floored REQUIRED off just 9 det points. The
    // x0.6 multiplier exists precisely because an inferred app is a guess; the
    // strongest, least-overridable tier in the ledger must not ignore that.
    const facts = baseFacts({ roleTokens: ['UI/UX Designer'], assignment: { allocationPct: 5 } })
    const ctx = baseCtx({
      meetingAgenda: 'Review the checkout flow mockups before launch.',
      appIdInferred: true,
    })
    const scored = scoreCandidate(facts, ctx)
    // E3: round(14*0.6)=8 (still a primary hit, just not floored to required).
    // E6: the 5% allocation band (2) also scaled by the same inferred factor: round(2*0.6)=1.
    expect(scored.scoreDet).toBe(9)
    expect(scored.tier).not.toBe('required')
    // Still floored to AT LEAST optional via R5's ordinary allocation floor.
    expect(scored.tier).toBe('optional')
  })
})

// ---------------------------------------------------------------------------
// E4 — discussion points
// ---------------------------------------------------------------------------

describe('E4 — discussion points', () => {
  it('2 points per discussion point, capped at 3 points per meeting', () => {
    const facts = baseFacts({
      discussionMeetings: [{ meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), points: 5 }],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(6) // min(3,5)*2*1.0
  })

  it('recency: <=30d x1.0, <=90d x0.7, <=180d x0.4', () => {
    const build = (days: number) =>
      baseFacts({
        discussionMeetings: [{ meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(days), points: 1 }],
      })
    expect(scoreCandidate(build(30), baseCtx({ appId: null })).scoreDet).toBe(2)
    expect(scoreCandidate(build(90), baseCtx({ appId: null })).scoreDet).toBe(1) // round(2*0.7)=1.4->1
    expect(scoreCandidate(build(180), baseCtx({ appId: null })).scoreDet).toBe(1) // round(2*0.4)=0.8->1
  })

  it('caps the family at 10', () => {
    const discussionMeetings = Array.from({ length: 5 }, (_, i) => ({
      meetingId: `m${i}`,
      meetingTitle: 'Vela Weekly',
      meetingStartsAt: daysBefore(1),
      points: 3,
    }))
    const scored = scoreCandidate(baseFacts({ discussionMeetings }), baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(10)
  })

  it('is never counted as hard evidence', () => {
    const facts = baseFacts({
      discussionMeetings: [{ meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), points: 3 }],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.hardEvidenceCount).toBe(0)
  })

  it('no discussion meetings contributes 0', () => {
    const scored = scoreCandidate(baseFacts(), baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(0)
  })

  it('C2 (review round 1 regression): a negative points value from the unvalidated jsonb source never drives scoreDet negative', () => {
    // meeting_ai_notes.perPerson is bare, untyped jsonb — the ONLY family
    // input with no natural floor. Pre-fix, `Math.min(3, m.points)` capped
    // only the top, so `points: -5` produced -10 det points on a reason
    // object carrying negative `points`.
    const facts = baseFacts({
      discussionMeetings: [{ meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), points: -5 }],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(0)
    expect(scored.scoreDet).toBeGreaterThanOrEqual(0)
    for (const r of scored.reasons) expect(r.points).toBeGreaterThanOrEqual(0)
  })

  it('I2 (review round 1): is UNAVAILABLE (0, no penalty) when the series has fewer than 2 established occurrences', () => {
    const facts = baseFacts({
      discussionMeetings: [{ meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), points: 3 }],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null, seriesOccurrenceCount: 1 }))
    expect(scored.scoreDet).toBe(0)
    expect(scored.tier).toBe('skip')
  })
})

// ---------------------------------------------------------------------------
// E5 — voice participation (turn count, never characters)
// ---------------------------------------------------------------------------

describe('E5 — voice participation', () => {
  it('scores by turn share relative to an equal-share expectation, never by character length', () => {
    // 3 resolved speakers, 30 resolved turns total, candidate took 15 (share 0.5, expected 1/3,
    // ratio 1.5 >= 0.75 -> band 8)
    const facts = baseFacts({
      voiceMeetings: [
        { meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), candidateTurns: 15, resolvedTurnsTotal: 30, resolvedSpeakerCount: 3 },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(8)
  })

  it('a Sinhala-heavy transcript scores identically to an English one for the same turn count', () => {
    // V2 (review round 1): the original fixtures here were BYTE-IDENTICAL
    // object literals, so this only ever asserted f(x) === f(x) — it would
    // have passed against a fully character-based implementation too. The
    // scoring TYPE (VoiceMeetingEvidence) carries no raw utterance text at
    // all — only integer turn counts — so the strongest available runtime
    // proof is: vary every available STRING field (meeting title) between a
    // genuinely long Sinhala one and a short English one, a ~2.5x length gap
    // in the same direction a code-switched Sinhala/English pair would
    // produce, while holding every numeric turn field exactly equal, and
    // confirm the score does not move.
    const englishLike = baseFacts({
      voiceMeetings: [
        {
          meetingId: 'm1',
          meetingTitle: 'Standup',
          meetingStartsAt: daysBefore(1),
          candidateTurns: 9,
          resolvedTurnsTotal: 31,
          resolvedSpeakerCount: 4,
        },
      ],
    })
    const sinhalaLike = baseFacts({
      voiceMeetings: [
        {
          meetingId: 'm1',
          meetingTitle: 'සඳුදා උදෑසන කණ්ඩායම් සාකච්ඡාව සහ සතියේ සැලසුම් සමාලෝචනය',
          meetingStartsAt: daysBefore(1),
          candidateTurns: 9,
          resolvedTurnsTotal: 31,
          resolvedSpeakerCount: 4,
        },
      ],
    })
    const a = scoreCandidate(englishLike, baseCtx({ appId: null }))
    const b = scoreCandidate(sinhalaLike, baseCtx({ appId: null }))
    expect(a.scoreDet).toBe(b.scoreDet)
    expect(a.scoreDet).toBe(8)
  })

  it('C1 (review round 1 regression): adding a second, genuinely-attended recording never DEMOTES the family', () => {
    // Reproduced by the reviewer against the pre-fix weighted-average implementation:
    // two human follow-ups (24 det, 2 hard evidence) + one recording at 15/30 turns
    // over 3 speakers (band 8) scored 32 -> required. Adding a SECOND real
    // recording at 2/40 turns over 4 speakers (band 2) dragged the weighted
    // AVERAGE down to 29 -> optional — taking part in more of the series demoted
    // the candidate. Fixed to take the BEST band across kept meetings; this test
    // pins that fix.
    const followups = [
      { id: 'f1', humanAdded: true, kind: 'question' as const, sourceMeetingTitle: 'Vela Weekly', sourceMeetingStartsAt: daysBefore(1), attribution: 'resolved' as const, resolvedInThisMeeting: false, text: 'confirm the SLA wording' },
      { id: 'f2', humanAdded: true, kind: 'question' as const, sourceMeetingTitle: 'Vela Weekly', sourceMeetingStartsAt: daysBefore(1), attribution: 'resolved' as const, resolvedInThisMeeting: false, text: 'check the invoice export' },
    ]
    const oneRecording = baseFacts({
      followups,
      voiceMeetings: [
        { meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), candidateTurns: 15, resolvedTurnsTotal: 30, resolvedSpeakerCount: 3 },
      ],
    })
    const twoRecordings = baseFacts({
      followups,
      voiceMeetings: [
        { meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), candidateTurns: 15, resolvedTurnsTotal: 30, resolvedSpeakerCount: 3 },
        { meetingId: 'm2', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(3), candidateTurns: 2, resolvedTurnsTotal: 40, resolvedSpeakerCount: 4 },
      ],
    })
    const before = scoreCandidate(oneRecording, baseCtx({ appId: null }))
    const after = scoreCandidate(twoRecordings, baseCtx({ appId: null }))
    expect(before.scoreDet).toBe(32)
    expect(after.scoreDet).toBe(32) // NOT 29 — the second, weaker-but-real recording must not lower the total
    expect(tierRank[after.tier]).toBeGreaterThanOrEqual(tierRank[before.tier])
  })

  it('an unresolved speaker meeting is UNAVAILABLE for that candidate, not scored as zero', () => {
    // Caller simply omits the meeting from voiceMeetings when this candidate's
    // speaker label never resolved — the family must contribute nothing, and a
    // caveat (not a penalty) should surface when the candidate has any such gaps.
    const facts = baseFacts({ unresolvedVoiceMeetingsCount: 2 })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(0)
    expect(scored.caveats.some((c) => c.code === 'speaker_unresolved')).toBe(true)
  })

  it('low relative share (ratio < 0.35) still scores a positive floor of 2, never negative', () => {
    const facts = baseFacts({
      voiceMeetings: [
        { meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), candidateTurns: 1, resolvedTurnsTotal: 30, resolvedSpeakerCount: 3 },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(2)
  })

  it('caps the family at 8', () => {
    const voiceMeetings = Array.from({ length: 5 }, (_, i) => ({
      meetingId: `m${i}`,
      meetingTitle: 'Vela Weekly',
      meetingStartsAt: daysBefore(1),
      candidateTurns: 20,
      resolvedTurnsTotal: 30,
      resolvedSpeakerCount: 2,
    }))
    const scored = scoreCandidate(baseFacts({ voiceMeetings }), baseCtx({ appId: null }))
    expect(scored.scoreDet).toBeLessThanOrEqual(8)
  })

  it('is never counted as hard evidence', () => {
    const facts = baseFacts({
      voiceMeetings: [
        { meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), candidateTurns: 15, resolvedTurnsTotal: 30, resolvedSpeakerCount: 3 },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.hardEvidenceCount).toBe(0)
  })

  it('I2 (review round 1): is UNAVAILABLE (0, no penalty) when the series has fewer than 2 established occurrences', () => {
    const facts = baseFacts({
      voiceMeetings: [
        { meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), candidateTurns: 15, resolvedTurnsTotal: 30, resolvedSpeakerCount: 3 },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null, seriesOccurrenceCount: 1 }))
    expect(scored.scoreDet).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// E6 — lead + allocation
// ---------------------------------------------------------------------------

describe('E6 — ownership (lead + allocation)', () => {
  it('apps.leadId scores 8 and floors optional', () => {
    const scored = scoreCandidate(baseFacts({ isLead: true }), baseCtx())
    expect(scored.scoreDet).toBe(8)
    expect(tierRank[scored.tier]).toBeGreaterThanOrEqual(tierRank.optional)
  })

  it('allocation bands: 1-24% -> 2, 25-49% -> 3, >=50% -> 4', () => {
    expect(scoreCandidate(baseFacts({ assignment: { allocationPct: 10 } }), baseCtx()).scoreDet).toBe(2)
    expect(scoreCandidate(baseFacts({ assignment: { allocationPct: 30 } }), baseCtx()).scoreDet).toBe(3)
    expect(scoreCandidate(baseFacts({ assignment: { allocationPct: 60 } }), baseCtx()).scoreDet).toBe(4)
  })

  it('any non-zero allocation floors optional', () => {
    const scored = scoreCandidate(baseFacts({ assignment: { allocationPct: 5 } }), baseCtx())
    expect(tierRank[scored.tier]).toBeGreaterThanOrEqual(tierRank.optional)
  })

  it('lead + allocation stack, capped at 12', () => {
    const scored = scoreCandidate(baseFacts({ isLead: true, assignment: { allocationPct: 60 } }), baseCtx())
    expect(scored.scoreDet).toBe(12) // 8 + 4
  })

  it('lead-allowlist role heuristic (no leadId) scores 3, tagged heuristic, and does NOT floor', () => {
    const scored = scoreCandidate(baseFacts({ leadAllowlistRoleHeuristic: true }), baseCtx())
    expect(scored.scoreDet).toBe(3)
    expect(scored.tier).toBe('skip')
  })

  it('is never hard evidence', () => {
    const scored = scoreCandidate(baseFacts({ isLead: true }), baseCtx())
    expect(scored.hardEvidenceCount).toBe(0)
  })

  it('is UNAVAILABLE when the meeting has no app', () => {
    const scored = scoreCandidate(baseFacts({ isLead: true, assignment: { allocationPct: 60 } }), baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(0)
  })

  it('I1 (review round 1 regression): removing an assignment row never RAISES scoreDet', () => {
    // Reproduced by the reviewer against the pre-fix `else if`: a Tech Lead
    // assigned to Vela at 10% scored 2 (the allocation band); DELETING that
    // assignment (heuristic alone) scored 3 — removing evidence raised the
    // score. Fixed by making the allocation band and the heuristic
    // independently additive.
    const withAssignment = scoreCandidate(
      baseFacts({ leadAllowlistRoleHeuristic: true, assignment: { allocationPct: 10 }, roleTokens: ['Tech Lead'] }),
      baseCtx(),
    )
    const withoutAssignment = scoreCandidate(
      baseFacts({ leadAllowlistRoleHeuristic: true, assignment: null, roleTokens: ['Tech Lead'] }),
      baseCtx(),
    )
    expect(withAssignment.scoreDet).toBe(5) // 2 (allocation band) + 3 (heuristic)
    expect(withoutAssignment.scoreDet).toBe(3) // heuristic alone
    expect(withoutAssignment.scoreDet).toBeLessThanOrEqual(withAssignment.scoreDet)
  })
})

// ---------------------------------------------------------------------------
// E7 — attendance habit
// ---------------------------------------------------------------------------

describe('E7 — attendance habit', () => {
  it('bands: >=0.8 -> 6, >=0.5 -> 4, >=0.25 -> 2, else 0', () => {
    expect(scoreCandidate(baseFacts({ attendance: { occurrences: 6, attended: 5 } }), baseCtx({ appId: null })).scoreDet).toBe(6)
    expect(scoreCandidate(baseFacts({ attendance: { occurrences: 6, attended: 3 } }), baseCtx({ appId: null })).scoreDet).toBe(4)
    expect(scoreCandidate(baseFacts({ attendance: { occurrences: 6, attended: 2 } }), baseCtx({ appId: null })).scoreDet).toBe(2)
    expect(scoreCandidate(baseFacts({ attendance: { occurrences: 6, attended: 1 } }), baseCtx({ appId: null })).scoreDet).toBe(0)
  })

  it('is UNAVAILABLE with fewer than 2 prior occurrences', () => {
    const scored = scoreCandidate(baseFacts({ attendance: { occurrences: 1, attended: 1 } }), baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(0)
  })

  it('is never hard evidence, and 6 points alone can never reach the 30-point required threshold', () => {
    const scored = scoreCandidate(baseFacts({ attendance: { occurrences: 6, attended: 6 } }), baseCtx({ appId: null }))
    expect(scored.hardEvidenceCount).toBe(0)
    expect(scored.tier).not.toBe('required')
  })
})

// ---------------------------------------------------------------------------
// A1 — Gemini agenda-topic relevance (already validated by the caller)
// ---------------------------------------------------------------------------

describe('A1 — Gemini relevance', () => {
  it('adds to scoreTotal but never to scoreDet, capped at 10', () => {
    const facts = baseFacts({ aiRelevance: { points: 10, agendaQuote: 'the checkout flow mockups', evidenceQuote: 'UI/UX Designer', evidenceId: null } })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(0)
    expect(scored.scoreTotal).toBe(10)
  })

  it('a perfect A1 with nothing else totals 10, which is below the 12-point optional line', () => {
    const facts = baseFacts({ aiRelevance: { points: 10, agendaQuote: 'the checkout flow mockups', evidenceQuote: 'UI/UX Designer', evidenceId: null } })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.tier).toBe('skip')
  })

  it('A1 points can never carry a candidate over the required line by arithmetic', () => {
    // 29 deterministic points (just under required) + a perfect A1 score
    const facts = baseFacts({
      followups: [
        { id: 'f1', humanAdded: true, kind: 'question', sourceMeetingTitle: 'Vela Weekly', sourceMeetingStartsAt: daysBefore(45), attribution: 'resolved', resolvedInThisMeeting: false, text: 'x' },
      ],
      aiRelevance: { points: 10, agendaQuote: 'the checkout flow mockups', evidenceQuote: 'x', evidenceId: null },
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(9) // 12*0.75
    expect(scored.scoreTotal).toBe(19)
    expect(scored.tier).not.toBe('required')
  })

  it('contributes 0 and stores an ai_unavailable caveat when the AI pass did not run', () => {
    const facts = baseFacts({ aiRelevance: { points: 10, agendaQuote: 'x', evidenceQuote: 'y', evidenceId: null } })
    const scored = scoreCandidate(facts, baseCtx({ appId: null, aiUnavailable: true }))
    expect(scored.scoreTotal).toBe(0)
    expect(scored.caveats.some((c) => c.code === 'ai_unavailable')).toBe(true)
  })

  it('I3 (review round 1 regression): contributes 0 when the agenda does not qualify, even if aiRelevance IS populated', () => {
    // Reproduced by the reviewer: agenda null + title '1:1' + E7=2 + A1=10 =>
    // scoreTotal 12 => OPTIONAL — the AI created a Google-Calendar-visible
    // invite in exactly the state the spec says it must never speak in ("A1
    // is not called at all and contributes 0"). This can happen honestly
    // (e.g. a stale cached A1 result from before the agenda was cleared), so
    // the scorer itself — not just the caller — must refuse to credit it.
    const facts = baseFacts({
      attendance: { occurrences: 6, attended: 2 }, // E7 band 2
      aiRelevance: { points: 10, agendaQuote: 'x', evidenceQuote: 'y', evidenceId: null },
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null, meetingTitle: '1:1', meetingAgenda: null }))
    expect(scored.scoreTotal).toBe(2) // E7 only — A1 refused
    expect(scored.tier).toBe('skip')
    expect(scored.reasons.some((r) => r.code === 'agenda_match')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tiering thresholds — exact edges
// ---------------------------------------------------------------------------

describe('tiering thresholds — exact edges', () => {
  // Every combination below is hand-verified arithmetic using ONLY E1 (whose
  // per-item points are exact under integer day offsets landing on clean
  // recency bands) so the family cap/rounding logic never has to be reasoned
  // about jointly with a second family.
  //   item value = (humanAdded ? 12 : 6) + (action ? 2 : 0), times recency
  //   1.0 (day<=14) / 0.75 (day<=45) / 0.5 (day<=120) / 0.25 (day>120)
  function e1Item(id: string, opts: { humanAdded: boolean; action?: boolean; days: number }): CandidateFacts['followups'][number] {
    return {
      id,
      humanAdded: opts.humanAdded,
      kind: opts.action ? 'action' : 'question',
      sourceMeetingTitle: 'Vela Weekly',
      sourceMeetingStartsAt: daysBefore(opts.days),
      attribution: 'resolved',
      resolvedInThisMeeting: false,
      text: 'x',
    }
  }

  // NOTE: these two pin the R2 arithmetic threshold in isolation, so they use
  // an app-having ctx (baseCtx() default) rather than `appId: null` — with no
  // app, the R8 ceiling would demote an otherwise-required candidate back to
  // optional regardless of scoreDet, which is a DIFFERENT rule (covered under
  // "R8 ceiling" below) and would make this test pass for the wrong reason.

  it('scoreDet exactly 29 (with hard evidence) -> optional, NOT required', () => {
    // 14 (action, human, day=1 -> x1.0) + 9 (question, human, day=30 -> x0.75)
    // + 6 (question, human, day=60 -> x0.5) = 29
    const facts = baseFacts({
      followups: [
        e1Item('f1', { humanAdded: true, action: true, days: 1 }),
        e1Item('f2', { humanAdded: true, days: 30 }),
        e1Item('f3', { humanAdded: true, days: 60 }),
      ],
    })
    const scored = scoreCandidate(facts, baseCtx())
    expect(scored.scoreDet).toBe(29)
    expect(scored.hardEvidenceCount).toBeGreaterThanOrEqual(1)
    expect(scored.tier).toBe('optional')
  })

  it('scoreDet exactly 30 (with hard evidence) -> required', () => {
    // 12 (question, human, day=1) + 9 (question, human, day=30) + 9 (question, human, day=30) = 30
    const facts = baseFacts({
      followups: [
        e1Item('f1', { humanAdded: true, days: 1 }),
        e1Item('f2', { humanAdded: true, days: 30 }),
        e1Item('f3', { humanAdded: true, days: 30 }),
      ],
    })
    const scored = scoreCandidate(facts, baseCtx())
    expect(scored.scoreDet).toBe(30)
    expect(scored.hardEvidenceCount).toBeGreaterThanOrEqual(1)
    expect(scored.tier).toBe('required')
  })

  // V5 (review round 1): these two used to construct `aiRelevance.points: 3`
  // and `4` — values `AiRelevanceEvidence`'s own doc says are IMPOSSIBLE
  // (Task 5's validator only ever produces score 0|1|2 x 5 = 0, 5, or 10).
  // Rebuilt on legal A1 values, using E4 point-count instead of an illegal
  // A1 value to hit the exact totals.

  it('scoreTotal exactly 11, no hard evidence -> skip', () => {
    // E4: one meeting at 3 points, full recency -> 3*2*1.0=6. E7: band 0
    // (ratio 0, still >=2 occurrences so the family is available). A1: 5
    // (a legal score-1 result). Total = 6+0+5 = 11.
    const facts = baseFacts({
      discussionMeetings: [{ meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), points: 3 }],
      attendance: { occurrences: 6, attended: 0 },
      aiRelevance: { points: 5, agendaQuote: 'x', evidenceQuote: 'y', evidenceId: null },
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.hardEvidenceCount).toBe(0)
    expect(scored.scoreTotal).toBe(11)
    expect(scored.tier).toBe('skip')
  })

  it('scoreTotal exactly 12, no hard evidence -> optional', () => {
    // E4: one meeting at 1 point, full recency -> 1*2*1.0=2. E7: band 0.
    // A1: 10 (a legal score-2 result). Total = 2+0+10 = 12.
    const facts = baseFacts({
      discussionMeetings: [{ meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), points: 1 }],
      attendance: { occurrences: 6, attended: 0 },
      aiRelevance: { points: 10, agendaQuote: 'x', evidenceQuote: 'y', evidenceId: null },
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.hardEvidenceCount).toBe(0)
    expect(scored.scoreTotal).toBe(12)
    expect(scored.tier).toBe('optional')
  })
})

// ---------------------------------------------------------------------------
// Floors (R5)
// ---------------------------------------------------------------------------

describe('R5 floors — minimum tier optional', () => {
  it('any non-zero allocation on the app floors optional', () => {
    expect(scoreCandidate(baseFacts({ assignment: { allocationPct: 5 } }), baseCtx()).tier).toBe('optional')
  })
  it('apps.leadId floors optional', () => {
    expect(scoreCandidate(baseFacts({ isLead: true }), baseCtx()).tier).toBe('optional')
  })
  it('hardEvidence >= 1 floors optional even with 0 deterministic points elsewhere', () => {
    const facts = baseFacts({
      followups: [
        { id: 'f1', humanAdded: false, kind: 'question', sourceMeetingTitle: 'Vela Weekly', sourceMeetingStartsAt: daysBefore(200), attribution: 'resolved', resolvedInThisMeeting: false, text: 'x' },
      ],
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.hardEvidenceCount).toBe(1)
    expect(scored.tier).toBe('optional')
  })
  it('a person under 21 days old floors optional, with a new_person caveat', () => {
    const scored = scoreCandidate(baseFacts({ candidateJoinedAt: daysBefore(-6) }), baseCtx({ appId: null }))
    // daysBefore(-6) relative to meetingDay == 6 days before "today" too, since today===meetingDay here
    expect(scored.tier).toBe('optional')
    expect(scored.caveats.some((c) => c.code === 'new_person')).toBe(true)
  })
  it('an existing (human) meeting_attendees row floors optional', () => {
    expect(scoreCandidate(baseFacts({ existingAttendeeRow: true }), baseCtx({ appId: null })).tier).toBe('optional')
  })
  it('an attendee of the immediately previous occurrence floors optional', () => {
    expect(scoreCandidate(baseFacts({ attendedPreviousOccurrence: true }), baseCtx({ appId: null })).tier).toBe('optional')
  })
  it('a self opt-in floors optional and outranks everything else about that candidate', () => {
    expect(scoreCandidate(baseFacts({ selfOptIn: true }), baseCtx({ appId: null })).tier).toBe('optional')
  })
  it('tiny pool (<=4) disables skip entirely for every candidate', () => {
    const scored = scoreCandidate(baseFacts(), baseCtx({ appId: null, poolSize: 4 }))
    expect(scored.tier).toBe('optional')
  })
  it('pool > 4 does NOT float an otherwise-empty candidate to optional', () => {
    const scored = scoreCandidate(baseFacts(), baseCtx({ appId: null, poolSize: 12 }))
    expect(scored.tier).toBe('skip')
  })
})

describe('R7 hard overrides — beat everything', () => {
  it('the organizer is always required, regardless of any other evidence', () => {
    const scored = scoreCandidate(baseFacts({ isOrganizer: true }), baseCtx({ appId: null }))
    expect(scored.tier).toBe('required')
  })
  it('a pinned follow-up is always required', () => {
    const scored = scoreCandidate(
      baseFacts({ pinnedFollowups: [{ id: 'p1', text: 'x', pinnedByName: 'Nuwan', pinnedOnDate: daysBefore(1) }] }),
      baseCtx({ appId: null }),
    )
    expect(scored.tier).toBe('required')
  })
})

describe('R8 ceiling — no appId, no app inferred', () => {
  it('nobody may be required except organizer/pinned/a series regular, even with 30+ det points', () => {
    const facts = baseFacts({
      followups: [
        { id: 'f1', humanAdded: true, kind: 'question', sourceMeetingTitle: 'Vela Weekly', sourceMeetingStartsAt: daysBefore(1), attribution: 'resolved', resolvedInThisMeeting: false, text: 'x' },
      ],
      discussionMeetings: [{ meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), points: 3 }],
      voiceMeetings: [
        { meetingId: 'm2', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), candidateTurns: 15, resolvedTurnsTotal: 30, resolvedSpeakerCount: 3 },
      ],
      // ratio 0.5, below the 0.75 series-regular exemption threshold — this
      // fixture must be capped by the ceiling itself, not accidentally exempted.
      attendance: { occurrences: 6, attended: 3 },
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBeGreaterThanOrEqual(30)
    expect(scored.hardEvidenceCount).toBeGreaterThanOrEqual(1)
    expect(scored.tier).toBe('optional') // capped by the ceiling, not required
  })

  it('a series regular (attendedRatio >= 0.75 over >= 3 occurrences) is exempt from the ceiling', () => {
    const facts = baseFacts({
      followups: [
        { id: 'f1', humanAdded: true, kind: 'question', sourceMeetingTitle: 'Vela Weekly', sourceMeetingStartsAt: daysBefore(1), attribution: 'resolved', resolvedInThisMeeting: false, text: 'x' },
      ],
      discussionMeetings: [{ meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), points: 3 }],
      voiceMeetings: [
        { meetingId: 'm2', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), candidateTurns: 15, resolvedTurnsTotal: 30, resolvedSpeakerCount: 3 },
      ],
      attendance: { occurrences: 4, attended: 4 }, // ratio 1.0 over 4 occurrences
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null }))
    expect(scored.scoreDet).toBeGreaterThanOrEqual(30)
    expect(scored.tier).toBe('required')
  })

  it('the organizer is exempt from the ceiling', () => {
    const scored = scoreCandidate(baseFacts({ isOrganizer: true }), baseCtx({ appId: null }))
    expect(scored.tier).toBe('required')
  })
})

// ---------------------------------------------------------------------------
// Invariant: no signal may ever subtract (property/ablation test)
// ---------------------------------------------------------------------------

describe('invariant — removing evidence never raises tier', () => {
  // V1 (review round 1): the original fixture had exactly ONE followup, ONE
  // discussionMeeting and ONE voiceMeeting, so every ablation here emptied a
  // whole array — which can never distinguish "sum/average over N items" from
  // "sum/average over N-1 items" for N=1, and is exactly why the C1 defect
  // (E5's weighted average going DOWN when a second, real recording was
  // added) shipped green. Every array below now carries >=2 elements, and
  // the ablation list removes ONE element at a time in addition to emptying
  // the whole array.
  function kitchenSink(): CandidateFacts {
    return baseFacts({
      roleTokens: ['UI/UX Designer'],
      isOrganizer: false,
      followups: [
        { id: 'f1', humanAdded: true, kind: 'action', sourceMeetingTitle: 'Vela Weekly', sourceMeetingStartsAt: daysBefore(1), attribution: 'resolved', resolvedInThisMeeting: false, text: 'x' },
        { id: 'f2', humanAdded: true, kind: 'question', sourceMeetingTitle: 'Vela Weekly', sourceMeetingStartsAt: daysBefore(1), attribution: 'resolved', resolvedInThisMeeting: false, text: 'y' },
      ],
      pinnedFollowups: [],
      openTasks: [{ id: 't1', inProgress: true }, { id: 't2', inProgress: false }],
      runningSprint: { name: 'Sprint 12', endDate: daysBefore(-7), openTaskCount: 1 },
      discussionMeetings: [
        { meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), points: 2 },
        { meetingId: 'm3', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(3), points: 1 },
      ],
      // Two DIFFERENT bands on purpose (8 and 4) — this is what the C1 fix
      // (best-band, not weighted-average) is actually being exercised against:
      // removing the higher-band meeting must lower the family; removing the
      // lower-band one must never change it.
      voiceMeetings: [
        { meetingId: 'm2', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), candidateTurns: 15, resolvedTurnsTotal: 30, resolvedSpeakerCount: 3 }, // band 8
        { meetingId: 'm4', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(3), candidateTurns: 2, resolvedTurnsTotal: 40, resolvedSpeakerCount: 4 }, // band 2
      ],
      isLead: true,
      assignment: { allocationPct: 60 },
      attendance: { occurrences: 6, attended: 5 },
      aiRelevance: { points: 10, agendaQuote: 'the checkout flow mockups', evidenceQuote: 'x', evidenceId: null },
      existingAttendeeRow: true,
      selfOptIn: true,
    })
  }

  const ctx = baseCtx({ meetingAgenda: 'Review the checkout flow mockups before launch.' })

  const ablations: Array<[string, (f: CandidateFacts) => CandidateFacts]> = [
    ['remove followups (whole array)', (f) => ({ ...f, followups: [] })],
    ['remove ONE of two followups', (f) => ({ ...f, followups: f.followups.slice(1) })],
    ['remove openTasks (whole array)', (f) => ({ ...f, openTasks: [], runningSprint: null })],
    ['remove ONE of two openTasks', (f) => ({ ...f, openTasks: f.openTasks.slice(1) })],
    ['remove roleTokens (E3)', (f) => ({ ...f, roleTokens: [] })],
    ['remove discussionMeetings (whole array)', (f) => ({ ...f, discussionMeetings: [] })],
    ['remove ONE of two discussionMeetings (the higher-points one)', (f) => ({ ...f, discussionMeetings: f.discussionMeetings.slice(1) })],
    ['remove voiceMeetings (whole array)', (f) => ({ ...f, voiceMeetings: [] })],
    ['remove ONE of two voiceMeetings (the higher-band one — C1 regression)', (f) => ({ ...f, voiceMeetings: f.voiceMeetings.slice(1) })],
    ['remove ONE of two voiceMeetings (the LOWER-band one)', (f) => ({ ...f, voiceMeetings: f.voiceMeetings.slice(0, 1) })],
    ['remove isLead', (f) => ({ ...f, isLead: false })],
    ['remove assignment', (f) => ({ ...f, assignment: null })],
    ['remove attendance', (f) => ({ ...f, attendance: null })],
    ['remove aiRelevance', (f) => ({ ...f, aiRelevance: null })],
    ['remove existingAttendeeRow', (f) => ({ ...f, existingAttendeeRow: false })],
    ['remove selfOptIn', (f) => ({ ...f, selfOptIn: false })],
  ]

  it('baseline is required (sanity check that the fixture has teeth)', () => {
    const scored = scoreCandidate(kitchenSink(), ctx)
    expect(scored.tier).toBe('required')
  })

  for (const [label, ablate] of ablations) {
    it(`${label}: tier never increases, scoreDet/scoreTotal never increase, and every contribution stays >= 0`, () => {
      const before = scoreCandidate(kitchenSink(), ctx)
      const after = scoreCandidate(ablate(kitchenSink()), ctx)
      expect(tierRank[after.tier]).toBeLessThanOrEqual(tierRank[before.tier])
      expect(after.scoreDet).toBeLessThanOrEqual(before.scoreDet)
      expect(after.scoreTotal).toBeLessThanOrEqual(before.scoreTotal)
      expect(after.scoreDet).toBeGreaterThanOrEqual(0)
      expect(after.scoreTotal).toBeGreaterThanOrEqual(0)
      for (const r of after.reasons) expect(r.points).toBeGreaterThanOrEqual(0)
    })
  }

  it('removing the higher-band voice meeting strictly lowers E5 (C1 regression, direct)', () => {
    const full = scoreCandidate(kitchenSink(), ctx)
    const withoutHighBand = scoreCandidate({ ...kitchenSink(), voiceMeetings: kitchenSink().voiceMeetings.slice(1) }, ctx)
    expect(withoutHighBand.scoreDet).toBeLessThan(full.scoreDet)
  })

  it('removing ALL evidence from every family individually, in sequence, is monotonically non-increasing', () => {
    let facts = kitchenSink()
    let prevRank = tierRank[scoreCandidate(facts, ctx).tier]
    let prevDet = scoreCandidate(facts, ctx).scoreDet
    for (const [, ablate] of ablations) {
      facts = ablate(facts)
      const scored = scoreCandidate(facts, ctx)
      expect(tierRank[scored.tier]).toBeLessThanOrEqual(prevRank)
      expect(scored.scoreDet).toBeLessThanOrEqual(prevDet)
      prevRank = tierRank[scored.tier]
      prevDet = scored.scoreDet
    }
  })
})

// ---------------------------------------------------------------------------
// Abstain mode
// ---------------------------------------------------------------------------

describe('abstain mode', () => {
  it('fires with fewer than 2 distinct candidates carrying hard evidence', () => {
    const organizer = scoreCandidate(baseFacts({ userId: 'org', isOrganizer: true }), baseCtx({ appId: null }))
    const teammate = scoreCandidate(baseFacts({ userId: 'u2', assignment: { allocationPct: 40 } }), baseCtx({ appId: null }))
    const run = tierAll([organizer, teammate], baseCtx({ appId: null }))
    expect(run.abstained).toBe(true)
  })

  it('organizer required, everyone assigned to the app pre-filled optional, no tiers computed from arithmetic', () => {
    const organizer = scoreCandidate(baseFacts({ userId: 'org', isOrganizer: true }), baseCtx())
    const onApp = scoreCandidate(baseFacts({ userId: 'u2', assignment: { allocationPct: 20 } }), baseCtx())
    // this candidate has neither app assignment nor organizer/pinned status — must NOT be required
    // or optional purely because they happen to have a small amount of non-hard-evidence points
    const stray = scoreCandidate(
      baseFacts({ userId: 'u3', discussionMeetings: [{ meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), points: 3 }] }),
      baseCtx(),
    )
    const run = tierAll([organizer, onApp, stray], baseCtx())
    expect(run.abstained).toBe(true)
    const byId = new Map(run.scored.map((c) => [c.userId, c]))
    expect(byId.get('org')?.tier).toBe('required')
    expect(byId.get('u2')?.tier).toBe('optional')
    expect(byId.get('u3')?.tier).toBe('skip')
  })

  it('a pinned follow-up holder stays required in abstain mode', () => {
    const organizer = scoreCandidate(baseFacts({ userId: 'org', isOrganizer: true }), baseCtx({ appId: null }))
    const pinned = scoreCandidate(
      baseFacts({ userId: 'u2', pinnedFollowups: [{ id: 'p1', text: 'x', pinnedByName: 'Nuwan', pinnedOnDate: daysBefore(1) }] }),
      baseCtx({ appId: null }),
    )
    const run = tierAll([organizer, pinned], baseCtx({ appId: null }))
    expect(run.abstained).toBe(true)
    expect(run.scored.find((c) => c.userId === 'u2')?.tier).toBe('required')
  })

  it('makes no negative statement: every reason has non-negative points and no banned phrasing, even for the skipped stray', () => {
    // V3 (review round 1): the original assertion here (`reasons.length +
    // caveats.length >= 0`) is true for every possible input — it never
    // failed no matter what the run produced. Assert something a real defect
    // could actually trip: no reason ever carries negative points, and no
    // rendered text (reason OR caveat, in en) uses the banned vague/
    // confidence phrasing this ledger has no vocabulary for.
    const organizer = scoreCandidate(baseFacts({ userId: 'org', isOrganizer: true }), baseCtx({ appId: null }))
    const stray = scoreCandidate(
      baseFacts({ userId: 'u2', discussionMeetings: [{ meetingId: 'm1', meetingTitle: 'Vela Weekly', meetingStartsAt: daysBefore(1), points: 3 }] }),
      baseCtx({ appId: null }),
    )
    const run = tierAll([organizer, stray], baseCtx({ appId: null }))
    expect(run.scored.find((c) => c.userId === 'u2')?.tier).toBe('skip')
    for (const c of run.scored) {
      for (const r of c.reasons) {
        expect(r.points).toBeGreaterThanOrEqual(0)
        for (const phrase of BANNED_PHRASES) expect(r.en.toLowerCase()).not.toContain(phrase)
      }
      for (const cv of c.caveats) {
        for (const phrase of BANNED_PHRASES) expect(cv.en.toLowerCase()).not.toContain(phrase)
      }
    }
  })

  it('V6 (review round 1): tierAll flags requiredOverflow when more than 8 land in required', () => {
    // 9 candidates each pinned to this meeting — a hard override (always
    // required) that ALSO counts as hard evidence, so 9 distinct
    // hard-evidence candidates keeps the run out of abstain mode.
    const nine = Array.from({ length: 9 }, (_, i) =>
      scoreCandidate(
        baseFacts({
          userId: `u${i}`,
          pinnedFollowups: [{ id: `p${i}`, text: 'x', pinnedByName: 'Nuwan', pinnedOnDate: daysBefore(1) }],
        }),
        baseCtx({ appId: null }),
      ),
    )
    const run = tierAll(nine, baseCtx({ appId: null }))
    expect(run.abstained).toBe(false)
    expect(run.requiredCount).toBe(9)
    expect(run.requiredOverflow).toBe(true)
    // R10 is a warning only — never an automatic demotion.
    expect(run.scored.every((c) => c.tier === 'required')).toBe(true)
  })

  it('requiredOverflow is false at exactly 8 required', () => {
    const eight = Array.from({ length: 8 }, (_, i) =>
      scoreCandidate(
        baseFacts({
          userId: `u${i}`,
          pinnedFollowups: [{ id: `p${i}`, text: 'x', pinnedByName: 'Nuwan', pinnedOnDate: daysBefore(1) }],
        }),
        baseCtx({ appId: null }),
      ),
    )
    const run = tierAll(eight, baseCtx({ appId: null }))
    expect(run.requiredCount).toBe(8)
    expect(run.requiredOverflow).toBe(false)
  })

  it('is the default (modal) path when only one candidate has hard evidence', () => {
    const organizer = scoreCandidate(baseFacts({ userId: 'org', isOrganizer: true }), baseCtx({ appId: null }))
    const oneHard = scoreCandidate(
      baseFacts({
        userId: 'u2',
        followups: [
          { id: 'f1', humanAdded: true, kind: 'question', sourceMeetingTitle: 'Vela Weekly', sourceMeetingStartsAt: daysBefore(1), attribution: 'resolved', resolvedInThisMeeting: false, text: 'x' },
        ],
      }),
      baseCtx({ appId: null }),
    )
    const run = tierAll([organizer, oneHard], baseCtx({ appId: null }))
    expect(run.abstained).toBe(true)
  })

  it('does NOT fire once 2 distinct candidates carry hard evidence', () => {
    const a = scoreCandidate(
      baseFacts({
        userId: 'a',
        followups: [
          { id: 'f1', humanAdded: true, kind: 'question', sourceMeetingTitle: 'Vela Weekly', sourceMeetingStartsAt: daysBefore(1), attribution: 'resolved', resolvedInThisMeeting: false, text: 'x' },
        ],
      }),
      baseCtx({ appId: null }),
    )
    const b = scoreCandidate(
      baseFacts({
        userId: 'b',
        openTasks: [{ id: 't1', inProgress: false }],
      }),
      baseCtx(),
    )
    const run = tierAll([a, b], baseCtx())
    expect(run.abstained).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Degradation
// ---------------------------------------------------------------------------

describe('degradation — no appId', () => {
  it('E2, E3, E6 are all zero regardless of populated facts', () => {
    const facts = baseFacts({
      roleTokens: ['UI/UX Designer'],
      openTasks: [{ id: 't1', inProgress: false }],
      isLead: true,
      assignment: { allocationPct: 60 },
    })
    const scored = scoreCandidate(facts, baseCtx({ appId: null, meetingAgenda: 'Review the checkout flow mockups.' }))
    expect(scored.scoreDet).toBe(0)
  })
})

describe('degradation — no transcripts', () => {
  it('E4 and E5 are unavailable (0, no penalty) when the caller supplies none', () => {
    const scored = scoreCandidate(baseFacts(), baseCtx({ appId: null }))
    expect(scored.scoreDet).toBe(0)
    expect(scored.tier).toBe('skip')
  })
})

describe('no_series caveat', () => {
  it('M4 (review round 1 regression): fires even when NO series was inferred at all (seriesTitle null)', () => {
    // Previously gated on `ctx.seriesTitle` being truthy, which suppressed
    // this caveat EXACTLY in the case that most needs the explanation: no
    // series exists, so `seriesOccurrenceCount` is 0 and `seriesTitle` is
    // null — and the caveat vanished instead of explaining why E4/E5/E7 are
    // all silently zero.
    const scored = scoreCandidate(baseFacts(), baseCtx({ appId: null, seriesTitle: null, seriesOccurrenceCount: 0 }))
    const caveat = scored.caveats.find((c) => c.code === 'no_series')
    expect(caveat).toBeTruthy()
    expect(caveat?.en).toContain('0')
  })

  it('still fires with a thin (1-occurrence) established series, citing the real title', () => {
    const scored = scoreCandidate(baseFacts(), baseCtx({ appId: null, seriesTitle: 'Vela Weekly', seriesOccurrenceCount: 1 }))
    const caveat = scored.caveats.find((c) => c.code === 'no_series')
    expect(caveat?.en).toContain('Vela Weekly')
    expect(caveat?.en).toContain('1')
  })

  it('does NOT fire once the series is established (>= 2 occurrences)', () => {
    const scored = scoreCandidate(baseFacts(), baseCtx({ appId: null, seriesTitle: 'Vela Weekly', seriesOccurrenceCount: 2 }))
    expect(scored.caveats.some((c) => c.code === 'no_series')).toBe(false)
  })
})

describe('degradation — tiny pool', () => {
  it('pool <= 4 disables skip entirely for every candidate regardless of evidence', () => {
    const scored = scoreCandidate(baseFacts(), baseCtx({ appId: null, poolSize: 3 }))
    expect(scored.tier).not.toBe('skip')
  })
})

describe('degradation — no agenda', () => {
  it('E3 falls back to title tokens and A1 never contributes when the title itself is too short', () => {
    const facts = baseFacts({ roleTokens: ['UI/UX Designer'], aiRelevance: null })
    const scored = scoreCandidate(facts, baseCtx({ meetingTitle: '1:1', meetingAgenda: null }))
    expect(scored.scoreDet).toBe(0)
  })

  it('a sufficiently descriptive title alone (no agenda) still lets E3 match', () => {
    const facts = baseFacts({ roleTokens: ['UI/UX Designer'] })
    const scored = scoreCandidate(facts, baseCtx({ meetingTitle: 'Design review sync', meetingAgenda: null }))
    expect(scored.scoreDet).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Reason & caveat templates — the lint
// ---------------------------------------------------------------------------

const BANNED_PHRASES = [
  'seems relevant',
  'often contributes',
  'likely needed',
  'key stakeholder',
  'high engagement',
  'usually attends',
  // confidence adjectives
  'probably',
  'likely',
  'possibly',
  'clearly',
  'obviously',
]

const NUMBER_PLACEHOLDERS = new Set([
  'count', 'points', 'pct', 'days', 'turns', 'candidateTurns', 'totalTurns', 'attended',
  'occurrences', 'meetingCount', 'inProgressCount', 'openCount', 'unresolved', 'total',
])
const PROPER_NOUN_PLACEHOLDERS = new Set([
  'appName', 'seriesTitle', 'role', 'pinnedByName', 'sourceTitle', 'meetingTitle',
  'otherMeetingTitle', 'sprintName', 'quote',
  // Verbatim, auditable quoted spans — the same "specific fact, not vibes"
  // evidentiary role a proper noun plays; agenda_match's whole point is
  // citing exact text rather than asserting a generic claim.
  'agendaQuote', 'evidenceQuote',
])
const DATE_PLACEHOLDERS = new Set(['pinnedDate', 'sourceDate', 'sprintEndDate', 'date', 'startTime', 'endTime'])

function templatePlaceholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
}

describe('REASON_TEMPLATES (lint)', () => {
  it('every template contains a NUMBER, a PROPER NOUN placeholder, or a DATE (en and si)', () => {
    const offenders: string[] = []
    for (const t of REASON_TEMPLATES) {
      for (const [lang, text] of [['en', t.en], ['si', t.si]] as const) {
        const placeholders = templatePlaceholders(text)
        const ok = placeholders.some((p) => NUMBER_PLACEHOLDERS.has(p) || PROPER_NOUN_PLACEHOLDERS.has(p) || DATE_PLACEHOLDERS.has(p))
        if (!ok) offenders.push(`${t.code} (${lang}): "${text}"`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('never uses a banned vague/confidence phrase, in en OR si', () => {
    // M1 (review round 1): this loop only ever checked `t.en` despite its own
    // title claiming "in en or si" — the Sinhala half of the table was never
    // linted for the banned English phrases (which, transliterated or left
    // in Latin script inline, could still leak in).
    const offenders: string[] = []
    for (const t of REASON_TEMPLATES) {
      for (const [lang, text] of [['en', t.en], ['si', t.si]] as const) {
        for (const phrase of BANNED_PHRASES) {
          if (text.toLowerCase().includes(phrase)) offenders.push(`${t.code} (${lang}): "${phrase}"`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('covers exactly the ReasonCode union — no stray, no missing (compile-time exhaustive)', () => {
    // V4 (review round 1): the old assertion only checked for DUPLICATES
    // within REASON_TEMPLATES' own code list, which can never catch a code
    // declared in the `ReasonCode` union with no template at all (or vice
    // versa) — `followup_redacted` and `conflict` are real ReasonCode values
    // this module never emits itself (redaction projector / calendar-conflict
    // orchestrator own those), but they still need a template entry, and this
    // object literal makes the check compile-time exhaustive: adding a new
    // ReasonCode without an entry here is a TS error, not a silent gap.
    const exhaustive: Record<ReasonCode, true> = {
      followup_pinned: true,
      followup_open: true,
      followup_answered_here: true,
      followup_redacted: true,
      task_open: true,
      task_sprint: true,
      role_topic: true,
      role_topic_tech: true,
      discussed: true,
      spoke: true,
      lead: true,
      allocated: true,
      lead_role_heuristic: true,
      attended: true,
      previous_occurrence: true,
      already_invited: true,
      agenda_match: true,
      organizer: true,
      opted_in: true,
      conflict: true,
    }
    const allCodes = Object.keys(exhaustive).sort()
    const templateCodes = [...new Set(REASON_TEMPLATES.map((t) => t.code))].sort()
    expect(templateCodes).toEqual(allCodes)
  })

  it('every template has non-empty en and si text', () => {
    for (const t of REASON_TEMPLATES) {
      expect(t.en.trim().length).toBeGreaterThan(0)
      expect(t.si.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('CAVEAT_TEMPLATES (lint)', () => {
  it('every template contains a NUMBER, a PROPER NOUN placeholder, or a DATE (en and si)', () => {
    // M2 (review round 1): CAVEAT_TEMPLATES previously never got this lint at
    // all (only REASON_TEMPLATES did) — `ai_unavailable` shipped with no such
    // placeholder. The spec says "every line" carries a number/proper-noun/
    // date, not "every reason line".
    const offenders: string[] = []
    for (const t of CAVEAT_TEMPLATES) {
      for (const [lang, text] of [['en', t.en], ['si', t.si]] as const) {
        const placeholders = templatePlaceholders(text)
        const ok = placeholders.some((p) => NUMBER_PLACEHOLDERS.has(p) || PROPER_NOUN_PLACEHOLDERS.has(p) || DATE_PLACEHOLDERS.has(p))
        if (!ok) offenders.push(`${t.code} (${lang}): "${text}"`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('never uses a banned vague/confidence phrase, in en OR si', () => {
    const offenders: string[] = []
    for (const t of CAVEAT_TEMPLATES) {
      for (const [lang, text] of [['en', t.en], ['si', t.si]] as const) {
        for (const phrase of BANNED_PHRASES) {
          if (text.toLowerCase().includes(phrase)) offenders.push(`${t.code} (${lang}): "${phrase}"`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('covers exactly the CaveatCode union — no stray, no missing (compile-time exhaustive)', () => {
    const exhaustive: Record<CaveatCode, true> = {
      inferred_app: true,
      ai_unavailable: true,
      thin_evidence: true,
      no_series: true,
      new_person: true,
      speaker_unresolved: true,
      returner: true,
    }
    const allCodes = Object.keys(exhaustive).sort()
    const templateCodes = [...new Set(CAVEAT_TEMPLATES.map((t) => t.code))].sort()
    expect(templateCodes).toEqual(allCodes)
  })

  it('every template has non-empty en and si text', () => {
    for (const t of CAVEAT_TEMPLATES) {
      expect(t.en.trim().length).toBeGreaterThan(0)
      expect(t.si.trim().length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

describe('purity', () => {
  it('scoreCandidate is a pure function of its inputs (same input -> same output)', () => {
    const facts = baseFacts({ isLead: true, assignment: { allocationPct: 40 } })
    const ctx = baseCtx()
    const a = scoreCandidate(facts, ctx)
    const b = scoreCandidate(facts, ctx)
    expect(a).toEqual(b)
  })
})

// Silence unused-import complaints for types referenced only structurally above.
void (null as unknown as ScoredCandidate)
