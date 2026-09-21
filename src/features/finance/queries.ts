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
 * SUPPRESSION WAS A SECOND, SEPARATE GATE, layered under the capability — but
 * only for a viewer `requireCapability` had NOT already confirmed holds
 * `finance.view`. A cost total whose distinct-contributor count is below
 * `MIN_COST_CONTRIBUTORS` (cost.ts) lets `total ÷ hours` solve for that one
 * person's hourly rate — a real reconstruction of `rate_cards`/`person_rates`
 * for whoever DOESN'T already hold the capability gating those tables. An
 * admin who DOES hold `finance.view` is not such a reader: the same rate is
 * already theirs to read directly, so withholding the derived total from
 * them protected nothing and only made the figure look broken for the one
 * seat meant to see it. Every function below therefore resolves
 * `viewerSeesRates = can(actor, 'finance.view')` right after its own
 * `requireCapability` call — always `true` today, since nothing here is
 * reachable without it, but stated explicitly rather than assumed, so a
 * future caller that reaches `costForProject` through a weaker check inherits
 * the real answer instead of a silent `true`. `costForProject` in cost.ts is
 * the only place the suppression decision is made, and every function below
 * that touches cost routes through it (via `costFigureFor`) rather than
 * calling `costForEntries` directly. The contributor-count-zero case is
 * unaffected by any of this — see cost.ts, it was never a privacy rule.
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
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { personRates, projectValue, rateCards, users } from '@/db/schema'
import { liveApps, liveTasks, liveWorklogEntries } from '@/db/live'
import { requireCapability } from '@/features/auth/actor'
import { can } from '@/features/auth/capabilities'
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
    // LEFT, not INNER. An inner join to tasks meant a project's cost counted
    // only hours booked to a TASK — so every meeting about it, every review of
    // it and every production incident on it was free. In this workspace that
    // is almost the whole bill: nineteen of twenty people hold no task at all.
    .leftJoin(liveTasks, eq(liveWorklogEntries.taskId, liveTasks.id))
    .innerJoin(users, eq(liveWorklogEntries.userId, users.id))
    .where(and(
      // The entry's OWN app_id first, the task's app as the fallback — the
      // precedence migration 0050 states: a stored app_id survives the task
      // being deleted and must not move when a task is reassigned, so it wins
      // for historical figures. Rows written before 0050 have no app_id and
      // still resolve through their task.
      eq(sql`coalesce(${liveWorklogEntries.appId}, ${liveTasks.appId})`, appId),
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
 *
 * `viewerSeesRates` passes straight through to `costForProject` — see its
 * doc and the module header for why a `finance.view` holder skips the
 * single-contributor suppression instead of inheriting a default.
 */
function costFigureFor(
  entries: readonly AttributedTaskEntry[],
  roleRates: readonly RoleRate[],
  personRateRows: readonly PersonRate[],
  viewerSeesRates: boolean,
): ProjectCostResult {
  return costForProject(
    entries,
    (entry) => rateForPersonOnDay(roleRates, personRateRows, entry.title, entry.userId, entry.day),
    viewerSeesRates,
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
  // Always true here — `requireCapability` above already refused anyone who
  // doesn't hold it — but stated explicitly rather than assumed, so the
  // single-contributor guard below reads its own answer instead of a
  // hardcoded `true`. See the module header.
  const viewerSeesRates = can(actor, 'finance.view')

  assertIsoDayRange(from, to)

  const [entries, roleRates, personRateRows] = await Promise.all([
    loadTaskEntriesForApp(appId, from, to),
    loadRoleRates(),
    loadPersonRates(),
  ])

  return costFigureFor(entries, roleRates, personRateRows, viewerSeesRates)
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
 * SUPPRESSED only at zero contributors here — nobody has logged hours yet,
 * so there is no margin to state. `viewerSeesRates` above is always `true`
 * for the `finance.view` holder that already passed `requireCapability`, so
 * the `contributorCount < MIN_COST_CONTRIBUTORS` reconstruction guard in
 * `costForProject` never fires for this caller: margin releases even over a
 * single contributor, because that reader already holds the rate directly
 * (see the module header). The guard, and the reconstruction argument for
 * it, stays live only for a future caller that passes `viewerSeesRates:
 * false`.
 */
export async function projectMargin(
  appId: string,
  from: string,
  to: string,
): Promise<ProjectMarginResult> {
  const actor = await requireCapability('finance.view')
  if (!actor) return { state: 'denied' }
  // Same reasoning as projectCost — see the module header.
  const viewerSeesRates = can(actor, 'finance.view')

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

  const costResult = costFigureFor(entries, roleRates, personRateRows, viewerSeesRates)
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
 * IT NO LONGER READS ~100% 'task'. That was true while the only route from an
 * entry to a project was its `task_id`, and the note here called it a schema
 * gap rather than a bug. Migration 0050 closed the gap: `worklog_entries`
 * carries its own `app_id`, so a meeting about a project, a review of it or an
 * incident on it is attributable — which is the whole reason the categories
 * exist. A mix that could only ever say 'task' was measuring the join, not the
 * work.
 */
export async function effortMix(appId: string, from: string, to: string) {
  const actor = await requireCapability('app.view', { appId })
  if (!actor) return { state: 'denied' as const }

  assertIsoDayRange(from, to)

  const rows = await db
    .select({ minutes: liveWorklogEntries.minutes, category: liveWorklogEntries.category })
    .from(liveWorklogEntries)
    .leftJoin(liveTasks, eq(liveWorklogEntries.taskId, liveTasks.id))
    .where(and(
      eq(sql`coalesce(${liveWorklogEntries.appId}, ${liveTasks.appId})`, appId),
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
  | { appId: string; appName: string; state: 'suppressed'; contributorCount: number; hours: number }
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
 * EACH ROW IS SUPPRESSED INDEPENDENTLY, for a viewer that does not hold
 * `finance.view`. A portfolio table is exactly the shape such a reader could
 * use to hunt for the one project with a single contributor and read their
 * rate off it — suppression has to apply per row, not once for the whole
 * table, or that project's row would be the leak the rest of the table was
 * protected from. It buys nothing against the actual reader of this page,
 * though: `AdminInsightsPage` already 404s anyone without `finance.view`
 * (src/app/(app)/admin/insights/page.tsx), so `viewerSeesRates` below is
 * always `true` here too, and a one-contributor project's real cost renders
 * — the same rate that admin could already read straight off the rate card.
 */
export async function portfolioCost(from: string, to: string): Promise<PortfolioCostResult> {
  const actor = await requireCapability('finance.view')
  if (!actor) return { state: 'denied' }
  // Same reasoning as projectCost/projectMargin — see the module header.
  const viewerSeesRates = can(actor, 'finance.view')

  assertIsoDayRange(from, to)

  const [entryRows, appRows, roleRates, personRateRows] = await Promise.all([
    db
      .select({
        // Same precedence as the single-project read: the entry's own app_id
        // wins, the task's app is the fallback for rows written before 0050.
        appId: sql<string | null>`coalesce(${liveWorklogEntries.appId}, ${liveTasks.appId})`,
        userId: liveWorklogEntries.userId,
        day: liveWorklogEntries.day,
        minutes: liveWorklogEntries.minutes,
        title: users.title,
      })
      .from(liveWorklogEntries)
      .leftJoin(liveTasks, eq(liveWorklogEntries.taskId, liveTasks.id))
      .innerJoin(users, eq(liveWorklogEntries.userId, users.id))
      .where(and(gte(liveWorklogEntries.day, from), lt(liveWorklogEntries.day, to))),
    db.select({ id: liveApps.id, name: liveApps.name }).from(liveApps),
    loadRoleRates(),
    loadPersonRates(),
  ])

  const entriesByApp = new Map<string, AttributedTaskEntry[]>()
  for (const row of entryRows) {
    // Admin and learning time legitimately belongs to no project — 0050 made
    // app_id nullable for exactly that reason. Such a row is not free work
    // hidden in a project's total; it is simply not this table's subject.
    if (!row.appId) continue
    const bucket = entriesByApp.get(row.appId)
    if (bucket) bucket.push(row)
    else entriesByApp.set(row.appId, [row])
  }

  const rows: PortfolioCostRow[] = appRows.map((app) => {
    const figure = costFigureFor(entriesByApp.get(app.id) ?? [], roleRates, personRateRows, viewerSeesRates)
    return figure.state === 'suppressed'
      ? {
          appId: app.id,
          appName: app.name,
          state: 'suppressed',
          contributorCount: figure.contributorCount,
          hours: figure.hours,
        }
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
