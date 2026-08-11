'use server'

import { z } from 'zod'
import { ilike, or, eq, and, sql, asc, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth, signOut } from '@/lib/auth'
import { db } from '@/db'
import { apps, assignments, meetings, sprints, tasks, users } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'

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

/*
 * Natural-language quick-assign, straight from the ⌘K palette:
 *   Pattern A: "@sam fix the login flow"
 *   Pattern B: "(assign|create task|task) <title> (to|for) <name>( on <app>)?"
 */
function parseQuickAssign(raw: string): { title: string; name: string; app: string | null } | null {
  const leading = /^@(\S+)\s+([\s\S]+)$/.exec(raw)
  if (leading) return { name: leading[1], title: leading[2].trim(), app: null }
  const command = /^(?:assign|create\s+task|task)\s+([\s\S]+?)\s+(?:to|for)\s+([\s\S]+?)(?:\s+on\s+([\s\S]+))?$/i.exec(
    raw,
  )
  if (command) {
    return { title: command[1].trim(), name: command[2].trim(), app: command[3]?.trim() ?? null }
  }
  return null
}

export async function quickAssignTask(raw: string): Promise<ActionResult<QuickAssignData>> {
  const session = await auth()
  if (!session?.user) return err('Sign in required')

  const input = z.string().max(400).safeParse(raw)
  if (!input.success) return err('Try "@name task title" or "assign <task> to <name> on <app>"')

  const parsed = parseQuickAssign(input.data.trim())
  if (!parsed) return err('Try "@name task title" or "assign <task> to <name> on <app>"')

  const title = quickAssignTitle.safeParse(parsed.title)
  if (!title.success) return err(title.error.issues[0].message)

  const candidates = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.active, true), ilike(users.name, likePattern(parsed.name))))
    .orderBy(asc(users.name))
    .limit(6)
  if (candidates.length === 0) return err(`No one matches "${parsed.name}"`)
  if (candidates.length > 1) {
    return err(
      `"${parsed.name}" could be ${candidates.map((c) => c.name).join(' or ')} — be more specific`,
    )
  }
  const assignee = candidates[0]

  // Pattern A captures only the first word of the name, so "@sam perera fix X"
  // would otherwise title the task "perera fix X" — consume title words that
  // continue the matched user's real name.
  let taskTitle = title.data
  let appQuery = parsed.app
  {
    const nameWords = assignee.name.toLowerCase().split(/\s+/)
    let i = nameWords.indexOf(parsed.name.toLowerCase())
    let words = taskTitle.split(/\s+/)
    while (
      i >= 0 &&
      i + 1 < nameWords.length &&
      words.length > 1 &&
      nameWords[i + 1] === words[0].toLowerCase()
    ) {
      i++
      words = words.slice(1)
    }
    taskTitle = words.join(' ')
  }

  // Pattern A can also carry an explicit app suffix: "@sam fix login on logpup".
  // Only strip it when the suffix actually resolves to an app, so titles that
  // legitimately end in "on <something>" survive.
  if (!appQuery) {
    const trailing = /^([\s\S]+?)\s+on\s+(\S[\s\S]*)$/i.exec(taskTitle)
    if (trailing) {
      const candidateApp = trailing[2].trim()
      const matches = await db
        .select({ id: apps.id })
        .from(apps)
        .where(
          or(ilike(apps.name, likePattern(candidateApp)), ilike(apps.slug, likePattern(candidateApp))),
        )
        .limit(2)
      if (matches.length === 1) {
        taskTitle = trailing[1].trim()
        appQuery = candidateApp
      }
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
