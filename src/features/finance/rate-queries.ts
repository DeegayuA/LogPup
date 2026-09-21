/**
 * Reads for the rates admin surface — role rates, person overrides, and
 * project value — the caller-side counterpart to `rate-actions.ts`. Types
 * live in `rate-intervals.ts`, not here, so a `'use client'` card can import
 * them without pulling this module's `@/db` value-import into the bundle.
 *
 * `requireCapability('finance.view')` is the FIRST STATEMENT of every
 * function body, before any row is touched — `queries.ts`'s own rule,
 * quoted from its header: "a rate hidden behind a capability but
 * reconstructible from an unguarded total is not hidden". The page that
 * calls these also 404s a non-`finance.view` actor before it renders, so a
 * 'denied' state here should never actually reach a viewer — it exists so a
 * future caller that reaches this file through a weaker check inherits the
 * refusal instead of a silent read.
 *
 * `listPersonRates` is the FIRST READER `person_rates` HAS EVER HAD.
 * `schema.ts`'s comment on that table is explicit that the table can exist
 * with no reader, but whoever adds the first one must add the gate in the
 * SAME change, not after it — this function and its gate ship together, now.
 *
 * Alphabetical/date ordering only, everywhere below — NEVER by amount, and
 * no aggregate of any kind. A sortable-by-amount column is the per-person
 * cost chart `schema.ts` forbids, with extra steps.
 */
import { asc, desc, eq, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import { assignments, personRates, projectValue, rateCards, users } from '@/db/schema'
import { liveApps } from '@/db/live'
import { requireCapability } from '@/features/auth/actor'
import type { PersonRateRow, ProjectValueRow, RoleRateRow } from '@/features/finance/rate-intervals'

export async function listRoleRates(): Promise<
  { state: 'ok'; rows: RoleRateRow[] } | { state: 'denied' }
> {
  const actor = await requireCapability('finance.view')
  if (!actor) return { state: 'denied' }

  const rows = await db
    .select({
      id: rateCards.id,
      role: rateCards.role,
      hourly: rateCards.hourly,
      currency: rateCards.currency,
      effectiveFrom: rateCards.effectiveFrom,
      effectiveTo: rateCards.effectiveTo,
      setByName: users.name,
    })
    .from(rateCards)
    // LEFT: the setter's account may have been removed since; the rate stays.
    .leftJoin(users, eq(rateCards.setBy, users.id))
    .orderBy(asc(rateCards.role), desc(rateCards.effectiveFrom))

  return { state: 'ok', rows }
}

export async function listPersonRates(): Promise<
  { state: 'ok'; rows: PersonRateRow[] } | { state: 'denied' }
> {
  const actor = await requireCapability('finance.view')
  if (!actor) return { state: 'denied' }

  // Two joins to `users` for two different people (the subject the rate is
  // for, and whoever set it), so each needs its own alias — a bare second
  // join to the same table would collide with the first.
  const subject = alias(users, 'rate_subject')
  const setter = alias(users, 'rate_setter')

  const rows = await db
    .select({
      id: personRates.id,
      userId: personRates.userId,
      personName: subject.name,
      hourly: personRates.hourly,
      currency: personRates.currency,
      effectiveFrom: personRates.effectiveFrom,
      effectiveTo: personRates.effectiveTo,
      setByName: setter.name,
    })
    .from(personRates)
    .innerJoin(subject, eq(personRates.userId, subject.id))
    .leftJoin(setter, eq(personRates.setBy, setter.id))
    .orderBy(asc(subject.name), desc(personRates.effectiveFrom))

  return { state: 'ok', rows }
}

export async function listProjectValues(): Promise<
  { state: 'ok'; rows: ProjectValueRow[] } | { state: 'denied' }
> {
  const actor = await requireCapability('finance.view')
  if (!actor) return { state: 'denied' }

  const rows = await db
    .select({
      appId: projectValue.appId,
      appName: liveApps.name,
      slug: liveApps.slug,
      contractValue: projectValue.contractValue,
      subscriptionMonthly: projectValue.subscriptionMonthly,
      subscriptionFrom: projectValue.subscriptionFrom,
      subscriptionTo: projectValue.subscriptionTo,
      currency: projectValue.currency,
      setByName: users.name,
      updatedAt: projectValue.updatedAt,
    })
    .from(projectValue)
    // Soft-deleted apps drop out here the same way every other money read in
    // this feature excludes them — `liveApps`, never the raw `apps` table.
    .innerJoin(liveApps, eq(projectValue.appId, liveApps.id))
    .leftJoin(users, eq(projectValue.setBy, users.id))
    .orderBy(asc(liveApps.name))

  return { state: 'ok', rows }
}

/**
 * Returns distinct active team members assigned to each live app.
 * Used by the project value form to suggest headcount for per-user subscription calculations.
 */
export async function listAppHeadcounts(): Promise<
  { state: 'ok'; counts: Record<string, number> } | { state: 'denied' }
> {
  const actor = await requireCapability('finance.view')
  if (!actor) return { state: 'denied' }

  const rows = await db
    .select({
      appId: assignments.appId,
      headcount: sql<number>`count(distinct ${assignments.userId})::int`,
    })
    .from(assignments)
    .innerJoin(liveApps, eq(assignments.appId, liveApps.id))
    .innerJoin(users, eq(assignments.userId, users.id))
    .where(eq(users.active, true))
    .groupBy(assignments.appId)

  const counts: Record<string, number> = {}
  for (const row of rows) {
    counts[row.appId] = Number(row.headcount) || 0
  }

  return { state: 'ok', counts }
}
