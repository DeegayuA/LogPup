/**
 * Reads for project cost, worth, margin and effort — the fetching half of the
 * split `cost.ts` documents: this file assembles rows from the database and
 * hands them to the pure maths there; nothing here decides what a number
 * means, only what rows go in.
 *
 * EVERY QUERY THAT CAN RETURN MONEY GATES ON `finance.view` ITSELF, inside
 * this file, rather than trusting a caller to have checked first. That is NOT
 * how most of this codebase's `queries.ts` files work — apps/queries.ts,
 * bugs/queries.ts and friends assume the page already resolved the actor and
 * only fetch. Money is the deliberate exception: docs/superpowers/specs/
 * 2026-08-20-project-cost-and-worth-design.md is explicit that "a rate hidden
 * behind a capability but reconstructible from an unguarded total is not
 * hidden", and the only way that stays true for every FUTURE caller — not
 * just the ones that remember to check first — is for the gate to live where
 * the money does. `projectCost`, `projectWorth`, `projectMargin` and
 * `portfolioCost` all call `requireCapability('finance.view')` before they
 * touch a row, and all four return a `'denied'` state rather than throwing —
 * the same "tell the caller, don't crash the page" contract `requireCapability`
 * already gives every server action in this repo.
 *
 * NO SCOPED ARM, ANYWHERE IN THIS FILE. `finance.view` grants only 'none' or
 * 'all' (capabilities.ts) — there is no per-app narrowing to check, and this
 * file must never grow one. A manager running a project does not thereby see
 * what their team is paid; widening any function below to accept "or scoped
 * to appId" would grant exactly that.
 *
 * `effortMix` is the one exception, on purpose: it carries no money, so it is
 * gated on `app.view` instead — whatever already gates reading a project —
 * and needs neither a rate card nor the contributor-count guard below.
 *
 * SUPPRESSION IS A SECOND, SEPARATE GATE, layered under the capability. Even
 * an admin who holds `finance.view` cannot be handed a cost total whose
 * distinct-contributor count is below `MIN_COST_CONTRIBUTORS` (cost.ts) — a
 * project with one person on it, or a date range only one person logged in,
 * makes `total ÷ hours` that person's hourly rate. `costForProject` in
 * cost.ts is the only place that decision is made, and every function below
 * that touches cost routes through it rather than calling `costForEntries`
 * directly.
 *
 * A KNOWN, DELIBERATE LIMITATION: `worklog_entries` (migration 0047) carries
 * no `app_id` — only `task_id`, present exclusively on `category = 'task'`
 * rows (the category/task rule in worklog/entries.ts, which this file does
 * not import from but must still honour when reading the table it enforces).
 * Every query below that scopes to one project can therefore only ever see
 * TASK-LINKED hours: a meeting, a review, or an admin afternoon spent on a
 * project's work but logged under a non-task category is invisible to
 * `projectCost`, `projectMargin` and `effortMix` alike, because nothing on
 * that row says which project it was for. This is a gap in what the schema
 * can currently say, not a bug in this file — and it means `effortMix(appId,
 * …)` reads as ~100% 'task' for as long as the gap stands. Worth surfacing to
 * whoever builds a chart on top of this, not hiding behind a query that looks
 * complete.
 */
import { and, eq, gte, lt } from 'drizzle-orm'
import { db } from '@/db'
import { personRates, projectValue, rateCards, users } from '@/db/schema'
import { liveApps, liveTasks, liveWorklogEntries } from '@/db/live'
import { requireCapability } from '@/features/auth/actor'
import { isIsoDay, isoDayAdd } from '@/features/people/iso-day'
import {
  costForProject,
  effortMix as computeEffortMix,
  margin,
  rateForPersonOnDay,
  subscriptionAccrued,
  toAmount,
  type CostBreakdown,
  type PersonRate,
  type ProjectCostResult,
  type RoleRate,
  type SubscriptionAccrual,
  type SubscriptionValue,
} from '@/features/finance/cost'

/**
 * Malformed input here is a caller bug, not a user-facing case: every
 * exported function below is called with dates a server component already
 * derived from a picker or a known window, never raw request text. Matches
 * the throw-on-malformed convention `iso-day.ts` itself uses for the same
 * reason (`toUtcMidnight`) — a wrong-but-plausible date silently accepted
 * would be a worse failure than a loud one.
 */
function assertIsoDayRange(from: string, to: string): void {
  if (!isIsoDay(from) || !isIsoDay(to)) {
    throw new RangeError(`Not a valid ISO day range: ${from} .. ${to}`)
  }
}

