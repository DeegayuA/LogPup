import { describe, expect, it } from 'vitest'
import {
  coverAsks,
  compareAsks,
  coverageHeadline,
  coverageTargetKey,
  earliestWorkingDay,
  meetingMinutes,
  personMinutes,
  type CoverAsk,
} from './coverage'

// ---------------------------------------------------------------------------
// Fixtures. Every ask is written out by value — no factory that hides which
// field a case actually turns on.
// ---------------------------------------------------------------------------

const TEAM = ['u1', 'u2', 'u3', 'u4', 'u5']
const FRIDAY = '2026-08-21'

function ask(over: Partial<CoverAsk> & { id: string; required: readonly string[] }): CoverAsk {
  return {
    kind: 'followup',
    appId: 'app-1',
    text: `ask ${over.id}`,
    href: `/print/meetings/${over.id}`,
    optional: [],
    pinned: false,
    purpose: null,
    ...over,
  }
}

/** Four items, the same five people — the plan's own headline case. */
const FOUR_ON_THE_SAME_FIVE = ['a1', 'a2', 'a3', 'a4'].map((id) => ask({ id, required: TEAM }))

const run = (asks: readonly CoverAsk[], eligible: readonly string[] = TEAM, todayIso = FRIDAY) =>
  coverAsks({ asks, eligible, todayIso })

// ---------------------------------------------------------------------------
// Duration and cost
// ---------------------------------------------------------------------------

describe('meetingMinutes', () => {
  it('is 15 for one item, then +10 an item, snapped up to the quarter hour', () => {
    expect(meetingMinutes(1)).toBe(15)
    expect(meetingMinutes(2)).toBe(30) // raw 25
    expect(meetingMinutes(3)).toBe(45) // raw 35
    expect(meetingMinutes(4)).toBe(45) // raw 45
  })

  it('caps at an hour — a proposal longer than that is not a saving', () => {
    expect(meetingMinutes(5)).toBe(60) // raw 55
    expect(meetingMinutes(6)).toBe(60) // raw 65, clamped
    expect(meetingMinutes(40)).toBe(60)
  })

  it('is zero for no items rather than the 15-minute floor', () => {
    expect(meetingMinutes(0)).toBe(0)
    expect(meetingMinutes(-3)).toBe(0)
  })
})

