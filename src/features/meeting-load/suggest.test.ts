import { describe, expect, it } from 'vitest'
import {
  ALLOWED_OCCURRENCE_KEYS, aggregateSuggestions, inviteJaccard, suggest,
  type AnalyzedOccurrence, type SeriesMetrics,
} from './suggest'

// ---------------------------------------------------------------------------
// Fixtures, written by value. Every threshold below is exercised from both
// sides, because a rule that only ever fires is a rule nobody has tested.
// ---------------------------------------------------------------------------

const NO_KEYS: ReadonlySet<string> = new Set()

function analyzed(over: Partial<AnalyzedOccurrence> = {}): AnalyzedOccurrence {
  return {
    meetingId: 'm1',
    model: 'gemini-2.5',
    aiDerivedOutputs: 0,
    mappedSpeakers: 2,
    voiceTurns: 8,
    isoWeek: '2026-W34',
    hardEvidencePool: 0,
    ...over,
  }
}

function series(over: Partial<SeriesMetrics> = {}): SeriesMetrics {
  return {
    groupKey: 'vela standup|app-1',
    seriesKey: 'vela standup',
    title: 'Vela standup',
    appId: 'app-1',
    mergeable: true,
    established: true,
    activeRecently: true,
    organizerId: 'user-1',
    occurrenceCountInWindow: 3,
    medianDurationMinutes: 30,
    invitedHoursPerWeek: 1,
    consideredCountLast4: 4,
    last4Analyzed: [analyzed({ meetingId: 'a' }), analyzed({ meetingId: 'b' })],
    last3InviteSets: [['a', 'b'], ['a', 'b'], ['a', 'b']],
    ...over,
  }
}

const kinds = (table: SeriesMetrics[], decided: ReadonlySet<string> = NO_KEYS) =>
  suggest(table, decided).map((s) => s.kind)

// ---------------------------------------------------------------------------

describe('the structural guard: no waste metric reaches any rule', () => {
  it('has no RSVP, declined or attendance field on the occurrence type', () => {
    // Asserted on the TYPE, not by inspection. .ics invites carry RSVP=TRUE and
    // mail clients never write back, so "pending" measures widget adoption
    // rather than intent — a rule that could see it would eventually use it,
    // and would propose cancelling meetings the whole team attends.
    const keys = Object.keys(analyzed({ zeroEvidenceInviteeIds: [] })).sort()
    expect(keys).toEqual([...ALLOWED_OCCURRENCE_KEYS].sort())
    for (const banned of ['response', 'pending', 'declined', 'attendance', 'attended']) {
      expect(ALLOWED_OCCURRENCE_KEYS).not.toContain(banned)
    }
  })

  it('rejects a widened occurrence at build time', () => {
    // @ts-expect-error — adding a response field must break the build rather
    // than quietly widening what the engine can see.
    const widened: AnalyzedOccurrence = { ...analyzed(), response: 'declined' }
    expect(widened.meetingId).toBe('m1')
  })
})

describe('the gates, applied to every rule', () => {
  it('says nothing about a series that is not established', () => {
    expect(kinds([series({ established: false, invitedHoursPerWeek: 40, last4Analyzed: [] })]))
      .toEqual([])
  })

  it('says nothing about a series that has gone quiet', () => {
    // Ages out the abandoned half of a title-edit fork, which would otherwise
    // sit here forever as a perfectly established series nobody holds.
    expect(kinds([series({ activeRecently: false, invitedHoursPerWeek: 40, last4Analyzed: [] })]))
      .toEqual([])
  })
})