/** Every rate this workspace has ever declared for a role — small, so fetched whole. */
async function loadRoleRates(): Promise<RoleRate[]> {
  return db
    .select({
      role: rateCards.role,
      hourly: rateCards.hourly,
      currency: rateCards.currency,
      effectiveFrom: rateCards.effectiveFrom,
      effectiveTo: rateCards.effectiveTo,
    })
    .from(rateCards)
}

/** Every person-level override this workspace has ever declared — same reasoning as loadRoleRates. */
async function loadPersonRates(): Promise<PersonRate[]> {
  return db
    .select({
      userId: personRates.userId,
      hourly: personRates.hourly,
      currency: personRates.currency,
      effectiveFrom: personRates.effectiveFrom,
      effectiveTo: personRates.effectiveTo,
    })
    .from(personRates)
}

/** One task-linked hour, attributed to who worked it and what they are called. */
type AttributedTaskEntry = {
  userId: string
  day: string
  minutes: number
  /** `users.title` — the free-text role rate_cards prices by. Null: not priceable except by a person override. */
  title: string | null
}

/**
 * Task-linked worklog rows for one project — see the module header's note on
 * why non-task categories can never appear here.
 *
 * THROUGH `liveWorklogEntries` AND `liveTasks`, never the raw tables: a
 * trashed task's hours must vanish from a cost total the same instant they
 * vanish from the board, and `live.test.ts` fails this file if it ever reads
 * either table directly.
 */
async function loadTaskEntriesForApp(
  appId: string,
  from: string,
  to: string,
): Promise<AttributedTaskEntry[]> {
  return db
    .select({
      userId: liveWorklogEntries.userId,
      day: liveWorklogEntries.day,
      minutes: liveWorklogEntries.minutes,
      title: users.title,
    })
    .from(liveWorklogEntries)
    .innerJoin(liveTasks, eq(liveWorklogEntries.taskId, liveTasks.id))
    .innerJoin(users, eq(liveWorklogEntries.userId, users.id))
    .where(and(
      eq(liveTasks.appId, appId),
      gte(liveWorklogEntries.day, from),
      lt(liveWorklogEntries.day, to),
    ))
}

/**
 * Rows in, a gated cost figure out. The one place this file turns worklog
 * rows into money — every caller below goes through this rather than calling
 * `costForProject`/`rateForPersonOnDay` inline, so the rate-resolution rule
 * (the role or person rate IN FORCE ON THE DAY the entry was logged, never
 * today's) cannot drift between `projectCost`, `projectMargin` and
 * `portfolioCost`.
 */
function costFigureFor(
  entries: readonly AttributedTaskEntry[],
  roleRates: readonly RoleRate[],
  personRateRows: readonly PersonRate[],
): ProjectCostResult {
  return costForProject(
    entries,
    (entry) => rateForPersonOnDay(roleRates, personRateRows, entry.title, entry.userId, entry.day),
  )
}

// ---------------------------------------------------------------------------
// projectCost
// ---------------------------------------------------------------------------

export type ProjectCostQueryResult = { state: 'denied' } | ProjectCostResult

/**
 * Hours, cost, unpriced-entry count and contributor count for one project
 * over `[from, to)` — task-linked hours only, see the module header.
 *
 * Each entry is priced against the rate in force on THE DAY it was logged
 * (`rateForPersonOnDay`), never today's rate — a raise this week must not
 * re-price a project that closed last quarter.
 */
export async function projectCost(
  appId: string,
  from: string,
  to: string,
): Promise<ProjectCostQueryResult> {
  const actor = await requireCapability('finance.view')
  if (!actor) return { state: 'denied' }

  assertIsoDayRange(from, to)

  const [entries, roleRates, personRateRows] = await Promise.all([
    loadTaskEntriesForApp(appId, from, to),
    loadRoleRates(),
    loadPersonRates(),
  ])

  return costFigureFor(entries, roleRates, personRateRows)
}

// ---------------------------------------------------------------------------
// projectWorth
// ---------------------------------------------------------------------------

export type ProjectWorthFigure = {
  state: 'ok'
  /** Null only when the project has no `project_value` row at all — never inferred as a currency-less "0". */
  currency: string | null
  /** Null: no contract value stated. A genuine $0 contract is kept and distinguished from this. */
  contractValue: number | null
  /** Null: no subscription configured. Distinct from a subscription that has accrued zero months so far. */
  subscription: SubscriptionAccrual | null
}

export type ProjectWorthResult = { state: 'denied' } | ProjectWorthFigure

