/**
 * R6 COVER-TOGETHER — the sixth rule of the meeting-load suggestion engine.
 *
 * THE PROBLEM. Several things need deciding. Each needs certain people in the
 * room. Today each one drifts into its own meeting, so the same five people
 * sit in three half-hour calls that could have been one.
 *
 * Given open asks {a1..an} where ai requires a set of people Pi, propose
 * groups G1..Gk such that every ask lands in a group whose attendee set covers
 * its Pi, minimising k — SUBJECT TO THE GUARDS BELOW, because the unguarded
 * minimum of k is always 1: one meeting, everybody, forever.
 *
 * WHY THIS IS THE RULE THAT SHIPS THE ENGINE. R1-R5 all reduce meetings that
 * already exist, and all of them need the recording pipeline (analysed
 * occurrences, AI-derived output counts, participation medians). R6 prevents a
 * meeting that has not been scheduled yet, and reads only open follow-ups and
 * committed deadlines — rows that exist today, on every workspace, recorded or
 * not.
 *
 * PURE, and the purity is load-bearing twice over:
 *   - No `@/db`. The action layer batches the reads and hands rows here, the
 *     way planner.ts and intel/signals.ts are fed, so every branch below is
 *     unit-tested by value.
 *   - No `new Date()`. `todayIso` is injected. Two runs over unchanged data
 *     must produce the identical plan, because `targetKey` is what a dismissal
 *     is keyed on — a plan that reshuffled would resurrect dismissed
 *     suggestions under fresh identities.
 *
 * SUGGESTIONS, NEVER INVITES. Nothing here writes anything, and accepting a
 * group must not write `meeting_attendees` — it opens a prefilled form and a
 * human presses save. The engine's lifecycle contract says the same thing:
 * "Accept is ADVISORY ONLY."
 *
 * WHAT IT DOES NOT DO: propose a time. There is no free/busy anywhere in this
 * product (google-calendar.ts is write-only; calendar-overlap.ts is pixel
 * lane-packing for drawing, not scheduling). R6 proposes WHO, WHAT and HOW
 * LONG, and a human picks the slot on the time grid that already exists.
 * `notBefore` is a floor, not a proposal — see its docblock.
 */

import { createHash } from 'node:crypto'
import { ROOM_CAP } from '@/features/meetings/attendee-score'
import { purposesCompatible, type PurposeToken } from '@/features/meetings/series-key'
import { workingDayFraction } from '@/lib/working-days'

// ---------------------------------------------------------------------------
// The unit of work
// ---------------------------------------------------------------------------

/**
 * Which live row an ask was derived from. A strict subset of planner.ts's
 * `ASK_KINDS`, and the two omissions are the point:
 *
 *   health      addressed to one role holder; a project's health is a reading,
 *               not a decision waiting on a room.
 *   unassigned  a PM assigning work is a board action, not a conversation.
 *
 * Order is the ask order used for absorption and tie-breaks, so it is fixed
 * rather than incidental: a follow-up is one person owing another an answer
 * (the strongest claim on a room), then a broken promise, then work that has
 * stopped moving, then a check-in nobody can reconcile.
 */
export const COVER_ASK_KINDS = ['followup', 'overdue', 'stalled', 'checkin'] as const
export type CoverAskKind = (typeof COVER_ASK_KINDS)[number]

export type CoverAsk = {
  /** Identity of the underlying ROW, not of the sentence. Feeds `targetKey`,
   *  so it must be stable across runs for as long as the row exists. */
  id: string
  kind: CoverAskKind
  /** The project this belongs to; null for a follow-up whose source meeting
   *  serves more than one, where naming a single one would be a guess. */
  appId: string | null
  /** The question, in words. Becomes one agenda line. */
  text: string
  /** Where the sentence came from — a claim about somebody's work you cannot
   *  click through to is a claim nobody can check. */
  href: string
  /**
   * Everyone the conversation cannot happen without. NEVER generic, always per
   * kind (the plan's section 3 table):
   *   followup           owner + createdBy. A follow-up is one person owing an
   *                      answer to another; with only one of them in the room
   *                      it is a status update, not a decision.
   *   overdue committed  assignee + the app's PM. A slipping PROMISE is a
   *                      conversation with whoever it was promised to.
   *   stalled / checkin  assignee + PM. The gap is literally "nobody knows".
   */
  required: readonly string[]
  /** Reviewers (a lead or architect). Shown on the proposal, never a reason to
   *  enlarge the group: `src/lib/project-roles.ts` already sets the rule that a
   *  manager runs the project and its meetings while a lead is a busy
   *  reviewer. They do not count toward the cap or the cost — see `optional`
   *  on CoverageGroup for what that buys. */
  optional: readonly string[]
  /** True when `meeting_followups.target_meeting_id` is set: somebody already
   *  said out loud that this belongs in a meeting. The strongest such flag in
   *  the schema, and attendee-score.ts already treats it as a hard override. */
  pinned: boolean
  /** The purpose this ask was carried out of, or null. Two asks with DIFFERENT
   *  non-null purposes never share a group. */
  purpose: PurposeToken | null
}

