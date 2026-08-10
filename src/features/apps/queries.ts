import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apps, assignments, users } from '@/db/schema'

export type AppMember = {
  userId: string
  name: string
  avatarUrl: string | null
}

export type AppWithMembers = typeof apps.$inferSelect & {
  members: AppMember[]
}

export async function listApps(): Promise<AppWithMembers[]> {
  const [allApps, memberRows] = await Promise.all([
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
  ])

  const membersByApp = new Map<string, AppMember[]>()
  for (const row of memberRows) {
    const members = membersByApp.get(row.appId) ?? []
    members.push({ userId: row.userId, name: row.name, avatarUrl: row.avatarUrl })
    membersByApp.set(row.appId, members)
  }

  return allApps.map((app) => ({ ...app, members: membersByApp.get(app.id) ?? [] }))
}

export async function getAppBySlug(slug: string) {
  const [app] = await db.select().from(apps).where(eq(apps.slug, slug))
  return app ?? null
}
