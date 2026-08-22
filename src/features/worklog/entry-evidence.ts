import { and, asc, eq, gte, inArray, lte, ne } from 'drizzle-orm'
import { db } from '@/db'
import { activityLog, meetingApps, meetingAttendees } from '@/db/schema'
import { liveApps, liveMeetings, liveTasks, liveWorklogEntries } from '@/db/live'
import { isoDayAdd } from '@/features/people/iso-day'
import { isMercantileHoliday, LK_TIMEZONE } from '@/lib/lk-holidays'
import { approvedAbsenceDays } from '@/features/worklog/absence-queries'
import { computeCoverage } from '@/features/worklog/coverage'
import { patternForDay, scheduledMinutesForFraction, STUDIO_DEFAULT_PATTERN } from '@/features/worklog/schedules'
import { getMyWorkSchedule, getOrgHolidayDays, getUserJoinDay } from '@/features/worklog/queries'
import { commitEvidenceFor } from '@/features/github/evidence'
import type { CommitEvidence } from '@/features/github/commits'
import type { CheckEntry, DayEvidence } from '@/features/worklog/entry-check'
import type { DraftMeeting, DraftActivityRow, DraftTask } from '@/features/worklog/entry-draft-prompt'
import { resolveWorkDay } from '@/features/worklog/worklog-day'

/**
 * Everything the two worklog AI features are allowed to know about one
 * person's one day, read once.
 *
 * SELF ONLY. There is no `targetUserId` here and there must not be one. Worklog
 * writes are self-only by deliberate design — no seat holds `worklog.write.any`
 * and capabilities.test.ts asserts the key does not exist — because the record
 * is a first-person statement. An evidence pack that could be assembled ABOUT
 * somebody is the first half of an audit surface, and the design refuses the
 * whole shape, not just the write.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT READ: MEETING TRANSCRIPTS AND SCREEN KEYFRAMES.
 * ---------------------------------------------------------------------------
 * `meeting_note_segments` holds what was said in every meeting this person sat
 * in, and `meeting_screenshots` holds keyframes of what was on screen. Both are
 * indexed, both are one join away, and both would obviously make a better draft
 * and a sharper check.
 *
 * They exist to WRITE UP MEETINGS. Mining them to reconstruct how somebody
 * spent their working hours is a different thing wearing the same data: it
 * turns a tool for remembering your own day into a tool for watching a person
 * through theirs. This design refuses that even though the rows are right
 * there, and refuses it HERE — at the read — rather than in a prompt, because a
 * prompt instruction is a request and an absent join is a guarantee.
 *
 * If you are here to "improve the evidence", improve it with things the person
 * themselves put into LogPup. Adding either of those tables needs its own
 * consent story and its own review, not a quiet extra select.
 * ---------------------------------------------------------------------------
 */

/** Enough to characterise a day; beyond this it is just tokens. */
const MAX_ACTIVITY_ROWS = 60
/** A person's in-progress list; anything longer is a planning problem, not a draft input. */
const MAX_TASKS = 20
/** Nobody sits in more meetings than this in a day, and if they do the first ones tell the story. */
const MAX_MEETINGS = 20

/** One live entry the person has already saved for the day. */
export type DayEntryRow = CheckEntry & { id: string }

/**
 * A meeting as the pack carries it: the prompt's display shape PLUS the real
 * recorded instants.
 *
 * The instants are kept rather than re-derived from the labels because
 * `findDiscrepancies` merges overlapping spans — somebody invited to two
 * meetings in the same hour did not spend two hours in them, and a merge that
 * worked from durations alone could not tell a double-booking from a
 * back-to-back pair. Inflating the attended total would manufacture a "meeting
 * time unaccounted for" observation out of nothing.
 */
export type EvidenceMeeting = DraftMeeting & { startedAt: Date; endedAt: Date }

export type WorklogDayEvidence = {
  day: string
  /**
   * The day's scheduled length in minutes, or NULL when it genuinely cannot be
   * said. ZERO for a day nobody owed work on — Sunday, a holiday, or an
   * APPROVED absence — which is what makes both schedule comparisons skip
   * rather than accuse somebody on leave of being short.
   *
   * THERE IS NO DEFAULT ANYWHERE ON THIS PATH. The one definition of how long a
   * full day is lives in schedules.ts (MINUTES_PER_FULL_DAY, via
   * scheduledMinutesForFraction) and the rounding happens exactly once, inside
   * that helper. A `?? 480` here would be a second answer to the same question,
   * and two surfaces disagreeing by a rounding step surfaces to a person as
   * being short on hours.
   */
  scheduledMinutes: number | null
  /** True when an APPROVED absence covers this day. Pending never exempts. */
  onApprovedAbsence: boolean
  meetings: EvidenceMeeting[]
  activity: DraftActivityRow[]
  tasks: DraftTask[]
  /** Commits they authored inside the day window — empty whenever the GitHub
   *  App isn't configured or they haven't set a username on /profile, and the
   *  draft works identically without them (extra witnesses, not a dependency). */
  commits: CommitEvidence[]
  /** Task ids the activity log shows them demonstrably touching that day. */
  tasksTouched: string[]
}

