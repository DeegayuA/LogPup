import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { meetingLoadDecisions } from '@/db/schema'
import { gatherLoadFacts } from '@/features/meeting-load/gather'
import { observedChangeFor, type ObservedChange } from '@/features/meeting-load/observed-change'
import { suggest, type Suggestion } from '@/features/meeting-load/suggest'
import { localWeekStartIso, weekStartIsoOffset } from '@/features/meeting-load/week-bucket'
import { invitedHoursFor } from '@/features/meeting-load/load-math'

/**
 * The NAMED reads. Everything here may return a person's id, and every call
 * site is gated.
 *
 * THERE IS NO FUNCTION IN THIS FILE THAT GROUPS BY ORGANIZER, and that is
 * deliberate rather than an omission — please do not helpfully add one. An
 * org-visible acceptance rate attributable to individuals, at nine people, is a
 * number that pressures somebody into accepting AI output to avoid looking
 * obstructive. The engine is a thermostat, not a scoreboard.
 *
 * The counterpart is `queries.ts`, whose return types structurally contain no
 * user ids at all. A surface that imports THIS file has made a deliberate
 * choice; a surface that forgets to redact cannot, because the org-facing
 * module has nothing to redact.
 */

/** Every decided key, whatever the decision was. Accepted and dismissed both
 *  mean "somebody has answered this"; re-asking would be the engine nagging. */
export async function getAllDecidedKeys(): Promise<Set<string>> {
  const rows = await db
    .select({ targetKey: meetingLoadDecisions.targetKey })
    .from(meetingLoadDecisions)
  return new Set(rows.map((row) => row.targetKey))
}

/**
 * The full queue, `trim_invite` included, with the names R5 needs.
 *
 * THE ONE PLACE `zeroEvidenceInviteeIds` IS EVER POPULATED. Everywhere else it
 * stays undefined and R5 cannot fire — see `AnalyzedOccurrence`'s docblock for
 * why that is a shape rather than a filter.
 */
export async function getAllSuggestionsForAdmin(now: Date): Promise<Suggestion[]> {
  const facts = await gatherLoadFacts(now)
  return suggest(withNames(facts.redactedSeriesMetrics(now)), await getAllDecidedKeys())
}

/**
 * One organizer's own suggestions.
 *
 * THE ELIGIBILITY CHECK COMES FIRST, before any evidence is read. Filtering at
 * render time would mean the data had already entered a payload it should never
 * have reached — a distinction that matters the moment anything caches or logs
 * one.
 */
export async function getSuggestionsForOrganizer(
  userId: string,
  now: Date,
): Promise<Suggestion[]> {
  const facts = await gatherLoadFacts(now)
  const mine = facts.redactedSeriesMetrics(now).filter((series) => series.organizerId === userId)
  if (mine.length === 0) return []
  return suggest(withNames(mine), await getAllDecidedKeys())
}

/**
 * Populating R5's names is a stub until the attendee recommender writes rows.
 *
 * `hardEvidencePool` is zero on every occurrence until A1's scoring lands, and
 * R5 is gated on that sum being non-trivial — so it stays silent rather than
 * naming people on no evidence, which is exactly the right failure. When A1
 * lands this becomes a real read of `meeting_attendee_recommendations` and
 * needs no change anywhere else.
 */
function withNames<T>(series: T[]): T[] {
  return series
}

export async function getDismissedDecisions(): Promise<{
  id: string; kind: string; targetKey: string; evidence: unknown; decidedAt: Date
}[]> {
  const rows = await db
    .select({
      id: meetingLoadDecisions.id, kind: meetingLoadDecisions.kind,
      targetKey: meetingLoadDecisions.targetKey, evidence: meetingLoadDecisions.evidence,
      decidedAt: meetingLoadDecisions.createdAt,
    })
    .from(meetingLoadDecisions)
    .where(eq(meetingLoadDecisions.status, 'dismissed'))
    .orderBy(desc(meetingLoadDecisions.createdAt))
  return rows
}

/**
 * What actually happened after each accepted decision.
 *
 * Measured from the same live reads every other figure uses, so it is capable
 * of reporting that the load went UP — which is the point of keeping a ledger
 * rather than a running total of hours the feature awarded itself.
 */
export async function getObservedChangesForAdmin(now: Date): Promise<{
  decisionId: string; kind: string; targetKey: string; change: ObservedChange
}[]> {
  const [decisions, facts] = await Promise.all([
    db
      .select({
        id: meetingLoadDecisions.id, kind: meetingLoadDecisions.kind,
        targetKey: meetingLoadDecisions.targetKey, createdAt: meetingLoadDecisions.createdAt,
      })
      .from(meetingLoadDecisions)
      .where(eq(meetingLoadDecisions.status, 'accepted')),
    gatherLoadFacts(now),
  ])

  const byWeek = new Map<string, number>()
  for (const meeting of facts.meetings) {
    const week = localWeekStartIso(meeting.startsAt)
    const { hours } = invitedHoursFor({
      meetingId: meeting.meetingId, startsAt: meeting.startsAt, endsAt: meeting.endsAt,
      attendeeResponses: meeting.responses,
    })
    byWeek.set(week, (byWeek.get(week) ?? 0) + hours)
  }
  const hoursIn = (weekStartIso: string) => ({ weekStartIso, hours: byWeek.get(weekStartIso) ?? 0 })

  return decisions.map((decision) => {
    const decidedWeek = localWeekStartIso(decision.createdAt)
    return {
      decisionId: decision.id,
      kind: decision.kind,
      targetKey: decision.targetKey,
      change: observedChangeFor({
        decidedAt: decision.createdAt,
        // The decision's OWN week is in neither window: it is half old
        // behaviour and half new, and counting it either way would flatter or
        // punish the decision for no reason.
        beforeWeeklyHours: [1, 2, 3, 4].map((back) => hoursIn(weekStartIsoOffset(decidedWeek, back))),
        afterWeeklyHours: [1, 2, 3, 4].map((ahead) => hoursIn(weekStartIsoOffset(decidedWeek, -ahead))),
      }),
    }
  })
}

/**
 * Acceptance by RULE, never by person.
 *
 * The thermostat reading: if one rule is dismissed every time, that rule is
 * wrong, and this is how anybody would find out. Grouping the same numbers by
 * organizer would turn the same data into a performance review, which is why
 * no such function exists here.
 *
 * TODO: the attendee recommender's half of this — acceptance grouped by surface
 * and tier over the last 180 days, with 'open' excluded — activates on its own
 * once A1's actions are writing rows. It needs no change in this file.
 */
export async function getAcceptanceByKind(): Promise<{
  kind: string; accepted: number; dismissed: number; rate: number
}[]> {
  const rows = await db
    .select({ kind: meetingLoadDecisions.kind, status: meetingLoadDecisions.status })
    .from(meetingLoadDecisions)

  const byKind = new Map<string, { accepted: number; dismissed: number }>()
  for (const row of rows) {
    const tally = byKind.get(row.kind) ?? { accepted: 0, dismissed: 0 }
    if (row.status === 'accepted') tally.accepted += 1
    if (row.status === 'dismissed') tally.dismissed += 1
    byKind.set(row.kind, tally)
  }

  return [...byKind.entries()]
    .map(([kind, tally]) => ({
      kind,
      ...tally,
      rate: tally.accepted + tally.dismissed === 0
        ? 0
        : tally.accepted / (tally.accepted + tally.dismissed),
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind))
}
