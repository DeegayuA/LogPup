import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apps, sprints, tasks } from '@/db/schema'

export type Sprint = typeof sprints.$inferSelect

export type ActiveSprintSummary = {
  sprintId: string
  sprintName: string
  appName: string
  appSlug: string
  startDate: string
  endDate: string
  counts: { todo: number; in_progress: number; done: number }
}

export async function getSprintsForApp(appId: string): Promise<Sprint[]> {
  return db
    .select()
    .from(sprints)
    .where(eq(sprints.appId, appId))
    .orderBy(desc(sprints.startDate))
}

export async function getActiveSprints(): Promise<ActiveSprintSummary[]> {
  const rows = await db
    .select({
      sprintId: sprints.id,
      sprintName: sprints.name,
      appName: apps.name,
      appSlug: apps.slug,
      startDate: sprints.startDate,
      endDate: sprints.endDate,
      taskStatus: tasks.status,
    })
    .from(sprints)
    .innerJoin(apps, eq(sprints.appId, apps.id))
    .leftJoin(tasks, eq(tasks.sprintId, sprints.id))
    .where(eq(sprints.status, 'active'))
    .orderBy(asc(sprints.startDate))

  const bySprint = new Map<string, ActiveSprintSummary>()
  for (const row of rows) {
    let entry = bySprint.get(row.sprintId)
    if (!entry) {
      entry = {
        sprintId: row.sprintId,
        sprintName: row.sprintName,
        appName: row.appName,
        appSlug: row.appSlug,
        startDate: row.startDate,
        endDate: row.endDate,
        counts: { todo: 0, in_progress: 0, done: 0 },
      }
      bySprint.set(row.sprintId, entry)
    }
    // LEFT joined: a sprint with no tasks yields one row with taskStatus
    // null, which we skip so the sprint still appears with all-zero counts.
    if (row.taskStatus) entry.counts[row.taskStatus] += 1
  }

  return [...bySprint.values()]
}
