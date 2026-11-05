import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveSprints, liveTasks } from '@/db/live'
import { activityLog } from '@/db/schema'
import type { TaskStatus } from '@/features/sprints/board-view'
import type { TaskType } from '@/features/sprints/hierarchy'
import {
  averageVelocity,
  computeSprintMetrics,
  type MetricTask,
  type SprintMetrics,
  type SprintWindow,
  type VelocityEntry,
} from '@/features/sprints/sprint-metrics'

/** Everything the Metrics tab shows, for one chosen sprint. */
export async function loadSprintMetrics(
  appId: string,
  sprint: SprintWindow & { id: string },
  today: string,
): Promise<{ metrics: SprintMetrics; velocity: VelocityEntry[]; average: number | null }> {
  const [{ ids, tasks }, velocity] = await Promise.all([getSprintMetricTasks(sprint.id), getVelocity(appId)])
  const qa = await getQaMoves(ids)
  return {
    metrics: computeSprintMetrics({ sprint, tasks, qa, today }),
    velocity,
    average: averageVelocity(velocity),
  }
}

/** How many finished sprints the velocity chart and its average look back over. */
export const VELOCITY_WINDOW = 6

/** One sprint's tasks, in the shape computeSprintMetrics reads. */
export async function getSprintMetricTasks(sprintId: string): Promise<{ ids: string[]; tasks: MetricTask[] }> {
  const rows = await db
    .select({
      id: liveTasks.id,
      points: liveTasks.storyPoints,
      status: liveTasks.status,
      completedAt: liveTasks.completedAt,
      type: liveTasks.type,
    })
    .from(liveTasks)
    .where(eq(liveTasks.sprintId, sprintId))
  return {
    ids: rows.map((r) => r.id),
    tasks: rows.map((r) => ({
      points: r.points,
      status: r.status as TaskStatus,
      completedAt: r.completedAt,
      type: r.type as TaskType,
    })),
  }
}

/**
 * Moves into QA and into "QA failed" for these tasks, from the activity log
 * (statusActivity writes metadata.status.to on every status change). The log
 * is the only history of status moves; a task's row holds only where it is.
 */
export async function getQaMoves(taskIds: readonly string[]): Promise<{ intoQa: number; intoQaFailed: number }> {
  if (taskIds.length === 0) return { intoQa: 0, intoQaFailed: 0 }
  const to = sql`${activityLog.metadata} -> 'status' ->> 'to'`
  const [row] = await db
    .select({
      intoQa: sql<number>`count(*) filter (where ${to} = 'qa')`.mapWith(Number),
      intoQaFailed: sql<number>`count(*) filter (where ${to} = 'qa_failed')`.mapWith(Number),
    })
    .from(activityLog)
    .where(and(eq(activityLog.entityType, 'task'), inArray(activityLog.entityId, [...taskIds])))
  return row ?? { intoQa: 0, intoQaFailed: 0 }
}

/** Completed points per finished sprint, oldest first, the last VELOCITY_WINDOW. */
export async function getVelocity(appId: string): Promise<VelocityEntry[]> {
  const rows = await db
    .select({
      sprintId: liveSprints.id,
      name: liveSprints.name,
      endDate: liveSprints.endDate,
      completedPoints: sql<number>`coalesce(sum(${liveTasks.storyPoints}) filter (where ${liveTasks.status} = 'done'), 0)`.mapWith(Number),
    })
    .from(liveSprints)
    .leftJoin(liveTasks, eq(liveTasks.sprintId, liveSprints.id))
    .where(and(eq(liveSprints.appId, appId), eq(liveSprints.status, 'done')))
    .groupBy(liveSprints.id, liveSprints.name, liveSprints.endDate)
    .orderBy(sql`${liveSprints.endDate} desc`)
    .limit(VELOCITY_WINDOW)
  return rows
    .reverse()
    .map((r) => ({ sprintId: r.sprintId, name: r.name, completedPoints: Math.round(r.completedPoints * 10) / 10 }))
}
