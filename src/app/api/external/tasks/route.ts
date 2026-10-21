import { NextResponse, type NextRequest } from 'next/server'
import { and, asc, desc, eq, exists, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveSprints, liveTasks } from '@/db/live'
import { appGrants, appRoleHistory, assignments, taskAssignees, users } from '@/db/schema'
import { bridgeKeyValid, resolveBridgeUser } from '@/lib/bridge-auth'
import { externalBaseUrl, parseTaskListParams, serializeTask } from '@/app/api/external/serialize'

// `timingSafeEqual` is a node builtin, and reading a header already makes this dynamic — the
// export is here so both external routes read identically.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The Attendance Web App asking "what is this person's LogPup work?".
 *
 * Authenticated by the shared key, which identifies the CALLING APPLICATION and nothing more;
 * the acting person is named by `email` and re-derived here, so holding the key never means
 * "act as anyone". See docs/attendance-task-bridge.md.
 */
export async function GET(req: NextRequest) {
  if (!bridgeKeyValid(req.headers.get('x-api-key'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { email, openOnly, scope, limit } = parseTaskListParams(req.nextUrl.searchParams)

  // The try starts BEFORE the first database call, not after it. resolveBridgeUser queries
  // Postgres, so a connection reset or an exhausted pool there would otherwise propagate to
  // Next's default error handler — which on a preview build renders the driver message and
  // stack — rather than the sanitized 500 this handler promises.
  try {
    const user = await resolveBridgeUser(email)
    // 200, NOT 404. An unknown address, a malformed one, and a deactivated, pending or
    // removed account all answer identically — a distinguishable "no such user" turns this
    // endpoint into an address oracle for anyone holding the key.
    if (!user) {
      return NextResponse.json({ success: true, matched: false, count: 0, data: [] })
    }

    // "ASSIGNED TO ME" IS THE UNION OF BOTH PLACES, and it has to be.
    //
    // The schema says `task_assignees` "ALWAYS CONTAINS" the accountable person, so reading the
    // join alone ought to be enough. IT IS NOT, and the gap is not theoretical: `setTaskAssignees`
    // is the only writer of that table and `createTask`/`updateTask` call it only behind
    // `if (assigneeIds)`, while the board composer and the task dialog send the SCALAR
    // `assigneeId` and nothing else. Only the meeting AI path sends the array. So every task
    // created or reassigned through the normal UI since the multi-assignee feature landed has
    // `tasks.assignee_id` set and NO join row, and a join-only read would return an empty list
    // for most of the workspace while looking perfectly correct in a test.
    //
    // Reading the column alone is equally wrong in the other direction — it would hide every
    // task somebody is genuinely on but does not own. So: either. `EXISTS` rather than a join,
    // so a task never returns twice when both are true.
    //
    // The underlying invariant violation is a LogPup bug that predates this endpoint and affects
    // more than it; it is reported in docs/attendance-task-bridge.md rather than fixed here,
    // because repairing assignment semantics deserves its own change. This query is correct
    // whether or not that happens.
    const isMine = or(
      eq(liveTasks.assigneeId, user.id),
      exists(
        db
          .select({ one: sql`1` })
          .from(taskAssignees)
          .where(and(eq(taskAssignees.taskId, liveTasks.id), eq(taskAssignees.userId, user.id))),
      ),
    )

    // scope=projects: ALSO every task in an app this person belongs to. "Belongs to" is the union
    // of the three places LogPup records it — the same three tables loadActor (actor.ts) reads
    // for app scope, but taken together and regardless of role, because the question here is
    // "which projects am I on", not "what may I edit". So an admin sees their own projects, not
    // the whole workspace.
    //   assignments       — team membership (editor/member scope)
    //   app_role_history  — an OPEN pm/lead seat (manager scope); closed seats are history
    //   app_grants        — stakeholder access
    //   apps.lead_id / pm_id — the seats as stored on the app itself, in case the history
    //                       table and the app row ever disagree
    const inMyProjects = or(
      eq(liveApps.leadId, user.id),
      eq(liveApps.pmId, user.id),
      inArray(liveTasks.appId, db.select({ id: assignments.appId }).from(assignments).where(eq(assignments.userId, user.id))),
      inArray(
        liveTasks.appId,
        db
          .select({ id: appRoleHistory.appId })
          .from(appRoleHistory)
          .where(and(eq(appRoleHistory.userId, user.id), isNull(appRoleHistory.effectiveTo))),
      ),
      inArray(liveTasks.appId, db.select({ id: appGrants.appId }).from(appGrants).where(eq(appGrants.userId, user.id))),
    )
    const inScope = scope === 'projects' ? or(isMine, inMyProjects) : isMine

    const rows = await db
      .select({
        id: liveTasks.id,
        title: liveTasks.title,
        description: liveTasks.description,
        status: liveTasks.status,
        priority: liveTasks.priority,
        dueDate: liveTasks.dueDate,
        dueKind: liveTasks.dueKind,
        dueCommitmentNote: liveTasks.dueCommitmentNote,
        originalDueDate: liveTasks.originalDueDate,
        completedAt: liveTasks.completedAt,
        createdAt: liveTasks.createdAt,
        appId: liveApps.id,
        appName: liveApps.name,
        appSlug: liveApps.slug,
        sprintId: liveSprints.id,
        sprintName: liveSprints.name,
        sprintEndDate: liveSprints.endDate,
        assigneeId: liveTasks.assigneeId,
        assigneeName: users.name,
        isAssignee: sql<boolean>`(${isMine})`,
      })
      // liveTasks / liveApps / liveSprints are the soft-delete-filtered subqueries from
      // src/db/live.ts. Querying the base tables would serve TRASHED tasks into another
      // application, where nobody will ever see the Trash page that explains them.
      .from(liveTasks)
      .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
      .leftJoin(liveSprints, eq(liveSprints.id, liveTasks.sprintId))
      .leftJoin(users, eq(users.id, liveTasks.assigneeId))
      .where(openOnly ? and(inScope, ne(liveTasks.status, 'done')) : inScope)
      // The person's own work first, then open before done, so the limit can only ever cut
      // teammates' finished tasks — never something on this person's plate. Within that,
      // "soonest first": NULLS LAST so undated work sits below dated work rather than above it,
      // which is what `asc()` alone would do in Postgres.
      .orderBy(
        sql`(${isMine}) desc`,
        sql`(${liveTasks.status} = 'done') asc`,
        sql`${liveTasks.dueDate} asc nulls last`,
        desc(liveTasks.priority),
        asc(liveTasks.createdAt),
      )
      .limit(limit)

    // One extra query for "how many people are on each of these", rather than one per task —
    // the N+1 that getTaskAssignees exists to avoid.
    const counts = new Map<string, number>()
    if (rows.length > 0) {
      const grouped = await db
        .select({ taskId: taskAssignees.taskId, count: sql<number>`count(*)::int` })
        .from(taskAssignees)
        .where(inArray(taskAssignees.taskId, rows.map((r) => r.id)))
        .groupBy(taskAssignees.taskId)
      for (const row of grouped) counts.set(row.taskId, row.count)
    }

    const baseUrl = externalBaseUrl()
    const data = rows.map((row) =>
      serializeTask(
        {
          ...row,
          isPrimaryAssignee: row.assigneeId === user.id,
          // The driver can hand back 't'/'f' for a bare boolean expression; normalise it here.
          isAssignee: row.isAssignee === true || (row.isAssignee as unknown) === 't',
          assigneeCount: counts.get(row.id) ?? 1,
        },
        baseUrl,
      ),
    )

    return NextResponse.json(
      {
        success: true,
        matched: true,
        user: { id: user.id, email: user.email, name: user.name },
        count: data.length,
        data,
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    // A driver error must not cross an application boundary as a stack trace.
    console.error('[external/tasks] query failed', error)
    return NextResponse.json({ success: false, error: 'Could not read tasks' }, { status: 500 })
  }
}
