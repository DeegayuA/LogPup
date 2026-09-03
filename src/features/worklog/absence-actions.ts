'use server'

import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { absences } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { loadActor } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
import { overlaps } from '@/features/worklog/schedules'
import { SELF_DECLARABLE_KINDS, type AbsenceKind } from '@/features/worklog/absence-kinds'

/**
 * Why a person owed no work on a range of days.
 *
 * NOTHING AUTO-APPROVES. An absence removes days from a compliance
 * denominator, so an exemption that took effect the moment someone typed it
 * would be self-approval wearing a different hat — the exact thing the
 * approval workflow exists to prevent. Every absence starts 'pending', and a
 * pending absence never exempts a day.
 */

// What a person may declare about themselves, READ FROM THE ONE LIST rather
// than restated here. This tuple and the dialog's picker were two hand-kept
// copies of the same set, and the copy that fell behind decided whether a kind
// was unpickable (harmless) or pickable and unsavable (a dead end at the last
// click). 'no_work_assigned' and 'other' are excluded in absence-kinds.ts, not
// here: the first is a statement about the studio failing to give someone work
// — a grievance the UI must not disguise as a form field — and the second is
// the admin escape hatch.
const SELF_DECLARABLE = SELF_DECLARABLE_KINDS as readonly [AbsenceKind, ...AbsenceKind[]]

const createInput = z.object({
  // Both bounds INCLUSIVE, unlike the half-open intervals elsewhere in the
  // schema: these are dates a person states in words, and an exclusive end is
  // the classic off-by-one in exactly that translation.
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(SELF_DECLARABLE),
  reason: z.string().trim().max(500).optional(),
})

function unexpected(context: string, error: unknown): ActionResult<never> {
  console.error(`[absences] ${context}`, error)
  return err('Something went wrong — try again')
}

export async function createAbsence(
  raw: z.input<typeof createInput>,
): Promise<ActionResult<{ id: string; status: 'pending' }>> {
  const parsed = createInput.safeParse(raw)
  if (!parsed.success) return err('Check the dates and try again')
  const { startDate, endDate, kind, reason } = parsed.data

  const actor = await loadActor()
  // absence.create is 'own' for every seat that holds it, so the resource is
  // the actor themselves — you file your own leave and nobody else's.
  if (!actor || !can(actor, 'absence.create', { ownerId: actor.id })) return err('Not allowed')

  if (endDate < startDate) return err('The end date is before the start date')

  try {
    // Retroactive with NO limit: filing leave for a past date is valid, and
    // approval flips those days to exempt immediately even if a report already
    // counted them missing. Coverage is truth-as-currently-known.
    const existing = await db
      .select({ id: absences.id, startDate: absences.startDate, endDate: absences.endDate })
      .from(absences)
      .where(and(eq(absences.userId, actor.id), inArray(absences.status, ['pending', 'approved'])))

    const clash = existing.find((row) => overlaps({ startDate, endDate }, row))
    if (clash) {
      return err(`That overlaps an absence you already filed (${clash.startDate} to ${clash.endDate})`)
    }

    const [row] = await db
      .insert(absences)
      .values({
        userId: actor.id,
        startDate,
        endDate,
        kind,
        reason: reason ?? null,
        createdBy: actor.id,
      })
      .returning({ id: absences.id })

    await logActivity({
      actorId: actor.id,
      verb: 'created',
      entityType: 'absence',
      entityId: row.id,
      entityLabel: `${kind} ${startDate}${endDate === startDate ? '' : ` to ${endDate}`}`,
    })

    // Both surfaces move in the same roundtrip: the day leaves the worklog
    // catch-up list, and the absence lands in the admin approvals inbox.
    revalidatePath('/worklog')
    revalidatePath('/admin', 'layout')
    return ok({ id: row.id, status: 'pending' as const })
  } catch (error) {
    return unexpected('createAbsence', error)
  }
}

const reviewInput = z.object({
  id: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
})

