import { and, eq, gte } from 'drizzle-orm'
import { db } from '@/db'
import { liveMeetings } from '@/db/live'
import { meetingAttendees } from '@/db/schema'
import { churnFacts, gatherLoadFacts, type LoadFacts } from '@/features/meeting-load/gather'
import { computeCollisions } from '@/features/meeting-load/collisions'
import { coverageOf, splitOutputs } from '@/features/meeting-load/density'
import { invitedHoursFor, rsvpAdoption, type RsvpAdoptionResult } from '@/features/meeting-load/load-math'
import { participationFor, seriesParticipationMedians } from '@/features/meeting-load/participation'
import { seriesChurnCount } from '@/features/meeting-load/churn'
import { groupIntoSeries } from '@/features/meeting-load/series-groups'
import { aggregateSuggestions, suggest } from '@/features/meeting-load/suggest'
import { buildLoadTrend, type LoadTrendData } from '@/features/meeting-load/trend-points'
import { localWeekStartIso } from '@/features/meeting-load/week-bucket'

/**
 * The ORG-FACING reads. Every row this file returns is safe on a page anybody
 * signed in can open.
 *
 * VISIBILITY IS ENFORCED BY THE TYPES, not by remembering to redact. No return
 * type below contains a `userId`, an `organizerId`, or a name — so a surface
 * built on this file cannot leak one by omission, only by deliberately
 * importing `admin-queries.ts` instead. A forgotten redaction is a type error
 * rather than a dashboard leak.
 *
 * THE SAME RULE APPLIES TO R5. The series metrics assembled here never populate
 * `AnalyzedOccurrence.zeroEvidenceInviteeIds`, so TRIM-INVITE cannot fire from
 * this path at all — see the field's own docblock. That is deliberately not a
 * filter: a filter can be removed, whereas a field that is never populated has
 * to be deliberately added back.
 *
 * NO SECOND OPINION ABOUT ANY NUMBER. Every figure returned is an undecorated
 * call into a tested pure module. There is no `date_trunc` and no hours formula
 * in this file — a second one would drift from the first, and the drill-down
 * would stop reconciling with the summary it drilled into.
 */

export type WeeklyLoadRow = {
  weekStartIso: string
  invitedHours: number
  meetingCount: number
  coverage: number
  noAgendaCount: number
  noAppCount: number
  overlapHours: number
  rsvpAdoption: RsvpAdoptionResult
}

export type PerAppLoadRow = { appId: string | null; appName: string; invitedHours: number }

export type SeriesTableRow = {
  groupKey: string
  seriesKey: string
  appId: string | null
  occurrenceCount: number
  invitedHoursPerOccurrence: number
  medianDurationMinutes: number
  /** A COUNT, never names — see churn.ts. */
  churnCount: number
  aiDerivedOutputs: number
  manualOutputs: number
  medianMappedSpeakers: number
  medianVoiceTurns: number
  coverage: number
}

export async function getInvitedHoursTrend(now: Date): Promise<LoadTrendData> {
  const facts = await gatherLoadFacts(now)
  return buildLoadTrend(weeklyHours(facts), now)
}

/** Weekly hours, bucketed in Colombo by the one bucketing function. */
function weeklyHours(facts: LoadFacts): { weekStartIso: string; hours: number }[] {
  const byWeek = new Map<string, number>()
  for (const meeting of facts.meetings) {
    const { hours } = invitedHoursFor({
      meetingId: meeting.meetingId,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      attendeeResponses: meeting.responses,
    })
    const week = localWeekStartIso(meeting.startsAt)
    byWeek.set(week, (byWeek.get(week) ?? 0) + hours)
  }
  return [...byWeek.entries()].map(([weekStartIso, hours]) => ({ weekStartIso, hours }))
}

export async function getWeeklyLoadTable(now: Date): Promise<WeeklyLoadRow[]> {
  const facts = await gatherLoadFacts(now)
  const byWeek = new Map<string, typeof facts.meetings>()
  for (const meeting of facts.meetings) {
    const week = localWeekStartIso(meeting.startsAt)
    byWeek.set(week, [...(byWeek.get(week) ?? []), meeting])
  }

  return [...byWeek.entries()]
    .map(([weekStartIso, meetings]) => {
      const collisions = computeCollisions(meetings.map((m) => ({
        meetingId: m.meetingId,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        nonDeclinedUserIds: m.nonDeclinedUserIds,
      })))
      return {
        weekStartIso,
        invitedHours: meetings.reduce((sum, m) => sum + invitedHoursFor({
          meetingId: m.meetingId, startsAt: m.startsAt, endsAt: m.endsAt,
          attendeeResponses: m.responses,
        }).hours, 0),
        meetingCount: meetings.length,
        coverage: coverageOf(meetings.filter((m) => m.analyzed).length, meetings.length),
        noAgendaCount: meetings.filter((m) => !m.hasAgenda).length,
        noAppCount: meetings.filter((m) => m.appIds.length === 0).length,
        // TEAM TOTAL ONLY. The per-user breakdown computeCollisions also
        // returns is deliberately dropped here and read only in a self-view.
        overlapHours: collisions.teamOverlapHours,
        rsvpAdoption: rsvpAdoption(meetings.map((m) => ({
          meetingId: m.meetingId, createdBy: m.createdBy, attendees: m.attendees,
        }))),
      }
    })
    .sort((a, b) => a.weekStartIso.localeCompare(b.weekStartIso))
}