/** Colombo wall-clock "09:30" — the meeting times a person would recognise. */
const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: LK_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * The day as an instant window at the Colombo offset (+05:30, no DST), the
 * same boundary `resolveWorkDay` files a log under. A UTC slice would put the
 * first five and a half hours of every day under yesterday.
 */
function dayWindow(day: string): { start: Date; end: Date } {
  return {
    start: new Date(`${day}T00:00:00+05:30`),
    end: new Date(`${day}T23:59:59.999+05:30`),
  }
}

/**
 * The day's scheduled length, through `computeCoverage` rather than a fourth
 * opinion about whether a log was owed.
 *
 * Reads the day's FRACTION, not its status: computeCoverage reports today as
 * 'not-yet-due' whatever else is true of it, and the day being checked is
 * usually today. The fraction already folds Sunday, a gazetted mercantile
 * holiday and a company shutdown to zero — that ladder is documented once, in
 * coverage.ts, and is not restated here.
 *
 * An approved absence is folded separately and deliberately: it is the one
 * exemption whose absence from this number would produce the single worst
 * sentence this feature could say, "you are short on hours", to somebody the
 * studio had already agreed was not working.
 */
async function scheduledMinutesFor(userId: string, day: string, now: Date): Promise<{
  scheduledMinutes: number
  onApprovedAbsence: boolean
}> {
  const nextDay = isoDayAdd(day, 1)
  const [schedules, orgHolidays, absenceDays, joinedOn] = await Promise.all([
    getMyWorkSchedule(userId),
    getOrgHolidayDays(day, day),
    // As-is, from absence-queries.ts. Half-open [from, to) there, so the window
    // is this one day. Approved only — a pending absence exempts nothing, so
    // filing one cannot lower the filer's own denominator.
    approvedAbsenceDays(userId, day, nextDay),
    getUserJoinDay(userId),
  ])

  const companyHolidays = new Set(orgHolidays)
  const [today] = computeCoverage({
    from: day,
    to: nextDay,
    // Empty on purpose: this asks what the day was WORTH, not whether a
    // daily_worklogs header row exists for it. 'logged' outranks 'off' in the
    // status ladder, and letting it do so here would report a holiday somebody
    // logged as a full scheduled day.
    loggedDays: new Set(),
    exemptDays: absenceDays,
    isHoliday: (iso) => isMercantileHoliday(iso) || companyHolidays.has(iso),
    patternFor: (iso) => (schedules.length === 0 ? STUDIO_DEFAULT_PATTERN : patternForDay(schedules, iso)),
    joinedOn: joinedOn ?? day,
    today: resolveWorkDay(now),
  }).days

  const onApprovedAbsence = absenceDays.has(day)
  const fraction = today?.fraction ?? 0
  return {
    scheduledMinutes: onApprovedAbsence || fraction <= 0 ? 0 : scheduledMinutesForFraction(fraction),
    onApprovedAbsence,
  }
}

/** Meetings this person was on that day, with the times actually recorded. */
async function meetingsAttended(userId: string, day: string): Promise<EvidenceMeeting[]> {
  const { start, end } = dayWindow(day)

  const rows = await db
    .select({
      id: liveMeetings.id,
      title: liveMeetings.title,
      startsAt: liveMeetings.startsAt,
      endsAt: liveMeetings.endsAt,
    })
    .from(meetingAttendees)
    // meetingAttendees has no deletedAt of its own — live iff its meeting is.
    .innerJoin(liveMeetings, eq(liveMeetings.id, meetingAttendees.meetingId))
    .where(
      and(
        eq(meetingAttendees.userId, userId),
        // A declined invitation is not time somebody spent. Every other RSVP
        // state — including 'pending', which is what most invitations stay at
        // for people who simply turn up — is treated as attended.
        ne(meetingAttendees.response, 'declined'),
        gte(liveMeetings.startsAt, start),
        lte(liveMeetings.startsAt, end),
      ),
    )
    .orderBy(asc(liveMeetings.startsAt))
    .limit(MAX_MEETINGS)

  if (rows.length === 0) return []

  // Projects in a SECOND read rather than a join, for two reasons. The
  // structural one: a meeting has N projects, so joining multiplies the rows
  // and makes the LIMIT above count project links instead of meetings. The
  // mechanical one: left-joining `liveApps` (a subquery) into this statement
  // collapses drizzle's inferred type for `liveMeetings.startsAt`/`endsAt` to
  // `never`, and the recorded start and end times are the whole reason this
  // query exists.
  //
  // The join here is inner, but the ASSIGNMENT back is optional: a meeting
  // with no row in this result keeps `projects: []`. "No project" is a REAL
  // CASE, not missing data — 0040 made meetings many-to-many with apps (a
  // company all-hands belongs to nobody) and `purgeApp` leaves meetings behind
  // with the link gone. The person still sat in it, so the time still counts.
  const projectRows = await db
    .select({ meetingId: meetingApps.meetingId, appName: liveApps.name })
    .from(meetingApps)
    .innerJoin(liveApps, eq(liveApps.id, meetingApps.appId))
    .where(inArray(meetingApps.meetingId, rows.map((row) => row.id)))
    .orderBy(asc(liveApps.name))

  const projects = new Map<string, string[]>()
  for (const row of projectRows) {
    const seen = projects.get(row.meetingId)
    if (seen) seen.push(row.appName)
    else projects.set(row.meetingId, [row.appName])
  }

  return rows.map((row) => ({
    title: row.title,
    startedAt: row.startsAt,
    endedAt: row.endsAt,
    startLabel: clock.format(row.startsAt),
    endLabel: clock.format(row.endsAt),
    minutes: Math.max(0, Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000)),
    projects: projects.get(row.id) ?? [],
  }))
}

