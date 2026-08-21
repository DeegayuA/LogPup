import { and, eq, gte } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveMeetings, liveNoteSegments } from '@/db/live'
import {
  meetingAiNotes, meetingApps, meetingAttendees, meetingFollowups, meetingTaskSuggestions,
} from '@/db/schema'
import type { AttendeeResponse, RsvpAdoptionRow } from '@/features/meeting-load/load-math'
import type { OutputFacts } from '@/features/meeting-load/density'
import type { VoiceSegment } from '@/features/meeting-load/participation'
import type { OccurrenceInvites } from '@/features/meeting-load/churn'
import { splitOutputs } from '@/features/meeting-load/density'
import { invitedHoursFor } from '@/features/meeting-load/load-math'
import { participationFor } from '@/features/meeting-load/participation'
import { groupIntoSeries, type SeriesOccurrenceInput } from '@/features/meeting-load/series-groups'
import type { AnalyzedOccurrence, SeriesMetrics } from '@/features/meeting-load/suggest'
import { localWeekStartIso } from '@/features/meeting-load/week-bucket'

/**
 * ONE batched read of everything the meeting-load surfaces need.
 *
 * The query count is FIXED and does not grow with meetings, people, projects or
 * series. Seven statements issued together, then every number is computed in JS
 * by the pure modules — which is what lets each of those numbers be tested by
 * value rather than against a database.
 *
 * EVERY CHILD READ JOINS `liveMeetings`, including the ones the automated guard
 * would not force. `meeting_attendees`, `meeting_ai_notes`, `meeting_followups`
 * and `meeting_task_suggestions` carry no `deletedAt` of their own and are live
 * exactly when their meeting is, so a read that forgot the join would count a
 * trashed meeting's hours into somebody's week.
 */

const DAY_MS = 24 * 60 * 60 * 1000
/** Long enough for series establishment (180 days), which is the widest window
 *  anything here needs. The 12-week trend is a subset of it. */
const GATHER_DAYS = 180

export type MeetingFact = {
  meetingId: string
  title: string
  startsAt: Date
  endsAt: Date
  createdBy: string
  hasAgenda: boolean
  appIds: string[]
  responses: AttendeeResponse[]
  attendees: RsvpAdoptionRow[]
  nonDeclinedUserIds: string[]
  analyzed: boolean
  model: string | null
}

export type LoadFacts = {
  meetings: MeetingFact[]
  occurrences: SeriesOccurrenceInput[]
  appNames: Map<string, string>
  analyzedIds: Set<string>
  outputFacts: Map<string, OutputFacts>
  voiceSegments: VoiceSegment[]
  responsesByMeeting: Map<string, AttendeeResponse[]>
  /**
   * Series metrics with `zeroEvidenceInviteeIds` LEFT UNPOPULATED.
   *
   * This is the redaction, and it is a shape rather than a filter: R5
   * TRIM-INVITE returns null the moment that field is undefined, so a surface
   * built on this cannot name anybody even if somebody later forgets why. Only
   * `admin-queries.ts` populates it, from a gated call site.
   */
  redactedSeriesMetrics: (now: Date) => SeriesMetrics[]
}

/** Invite sets for churn, in the newest-first order the group already holds. */
export function churnFacts(occurrences: readonly SeriesOccurrenceInput[]): OccurrenceInvites[] {
  return occurrences.map((o) => ({ meetingId: o.meetingId, inviteUserIds: o.inviteUserIds }))
}

/** e.g. "2026-W34" — R3's same-week test, derived from the one Colombo week
 *  bucketing function rather than a second date_trunc. */