describe('R1 CANCEL-REVIEW', () => {
  const cancellable = series({
    occurrenceCountInWindow: 3,
    consideredCountLast4: 4,
    last4Analyzed: [
      analyzed({ meetingId: 'a', aiDerivedOutputs: 0, voiceTurns: 8, mappedSpeakers: 2 }),
      analyzed({ meetingId: 'b', aiDerivedOutputs: 0, voiceTurns: 8, mappedSpeakers: 2 }),
    ],
  })

  it('fires on a recorded, output-free, barely-discussed series', () => {
    expect(kinds([cancellable])).toContain('cancel_review')
  })

  it('carries the spec’s exact copy, with the real occurrence count', () => {
    const [found] = suggest([cancellable], NO_KEYS).filter((s) => s.kind === 'cancel_review')
    expect(found.copy).toBe(
      'Review: 3 recorded occurrences, no tracked outputs, little discussion — '
      + 'cancel or move async? (Unrecorded series are not evaluated.)',
    )
  })

  it('interpolates the count rather than hardcoding it', () => {
    const five = series({ ...cancellable, occurrenceCountInWindow: 5 })
    const [found] = suggest([five], NO_KEYS).filter((s) => s.kind === 'cancel_review')
    expect(found.copy).toContain('5 recorded occurrences')
  })

  it('NEVER fires on a busy design crit with nothing written down', () => {
    // The single most important negative test in the suite. Output count is a
    // proxy for value; discussion is the check on that proxy, and it wins.
    const crit = series({
      ...cancellable,
      last4Analyzed: [
        analyzed({ meetingId: 'a', aiDerivedOutputs: 0, voiceTurns: 40, mappedSpeakers: 6 }),
        analyzed({ meetingId: 'b', aiDerivedOutputs: 0, voiceTurns: 38, mappedSpeakers: 6 }),
      ],
    })
    expect(kinds([crit])).not.toContain('cancel_review')
  })

  it('still fires when a human typed one manual follow-up', () => {
    // The gaming-resistance case the AI/manual split exists for: manual items
    // never reach this rule, so a series cannot be immunised by typing.
    expect(kinds([cancellable])).toContain('cancel_review')
  })

  it('is suppressed below 50% coverage and fires at exactly 50%', () => {
    const oneOfFour = series({ ...cancellable, last4Analyzed: [analyzed({ meetingId: 'a' })] })
    expect(kinds([oneOfFour])).not.toContain('cancel_review')
    expect(kinds([cancellable])).toContain('cancel_review') // 2 of 4
  })

  it('is suppressed below three occurrences', () => {
    expect(kinds([series({ ...cancellable, occurrenceCountInWindow: 2 })]))
      .not.toContain('cancel_review')
  })

  it('is suppressed the moment one occurrence produced anything', () => {
    const produced = series({
      ...cancellable,
      last4Analyzed: [
        analyzed({ meetingId: 'a', aiDerivedOutputs: 1 }),
        analyzed({ meetingId: 'b', aiDerivedOutputs: 0 }),
      ],
    })
    expect(kinds([produced])).not.toContain('cancel_review')
  })
})

describe('R2 SHORTEN', () => {
  const long = series({
    medianDurationMinutes: 60,
    last4Analyzed: [
      analyzed({ meetingId: 'a', model: 'gemini-2.5', aiDerivedOutputs: 0, voiceTurns: 10 }),
      analyzed({ meetingId: 'b', model: 'gemini-2.5', aiDerivedOutputs: 1, voiceTurns: 12 }),
    ],
  })

  it('fires on a long series that fills less than its slot', () => {
    expect(kinds([long])).toContain('shorten')
  })

  it('proposes the next 15-minute step down, in evidence rather than copy', () => {
    // The design gives no exact sentence for R2, and inventing one that reads
    // as spec-given is how an unapproved wording becomes permanent.
    const [found] = suggest([long], NO_KEYS).filter((s) => s.kind === 'shorten')
    expect(found.evidence.proposedMinutes).toBe(45)

    const shorter = series({ ...long, medianDurationMinutes: 45 })
    const [next] = suggest([shorter], NO_KEYS).filter((s) => s.kind === 'shorten')
    expect(next.evidence.proposedMinutes).toBe(30)
  })

  it('is suppressed under 45 minutes', () => {
    expect(kinds([series({ ...long, medianDurationMinutes: 44 })])).not.toContain('shorten')
  })

  it('is suppressed when the model changed mid-window', () => {
    // Two Gemini versions do not extract at the same rate, so "outputs fell" is
    // a statement about the upgrade. There is no honest adjustment for it.
    const switched = series({
      ...long,
      last4Analyzed: [
        analyzed({ meetingId: 'a', model: 'gemini-2.5', aiDerivedOutputs: 0, voiceTurns: 10 }),
        analyzed({ meetingId: 'b', model: 'gemini-2.0', aiDerivedOutputs: 0, voiceTurns: 10 }),
      ],
    })
    expect(kinds([switched])).not.toContain('shorten')
  })

  it('is suppressed once the room is actually talking', () => {
    const busy = series({
      ...long,
      last4Analyzed: [
        analyzed({ meetingId: 'a', voiceTurns: 20, aiDerivedOutputs: 0 }),
        analyzed({ meetingId: 'b', voiceTurns: 30, aiDerivedOutputs: 0 }),
      ],
    })
    expect(kinds([busy])).not.toContain('shorten')
  })

  it('is suppressed once it is producing more than one thing an occurrence', () => {
    const productive = series({
      ...long,
      last4Analyzed: [
        analyzed({ meetingId: 'a', aiDerivedOutputs: 2, voiceTurns: 10 }),
        analyzed({ meetingId: 'b', aiDerivedOutputs: 3, voiceTurns: 10 }),
      ],
    })
    expect(kinds([productive])).not.toContain('shorten')
  })
})

