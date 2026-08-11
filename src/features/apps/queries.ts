import { asc, count, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apps, assignments, meetings, sprints, tasks, users } from '@/db/schema'

export type AppMember = {
  userId: string
  name: string
  avatarUrl: string | null
}

export type AppStats = {
  tasks: { todo: number; in_progress: number; done: number; total: number }
  /** The active sprint closing soonest, for the "deadline" line. */
  activeSprint: { name: string; endDate: string } | null
  sprintCount: number
  meetingCount: number
}

export type AppWithMembers = typeof apps.$inferSelect & {
  members: AppMember[]
  stats: AppStats
}

export async function listApps(): Promise<AppWithMembers[]> {
  const [allApps, memberRows, taskRows, sprintRows, meetingRows] = await Promise.all([
    db.select().from(apps).orderBy(asc(apps.status), asc(apps.name)),
    db
      .select({
        appId: assignments.appId,
        userId: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(assignments)
      .innerJoin(users, eq(assignments.userId, users.id)),
    db
      .select({ appId: tasks.appId, status: tasks.status, c: count() })
      .from(tasks)
      .groupBy(tasks.appId, tasks.status),
    db
      .select({ appId: sprints.appId, name: sprints.name, endDate: sprints.endDate, status: sprints.status })
      .from(sprints),
    db.select({ appId: meetings.appId, c: count() }).from(meetings).groupBy(meetings.appId),
  ])

  const membersByApp = new Map<string, AppMember[]>()
  for (const row of memberRows) {
    const members = membersByApp.get(row.appId) ?? []
    members.push({ userId: row.userId, name: row.name, avatarUrl: row.avatarUrl })
    membersByApp.set(row.appId, members)
  }

  const emptyTasks = () => ({ todo: 0, in_progress: 0, done: 0, total: 0 })
  const taskByApp = new Map<string, ReturnType<typeof emptyTasks>>()
  for (const r of taskRows) {
    const t = taskByApp.get(r.appId) ?? emptyTasks()
    t[r.status] = r.c
    t.total += r.c
    taskByApp.set(r.appId, t)
  }

  const sprintCountByApp = new Map<string, number>()
  const activeSprintByApp = new Map<string, { name: string; endDate: string }>()
  for (const r of sprintRows) {
    sprintCountByApp.set(r.appId, (sprintCountByApp.get(r.appId) ?? 0) + 1)
    if (r.status === 'active') {
      const existing = activeSprintByApp.get(r.appId)
      // Soonest-closing active sprint is the one that reads as "the deadline".
      if (!existing || r.endDate < existing.endDate) {
        activeSprintByApp.set(r.appId, { name: r.name, endDate: r.endDate })
      }
    }
  }

  const meetingCountByApp = new Map<string, number>()
  for (const r of meetingRows) {
    if (r.appId) meetingCountByApp.set(r.appId, r.c)
  }

  return allApps.map((app) => ({
    ...app,
    members: membersByApp.get(app.id) ?? [],
    stats: {
      tasks: taskByApp.get(app.id) ?? emptyTasks(),
      activeSprint: activeSprintByApp.get(app.id) ?? null,
      sprintCount: sprintCountByApp.get(app.id) ?? 0,
      meetingCount: meetingCountByApp.get(app.id) ?? 0,
    },
  }))
}

export async function getAppBySlug(slug: string) {
  const [app] = await db.select().from(apps).where(eq(apps.slug, slug))
  return app ?? null
}

/**
 * Distinct tech tags already in use across every app, for the Tech tags
 * combobox's suggestion pool (merged with the curated list in
 * src/lib/tech-tags.ts). Selects just the array column rather than full
 * rows, then de-dupes in JS — at our row counts that's simpler than an
 * unnest/aggregate-distinct query and just as cheap.
 */
export async function listDistinctTechTags(): Promise<string[]> {
  const rows = await db.select({ techTags: apps.techTags }).from(apps)
  const tags = new Set<string>()
  for (const row of rows) {
    for (const tag of row.techTags) {
      const trimmed = tag.trim()
      if (trimmed) tags.add(trimmed)
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b))
}
