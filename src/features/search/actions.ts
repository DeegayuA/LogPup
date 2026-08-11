'use server'

import { ilike, or, eq, and, sql, asc } from 'drizzle-orm'
import { auth, signOut } from '@/lib/auth'
import { db } from '@/db'
import { apps, sprints, tasks, users } from '@/db/schema'

export type SearchResults = {
  apps: { id: string; name: string; slug: string; status: 'active' | 'paused' | 'archived' }[]
  people: { id: string; name: string; title: string | null; avatarUrl: string | null }[]
  tasks: {
    id: string
    title: string
    status: 'todo' | 'in_progress' | 'done'
    appName: string
    href: string
  }[]
  sprints: {
    id: string
    name: string
    status: 'planned' | 'active' | 'done'
    appName: string
    href: string
  }[]
}

const EMPTY: SearchResults = { apps: [], people: [], tasks: [], sprints: [] }
const LIMIT = 6

export async function universalSearch(q: string): Promise<SearchResults> {
  const session = await auth()
  if (!session?.user) return EMPTY

  const query = q.trim()
  if (query.length < 2) return EMPTY
  // Escape LIKE metacharacters so "50%" matches literally, not as a wildcard.
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`

  const [appRows, peopleRows, taskRows, sprintRows] = await Promise.all([
    db
      .select({ id: apps.id, name: apps.name, slug: apps.slug, status: apps.status })
      .from(apps)
      .where(
        or(
          ilike(apps.name, pattern),
          ilike(apps.slug, pattern),
          sql`array_to_string(${apps.techTags}, ' ') ILIKE ${pattern}`,
        ),
      )
      .orderBy(asc(apps.status), asc(apps.name))
      .limit(LIMIT),
    db
      .select({ id: users.id, name: users.name, title: users.title, avatarUrl: users.avatarUrl })
      .from(users)
      .where(
        and(
          eq(users.active, true),
          or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(users.title, pattern)),
        ),
      )
      .orderBy(asc(users.name))
      .limit(LIMIT),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        sprintId: tasks.sprintId,
        appName: apps.name,
        appSlug: apps.slug,
      })
      .from(tasks)
      .innerJoin(apps, eq(tasks.appId, apps.id))
      .where(ilike(tasks.title, pattern))
      .orderBy(asc(tasks.status))
      .limit(LIMIT),
    db
      .select({
        id: sprints.id,
        name: sprints.name,
        status: sprints.status,
        appName: apps.name,
        appSlug: apps.slug,
      })
      .from(sprints)
      .innerJoin(apps, eq(sprints.appId, apps.id))
      .where(or(ilike(sprints.name, pattern), ilike(sprints.goal, pattern)))
      .orderBy(asc(sprints.status))
      .limit(LIMIT),
  ])

  return {
    apps: appRows,
    people: peopleRows,
    tasks: taskRows.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      appName: t.appName,
      href: `/apps/${t.appSlug}?sprint=${t.sprintId ?? 'backlog'}`,
    })),
    sprints: sprintRows.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      appName: s.appName,
      href: `/apps/${s.appSlug}?sprint=${s.id}`,
    })),
  }
}

export async function signOutFromPalette(): Promise<void> {
  await signOut({ redirectTo: '/sign-in' })
}
