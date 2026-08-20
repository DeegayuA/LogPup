'use server'

import { z } from 'zod'
import { ilike, or, eq, and, asc, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth, signOut } from '@/lib/auth'
import { db } from '@/db'
import { liveApps } from '@/db/live'
import { assignments, tasks, users } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { canAccessApp } from '@/lib/access-gate'
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
  if (!session?.user) return []
  /**
   * Approved, not merely signed in.
   *
   * Open signup means a pending account holds a real session while it waits
   * for an admin (src/lib/access-gate.ts). The proxy pins those users to
   * /pending, but a server action is its own entry point — it can be called
   * directly, without ever loading a page the proxy guards. A bare "has a
   * session" check therefore let an unapproved account enumerate every app,
   * person, task, sprint and meeting in the workspace, one query at a time.
   * Every provider inherits this gate; none re-checks it.
   *
   * `active` is passed for the same reason and not hardcoded: a deactivated
   * account also holds a real session now (src/lib/auth.ts), and the palette
   * is the one surface that reads across the whole workspace at once.
   */
  if (!canAccessApp(session.user.status, session.user.active)) return []

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
  /* Approved, not merely signed in — the same gate universalSearch carries
     above, for the same reason. This one reads `assignableUsers()`, so without
     it a pending account could enumerate every approved teammate's name one
     guess at a time: precisely the enumeration the search gate was added to
     stop, through the door beside it. */
  if (!canAccessApp(session.user.status, true)) return null

  const input = z.string().max(400).safeParse(raw)
  if (!input.success) return null

  const people = await assignableUsers()
  const intent = parseTaskIntent(input.data, people)
  if (!intent) return null

  let appName: string | null = null
  if (intent.appQuery) {
    const [match] = await db
      .select({ name: liveApps.name })
      .from(liveApps)
      .where(
        or(
          ilike(liveApps.name, likePattern(intent.appQuery)),
          ilike(liveApps.slug, likePattern(intent.appQuery)),
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
  /* The sharpest of the three. This one WRITES: without the gate an account
     that an administrator has not approved — or has deactivated — could insert
     tasks into any app and assign them to anyone. The message deliberately
     says approval rather than naming a status, so it reads the same to someone
     waiting in the queue as to someone whose access was withdrawn. */
  if (!canAccessApp(session.user.status, true)) return err('Your account is awaiting approval')

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
      .select({ id: liveApps.id })
      .from(liveApps)
      .where(or(ilike(liveApps.name, likePattern(appQuery)), ilike(liveApps.slug, likePattern(appQuery))))
      .limit(2)
    if (matches.length === 0) {
      taskTitle = `${taskTitle} on ${appQuery}`
      appQuery = null
    }
  }

  let app: { id: string; name: string; slug: string } | undefined
  if (appQuery) {
    const appMatches = await db
      .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug })
      .from(liveApps)
      .where(
        or(ilike(liveApps.name, likePattern(appQuery)), ilike(liveApps.slug, likePattern(appQuery))),
      )
      .orderBy(asc(liveApps.name))
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
      .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug })
      .from(assignments)
      .innerJoin(liveApps, eq(assignments.appId, liveApps.id))
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