/**
 * What a project is worth AS OF `at` — contract value and subscription
 * accrual, returned SEPARATELY and never added: a fixed-price build and a
 * monthly retainer are different kinds of money, and a merged "worth" figure
 * is the two-numbers-under-one-name failure docs/kpi-inventory.md already
 * catalogues thirteen instances of.
 *
 * Subscription accrues from the subscription's own start through `at`
 * INCLUSIVE — `subscriptionAccrued`'s own `to` bound is exclusive, so this
 * passes `at` shifted one day forward to count a month that begins ON `at`.
 */
export async function projectWorth(appId: string, at: string): Promise<ProjectWorthResult> {
  const actor = await requireCapability('finance.view')
  if (!actor) return { state: 'denied' }
  if (!isIsoDay(at)) throw new RangeError(`Not a valid ISO day: ${at}`)

  const [row] = await db
    .select({
      contractValue: projectValue.contractValue,
      subscriptionMonthly: projectValue.subscriptionMonthly,
      subscriptionFrom: projectValue.subscriptionFrom,
      subscriptionTo: projectValue.subscriptionTo,
      currency: projectValue.currency,
    })
    .from(projectValue)
    .where(eq(projectValue.appId, appId))

  if (!row) return { state: 'ok', currency: null, contractValue: null, subscription: null }

  const value: SubscriptionValue = {
    subscriptionMonthly: row.subscriptionMonthly,
    subscriptionFrom: row.subscriptionFrom,
    subscriptionTo: row.subscriptionTo,
    currency: row.currency,
  }
  // `subscriptionAccrued`'s own `from` param narrows which months are kept,
  // independent of the subscription's real start — passing the subscription's
  // own start (or `at` as a harmless fallback when there is none, since a null
  // `subscriptionFrom` makes the call return null regardless) is what makes
  // this "everything accrued to date" rather than one narrower window.
  const subscription = subscriptionAccrued(value, row.subscriptionFrom ?? at, isoDayAdd(at, 1))

  return {
    state: 'ok',
    currency: row.currency,
    contractValue: toAmount(row.contractValue),
    subscription,
  }
}

// ---------------------------------------------------------------------------
// projectMargin
// ---------------------------------------------------------------------------

export type ProjectMarginFigure = {
  state: 'ok'
  contributorCount: number
  /** Check `cost.fullyPriced` before trusting either margin below — a partial cost makes a partial margin. */
  cost: CostBreakdown
  /** value − cost against the fixed-price contract. Null: no contract value stated, or cost has no amount. */
  againstContract: number | null
  /** value − cost against subscription earned over `[from, to)`. Null: no subscription earning here, or cost has no amount. */
  againstSubscription: number | null
}

export type ProjectMarginResult =
  | { state: 'denied' }
  | { state: 'suppressed'; contributorCount: number }
  | ProjectMarginFigure

/**
 * Margin for one project over `[from, to)`, against contract value and
 * against subscription earned in that SAME window — two honest numbers,
 * never summed into one, per `margin()`'s own contract in cost.ts.
 *
 * SUPPRESSED, not merely denied a number, when the underlying cost's
 * contributor count is below `MIN_COST_CONTRIBUTORS`: margin is `value −
 * cost`, and a reader who already knows `value` can solve for `cost` from
 * the margin alone — the exact reconstruction the cost gate exists to stop,
 * one subtraction away. Suppressing the cost figure and handing back the
 * margin anyway would not have suppressed anything.
 */
export async function projectMargin(
  appId: string,
  from: string,
  to: string,
): Promise<ProjectMarginResult> {
  const actor = await requireCapability('finance.view')
  if (!actor) return { state: 'denied' }

  assertIsoDayRange(from, to)

  const [entries, roleRates, personRateRows, valueRows] = await Promise.all([
    loadTaskEntriesForApp(appId, from, to),
    loadRoleRates(),
    loadPersonRates(),
    db
      .select({
        contractValue: projectValue.contractValue,
        subscriptionMonthly: projectValue.subscriptionMonthly,
        subscriptionFrom: projectValue.subscriptionFrom,
        subscriptionTo: projectValue.subscriptionTo,
        currency: projectValue.currency,
      })
      .from(projectValue)
      .where(eq(projectValue.appId, appId)),
  ])

  const costResult = costFigureFor(entries, roleRates, personRateRows)
  if (costResult.state === 'suppressed') {
    return { state: 'suppressed', contributorCount: costResult.contributorCount }
  }

  const row = valueRows[0]
  const contractValue = row ? toAmount(row.contractValue) : null
  const subscription = row
    ? subscriptionAccrued(
        {
          subscriptionMonthly: row.subscriptionMonthly,
          subscriptionFrom: row.subscriptionFrom,
          subscriptionTo: row.subscriptionTo,
          currency: row.currency,
        },
        from,
        to,
      )
    : null

  return {
    state: 'ok',
    contributorCount: costResult.contributorCount,
    cost: costResult.cost,
    againstContract: margin(contractValue, costResult.cost.amount),
    againstSubscription: margin(subscription?.amount ?? null, costResult.cost.amount),
  }
}