export async function getPerAppLoad(now: Date): Promise<PerAppLoadRow[]> {
  const facts = await gatherLoadFacts(now)
  const byApp = new Map<string | null, number>()

  for (const meeting of facts.meetings) {
    const { hours } = invitedHoursFor({
      meetingId: meeting.meetingId, startsAt: meeting.startsAt, endsAt: meeting.endsAt,
      attendeeResponses: meeting.responses,
    })
    if (meeting.appIds.length === 0) {
      // The "No app" bucket is a real answer, not a rounding error: a company
      // all-hands belongs to nobody, and hiding its hours would understate the
      // total everybody is actually being invited to.
      byApp.set(null, (byApp.get(null) ?? 0) + hours)
      continue
    }
    // Split evenly across the projects a joint meeting serves, rather than
    // attributed to whichever sorts first — the total across apps has to equal
    // the org total, or the two tables stop reconciling.
    const share = hours / meeting.appIds.length
    for (const appId of meeting.appIds) byApp.set(appId, (byApp.get(appId) ?? 0) + share)
  }

  return [...byApp.entries()]
    .map(([appId, invitedHours]) => ({
      appId,
      appName: appId === null ? 'No app' : (facts.appNames.get(appId) ?? 'Unknown project'),
      invitedHours,
    }))
    .sort((a, b) => b.invitedHours - a.invitedHours || a.appName.localeCompare(b.appName))
}

export async function getSeriesTable(now: Date): Promise<SeriesTableRow[]> {
  const facts = await gatherLoadFacts(now)
  const groups = groupIntoSeries(facts.occurrences, now)

  return groups.map((group) => {
    const analyzed = group.occurrences.filter((o) => facts.analyzedIds.has(o.meetingId))
    const outputs = analyzed.map((o) => splitOutputs(facts.outputFacts.get(o.meetingId)!))
    const participation = analyzed.map((o) => participationFor(o.meetingId, facts.voiceSegments))
    const medians = seriesParticipationMedians(participation)
    const durations = group.occurrences.map(
      (o) => (o.endsAt.getTime() - o.startsAt.getTime()) / 60_000,
    )
    const hours = group.occurrences.reduce((sum, o) => sum + invitedHoursFor({
      meetingId: o.meetingId, startsAt: o.startsAt, endsAt: o.endsAt,
      attendeeResponses: facts.responsesByMeeting.get(o.meetingId) ?? [],
    }).hours, 0)

    return {
      groupKey: group.groupKey,
      seriesKey: group.seriesKey,
      appId: group.appId,
      occurrenceCount: group.occurrences.length,
      invitedHoursPerOccurrence: group.occurrences.length === 0 ? 0 : hours / group.occurrences.length,
      medianDurationMinutes: medianOf(durations),
      churnCount: seriesChurnCount(churnFacts(group.occurrences)),
      aiDerivedOutputs: outputs.reduce((sum, o) => sum + o.aiDerived, 0),
      manualOutputs: outputs.reduce((sum, o) => sum + o.manual, 0),
      medianMappedSpeakers: medians.medianMappedSpeakers,
      medianVoiceTurns: medians.medianVoiceTurns,
      coverage: coverageOf(analyzed.length, group.occurrences.length),
    }
  })
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * The one line the org at large ever sees.
 *
 * Built from the REDACTED series metrics, so `trim_invite` cannot fire — and
 * `aggregateSuggestions` excludes it a second time anyway. Two independent
 * reasons the number cannot move when somebody's invite list is questioned.
 */
export async function getSuggestionsAggregate(
  now: Date,
  decidedKeys: ReadonlySet<string>,
): Promise<{ count: number; potentialHoursPerWeek: number }> {
  const facts = await gatherLoadFacts(now)
  return aggregateSuggestions(suggest(facts.redactedSeriesMetrics(now), decidedKeys))
}

/**
 * The reader's own pending invitations.
 *
 * A SELF-VIEW, and the only place this file returns anything keyed to a person
 * — the caller passes their own id and gets their own rows. It is a nudge to
 * answer, never an input to a rule: "pending" measures widget adoption, which
 * is exactly why nothing in `suggest.ts` can see it.
 */
export async function getMyPendingInvites(
  userId: string,
): Promise<{ meetingId: string; title: string; startsAt: Date }[]> {
  const rows = await db
    .select({
      meetingId: liveMeetings.id, title: liveMeetings.title, startsAt: liveMeetings.startsAt,
    })
    .from(meetingAttendees)
    // meeting_attendees carries no deletedAt of its own — the join against
    // liveMeetings is what stops a trashed meeting's invites reading.
    .innerJoin(liveMeetings, eq(meetingAttendees.meetingId, liveMeetings.id))
    .where(and(
      eq(meetingAttendees.userId, userId),
      eq(meetingAttendees.response, 'pending'),
      gte(liveMeetings.startsAt, new Date()),
    ))
    .orderBy(liveMeetings.startsAt)
  return rows
}

/** Hours the reader personally lost to double-bookings this week. Their own key
 *  only — the team total is what every org surface shows. */
export async function getMyOverlapHours(userId: string, now: Date): Promise<number> {
  const facts = await gatherLoadFacts(now)
  const thisWeek = localWeekStartIso(now)
  const mine = facts.meetings.filter((m) => localWeekStartIso(m.startsAt) === thisWeek)
  const collisions = computeCollisions(mine.map((m) => ({
    meetingId: m.meetingId, startsAt: m.startsAt, endsAt: m.endsAt,
    nonDeclinedUserIds: m.nonDeclinedUserIds,
  })))
  return collisions.perUserOverlapHours[userId] ?? 0
}

/** Re-exported so a surface never has to reach past this module for the shape
 *  of a row it renders. */
export type { LoadTrendData }
