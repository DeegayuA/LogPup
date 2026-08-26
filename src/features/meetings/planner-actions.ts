'use server'

import { and, eq, inArray, isNotNull, isNull, lt, ne, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { liveMeetings, liveSprints, liveTasks } from '@/db/live'
import {
  appRoleHistory,
  meetingApps,
  meetingAttendees,
  meetingFollowups,
  users,
} from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { isAdminRole } from '@/features/auth/capabilities'
import { listApps } from '@/features/apps/queries'
import { isBackfilled } from '@/features/apps/role-history'
import { isSprintRunningNow } from '@/features/sprints/sprint-date-range'
import { getCheckinsForSprints } from '@/features/sprints/checkin-queries'
import { OPEN_STATUSES } from '@/features/sprints/board-view'
import { canReadMeetingIntel } from '@/features/meetings/ai-actions'
import {
  assembleMeetingPlan,
  type MeetingPlan,
  type PlanFollowupRow,
  type PlanPersonRow,
  type PlanProjectRow,
  type PlanRoleRow,
  type PlanSprintRow,
  type PlanTaskRow,
} from '@/features/meetings/planner'

/**
 * The read behind "who should attend, and what do I ask them".
 *
 * BATCHING — the whole contract of this file. The query count is FIXED; it
 * does not grow with the number of attendees, candidates, projects, sprints or
 * follow-ups. Four sequential waves, everything inside a wave in parallel:
 *
 *   wave 1  the meeting row, its project set, and the read gate
 *   wave 2  listApps() (6 aggregates, the ONE definition of project health),
 *           the open pm/lead rows, the projects' sprints, their not-done
 *           tasks, the carried follow-ups, and this meeting's attendees   — 11
 *   wave 3  the running sprints' check-ins (getCheckinsForSprints is the
 *           documented ONE grouped read) and every task in those sprints  —  2
 *   wave 4  one users lookup over the union of every id the plan names    —  1
 *
 * Wave 3 waits on wave 2 only because it is keyed by the sprint ids wave 2
 * returns, and wave 4 on wave 3 only because a check-in can introduce a person
 * nothing else named. Nothing in any wave is issued per person or per project.
 *
 * PROJECT HEALTH comes from `listApps()` rather than a private re-derivation:
 * its `health.reasons` are rendered verbatim on the /apps grid, and computing
 * a second set here — even from the same formula — is how two surfaces end up
 * disagreeing about whether a project is at risk. `listApps` is React-`cache`d,
 * so a request that already loaded the portfolio pays nothing for this.
 *
 * NOTHING IS WRITTEN. No attendee row, no follow-up, no agenda text. This is a
 * suggestion list; `meeting_attendees` is still only ever written from ids a
 * human submitted through the meeting form.
 */
export async function getMeetingPlanner(meetingId: string): Promise<ActionResult<MeetingPlan>> {
  const session = await auth()
  if (!session?.user) return err('Not signed in')

  // --- wave 1: the meeting, its projects, and the gate ---------------------
  const [meeting] = await db
    .select({ id: liveMeetings.id, createdBy: liveMeetings.createdBy, startsAt: liveMeetings.startsAt })
    .from(liveMeetings)
    .where(eq(liveMeetings.id, meetingId))
  if (!meeting) return err('Meeting not found')

  // Same gate as getMeetingIntel and getMeetingPrep, and for the same reason,
  // only more so: these rows lay out named people's overdue work, their
  // check-ins and their unanswered questions across several projects at once.
  // canReadMeetingIntel resolves the meeting's project SET itself and decides
  // with can(…) plus managesAnyApp over that set — never a single app id, so
  // the PM of any project this meeting serves gets in.
  if (!(await canReadMeetingIntel(session.user, meeting))) return err('Not available')

  const appRows = await db
    .select({ appId: meetingApps.appId })
    .from(meetingApps)
    .where(eq(meetingApps.meetingId, meeting.id))
  const appIds = appRows.map((row) => row.appId)

  // A meeting on no project has nothing to plan against — not an error, and
  // not an empty-looking failure either. The surface says which it is.
  if (appIds.length === 0) return ok({ projects: [], candidates: [] })

  const todayIso = toIsoDateInTimeZone(new Date())
  const callerIsAdmin = isAdminRole(session.user.role)
  // A second reference to meeting_attendees in the follow-up query below — the
  // caller's own seat on the SOURCE meeting, which is a different row from the
  // attendee list of THIS meeting. meeting_attendees has no deletedAt of its
  // own; every statement here names liveMeetings as its liveness source.
  const callerSeat = alias(meetingAttendees, 'caller_seat')

  // --- wave 2 --------------------------------------------------------------
  const [portfolio, roleRows, sprintRows, openTaskRows, followupRows, attendeeRows] =
    await Promise.all([
      listApps(),
      // The OPEN interval per (app, role) — app_role_history_one_open_idx
      // guarantees at most one, so no dedup is needed. `note` comes along so
      // the surface can say "assumed at migration" (isBackfilled) instead of
      // presenting a backfilled appointment as an observed one.
      db
        .select({
          appId: appRoleHistory.appId,
          userId: appRoleHistory.userId,
          role: appRoleHistory.role,
          note: appRoleHistory.note,
        })
        .from(appRoleHistory)
        .where(and(inArray(appRoleHistory.appId, appIds), isNull(appRoleHistory.effectiveTo))),
      db
        .select({
          sprintId: liveSprints.id,
          name: liveSprints.name,
          appId: liveSprints.appId,
          status: liveSprints.status,
          startDate: liveSprints.startDate,
          endDate: liveSprints.endDate,
        })
        .from(liveSprints)
        .where(inArray(liveSprints.appId, appIds)),
      // Not-done tasks only: the overdue lines are the only thing this feeds,
      // and a done task can never be past due (isPastDue re-checks anyway).
      db
        .select({
          appId: liveTasks.appId,
          sprintId: liveTasks.sprintId,
          assigneeId: liveTasks.assigneeId,
          status: liveTasks.status,
          dueDate: liveTasks.dueDate,
        })
        .from(liveTasks)
        .where(and(inArray(liveTasks.appId, appIds), inArray(liveTasks.status, OPEN_STATUSES))),
      // Open follow-ups owed to an earlier meeting that ALSO serves one of
      // this meeting's projects. Three joins, three separate jobs:
      //
      //  - liveMeetings is what makes a TRASHED source meeting's items
      //    disappear here as they already do from the carried-forward panel;
      //  - meetingApps is the project narrowing the plan calls for, and it
      //    lives HERE rather than inside fetchCarriedFollowups, which stays
      //    deliberately project-agnostic ("any earlier meeting's still-open
      //    item follows its person to whatever meeting they attend next");
      //  - callerSeat is the ENTITLEMENT filter, copied from
      //    fetchCarriedFollowups rather than reinvented. A follow-up's text is
      //    derived from a transcript, so an admin, the source meeting's
      //    creator or someone who was actually in it are the only people it
      //    may be shown to. Deliberately NOT widened to managesAnyApp: this
      //    surface may not disclose more of an earlier meeting than the
      //    carried-forward panel does.
      db
        .select({
          followupId: meetingFollowups.id,
          userId: meetingFollowups.userId,
          text: meetingFollowups.text,
          sourceMeetingId: meetingFollowups.sourceMeetingId,
          sourceMeetingTitle: liveMeetings.title,
          appId: meetingApps.appId,
        })
        .from(meetingFollowups)
        .innerJoin(liveMeetings, eq(meetingFollowups.sourceMeetingId, liveMeetings.id))
        .innerJoin(meetingApps, eq(meetingApps.meetingId, liveMeetings.id))
        .leftJoin(
          callerSeat,
          and(
            eq(callerSeat.meetingId, liveMeetings.id),
            eq(callerSeat.userId, session.user.id),
          ),
        )
        .where(
          and(
            eq(meetingFollowups.status, 'open'),
            isNotNull(meetingFollowups.userId),
            inArray(meetingApps.appId, appIds),
            or(
              eq(meetingFollowups.targetMeetingId, meeting.id),
              and(
                isNull(meetingFollowups.targetMeetingId),
                ne(meetingFollowups.sourceMeetingId, meeting.id),
                lt(liveMeetings.startsAt, meeting.startsAt),
              ),
            ),
            callerIsAdmin
              ? undefined
              : or(eq(liveMeetings.createdBy, session.user.id), isNotNull(callerSeat.userId)),
          ),
        ),
      db
        .select({ userId: meetingAttendees.userId })
        .from(meetingAttendees)
        .where(eq(meetingAttendees.meetingId, meeting.id)),
    ])

  const byAppId = new Map(portfolio.map((app) => [app.id, app]))

  /**
   * Who holds pm / lead on each of the meeting's projects.
   *
   * SOURCE: the OPEN app_role_history intervals — not `managesApp`, which
   * regex-matches whatever somebody typed into `assignments.role` and returns
   * false for a lead outright. `managesApp` / `managesAnyApp` decide
   * PERMISSION; these two rows decide who runs the project, and they are
   * different facts that can name different people (they are used for exactly
   * one job each, and never swapped).
   *
   * FALLBACK to apps.pmId / apps.leadId: schema.ts is explicit that those
   * columns "stay THE live state", and apps.pmId is NOT NULL, so every project
   * has a PM whether or not an open history row exists for it. Reading history
   * alone would silently drop that person from a "who should attend" list —
   * the one failure this surface cannot afford — so the live column fills any
   * gap. It is only ever a gap-filler: where a history row exists it wins,
   * because it is the row that can also say "assumed at migration".
   */
  const roles: PlanRoleRow[] = roleRows.map((row) => ({
    appId: row.appId,
    userId: row.userId,
    role: row.role,
    assumedAtMigration: isBackfilled(row.note),
  }))
  for (const appId of appIds) {
    const app = byAppId.get(appId)
    if (!app) continue
    if (!roles.some((role) => role.appId === appId && role.role === 'pm')) {
      roles.push({ appId, userId: app.pmId, role: 'pm', assumedAtMigration: false })
    }
    if (app.leadId && !roles.some((role) => role.appId === appId && role.role === 'lead')) {
      roles.push({ appId, userId: app.leadId, role: 'lead', assumedAtMigration: false })
    }
  }

  const runningSprints: PlanSprintRow[] = sprintRows
    .filter((row) => isSprintRunningNow(row.status, row.startDate, row.endDate, todayIso))
    .map((row) => ({ sprintId: row.sprintId, name: row.name, appId: row.appId }))
  const runningSprintIds = runningSprints.map((row) => row.sprintId)

  // --- wave 3 --------------------------------------------------------------
  // Both are skipped outright when nothing is running: `inArray` over an empty
  // list is not a query worth sending (the same guard getCheckinsForSprints
  // applies to itself), and the whole check-in half of the plan is empty then.
  const sprintTasksQuery = async (): Promise<PlanTaskRow[]> => {
    if (runningSprintIds.length === 0) return []
    return db
      .select({
        appId: liveTasks.appId,
        sprintId: liveTasks.sprintId,
        assigneeId: liveTasks.assigneeId,
        status: liveTasks.status,
        dueDate: liveTasks.dueDate,
      })
      .from(liveTasks)
      // EVERY status, done included: computeTaskProgress needs the
      // denominator, and a not-done-only feed reports everyone at 0%.
      .where(inArray(liveTasks.sprintId, runningSprintIds))
  }
  const [checkinsBySprint, sprintTaskRows] = await Promise.all([
    getCheckinsForSprints(runningSprintIds),
    sprintTasksQuery(),
  ])
  const checkins = [...checkinsBySprint.values()]
    .flat()
    .map((row) => ({ sprintId: row.sprintId, userId: row.userId, percent: row.percent }))

  // --- wave 4: one names lookup over every id the plan can mention ---------
  const namedIds = new Set<string>()
  for (const row of roles) namedIds.add(row.userId)
  for (const row of openTaskRows) if (row.assigneeId) namedIds.add(row.assigneeId)
  for (const row of followupRows) if (row.userId) namedIds.add(row.userId)
  for (const row of checkins) namedIds.add(row.userId)
  const people: PlanPersonRow[] =
    namedIds.size > 0
      ? await db
          .select({ userId: users.id, name: users.name, avatarUrl: users.avatarUrl })
          .from(users)
          .where(inArray(users.id, [...namedIds]))
      : []

  // --- assembly ------------------------------------------------------------
  const projects: PlanProjectRow[] = appIds
    .map((appId) => byAppId.get(appId))
    .filter((app): app is NonNullable<typeof app> => Boolean(app))
    .map((app) => ({
      appId: app.id,
      name: app.name,
      slug: app.slug,
      healthLevel: app.health.level,
      // Verbatim. appHealth owns this wording; re-phrasing it here would put a
      // second verdict on screen for the reader to reconcile with the first.
      healthReasons: app.health.reasons,
    }))

  // One row per (follow-up, shared project) came back from the join; collapse
  // to one entry per follow-up carrying the set, so a follow-up whose source
  // meeting serves two of these projects is ONE ask, not two.
  type MutableFollowup = Omit<PlanFollowupRow, 'sharedAppIds'> & { sharedAppIds: string[] }
  const followupById = new Map<string, MutableFollowup>()
  for (const row of followupRows) {
    if (!row.userId) continue
    const existing = followupById.get(row.followupId)
    if (existing) {
      if (!existing.sharedAppIds.includes(row.appId)) existing.sharedAppIds.push(row.appId)
      continue
    }
    followupById.set(row.followupId, {
      followupId: row.followupId,
      userId: row.userId,
      text: row.text,
      sourceMeetingId: row.sourceMeetingId,
      sourceMeetingTitle: row.sourceMeetingTitle,
      sharedAppIds: [row.appId],
    })
  }

  return ok(
    assembleMeetingPlan({
      projects,
      people,
      roles,
      attendeeIds: attendeeRows.map((row) => row.userId),
      openTasks: openTaskRows,
      runningSprints,
      sprintTasks: sprintTaskRows,
      checkins,
      followups: [...followupById.values()],
      todayIso,
    }),
  )
}
