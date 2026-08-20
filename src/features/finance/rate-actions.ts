'use server'

/**
 * Writing money: role rates, person-rate overrides, and what a project is
 * worth. The mutation half of the finance feature — `queries.ts` reads,
 * `cost.ts` decides what a number means, this file is the only place any of
 * the three source tables (`rate_cards`, `person_rates`, `project_value`) is
 * ever written.
 *
 * EVERY ACTION HERE GATES ON `finance.view` — the same capability that gates
 * every read in `queries.ts`, per the design's "one capability for rates AND
 * everything derived from them" rule. There is no separate "finance.write";
 * splitting read and write would only tempt a future scoped-write grant that
 * the read side explicitly refuses to have.
 *
 * RATES ARE AS-OF INTERVALS, NEVER MUTATED IN PLACE. `setRoleRate` and
 * `setPersonRate` always INSERT a new row; neither ever contains an UPDATE of
 * `hourly` on an existing one. Editing a rate in place would silently re-price
 * every hour ever worked against it — last quarter's finished project would
 * change cost, months after it closed, because somebody got a raise this
 * week. `closeRoleRate`/`closePersonRate` are the only writes that touch an
 * existing row, and the only column either ever sets is `effective_to`.
 *
 * OVERLAP IS REJECTED, NOT SILENTLY SUPERSEDED. Unlike `setWorkSchedule`
 * (which closes whatever is open and opens the replacement in one batch),
 * `setRoleRate`/`setPersonRate` refuse to insert while an interval already
 * covers the new one's start — an admin must close the old rate first, as a
 * separate, deliberate action. Two rates in force on the same day make cost
 * non-deterministic (which one priced a given hour depends on row order), so
 * this is a hard refusal, never an auto-close a caller could trigger by
 * accident.
 *
 * NOTHING IN THIS FILE'S ACTIVITY-LOG CALLS EVER CARRIES A DOLLAR FIGURE.
 * `logActivity` writes to `activity_log`, and `/activity` is readable by
 * every seat that holds `activity.view` — superadmin through member, which is
 * everyone except stakeholder. That is a MUCH wider audience than
 * `finance.view` (superadmin/admin only), so `hourly`, `contractValue` and
 * `subscriptionMonthly` are deliberately absent from every `entityLabel`,
 * `detail` and `metadata` below — logging the amount here would defeat the
 * capability gate on every read in `queries.ts` in one shared feed. WHO a
 * rate changed for and WHEN follow the same transparency `setUserRole`
 * (admin/actions.ts) already gives role changes — naming the role or person
 * is not the secret; the number is.
 */
import { z } from 'zod'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { personRates, projectValue, rateCards, users } from '@/db/schema'
import { ok, err, type ActionResult } from '@/lib/action-result'
import { logActivity } from '@/features/activity/log'
import { requireCapability } from '@/features/auth/actor'
import { isIsoDay, isoDayOf } from '@/features/people/iso-day'

function unexpected(context: string, error: unknown): ActionResult<never> {
  console.error(`[finance] ${context}`, error)
  return err('Something went wrong — try again')
}

// A 3-letter code, not a free-for-all string: rate_cards/person_rates/
// project_value each carry their own `currency` column (still v1's "one
// workspace currency" assumption — mixing them is a later problem cost.ts
// already refuses to solve), and a typo'd code here would silently create a
// second currency the maths module has no way to reconcile.
const currencyInput = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code, e.g. LKR')

const isoDayInput = z.string().refine(isIsoDay, 'Not a valid day')

// min(0), not .positive(): a genuine 0 is a real, statable rate — an unpaid
// intern's hour really does cost nothing (see cost.ts's toAmount). max holds
// the numeric(12,2)/numeric(14,2) columns comfortably without overflowing.
const hourlyInput = z.number().finite().min(0).max(999_999.99)
const moneyInput = z.number().finite().min(0).max(9_999_999_999.99)

// ---------------------------------------------------------------------------
// Role rates
// ---------------------------------------------------------------------------

const setRoleRateInput = z.object({
  // Free text, matched by VALUE against users.title — not a foreign key, so a
  // rate card can keep pricing hours logged under a title nobody holds today.
  role: z.string().trim().min(1).max(120),
  hourly: hourlyInput,
  currency: currencyInput,
  effectiveFrom: isoDayInput,
})

/**
 * Opens a new rate for a job role, starting `effectiveFrom`.
 *
 * REFUSES an overlap with any existing interval for this role: an open row
 * (no `effective_to`) overlaps every possible new start, so a role with an
 * open rate must be closed (`closeRoleRate`) before a new one can be set —
 * this function will not do that silently. A CLOSED row overlaps only if the
 * new rate would start before that old row's own end.
 */
