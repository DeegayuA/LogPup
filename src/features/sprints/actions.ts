'use server'

import { z } from 'zod'
import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, sprints } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'

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
  const [created] = await db
    .insert(sprints)
    .values({ appId, name, goal: goal || null, startDate, endDate })
    .returning({ id: sprints.id })

  const slug = await slugForApp(appId)
  if (slug) revalidatePath('/apps/' + slug)
  return ok({ sprintId: created.id })
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
