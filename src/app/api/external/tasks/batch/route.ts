import { NextResponse, type NextRequest } from 'next/server'
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveSprints, liveTasks } from '@/db/live'
import { activityLog, taskAssignees, users } from '@/db/schema'
import { bridgeKeyValid, resolveBridgeUsers } from '@/lib/bridge-auth'
import { externalBaseUrl, serializeTask } from '@/app/api/external/serialize'
import { parseWorklogBatchBody } from '@/app/api/external/worklog'
import { assignedToAny, completedByAny, taskDayBetween } from '@/app/api/external/task-scope'
import { tasksPerUser } from '@/app/api/external/task-batch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Hard cap on candidate rows for one call — a 500-person month is far below it. */
const MAX_ROWS = 5000

/**
 * Several people's own LogPup tasks — each one's assigned-or-completed tasks whose Attendance
 * day (taskDayBetween) falls in the range — for the Attendance team views.
 *
 * Same contract as POST /api/external/worklog/batch: the shared key authenticates the calling
 * application, each address goes through resolveBridgeUsers (canHoldWork), and WHO MAY SEE WHOM
 * IS DECIDED IN ATTENDANCE before the list reaches here. Body `{ emails, from, to }`, same rules.
 * Read-only: a status write still goes through PATCH /api/external/tasks/{id}/status, which only
 * an assignee may make.
 *
 * Four queries whatever the list size: the people, the candidate tasks, who is on them, and who
 * last completed the done ones. Each task's flags are then worked out per person (task-batch.ts),
 * so `isAssignee` / `completedByMe` always mean "this person", never "anyone in the batch".
 */
export async function POST(req: NextRequest) {
  if (!bridgeKeyValid(req.headers.get('x-api-key'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = parseWorklogBatchBody(await req.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
  }

  try {
    const found = await resolveBridgeUsers(parsed.emails)
    const ids = found.map((u) => u.id)

    const rows = ids.length === 0 ? [] : await db
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
      })
      // Live views, as in tasks/route.ts: a trashed task must never reach another application.
      .from(liveTasks)
      .innerJoin(liveApps, eq(liveApps.id, liveTasks.appId))
      .leftJoin(liveSprints, eq(liveSprints.id, liveTasks.sprintId))
      .leftJoin(users, eq(users.id, liveTasks.assigneeId))
      .where(and(taskDayBetween(parsed.from, parsed.to), or(assignedToAny(ids), completedByAny(ids))))
      .orderBy(sql`${liveTasks.dueDate} asc nulls last`, desc(liveTasks.priority), asc(liveTasks.createdAt))
      .limit(MAX_ROWS)

    const taskIds = rows.map((r) => r.id)
    const doneIds = rows.filter((r) => r.status === 'done').map((r) => r.id)
    const [assigneeRows, completerRows] = await Promise.all([
      taskIds.length === 0 ? [] : db
        .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
        .from(taskAssignees)
        .where(inArray(taskAssignees.taskId, taskIds)),
      // The LATEST completion per done task — DISTINCT ON keeps the first row per entity in
      // created_at-descending order. Served by activity_log_entity_idx.
      doneIds.length === 0 ? [] : db
        .selectDistinctOn([activityLog.entityId], { taskId: activityLog.entityId, actorId: activityLog.actorId })
        .from(activityLog)
        .where(and(
          eq(activityLog.entityType, 'task'),
          eq(activityLog.verb, 'completed'),
          inArray(activityLog.entityId, doneIds),
        ))
        .orderBy(activityLog.entityId, desc(activityLog.createdAt)),
    ])

    const perUser = tasksPerUser(ids, rows, assigneeRows, new Map(completerRows.map((c) => [c.taskId, c.actorId])))
    const byEmail = new Map(found.map((u) => [u.email, u]))
    const baseUrl = externalBaseUrl()

    const results = parsed.emails.map((email) => {
      const user = byEmail.get(email)
      if (!user) return { email, matched: false, tasks: [] }
      const tasks = (perUser.get(user.id) ?? []).map((t) =>
        serializeTask(
          {
            ...t.row,
            isPrimaryAssignee: t.isPrimaryAssignee,
            isAssignee: t.isAssignee,
            completedByMe: t.completedByMe,
            assigneeCount: t.assigneeCount,
          },
          baseUrl,
        ),
      )
      return { email, matched: true, tasks }
    })

    return NextResponse.json(
      { success: true, from: parsed.from, to: parsed.to, results, timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[external/tasks/batch] query failed', error)
    return NextResponse.json({ success: false, error: 'Could not read tasks' }, { status: 500 })
  }
}
