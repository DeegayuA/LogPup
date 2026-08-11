'use server'

import { z } from 'zod'
import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, sprints } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
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

const SPRINT_STATUSES = ['planned', 'active', 'done'] as const
type SprintStatus = (typeof SPRINT_STATUSES)[number]

const sprintDatesInput = z
  .object({ startDate: z.iso.date(), endDate: z.iso.date() })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })

async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'admin') return null
  return session
}

async function slugForApp(appId: string): Promise<string | null> {
  const [app] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, appId))
  return app?.slug ?? null
}

export async function createSprint(input: unknown): Promise<ActionResult<{ sprintId: string }>> {
  if (!(await requireAdmin())) return err('Admins only')
  const parsed = sprintInput.safeParse(input)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const { appId, name, goal, startDate, endDate } = parsed.data
  const today = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
  const status = initialSprintStatus(startDate, endDate, today)

  // Generated client-side (not via .returning()) so the id is known up
  // front regardless of which branch below runs — same reasoning as
  // createMeeting's use of db.batch in meetings/actions.ts.
  const sprintId = crypto.randomUUID()

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

  const slug = await slugForApp(appId)
  if (slug) revalidatePath('/apps/' + slug)
  return ok({ sprintId })
}

export async function updateSprintStatus(
  sprintId: string,
  status: SprintStatus,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')
  if (!SPRINT_STATUSES.includes(status)) return err('Invalid status')

  const [existing] = await db
    .select({ appId: sprints.appId })
    .from(sprints)
    .where(eq(sprints.id, sprintId))
  if (!existing) return err('Sprint not found')

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

  const slug = await slugForApp(existing.appId)
  if (slug) revalidatePath('/apps/' + slug)
  return ok(undefined)
}

/**
 * Backs the roadmap's bar-body shift, its two edge-resize handles, and the
 * keyboard Left/Right/Shift+Left/Right nudges — all of them ultimately just
 * move a sprint's start and/or end date. `roadmap-geometry.ts` computes the
 * new dates client-side (for the optimistic update and the live tooltip);
 * this only re-validates and persists them.
 */
export async function updateSprintDates(
  sprintId: string,
  startDate: string,
  endDate: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')
  const parsed = sprintDatesInput.safeParse({ startDate, endDate })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [existing] = await db
    .select({ appId: sprints.appId })
    .from(sprints)
    .where(eq(sprints.id, sprintId))
  if (!existing) return err('Sprint not found')

  await db
    .update(sprints)
    .set({ startDate: parsed.data.startDate, endDate: parsed.data.endDate })
    .where(eq(sprints.id, sprintId))

  const slug = await slugForApp(existing.appId)
  if (slug) revalidatePath('/apps/' + slug)
  return ok(undefined)
}

/** Backs the roadmap's reorder grip (pointer drag or Alt+Up/Down) — the new
 *  `sortOrder` is computed client-side via `sortOrderForIndex`, same
 *  fractional-midpoint-with-fallback strategy as the board's task drag. */
export async function reorderSprint(sprintId: string, sortOrder: number): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')
  if (!Number.isInteger(sortOrder)) return err('Invalid sort order')

  const [existing] = await db
    .select({ appId: sprints.appId })
    .from(sprints)
    .where(eq(sprints.id, sprintId))
  if (!existing) return err('Sprint not found')

  await db.update(sprints).set({ sortOrder }).where(eq(sprints.id, sprintId))

  const slug = await slugForApp(existing.appId)
  if (slug) revalidatePath('/apps/' + slug)
  return ok(undefined)
}

/**
 * The roadmap header's "Sort by date" button — reseeds every sprint's
 * `sortOrder` chronologically, same `row_number() OVER (PARTITION BY
 * app_id ORDER BY start_date, id)` shape as migration 0016's initial seed,
 * just re-run on demand and unconditionally (no `sort_order = 0` guard —
 * this one is a deliberate "put it back in date order" action, not a
 * one-time backfill).
 */
export async function resortSprintsByDate(appId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')

  const rows = await db
    .select({ id: sprints.id })
    .from(sprints)
    .where(eq(sprints.appId, appId))
    .orderBy(sprints.startDate, sprints.id)
  if (rows.length === 0) return err('No sprints to sort')

  // Sequential, not db.batch: this reseeds a whole app's row order in one
  // user gesture, not an invariant like "at most one active sprint" — a
  // partial application on a mid-request failure still leaves every row
  // with a valid (if not fully re-sorted) sortOrder, so the atomicity
  // db.batch buys elsewhere isn't worth the variadic-tuple typing it needs.
  for (const [index, row] of rows.entries()) {
    await db
      .update(sprints)
      .set({ sortOrder: (index + 1) * 1024 })
      .where(eq(sprints.id, row.id))
  }

  const slug = await slugForApp(appId)
  if (slug) revalidatePath('/apps/' + slug)
  return ok(undefined)
}

/** Roadmap/board inline-rename target for a sprint's name. */
export async function renameSprint(sprintId: string, name: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')
  const parsed = z.string().min(2).max(60).safeParse(name)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const [existing] = await db
    .select({ appId: sprints.appId })
    .from(sprints)
    .where(eq(sprints.id, sprintId))
  if (!existing) return err('Sprint not found')

  await db.update(sprints).set({ name: parsed.data }).where(eq(sprints.id, sprintId))

  const slug = await slugForApp(existing.appId)
  if (slug) revalidatePath('/apps/' + slug)
  return ok(undefined)
}

export async function deleteSprint(sprintId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return err('Admins only')

  const [existing] = await db
    .select({ appId: sprints.appId })
    .from(sprints)
    .where(eq(sprints.id, sprintId))
  if (!existing) return err('Sprint not found')

  // tasks.sprint_id is ON DELETE SET NULL — a deleted sprint's tasks land
  // back in the app's backlog rather than being destroyed with it.
  await db.delete(sprints).where(eq(sprints.id, sprintId))

  const slug = await slugForApp(existing.appId)
  if (slug) revalidatePath('/apps/' + slug)
  return ok(undefined)
}
