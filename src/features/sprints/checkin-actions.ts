'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apps, sprintCheckins, sprints } from '@/db/schema'
import { auth } from '@/lib/auth'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'

const checkinInput = z.object({
  sprintId: z.uuid(),
  // Whole points only, matching the integer column — see the WHY on
  // sprint_checkins in db/schema.ts.
  percent: z.number().int().min(0, 'Percent must be 0–100').max(100, 'Percent must be 0–100'),
  // Trim BEFORE the length check so 280 real characters padded with
  // whitespace isn't rejected. A note is one standup sentence, not a status
  // report — anything longer belongs on the task or in the meeting notes.
  note: z.string().trim().max(280, 'Keep the note under 280 characters').optional(),
})

/** Same contract as actions.ts/task-actions.ts: a server action returns
 *  err(), it never rejects — the caller renders a sentence, not a crash. */
function unexpected(context: string, error: unknown): ActionResult<never> {
  console.error(`[sprints] ${context}`, error)
  return err('Something went wrong — try again')
}

/**
 * Records (or re-records) the caller's own progress check-in for a sprint:
 * "I'm at N%", optionally with a sentence of context. Upsert on
 * (sprintId, userId) — saying it again replaces the old answer, it never
 * accumulates rows (see the current-state-not-history WHY in db/schema.ts).
 *
 * PERMISSION: any signed-in, approved user, and only for THEMSELVES —
 * userId always comes from the session, never from the caller. People report
 * their own progress; an admin writing someone else's number would defeat
 * the entire point of comparing what a person SAYS against what their board
 * shows (checkinGap in checkins.ts), so no admin override exists on purpose.
 */
export async function upsertSprintCheckin(
  sprintId: string,
  percent: number,
  note?: string,
): Promise<ActionResult<{ percent: number }>> {
  const session = await auth()
  if (!session?.user) return err('Sign in required')
  // Holding a session already implies active=true (the jwt callback in
  // src/lib/auth.ts refuses tokens to deactivated/rejected accounts), so
  // 'approved' is the one gate left to check here — same rule as
  // canAccessApp in src/lib/access-gate.ts, which only the proxy can apply.
  if (session.user.status !== 'approved') return err('Your account is pending approval')

  const parsed = checkinInput.safeParse({ sprintId, percent, note })
  if (!parsed.success) return err(parsed.error.issues[0].message)

  // Existence check doubles as the appId lookup revalidation needs — a
  // random UUID would otherwise surface as an FK violation in the catch.
  const [sprint] = await db
    .select({ appId: sprints.appId, name: sprints.name })
    .from(sprints)
    .where(eq(sprints.id, parsed.data.sprintId))
  if (!sprint) return err('Sprint not found')

  // '' from a cleared textarea means "no note", not a note of empty string —
  // same convention as createSprint's `goal || null`.
  const noteValue = parsed.data.note || null
  const values = {
    percent: parsed.data.percent,
    note: noteValue,
    // Explicit on the conflict path: defaultNow() only fires on INSERT, and
    // a re-check-in that kept the old timestamp would lie to the staleness
    // signal the meeting surface reads.
    updatedAt: new Date(),
  }

  try {
    await db
      .insert(sprintCheckins)
      .values({ sprintId: parsed.data.sprintId, userId: session.user.id, ...values })
      .onConflictDoUpdate({
        target: [sprintCheckins.sprintId, sprintCheckins.userId],
        set: values,
      })
  } catch (error) {
    return unexpected('upsertSprintCheckin', error)
  }

  const [app] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, sprint.appId))
  await logActivity({
    actorId: session.user.id,
    verb: 'checked in',
    entityType: 'sprint',
    entityId: parsed.data.sprintId,
    entityLabel: sprint.name,
    appId: sprint.appId,
    pagePath: app ? '/apps/' + app.slug : null,
    detail: `at ${parsed.data.percent}%`,
    metadata: { percent: parsed.data.percent, note: noteValue },
  })

  if (app) revalidatePath('/apps/' + app.slug)
  // Check-ins feed the meeting-prep surface, which lives outside the app page.
  revalidatePath('/meetings')
  return ok({ percent: parsed.data.percent })
}