describe('R3 SHARE-A-SLOT', () => {
  const week = (isoWeek: string) => analyzed({ isoWeek, aiDerivedOutputs: 1, voiceTurns: 15 })
  const pairMember = (over: Partial<SeriesMetrics>) => series({
    medianDurationMinutes: 30,
    occurrenceCountInWindow: 4,
    last3InviteSets: [['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd']],
    last4Analyzed: [week('2026-W30'), week('2026-W31'), week('2026-W32'), week('2026-W33')],
    ...over,
  })

  const left = pairMember({ groupKey: 'vela sync|app-1', title: 'Vela sync' })
  const right = pairMember({ groupKey: 'orbit sync|app-1', title: 'Orbit sync', organizerId: 'user-2' })

  it('fires for two short same-project series with the same people and weeks', () => {
    expect(kinds([left, right])).toContain('share_slot')
  })

  it('carries the spec’s exact copy — a question, never a redundancy claim', () => {
    const [found] = suggest([left, right], NO_KEYS).filter((s) => s.kind === 'share_slot')
    expect(found.copy).toBe('Same people, same week — could these share one slot?')
  })

  it('keys the pair identically whichever order it was compared in', () => {
    const forward = suggest([left, right], NO_KEYS).find((s) => s.kind === 'share_slot')
    const backward = suggest([right, left], NO_KEYS).find((s) => s.kind === 'share_slot')
    expect(forward!.targetKey).toBe(backward!.targetKey)
    expect(forward!.groupKeys).toEqual(backward!.groupKeys)
  })

  it('NEVER merges a standup with a retro, however identical the people', () => {
    // The purpose veto, shared with R6 through series-key.ts so the two rules
    // cannot disagree about whether two things are the same kind of thing.
    const standup = pairMember({ groupKey: 'vela standup|app-1', title: 'Vela standup' })
    const retro = pairMember({ groupKey: 'vela retro|app-1', title: 'Vela retro' })
    expect(kinds([standup, retro])).not.toContain('share_slot')
  })

  it('crosses the Jaccard line at 0.80 and not at 0.79', () => {
    // 4 shared of 5 union = 0.8 exactly.
    const near = pairMember({
      groupKey: 'orbit sync|app-1', title: 'Orbit sync',
      last3InviteSets: [['a', 'b', 'c', 'd', 'e']],
    })
    expect(inviteJaccard(left.last3InviteSets, near.last3InviteSets)).toBeCloseTo(0.8)
    expect(kinds([left, near])).toContain('share_slot')

    // 4 shared of 6 union = 0.667.
    const far = pairMember({
      groupKey: 'orbit sync|app-1', title: 'Orbit sync',
      last3InviteSets: [['a', 'b', 'c', 'd', 'e', 'f']],
    })
    expect(kinds([left, far])).not.toContain('share_slot')
  })

  it('never matches a null-app series, even against another null-app series', () => {
    // "Both belong to nothing" is not a shared context.
    const a = pairMember({ groupKey: 'sync|__none__', title: 'Sync', appId: null, mergeable: false })
    const b = pairMember({ groupKey: 'catchup|__none__', title: 'Catchup', appId: null, mergeable: false })
    expect(kinds([a, b])).not.toContain('share_slot')
  })

  it('never matches across two different projects', () => {
    const other = pairMember({ groupKey: 'orbit sync|app-2', title: 'Orbit sync', appId: 'app-2' })
    expect(kinds([left, other])).not.toContain('share_slot')
  })

  it('is suppressed once either side is over 30 minutes', () => {
    const longer = pairMember({
      groupKey: 'orbit sync|app-1', title: 'Orbit sync', medianDurationMinutes: 45,
    })
    expect(kinds([left, longer])).not.toContain('share_slot')
  })

  it('is suppressed when they rarely land in the same week', () => {
    const elsewhere = pairMember({
      groupKey: 'orbit sync|app-1', title: 'Orbit sync',
      last4Analyzed: [week('2026-W20'), week('2026-W21'), week('2026-W22'), week('2026-W33')],
    })
    expect(kinds([left, elsewhere])).not.toContain('share_slot')
  })
})

