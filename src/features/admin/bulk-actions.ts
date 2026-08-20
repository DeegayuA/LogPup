'use server'

import { z } from 'zod'
import { inArray } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { requireCapability } from '@/features/auth/actor'
import { EMPLOYMENT_TYPES, USER_ROLES, type EmploymentType, type UserRole } from '@/features/auth/capabilities'
import { archiveApp, deleteApp, updateApp } from '@/features/apps/actions'
import { setUserActive, setUserEmploymentType, setUserRole } from '@/features/admin/actions'
import { summarizeOutcomes, type BulkOutcome, type BulkReport } from '@/features/admin/bulk-logic'
import { ok, err, type ActionResult } from '@/lib/action-result'

/**
 * Batch versions of the admin row actions, for the select-and-act bars on
 * /admin/apps and /admin/people.
 *
 * EVERY operation here DELEGATES to the single-row action rather than writing
 * its own UPDATE. That is the whole design. The row actions carry guards a
 * batch must not be able to outrun — the workspace keeps at least one active
 * superadmin, nobody may change their own seat or status, a trainee needs a
 * named supervisor, deactivating someone who still holds open work has to be
 * acknowledged — and a second implementation of those checks is a second
 * implementation to forget to update. Delegation also means each affected
 * entity gets its own activity row and its own revalidatePath, which is what
 * keeps the audit trail per-entity here like it is everywhere else.
 *
 * The price is N round trips for N rows. Accepted: these are admin batches of
 * tens, not millions, and correctness of the guards is worth more than the
 * latency.
 */

/**
 * One id list, capped. The cap is not a performance limit — it is a blast
 * radius. A select-all on a workspace that has grown to thousands of rows
 * should refuse loudly rather than start a batch nobody can stop.
 */
const idsInput = z
  .array(z.uuid('Invalid id'))
  .min(1, 'Select at least one row')
  .max(200, 'Select 200 rows or fewer for one batch')
  .transform((ids) => Array.from(new Set(ids)))

/**
 * Runs the rows ONE AT A TIME, deliberately.
 *
 * The last-superadmin and last-admin guards are check-then-write: they count
 * the other qualifying rows, then write. Fired in parallel, a batch demoting
 * the final two superadmins would have both reads see the other one still
 * standing and both writes land — the exact hole the guard exists to close.
 * Serial execution makes the guard hold within a batch as well as across
 * requests.
 */
async function runBatch(
  ids: readonly string[],
  run: (id: string) => Promise<ActionResult<unknown>>,
): Promise<BulkReport> {
  const outcomes: BulkOutcome[] = []
  for (const id of ids) {
    try {
      const res = await run(id)
      outcomes.push(res.ok ? { id, ok: true } : { id, ok: false, reason: res.error })
    } catch (error) {
      console.error('[admin] bulk row failed', id, error)
      outcomes.push({ id, ok: false, reason: 'Something went wrong' })
    }
  }
  return summarizeOutcomes(outcomes)
}

// ---------------------------------------------------------------------------
// Apps
// ---------------------------------------------------------------------------

export async function bulkArchiveApps(ids: unknown): Promise<ActionResult<BulkReport>> {
  const parsed = idsInput.safeParse(ids)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  // Checked once for the actor, because this grant does not depend on which
  // app it is: archiveApp itself asks with no resource, so a seat that cannot
  // archive anything would be refused identically on all N rows. The row-level
  // answer is still the one that decides — this only saves N refusals.
  const actor = await requireCapability('app.archive')
  if (!actor) return err('Admins only')

  return ok(await runBatch(parsed.data, (id) => archiveApp(id)))
}

export async function bulkDeleteApps(ids: unknown): Promise<ActionResult<BulkReport>> {
  const parsed = idsInput.safeParse(ids)
  if (!parsed.success) return err(parsed.error.issues[0].message)

  const actor = await requireCapability('app.delete')
  if (!actor) return err('Admins only')

  // Soft delete — deleteApp sets deletedAt/deletedBy and the row stays
  // restorable from admin Trash. Nothing here hard-deletes.
  return ok(await runBatch(parsed.data, (id) => deleteApp(id)))
}

const leadInput = z.object({
  ids: idsInput,
  // Null clears the lead, which is a legitimate batch: an app may have none.
  leadId: z.uuid('Invalid person').nullable(),
})

export async function bulkSetAppLead(raw: unknown): Promise<ActionResult<BulkReport>> {
  const parsed = leadInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { ids, leadId } = parsed.data

  // `appIds`, not a bare check: app.edit is SCOPED for a manager, and a bare
  // check fails closed for them (see the Resource comment in capabilities.ts).
  // Any-of here means "you can edit at least one of these", and updateApp then
  // decides each app on its own — so a manager keeps the apps in their scope
  // and is refused the rest, per row, honestly.
  const actor = await requireCapability('app.edit', { appIds: ids })
  if (!actor) return err('Not allowed')

  return ok(await runBatch(ids, (id) => updateApp(id, { leadId })))
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const activeInput = z.object({
  ids: idsInput,
  active: z.boolean(),
  /**
   * Mirrors setUserActive's third argument. Left off, a person who still holds
   * open work is SKIPPED with that reason rather than silently deactivated —
   * which is the behaviour worth keeping in a batch, where nobody is reading
   * each row.
   */
  acknowledgeUntransferred: z.boolean().default(false),
})

export async function bulkSetUserActive(raw: unknown): Promise<ActionResult<BulkReport>> {
  const parsed = activeInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { ids, active, acknowledgeUntransferred } = parsed.data

  const actor = await requireCapability('user.deactivate')
  if (!actor) return err('Admins only')

  return ok(
    await runBatch(ids, (id) => setUserActive(id, active, acknowledgeUntransferred)),
  )
}

const roleBulkInput = z.object({
  ids: idsInput,
  role: z.enum(USER_ROLES),
})

export async function bulkSetUserRole(raw: unknown): Promise<ActionResult<BulkReport>> {
  const parsed = roleBulkInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { ids, role } = parsed.data

  const actor = await requireCapability('user.role.grant')
  if (!actor) return err('Admins only')

  // Granting superadmin needs superadmin, and that check depends on the VALUE
  // being written rather than the row — setUserRole owns it, and it fires per
  // row, so a batch cannot slip past it either.
  return ok(await runBatch(ids, (id) => setUserRole(id, role as UserRole)))
}

const employmentBulkInput = z.object({
  ids: idsInput,
  employmentType: z.enum(EMPLOYMENT_TYPES),
})

export async function bulkSetUserEmploymentType(
  raw: unknown,
): Promise<ActionResult<BulkReport>> {
  const parsed = employmentBulkInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { ids, employmentType } = parsed.data

  const actor = await requireCapability('user.profile.edit')
  if (!actor) return err('Not allowed')

  // setUserEmploymentType writes `supervisorId ?? null`, so passing nothing
  // would CLEAR every selected person's supervisor as a side effect of
  // changing their stage. Read the current value and hand it back — the row
  // action still refuses a trainee or intern who has none, which surfaces as a
  // per-row skip instead of a supervisor quietly vanishing.
  const existing = await db
    .select({ id: users.id, supervisorId: users.supervisorId })
    .from(users)
    .where(inArray(users.id, ids))
  const supervisorById = new Map(existing.map((row) => [row.id, row.supervisorId]))

  return ok(
    await runBatch(ids, (id) =>
      setUserEmploymentType({
        userId: id,
        employmentType: employmentType as EmploymentType,
        supervisorId: supervisorById.get(id) ?? null,
      }),
    ),
  )
}
