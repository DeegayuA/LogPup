import { and, asc, desc, eq, gte, ilike } from 'drizzle-orm'
import { db } from '@/db'
import { apps, assignments, meetingAttendees, meetings, tasks, users } from '@/db/schema'
import { summarizeAllocations } from '@/features/people/allocation'

export type TeamMember = {
  assignmentId: string
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  role: string
  allocationPct: number
}

export type UserCapacity = {
  user: { id: string; name: string; title: string | null; avatarUrl: string | null }
  totalPct: number
  overallocated: boolean
  breakdown: { appId: string; appName: string; slug: string; role: string; allocationPct: number }[]
}

export type ActiveUser = { id: string; name: string }

export type PersonBreakdownEntry = {
  appId: string
  appName: string
  slug: string
  role: string
  allocationPct: number
}

export type PersonTask = {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  appName: string
  appSlug: string
}

export type PersonMeeting = { id: string; title: string; startsAt: Date }

export type PersonDetail = {
  user: {
    id: string
    name: string
    email: string
    title: string | null
    avatarUrl: string | null
    role: 'admin' | 'member'
    active: boolean
  }
  totalPct: number
  overallocated: boolean
  breakdown: PersonBreakdownEntry[]
  tasks: PersonTask[]
  meetings: PersonMeeting[]
}

export async function getTeamForApp(appId: string): Promise<TeamMember[]> {
  return db
    .select({
      assignmentId: assignments.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: assignments.role,
      allocationPct: assignments.allocationPct,
    })
    .from(assignments)
    .innerJoin(users, eq(assignments.userId, users.id))
    .where(eq(assignments.appId, appId))
    .orderBy(desc(assignments.allocationPct))
}

export async function getUserCapacities(q?: string): Promise<UserCapacity[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      title: users.title,
      avatarUrl: users.avatarUrl,
      appId: apps.id,
      appName: apps.name,
      slug: apps.slug,
      role: assignments.role,
      allocationPct: assignments.allocationPct,
    })
    .from(users)
    .leftJoin(assignments, eq(assignments.userId, users.id))
    .leftJoin(apps, eq(assignments.appId, apps.id))
    .where(
      and(
        eq(users.active, true),
        // Escape LIKE metacharacters so "%"/"_" in the search box match literally.
        q ? ilike(users.name, `%${q.replace(/[\\%_]/g, '\\$&')}%`) : undefined,
      ),
    )
    .orderBy(asc(users.name))

  const totalsByUser = new Map(
    summarizeAllocations(
      rows
        .filter((r): r is typeof r & { allocationPct: number } => r.allocationPct != null)
        .map((r) => ({ userId: r.userId, allocationPct: r.allocationPct })),
    ).map((s) => [s.userId, s]),
  )

  const byUser = new Map<string, UserCapacity>()
  for (const row of rows) {
    let entry = byUser.get(row.userId)
    if (!entry) {
      const summary = totalsByUser.get(row.userId)
      entry = {
        user: { id: row.userId, name: row.name, title: row.title, avatarUrl: row.avatarUrl },
        totalPct: summary?.totalPct ?? 0,
        overallocated: summary?.overallocated ?? false,
        breakdown: [],
      }
      byUser.set(row.userId, entry)
    }
    if (row.appId && row.appName && row.slug && row.role != null && row.allocationPct != null) {
      entry.breakdown.push({
        appId: row.appId,
        appName: row.appName,
        slug: row.slug,
        role: row.role,
        allocationPct: row.allocationPct,
      })
    }
  }

  return [...byUser.values()]
}

export async function listActiveUsers(): Promise<ActiveUser[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name))
}

export async function getPersonDetail(userId: string): Promise<PersonDetail | null> {
  const [userRow] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      title: users.title,
      avatarUrl: users.avatarUrl,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .where(eq(users.id, userId))
  if (!userRow) return null

  const [breakdown, taskRows, meetingRows] = await Promise.all([
    db
      .select({
        appId: apps.id,
        appName: apps.name,
        slug: apps.slug,
        role: assignments.role,
        allocationPct: assignments.allocationPct,
      })
      .from(assignments)
      .innerJoin(apps, eq(assignments.appId, apps.id))
      .where(eq(assignments.userId, userId))
      .orderBy(desc(assignments.allocationPct)),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        appName: apps.name,
        appSlug: apps.slug,
      })
      .from(tasks)
      .innerJoin(apps, eq(tasks.appId, apps.id))
      .where(eq(tasks.assigneeId, userId))
      .orderBy(asc(tasks.status), desc(tasks.createdAt)),
    db
      .select({
        id: meetings.id,
        title: meetings.title,
        startsAt: meetings.startsAt,
      })
      .from(meetingAttendees)
      .innerJoin(meetings, eq(meetingAttendees.meetingId, meetings.id))
      .where(and(eq(meetingAttendees.userId, userId), gte(meetings.startsAt, new Date())))
      .orderBy(asc(meetings.startsAt)),
  ])

  const [summary] = summarizeAllocations(
    breakdown.map((b) => ({ userId, allocationPct: b.allocationPct })),
  )

  return {
    user: userRow,
    totalPct: summary?.totalPct ?? 0,
    overallocated: summary?.overallocated ?? false,
    breakdown,
    tasks: taskRows,
    meetings: meetingRows,
  }
}