describe('personMinutes', () => {
  it('is heads times minutes — the thing actually being spent', () => {
    expect(personMinutes(5, 4)).toBe(225) // 5 people x 45 min
    expect(personMinutes(2, 1)).toBe(30)
    expect(personMinutes(0, 4)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Ask order
// ---------------------------------------------------------------------------

describe('compareAsks', () => {
  it('puts a pinned ask first, whatever its kind or id', () => {
    const pinned = ask({ id: 'z9', required: TEAM, kind: 'checkin', pinned: true })
    const plain = ask({ id: 'a1', required: TEAM, kind: 'followup' })
    expect(compareAsks(pinned, plain)).toBeLessThan(0)
    expect(compareAsks(plain, pinned)).toBeGreaterThan(0)
  })

  it('then orders by kind, in COVER_ASK_KINDS order', () => {
    const followup = ask({ id: 'z', required: TEAM, kind: 'followup' })
    const overdue = ask({ id: 'a', required: TEAM, kind: 'overdue' })
    const stalled = ask({ id: 'a', required: TEAM, kind: 'stalled' })
    const checkin = ask({ id: 'a', required: TEAM, kind: 'checkin' })
    expect(compareAsks(followup, overdue)).toBeLessThan(0)
    expect(compareAsks(overdue, stalled)).toBeLessThan(0)
    expect(compareAsks(stalled, checkin)).toBeLessThan(0)
  })

  it('then by id, so the order is total and never depends on input order', () => {
    const first = ask({ id: 'a', required: TEAM })
    const second = ask({ id: 'b', required: TEAM })
    expect(compareAsks(first, second)).toBeLessThan(0)
    expect(compareAsks(first, first)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

describe('coverageTargetKey', () => {
  it('is the same however the ids were ordered — a dismissal has to stick', () => {
    expect(coverageTargetKey(['b', 'a', 'c'], 'app-1')).toBe(coverageTargetKey(['a', 'b', 'c'], 'app-1'))
  })

  it('mints a fresh identity when the ask set changes — a sixth ask is a new suggestion', () => {
    expect(coverageTargetKey(['a', 'b'], 'app-1')).not.toBe(coverageTargetKey(['a', 'b', 'c'], 'app-1'))
  })

  it('separates the same asks under different projects', () => {
    expect(coverageTargetKey(['a', 'b'], 'app-1')).not.toBe(coverageTargetKey(['a', 'b'], 'app-2'))
  })

  it("spells a null app '__none__' rather than leaving the segment empty", () => {
    expect(coverageTargetKey(['a'], null)).toMatch(/\|__none__$/)
    // An empty segment would make a null-app key and a key for an app whose id
    // is the empty string the same string.
    expect(coverageTargetKey(['a'], null)).not.toBe(coverageTargetKey(['a'], ''))
  })

  it('is the documented shape: cover:<sha256 hex>|<app>', () => {
    expect(coverageTargetKey(['a'], 'app-1')).toMatch(/^cover:[0-9a-f]{64}\|app-1$/)
  })
})

// ---------------------------------------------------------------------------
// Guard 5: absences and non-working days
// ---------------------------------------------------------------------------

describe('earliestWorkingDay', () => {
  it('returns today when today is a working day', () => {
    expect(earliestWorkingDay(FRIDAY, () => false)).toBe('2026-08-21') // Friday
  })

  it('counts Saturday — it is a half day at this studio, not a day off', () => {
    expect(earliestWorkingDay('2026-08-22', () => false)).toBe('2026-08-22')
  })

  it('skips Sunday', () => {
    expect(earliestWorkingDay('2026-08-23', () => false)).toBe('2026-08-24') // Monday
  })

  it('skips a holiday, even one falling on a working day', () => {
    const holidays = new Set(['2026-08-24', '2026-08-25'])
    expect(earliestWorkingDay('2026-08-24', (iso) => holidays.has(iso))).toBe('2026-08-26')
  })

  it('gives up rather than spinning when nothing is ever a working day', () => {
    // Not a real calendar. Returning the day it was asked about is the honest
    // answer to a question this module cannot resolve.
    expect(earliestWorkingDay(FRIDAY, () => true)).toBe(FRIDAY)
  })
})

// ---------------------------------------------------------------------------
// The cover
// ---------------------------------------------------------------------------

describe('coverAsks — the headline case', () => {
  it('turns four items on the same five people into one meeting', () => {
    const plan = run(FOUR_ON_THE_SAME_FIVE)

    expect(plan.groups).toHaveLength(1)
    const [group] = plan.groups
    expect(group.asks.map((a) => a.id)).toEqual(['a1', 'a2', 'a3', 'a4'])
    expect(group.required).toEqual(TEAM)
    expect(group.minutes).toBe(45)
    expect(group.personMinutes).toBe(225) // 5 x 45
    expect(group.separatePersonMinutes).toBe(300) // 4 x (5 x 15)
    expect(group.savedPersonMinutes).toBe(75)
    expect(group.appId).toBe('app-1')
    expect(plan.meetingsBefore).toBe(4)
    expect(plan.meetingsAfter).toBe(1)
    expect(plan.savedPersonMinutes).toBe(75)
    expect(plan.uncovered).toEqual([])
    expect(plan.excluded).toEqual([])
  })

  it('says what it found in words a button can wear', () => {
    expect(coverageHeadline(run(FOUR_ON_THE_SAME_FIVE))).toBe('4 meetings could be 1')
    expect(coverageHeadline(run([]))).toBeNull()
  })

  it('files a group spanning two projects under neither', () => {
    const asks = [
      ask({ id: 'a1', required: TEAM, appId: 'app-1' }),
      ask({ id: 'a2', required: TEAM, appId: 'app-1' }),
      ask({ id: 'a3', required: TEAM, appId: 'app-2' }),
      ask({ id: 'a4', required: TEAM, appId: null }),
    ]
    expect(run(asks).groups[0].appId).toBeNull()
  })
})

describe('coverAsks — guard 1: the room cap', () => {
  it('never builds a group past eight people', () => {
    const left = ['a1', 'a2', 'a3', 'a4'].map((id) => ask({ id, required: ['u1', 'u2', 'u3', 'u4', 'u5'] }))
    const right = ['b1', 'b2', 'b3', 'b4'].map((id) => ask({ id, required: ['u5', 'u6', 'u7', 'u8', 'u9'] }))
    const everyone = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9']

    const plan = coverAsks({ asks: [...left, ...right], eligible: everyone, todayIso: FRIDAY })

    // The nine-person merge is what the cap exists to refuse; two fives is
    // what is left once it does.
    expect(plan.groups).toHaveLength(2)
    for (const group of plan.groups) expect(group.required).toHaveLength(5)
    expect(plan.groups.flatMap((g) => g.asks.map((a) => a.id)).sort()).toEqual([
      'a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4',
    ])
  })

  it('excludes an ask whose required set alone is already over the cap', () => {
    const nine = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9']
    const plan = coverAsks({
      asks: [ask({ id: 'big', required: nine }), ...FOUR_ON_THE_SAME_FIVE],
      eligible: nine,
      todayIso: FRIDAY,
    })
    expect(plan.excluded).toEqual([{ askId: 'big', reason: 'required-set-over-cap' }])
    expect(plan.groups).toHaveLength(1)
  })
})

describe('coverAsks — guard 2: no singleton groups', () => {
  it('leaves a lone ask uncovered — a group of one is not a meeting, it is the ask', () => {
    const plan = run([ask({ id: 'only', required: TEAM })])
    expect(plan.groups).toEqual([])
    expect(plan.uncovered).toEqual(['only'])
    expect(plan.meetingsBefore).toBe(0)
  })

  it('leaves a lone PINNED ask uncovered too — "needs a meeting" is not "needs a meeting with anyone"', () => {
    const plan = run([ask({ id: 'only', required: TEAM, pinned: true })])
    expect(plan.groups).toEqual([])
    expect(plan.uncovered).toEqual(['only'])
  })

  it('reports an ask that shares nobody with anything else as uncovered, not as an error', () => {
    const plan = coverAsks({
      asks: [...FOUR_ON_THE_SAME_FIVE, ask({ id: 'lonely', required: ['u9'] })],
      eligible: [...TEAM, 'u9'],
      todayIso: FRIDAY,
    })
    expect(plan.groups).toHaveLength(1)
    expect(plan.uncovered).toEqual(['lonely'])
  })
})

describe('coverAsks — guard 3: the purpose veto', () => {
  it('never merges two different purposes, however identical the people are', () => {
    const standups = ['s1', 's2', 's3', 's4'].map((id) =>
      ask({ id, required: TEAM, purpose: 'standup' }),
    )
    const retros = ['r1', 'r2', 'r3', 'r4'].map((id) => ask({ id, required: TEAM, purpose: 'retro' }))

    const plan = run([...standups, ...retros])

    expect(plan.groups).toHaveLength(2)
    for (const group of plan.groups) {
      const purposes = new Set(group.asks.map((a) => a.purpose))
      expect(purposes.size).toBe(1)
    }
    expect(plan.groups.map((g) => g.purpose).sort()).toEqual(['retro', 'standup'])
  })

  it('lets a no-opinion ask join a named purpose', () => {
    const asks = [
      ask({ id: 'a1', required: TEAM, purpose: 'sync' }),
      ask({ id: 'a2', required: TEAM, purpose: null }),
      ask({ id: 'a3', required: TEAM, purpose: null }),
      ask({ id: 'a4', required: TEAM, purpose: null }),
    ]
    const plan = run(asks)
    expect(plan.groups).toHaveLength(1)
    expect(plan.groups[0].asks).toHaveLength(4)
    expect(plan.groups[0].purpose).toBe('sync')
  })

  it('is transitive: a group that absorbed a standup will not then take a retro', () => {
    // The seed has no opinion, so without the "first named purpose sticks"
    // rule it would happily hold both and the veto would be worthless.
    const asks = [
      ask({ id: 'a1', required: TEAM, purpose: null }),
      ask({ id: 'a2', required: TEAM, purpose: 'standup' }),
      ask({ id: 'a3', required: TEAM, purpose: 'retro' }),
      ask({ id: 'a4', required: TEAM, purpose: null }),
      ask({ id: 'a5', required: TEAM, purpose: null }),
    ]
    const plan = run(asks)
    for (const group of plan.groups) {
      const named = group.asks.map((a) => a.purpose).filter((p) => p !== null)
      expect(new Set(named).size).toBeLessThanOrEqual(1)
    }
  })
})

describe('coverAsks — guards 4 and 5: only people who can hold work, and only when they are here', () => {
  it('excludes an ask whose required person cannot hold work', () => {
    const asks = [...FOUR_ON_THE_SAME_FIVE, ask({ id: 'gone', required: ['u1', 'departed'] })]
    const plan = coverAsks({ asks, eligible: TEAM, todayIso: FRIDAY })
    expect(plan.excluded).toEqual([{ askId: 'gone', reason: 'required-person-away' }])
  })

  it('excludes an ask whose required person is on an approved absence', () => {
    // Same mechanism, and deliberately so: "deactivated" and "away this week"
    // are both "cannot be in the room", and the caller resolves which.
    const plan = coverAsks({
      asks: FOUR_ON_THE_SAME_FIVE,
      eligible: ['u1', 'u2', 'u3', 'u4'], // u5 is away
      todayIso: FRIDAY,
    })
    expect(plan.groups).toEqual([])
    expect(plan.excluded.map((e) => e.reason)).toEqual([
      'required-person-away', 'required-person-away', 'required-person-away', 'required-person-away',
    ])
  })

  it('reports an ask with nobody on it as empty, not as somebody being away', () => {
    const plan = run([ask({ id: 'nobody', required: [] })])
    expect(plan.excluded).toEqual([{ askId: 'nobody', reason: 'no-required-person' }])
  })

  it('never proposes a day the studio does not work', () => {
    const sunday = coverAsks({
      asks: FOUR_ON_THE_SAME_FIVE,
      eligible: TEAM,
      todayIso: '2026-08-23',
      isHoliday: () => false,
    })
    expect(sunday.groups[0].notBefore).toBe('2026-08-24') // Monday
  })
})

describe('coverAsks — the person-minutes guard', () => {
  it('refuses a group that would cost more than the separate meetings', () => {
    // Two asks with disjoint people: one room of four for 30 minutes (120)
    // against two rooms of two for 15 (60). The merge is worse, so it is not
    // a suggestion.
    const asks = [
      ask({ id: 'a1', required: ['u1', 'u2'] }),
      ask({ id: 'a2', required: ['u3', 'u4'] }),
    ]
    const plan = coverAsks({ asks, eligible: ['u1', 'u2', 'u3', 'u4'], todayIso: FRIDAY })
    expect(plan.groups).toEqual([])
    expect([...plan.uncovered].sort()).toEqual(['a1', 'a2'])
  })

  it('refuses even a perfectly overlapping PAIR — the snapped curve saves nothing at two', () => {
    // A consequence of the specified duration curve, pinned here on purpose:
    // 15 + 10(m-1) rounded UP to the quarter hour equals 15m at m = 2 and
    // m = 3, so the first real saving is at four items. Changing the curve
    // changes this test, which is exactly when somebody should be told.
    const pair = ['a1', 'a2'].map((id) => ask({ id, required: TEAM }))
    expect(run(pair).groups).toEqual([])

    const triple = ['a1', 'a2', 'a3'].map((id) => ask({ id, required: TEAM }))
    expect(run(triple).groups).toEqual([])
  })

  it('every group it does propose strictly saves, unless a pinned ask carried it', () => {
    const plan = run(FOUR_ON_THE_SAME_FIVE)
    for (const group of plan.groups) {
      if (group.pinnedCount === 0) {
        expect(group.personMinutes).toBeLessThan(group.separatePersonMinutes)
      }
    }
  })
})

describe('coverAsks — the pinned exemption', () => {
  const pinnedPair = [
    ask({ id: 'p1', required: TEAM, pinned: true }),
    ask({ id: 'p2', required: TEAM }),
  ]

  it('proposes a group the arithmetic alone would refuse, because a human already asked for it', () => {
    const plan = run(pinnedPair)
    expect(plan.groups).toHaveLength(1)
    expect(plan.groups[0].asks.map((a) => a.id)).toEqual(['p1', 'p2'])
    expect(plan.groups[0].pinnedCount).toBe(1)
  })

  it('reports no saving rather than a negative one', () => {
    const [group] = run(pinnedPair).groups
    // Exactly a wash, which is why the saving guard refuses it and only the
    // pinned exemption lets it through: 5 people for 30 minutes is the same
    // 150 person-minutes as two 15-minute meetings of the same five.
    expect(group.personMinutes).toBe(150) // 5 x 30
    expect(group.separatePersonMinutes).toBe(150) // 2 x (5 x 15)
    expect(group.savedPersonMinutes).toBe(0)
  })

  it('is still bound by the cap and the veto', () => {
    const overCap = [
      ask({ id: 'p1', required: ['u1', 'u2', 'u3', 'u4', 'u5'], pinned: true }),
      ask({ id: 'p2', required: ['u5', 'u6', 'u7', 'u8', 'u9'] }),
    ]
    const nine = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9']
    expect(coverAsks({ asks: overCap, eligible: nine, todayIso: FRIDAY }).groups).toEqual([])

    const crossPurpose = [
      ask({ id: 'p1', required: TEAM, pinned: true, purpose: 'standup' }),
      ask({ id: 'p2', required: TEAM, purpose: 'retro' }),
    ]
    expect(run(crossPurpose).groups).toEqual([])
  })

  it('is tried first, so a group that can hold it does', () => {
    const asks = [
      ask({ id: 'z-pinned', required: TEAM, pinned: true }),
      ...FOUR_ON_THE_SAME_FIVE,
    ]
    const plan = run(asks)
    expect(plan.groups[0].asks[0].id).toBe('z-pinned')
    expect(plan.groups[0].pinnedCount).toBe(1)
  })
})

describe('coverAsks — optional reviewers', () => {
  const withLead = FOUR_ON_THE_SAME_FIVE.map((a) => ({ ...a, optional: ['lead1', 'departed'] }))

  it('names a reviewer on the proposal without enlarging the group', () => {
    const plan = coverAsks({ asks: withLead, eligible: [...TEAM, 'lead1'], todayIso: FRIDAY })
    const [group] = plan.groups
    expect(group.optional).toEqual(['lead1'])
    // The arithmetic is over `required` only — that is what "never a reason to
    // enlarge the group" has to mean to be worth writing down.
    expect(group.required).toEqual(TEAM)
    expect(group.personMinutes).toBe(225)
  })

  it('drops a reviewer who cannot hold work, without excluding the ask', () => {
    const plan = coverAsks({ asks: withLead, eligible: [...TEAM, 'lead1'], todayIso: FRIDAY })
    expect(plan.groups[0].optional).not.toContain('departed')
    expect(plan.excluded).toEqual([])
  })

  it('never lists somebody as optional who is already required', () => {
    const asks = FOUR_ON_THE_SAME_FIVE.map((a) => ({ ...a, optional: ['u1'] }))
    expect(run(asks).groups[0].optional).toEqual([])
  })
})

describe('coverAsks — determinism', () => {
  const shuffled = [
    FOUR_ON_THE_SAME_FIVE[2],
    FOUR_ON_THE_SAME_FIVE[0],
    FOUR_ON_THE_SAME_FIVE[3],
    FOUR_ON_THE_SAME_FIVE[1],
  ]

  it('produces the identical plan on a second run', () => {
    expect(run(FOUR_ON_THE_SAME_FIVE)).toEqual(run(FOUR_ON_THE_SAME_FIVE))
  })

  it('produces the identical plan however the asks arrived', () => {
    // Same inputs, same plan, every run — which is also what makes targetKey
    // stable enough for a dismissal to stick.
    expect(run(shuffled)).toEqual(run(FOUR_ON_THE_SAME_FIVE))
  })

  it('keeps the same targetKey across runs, so a dismissal is durable', () => {
    expect(run(shuffled).groups[0].targetKey).toBe(run(FOUR_ON_THE_SAME_FIVE).groups[0].targetKey)
  })

  it('gives a group covering a different set of asks a different identity', () => {
    const swapped = [
      FOUR_ON_THE_SAME_FIVE[0],
      FOUR_ON_THE_SAME_FIVE[1],
      FOUR_ON_THE_SAME_FIVE[2],
      ask({ id: 'a9', required: TEAM }),
    ]
    expect(run(swapped).groups[0].targetKey).not.toBe(run(FOUR_ON_THE_SAME_FIVE).groups[0].targetKey)
  })

  it('stops absorbing once an extra ask stops paying for itself', () => {
    // Four items on five people is 45 minutes; a fifth pushes it to the
    // 60-minute cap, so the fifth costs exactly what its own meeting would.
    // The group holds at four and says so, rather than growing for free.
    const five = [...FOUR_ON_THE_SAME_FIVE, ask({ id: 'a5', required: TEAM })]
    const plan = run(five)
    expect(plan.groups).toHaveLength(1)
    expect(plan.groups[0].asks).toHaveLength(4)
    expect(plan.uncovered).toEqual(['a5'])
  })
})

describe('coverAsks — guard 7: no pending or declined input reaches the rule', () => {
  it('has no RSVP field to read, structurally', () => {
    // Asserted on the input TYPE, the way sub-project B asserts it for R1-R5.
    // An .ics invite carries RSVP=TRUE and mail-client replies never write
    // back, so "pending" measures widget adoption rather than intent — a rule
    // that could see it would eventually be tempted to use it.
    const one = ask({ id: 'a1', required: TEAM })
    expect(Object.keys(one).sort()).toEqual([
      'appId', 'href', 'id', 'kind', 'optional', 'pinned', 'purpose', 'required', 'text',
    ])

    // @ts-expect-error — there is no `response` on CoverAsk, and adding one
    // should break the build rather than quietly widen what R6 can see.
    const widened: CoverAsk = { ...one, response: 'declined' }
    expect(widened.id).toBe('a1')
  })
})