export async function setRoleRate(
  raw: z.input<typeof setRoleRateInput>,
): Promise<ActionResult<{ id: string }>> {
  const actor = await requireCapability('finance.view')
  if (!actor) return err('Not allowed')

  const parsed = setRoleRateInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { role, hourly, currency, effectiveFrom } = parsed.data

  try {
    const overlapping = await db
      .select({ id: rateCards.id })
      .from(rateCards)
      .where(and(
        eq(rateCards.role, role),
        // Open (effective_to is null) always overlaps; a closed row only
        // overlaps if it was still in force when the new one would start.
        or(isNull(rateCards.effectiveTo), gt(rateCards.effectiveTo, effectiveFrom)),
      ))
    if (overlapping.length > 0) {
      return err('This role already has a rate covering that date — close it first')
    }

    // numeric(12,2): the driver hands `numeric` back as a string and expects
    // one on the way in too, so this is a deliberate `.toFixed(2)`, not a
    // silent `Number()` — see cost.ts's header on the same convention.
    const [row] = await db
      .insert(rateCards)
      .values({ role, hourly: hourly.toFixed(2), currency, effectiveFrom, setBy: actor.id })
      .returning({ id: rateCards.id })

    await logActivity({
      actorId: actor.id,
      verb: 'created',
      entityType: 'rate_card',
      entityId: row.id,
      entityLabel: `Rate for ${role}`,
      detail: `effective ${effectiveFrom}`,
      // No `hourly` here — see the file header.
      metadata: { role, currency, effectiveFrom },
    })

    revalidatePath('/admin', 'layout')
    return ok({ id: row.id })
  } catch (error) {
    return unexpected('setRoleRate', error)
  }
}

const closeRoleRateInput = z.object({
  role: z.string().trim().min(1).max(120),
  effectiveTo: isoDayInput.optional(),
})

/**
 * Ends the currently open rate for a role. Sets `effective_to` only — the
 * rate that was in force keeps every historical hour it already priced.
 */
export async function closeRoleRate(
  raw: z.input<typeof closeRoleRateInput>,
): Promise<ActionResult<void>> {
  const actor = await requireCapability('finance.view')
  if (!actor) return err('Not allowed')

  const parsed = closeRoleRateInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { role } = parsed.data
  const closeOn = parsed.data.effectiveTo ?? isoDayOf(new Date())

  try {
    const [open] = await db
      .select({ id: rateCards.id, effectiveFrom: rateCards.effectiveFrom })
      .from(rateCards)
      .where(and(eq(rateCards.role, role), isNull(rateCards.effectiveTo)))
    if (!open) return err('No open rate for this role')
    if (closeOn <= open.effectiveFrom) return err('Close date must be after the rate started')

    await db.update(rateCards).set({ effectiveTo: closeOn }).where(eq(rateCards.id, open.id))

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'rate_card',
      entityId: open.id,
      entityLabel: `Rate for ${role}`,
      detail: `closed effective ${closeOn}`,
      metadata: { role, effectiveTo: closeOn },
    })

    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch (error) {
    return unexpected('closeRoleRate', error)
  }
}

// ---------------------------------------------------------------------------
// Person rate overrides — SALARY DATA, same rules as role rates plus one more:
// never let a rate reach a per-person surface. This file only ever WRITES
// person_rates; queries.ts's finance.view gate is what stands between this
// table and anyone reading it back.
// ---------------------------------------------------------------------------

const setPersonRateInput = z.object({
  userId: z.string().uuid(),
  hourly: hourlyInput,
  currency: currencyInput,
  effectiveFrom: isoDayInput,
})

/** Opens a new per-person override, starting `effectiveFrom`. Same overlap rule as setRoleRate. */
export async function setPersonRate(
  raw: z.input<typeof setPersonRateInput>,
): Promise<ActionResult<{ id: string }>> {
  const actor = await requireCapability('finance.view')
  if (!actor) return err('Not allowed')

  const parsed = setPersonRateInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { userId, hourly, currency, effectiveFrom } = parsed.data

  try {
    const [person] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId))
    if (!person) return err('That person no longer exists')

    const overlapping = await db
      .select({ id: personRates.id })
      .from(personRates)
      .where(and(
        eq(personRates.userId, userId),
        or(isNull(personRates.effectiveTo), gt(personRates.effectiveTo, effectiveFrom)),
      ))
    if (overlapping.length > 0) {
      return err('This person already has a rate covering that date — close it first')
    }

    const [row] = await db
      .insert(personRates)
      .values({ userId, hourly: hourly.toFixed(2), currency, effectiveFrom, setBy: actor.id })
      .returning({ id: personRates.id })

    await logActivity({
      actorId: actor.id,
      verb: 'created',
      entityType: 'person_rate',
      entityId: userId,
      entityLabel: `Rate override for ${person.name}`,
      detail: `effective ${effectiveFrom}`,
      // No `hourly` here — see the file header. Unlike setUserRole, which
      // names the new role in the clear, a rate override's VALUE is the one
      // fact this feature exists to keep out of the shared activity feed.
      metadata: { currency, effectiveFrom },
    })

    revalidatePath('/admin', 'layout')
    return ok({ id: row.id })
  } catch (error) {
    return unexpected('setPersonRate', error)
  }
}

const closePersonRateInput = z.object({
  userId: z.string().uuid(),
  effectiveTo: isoDayInput.optional(),
})

/**
 * Ends a person's open rate override. After this, their hours resolve back
 * to their role's rate for any day on or after `effectiveTo` — the normal
 * case, and the one that must stay normal (see cost.ts's rateForPersonOnDay).
 */