export type CoverageInput = {
  asks: readonly CoverAsk[]
  /**
   * Everyone who may be put in a room right now — active, able to hold work
   * (`canHoldWork()`, not `active && approved`), and not on an approved
   * absence over the window.
   *
   * A SET RATHER THAN A PREDICATE, because the two guards it stands for are
   * database questions and this module has no database. What it must never
   * become is optional: `getTeamForApp` does not filter deactivated or removed
   * users, so a group built without this would propose a meeting with somebody
   * who has left.
   */
  eligible: readonly string[]
  /** Plain yyyy-mm-dd in Asia/Colombo. Never a UTC slice — an evening here is
   *  already tomorrow in UTC. */
  todayIso: string
  /** Injected so a test can pin a holiday; defaults, through
   *  `workingDayFraction`, to the mercantile list. */
  isHoliday?: (iso: string) => boolean
}

/** Why an ask never reached the cover at all. */
export type ExclusionReason =
  /** No required people — nothing to build a room out of. */
  | 'no-required-person'
  /** Somebody it cannot happen without is deactivated, removed, or away. */
  | 'required-person-away'
  /** Its required set alone is already past the room cap. */
  | 'required-set-over-cap'

export type CoverageGroup = {
  /** `cover:<sha256 of sorted ask ids>|<appId ?? '__none__'>`. Stable across
   *  runs, so a dismissal sticks; adding a sixth ask legitimately mints a new
   *  suggestion, exactly as a title edit forks a seriesKey. */
  targetKey: string
  /** The one project every ask in the group belongs to, or null when they span
   *  more than one. */
  appId: string | null
  asks: readonly CoverAsk[]
  /** Everyone required, sorted. This IS the group, and what the meeting form
   *  is prefilled with. */
  required: readonly string[]
  /** Reviewers named by the covered asks who are not already required. DISPLAY
   *  ONLY — not prefilled into the form, not counted in the cap, not counted in
   *  the cost. "Never a reason to enlarge the group" has to mean something
   *  arithmetic, and this is it. */
  optional: readonly string[]
  /** How long the one meeting should be. */
  minutes: number
  /** What the one meeting costs: |required| x minutes. */
  personMinutes: number
  /** What the same asks cost as separate meetings: sum of |Pi| x 15. */
  separatePersonMinutes: number
  /** The saving. Always > 0 unless the group carries a pinned ask. */
  savedPersonMinutes: number
  purpose: PurposeToken | null
  pinnedCount: number
  /** The earliest day this COULD happen — the first day from today forward
   *  that the studio actually works. A FLOOR, not a proposed slot: there is no
   *  free/busy in this product, so nothing here knows whether anyone is free,
   *  only that a Sunday is not a candidate. */
  notBefore: string
}

export type CoveragePlan = {
  groups: readonly CoverageGroup[]
  /** Asks that never reached the cover, each with its reason. */
  excluded: readonly { askId: string; reason: ExclusionReason }[]
  /** Asks that reached the cover and landed in no group — the normal outcome
   *  for an ask sharing nobody with anything else. Not a failure, and not
   *  rendered as one. */
  uncovered: readonly string[]
  /** How many meetings the covered asks would be, one each. */
  meetingsBefore: number
  /** How many they become. Always < meetingsBefore when groups is non-empty. */
  meetingsAfter: number
  /** Person-minutes saved across every group. */
  savedPersonMinutes: number
}