describe('R4 RECORD-OR-REVIEW', () => {
  const dark = series({ invitedHoursPerWeek: 6, consideredCountLast4: 4, last4Analyzed: [] })

  it('fires on an expensive series nobody records', () => {
    // Closes the immunity loophole: without this, never recording is strictly
    // safe and silence is free.
    expect(kinds([dark])).toContain('record_or_review')
  })

  it('interpolates the real hours into the copy', () => {
    const [found] = suggest([dark], NO_KEYS).filter((s) => s.kind === 'record_or_review')
    expect(found.copy).toBe('6h/week with no record — worth recording, or worth reviewing?')

    const other = series({ ...dark, invitedHoursPerWeek: 4.25 })
    const [next] = suggest([other], NO_KEYS).filter((s) => s.kind === 'record_or_review')
    expect(next.copy).toContain('4.3h/week')
  })

  it('needs both conditions — each tested with the other held firing', () => {
    expect(kinds([series({ ...dark, invitedHoursPerWeek: 3.9 })])).not.toContain('record_or_review')
    const covered = series({
      ...dark, consideredCountLast4: 4, last4Analyzed: [analyzed({ meetingId: 'a' })],
    })
    expect(kinds([covered])).not.toContain('record_or_review') // coverage exactly 0.25
  })

  it('fires at exactly four hours a week', () => {
    expect(kinds([series({ ...dark, invitedHoursPerWeek: 4 })])).toContain('record_or_review')
  })
})

describe('R5 TRIM-INVITE', () => {
  const withNames = (ids: string[]) => analyzed({
    hardEvidencePool: 3, aiDerivedOutputs: 1, voiceTurns: 15, zeroEvidenceInviteeIds: ids,
  })
  const trimmable = series({
    last4Analyzed: [
      { ...withNames(['x', 'y']), meetingId: 'a' },
      { ...withNames(['x', 'y', 'z']), meetingId: 'b' },
      { ...withNames(['x', 'y']), meetingId: 'c' },
    ],
  })

  it('fires when the same people have no evidence on every recent occurrence', () => {
    expect(kinds([trimmable])).toContain('trim_invite')
  })

  it('intersects rather than unions — a quiet week is not a wrong room', () => {
    const [found] = suggest([trimmable], NO_KEYS).filter((s) => s.kind === 'trim_invite')
    expect(found.evidence.zeroEvidenceInviteeIds).toEqual(['x', 'y'])
    expect(found.copy).toBe(
      'No recorded evidence for 2 invitees (3 of 3 occurrences analyzed) — make them optional?',
    )
  })

  it('NEVER fires when the caller withheld the names', () => {
    // The structural redaction guard. `undefined` means "you were not told";
    // an empty array means "nobody had zero evidence". Treating them alike is
    // the leak, so this fixture satisfies every numeric threshold and still
    // must not fire.
    const withheld = series({
      last4Analyzed: trimmable.last4Analyzed.map((o) => ({
        ...o, zeroEvidenceInviteeIds: undefined,
      })),
    })
    expect(kinds([withheld])).not.toContain('trim_invite')
  })

  it('is suppressed before the recommender has any evidence at all', () => {
    const noPool = series({
      last4Analyzed: trimmable.last4Analyzed.map((o) => ({ ...o, hardEvidencePool: 0 })),
    })
    expect(kinds([noPool])).not.toContain('trim_invite')
  })

  it('is suppressed below two people', () => {
    const one = series({
      last4Analyzed: [
        { ...withNames(['x']), meetingId: 'a' },
        { ...withNames(['x']), meetingId: 'b' },
      ],
    })
    expect(kinds([one])).not.toContain('trim_invite')
  })

  it('is suppressed with fewer than two analysed occurrences', () => {
    const thin = series({ last4Analyzed: [{ ...withNames(['x', 'y']), meetingId: 'a' }] })
    expect(kinds([thin])).not.toContain('trim_invite')
  })
})