// ---------------------------------------------------------------------------
// effortMix — NO finance.view. Carries no money; gated on project reads.
// ---------------------------------------------------------------------------

/**
 * Share of task-linked minutes by category for one project over `[from,
 * to)` — the one figure in this file that needs no rate card and no
 * `finance.view`, gated instead on `app.view` (whatever already gates
 * reading a project).
 *
 * See the module header: only `category = 'task'` rows carry a `task_id`, so
 * only task-linked minutes can be attributed to a project at all today. This
 * will read as ~100% 'task' until `worklog_entries` can name a project on a
 * non-task row — a schema gap, not a bug here.
 */
export async function effortMix(appId: string, from: string, to: string) {
  const actor = await requireCapability('app.view', { appId })
  if (!actor) return { state: 'denied' as const }

  assertIsoDayRange(from, to)

  const rows = await db
    .select({ minutes: liveWorklogEntries.minutes, category: liveWorklogEntries.category })
    .from(liveWorklogEntries)
    .innerJoin(liveTasks, eq(liveWorklogEntries.taskId, liveTasks.id))
    .where(and(
      eq(liveTasks.appId, appId),
      gte(liveWorklogEntries.day, from),
      lt(liveWorklogEntries.day, to),
    ))

  return { state: 'ok' as const, mix: computeEffortMix(rows) }
}

export type EffortMixQueryResult = Awaited<ReturnType<typeof effortMix>>

// ---------------------------------------------------------------------------
// portfolioCost
// ---------------------------------------------------------------------------

export type PortfolioCostRow =
  | { appId: string; appName: string; state: 'suppressed'; contributorCount: number }
  | {
      appId: string
      appName: string
      state: 'ok'
      contributorCount: number
      hours: number
      cost: CostBreakdown
      unpricedEntryCount: number
    }

export type PortfolioCostResult = { state: 'denied' } | { state: 'ok'; rows: PortfolioCostRow[] }

/**
 * `projectCost`, for every live project at once — the admin-level portfolio
 * view. ONE pass over `worklog_entries`/`rate_cards`/`person_rates` rather
 * than one query per project, then grouped in memory: the tables involved are
 * workspace-sized, not per-project-sized, so fetching once and bucketing by
 * `appId` costs the same as the single-project query and avoids N round trips.
 *
 * EACH ROW IS SUPPRESSED INDEPENDENTLY. A portfolio table is exactly the
 * shape a reader could use to hunt for the one project with a single
 * contributor and read their rate off it — suppression has to apply per row,
 * not once for the whole table, or that project's row would be the leak the
 * rest of the table was protected from.
 */
export async function portfolioCost(from: string, to: string): Promise<PortfolioCostResult> {
  const actor = await requireCapability('finance.view')
  if (!actor) return { state: 'denied' }

  assertIsoDayRange(from, to)

  const [entryRows, appRows, roleRates, personRateRows] = await Promise.all([
    db
      .select({
        appId: liveTasks.appId,
        userId: liveWorklogEntries.userId,
        day: liveWorklogEntries.day,
        minutes: liveWorklogEntries.minutes,
        title: users.title,
      })
      .from(liveWorklogEntries)
      .innerJoin(liveTasks, eq(liveWorklogEntries.taskId, liveTasks.id))
      .innerJoin(users, eq(liveWorklogEntries.userId, users.id))
      .where(and(gte(liveWorklogEntries.day, from), lt(liveWorklogEntries.day, to))),
    db.select({ id: liveApps.id, name: liveApps.name }).from(liveApps),
    loadRoleRates(),
    loadPersonRates(),
  ])

  const entriesByApp = new Map<string, AttributedTaskEntry[]>()
  for (const row of entryRows) {
    const bucket = entriesByApp.get(row.appId)
    if (bucket) bucket.push(row)
    else entriesByApp.set(row.appId, [row])
  }

  const rows: PortfolioCostRow[] = appRows.map((app) => {
    const figure = costFigureFor(entriesByApp.get(app.id) ?? [], roleRates, personRateRows)
    return figure.state === 'suppressed'
      ? { appId: app.id, appName: app.name, state: 'suppressed', contributorCount: figure.contributorCount }
      : {
          appId: app.id,
          appName: app.name,
          state: 'ok',
          contributorCount: figure.contributorCount,
          hours: figure.hours,
          cost: figure.cost,
          unpricedEntryCount: figure.unpricedEntryCount,
        }
  })

  return { state: 'ok', rows }
}