/**
 * Everything one day's draft or check may look at, in one batched pass.
 *
 * ONE `Promise.all`: on the Neon HTTP driver every await is a full round trip,
 * and a person is watching this resolve.
 */
export async function loadDayEvidence(
  userId: string,
  day: string,
  now: Date,
): Promise<WorklogDayEvidence> {
  const { start, end } = dayWindow(day)

  const [schedule, meetings, activityRows, taskRows, commits] = await Promise.all([
    scheduledMinutesFor(userId, day, now),
    meetingsAttended(userId, day),
    db
      .select({
        verb: activityLog.verb,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        entityLabel: activityLog.entityLabel,
        appName: activityLog.appName,
      })
      .from(activityLog)
      // Their OWN rows. This predicate is what makes the whole pack self-only.
      .where(
        and(
          eq(activityLog.actorId, userId),
          gte(activityLog.createdAt, start),
          lte(activityLog.createdAt, end),
        ),
      )
      .orderBy(asc(activityLog.createdAt))
      .limit(MAX_ACTIVITY_ROWS),
    db
      .select({ id: liveTasks.id, title: liveTasks.title, appName: liveApps.name })
      .from(liveTasks)
      .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
      .where(and(eq(liveTasks.assigneeId, userId), eq(liveTasks.status, 'in_progress')))
      .orderBy(asc(liveTasks.title))
      .limit(MAX_TASKS),
    commitEvidenceFor(userId, start, end),
  ])

  return {
    day,
    scheduledMinutes: schedule.scheduledMinutes,
    onApprovedAbsence: schedule.onApprovedAbsence,
    meetings,
    activity: activityRows.map((row) => ({
      verb: row.verb,
      entityType: row.entityType,
      entityLabel: row.entityLabel,
      appName: row.appName,
    })),
    tasks: taskRows.map((row) => ({ id: row.id, title: row.title, appName: row.appName })),
    commits,
    // A task row in the activity log carries the task's own id as entityId, so
    // "did they touch this task today" is answerable without a second read.
    tasksTouched: [
      ...new Set(activityRows.filter((r) => r.entityType === 'task').map((r) => r.entityId)),
    ],
  }
}

/**
 * The evidence pack narrowed to what the PURE check function takes.
 *
 * Separate from the pack itself so `findDiscrepancies` keeps receiving exactly
 * the six fields it documents, and cannot start reasoning over a meeting title
 * or an activity verb because they happened to be in scope.
 */
export function toCheckEvidence(evidence: WorklogDayEvidence): DayEvidence {
  return {
    meetingsAttended: evidence.meetings.map((meeting) => ({
      title: meeting.title,
      startedAt: meeting.startedAt,
      endedAt: meeting.endedAt,
    })),
    activityCount: evidence.activity.length,
    scheduledMinutes: evidence.scheduledMinutes,
    tasksTouched: evidence.tasksTouched,
  }
}

/**
 * The live entries this person has saved for that day, with the title of any
 * task they name.
 *
 * Through `liveWorklogEntries`: a soft-deleted entry counted into somebody's
 * total would be the app contradicting them about their own hours.
 */
export async function getMyDayEntries(userId: string, day: string): Promise<DayEntryRow[]> {
  const rows = await db
    .select({
      id: liveWorklogEntries.id,
      minutes: liveWorklogEntries.minutes,
      category: liveWorklogEntries.category,
      taskId: liveWorklogEntries.taskId,
      // LEFT join: a task deleted later must not delete the record that
      // somebody spent three hours on it. The check then names it "that task".
      taskTitle: liveTasks.title,
    })
    .from(liveWorklogEntries)
    .leftJoin(liveTasks, eq(liveTasks.id, liveWorklogEntries.taskId))
    .where(and(eq(liveWorklogEntries.userId, userId), eq(liveWorklogEntries.day, day)))
    .orderBy(asc(liveWorklogEntries.createdAt))
  return rows
}