// ---------------------------------------------------------------------------
// Duration and cost
// ---------------------------------------------------------------------------

/** One item is a fifteen-minute conversation. */
export const FIRST_ASK_MINUTES = 15
/** Each further item adds ten. */
export const EXTRA_ASK_MINUTES = 10
/** Capped at an hour: a proposal longer than that is not a saving. */
export const MAX_MEETING_MINUTES = 60
/** The quarter hour the time grid already snaps to (meeting-form.tsx's
 *  `roundUpToStep`). Proposing 25 minutes on a 15-minute grid asks somebody to
 *  round it themselves. */
export const GRID_STEP_MINUTES = 15

/**
 * How long a meeting covering `askCount` items should be.
 *
 *   1 -> 15   2 -> 30   3 -> 45   4 -> 45   5 -> 60   6+ -> 60
 */
export function meetingMinutes(askCount: number): number {
  if (askCount <= 0) return 0
  const raw = FIRST_ASK_MINUTES + EXTRA_ASK_MINUTES * (askCount - 1)
  const snapped = Math.ceil(raw / GRID_STEP_MINUTES) * GRID_STEP_MINUTES
  return Math.min(MAX_MEETING_MINUTES, snapped)
}

/**
 * Person-minutes — the thing actually being spent.
 *
 * Dividing coverage by THIS, rather than counting meetings, is what stops the
 * greedy choosing "everyone, one meeting": adding a sixth person to clear a
 * fifth item has to pay for itself.
 */
export function personMinutes(attendeeCount: number, askCount: number): number {
  return attendeeCount * meetingMinutes(askCount)
}

// ---------------------------------------------------------------------------
// Ask order — total, so the plan is reproducible
// ---------------------------------------------------------------------------

const KIND_RANK = new Map<CoverAskKind, number>(
  COVER_ASK_KINDS.map((kind, index) => [kind, index] as const),
)

/**
 * Pinned first, then kind, then id.
 *
 * Pinned leading is the mechanism behind "forced into a group": a pinned ask is
 * tried as a seed before anything else and absorbed before anything else, so a
 * group that can hold it does. The other half of that force is the saving
 * exemption in `isEligibleGroup`.
 */
export function compareAsks(a: CoverAsk, b: CoverAsk): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  const byKind = (KIND_RANK.get(a.kind) ?? 0) - (KIND_RANK.get(b.kind) ?? 0)
  if (byKind !== 0) return byKind
  return a.id.localeCompare(b.id)
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * The suggestion's stable name.
 *
 * Over the SORTED ask ids, so the same group keyed twice is the same string
 * whatever order the greedy absorbed them in — which is the whole reason a
 * dismissal sticks. `__none__` rather than an empty segment for the app,
 * matching the engine's targetKey shape: an empty segment would make a null-app
 * key and a key for an app whose id is the empty string indistinguishable.
 */
