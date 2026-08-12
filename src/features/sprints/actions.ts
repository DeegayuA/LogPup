'use server'

import { z } from 'zod'
import { and, count, desc, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, sprints, tasks } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { logActivity } from '@/features/activity/log'
import { initialSprintStatus } from '@/features/sprints/sprint-date-range'

const sprintInput = z
  .object({
    appId: z.uuid(),
    name: z.string().min(2).max(60),
    goal: z.string().max(300).optional(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })

/**
 * Partial patch for an existing sprint. No `.default()` anywhere, same rule
 * as taskUpdateInput: a key the caller didn't send must stay absent so a
 * rename never silently rewrites the dates.
 *
 * Status is deliberately NOT here. Activating a sprint carries the
 * one-active-per-app invariant, which `updateSprintStatus` already enforces
 * in a single db.batch; duplicating that here would give the invariant two
 * homes and one of them would eventually drift.
 */
const sprintUpdateInput = z
  .object({
    name: z.string().min(2).max(60),
    goal: z.string().max(300).nullable(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .partial()

const SPRINT_STATUSES = ['planned', 'active', 'done'] as const
type SprintStatus = (typeof SPRINT_STATUSES)[number]

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin') return null
  return session
}

/**
 * Same contract as task-actions' `unexpected`: a server action returns
 * `err()`, it never rejects. `createSprint` in particular takes an `appId`
 * straight from the caller, so a UUID that isn't an app raises a foreign-key
 * violation (23503) — a REACHABLE throw, not a hypothetical outage — which
 * without this would surface as a rejected promise and a dialog that just
 * stops responding.
 */
function unexpected(context: string, error: unknown): ActionResult<never> {
  console.error(`[sprints] ${context}`, error)
  return err('Something went wrong — try again')
}

async function slugForApp(appId: string): Promise<string | null> {
  const [app] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, appId))
  return app?.slug ?? null
}

export async function createSprint(input: unknown): Promise<ActionResult<{ sprintId: string }>> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  const parsed = sprintInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const { appId, name, goal, startDate, endDate } = parsed.data
  const today = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
  const status = initialSprintStatus(startDate, endDate, today)

  // Generated client-side (not via .returning()) so the id is known up
  // front regardless of which branch below runs — same reasoning as
  // createMeeting's use of db.batch in meetings/actions.ts.
  const sprintId = crypto.randomUUID()

  try {
    if (status === 'active') {
      // A sprint that starts life 'active' (its range already contains
      // today) must obey the same single-active-per-app rule
      // updateSprintStatus enforces: demote any existing active sprint for
      // this app in the same db.batch round-trip (neon-http has no
      // transactions) so the app never ends up with two active sprints.
      // The demote runs FIRST so its `eq(status, 'active')` filter can't
      // also catch the row this batch is about to insert.
      await db.batch([
        db
          .update(sprints)
          .set({ status: 'done' })
          .where(and(eq(sprints.appId, appId), eq(sprints.status, 'active'))),
        db
          .insert(sprints)
          .values({ id: sprintId, appId, name, goal: goal || null, startDate, endDate, status }),
      ])
    } else {
      await db
        .insert(sprints)
        .values({ id: sprintId, appId, name, goal: goal || null, startDate, endDate, status })
    }
  } catch (error) {
    return unexpected('createSprint', error)
  }

  const slug = await slugForApp(appId)
  await logActivity({
    actorId: session.user.id,
    verb: 'created',
    entityType: 'sprint',
    entityId: sprintId,
    entityLabel: name,
    appId,
    pagePath: slug ? '/apps/' + slug : null,
    detail: status === 'active' ? 'as the active sprint' : null,
    metadata: { status, startDate, endDate },
  })
  if (slug) revalidatePath('/apps/' + slug)
  return ok({ sprintId })
}

/**
 * Renames, re-goals or reschedules an existing sprint — the write behind
 * every roadmap interaction: dragging a bar sideways, dragging either edge,
 * and inline rename all funnel through here.
 *
 * WHY THE MERGE. A resize sends ONE date. Validating "end on or after start"
 * against only the field that arrived would let a drag of the left edge past
 * a stale end date through, so the patch is merged onto the stored row and
 * the RESULTING range is what gets checked. That is also why this is a
 * server-side check and not merely a client clamp: the client's clamp is a
 * courtesy, this is the rule.
 *
 * Status is untouched on purpose. A sprint dragged forward past today does
 * not silently become 'active' — that is a decision with a side effect on
 * every other sprint in the app (only one may be active), and it belongs to
 * the person, via `updateSprintStatus`.
 */
export async function updateSprint(sprintId: string, input: unknown): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  if (!z.uuid().safeParse(sprintId).success) return err('Sprint not found')

  const parsed = sprintUpdateInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  if (Object.keys(parsed.data).length === 0) return err('Nothing to update')

  const [existing] = await db.select().from(sprints).where(eq(sprints.id, sprintId))
  if (!existing) return err('Sprint not found')

  const startDate = parsed.data.startDate ?? existing.startDate
  const endDate = parsed.data.endDate ?? existing.endDate
  if (endDate < startDate) return err('End date must be on or after the start date')

  const set: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) set.name = parsed.data.name
  // '' from a cleared textarea means "no goal", not a goal of empty string —
  // matching how createSprint stores `goal || null`.
  if (parsed.data.goal !== undefined) set.goal = parsed.data.goal || null
  if (parsed.data.startDate !== undefined) set.startDate = parsed.data.startDate
  if (parsed.data.endDate !== undefined) set.endDate = parsed.data.endDate

  try {
    await db.update(sprints).set(set).where(eq(sprints.id, sprintId))
  } catch (error) {
    return unexpected('updateSprint', error)
  }

  const slug = await slugForApp(existing.appId)
  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'sprint',
    entityId: sprintId,
    entityLabel: parsed.data.name ?? existing.name,
    appId: existing.appId,
    pagePath: slug ? '/apps/' + slug : null,
    detail:
      parsed.data.startDate !== undefined || parsed.data.endDate !== undefined
        ? `to ${startDate} – ${endDate}`
        : null,
    metadata: {
      before: {
        name: existing.name,
        goal: existing.goal,
        startDate: existing.startDate,
        endDate: existing.endDate,
      },
      after: set,
    },
  })
  if (slug) revalidatePath('/apps/' + slug)
  return ok(undefined)
}

