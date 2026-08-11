'use server'

import { z } from 'zod'
import { ilike, or, eq, and, sql, asc, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth, signOut } from '@/lib/auth'
import { db } from '@/db'
import { apps, assignments, meetings, sprints, tasks, users } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { parseTaskIntent } from '@/lib/task-intent'

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
  meetings: {
    id: string
    title: string
    startsAt: Date
    appName: string | null
    href: string
  }[]
}

const EMPTY: SearchResults = { apps: [], people: [], tasks: [], sprints: [], meetings: [] }
const LIMIT = 6

export async function universalSearch(q: string): Promise<SearchResults> {
  const session = await auth()
  if (!session?.user) return EMPTY

  const query = q.trim()
  if (query.length < 2) return EMPTY
  // Escape LIKE metacharacters so "50%" matches literally, not as a wildcard.
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`

  const [appRows, peopleRows, taskRows, sprintRows, meetingRows] = await Promise.all([
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
          // Excludes self-signed-up users still awaiting admin approval.
          eq(users.status, 'approved'),
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
    db
      .select({
        id: meetings.id,
        title: meetings.title,
        startsAt: meetings.startsAt,
        appName: apps.name,
      })
      .from(meetings)
      .leftJoin(apps, eq(meetings.appId, apps.id))
      .where(or(ilike(meetings.title, pattern), ilike(meetings.agenda, pattern)))
      .orderBy(desc(meetings.startsAt))
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
      href: `/apps/${t.appSlug}?tab=board&sprint=${t.sprintId ?? 'backlog'}`,
    })),
    sprints: sprintRows.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      appName: s.appName,
      href: `/apps/${s.appSlug}?tab=board&sprint=${s.id}`,
    })),
    meetings: meetingRows.map((m) => ({
      id: m.id,
      title: m.title,
      startsAt: m.startsAt,
      appName: m.appName,
      href: '/meetings',
    })),
  }
}

export async function signOutFromPalette(): Promise<void> {
  await signOut({ redirectTo: '/sign-in' })
}

export type QuickAssignData = {
  title: string
  assigneeName: string
  appName: string
  appSlug: string
  href: string
}

const quickAssignTitle = z
  .string()
  .trim()
  .min(1, 'Task title is required')
  .max(200, 'Keep the title under 200 characters')

// Escape LIKE metacharacters so names with "%"/"_" match literally.
const likePattern = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`

/** Everyone the palette may assign to. Approved + active only. */
async function assignableUsers() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.active, true), eq(users.status, 'approved')))
    .orderBy(asc(users.name))
}

export type TaskIntentPreview = {
  title: string
  assigneeName: string | null
  /** Name written that matched nobody, or several people. */
  unresolvedName: string | null
  ambiguousNames: string[]
  dueLabel: string | null
  dueDate: string | null
  appName: string | null
}

/**
 * Read-only parse for the palette's live preview — shows who/what/when the
 * phrase resolved to before the user commits. Creates nothing.
 */
export async function previewTaskIntent(raw: string): Promise<TaskIntentPreview | null> {
  const session = await auth()
  if (!session?.user) return null

  const input = z.string().max(400).safeParse(raw)
  if (!input.success) return null

  const people = await assignableUsers()
  const intent = parseTaskIntent(input.data, people)
  if (!intent) return null

  let appName: string | null = null
  if (intent.appQuery) {
    const [match] = await db
      .select({ name: apps.name })
      .from(apps)
      .where(
        or(
          ilike(apps.name, likePattern(intent.appQuery)),
          ilike(apps.slug, likePattern(intent.appQuery)),
        ),
      )
      .limit(1)
    appName = match?.name ?? null
  }

  return {
    // An unresolved "on <x>" is not an app, so those words belong to the title.
    title: intent.appQuery && !appName ? `${intent.title} on ${intent.appQuery}` : intent.title,
    assigneeName: intent.assignee?.name ?? null,
    unresolvedName: intent.ambiguous.length === 0 ? intent.assigneeQuery : null,
    ambiguousNames: intent.ambiguous.map((p) => p.name),
    dueLabel: intent.dueLabel,
    dueDate: intent.due,
    appName,
  }
}

export async function quickAssignTask(raw: string): Promise<ActionResult<QuickAssignData>> {
  const session = await auth()
  if (!session?.user) return err('Sign in required')

  const input = z.string().max(400).safeParse(raw)
  if (!input.success) return err('Try "@name task title" or "assign <task> to <name> on <app>"')

  const people = await assignableUsers()
  const intent = parseTaskIntent(input.data, people)
  if (!intent) {
    return err('Try "shanika fix the login flow today" or "assign X to <name>"')
  }

  if (intent.ambiguous.length > 1) {
    return err(
      `"${intent.assigneeQuery}" could be ${intent.ambiguous.map((p) => p.name).join(' or ')} — be more specific`,
    )
  }
  if (!intent.assignee) {
    return err(
      intent.assigneeQuery
        ? `No one matches "${intent.assigneeQuery}"`
        : 'Start with a teammate’s name, e.g. "shanika fix the login flow today"',
    )
  }
  const assignee = intent.assignee

  const title = quickAssignTitle.safeParse(intent.title)
  if (!title.success) return err(title.error.issues[0].message)

  let taskTitle = title.data
  let appQuery = intent.appQuery

  // "on <x>" is only an app when it resolves to one — otherwise those words
  // were part of the task ("write the copy on onboarding").
  if (appQuery) {
    const matches = await db
      .select({ id: apps.id })
      .from(apps)
      .where(or(ilike(apps.name, likePattern(appQuery)), ilike(apps.slug, likePattern(appQuery))))
      .limit(2)
    if (matches.length === 0) {
      taskTitle = `${taskTitle} on ${appQuery}`
      appQuery = null
    }
  }

  let app: { id: string; name: string; slug: string } | undefined
  if (appQuery) {
    const appMatches = await db
      .select({ id: apps.id, name: apps.name, slug: apps.slug })
      .from(apps)
      .where(
        or(ilike(apps.name, likePattern(appQuery)), ilike(apps.slug, likePattern(appQuery))),
      )
      .orderBy(asc(apps.name))
      .limit(6)
    if (appMatches.length === 0) return err(`No app matches "${appQuery}"`)
    if (appMatches.length > 1) {
      return err(
        `"${appQuery}" could be ${appMatches.map((a) => a.name).join(' or ')} — be more specific`,
      )
    }
    app = appMatches[0]
  } else {
    // No explicit app — default to wherever the assignee spends most of
    // their time (highest allocation wins).
    ;[app] = await db
      .select({ id: apps.id, name: apps.name, slug: apps.slug })
      .from(assignments)
      .innerJoin(apps, eq(assignments.appId, apps.id))
      .where(eq(assignments.userId, assignee.id))
      .orderBy(desc(assignments.allocationPct))
      .limit(1)
  }
  if (!app) return err(`Say which app: "${input.data.trim()} on <app name>"`)

  // Lands in the app's backlog as a plain todo — triage happens on the board.
  await db.insert(tasks).values({
    appId: app.id,
    sprintId: null,
    title: taskTitle,
    status: 'todo',
    assigneeId: assignee.id,
    priority: 0,
    sortOrder: 0,
    dueDate: intent.due,
  })

  revalidatePath('/apps/' + app.slug)
  return ok({
    title: taskTitle,
    assigneeName: assignee.name,
    appName: app.name,
    appSlug: app.slug,
    href: `/apps/${app.slug}?sprint=backlog&tab=board`,
  })
}