export async function closePersonRate(
  raw: z.input<typeof closePersonRateInput>,
): Promise<ActionResult<void>> {
  const actor = await requireCapability('finance.view')
  if (!actor) return err('Not allowed')

  const parsed = closePersonRateInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { userId } = parsed.data
  const closeOn = parsed.data.effectiveTo ?? isoDayOf(new Date())

  try {
    const [open] = await db
      .select({ id: personRates.id, effectiveFrom: personRates.effectiveFrom })
      .from(personRates)
      .where(and(eq(personRates.userId, userId), isNull(personRates.effectiveTo)))
    if (!open) return err('No open rate override for this person')
    if (closeOn <= open.effectiveFrom) return err('Close date must be after the rate started')

    const [person] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId))

    await db.update(personRates).set({ effectiveTo: closeOn }).where(eq(personRates.id, open.id))

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'person_rate',
      entityId: userId,
      entityLabel: `Rate override for ${person?.name ?? 'a former teammate'}`,
      detail: `closed effective ${closeOn}`,
      metadata: { effectiveTo: closeOn },
    })

    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch (error) {
    return unexpected('closePersonRate', error)
  }
}

// ---------------------------------------------------------------------------
// Project value — contract price and/or subscription. One row per app.
// ---------------------------------------------------------------------------

const setProjectValueInput = z
  .object({
    appId: z.string().uuid(),
    // Null means "not stated", never 0 — see project_value's schema comment.
    // Explicit .nullable() (not .optional()) so a caller must say which:
    // omitting the key by accident cannot silently mean "leave unchanged",
    // because this action always writes the WHOLE row, never a patch.
    contractValue: moneyInput.nullable(),
    subscriptionMonthly: moneyInput.nullable(),
    subscriptionFrom: isoDayInput.nullable(),
    subscriptionTo: isoDayInput.nullable(),
    currency: currencyInput,
  })
  .refine(
    (v) => v.subscriptionMonthly === null || v.subscriptionFrom !== null,
    { message: 'A subscription needs a start date', path: ['subscriptionFrom'] },
  )
  .refine(
    (v) => v.subscriptionTo === null || v.subscriptionFrom !== null,
    { message: 'An end date needs a start date too', path: ['subscriptionTo'] },
  )
  .refine(
    (v) => v.subscriptionTo === null || v.subscriptionFrom === null || v.subscriptionTo > v.subscriptionFrom,
    { message: 'The subscription must end after it starts', path: ['subscriptionTo'] },
  )

/**
 * Sets what a project is worth — contract value and/or subscription terms.
 *
 * TAKES THE WHOLE ROW, not a patch, the same discipline `updateWorklogEntry`
 * uses for the same reason: `subscriptionFrom`/`subscriptionTo`/
 * `subscriptionMonthly` are cross-checked together above, and a partial
 * update could leave a `subscriptionTo` on record after `subscriptionFrom`
 * was cleared, which is exactly the inconsistent state the refinements exist
 * to prevent.
 *
 * ONE ROW PER APP (project_value_app_idx), so this upserts on `app_id`
 * rather than insert-or-fail.
 */
export async function setProjectValue(
  raw: z.input<typeof setProjectValueInput>,
): Promise<ActionResult<void>> {
  const actor = await requireCapability('finance.view')
  if (!actor) return err('Not allowed')

  const parsed = setProjectValueInput.safeParse(raw)
  if (!parsed.success) return err(parsed.error.issues[0].message)
  const { appId, contractValue, subscriptionMonthly, subscriptionFrom, subscriptionTo, currency } =
    parsed.data

  try {
    const values = {
      appId,
      // numeric columns: string on the wire, deliberately, same as the rate
      // actions above — never a bare Number() at this boundary.
      contractValue: contractValue === null ? null : contractValue.toFixed(2),
      subscriptionMonthly: subscriptionMonthly === null ? null : subscriptionMonthly.toFixed(2),
      subscriptionFrom,
      subscriptionTo,
      currency,
      setBy: actor.id,
    }

    await db
      .insert(projectValue)
      .values(values)
      .onConflictDoUpdate({
        target: projectValue.appId,
        set: {
          contractValue: values.contractValue,
          subscriptionMonthly: values.subscriptionMonthly,
          subscriptionFrom: values.subscriptionFrom,
          subscriptionTo: values.subscriptionTo,
          currency: values.currency,
          setBy: values.setBy,
          updatedAt: new Date(),
        },
      })

    await logActivity({
      actorId: actor.id,
      verb: 'updated',
      entityType: 'project_value',
      entityId: appId,
      entityLabel: 'Project value',
      appId,
      // No contractValue/subscriptionMonthly here — see the file header.
      // Dates and currency are structural facts, not the figure itself.
      metadata: {
        hasContractValue: contractValue !== null,
        hasSubscription: subscriptionMonthly !== null,
        subscriptionFrom,
        subscriptionTo,
        currency,
      },
    })

    revalidatePath('/admin', 'layout')
    return ok(undefined)
  } catch (error) {
    return unexpected('setProjectValue', error)
  }
}
