import { cache } from 'react'
import { and, count, eq, inArray, isNotNull, max, notInArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveTasks } from '@/db/live'
import { activityLog, assignments, users } from '@/db/schema'
import { OPEN_STATUSES } from '@/features/sprints/board-view'

/** One member's standing on one app: who they are, and what they have done. */
export type AppContribution = {
  userId: string
  name: string
  avatarUrl: string | null
  /** Contact number for the call/WhatsApp cluster — teammate-visible by design. */
  phone: string | null
  role: string
  allocationPct: number
  tasksDone: number
  tasksOpen: number
  /** Logged actions this person took on this app — the volume half of the story. */
  actions: number
  /** Most recent action on this app, or null for a member who has done nothing yet. */
  lastActiveAt: Date | null
}

/**
 * WHO IS ACTUALLY DOING THE WORK ON THIS APP.
 *
 * The Team panel already answers "who is assigned, and for how much of their
 * week". That is a plan, not a record — it says nothing about whether any of
 * that allocated time turned into anything. This is the other half: per
 * member, the tasks they have closed and still hold, how many logged actions
 * they have taken here, and when they were last seen.
 *
 * It deliberately does NOT re-record anything. The saved history this reads
 * from is `activity_log`, written on every mutation since it was introduced
 * (features/activity/log.ts), and the per-app event feed built on it is
 * `getAppActivity` in activity-queries.ts. Counting from the same trail is
 * what stops a contribution shown here from ever disagreeing with the feed
 * shown beneath it.
 *
 * THREE QUERIES, NOT ONE PER MEMBER. The obvious shape — list the team, then
 * count each person's tasks and actions — is an N+1 that grows with the team.
 * These are three grouped aggregates joined in memory instead, so a ten-person
 * app costs the same three round trips as a one-person app.
 *
 * A member with no activity is KEPT, with zeroes and a null `lastActiveAt`.
 * "Assigned 40% and has done nothing here" is among the more useful things
 * this can tell an admin, and dropping the row would hide precisely that.
 */
export const getAppContributions = cache(async function getAppContributions(
  appId: string,
): Promise<AppContribution[]> {
  const [members, taskRows, activityRows] = await Promise.all([
    db
      .select({
        userId: assignments.userId,
        role: assignments.role,
        allocationPct: assignments.allocationPct,
        name: users.name,
        avatarUrl: users.avatarUrl,
        phone: users.phone,
      })
      .from(assignments)
      .innerJoin(users, eq(users.id, assignments.userId))
      .where(eq(assignments.appId, appId)),

    // Bucketed in the database rather than counted in JS: the alternative is
    // shipping every task row for the app just to group it by assignee.
    db
      .select({
        assigneeId: liveTasks.assigneeId,
        done: count(sql`case when ${notInArray(liveTasks.status, [...OPEN_STATUSES])} then 1 end`),
        open: count(sql`case when ${inArray(liveTasks.status, OPEN_STATUSES)} then 1 end`),
      })
      .from(liveTasks)
      .where(and(eq(liveTasks.appId, appId), isNotNull(liveTasks.assigneeId)))
      .groupBy(liveTasks.assigneeId),

    db
      .select({
        actorId: activityLog.actorId,
        actions: count(),
        lastActiveAt: max(activityLog.createdAt),
      })
      .from(activityLog)
      .where(eq(activityLog.appId, appId))
      .groupBy(activityLog.actorId),
  ])

  const taskByUser = new Map(taskRows.map((row) => [row.assigneeId, row]))
  const activityByUser = new Map(activityRows.map((row) => [row.actorId, row]))

  return members
    .map((member) => {
      const taskCounts = taskByUser.get(member.userId)
      const activity = activityByUser.get(member.userId)
      return {
        userId: member.userId,
        name: member.name,
        avatarUrl: member.avatarUrl,
        phone: member.phone,
        role: member.role,
        allocationPct: member.allocationPct,
        tasksDone: taskCounts?.done ?? 0,
        tasksOpen: taskCounts?.open ?? 0,
        actions: activity?.actions ?? 0,
        lastActiveAt: activity?.lastActiveAt ?? null,
      }
    })
    .sort(rankContributors)
})

/**
 * Most active first, and assigned-but-idle members last rather than hidden.
 *
 * Ties break on tasks closed, then on name — the last step matters: without it
 * two people with identical counts swap places between renders, because
 * Postgres makes no ordering promise for rows a query did not order.
 */
export function rankContributors(
  a: Pick<AppContribution, 'actions' | 'tasksDone' | 'name'>,
  b: Pick<AppContribution, 'actions' | 'tasksDone' | 'name'>,
): number {
  if (b.actions !== a.actions) return b.actions - a.actions
  if (b.tasksDone !== a.tasksDone) return b.tasksDone - a.tasksDone
  return a.name.localeCompare(b.name)
}