export function isoWeekOf(date: Date): string {
  const weekStart = localWeekStartIso(date)
  const anchor = new Date(`${weekStart}T12:00:00Z`)
  const yearStart = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((anchor.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  return `${anchor.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export async function gatherLoadFacts(now: Date): Promise<LoadFacts> {
  const since = new Date(now.getTime() - GATHER_DAYS * DAY_MS)

  const [meetingRows, attendeeRows, appRows, appNameRows, noteRows, segmentRows, followupRows, suggestionRows] =
    await Promise.all([
      db
        .select({
          meetingId: liveMeetings.id, title: liveMeetings.title, startsAt: liveMeetings.startsAt,
          endsAt: liveMeetings.endsAt, createdBy: liveMeetings.createdBy, agenda: liveMeetings.agenda,
        })
        .from(liveMeetings)
        .where(gte(liveMeetings.startsAt, since)),
      db
        .select({
          meetingId: meetingAttendees.meetingId, userId: meetingAttendees.userId,
          response: meetingAttendees.response,
        })
        .from(meetingAttendees)
        .innerJoin(liveMeetings, eq(meetingAttendees.meetingId, liveMeetings.id))
        .where(gte(liveMeetings.startsAt, since)),
      db
        .select({ meetingId: meetingApps.meetingId, appId: meetingApps.appId })
        .from(meetingApps)
        .innerJoin(liveMeetings, eq(meetingApps.meetingId, liveMeetings.id))
        .where(gte(liveMeetings.startsAt, since)),
      // liveApps, not apps: a deleted project must not keep naming itself on
      // the per-project breakdown while admin Trash lists it deleted.
      db.select({ id: liveApps.id, name: liveApps.name }).from(liveApps),
      db
        .select({
          meetingId: meetingAiNotes.meetingId, model: meetingAiNotes.model,
          deadlines: meetingAiNotes.deadlines,
        })
        .from(meetingAiNotes)
        .innerJoin(liveMeetings, eq(meetingAiNotes.meetingId, liveMeetings.id))
        .where(gte(liveMeetings.startsAt, since)),
      // Voice segments only. The source discrimination happens HERE, once, and
      // participation.ts trusts it rather than re-filtering — see its docblock.
      db
        .select({ meetingId: liveNoteSegments.meetingId, speakerId: liveNoteSegments.speakerId })
        .from(liveNoteSegments)
        .innerJoin(liveMeetings, eq(liveNoteSegments.meetingId, liveMeetings.id))
        .where(and(gte(liveMeetings.startsAt, since), eq(liveNoteSegments.source, 'voice'))),
      db
        .select({
          meetingId: meetingFollowups.sourceMeetingId, createdBy: meetingFollowups.createdBy,
        })
        .from(meetingFollowups)
        .innerJoin(liveMeetings, eq(meetingFollowups.sourceMeetingId, liveMeetings.id))
        .where(gte(liveMeetings.startsAt, since)),
      db
        .select({ meetingId: meetingTaskSuggestions.meetingId })
        .from(meetingTaskSuggestions)
        .innerJoin(liveMeetings, eq(meetingTaskSuggestions.meetingId, liveMeetings.id))
        .where(and(gte(liveMeetings.startsAt, since), eq(meetingTaskSuggestions.status, 'accepted'))),
    ])

  const attendeesByMeeting = new Map<string, RsvpAdoptionRow[]>()
  for (const row of attendeeRows) {
    attendeesByMeeting.set(row.meetingId, [
      ...(attendeesByMeeting.get(row.meetingId) ?? []),
      { userId: row.userId, response: row.response as AttendeeResponse },
    ])
  }

  const appsByMeeting = new Map<string, string[]>()
  for (const row of appRows) {
    appsByMeeting.set(row.meetingId, [...(appsByMeeting.get(row.meetingId) ?? []), row.appId])
  }

  const noteByMeeting = new Map(noteRows.map((row) => [row.meetingId, row]))
  const aiFollowupsByMeeting = new Map<string, number>()
  const manualFollowupsByMeeting = new Map<string, number>()
  for (const row of followupRows) {
    // createdBy NULL is the "was a human asking for this?" flag, and the whole
    // basis of the anti-gaming split in density.ts.
    const target = row.createdBy === null ? aiFollowupsByMeeting : manualFollowupsByMeeting
    target.set(row.meetingId, (target.get(row.meetingId) ?? 0) + 1)
  }
  const acceptedByMeeting = new Map<string, number>()
  for (const row of suggestionRows) {
    acceptedByMeeting.set(row.meetingId, (acceptedByMeeting.get(row.meetingId) ?? 0) + 1)
  }

  const meetings: MeetingFact[] = meetingRows.map((row) => {
    const attendees = attendeesByMeeting.get(row.meetingId) ?? []
    const note = noteByMeeting.get(row.meetingId)
    return {
      meetingId: row.meetingId,
      title: row.title,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      createdBy: row.createdBy,
      hasAgenda: (row.agenda ?? '').trim().length > 0,
      appIds: appsByMeeting.get(row.meetingId) ?? [],
      responses: attendees.map((a) => a.response),
      attendees,
      nonDeclinedUserIds: attendees.filter((a) => a.response !== 'declined').map((a) => a.userId),
      analyzed: note !== undefined,
      model: note?.model ?? null,
    }
  })

  const outputFacts = new Map<string, OutputFacts>()
  for (const meeting of meetings) {
    const note = noteByMeeting.get(meeting.meetingId)
    if (!note) continue
    outputFacts.set(meeting.meetingId, {
      meetingId: meeting.meetingId,
      model: note.model,
      aiDerivedFollowups: aiFollowupsByMeeting.get(meeting.meetingId) ?? 0,
      manualFollowups: manualFollowupsByMeeting.get(meeting.meetingId) ?? 0,
      acceptedTaskSuggestions: acceptedByMeeting.get(meeting.meetingId) ?? 0,
      deadlinesJson: note.deadlines,
    })
  }

  const occurrences: SeriesOccurrenceInput[] = meetings.map((meeting) => ({
    meetingId: meeting.meetingId,
    title: meeting.title,
    // One project or none: a series is inferred per project, and a joint
    // meeting is not evidence that either project meets on a cadence.
    appId: meeting.appIds.length === 1 ? meeting.appIds[0] : null,
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
    createdBy: meeting.createdBy,
    // ALL invited, unfiltered by response — churn and R3's Jaccard both want
    // the raw invite set.
    inviteUserIds: (attendeesByMeeting.get(meeting.meetingId) ?? []).map((a) => a.userId),
  }))

  const voiceSegments: VoiceSegment[] = segmentRows.map((row) => ({
    meetingId: row.meetingId, speakerId: row.speakerId,
  }))
  const analyzedIds = new Set(meetings.filter((m) => m.analyzed).map((m) => m.meetingId))
  const responsesByMeeting = new Map(meetings.map((m) => [m.meetingId, m.responses]))
  const byId = new Map(meetings.map((m) => [m.meetingId, m]))

  function redactedSeriesMetrics(at: Date): SeriesMetrics[] {
    return groupIntoSeries(occurrences, at).map((group) => {
      const weeksInWindow = Math.max(1, GATHER_DAYS / 7)
      const lastFour = group.occurrences.slice(0, 4)
      const analyzed = lastFour.filter((o) => analyzedIds.has(o.meetingId))

      const last4Analyzed: AnalyzedOccurrence[] = analyzed.map((o) => {
        const counts = splitOutputs(outputFacts.get(o.meetingId)!)
        const seen = participationFor(o.meetingId, voiceSegments)
        return {
          meetingId: o.meetingId,
          model: counts.model,
          aiDerivedOutputs: counts.aiDerived,
          mappedSpeakers: seen.mappedSpeakers,
          voiceTurns: seen.turns,
          isoWeek: isoWeekOf(o.startsAt),
          // Zero until the attendee recommender has written rows. R5 is gated
          // on this being non-trivial, so it simply stays quiet until then.
          hardEvidencePool: 0,
          // zeroEvidenceInviteeIds DELIBERATELY ABSENT — see LoadFacts.
        }
      })

      const totalHours = group.occurrences.reduce((sum, o) => sum + invitedHoursFor({
        meetingId: o.meetingId, startsAt: o.startsAt, endsAt: o.endsAt,
        attendeeResponses: byId.get(o.meetingId)?.responses ?? [],
      }).hours, 0)
      const durations = group.occurrences.map(
        (o) => (o.endsAt.getTime() - o.startsAt.getTime()) / 60_000,
      )
      const sorted = [...durations].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)

      return {
        groupKey: group.groupKey,
        seriesKey: group.seriesKey,
        title: group.occurrences[0].title,
        appId: group.appId,
        mergeable: group.mergeable,
        established: group.established,
        activeRecently: group.activeRecently,
        organizerId: group.organizerId,
        occurrenceCountInWindow: group.occurrences.length,
        medianDurationMinutes: sorted.length === 0
          ? 0
          : sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid],
        invitedHoursPerWeek: totalHours / weeksInWindow,
        consideredCountLast4: lastFour.length,
        last4Analyzed,
        last3InviteSets: group.occurrences.slice(0, 3).map((o) => o.inviteUserIds),
      }
    })
  }

  return {
    meetings,
    occurrences,
    appNames: new Map(appNameRows.map((row) => [row.id, row.name])),
    analyzedIds,
    outputFacts,
    voiceSegments,
    responsesByMeeting,
    redactedSeriesMetrics,
  }
}