/**
 * Deletes a sprint. Its tasks are NOT deleted: `tasks.sprint_id` is
 * ON DELETE SET NULL, so they fall back into the app backlog where they stay
 * findable. The count is returned so the UI can say exactly how many landed
 * there rather than leaving the user to wonder where the work went.
 */
export async function deleteSprint(
  sprintId: string,
): Promise<ActionResult<{ releasedTasks: number }>> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  if (!z.uuid().safeParse(sprintId).success) return err('Sprint not found')

  const [existing] = await db
    .select({ appId: sprints.appId, name: sprints.name })
    .from(sprints)
    .where(eq(sprints.id, sprintId))
  if (!existing) return err('Sprint not found')

  // COUNT in SQL. The only thing this number is for is a sentence in a
  // toast, and pulling one row per task across the wire to call `.length` on
  // it makes a sprint with 300 tasks pay 300 rows for a single integer.
  const [attached] = await db
    .select({ total: count() })
    .from(tasks)
    .where(eq(tasks.sprintId, sprintId))

  try {
    await db.delete(sprints).where(eq(sprints.id, sprintId))
  } catch (error) {
    return unexpected('deleteSprint', error)
  }

  const slug = await slugForApp(existing.appId)
  await logActivity({
    actorId: session.user.id,
    verb: 'deleted',
    entityType: 'sprint',
    entityId: sprintId,
    entityLabel: existing.name,
    appId: existing.appId,
    pagePath: slug ? '/apps/' + slug : null,
    detail: `releasing ${attached?.total ?? 0} tasks to the backlog`,
    metadata: { releasedTasks: attached?.total ?? 0 },
  })
  if (slug) revalidatePath('/apps/' + slug)
  return ok({ releasedTasks: attached?.total ?? 0 })
}

export type SprintOption = {
  id: string
  name: string
  status: SprintStatus
  startDate: string
  endDate: string
}

/**
 * Read-only, on demand: the app's sprints, for the "move to sprint" control
 * in the task dialog.
 *
 * This is a READ in an actions file, which is not how this codebase normally
 * fetches — the read layer is queries.ts, called from a server component.
 * The board, though, is handed a single sprint's tasks by its host route and
 * has no way to learn about the app's OTHER sprints; a client component
 * cannot call queries.ts. Fetching once when the dialog first opens keeps
 * the capability without widening the route's payload for everyone who never
 * opens it. Auth-gated like every other action here.
 */
export async function listSprintOptions(appId: string): Promise<ActionResult<SprintOption[]>> {
  const session = await auth()
  if (!session?.user) return err('Sign in required')
  if (!z.uuid().safeParse(appId).success) return err('App not found')

  const rows = await db
    .select({
      id: sprints.id,
      name: sprints.name,
      status: sprints.status,
      startDate: sprints.startDate,
      endDate: sprints.endDate,
    })
    .from(sprints)
    .where(eq(sprints.appId, appId))
    .orderBy(desc(sprints.startDate))

  return ok(rows)
}

export async function updateSprintStatus(
  sprintId: string,
  status: SprintStatus,
): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!session) return err('Admins only')
  if (!SPRINT_STATUSES.includes(status)) return err('Invalid status')
  if (!z.uuid().safeParse(sprintId).success) return err('Sprint not found')

  const [existing] = await db
    .select({ appId: sprints.appId, name: sprints.name, status: sprints.status })
    .from(sprints)
    .where(eq(sprints.id, sprintId))
  if (!existing) return err('Sprint not found')

  try {
    if (status === 'active') {
      // neon-http has no transactions: db.batch sends both statements in one
      // atomic round-trip so the app never ends up with two active sprints
      // (or none) if only one of the two updates were to apply.
      await db.batch([
        db.update(sprints).set({ status: 'active' }).where(eq(sprints.id, sprintId)),
        db
          .update(sprints)
          .set({ status: 'done' })
          .where(
            and(
              eq(sprints.appId, existing.appId),
              eq(sprints.status, 'active'),
              ne(sprints.id, sprintId),
            ),
          ),
      ])
    } else {
      await db.update(sprints).set({ status }).where(eq(sprints.id, sprintId))
    }
  } catch (error) {
    return unexpected('updateSprintStatus', error)
  }

  const slug = await slugForApp(existing.appId)
  await logActivity({
    actorId: session.user.id,
    verb: 'updated',
    entityType: 'sprint',
    entityId: sprintId,
    entityLabel: existing.name,
    appId: existing.appId,
    pagePath: slug ? '/apps/' + slug : null,
    detail: 'to ' + status,
    metadata: { status: { from: existing.status, to: status } },
  })
  if (slug) revalidatePath('/apps/' + slug)
  return ok(undefined)
}