export function coverageTargetKey(askIds: readonly string[], appId: string | null): string {
  const digest = createHash('sha256').update([...askIds].sort().join(',')).digest('hex')
  return `cover:${digest}|${appId ?? '__none__'}`
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * The soonest day the studio works, counting from `todayIso`.
 *
 * Sunday and mercantile holidays score 0 and are skipped; Saturday scores 0.5
 * and still counts — it is a half day here, not a day off. Bounded at 14 days
 * so a pathological holiday predicate cannot spin: two clear weeks with no
 * working day is not a real calendar, and returning `todayIso` is the honest
 * answer to a question this module cannot resolve.
 */
export function earliestWorkingDay(
  todayIso: string,
  isHoliday?: (iso: string) => boolean,
): string {
  const cursor = new Date(`${todayIso}T12:00:00Z`)
  for (let step = 0; step < 14; step += 1) {
    const iso = cursor.toISOString().slice(0, 10)
    if (workingDayFraction(iso, isHoliday) > 0) return iso
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return todayIso
}

type Candidate = {
  seedId: string
  asks: CoverAsk[]
  required: string[]
  purpose: PurposeToken | null
}

const uniqueSorted = (ids: Iterable<string>) => [...new Set(ids)].sort()

/** What these asks cost as separate meetings: each one alone, with only the
 *  people it cannot happen without, for the fifteen minutes one item takes. */
function separateCost(asks: readonly CoverAsk[]): number {
  return asks.reduce((sum, ask) => sum + personMinutes(new Set(ask.required).size, 1), 0)
}

/**
 * Whether a candidate group is a suggestion at all.
 *
 * NO SINGLETON GROUPS. A group of one ask is not a meeting, it is the ask.
 *
 * STRICTLY LOWER PERSON-MINUTES. One meeting has to cost less than the separate
 * ones it replaces, or there is nothing to propose. This subsumes the singleton
 * guard on its own today (one ask alone costs exactly what it costs); both are
 * written out anyway, because a future change to the duration curve could break
 * that coincidence silently.
 *
 * THE PINNED EXEMPTION. A group carrying a pinned follow-up is exempt from the
 * saving guard: somebody already decided that item needs a room, and the
 * arithmetic is not allowed to overrule a human who said so. It is NOT exempt
 * from the singleton guard, the cap, or the veto — "this needs a meeting" is
 * not "this needs a meeting with anyone".
 */
function isEligibleGroup(asks: readonly CoverAsk[], required: readonly string[]): boolean {
  if (asks.length < 2) return false
  if (required.length > ROOM_CAP) return false
  if (asks.some((ask) => ask.pinned)) return true
  return personMinutes(required.length, asks.length) < separateCost(asks)
}

/** Higher is better. Coverage bought per person-minute spent. */
function score(asks: readonly CoverAsk[], required: readonly string[]): number {
  const cost = personMinutes(required.length, asks.length)
  return cost === 0 ? 0 : asks.length / cost
}

/**
 * The plan's stated tie-break, in its stated order: more items covered, then
 * fewer attendees, then the lowest seed ask id. Score leads, since that is what
 * is being maximised; the rest only ever settle a draw.
 *
 * Every level is total and nothing compares equal at the last one — seed ids
 * are unique within a round — so the winner is a function of the data alone,
 * never of Map insertion order.
 */
function better(a: Candidate, b: Candidate): Candidate {
  const byScore = score(b.asks, b.required) - score(a.asks, a.required)
  if (byScore !== 0) return byScore < 0 ? a : b
  const byCovered = b.asks.length - a.asks.length
  if (byCovered !== 0) return byCovered < 0 ? a : b
  const byAttendees = a.required.length - b.required.length
  if (byAttendees !== 0) return byAttendees < 0 ? a : b
  return a.seedId.localeCompare(b.seedId) <= 0 ? a : b
}

// ---------------------------------------------------------------------------
// The cover
// ---------------------------------------------------------------------------

/**
 * Greedy weighted set cover, seeded from the asks themselves.
 *
 * No subset enumeration: the candidate attendee sets are exactly the ones some
 * ask demands. O(n^2) per round with n in the tens — not worth a smarter
 * algorithm, and a smarter one would be harder to explain to somebody asking
 * why their meeting was proposed.
 */
export function coverAsks(input: CoverageInput): CoveragePlan {
  const eligible = new Set(input.eligible)
  const excluded: { askId: string; reason: ExclusionReason }[] = []
  const admitted: CoverAsk[] = []

  // --- eligibility ---------------------------------------------------------
  // Order matters for the REASON, not the outcome: an ask with nobody on it is
  // reported as empty rather than as "somebody is away", because those are two
  // different things to go and fix.
  for (const ask of input.asks) {
    const required = uniqueSorted(ask.required)
    if (required.length === 0) {
      excluded.push({ askId: ask.id, reason: 'no-required-person' })
      continue
    }
    if (required.some((userId) => !eligible.has(userId))) {
      excluded.push({ askId: ask.id, reason: 'required-person-away' })
      continue
    }
    if (required.length > ROOM_CAP) {
      excluded.push({ askId: ask.id, reason: 'required-set-over-cap' })
      continue
    }
    admitted.push({
      ...ask,
      required,
      // A reviewer who has left, or is away, is not a reviewer this week.
      // Dropped rather than excluding the ask: optional never blocks anything.
      optional: uniqueSorted(ask.optional).filter(
        (userId) => eligible.has(userId) && !required.includes(userId),
      ),
    })
  }

  const ordered = [...admitted].sort(compareAsks)
  let uncovered = ordered
  const groups: CoverageGroup[] = []
  const notBefore = earliestWorkingDay(input.todayIso, input.isHoliday)

  // Every round either removes at least two asks or breaks, so this terminates
  // on the ask count.
  while (uncovered.length >= 2) {
    let best: Candidate | null = null

    for (const seed of uncovered) {
      const chosen: CoverAsk[] = [seed]
      const attendees = new Set(seed.required)
      let purpose = seed.purpose

      for (const other of uncovered) {
        if (other.id === seed.id) continue
        if (!purposesCompatible(purpose, other.purpose)) continue
        const merged = new Set([...attendees, ...other.required])
        if (merged.size > ROOM_CAP) continue
        // ABSORPTION HAS TO PAY FOR ITSELF. The rule as drafted absorbed any
        // ask that fit under the cap, which is a trap: one cheap unrelated ask
        // dragged in a sixth person, pushed the group's cost above what the
        // separate meetings would have cost, and the whole suggestion
        // evaporated — so a good group would disappear because somebody
        // elsewhere gained a follow-up. Scoring the absorption instead is the
        // plan's own stated intent ("adding a sixth person to clear a fifth
        // item has to pay for itself"); only its pseudocode left it out.
        //
        // `>=` rather than `>`: an absorption that covers more work for the
        // same coverage-per-person-minute is free, and refusing it would leave
        // an ask out of a meeting it costs nothing to be in.
        if (score([...chosen, other], [...merged]) < score(chosen, [...attendees])) continue
        chosen.push(other)
        for (const userId of other.required) attendees.add(userId)
        // The group's purpose is the first named one it absorbed. Once set it
        // never changes, which is what makes the veto transitive: a null-purpose
        // seed that takes in a standup is a standup from then on, and a retro
        // cannot join it afterwards.
        purpose = purpose ?? other.purpose
      }

      const required = [...attendees].sort()
      if (!isEligibleGroup(chosen, required)) continue
      const candidate: Candidate = { seedId: seed.id, asks: chosen, required, purpose }
      best = best === null ? candidate : better(best, candidate)
    }

    if (best === null) break

    const asks = [...best.asks].sort(compareAsks)
    const askIds = asks.map((ask) => ask.id)
    // One project only when every ask agrees on it. A group spanning two is
    // filed under neither rather than under whichever sorts first.
    const appIds = new Set(asks.map((ask) => ask.appId))
    const appId = appIds.size === 1 ? (asks[0].appId ?? null) : null
    const minutes = meetingMinutes(asks.length)
    const spend = personMinutes(best.required.length, asks.length)
    const separate = separateCost(asks)

    groups.push({
      targetKey: coverageTargetKey(askIds, appId),
      appId,
      asks,
      required: best.required,
      optional: uniqueSorted(asks.flatMap((ask) => ask.optional)).filter(
        (userId) => !best.required.includes(userId),
      ),
      minutes,
      personMinutes: spend,
      separatePersonMinutes: separate,
      // Clamped at zero rather than reported negative: the only way a group can
      // cost MORE is the pinned exemption, and "somebody insisted this needs a
      // room" is not a saving of minus forty minutes, it is no saving.
      savedPersonMinutes: Math.max(0, separate - spend),
      purpose: best.purpose,
      pinnedCount: asks.filter((ask) => ask.pinned).length,
      notBefore,
    })

    const taken = new Set(askIds)
    uncovered = uncovered.filter((ask) => !taken.has(ask.id))
  }

  const covered = groups.reduce((sum, group) => sum + group.asks.length, 0)
  return {
    groups,
    excluded,
    uncovered: uncovered.map((ask) => ask.id),
    meetingsBefore: covered,
    meetingsAfter: groups.length,
    savedPersonMinutes: groups.reduce((sum, group) => sum + group.savedPersonMinutes, 0),
  }
}

/**
 * The finding, in words, for a button that reports its own answer.
 *
 * "4 meetings could be 2" gets pressed; "Coverage optimiser" does not. Null
 * when there is nothing to report, so the caller falls back to naming the page
 * rather than printing a zero.
 */
export function coverageHeadline(plan: CoveragePlan): string | null {
  if (plan.groups.length === 0) return null
  return `${plan.meetingsBefore} meetings could be ${plan.meetingsAfter}`
}