describe('decidedKeys — the never-re-show guarantee', () => {
  const dark = series({ invitedHoursPerWeek: 6, consideredCountLast4: 4, last4Analyzed: [] })

  it('suppresses a decided suggestion whichever way it was decided', () => {
    // The caller passes every decided key regardless of status: accepted and
    // dismissed both mean "somebody has answered this", and re-asking is the
    // engine nagging.
    const decided = new Set([`record_or_review:${dark.groupKey}`])
    expect(kinds([dark], decided)).toEqual([])
  })

  it('does not suppress a forked successor', () => {
    // A title edit mints a new groupKey and therefore a fresh, undecided
    // targetKey — documented behaviour, not a hole in the filter.
    const decided = new Set([`record_or_review:${dark.groupKey}`])
    const forked = series({ ...dark, groupKey: 'vela retro|app-1', title: 'Vela retro' })
    expect(kinds([forked], decided)).toContain('record_or_review')
  })
})

describe('aggregateSuggestions — the one line the org sees', () => {
  const dark = series({ invitedHoursPerWeek: 6, consideredCountLast4: 4, last4Analyzed: [] })

  it('counts what a decision could return', () => {
    const found = suggest([dark], NO_KEYS)
    expect(aggregateSuggestions(found)).toEqual({ count: 1, potentialHoursPerWeek: 6 })
  })

  it('never counts trim_invite, in either number', () => {
    // "The count never appears on any org surface in any form" includes the
    // aggregate — a dashboard figure that moves when somebody's invite list is
    // questioned is still a signal about that person, just a slower one.
    const trims = suggest([series({
      last4Analyzed: [
        analyzed({ meetingId: 'a', hardEvidencePool: 3, zeroEvidenceInviteeIds: ['x', 'y'] }),
        analyzed({ meetingId: 'b', hardEvidencePool: 3, zeroEvidenceInviteeIds: ['x', 'y'] }),
      ],
    })], NO_KEYS).filter((s) => s.kind === 'trim_invite')
    expect(trims.length).toBeGreaterThan(0)
    expect(aggregateSuggestions(trims)).toEqual({ count: 0, potentialHoursPerWeek: 0 })
  })

  it('is zero for nothing', () => {
    expect(aggregateSuggestions([])).toEqual({ count: 0, potentialHoursPerWeek: 0 })
  })
})

describe('determinism', () => {
  it('returns the same list however the series arrived', () => {
    const table = [
      series({ groupKey: 'zeta|app-1', title: 'Zeta sync', invitedHoursPerWeek: 6, last4Analyzed: [] }),
      series({ groupKey: 'alpha|app-1', title: 'Alpha sync', invitedHoursPerWeek: 6, last4Analyzed: [] }),
    ]
    expect(suggest(table, NO_KEYS)).toEqual(suggest([...table].reverse(), NO_KEYS))
  })
})