async function review(
  raw: z.input<typeof reviewInput>,
  decision: 'approved' | 'rejected',
): Promise<ActionResult<void>> {
  const parsed = reviewInput.safeParse(raw)
  if (!parsed.success) return err('Check the request and try again')

  const actor = await loadActor()
  if (!actor) return err('Not allowed')

  try {
    const [row] = await db
      .select({ id: absences.id, userId: absences.userId, status: absences.status, kind: absences.kind })
      .from(absences)
      .where(eq(absences.id, parsed.data.id))
    if (!row) return err('That absence no longer exists')
    if (row.status !== 'pending') return err('That absence has already been reviewed')

    // Separation of duties: nobody signs their own, except a superadmin —
    // otherwise a sole-superadmin workspace could never approve anything.
    const isSelf = row.userId === actor.id
    const permitted = isSelf
      ? can(actor, 'request.review.self', { ownerId: actor.id })
      : can(actor, 'absence.approve', { ownerId: row.userId })
    if (!permitted) return err('Not allowed')

    // COMPARE-AND-SET, AND THE RESULT IS READ. The predicate was always right;
    // nothing checked whether it matched. Two reviewers opening the same
    // pending row both pass the `row.status !== 'pending'` guard above — that
    // check runs against a SELECT taken before either of them decided — so the
    // loser's UPDATE touched zero rows while this function went on to write an
    // 'approved' activity row and return ok. The reviewer saw a success toast,
    // the audit trail gained a decision nobody made, and the actual decision
    // was somebody else's.
    const updated = await db
      .update(absences)
      .set({
        status: decision,
        reviewerId: actor.id,
        reviewedAt: new Date(),
        reviewNote: parsed.data.note ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(absences.id, row.id), eq(absences.status, 'pending')))
      .returning({ id: absences.id })

    // Nothing is logged and nothing is claimed when nothing changed.
    if (updated.length === 0) return err('Somebody already decided that one')

    await logActivity({
      actorId: actor.id,
      verb: decision,
      entityType: 'absence',
      entityId: row.id,
      entityLabel: row.kind,
      metadata: { selfApproved: isSelf },
    })

    revalidatePath('/worklog')
    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch (error) {
    return unexpected(`review:${decision}`, error)
  }
}

export async function approveAbsence(raw: z.input<typeof reviewInput>) {
  return review(raw, 'approved')
}

export async function rejectAbsence(raw: z.input<typeof reviewInput>) {
  return review(raw, 'rejected')
}

export async function withdrawAbsence(raw: { id: string }): Promise<ActionResult<void>> {
  const actor = await loadActor()
  if (!actor) return err('Not allowed')
  try {
    const [row] = await db
      .select({ id: absences.id, userId: absences.userId, status: absences.status })
      .from(absences)
      .where(eq(absences.id, raw.id))
    if (!row) return err('That absence no longer exists')
    if (row.userId !== actor.id) return err('Not allowed')
    if (row.status !== 'pending') return err('That absence has already been reviewed')

    // `eq(status, 'pending')`, NOT `ne(status, 'approved')`.
    //
    // The old predicate matched anything that was not approved — including
    // 'rejected'. A reviewer who rejected this absence in the window between
    // the SELECT above and this UPDATE had their decision silently rewritten
    // to 'withdrawn', taking reviewerId, reviewedAt and the reason they typed
    // with it. The person withdrew a request that had already been refused and
    // the refusal simply vanished.
    //
    // The set of states this may leave is exactly one: pending. Saying that
    // directly is also what makes the zero-row case meaningful below.
    const updated = await db
      .update(absences)
      .set({ status: 'withdrawn', updatedAt: new Date() })
      .where(and(eq(absences.id, row.id), eq(absences.status, 'pending')))
      .returning({ id: absences.id })

    if (updated.length === 0) return err('That absence has already been reviewed')

    revalidatePath('/worklog')
    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch (error) {
    return unexpected('withdrawAbsence', error)
  }
}
