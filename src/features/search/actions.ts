'use server'

import { z } from 'zod'
import { ilike, or, eq, and, asc, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth, signOut } from '@/lib/auth'
import { db } from '@/db'
import { apps, assignments, tasks, users } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { parseTaskIntent } from '@/lib/task-intent'
import { runProviders } from './registry/providers'
import type { SearchGroup } from './registry/types'

/**
 * Universal search, fanned out over the provider registry.
 *
 * The five entity queries this function used to inline now live beside the
 * features that own their tables, in each feature's `search-providers.ts` —
 * adding a searchable thing must not mean editing this file. The list is
 * registry/providers.ts, and its doc comment is the instruction.
 */
export async function universalSearch(q: string): Promise<SearchGroup[]> {
  const session = await auth()
  // The palette is behind the (app) shell, so this is a belt-and-braces check
  // rather than the only one — but a server action is its own entry point and
  // has to gate itself.
  if (!session?.user) return []

  return runProviders(q, { user: session.user })
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
    // The parser reads "high"/"!low"/" -- description" now (task-intent.ts);
    // the palette honours them the same way the board composer does.
    priority: intent.priority ?? 0,
    description: intent.description,
    sortOrder: 0,
    dueDate: intent.due,
  })

  revalidatePath('/apps/' + app.slug)
  return ok({
    title: taskTitle,
    assigneeName: assignee.name,
    appName: app.name,
    appSlug: app.slug,
    href: `/apps/${app.slug}?tab=roadmap&sprint=backlog`,
  })
}
