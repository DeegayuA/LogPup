# Work-Management Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the ⌘K enumeration leak, give `tasks` a `completed_at`, index the two tables every later spec hammers, and turn `notifications` from a bare insert into a deduped, filtered, rate-capped, render-at-read-time substrate with exactly one cron entry point — adding zero user-visible features.

**Architecture:** Reach in ⌘K becomes one pure `searchScopeFor(actor, action)` resolver over the existing capability matrix, consumed by the `ctx` the command registry already threads into every provider. Task status becomes one pure `transitionTaskStatus(to, now)` patch that all four status writers call, so `completed_at` cannot diverge. `createNotifications` becomes the single choke point: pure recipient filtering, a pure per-recipient daily cap, then inserts with `ON CONFLICT` against two partial unique indexes. Notification text stops being a frozen English sentence and becomes `title_key` + `params` rendered at read time. Everything periodic is an ordered step inside one route, `/api/cron/notify-tick`.

**Tech Stack:** Next.js 16.3 App Router (server components, server actions, route handlers), React 19, Drizzle ORM 0.45 on Postgres via `neon-http`, zod 4, vitest, Tailwind v4 tokens.

**Spec:** [docs/superpowers/specs/2026-08-20-work-substrate-design.md](../specs/2026-08-20-work-substrate-design.md)

## Global Constraints

- **No git worktrees. Work happens on `main`, in the MAIN WORKTREE**, concurrently with other agents implementing the four sibling specs and with Deeghayu's own session. **Re-read every file immediately before editing it** — the copy quoted in this plan may already have moved. Stage only the explicit paths a task names: never `git add -A`, `git commit -a`, `git reset --hard`, `git checkout -- .`, or `git stash`. If a file you are about to edit is dirty from someone else's work, **STOP and report** rather than overwriting.
- **Never run `drizzle-kit generate`** (`npm run db:generate`). The snapshot chain is broken; generate would re-create existing tables without `IF NOT EXISTS`. Hand-write the `.sql` **and** the `drizzle/meta/_journal.json` entry, modelled on `drizzle/0034_app_role_history.sql` — tab indentation inside `DO $$ … $$` blocks, `--> statement-breakpoint` between statements, replay-safe guards on every statement.
- **DO NOT ASSIGN A MIGRATION NUMBER IN ADVANCE.** Numbers are allocated **at merge time against then-current `main`**, because several parallel sessions claim the same next number at once. Every migration task below starts with a step that computes the next free number from what is on disk *at that moment* and writes the file under that name. Do not hardcode a number anywhere, including in a commit message.
- **Never edit an applied `.sql` file**, not even a comment — `db:status` compares sha256 against the ledger and an edited file reads "never applied" forever.
- **`--> statement-breakpoint` goes between statements, never inside a comment.** The splitter is a plain string split.
- **STOP before running any migration.** No migration runs against any database without explicit human approval. Verify applied state with `information_schema`, never the runner's exit code — `npm run db:migrate` has reported success while applying nothing.
- **No new dependencies.** No mail SDK, no i18n library, no date library beyond `date-fns` which is already present, no new palette, no raw hex — existing tokens only (`--muted-foreground`, `--destructive`, `--warning`, `--text-2xs`). **Adding a dependency is a STOP condition**; the digest transport is deliberately a seam that refuses (Task 23).
- **Soft-delete only** for user content. `notifications` gets `dismissed_at`, deliberately **not** `deletedAt`: `src/db/live.test.ts` check 5 fails the build for any schema table carrying a `deletedAt` that is not registered in `SOFT_TABLES`, and a notification is an ephemeral operational record, not trashable content. **`SOFT_TABLES` stays at exactly six members** (`apps`, `meetings`, `meeting_note_segments`, `meeting_screenshots`, `sprints`, `tasks`) in this plan. **Deleting any file is a STOP condition** — nothing in this plan removes a file.
- **`db.transaction()` does not exist** on `neon-http` (`src/db/index.ts`). The house idiom is `db.batch([...])` — see `src/features/people/actions.ts:337-354`. Every "same transaction" requirement below is one `db.batch`.
- **`logActivity()` swallows its own errors and issues its own insert** (`src/features/activity/log.ts`), so it can never be part of a batch.
- **Exactly one cron job.** LogPup is on Vercel Hobby: two cron jobs, daily granularity. `vercel.json` declares `/api/cron/backup` today; this plan adds `/api/cron/notify-tick` and that is the last one. A second periodic concern becomes an ordered step inside that route, never a second job. This is written into the route's own comment.
- **Server-side enforcement only.** `visible(ctx)` on a palette row is presentation and never a permission check; the server action behind every hit re-gates independently. Scope filtering here is about what the *index returns*.
- **A surface a seat cannot see returns a per-route 404, not a refusal.** Do not use `forbidden()` / `unauthorized()` from `next/navigation` — both are experimental in Next 16.3 and need `experimental.authInterrupts`. Routes deny with `notFound()`; server actions return the existing `ActionResult` refusal shape from `src/lib/action-result.ts` (`ok`, `err` — those are its only exports).
- **Colour is never the only signal.** Every state paints a word beside its colour (WCAG 1.4.1).
- **All day math is Asia/Colombo** via `toIsoDateInTimeZone(date, LK_TIMEZONE)` from `src/lib/lk-holidays.ts` (`LK_TIMEZONE = 'Asia/Colombo'`, a fixed +05:30 offset with no DST). Never a private weekday check, never UTC slicing.
- **This repo has zero component tests.** `vitest.config.ts` is `test: { include: ['src/**/*.test.ts'] }` — **`.tsx` is NOT matched.** Every test in this plan is a `.ts` file, uses `vitest` imports explicitly (no globals), and imports the module under test by **relative** path. Do not introduce React Testing Library. `.tsx` changes are verified by `tsc`, lint, tests, build and a manual pass.
- **`vitest.config.ts` aliases `@` to `./src`,** so a test may import shared modules as `@/db/schema`; a `vi.mock()` path must match the specifier the *source file* uses (`@/db`, `@/lib/auth`), never a relative rewrite of it.
- **Commands:** test `npm test`, lint `npm run lint`, build `npm run build`, types `npx tsc --noEmit`, migration status `npm run db:status`.
- **Do not touch, and touching any of them is a STOP condition:** `.env*`, `package.json`, the lockfile, CI config, `src/lib/auth.ts` **sign-in behaviour** (this plan never changes who can sign in, how, or what a session carries), `src/app/api/cron/backup/route.ts`, `src/features/transcription/**`, `src/features/speech/**`, `node_modules/**`. **Anything outside the file lists in the tasks below is out of scope — STOP and report rather than widening the diff.**

## Decisions this plan is built on

Each one changes the code, so each is stated here rather than buried in a task.

| # | Decision | Consequence |
|---|---|---|
| 1 | ⌘K reach is **the capability matrix's answer**, resolved through `effectiveGrant`, not a new mechanism | Widening or narrowing ⌘K is a one-line edit in `capabilities.ts` with a test, not a search change. |
| 2 | `PaletteContext` **stops extending** `SearchContext` | `SearchContext` gains a server-resolved `Actor`; the client palette must never be handed one. Two contexts, two audiences. |
| 3 | `transitionTaskStatus(to, now)` takes **only the destination** | `completed_at` is a function of the destination alone, so `bulkUpdateTasks` — which never reads each row's current status — uses the identical helper instead of a second code path. |
| 4 | `NewNotification.type` stays, **optional**, alongside the new `kind` | All six existing call sites compile through Task 17 unchanged and are converted deliberately in Task 18, rather than in the same diff that rewrites the writer. |
| 5 | The per-recipient daily cap lives **inside `createNotifications`** | It is the only choke point that survives specs B, C and every future kind. Overflow **collapses into ONE row, never dropped silently**. |
| 6 | `system.overflow` is the **only** kind this plan creates | It is not a kind any call site may emit — the cap itself produces it. The spec's "zero new notification kinds" is about kinds *features* can spend; this one is the mechanism's own pressure valve and is exempt from the budget table. |
| 7 | `digestEligible()` reads `calendarSyncState` **from day one**, as an OPTIONAL field | The column arrives in spec E. Until then it is `undefined` and the helper degrades to the id-only rule with zero behaviour change — so the spec's `'failed'` test is a *passing* test today, not a pending one, and spec E's change is "nothing" rather than "one line nobody re-reads". |
| 8 | Two of the spec's indexes are **not in this plan** | `tasks (app_id, kind, status)` needs `tasks.kind` and `meeting_followups (user_id, status, due_date)` needs `meeting_followups.due_date` — verified absent from `schema.ts`. **Spec C owns both, with C's definitions, in the same migration as the columns they key.** `meeting_followups` therefore stays unindexed until C ships. An index this plan cannot create is not a cost it can avoid. |
| 9 | The digest **ships as a no-op that logs** | Its transport is a seam returning a typed refusal until a verified sending domain and a mail dependency exist. Adding either is a STOP condition. |
| 10 | Retention pruning is a **hard delete**, registered in `DELETE_ALLOWED_FUNCTIONS` | `notifications` is not a soft-deleted table and must not become one; `live.test.ts` check 4 confines `db.delete(` to named functions, so the exemption is an explicit, reviewed edit with its reason in the file. |
| 11 | The spec's five migrations become **six**, and the index migration splits | The spec's step 2 says "the four indexes … every column they name exists today", but the bell-poll index's predicate is `WHERE dismissed_at IS NULL` and `dismissed_at` arrives in step 3. So: the two indexes naming only today's columns ship early (Task 10), and the three naming new columns ship after them (Task 16). The dedupe uniques stay a **separate file** inside Task 16, exactly as the spec requires, because they can fail on pre-existing duplicate rows and must be diagnosable in isolation. |

## Toolchain facts this plan relies on, each verified against the tree

- `notifications` has **zero indexes** — `drizzle/0005` creates the table, three foreign keys and nothing else. The comment at `src/features/notifications/actions.ts:26` claiming "two indexed queries" is false today and Task 16 makes it true.
- `src/db/index.ts` is `drizzle-orm/neon-http`. **`db.transaction()` does not exist.**
- `can()` (`src/features/auth/capabilities.ts:295`) is pure, sync, and **fails closed**: a `scoped` action asked without a resource is a denial. To distinguish `scoped` from `none` without a resource you must call `effectiveGrant(role, employmentType, action)`, exported from the same module (`:247`).
- `loadActor()` (`src/features/auth/actor.ts:27`) is wrapped in React `cache` and issues ONE scope query per request, choosing its source from `scopeSourceFor(role)`: `app_role_history` (manager, open rows with role in `pm`/`lead`), `assignments` (editor, member), `app_grants` (stakeholder), none (superadmin, admin, auditor).
- `ROLE_GRANTS` already contains every action this plan asks for: `app.view`, `user.view.directory`, `meeting.intel.view`, `admin.view`.
- `src/db/live.test.ts` check 4 confines `db.delete(` **per file** to the function names in `DELETE_ALLOWED_FUNCTIONS`, keyed on the **enclosing function name** parsed by `functionSpan`, which matches `function <name>(`. A delete inside an arrow function assigned to a const will **not** match — `pruneNotifications` must be a `function` declaration.
- `src/db/live.test.ts` check 5 reflects over `schema` for any table with a `deletedAt` column and fails if it is not in `SOFT_TABLES`. This is exactly why the new column is `dismissed_at`.
- `MEETING_CHILD_TABLES` includes `meetingApps`, and `src/features/meetings/search-providers.ts:67-68` already `leftJoin`s it literally through `liveMeetings`. Task 5 adds a predicate on that same join and introduces no new table read.
- `drizzle-orm@0.45` supports `onConflictDoUpdate({ target, targetWhere, set })` and `onConflictDoNothing({ target, where })`; `targetWhere` is what makes a **partial** unique index inferrable.
- `src/features/sprints/board-view.ts` is a pure module with no `'use client'` and already exports `TASK_STATUSES` and `TaskStatus`. `src/features/sprints/task-actions.ts:20-21` declares a private duplicate; Task 8 deletes the duplicate and imports the shared one.
- `src/features/sprints/task-actions.test.ts` already exists with a mocked-`db` harness whose `update(...).set(...).where()` returns `{ returning }` **with no `then`** — `updateTask` and `moveTaskOnBoard` await that call directly, so the harness must gain a thenable before Task 8's tests can run.
- `src/lib/action-result.ts` exports only `ActionResult`, `ok`, `err`. `unexpected()` and `isForeignKeyViolation()` are file-local to `task-actions.ts`.
- `src/features/admin/change-request-appliers.ts:58-66` is `db.update(table).set(after).where(eq(table.id, entityId))` — a generic spread — and `'task'` is in `SUPPORTED_ENTITY_TYPES` at `:17`. This is the fourth status writer.
- `src/features/admin/sections.ts` is the ONE list both the admin nav and the route guards read.
- `vercel.json` declares exactly one cron today: `/api/cron/backup` at `0 3 * * *`.
- `src/lib/lk-holidays.ts` exports `LK_TIMEZONE` (`:90`) and `toIsoDateInTimeZone(date, timeZone = LK_TIMEZONE)` (`:99`).
- `drizzle/meta/_journal.json` is `{ version, dialect, entries: [{ idx, version: "7", when, tag, breakpoints: true }] }`, 2-space indented, with a trailing newline. Entry `when` values increase by 100000 per migration in recent history.

## The notification volume budget

The ceiling was prose in spec B, referenced by no other spec. **It moves here, into the substrate, and becomes a mechanism.**

**At most 5 immediate in-app notifications per person per weekday.**

| Spec | Kind | Recipient | Dedupe | Declared rows/person/weekday |
|---|---|---|---|---|
| **A (this plan)** | `mention` | mentioned person | collapsing | 1.0 |
| **A (this plan)** | `meeting` | attendee | collapsing | 0.5 |
| **A (this plan)** | `legacy` | pre-substrate rows | none | 0 |
| **A (this plan)** | `system.overflow` | the capped person | collapsing | **exempt — the cap's own valve** |
| B | its four kinds | — | — | B's plan writes its own rows before its kinds ship |
| C | its four kinds | — | — | C's plan writes its own rows before its kinds ship |
| D | none | — | — | adds volume to B's `task.offered`, priced there |
| E | none | — | — | 0 |
| **Ceiling** | — | — | — | **5, enforced in `createNotifications`** |

`mention` and `meeting` are the two kinds that exist today; declaring them here is what makes the remaining headroom (3.5) a real number rather than the whole 5. Spec B's `mention` row IS this row — it is not counted twice.

Two things make the table real rather than decorative:

1. `NOTIFICATION_DAILY_CAP = 5`, enforced per recipient inside `createNotifications`. Overflow does not vanish — it collapses into one `system.overflow` row per recipient per Colombo day whose `collapse_count` is the number suppressed.
2. `budget.test.ts` fails the build when a kind exists with no `KIND_BUDGET` row, and when the declared budgets sum above the ceiling. A later spec cannot ship a kind without costing it.

## File structure

**⌘K reach** — pure resolver, then four provider files.

| File | Responsibility |
|---|---|
| `src/features/search/registry/scope.ts` | `SearchScope`, `searchScopeFor(actor, action)`. Pure, no db. |
| `src/features/search/registry/scope.test.ts` | Every seat × every search action. |
| `src/features/search/registry/types.ts` | `SearchContext` gains `actor`; `PaletteContext` stops extending it. |
| `src/features/search/actions.ts` | `universalSearch` loads the actor and threads it. |
| `src/features/search/actions.test.ts` | The actor is threaded; a null actor returns nothing. |
| `src/features/{apps,people,sprints,meetings}/search-providers.ts` | Each consumes `ctx`. |
| `src/features/{apps,people,sprints,meetings}/search-providers.test.ts` | Per-provider scope assertions. |

**Task completion**

| File | Responsibility |
|---|---|
| `src/features/sprints/task-status.ts` | `transitionTaskStatus(to, now)`, `isTaskStatus`. Pure. |
| `src/features/sprints/task-status.test.ts` | The patch, both directions, every status. |
| `src/features/sprints/task-actions.ts` | Three status writers call it. Private `TASK_STATUSES` deleted. |
| `src/features/sprints/task-actions.test.ts` | Harness gains a thenable; three call-path assertions added. |
| `src/features/admin/change-request-appliers.ts` | The fourth door: a task-specific applier. |
| `src/features/admin/change-request-appliers.test.ts` | An approved `status: 'done'` stamps `completed_at`. |

**Notification substrate**

| File | Responsibility |
|---|---|
| `src/features/notifications/kinds.ts` | `NOTIFICATION_KINDS`, `NotificationKind`, `isNotificationKind`. Pure. |
| `src/features/notifications/text.ts` | `NotificationParams`, `NOTIFICATION_TEXT`, `renderNotification`. Pure. |
| `src/features/notifications/budget.ts` | `NOTIFICATION_DAILY_CAP`, `KIND_BUDGET`, `applyDailyCap`. Pure. |
| `src/features/notifications/dedupe.ts` | Key builders and `dedupeOutcome`. Pure. |
| `src/features/notifications/recipients.ts` | `selectRecipients`, `DropReason`, `REACH_ACTION`. Pure. |
| `src/features/notifications/notify.ts` | `createNotifications` — the choke point. The only impure part. |
| `src/features/notifications/queries.ts` | Reads `title_key`/`params`/`collapse_count`, resolves ids to names, degrades a dead entity. |
| `src/features/notifications/retention.ts` | `pruneNotifications` — the one hard delete. |
| `src/features/notifications/digest.ts` | `digestEligible`, `assembleDigest`. Pure. |
| `src/features/notifications/digest-transport.ts` | The send seam. Returns a typed refusal until a domain exists. |
| `src/features/notifications/digest-step.ts` | `runDigestStep` — reads, sends, marks, in one batch. |
| `src/features/notifications/tick.ts` | `runNotifyTick` — the ordered steps, testable without the route. |
| `src/features/notifications/digest-queries.ts` | `listDigestFailures` for the admin surface. |
| `src/lib/cron-auth.ts` | `isCronAuthorized(request)`, constant-time. |
| `src/app/api/cron/notify-tick/route.ts` | The one new cron entry point. Thin wrapper over `runNotifyTick`. |
| `src/app/(app)/admin/notifications/page.tsx` | Delivery-failure surface. |

**Modified elsewhere**

| File | Change |
|---|---|
| `src/db/schema.ts` | `tasks.completedAt` + one index, ten `notifications` columns + five indexes, `apps.internal`. |
| `src/db/live.test.ts` | One `DELETE_ALLOWED_FUNCTIONS` entry for `pruneNotifications`. |
| `src/features/admin/sections.ts` | One section entry. |
| `src/features/notifications/actions.ts` | Snapshot carries the rendered text. |
| `src/features/notifications/components/notification-bell-client.tsx` | Renders `kind`, rendered text, collapse count, unavailable state. |
| `src/features/apps/comment-actions.ts`, `src/features/meetings/actions.ts`, `src/features/meetings/ai-actions.ts` | Write `titleKey` + `params` instead of frozen sentences. |
| `vercel.json` | One cron entry. |
| `drizzle/*.sql`, `drizzle/meta/_journal.json` | Six migrations, numbered at merge time. |

---

# BUILD ORDER

The spec fixes it and this plan follows it exactly:

1. **⌘K scope filtering — Tasks 1-5. BLOCKING.** A client seat is weeks away and the leak is live today. Nothing else in this plan may start until Task 5 is committed and green.
2. `tasks.completed_at` plus the `transitionTaskStatus` consolidation — Tasks 6-9.
3. The indexes — Task 10 (and Task 16 for the ones that name new columns).
4. Notification substrate: columns, dedupe, filtering inside `createNotifications` — Tasks 11-19.
5. `/api/cron/notify-tick`, with retention pruning as its only step — Tasks 20-21.
6. Digest, gated on the verified domain and the failure surface — Tasks 22-23.

Task 24 (`apps.internal`) and Task 25 (verification) close it out.

---

### Task 1: `searchScopeFor` — the pure reach resolver

**BLOCKING. This is build-order item 1.** `SearchContext` is threaded into all four `search-providers.ts` files and not one of them reads it — `grep -n 'ctx\.' src/features/*/search-providers.ts` returns nothing. `universalSearch` gates only on signed-in-and-approved, so a stakeholder with a login can type three letters and enumerate the entire portfolio.

This file is the whole fix's foundation and it introduces **no new mechanism**. It asks `effectiveGrant`, which is the same function `can()` asks, so widening or narrowing ⌘K is an edit to `ROLE_GRANTS` and nothing else.

`can()` cannot be used directly here: it fails closed, so a resource-free `can()` answers `true` only for a grant of `all` and cannot tell `scoped` apart from `none`. `effectiveGrant` returns the level itself, which is exactly the question an index filter asks.

**Files:**
- Create: `src/features/search/registry/scope.ts`
- Test: `src/features/search/registry/scope.test.ts`

**Interfaces:**
- Consumes: `effectiveGrant`, `type Action`, `type Actor`, `type UserRole` from `src/features/auth/capabilities.ts`.
- Produces: `type SearchScope = { kind: 'none' } | { kind: 'all' } | { kind: 'apps'; appIds: ReadonlySet<string> }`, `function searchScopeFor(actor: Actor, action: Action): SearchScope`, `const SEARCH_ACTIONS`.

- [ ] **Step 1: Write the failing test**

Create `src/features/search/registry/scope.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { USER_ROLES, type Actor, type UserRole } from '@/features/auth/capabilities'
import { SEARCH_ACTIONS, searchScopeFor } from './scope'

const actor = (role: UserRole, over: string[] = []): Actor => ({
  id: 'actor-1',
  role,
  scopeAppIds: new Set(over),
})

describe('searchScopeFor', () => {
  it('gives a superadmin the whole workspace for every search action', () => {
    for (const action of SEARCH_ACTIONS) {
      expect(searchScopeFor(actor('superadmin'), action)).toEqual({ kind: 'all' })
    }
  })

  it('gives an admin the whole workspace for every search action', () => {
    for (const action of SEARCH_ACTIONS) {
      expect(searchScopeFor(actor('admin'), action)).toEqual({ kind: 'all' })
    }
  })

  it('narrows a stakeholder to exactly the apps they were granted', () => {
    const scope = searchScopeFor(actor('stakeholder', ['app-a']), 'app.view')
    expect(scope).toEqual({ kind: 'apps', appIds: new Set(['app-a']) })
  })

  it('refuses a stakeholder the people directory outright', () => {
    // stakeholder holds `none` on user.view.directory — a client seat must not
    // be able to read the studio's address book out of the palette.
    expect(searchScopeFor(actor('stakeholder', ['app-a']), 'user.view.directory'))
      .toEqual({ kind: 'none' })
  })

  it('gives a member the whole directory but only their own apps', () => {
    expect(searchScopeFor(actor('member', ['app-a']), 'user.view.directory'))
      .toEqual({ kind: 'all' })
    expect(searchScopeFor(actor('member', ['app-a']), 'app.view'))
      .toEqual({ kind: 'apps', appIds: new Set(['app-a']) })
  })

  it('treats an empty scope set as none, never as an empty IN () list', () => {
    // inArray(col, []) is not a filter anyone should have to reason about.
    // A scoped seat with no apps reaches nothing, and the caller gets to
    // return early instead of building a query.
    expect(searchScopeFor(actor('stakeholder', []), 'app.view')).toEqual({ kind: 'none' })
    expect(searchScopeFor(actor('editor', []), 'meeting.intel.view')).toEqual({ kind: 'none' })
  })

  it('honours the employment cap by asking effectiveGrant, not ROLE_GRANTS', () => {
    // No employment stage caps a search action today, so a trainee manager
    // still reaches everything they would otherwise reach. The assertion
    // exists so a future cap on one of these actions cannot slip past ⌘K.
    const trainee: Actor = {
      id: 'actor-2',
      role: 'manager',
      scopeAppIds: new Set(['app-a']),
      employmentType: 'trainee',
    }
    expect(searchScopeFor(trainee, 'app.view')).toEqual({ kind: 'all' })
  })

  it('answers every seat for every search action without throwing', () => {
    for (const role of USER_ROLES) {
      for (const action of SEARCH_ACTIONS) {
        const scope = searchScopeFor(actor(role, ['app-a']), action)
        expect(['none', 'all', 'apps']).toContain(scope.kind)
      }
    }
  })

  it('names exactly the four actions the four provider files ask', () => {
    expect([...SEARCH_ACTIONS]).toEqual([
      'app.view',
      'user.view.directory',
      'meeting.intel.view',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/search/registry/scope.test.ts`
Expected: FAIL with `Error: Failed to load url ./scope (resolved id: ./scope) ... Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/search/registry/scope.ts`:

```ts
import { effectiveGrant, type Action, type Actor } from '@/features/auth/capabilities'

/**
 * What a search provider is allowed to return.
 *
 * THE DEFERRED WORK THE COMMAND REGISTRY NAMED. The registry spec
 * (2026-08-19-command-registry-design.md) said the provider refactor "does add
 * the seam where a future scope filter would hang" and named a `scope` field
 * on SearchProvider as deferred. This is that work, and it deliberately
 * introduces NO competing mechanism: every answer here comes from the same
 * ROLE_GRANTS table `can()` reads, so widening ⌘K is an edit to capabilities.ts
 * with a test, not a search change.
 *
 * `can()` cannot answer this question. It fails closed — a `scoped` grant
 * asked without a concrete resource is a denial — so a resource-free `can()`
 * says true only for `all` and cannot tell `scoped` from `none`. An index
 * filter needs the LEVEL, which is what effectiveGrant returns.
 *
 * This is about what the index RETURNS, which is a different failure from what
 * a command renders: a hit whose title leaks a client's project name has
 * already done the damage even if clicking it 404s.
 */
export type SearchScope =
  | { kind: 'none' }
  | { kind: 'all' }
  | { kind: 'apps'; appIds: ReadonlySet<string> }

/**
 * The actions the four provider files ask, in provider rank order:
 * apps/tasks/sprints ask app.view, people asks user.view.directory, meetings
 * asks meeting.intel.view. Listed so scope.test.ts can sweep every seat
 * against every one of them and so a fifth provider has an obvious home.
 */
export const SEARCH_ACTIONS = [
  'app.view',
  'user.view.directory',
  'meeting.intel.view',
] as const satisfies readonly Action[]

export function searchScopeFor(actor: Actor, action: Action): SearchScope {
  const level = effectiveGrant(actor.role, actor.employmentType, action)
  if (level === 'none') return { kind: 'none' }
  if (level === 'all') return { kind: 'all' }

  /**
   * `own` and `scoped` collapse to the same answer, deliberately. ⌘K asks
   * about reach over a SET of rows before any row has been chosen, and there
   * is no per-row owner to compare against at index time — an `own` grant
   * with no resource is a denial everywhere else in this codebase, and the
   * app scope is the only honest generalisation of it here.
   *
   * An empty scope set returns `none` rather than an empty app list, so no
   * caller ever has to build `inArray(col, [])` — which is not a filter
   * anyone should have to reason about, and which drizzle renders
   * differently across versions.
   */
  if (actor.scopeAppIds.size === 0) return { kind: 'none' }
  return { kind: 'apps', appIds: actor.scopeAppIds }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/search/registry/scope.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/search/registry/scope.ts src/features/search/registry/scope.test.ts
git commit -m "feat(search): add searchScopeFor, the pure reach resolver for the command palette"
```

---

### Task 2: `SearchContext` carries the actor; `PaletteContext` stops extending it

`PaletteContext` extends `SearchContext` today. Adding a server-resolved `Actor` to `SearchContext` would therefore hand one to the client palette, which is both a leak of the actor's whole scope set to the browser and a lie about what the palette is allowed to do with it. They become two contexts with two audiences, sharing `user` by declaration rather than by inheritance.

**Files:**
- Modify: `src/features/search/registry/types.ts:21-37`
- Modify: `src/features/search/actions.ts:24-41`
- Test: `src/features/search/actions.test.ts`

**Interfaces:**
- Consumes: `type Actor` from `src/features/auth/capabilities.ts`; `loadActor` from `src/features/auth/actor.ts`.
- Produces: `SearchContext = { user: Session['user']; actor: Actor }`; `PaletteContext = { user: Session['user']; theme: Theme; goShortcutsOn: boolean }`. Every provider in Tasks 3-5 reads `ctx.actor`.

- [ ] **Step 1: Write the failing test**

Create `src/features/search/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '@/features/auth/capabilities'

const { authMock, loadActorMock, runProvidersMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  loadActorMock: vi.fn(),
  runProvidersMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: authMock, signOut: vi.fn() }))
vi.mock('@/features/auth/actor', () => ({ loadActor: loadActorMock }))
vi.mock('./registry/providers', () => ({ runProviders: runProvidersMock }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/db', () => ({ db: { select: () => ({ from: () => ({ where: async () => [] }) }) } }))

const { universalSearch } = await import('./actions')

const ACTOR: Actor = { id: 'u-1', role: 'stakeholder', scopeAppIds: new Set(['app-a']) }

beforeEach(() => {
  authMock.mockReset()
  loadActorMock.mockReset()
  runProvidersMock.mockReset()
  runProvidersMock.mockResolvedValue([])
})

describe('universalSearch', () => {
  it('threads the server-resolved actor into every provider', async () => {
    authMock.mockResolvedValue({ user: { id: 'u-1', status: 'approved', role: 'stakeholder' } })
    loadActorMock.mockResolvedValue(ACTOR)

    await universalSearch('logpup')

    expect(runProvidersMock).toHaveBeenCalledTimes(1)
    const [query, ctx] = runProvidersMock.mock.calls[0]
    expect(query).toBe('logpup')
    expect(ctx.actor).toBe(ACTOR)
    expect(ctx.user.id).toBe('u-1')
  })

  it('returns nothing and asks no provider when the account is not approved', async () => {
    authMock.mockResolvedValue({ user: { id: 'u-1', status: 'pending', role: 'member' } })
    loadActorMock.mockResolvedValue(ACTOR)

    await expect(universalSearch('logpup')).resolves.toEqual([])
    expect(runProvidersMock).not.toHaveBeenCalled()
  })

  it('returns nothing when no actor resolves — a provider must never run without one', async () => {
    // Fails closed. Without this arm every provider would have to defend
    // itself against an undefined ctx.actor, which is exactly the per-call-site
    // guessing this whole change exists to end.
    authMock.mockResolvedValue({ user: { id: 'u-1', status: 'approved', role: 'member' } })
    loadActorMock.mockResolvedValue(null)

    await expect(universalSearch('logpup')).resolves.toEqual([])
    expect(runProvidersMock).not.toHaveBeenCalled()
  })

  it('returns nothing for a signed-out caller', async () => {
    authMock.mockResolvedValue(null)
    await expect(universalSearch('logpup')).resolves.toEqual([])
    expect(runProvidersMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/search/actions.test.ts`
Expected: FAIL — `AssertionError: expected undefined to be { id: 'u-1', … }` on `expect(ctx.actor).toBe(ACTOR)`, because `universalSearch` currently calls `runProviders(q, { user: session.user })` with no actor, and the third test fails with `expected "runProviders" to not be called` because there is no null-actor arm yet.

- [ ] **Step 3: Write minimal implementation**

In `src/features/search/registry/types.ts`, replace the `SearchContext` and `PaletteContext` declarations (currently lines 14-37) with:

```ts
/**
 * What a search provider is told about the caller.
 *
 * `actor` is SERVER-RESOLVED and carries the caller's whole app scope set. It
 * is the input to searchScopeFor (registry/scope.ts), which is what decides
 * the rows a provider may return. A provider runs on the server, so the shell
 * state on PaletteContext would be meaningless here.
 */
export type SearchContext = {
  user: Session['user']
  actor: Actor
}

/**
 * What the palette knows when it decides which rows to show.
 *
 * DELIBERATELY NOT `SearchContext & …` any more. It used to extend it, which
 * meant every field added for the server arrived in the browser too — and the
 * field just added is an Actor carrying the caller's entire app scope. Two
 * contexts, two audiences: `user` is declared in both because both legitimately
 * have it, and nothing else crosses.
 *
 * `user` here is presentation only — see `visible`. The two shell fields are
 * here so a row can NAME the state it will leave you in ("Turn off go-to
 * shortcuts") instead of the verb "toggle".
 */
export type PaletteContext = {
  user: Session['user']
  theme: Theme
  goShortcutsOn: boolean
}
```

Add to the imports at the top of the same file:

```ts
import type { Actor } from '@/features/auth/capabilities'
```

In `src/features/search/actions.ts`, add the import:

```ts
import { loadActor } from '@/features/auth/actor'
```

and replace the body of `universalSearch` (currently ending `return runProviders(q, { user: session.user })`) with:

```ts
  if (!canAccessApp(session.user.status, true)) return []

  /**
   * Resolved ONCE per request (loadActor is React-cached) and threaded into
   * every provider. Fails closed: no actor, no search. Without this arm each
   * provider would have to defend itself against a missing scope, which is the
   * per-call-site guessing that let ⌘K answer questions the asker was not
   * allowed to ask in the first place.
   */
  const actor = await loadActor()
  if (!actor) return []

  return runProviders(q, { user: session.user, actor })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/search/actions.test.ts && npx tsc --noEmit`
Expected: PASS, 4 tests. `tsc` clean — `commands.ts` files read `ctx.user`, `ctx.theme` and `ctx.goShortcutsOn`, all of which `PaletteContext` still declares.

- [ ] **Step 5: Commit**

```bash
git add src/features/search/registry/types.ts src/features/search/actions.ts src/features/search/actions.test.ts
git commit -m "feat(search): thread the server-resolved actor into SearchContext, split PaletteContext off it"
```

---

### Task 3: The apps and people providers consume `ctx`

Two providers, one commit, because they are the two whose scope answer is a straight read of the matrix with no join: an app row IS the scoped thing, and the people directory is all-or-nothing.

**Files:**
- Modify: `src/features/apps/search-providers.ts:22-47`
- Modify: `src/features/people/search-providers.ts:24-50`
- Test: `src/features/apps/search-providers.test.ts`
- Test: `src/features/people/search-providers.test.ts`

**Interfaces:**
- Consumes: `searchScopeFor`, `type SearchScope` from `src/features/search/registry/scope.ts`; `ctx.actor` from `SearchContext` (Task 2).
- Produces: no new exports. The two `searchProviders` arrays keep their shape.

- [ ] **Step 1: Write the failing test**

Create `src/features/apps/search-providers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { liveApps } from '@/db/live'
import type { Actor } from '@/features/auth/capabilities'
import type { SearchContext } from '@/features/search/registry/types'

let capturedWhere: unknown = null
let rows: unknown[] = []
const selectSpy = vi.fn()

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      selectSpy(...args)
      return {
        from: () => ({
          where: (w: unknown) => {
            capturedWhere = w
            return { orderBy: () => ({ limit: async () => rows }) }
          },
        }),
      }
    },
  },
}))

const { searchProviders } = await import('./search-providers')
const provider = searchProviders[0]

const ctxFor = (actor: Actor): SearchContext => ({
  user: { id: actor.id, name: 'Tester', email: 't@example.com' } as SearchContext['user'],
  actor,
})

/** Renders the captured predicate to real SQL so the filter can be asserted. */
function renderWhere() {
  return new QueryBuilder().select().from(liveApps).where(capturedWhere as never).toSQL()
}

beforeEach(() => {
  capturedWhere = null
  rows = []
  selectSpy.mockReset()
})

describe('apps search provider', () => {
  it('is the apps provider, ranked 10', () => {
    expect(provider.id).toBe('apps')
    expect(provider.rank).toBe(10)
  })

  it('returns every match for an admin and adds no app filter', async () => {
    rows = [{ id: 'app-a', name: 'LogPup', slug: 'logpup', status: 'active' }]
    const hits = await provider.search('log', ctxFor({
      id: 'u-admin', role: 'admin', scopeAppIds: new Set(),
    }))
    expect(hits).toEqual([
      { id: 'app-a', title: 'LogPup', subtitle: 'logpup', href: '/apps/logpup', status: 'active', kind: 'app' },
    ])
    expect(renderWhere().params).toEqual(['%log%', '%log%', '%log%'])
  })

  it('restricts a stakeholder to their granted apps', async () => {
    rows = [{ id: 'app-a', name: 'LogPup', slug: 'logpup', status: 'active' }]
    await provider.search('log', ctxFor({
      id: 'u-sh', role: 'stakeholder', scopeAppIds: new Set(['app-a']),
    }))
    expect(renderWhere().params).toEqual(['%log%', '%log%', '%log%', 'app-a'])
  })

  it('asks the database nothing at all for a seat with no reach', async () => {
    const hits = await provider.search('log', ctxFor({
      id: 'u-sh', role: 'stakeholder', scopeAppIds: new Set(),
    }))
    expect(hits).toEqual([])
    expect(selectSpy).not.toHaveBeenCalled()
  })
})
```

Create `src/features/people/search-providers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { USER_ROLES, effectiveGrant } from '@/features/auth/capabilities'
import type { Actor } from '@/features/auth/capabilities'
import type { SearchContext } from '@/features/search/registry/types'

let rows: unknown[] = []
const selectSpy = vi.fn()

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      selectSpy(...args)
      return {
        from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => rows }) }) }),
      }
    },
  },
}))

const { searchProviders } = await import('./search-providers')
const provider = searchProviders[0]

const ctxFor = (actor: Actor): SearchContext => ({
  user: { id: actor.id, name: 'Tester', email: 't@example.com' } as SearchContext['user'],
  actor,
})

beforeEach(() => {
  rows = []
  selectSpy.mockReset()
})

describe('people search provider', () => {
  it('is the people provider, ranked 20', () => {
    expect(provider.id).toBe('people')
    expect(provider.rank).toBe(20)
  })

  it('answers a member with the whole directory', async () => {
    rows = [{ id: 'u-2', name: 'Shanika', title: 'Engineer' }]
    const hits = await provider.search('sha', ctxFor({
      id: 'u-1', role: 'member', scopeAppIds: new Set(['app-a']),
    }))
    expect(hits).toEqual([
      { id: 'u-2', title: 'Shanika', subtitle: 'Engineer', href: '/people/u-2', kind: 'person' },
    ])
    expect(selectSpy).toHaveBeenCalledTimes(1)
  })

  it('refuses a stakeholder the address book without touching the database', async () => {
    const hits = await provider.search('sha', ctxFor({
      id: 'u-sh', role: 'stakeholder', scopeAppIds: new Set(['app-a']),
    }))
    expect(hits).toEqual([])
    expect(selectSpy).not.toHaveBeenCalled()
  })

  it('no seat holds a scoped grant on the directory — the all-or-nothing arm is safe', () => {
    // The provider returns [] for a `scoped` answer because there is no
    // person-to-app join to filter on. That is only correct while no seat is
    // scoped here; this assertion is what fails the build if one becomes so.
    for (const role of USER_ROLES) {
      expect(effectiveGrant(role, undefined, 'user.view.directory')).not.toBe('scoped')
      expect(effectiveGrant(role, undefined, 'user.view.directory')).not.toBe('own')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/apps/search-providers.test.ts src/features/people/search-providers.test.ts`
Expected: FAIL — apps: `AssertionError: expected [ '%log%', '%log%', '%log%' ] to deeply equal [ '%log%', '%log%', '%log%', 'app-a' ]`; people: `AssertionError: expected "spy" to not be called at all, but actually been called 1 times`.

- [ ] **Step 3: Write minimal implementation**

In `src/features/apps/search-providers.ts`, add to the imports:

```ts
import { and, asc, inArray, or, ilike, sql } from 'drizzle-orm'
import { searchScopeFor } from '@/features/search/registry/scope'
```

(replacing the existing `import { asc, or, ilike, sql } from 'drizzle-orm'`), and change the provider's `search` to:

```ts
    search: async (query, ctx) => {
      /**
       * REACH FIRST, QUERY SECOND. app.view is the same action every app page
       * gates on, so a hit here can never name a project its reader could not
       * open. A seat with no reach costs zero round trips.
       */
      const scope = searchScopeFor(ctx.actor, 'app.view')
      if (scope.kind === 'none') return []

      const pattern = likePattern(query)
      const rows = await db
        .select({ id: liveApps.id, name: liveApps.name, slug: liveApps.slug, status: liveApps.status })
        .from(liveApps)
        .where(
          and(
            or(
              ilike(liveApps.name, pattern),
              ilike(liveApps.slug, pattern),
              // Tech tags are a text[]; flatten before matching so "next" finds
              // an app tagged next.js without an unnest + group.
              sql`array_to_string(${liveApps.techTags}, ' ') ILIKE ${pattern}`,
            ),
            // searchScopeFor never returns an empty set, so this is never
            // `IN ()`. `undefined` inside and() is dropped by drizzle.
            scope.kind === 'apps' ? inArray(liveApps.id, [...scope.appIds]) : undefined,
          ),
        )
        .orderBy(asc(liveApps.status), asc(liveApps.name))
        .limit(PALETTE_RESULT_LIMIT)

      return rows.map((app) => ({
        id: app.id,
        title: app.name,
        subtitle: app.slug,
        href: `/apps/${app.slug}`,
        status: app.status,
        kind: 'app' as const,
      }))
    },
```

In `src/features/people/search-providers.ts`, add the import:

```ts
import { searchScopeFor } from '@/features/search/registry/scope'
```

and open the provider's `search` with:

```ts
    search: async (query, ctx) => {
      /**
       * ALL OR NOTHING, and that is the matrix's own answer: no seat holds a
       * `scoped` or `own` grant on user.view.directory, so there is nothing to
       * narrow to. A `scoped` answer would need a person-to-app join that does
       * not exist, so it returns nothing rather than guessing — and
       * search-providers.test.ts fails the build the day a seat becomes scoped
       * here, which is the only way this arm can go wrong.
       *
       * Stakeholder holds `none`: a client seat must not be able to read the
       * studio's address book out of a palette.
       */
      const scope = searchScopeFor(ctx.actor, 'user.view.directory')
      if (scope.kind !== 'all') return []

      const pattern = likePattern(query)
```

(the rest of the function body is unchanged).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/apps/search-providers.test.ts src/features/people/search-providers.test.ts && npx tsc --noEmit`
Expected: PASS, 7 tests total; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/apps/search-providers.ts src/features/apps/search-providers.test.ts src/features/people/search-providers.ts src/features/people/search-providers.test.ts
git commit -m "fix(search): scope app and people palette results to the actor's reach"
```

---

### Task 4: The tasks and sprints providers consume `ctx`

Both live in one file and both hang off `app_id`, so they are one commit. A task title is the highest-value leak in the whole palette — it is where client names, deadlines and internal shorthand actually live.

**Files:**
- Modify: `src/features/sprints/search-providers.ts:15-81`
- Test: `src/features/sprints/search-providers.test.ts`

**Interfaces:**
- Consumes: `searchScopeFor` from `src/features/search/registry/scope.ts`; `ctx.actor`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Create `src/features/sprints/search-providers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { liveTasks } from '@/db/live'
import type { Actor } from '@/features/auth/capabilities'
import type { SearchContext } from '@/features/search/registry/types'

let capturedWhere: unknown = null
let rows: unknown[] = []
const selectSpy = vi.fn()

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      selectSpy(...args)
      return {
        from: () => ({
          innerJoin: () => ({
            where: (w: unknown) => {
              capturedWhere = w
              return { orderBy: () => ({ limit: async () => rows }) }
            },
          }),
        }),
      }
    },
  },
}))

const { searchProviders } = await import('./search-providers')
const tasksProvider = searchProviders[0]
const sprintsProvider = searchProviders[1]

const ctxFor = (actor: Actor): SearchContext => ({
  user: { id: actor.id, name: 'Tester', email: 't@example.com' } as SearchContext['user'],
  actor,
})

function renderWhere() {
  return new QueryBuilder().select().from(liveTasks).where(capturedWhere as never).toSQL()
}

beforeEach(() => {
  capturedWhere = null
  rows = []
  selectSpy.mockReset()
})

describe('tasks search provider', () => {
  it('is the tasks provider, ranked 30', () => {
    expect(tasksProvider.id).toBe('tasks')
    expect(tasksProvider.rank).toBe(30)
  })

  it('adds no app filter for an admin', async () => {
    rows = [{
      id: 't-1', title: 'Fix the login flow', status: 'todo',
      sprintId: null, appName: 'LogPup', appSlug: 'logpup',
    }]
    const hits = await tasksProvider.search('login', ctxFor({
      id: 'u-admin', role: 'admin', scopeAppIds: new Set(),
    }))
    expect(hits).toEqual([{
      id: 't-1',
      title: 'Fix the login flow',
      subtitle: 'LogPup',
      href: '/apps/logpup?tab=roadmap&sprint=backlog',
      status: 'todo',
      kind: 'task',
    }])
    expect(renderWhere().params).toEqual(['%login%'])
  })

  it('restricts a member to tasks on the apps they are assigned to', async () => {
    rows = []
    await tasksProvider.search('login', ctxFor({
      id: 'u-m', role: 'member', scopeAppIds: new Set(['app-a', 'app-b']),
    }))
    expect(renderWhere().params).toEqual(['%login%', 'app-a', 'app-b'])
  })

  it('asks the database nothing for a stakeholder with no grants', async () => {
    const hits = await tasksProvider.search('login', ctxFor({
      id: 'u-sh', role: 'stakeholder', scopeAppIds: new Set(),
    }))
    expect(hits).toEqual([])
    expect(selectSpy).not.toHaveBeenCalled()
  })
})

describe('sprints search provider', () => {
  it('is the sprints provider, ranked 40', () => {
    expect(sprintsProvider.id).toBe('sprints')
    expect(sprintsProvider.rank).toBe(40)
  })

  it('restricts a stakeholder to sprints on their granted app', async () => {
    rows = []
    await sprintsProvider.search('q3', ctxFor({
      id: 'u-sh', role: 'stakeholder', scopeAppIds: new Set(['app-a']),
    }))
    expect(renderWhere().params).toEqual(['%q3%', '%q3%', 'app-a'])
  })

  it('asks the database nothing for a seat with no reach', async () => {
    const hits = await sprintsProvider.search('q3', ctxFor({
      id: 'u-sh', role: 'stakeholder', scopeAppIds: new Set(),
    }))
    expect(hits).toEqual([])
    expect(selectSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/sprints/search-providers.test.ts`
Expected: FAIL — `AssertionError: expected [ '%login%' ] to deeply equal [ '%login%', 'app-a', 'app-b' ]`, and the two "asks the database nothing" cases fail with `expected "spy" to not be called at all, but actually been called 1 times`.

- [ ] **Step 3: Write minimal implementation**

In `src/features/sprints/search-providers.ts`, replace the import line with:

```ts
import { and, asc, eq, ilike, inArray, or } from 'drizzle-orm'
```

and add:

```ts
import { searchScopeFor } from '@/features/search/registry/scope'
```

Rewrite the two `search` functions. The tasks provider:

```ts
    search: async (query, ctx) => {
      /**
       * A task title is the highest-value leak in the palette — client names,
       * deadlines and internal shorthand all live there. app.view is the same
       * action the board itself gates on, so a hit can never name a task whose
       * board its reader could not open.
       */
      const scope = searchScopeFor(ctx.actor, 'app.view')
      if (scope.kind === 'none') return []

      const rows = await db
        .select({
          id: liveTasks.id,
          title: liveTasks.title,
          status: liveTasks.status,
          sprintId: liveTasks.sprintId,
          appName: liveApps.name,
          appSlug: liveApps.slug,
        })
        .from(liveTasks)
        .innerJoin(liveApps, eq(liveTasks.appId, liveApps.id))
        .where(
          and(
            ilike(liveTasks.title, likePattern(query)),
            scope.kind === 'apps' ? inArray(liveTasks.appId, [...scope.appIds]) : undefined,
          ),
        )
        // asc(status) is todo → in_progress → done, by the pg enum's
        // declaration order: unfinished work first.
        .orderBy(asc(liveTasks.status))
        .limit(PALETTE_RESULT_LIMIT)

      return rows.map((task) => ({
        id: task.id,
        title: task.title,
        subtitle: task.appName,
        // `backlog` is the board's sentinel for a task on no sprint.
        href: `/apps/${task.appSlug}?tab=roadmap&sprint=${task.sprintId ?? 'backlog'}`,
        status: task.status,
        kind: 'task' as const,
      }))
    },
```

The sprints provider:

```ts
    search: async (query, ctx) => {
      const scope = searchScopeFor(ctx.actor, 'app.view')
      if (scope.kind === 'none') return []

      const pattern = likePattern(query)
      const rows = await db
        .select({
          id: liveSprints.id,
          name: liveSprints.name,
          status: liveSprints.status,
          appName: liveApps.name,
          appSlug: liveApps.slug,
        })
        .from(liveSprints)
        .innerJoin(liveApps, eq(liveSprints.appId, liveApps.id))
        .where(
          and(
            // The goal is searched as well as the name: people remember what a
            // sprint was for long after they forget it was called "Sprint 12".
            or(ilike(liveSprints.name, pattern), ilike(liveSprints.goal, pattern)),
            scope.kind === 'apps' ? inArray(liveSprints.appId, [...scope.appIds]) : undefined,
          ),
        )
        .orderBy(asc(liveSprints.status))
        .limit(PALETTE_RESULT_LIMIT)

      return rows.map((sprint) => ({
        id: sprint.id,
        title: sprint.name,
        subtitle: sprint.appName,
        href: `/apps/${sprint.appSlug}?tab=roadmap&sprint=${sprint.id}`,
        status: sprint.status,
        kind: 'sprint' as const,
      }))
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/sprints/search-providers.test.ts && npx tsc --noEmit`
Expected: PASS, 6 tests; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/sprints/search-providers.ts src/features/sprints/search-providers.test.ts
git commit -m "fix(search): scope task and sprint palette results to the actor's reach"
```

---

### Task 5: The meetings provider consumes `ctx` — closing the leak

The last of the four, and the one that completes build-order item 1. After this commit a stakeholder types three letters and sees only their own project.

Scope here is the matrix's own answer and nothing more: `can(actor, 'meeting.intel.view', { appIds })` reaches a meeting through its projects, so a scoped seat sees meetings on their apps. A meeting on **no** project (a company all-hands) is therefore invisible to a scoped seat — stated out loud because it is a real narrowing, and it is the same answer every other meeting-intel surface already gives.

**Files:**
- Modify: `src/features/meetings/search-providers.ts:43-90`
- Test: `src/features/meetings/search-providers.test.ts`

**Interfaces:**
- Consumes: `searchScopeFor` from `src/features/search/registry/scope.ts`; `ctx.actor`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Create `src/features/meetings/search-providers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { liveMeetings } from '@/db/live'
import type { Actor } from '@/features/auth/capabilities'
import type { SearchContext } from '@/features/search/registry/types'

let capturedWhere: unknown = null
let rows: unknown[] = []
const selectSpy = vi.fn()

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      selectSpy(...args)
      const chain = {
        leftJoin: () => chain,
        where: (w: unknown) => {
          capturedWhere = w
          return { groupBy: () => ({ orderBy: () => ({ limit: async () => rows }) }) }
        },
      }
      return { from: () => chain }
    },
  },
}))

const { searchProviders } = await import('./search-providers')
const provider = searchProviders[0]

const ctxFor = (actor: Actor): SearchContext => ({
  user: { id: actor.id, name: 'Tester', email: 't@example.com' } as SearchContext['user'],
  actor,
})

function renderWhere() {
  return new QueryBuilder().select().from(liveMeetings).where(capturedWhere as never).toSQL()
}

beforeEach(() => {
  capturedWhere = null
  rows = []
  selectSpy.mockReset()
})

describe('meetings search provider', () => {
  it('is the meetings provider, ranked 50', () => {
    expect(provider.id).toBe('meetings')
    expect(provider.rank).toBe(50)
  })

  it('adds no project filter for an admin', async () => {
    rows = [{
      id: 'm-1',
      title: 'Weekly sync',
      startsAt: new Date('2026-08-20T04:00:00.000Z'),
      appNames: 'LogPup',
    }]
    const hits = await provider.search('sync', ctxFor({
      id: 'u-admin', role: 'admin', scopeAppIds: new Set(),
    }))
    expect(hits).toEqual([{
      id: 'm-1',
      title: 'Weekly sync',
      subtitle: 'LogPup',
      href: '/meetings',
      kind: 'meeting',
    }])
    expect(renderWhere().params).toEqual(['%sync%', '%sync%'])
  })

  it('restricts a stakeholder to meetings on their granted project', async () => {
    rows = []
    await provider.search('sync', ctxFor({
      id: 'u-sh', role: 'stakeholder', scopeAppIds: new Set(['app-a']),
    }))
    expect(renderWhere().params).toEqual(['%sync%', '%sync%', 'app-a'])
  })

  it('asks the database nothing for a seat with no reach', async () => {
    const hits = await provider.search('sync', ctxFor({
      id: 'u-sh', role: 'stakeholder', scopeAppIds: new Set(),
    }))
    expect(hits).toEqual([])
    expect(selectSpy).not.toHaveBeenCalled()
  })

  it('still falls back to the date when a meeting has no project names', async () => {
    rows = [{
      id: 'm-2',
      title: 'Weekly sync',
      startsAt: new Date('2026-08-20T04:00:00.000Z'),
      appNames: null,
    }]
    const hits = await provider.search('sync', ctxFor({
      id: 'u-admin', role: 'admin', scopeAppIds: new Set(),
    }))
    expect(hits[0].subtitle).toBe('Aug 20')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/meetings/search-providers.test.ts`
Expected: FAIL — `AssertionError: expected [ '%sync%', '%sync%' ] to deeply equal [ '%sync%', '%sync%', 'app-a' ]`, plus `expected "spy" to not be called at all, but actually been called 1 times`.

- [ ] **Step 3: Write minimal implementation**

In `src/features/meetings/search-providers.ts`, change the import line to:

```ts
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
```

add:

```ts
import { searchScopeFor } from '@/features/search/registry/scope'
```

and replace the `search` function's opening and `where` clause:

```ts
    search: async (query, ctx) => {
      /**
       * Reach is meeting.intel.view, resolved through the projects the meeting
       * is on — the same question can(actor, 'meeting.intel.view', { appIds })
       * asks everywhere else. A scoped seat therefore sees meetings on their
       * own projects and nothing else.
       *
       * STATED OUT LOUD because it is a real narrowing: a meeting on NO project
       * (a company all-hands) is invisible to a scoped seat, because there is
       * no project through which their scope could reach it. That is the same
       * answer every other meeting-intel surface gives, and the alternative —
       * a special "unscoped meetings are public" arm — is a second permission
       * mechanism that the matrix cannot see.
       *
       * The predicate rides the meeting_apps join that is ALREADY here; no new
       * table is read, and both tables stay named literally so live.test.ts's
       * source scan can still see them.
       */
      const scope = searchScopeFor(ctx.actor, 'meeting.intel.view')
      if (scope.kind === 'none') return []

      const pattern = likePattern(query)
```

and inside the query, replace the single `.where(...)` line with:

```ts
        .where(
          and(
            or(ilike(liveMeetings.title, pattern), ilike(liveMeetings.agenda, pattern)),
            scope.kind === 'apps' ? inArray(meetingApps.appId, [...scope.appIds]) : undefined,
          ),
        )
```

(everything else in the function — the select list, the two `leftJoin`s, the `groupBy`, the `orderBy`, the `limit` and the whole `rows.map`, including the `NAME_SEPARATOR` split and the date fallback — is unchanged).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/meetings/search-providers.test.ts && npm test && npx tsc --noEmit`
Expected: `search-providers.test.ts` PASS, 5 tests. Full suite PASS — in particular `src/db/live.test.ts` stays green (no new table is read) and `src/features/search/registry/registry.test.ts` stays green (no provider file added or removed).

- [ ] **Step 5: Commit**

```bash
git add src/features/meetings/search-providers.ts src/features/meetings/search-providers.test.ts
git commit -m "fix(search): scope meeting palette results to the actor's projects — closes the enumeration leak"
```

**BUILD-ORDER GATE: item 1 is done here.** All four providers consume `ctx`; `grep -n 'ctx\.' src/features/*/search-providers.ts` now returns four files. Do not begin Task 6 until this commit is green.

---

### Task 6: `transitionTaskStatus` — the one status patch

`status = 'done'` records that a task is finished and throws away *when*. Four separate workstreams need the when — the promises hit-rate view, bug resolution time, the organizer's "done today", and coverage reconciliation — and each would defer it as someone else's problem.

The helper takes **only the destination**, not `(from, to)`. `completed_at` is a function of where the task lands, which is what lets `bulkUpdateTasks` — a path that never reads each row's current status — use the identical helper instead of growing a second code path. This is the consolidation that stops six behaviours accreting across four diverging call sites in specs C and D.

**Files:**
- Create: `src/features/sprints/task-status.ts`
- Test: `src/features/sprints/task-status.test.ts`

**Interfaces:**
- Consumes: `TASK_STATUSES`, `type TaskStatus` from `src/features/sprints/board-view.ts` (already exported there, lines 30-31).
- Produces: `type TaskStatusPatch = { status: TaskStatus; completedAt: Date | null }`, `function transitionTaskStatus(to: TaskStatus, now: Date): TaskStatusPatch`, `function isTaskStatus(value: unknown): value is TaskStatus`, and re-exports of `TASK_STATUSES` / `TaskStatus`. Tasks 8 and 9 both import from here.

- [ ] **Step 1: Write the failing test**

Create `src/features/sprints/task-status.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TASK_STATUSES, isTaskStatus, transitionTaskStatus } from './task-status'

const NOW = new Date('2026-08-20T04:30:00.000Z')
const LATER = new Date('2026-08-21T09:15:00.000Z')

describe('transitionTaskStatus', () => {
  it('stamps completedAt when a task enters done', () => {
    expect(transitionTaskStatus('done', NOW)).toEqual({ status: 'done', completedAt: NOW })
  })

  it('clears completedAt when a task is reopened to todo', () => {
    expect(transitionTaskStatus('todo', NOW)).toEqual({ status: 'todo', completedAt: null })
  })

  it('clears completedAt when a task is reopened to in_progress', () => {
    expect(transitionTaskStatus('in_progress', NOW)).toEqual({
      status: 'in_progress',
      completedAt: null,
    })
  })

  it('is a function of the destination alone, so re-entering done restamps', () => {
    // No `from` parameter, deliberately: bulkUpdateTasks never reads each
    // row's current status, and giving it a second code path is exactly the
    // divergence this helper exists to prevent.
    expect(transitionTaskStatus('done', LATER).completedAt).toEqual(LATER)
  })

  it('covers every declared status with no gaps', () => {
    for (const status of TASK_STATUSES) {
      const patch = transitionTaskStatus(status, NOW)
      expect(patch.status).toBe(status)
      expect(patch.completedAt).toEqual(status === 'done' ? NOW : null)
    }
  })

  it('never returns undefined for completedAt — the column is set or nulled, never skipped', () => {
    for (const status of TASK_STATUSES) {
      expect('completedAt' in transitionTaskStatus(status, NOW)).toBe(true)
    }
  })
})

describe('isTaskStatus', () => {
  it('accepts every declared status', () => {
    for (const status of TASK_STATUSES) expect(isTaskStatus(status)).toBe(true)
  })

  it('rejects anything else, including the shapes a jsonb payload can carry', () => {
    expect(isTaskStatus('archived')).toBe(false)
    expect(isTaskStatus('Done')).toBe(false)
    expect(isTaskStatus(null)).toBe(false)
    expect(isTaskStatus(undefined)).toBe(false)
    expect(isTaskStatus(3)).toBe(false)
    expect(isTaskStatus({ status: 'done' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/sprints/task-status.test.ts`
Expected: FAIL with `Error: Failed to load url ./task-status (resolved id: ./task-status) ... Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/sprints/task-status.ts`:

```ts
import { TASK_STATUSES, type TaskStatus } from '@/features/sprints/board-view'

export { TASK_STATUSES }
export type { TaskStatus }

/**
 * The ONE patch that changes a task's status.
 *
 * Four writers reach tasks.status and every one of them must go through here:
 * updateTask, moveTaskOnBoard, bulkUpdateTasks, and — the one that is not
 * obvious — an approved change request, whose generic
 * `db.update(table).set(after)` applier would otherwise write the status and
 * leave completed_at null, silently corrupting all four workstreams the column
 * exists for, through the one door that has a reviewer attached to it.
 *
 * THE DESTINATION ALONE decides the patch. There is no `from` parameter and
 * there must not be one: bulkUpdateTasks writes one `set` across a whole
 * selection without ever reading each row's current status, so a helper that
 * needed the origin would force that path into a second implementation — which
 * is the divergence this consolidation exists to prevent.
 *
 * Re-entering `done` restamps completed_at rather than preserving the first
 * stamp. "When did this finish" means the last time it finished; a task that
 * was reopened and finished again finished again.
 */
export type TaskStatusPatch = {
  status: TaskStatus
  completedAt: Date | null
}

export function transitionTaskStatus(to: TaskStatus, now: Date): TaskStatusPatch {
  return { status: to, completedAt: to === 'done' ? now : null }
}

/**
 * Narrows an unknown to a task status.
 *
 * Exists for the change-request applier, whose `after` payload is jsonb read
 * back out of the database as `Record<string, unknown>` — there is no zod
 * schema in that path and there cannot be a useful generic one, because the
 * payload's shape depends on the entity type.
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/sprints/task-status.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/sprints/task-status.ts src/features/sprints/task-status.test.ts
git commit -m "feat(sprints): add transitionTaskStatus, the single task status patch"
```

---

### Task 7: Migration — `tasks.completed_at`, alone and first

Alone, and first, so the four dependent workstreams unblock immediately. No backfill: `status = 'done'` records that a task finished and genuinely does not record when, so any backfilled value would be an invention. Existing done rows keep `completed_at` null and every reader must treat null as "finished, date unknown" — written into the column's comment so nobody later "fixes" it with `created_at`.

**STOP CONDITIONS for this task:** do not run `npm run db:migrate` or any other migration runner. Do not run `npm run db:generate`. Do not hardcode a migration number. Do not edit any existing `.sql` file.

**Files:**
- Modify: `src/db/schema.ts` — the `tasks` table (currently lines 321-352)
- Create: `drizzle/<allocated>_task_completed_at.sql`
- Modify: `drizzle/meta/_journal.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `tasks.completedAt` (SQL `completed_at`, `timestamp with time zone`, nullable). Tasks 8 and 9 write it.

- [ ] **Step 1: Add the column to the schema**

In `src/db/schema.ts`, inside the `tasks` table definition, immediately after the `dueDate` column and before `createdAt`, add:

```ts
  /**
   * WHEN a task finished, not just that it did.
   *
   * `status = 'done'` throws the timestamp away, and four separate workstreams
   * need it: the promises hit-rate view, bug resolution time, the organizer's
   * "done today", and coverage reconciliation. Each would have deferred it as
   * someone else's problem.
   *
   * Written ONLY through transitionTaskStatus (features/sprints/task-status.ts),
   * which all four status writers call — including the change-request applier,
   * which is the one that is not obvious.
   *
   * NULL ON AN EXISTING DONE ROW MEANS "finished, date unknown", and it must
   * stay that way. There was deliberately no backfill: nothing in the schema
   * records when a pre-migration task finished, so any value would be an
   * invention, and `created_at` in particular would be a lie that reads like
   * data.
   */
  completedAt: timestamp('completed_at', { withTimezone: true }),
```

- [ ] **Step 2: Allocate the migration number and write the SQL**

Run, from the repo root:

```bash
NEXT=$(printf '%04d' $(( 10#$(ls drizzle/*.sql | sed 's#.*/##' | cut -c1-4 | sort -n | tail -1) + 1 )))
echo "allocated: $NEXT"
cat > "drizzle/${NEXT}_task_completed_at.sql" <<'SQL'
-- tasks.completed_at — WHEN a task finished, not merely that it did.
--
-- Shipped ALONE, first, ahead of the rest of the work-management substrate, so
-- the four dependents (promises hit-rate, bug resolution time, the /my-day
-- organizer's "done today", coverage reconciliation) unblock immediately
-- instead of waiting behind the notification changes.
--
-- NO BACKFILL, deliberately. `status = 'done'` records that a task is finished
-- and does not record when, so nothing in this schema can answer the question
-- for a pre-existing row. `created_at` would be a lie that reads like data.
-- Every reader must treat NULL on a done row as "finished, date unknown" — the
-- schema.ts comment on this column says the same thing to the next person.
--
-- Written only through transitionTaskStatus (src/features/sprints/task-status.ts),
-- which all four status writers call, the fourth being the change-request
-- applier that has no UI.
--
-- Replay-safe: ADD COLUMN IF NOT EXISTS survives being applied twice, which is
-- the same discipline 0029 and 0034 follow.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
SQL
node -e '
const fs = require("node:fs")
const p = "drizzle/meta/_journal.json"
const tag = process.argv[1]
const j = JSON.parse(fs.readFileSync(p, "utf8"))
if (j.entries.some((e) => e.tag === tag)) { console.log("journal already has", tag); process.exit(0) }
const idx = Number(tag.slice(0, 4))
const when = Math.max(...j.entries.map((e) => e.when)) + 100000
j.entries.push({ idx, version: "7", when, tag, breakpoints: true })
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n")
console.log("journal appended:", tag, "idx", idx, "when", when)
' "${NEXT}_task_completed_at"
```

- [ ] **Step 3: Verify the migration is well-formed without running it**

Run:

```bash
git status --short drizzle/ src/db/schema.ts
tail -n 9 drizzle/meta/_journal.json
node -e 'JSON.parse(require("node:fs").readFileSync("drizzle/meta/_journal.json","utf8")); console.log("journal parses")'
npx tsc --noEmit
npm test
```

Expected: `git status` lists exactly the new `.sql`, the journal, and `schema.ts`. The journal tail shows the new entry with `"breakpoints": true` and a `when` greater than the previous entry's. `journal parses`. `tsc` clean. Full suite PASS.

- [ ] **Step 4: STOP — request human approval before any database touches this**

Print this and wait:

> Migration `<allocated>_task_completed_at.sql` is written and the journal entry appended. **I have not run it.** Applying it needs your explicit go-ahead, and after it runs I will verify with `information_schema` rather than the runner's exit code:
>
> ```sql
> SELECT column_name, data_type, is_nullable
> FROM information_schema.columns
> WHERE table_name = 'tasks' AND column_name = 'completed_at';
> ```
>
> Expected: exactly one row, `timestamp with time zone`, `YES`. Zero rows means the runner reported success and applied nothing.

Do not proceed past this step without an answer. Task 8 can be written and committed against the schema change without the migration having run; only a live query needs it.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/meta/_journal.json drizzle/*_task_completed_at.sql
git commit -m "feat(db): add tasks.completed_at with no backfill"
```

---

### Task 8: All three in-app status writers call `transitionTaskStatus`

`updateTask`, `moveTaskOnBoard` and `bulkUpdateTasks` each write `status` independently today. This is the consolidation. The private `TASK_STATUSES` duplicate at `task-actions.ts:20-21` goes with it — two declarations of the same closed set is exactly the drift that produces a fourth behaviour later.

The existing test harness must change first: its `update(...).set(...).where()` returns `{ returning }` with no `then`, but `updateTask` and `moveTaskOnBoard` **await that call directly**. Without a thenable those two actions hang or throw before reaching the assertion.

**Files:**
- Modify: `src/features/sprints/task-actions.ts:20-21` (delete the private duplicate), `:352-393` (`updateTask`), `:454-520` (`moveTaskOnBoard`), `:573-625` (`bulkUpdateTasks`)
- Modify: `src/features/sprints/task-actions.test.ts:32-42` (the mock) and append new describes

**Interfaces:**
- Consumes: `transitionTaskStatus`, `TASK_STATUSES`, `type TaskStatus` from `src/features/sprints/task-status.ts` (Task 6); `tasks.completedAt` from Task 7.
- Produces: no new exports. Every `tasks` write carrying a `status` now also carries `completedAt`.

- [ ] **Step 1: Write the failing test**

First replace the `vi.mock('@/db', …)` block in `src/features/sprints/task-actions.test.ts` (currently lines 22-42) with this — `where()` now returns an object that is BOTH thenable and `.returning()`-able, so the two actions that await it directly can run:

```ts
let taskQueue: unknown[][] = []
let updateReturningQueue: unknown[][] = []

/**
 * `where()` returns a THENABLE that also carries `.returning()`.
 *
 * deleteTask awaits `.returning()`; updateTask and moveTaskOnBoard await the
 * `.where()` call itself. A plain `{ returning }` object satisfies only the
 * first, and awaiting it resolves to the object rather than to rows — which is
 * why the harness had to grow a `then` before any status assertion could run.
 * The write is recorded in `where()` so it is recorded exactly once either way.
 */
vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        // taskById (deleteTask's read) goes through liveTasks (D4) — the
        // write below is still the raw `tasks` table, which is what
        // writeSpy asserts against.
        where: async () => (table === liveTasks ? taskQueue.shift() ?? [] : []),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          writeSpy(table, values)
          return {
            returning: async () => updateReturningQueue.shift() ?? [],
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve(undefined).then(resolve),
          }
        },
      }),
    }),
    delete: deleteSpy,
  },
}))
```

Then change the import line at the top of the same file from `const { deleteTask } = await import('./task-actions')` to:

```ts
const { bulkUpdateTasks, deleteTask, moveTaskOnBoard, updateTask } = await import('./task-actions')
```

and append these describes to the end of the file:

```ts
/** Only the writes aimed at `tasks`; follow-up sync writes meeting_followups. */
function taskWrites() {
  return writeSpy.mock.calls.filter(([table]) => table === tasks)
}

describe('completed_at through updateTask', () => {
  it('stamps completedAt when the status moves to done', async () => {
    asAdmin()
    taskQueue = [[baseTask({ status: 'in_progress', assigneeId: 'admin-1' })]]
    const res = await updateTask(TASK_ID, { status: 'done' })
    expect(res).toEqual({ ok: true, data: undefined })
    const [, values] = taskWrites()[0]
    expect(values.status).toBe('done')
    expect(values.completedAt).toBeInstanceOf(Date)
  })

  it('clears completedAt when the task is reopened', async () => {
    asAdmin()
    taskQueue = [[baseTask({ status: 'done', assigneeId: 'admin-1' })]]
    const res = await updateTask(TASK_ID, { status: 'todo' })
    expect(res).toEqual({ ok: true, data: undefined })
    const [, values] = taskWrites()[0]
    expect(values).toMatchObject({ status: 'todo', completedAt: null })
  })

  it('does not touch completedAt when the patch carries no status', async () => {
    asAdmin()
    taskQueue = [[baseTask({ status: 'todo', assigneeId: 'admin-1' })]]
    const res = await updateTask(TASK_ID, { title: 'Renamed' })
    expect(res).toEqual({ ok: true, data: undefined })
    const [, values] = taskWrites()[0]
    expect(values).toEqual({ title: 'Renamed' })
  })
})

describe('completed_at through moveTaskOnBoard', () => {
  it('stamps completedAt when a card is dragged into Done', async () => {
    asAdmin()
    taskQueue = [[baseTask({ status: 'todo', assigneeId: 'admin-1' })]]
    const res = await moveTaskOnBoard({ taskId: TASK_ID, sortOrder: 1, status: 'done' })
    expect(res).toEqual({ ok: true, data: undefined })
    const [, values] = taskWrites()[0]
    expect(values.status).toBe('done')
    expect(values.completedAt).toBeInstanceOf(Date)
    expect(values.sortOrder).toBe(1)
  })

  it('clears completedAt when a card is dragged back out of Done', async () => {
    asAdmin()
    taskQueue = [[baseTask({ status: 'done', assigneeId: 'admin-1' })]]
    const res = await moveTaskOnBoard({ taskId: TASK_ID, sortOrder: 2, status: 'in_progress' })
    expect(res).toEqual({ ok: true, data: undefined })
    const [, values] = taskWrites()[0]
    expect(values).toMatchObject({ status: 'in_progress', completedAt: null, sortOrder: 2 })
  })

  it('leaves completedAt alone for a pure reorder', async () => {
    asAdmin()
    taskQueue = [[baseTask({ status: 'todo', assigneeId: 'admin-1' })]]
    const res = await moveTaskOnBoard({ taskId: TASK_ID, sortOrder: 3 })
    expect(res).toEqual({ ok: true, data: undefined })
    const [, values] = taskWrites()[0]
    expect(values).toEqual({ sortOrder: 3 })
  })
})

describe('completed_at through bulkUpdateTasks', () => {
  it('stamps completedAt across the whole selection', async () => {
    asAdmin()
    taskQueue = [[
      { id: TASK_ID, appId: 'app-1', assigneeId: 'admin-1', title: 'Fix the flaky test' },
    ]]
    const res = await bulkUpdateTasks({ taskIds: [TASK_ID], patch: { status: 'done' } })
    expect(res.ok).toBe(true)
    const [, values] = taskWrites()[0]
    expect(values.status).toBe('done')
    expect(values.completedAt).toBeInstanceOf(Date)
  })

  it('clears completedAt when a selection is reopened', async () => {
    asAdmin()
    taskQueue = [[
      { id: TASK_ID, appId: 'app-1', assigneeId: 'admin-1', title: 'Fix the flaky test' },
    ]]
    const res = await bulkUpdateTasks({ taskIds: [TASK_ID], patch: { status: 'todo' } })
    expect(res.ok).toBe(true)
    const [, values] = taskWrites()[0]
    expect(values).toMatchObject({ status: 'todo', completedAt: null })
  })

  it('leaves completedAt alone for a non-status bulk patch', async () => {
    asAdmin()
    taskQueue = [[
      { id: TASK_ID, appId: 'app-1', assigneeId: 'admin-1', title: 'Fix the flaky test' },
    ]]
    const res = await bulkUpdateTasks({ taskIds: [TASK_ID], patch: { priority: 2 } })
    expect(res.ok).toBe(true)
    const [, values] = taskWrites()[0]
    expect(values).toEqual({ priority: 2 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/sprints/task-actions.test.ts`
Expected: FAIL — `AssertionError: expected undefined to be an instance of Date` on `expect(values.completedAt).toBeInstanceOf(Date)`, six times (two per writer), because no writer stamps the column yet.

- [ ] **Step 3: Write minimal implementation**

In `src/features/sprints/task-actions.ts`:

Delete lines 20-21 (`const TASK_STATUSES = [...] as const` and `type TaskStatus = ...`) and add to the import block:

```ts
import { TASK_STATUSES, transitionTaskStatus, type TaskStatus } from '@/features/sprints/task-status'
```

In `updateTask`, immediately after the `if (Object.keys(set).length === 0) return err('Nothing to update')` line, insert:

```ts
  /**
   * ONE helper, not an inline ternary, and the same one the other three status
   * writers call. `set.status` has already been through the zod enum, so the
   * cast is narrowing a `unknown`-valued record back to what the parse proved.
   */
  if (set.status !== undefined) {
    Object.assign(set, transitionTaskStatus(set.status as TaskStatus, new Date()))
  }
```

In `moveTaskOnBoard`, replace the line `if (status !== undefined) set.status = status` with:

```ts
  if (status !== undefined) Object.assign(set, transitionTaskStatus(status, new Date()))
```

In `bulkUpdateTasks`, replace the `try { await db.update(tasks).set(patch).where(...) }` block's `patch` argument by building a write patch first. Insert immediately before that `try`:

```ts
  /**
   * The bulk path never reads each row's current status, which is exactly why
   * transitionTaskStatus takes the destination alone: the identical helper
   * serves a selection and a single row, so the two cannot drift.
   */
  const writePatch: Record<string, unknown> = { ...patch }
  if (patch.status !== undefined) {
    Object.assign(writePatch, transitionTaskStatus(patch.status, new Date()))
  }
```

and change the statement itself to:

```ts
    await db.update(tasks).set(writePatch).where(
      inArray(
        tasks.id,
        allowed.map((row) => row.id),
      ),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/sprints/task-actions.test.ts && npx tsc --noEmit && npm test`
Expected: `task-actions.test.ts` PASS (the three pre-existing `deleteTask` tests plus nine new ones). `tsc` clean — `TASK_STATUSES` now resolves through `task-status.ts` for the three zod enums at lines 46, 63, 85 and 114. Full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sprints/task-actions.ts src/features/sprints/task-actions.test.ts
git commit -m "feat(sprints): route all three in-app status writers through transitionTaskStatus"
```

---

### Task 9: The fourth door — an approved change request stamps `completed_at`

`buildApplyStatement` is `db.update(table).set(after).where(eq(table.id, entityId))` — a generic spread — and `'task'` is already in `SUPPORTED_ENTITY_TYPES`. A change request carrying `status: 'done'` therefore writes the status, never calls `transitionTaskStatus`, and leaves `completed_at` null. **It has no UI and nothing else in the suite would notice**, which is precisely why it gets its own task and its own test.

The generic applier stays correct for entity types that carry no invariants. `task` has stopped being one. **Refusing `status` in a task payload at file time was considered and rejected**: the same discipline cannot be applied to the due-date keys, because spec C deliberately routes an under-privileged committed-date move *through* a change request, so refusing those keys at file time would delete the flow the guard is meant to protect. One door, one applier.

This document owns the `completed_at` half of that applier; spec C owns the due-date half and adds the mirror assertion for `original_due_date` to the same test file.

**Files:**
- Modify: `src/features/admin/change-request-appliers.ts:50-66`
- Modify: `src/features/admin/change-request-appliers.test.ts` (append)

**Interfaces:**
- Consumes: `transitionTaskStatus`, `isTaskStatus` from `src/features/sprints/task-status.ts` (Task 6).
- Produces: `function buildTaskApplyStatement(entityId: string, after: Record<string, unknown>)`; `buildApplyStatement` keeps its exported signature `(entityType: SupportedEntityType, entityId: string, after: Record<string, unknown>)` so `change-request-actions.ts:128` does not move.

- [ ] **Step 1: Write the failing test**

Append to `src/features/admin/change-request-appliers.test.ts`:

```ts
import { taskApplyPatch } from '@/features/admin/change-request-appliers'

describe('taskApplyPatch — the fourth door into tasks.status', () => {
  it('stamps completedAt when an approved request sets the status to done', () => {
    // No UI reaches this path, and nothing else in the suite would notice it
    // writing the status alone. That is the whole reason this test exists.
    const patch = taskApplyPatch({ status: 'done' }, new Date('2026-08-20T04:30:00.000Z'))
    expect(patch).toEqual({
      status: 'done',
      completedAt: new Date('2026-08-20T04:30:00.000Z'),
    })
  })

  it('clears completedAt when an approved request reopens a task', () => {
    const patch = taskApplyPatch({ status: 'todo' }, new Date('2026-08-20T04:30:00.000Z'))
    expect(patch).toEqual({ status: 'todo', completedAt: null })
  })

  it('carries the rest of the payload through untouched', () => {
    const patch = taskApplyPatch(
      { status: 'done', title: 'Ship it', assigneeId: 'u-2' },
      new Date('2026-08-20T04:30:00.000Z'),
    )
    expect(patch).toEqual({
      status: 'done',
      title: 'Ship it',
      assigneeId: 'u-2',
      completedAt: new Date('2026-08-20T04:30:00.000Z'),
    })
  })

  it('leaves a payload with no status entirely alone', () => {
    const patch = taskApplyPatch({ title: 'Ship it' }, new Date('2026-08-20T04:30:00.000Z'))
    expect(patch).toEqual({ title: 'Ship it' })
  })

  it('ignores a status value that is not a task status rather than inventing one', () => {
    // The payload is jsonb read back as Record<string, unknown>; there is no
    // zod schema on this path. A junk status must not produce a completedAt.
    const patch = taskApplyPatch({ status: 'archived' }, new Date('2026-08-20T04:30:00.000Z'))
    expect(patch).toEqual({ status: 'archived' })
  })

  it('does not mutate the payload it was given', () => {
    const after = { status: 'done' }
    taskApplyPatch(after, new Date('2026-08-20T04:30:00.000Z'))
    expect(after).toEqual({ status: 'done' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/admin/change-request-appliers.test.ts`
Expected: FAIL with `SyntaxError: The requested module '/src/features/admin/change-request-appliers.ts' does not provide an export named 'taskApplyPatch'`.

- [ ] **Step 3: Write minimal implementation**

In `src/features/admin/change-request-appliers.ts`, add to the imports:

```ts
import { isTaskStatus, transitionTaskStatus } from '@/features/sprints/task-status'
```

and replace `buildApplyStatement` (currently lines 58-66) with:

```ts
/**
 * The task payload, with the invariants a generic spread cannot carry.
 *
 * THE FOURTH DOOR INTO tasks.status, and the one with no UI. The generic
 * applier below is `db.update(table).set(after)` — a bare spread — so an
 * approved request carrying `status: 'done'` used to write the status, skip
 * transitionTaskStatus, and leave completed_at null: silently corrupting all
 * four workstreams that column exists for, through the one door that has a
 * reviewer attached to it.
 *
 * Pure and separately exported so it can be asserted without a database. The
 * generic applier stays correct for entity types that carry no invariants;
 * `task` has stopped being one.
 *
 * REJECTED: refusing `status` in a task payload at file time. The same
 * discipline cannot be applied to the due-date keys, because spec C
 * deliberately routes an under-privileged committed-date move THROUGH a change
 * request — refusing those keys at file time would delete the flow the guard
 * exists to protect. One door, one applier.
 *
 * This document owns the completed_at half. Spec C
 * (2026-08-20-deadlines-and-bugs-design.md) owns the due-date half and adds
 * `original_due_date` here, with its mirror assertion in this file's test.
 */
export function taskApplyPatch(
  after: Record<string, unknown>,
  now: Date,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { ...after }
  // isTaskStatus, not a bare presence check: `after` is jsonb read back as
  // Record<string, unknown> with no zod schema on this path, and a junk value
  // must not produce a completed_at.
  if (isTaskStatus(patch.status)) {
    Object.assign(patch, transitionTaskStatus(patch.status, now))
  }
  return patch
}

/** The one statement that applies an approved edit. Fed straight into db.batch. */
export function buildApplyStatement(
  entityType: SupportedEntityType,
  entityId: string,
  after: Record<string, unknown>,
) {
  const table = TABLES[entityType]
  const patch = entityType === 'task' ? taskApplyPatch(after, new Date()) : after
  return db.update(table).set(patch).where(eq(table.id, entityId))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/admin/change-request-appliers.test.ts && npx tsc --noEmit && npm test`
Expected: `change-request-appliers.test.ts` PASS — the pre-existing `detectConflict` and `SUPPORTED_ENTITY_TYPES` describes plus six new tests. `tsc` clean. Full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/change-request-appliers.ts src/features/admin/change-request-appliers.test.ts
git commit -m "fix(admin): an approved task change request stamps completed_at"
```

---

### Task 10: Migration — the two indexes that name only columns that exist today

`notifications` has **zero** indexes: `drizzle/0005` creates the table, three foreign keys and nothing else, while every signed-in browser polls it from 20s. `tasks_app_sprint_sort_idx` is keyed `(app_id, sprint_id, sort_order)` and cannot serve "my open tasks by due date", so every dashboard render is a full scan for every user on the most-visited page.

These two ship now because they are pure performance and can execute against today's schema. The three notification indexes whose predicates name `dismissed_at`, `dedupe_key` and `entity_type` wait for Task 16, which is the honest ordering — the spec's "every column they name exists today" is true of these two and not of those three.

**STOP CONDITIONS:** the same four as Task 7 — no migration runner, no `db:generate`, no hardcoded number, no editing an applied `.sql`.

**Files:**
- Modify: `src/db/schema.ts` — the `tasks` index array (line 348-352) and the `notifications` table (lines 709-720)
- Create: `drizzle/<allocated>_substrate_indexes.sql`
- Modify: `drizzle/meta/_journal.json`

**Interfaces:**
- Consumes: nothing.
- Produces: SQL indexes `tasks_assignee_due_open_idx` and `notifications_user_created_idx`. Task 16 adds the other three.

- [ ] **Step 1: Add the indexes to the schema**

In `src/db/schema.ts`, extend the `tasks` table's index array (currently one entry) to:

```ts
}, (t) => [
  // Covers the board's only read: filter (app_id, sprint_id), order by rank.
  // `tasks` had no index at all, so every board render was a full scan + sort.
  index('tasks_app_sprint_sort_idx').on(t.appId, t.sprintId, t.sortOrder).where(sql`${t.deletedAt} is null`),
  // "My open tasks, by when they are due" — the dashboard's own read, run for
  // every user on the most-visited page in the product. The sprint index above
  // is keyed (app_id, sprint_id, sort_order) and cannot serve it, so that read
  // is a full scan today. Partial on both axes because a done or trashed task
  // is never in the answer, which keeps the index roughly the size of the open
  // work rather than of the whole table's history.
  index('tasks_assignee_due_open_idx').on(t.assigneeId, t.dueDate)
    .where(sql`${t.deletedAt} is null and ${t.status} <> 'done'`),
])
```

Add an index array to the `notifications` table by replacing its closing `})` with:

```ts
}, (t) => [
  // The inbox read: this person's notifications, newest first. `notifications`
  // has had NO index since 0005 while every signed-in browser polls it from
  // 20s — the "two indexed queries" comment in actions.ts was false. This is
  // the half of it that needs no new column; the bell's own partial index
  // arrives with dismissed_at.
  index('notifications_user_created_idx').on(t.userId, t.createdAt.desc()),
])
```

- [ ] **Step 2: Allocate the migration number and write the SQL**

Run, from the repo root:

```bash
NEXT=$(printf '%04d' $(( 10#$(ls drizzle/*.sql | sed 's#.*/##' | cut -c1-4 | sort -n | tail -1) + 1 )))
echo "allocated: $NEXT"
cat > "drizzle/${NEXT}_substrate_indexes.sql" <<'SQL'
-- Two indexes on two tables that are read constantly and indexed for it
-- barely at all. Pure performance: no column changes, no reader changes.
--
-- WHY ONLY TWO, when the design lists six. The other four name columns that do
-- not exist yet (dismissed_at, dedupe_key, dedupe_permanent, entity_type), and
-- an index cannot be created against a column that is not there. They ship in
-- the migration that follows the notifications columns. Splitting them this way
-- is what lets the cheap half land ahead of the substrate work rather than
-- behind it.
--
-- Replay-safe: CREATE INDEX IF NOT EXISTS throughout.

-- "My open tasks, by when they are due". Every dashboard render runs this, for
-- every user, on the most-visited page in the product, and today it is a full
-- scan: tasks_app_sprint_sort_idx is keyed (app_id, sprint_id, sort_order) and
-- cannot serve it. Partial on both axes — a done or trashed task is never in
-- the answer — so the index stays roughly the size of the open work.
CREATE INDEX IF NOT EXISTS "tasks_assignee_due_open_idx" ON "tasks" USING btree ("assignee_id","due_date") WHERE "tasks"."deleted_at" is null and "tasks"."status" <> 'done';
--> statement-breakpoint
-- The notification inbox: one person's rows, newest first. `notifications` has
-- carried ZERO indexes since 0005 — the table, three foreign keys, nothing
-- else — while every signed-in browser has polled it from 20 seconds. The
-- comment beside that poll claiming "two indexed queries" has been false the
-- whole time. This is the half that needs no new column.
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC);
SQL
node -e '
const fs = require("node:fs")
const p = "drizzle/meta/_journal.json"
const tag = process.argv[1]
const j = JSON.parse(fs.readFileSync(p, "utf8"))
if (j.entries.some((e) => e.tag === tag)) { console.log("journal already has", tag); process.exit(0) }
const idx = Number(tag.slice(0, 4))
const when = Math.max(...j.entries.map((e) => e.when)) + 100000
j.entries.push({ idx, version: "7", when, tag, breakpoints: true })
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n")
console.log("journal appended:", tag, "idx", idx, "when", when)
' "${NEXT}_substrate_indexes"
```

- [ ] **Step 3: Verify without running it**

Run:

```bash
git status --short drizzle/ src/db/schema.ts
grep -c 'statement-breakpoint' drizzle/*_substrate_indexes.sql
node -e 'JSON.parse(require("node:fs").readFileSync("drizzle/meta/_journal.json","utf8")); console.log("journal parses")'
npx tsc --noEmit
npm test
```

Expected: exactly one `--> statement-breakpoint` (two statements). `journal parses`. `tsc` clean. Full suite PASS, including `src/db/live.test.ts` — no `deletedAt` was added, so check 5 is unaffected.

- [ ] **Step 4: STOP — request human approval before any database touches this**

Print this and wait:

> Migration `<allocated>_substrate_indexes.sql` is written and the journal entry appended. **I have not run it.** Verification after it runs, against `information_schema` rather than the runner's exit code:
>
> ```sql
> SELECT indexname FROM pg_indexes
> WHERE indexname IN ('tasks_assignee_due_open_idx', 'notifications_user_created_idx')
> ORDER BY indexname;
> ```
>
> Expected: exactly two rows.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/meta/_journal.json drizzle/*_substrate_indexes.sql
git commit -m "perf(db): index my-open-tasks-by-due-date and the notification inbox"
```

---

### Task 11: Notification kinds and render-at-read-time text

`notifications.title` is a denormalized English sentence written at insert time. LogPup's user-facing surfaces are bilingual Sinhala + English, so a stored sentence is a permanent decision made at write time about a reader whose language is not known until read time. There is no cheap retrofit — the rows most worth translating are the ones already written — which is why this sits in the substrate rather than being deferred to whichever feature notices first.

**`params` carries ids, not names.** Freezing `actorName` or `appName` into jsonb is a stored sentence with extra steps: a person renames, an app is renamed, and every historical row keeps the old label for as long as it lives. Where a fallback is genuinely needed for an actor who has since been purged, it is a clearly-named snapshot (`actorLabel`) the renderer falls back to **only** when the id resolves to nothing — the convention `activity_log` already sets with `entityLabel`.

**Files:**
- Create: `src/features/notifications/kinds.ts`
- Create: `src/features/notifications/text.ts`
- Test: `src/features/notifications/text.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `const NOTIFICATION_KINDS`, `type NotificationKind`, `function isNotificationKind(value: string): value is NotificationKind` from `kinds.ts`; `type NotificationParams`, `type ResolvedNames`, `const NOTIFICATION_TEXT`, `const OVERFLOW_TITLE_KEY`, `function renderNotification(row, names): { title: string; href: string | null }` from `text.ts`. Tasks 12, 17, 18 and 19 all import these.

- [ ] **Step 1: Write the failing test**

Create `src/features/notifications/text.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { NOTIFICATION_KINDS, isNotificationKind } from './kinds'
import { NOTIFICATION_TEXT, OVERFLOW_TITLE_KEY, renderNotification } from './text'

const NAMES = new Map<string, string>([
  ['u-1', 'Shanika'],
  ['app-a', 'LogPup'],
  ['m-1', 'Weekly sync'],
])

const row = (over: Partial<Parameters<typeof renderNotification>[0]> = {}) => ({
  titleKey: null,
  params: null,
  title: null,
  link: null,
  collapseCount: 1,
  ...over,
})

describe('NOTIFICATION_KINDS', () => {
  it('is the closed set this substrate ships with, and adds no feature kind', () => {
    expect([...NOTIFICATION_KINDS]).toEqual(['legacy', 'mention', 'meeting', 'system.overflow'])
  })

  it('narrows a string to a kind', () => {
    expect(isNotificationKind('mention')).toBe(true)
    expect(isNotificationKind('task.offered')).toBe(false)
  })
})

describe('renderNotification', () => {
  it('resolves an actor id to the CURRENT name, never a frozen one', () => {
    const out = renderNotification(
      row({ titleKey: 'notif.mention.app', params: { actorId: 'u-1', appId: 'app-a' } }),
      NAMES,
    )
    expect(out.title).toBe('Shanika mentioned you in LogPup')
  })

  it('falls back to the actorLabel snapshot only when the id resolves to nothing', () => {
    const out = renderNotification(
      row({
        titleKey: 'notif.mention.app',
        params: { actorId: 'u-gone', actorLabel: 'Nuwan', appId: 'app-a' },
      }),
      NAMES,
    )
    expect(out.title).toBe('Nuwan mentioned you in LogPup')
  })

  it('prefers the live name over the snapshot when both are present', () => {
    // The whole reason params carries ids: a rename must move every historical
    // row, and a snapshot that wins would defeat that on every row that has one.
    const out = renderNotification(
      row({
        titleKey: 'notif.mention.app',
        params: { actorId: 'u-1', actorLabel: 'Old Name', appId: 'app-a' },
      }),
      NAMES,
    )
    expect(out.title).toBe('Shanika mentioned you in LogPup')
  })

  it('degrades a subject that no longer resolves rather than rendering a blank', () => {
    const out = renderNotification(
      row({ titleKey: 'notif.mention.app', params: { actorId: 'u-1', appId: 'app-gone' } }),
      NAMES,
    )
    expect(out.title).toBe('Shanika mentioned you in a project that is no longer available')
  })

  it('renders the overflow row from its count', () => {
    const out = renderNotification(
      row({
        titleKey: OVERFLOW_TITLE_KEY,
        params: { count: 4, href: '/notifications?day=2026-08-20' },
        collapseCount: 4,
      }),
      NAMES,
    )
    expect(out.title).toBe('4 more updates today')
    expect(out.href).toBe('/notifications?day=2026-08-20')
  })

  it('says "1 new comment" and "5 new comments" from collapseCount', () => {
    expect(renderNotification(
      row({ titleKey: 'notif.meeting.invited', params: { actorId: 'u-1', meetingId: 'm-1' }, collapseCount: 1 }),
      NAMES,
    ).title).toBe('Shanika invited you to Weekly sync')
    expect(renderNotification(
      row({ titleKey: 'notif.meeting.invited', params: { actorId: 'u-1', meetingId: 'm-1' }, collapseCount: 3 }),
      NAMES,
    ).title).toBe('Shanika invited you to Weekly sync (3×)')
  })

  it('falls back to the stored sentence for a pre-substrate row', () => {
    // title/body stay as columns precisely for these rows, and are never
    // written again. A backfill is a later, separate migration.
    const out = renderNotification(
      row({ title: 'Nuwan mentioned you', link: '/apps/logpup?tab=discussion' }),
      NAMES,
    )
    expect(out.title).toBe('Nuwan mentioned you')
    expect(out.href).toBe('/apps/logpup?tab=discussion')
  })

  it('falls back to the stored sentence for a key nobody registered', () => {
    const out = renderNotification(
      row({ titleKey: 'notif.from.the.future', params: {}, title: 'Something happened' }),
      NAMES,
    )
    expect(out.title).toBe('Something happened')
  })

  it('never renders an empty string, whatever it was handed', () => {
    expect(renderNotification(row(), NAMES).title).toBe('Notification')
  })

  it('registers a template for every key its own writers use', () => {
    for (const key of [
      'notif.mention.app',
      'notif.mention.meeting',
      'notif.meeting.invited',
      'notif.meeting.moved',
      'notif.meeting.added',
      'notif.task.auto_assigned',
      OVERFLOW_TITLE_KEY,
    ]) {
      expect(Object.keys(NOTIFICATION_TEXT)).toContain(key)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/notifications/text.test.ts`
Expected: FAIL with `Error: Failed to load url ./kinds (resolved id: ./kinds) ... Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/notifications/kinds.ts`:

```ts
/**
 * Every kind of notification that exists.
 *
 * TEXT IN THE DATABASE, NOT A pgEnum — the precedent activity_log.verb already
 * sets in this schema, for the reason given there: a new kind should be a
 * string at a call site, not a migration. This list is the TypeScript half of
 * that contract and budget.test.ts is what stops it drifting from the budget.
 *
 * THIS SUBSTRATE SHIPS ZERO SPENDABLE KINDS. `mention` and `meeting` are the
 * two that already exist (backfilled from the old two-value `type` column);
 * `legacy` is what a pre-substrate row without either becomes. Adding a kind
 * before the mechanism exists is the sequence that produces the volume
 * incident, so specs B and C add theirs on top of this.
 *
 * `system.overflow` is not a kind any call site may emit. The per-recipient
 * daily cap PRODUCES it, and it is exempt from the budget for that reason: it
 * is the mechanism's own pressure valve, not volume a feature spends.
 */
export const NOTIFICATION_KINDS = [
  'legacy',
  'mention',
  'meeting',
  'system.overflow',
] as const

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value)
}
```

Create `src/features/notifications/text.ts`:

```ts
import type { NotificationKind } from './kinds'

/**
 * Notification text is a KEY and a PARAMETER BAG, never a frozen string.
 *
 * `notifications.title` was a denormalized English sentence written at insert
 * time. LogPup's surfaces are bilingual Sinhala + English, so a stored sentence
 * is a permanent decision made at write time about a reader whose language is
 * not known until read time. There is no cheap retrofit — the rows most worth
 * translating are the ones already written — which is why this lives in the
 * substrate rather than in whichever feature notices first.
 *
 * PARAMS CARRY IDS, NOT NAMES. actorId, appId, taskId, meetingId, resolved to
 * current display names in the read-time pass. Freezing `actorName` into jsonb
 * is a stored sentence with extra steps: a person renames, an app is renamed,
 * and every historical row keeps the old label for as long as it lives.
 *
 * Where a fallback is genuinely needed — an actor since purged — it is a
 * clearly-named SNAPSHOT (`actorLabel`) that the renderer reaches for ONLY when
 * the id resolves to nothing. That is the convention activity_log already sets
 * with entityLabel, and specs B and C carry it unchanged.
 */
export type NotificationParams = {
  actorId?: string
  /** Snapshot fallback, used only when actorId resolves to nothing. */
  actorLabel?: string
  appId?: string
  taskId?: string
  meetingId?: string
  /** Overflow only: how many events the daily cap suppressed. */
  count?: number
  /** Overflow only: where the row's link goes. */
  href?: string
}

/** id -> current display name, assembled by the read-time pass. */
export type ResolvedNames = ReadonlyMap<string, string>

export type RenderableNotification = {
  titleKey: string | null
  params: NotificationParams | null
  /** Pre-substrate rows only. Never written again. */
  title: string | null
  link: string | null
  collapseCount: number
}

export const OVERFLOW_TITLE_KEY = 'notif.overflow.more'

/** What a subject reads as once the thing it named is gone. */
const GONE_APP = 'a project that is no longer available'
const GONE_MEETING = 'a meeting that is no longer available'

function actorName(params: NotificationParams, names: ResolvedNames): string {
  const live = params.actorId ? names.get(params.actorId) : undefined
  return live ?? params.actorLabel ?? 'Someone'
}

type Template = (params: NotificationParams, names: ResolvedNames) => string

/**
 * One template per key. Adding a key here is the whole cost of a new
 * notification sentence; the writers pass ids and this decides the words.
 *
 * Sinhala templates are deliberately NOT in this file yet: a second locale is
 * a second Record keyed the same way, selected by the reader's preference, and
 * that selection belongs with the locale work rather than here. What matters
 * for the substrate is that the DECISION is now made at read time, which is the
 * thing a stored sentence made impossible.
 */
export const NOTIFICATION_TEXT: Record<string, Template> = {
  'notif.mention.app': (p, names) =>
    `${actorName(p, names)} mentioned you in ${(p.appId && names.get(p.appId)) ?? GONE_APP}`,
  'notif.mention.meeting': (p, names) =>
    `${actorName(p, names)} mentioned you in ${(p.meetingId && names.get(p.meetingId)) ?? GONE_MEETING}`,
  'notif.meeting.invited': (p, names) =>
    `${actorName(p, names)} invited you to ${(p.meetingId && names.get(p.meetingId)) ?? GONE_MEETING}`,
  'notif.meeting.moved': (p, names) =>
    `${actorName(p, names)} moved ${(p.meetingId && names.get(p.meetingId)) ?? GONE_MEETING}`,
  'notif.meeting.added': (p, names) =>
    `${actorName(p, names)} added you to ${(p.meetingId && names.get(p.meetingId)) ?? GONE_MEETING}`,
  'notif.task.auto_assigned': (p, names) =>
    `${actorName(p, names)} assigned you a task from ${(p.meetingId && names.get(p.meetingId)) ?? GONE_MEETING}`,
  [OVERFLOW_TITLE_KEY]: (p) =>
    `${p.count ?? 0} more update${(p.count ?? 0) === 1 ? '' : 's'} today`,
}

/**
 * The read-time pass.
 *
 * Falls back to the stored sentence when there is no key, or when the key is
 * one this build has never heard of — a row written by a newer deploy must
 * still render on an older one rather than showing nothing.
 *
 * A collapsed row wears its count. The overflow row states its own count in
 * its template, so it is excluded from the suffix rather than saying it twice.
 */
export function renderNotification(
  row: RenderableNotification,
  names: ResolvedNames,
): { title: string; href: string | null } {
  const template = row.titleKey ? NOTIFICATION_TEXT[row.titleKey] : undefined
  const params = row.params ?? {}
  const base = template ? template(params, names) : (row.title ?? '')
  const withCount =
    row.collapseCount > 1 && row.titleKey !== OVERFLOW_TITLE_KEY
      ? `${base} (${row.collapseCount}×)`
      : base
  return {
    title: withCount.trim() === '' ? 'Notification' : withCount,
    href: params.href ?? row.link,
  }
}

/** The kind a row without one is read as. Keeps the column's default honest. */
export const DEFAULT_KIND: NotificationKind = 'legacy'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/notifications/text.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/kinds.ts src/features/notifications/text.ts src/features/notifications/text.test.ts
git commit -m "feat(notifications): render text from a key and a parameter bag at read time"
```

---

### Task 12: The volume budget and the per-recipient daily cap

Volume is the failure this whole substrate is built against, so the ceiling belongs here rather than in whichever feature spec happened to state it first. **This module owns the number.** A ceiling stated as prose inside a feature spec is a number nobody can enforce and every later spec forgets; a ceiling written into the one function every kind must pass through is a number that survives specs C and D and the kinds nobody has scoped yet.

It is also the only thing that bounds a **burst**: spec C's ladder keys on the due date, so one sprint slip touching twenty tasks legitimately re-arms twenty ladders on the next tick, and no per-kind rule anywhere can see that the same person is on the receiving end of all of them.

Two properties, stated so nobody later "simplifies" them away:

- **Overflow collapses; it never drops.** The count is real and the row is a door, not a tombstone.
- **The suppressed facts stay reachable.** Each still sits on its own surface, and the daily digest is assembled from the *events* rather than from the bell rows, so a capped day still emails in full. The trade being accepted out loud: rows past the cap are absent from the bell **and** the inbox, because keeping them in the inbox needs a "hidden from bell" column and still pays for the write.

**Files:**
- Create: `src/features/notifications/budget.ts`
- Test: `src/features/notifications/budget.test.ts`

**Interfaces:**
- Consumes: `NOTIFICATION_KINDS`, `type NotificationKind` from `./kinds` (Task 11).
- Produces: `const NOTIFICATION_DAILY_CAP`, `const EXEMPT_KINDS`, `const KIND_BUDGET`, `type CapDraft`, `type CapDecision`, `function applyDailyCap(drafts, alreadyToday): CapDecision`. Task 17 calls `applyDailyCap`.

- [ ] **Step 1: Write the failing test**

Create `src/features/notifications/budget.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { NOTIFICATION_KINDS } from './kinds'
import { EXEMPT_KINDS, KIND_BUDGET, NOTIFICATION_DAILY_CAP, applyDailyCap } from './budget'

const draft = (userId: string, kind = 'mention') => ({ userId, kind })

describe('the budget ledger', () => {
  it('caps a person at five immediate notifications per weekday', () => {
    expect(NOTIFICATION_DAILY_CAP).toBe(5)
  })

  it('costs every kind that exists, so a kind cannot ship uncosted', () => {
    // "It will be low volume" is not a number. A spec that adds a kind adds a
    // row here with a real number BEFORE it ships.
    for (const kind of NOTIFICATION_KINDS) {
      if ((EXEMPT_KINDS as readonly string[]).includes(kind)) continue
      expect(Object.keys(KIND_BUDGET)).toContain(kind)
    }
  })

  it("exempts only the cap mechanism's own valve", () => {
    expect([...EXEMPT_KINDS]).toEqual(['system.overflow'])
  })

  it('keeps the declared budgets under the ceiling', () => {
    const total = Object.values(KIND_BUDGET).reduce((sum, n) => sum + n, 0)
    expect(total).toBeLessThanOrEqual(NOTIFICATION_DAILY_CAP)
  })

  it('leaves real headroom for specs B and C', () => {
    const total = Object.values(KIND_BUDGET).reduce((sum, n) => sum + n, 0)
    expect(NOTIFICATION_DAILY_CAP - total).toBeGreaterThanOrEqual(3)
  })

  it('has no budget row for a kind that no longer exists', () => {
    for (const kind of Object.keys(KIND_BUDGET)) {
      expect(NOTIFICATION_KINDS as readonly string[]).toContain(kind)
    }
  })
})

describe('applyDailyCap', () => {
  it('lets the fifth row of a day land normally', () => {
    const decision = applyDailyCap([draft('u-1')], new Map([['u-1', 4]]))
    expect(decision.emit).toEqual([draft('u-1')])
    expect(decision.overflow).toEqual([])
  })

  it('turns the sixth into an overflow row rather than dropping it', () => {
    // A DROPPED EVENT FAILS THIS TEST, which is the point. Silently discarding
    // the sixth event is the failure the cap exists to prevent, not a cheaper
    // version of it.
    const decision = applyDailyCap([draft('u-1')], new Map([['u-1', 5]]))
    expect(decision.emit).toEqual([])
    expect(decision.overflow).toEqual([{ userId: 'u-1', suppressed: 1 }])
  })

  it('collapses the seventh into the same overflow row instead of adding another', () => {
    const decision = applyDailyCap([draft('u-1'), draft('u-1')], new Map([['u-1', 5]]))
    expect(decision.emit).toEqual([])
    expect(decision.overflow).toEqual([{ userId: 'u-1', suppressed: 2 }])
  })

  it('counts the overflow row against the number ACTUALLY suppressed', () => {
    const drafts = [draft('u-1'), draft('u-1'), draft('u-1'), draft('u-1')]
    const decision = applyDailyCap(drafts, new Map([['u-1', 3]]))
    expect(decision.emit).toHaveLength(2)
    expect(decision.overflow).toEqual([{ userId: 'u-1', suppressed: 2 }])
  })

  it('caps each recipient independently', () => {
    const drafts = [draft('u-1'), draft('u-2')]
    const decision = applyDailyCap(drafts, new Map([['u-1', 5], ['u-2', 0]]))
    expect(decision.emit).toEqual([draft('u-2')])
    expect(decision.overflow).toEqual([{ userId: 'u-1', suppressed: 1 }])
  })

  it('treats an absent count as zero rows so far today', () => {
    const decision = applyDailyCap([draft('u-3')], new Map())
    expect(decision.emit).toEqual([draft('u-3')])
    expect(decision.overflow).toEqual([])
  })

  it('never lets an exempt kind be suppressed by the cap it implements', () => {
    const decision = applyDailyCap(
      [{ userId: 'u-1', kind: 'system.overflow' }],
      new Map([['u-1', 9]]),
    )
    expect(decision.emit).toEqual([{ userId: 'u-1', kind: 'system.overflow' }])
    expect(decision.overflow).toEqual([])
  })

  it('preserves draft order within a recipient, so the first five of a burst land', () => {
    const drafts = [
      { userId: 'u-1', kind: 'mention' },
      { userId: 'u-1', kind: 'meeting' },
    ]
    const decision = applyDailyCap(drafts, new Map([['u-1', 4]]))
    expect(decision.emit).toEqual([{ userId: 'u-1', kind: 'mention' }])
    expect(decision.overflow).toEqual([{ userId: 'u-1', suppressed: 1 }])
  })

  it('is a no-op on empty input', () => {
    expect(applyDailyCap([], new Map())).toEqual({ emit: [], overflow: [] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/notifications/budget.test.ts`
Expected: FAIL with `Error: Failed to load url ./budget (resolved id: ./budget) ... Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/notifications/budget.ts`:

```ts
import { NOTIFICATION_KINDS, type NotificationKind } from './kinds'

/**
 * THE CEILING, AND THE PLACE THAT OWNS IT.
 *
 * At most five immediate in-app notifications per person per weekday. The
 * KIND_BUDGET table below says what the system is SUPPOSED to cost; the cap is
 * what happens when it costs more.
 *
 * This number lived as prose in a feature spec, referenced by no other spec,
 * and the next spec's three daily-sweep kinds consumed more than the whole
 * headroom that prose had reserved for three specs combined. A ceiling stated
 * in prose is a number nobody can enforce; a ceiling written into the one
 * function every kind passes through survives the kinds nobody has scoped yet.
 *
 * It is also the only thing that bounds a BURST. An escalation ladder keyed on
 * a due date legitimately re-arms twenty times when one sprint slips, and no
 * per-kind rule anywhere can see that the same person is on the receiving end
 * of all twenty.
 */
export const NOTIFICATION_DAILY_CAP = 5

/**
 * The one kind the cap must never suppress: its own overflow row.
 *
 * Exempt because it is the mechanism's pressure valve rather than volume a
 * feature spends. Suppressing it would mean a capped day silently loses the
 * row that says the day was capped.
 */
export const EXEMPT_KINDS = ['system.overflow'] as const

/**
 * Declared cost per recipient per weekday, per kind.
 *
 * THREE RULES COME WITH THIS TABLE, each because the informal version failed:
 *
 *  - A spec that adds a kind adds a row here with a REAL NUMBER before it
 *    ships. "It will be low volume" is not a number, and budget.test.ts fails
 *    the build for a kind with no row.
 *  - A fan-out is priced per RECIPIENT, not per event. One breached item that
 *    copies the PM is two rows.
 *  - A sweep-driven kind is priced over the item's LIFE, not per tick. A kind
 *    whose cost cannot be written that way does not belong on a daily sweep.
 *
 * The two rows below are the kinds that already exist, and they are the reason
 * the remaining headroom is 3.5 rather than the whole 5. Spec B's `mention`
 * row IS this row — it is not counted twice.
 */
export const KIND_BUDGET: Readonly<Record<string, number>> = {
  legacy: 0,
  mention: 1.0,
  meeting: 0.5,
} satisfies Partial<Record<NotificationKind, number>>

export type CapDraft = { userId: string; kind: string }

export type CapDecision = {
  /** Rows that get their own notification. */
  emit: CapDraft[]
  /** One entry per capped recipient, carrying how many events it stands for. */
  overflow: { userId: string; suppressed: number }[]
}

/**
 * The cap, as a pure function over drafts and today's per-recipient counts.
 *
 * TWO PROPERTIES, stated so nobody later "simplifies" them away:
 *
 *  - OVERFLOW COLLAPSES; IT NEVER DROPS. Every suppressed event is counted, and
 *    the count is what the overflow row renders. Silently discarding the sixth
 *    event is the failure this cap exists to prevent, not a cheaper version of
 *    it. budget.test.ts asserts the count equals the number suppressed.
 *  - THE SUPPRESSED FACTS STAY REACHABLE. Each still sits on its own surface —
 *    the task, the promises list, the organizer — and the daily digest is
 *    assembled from the EVENTS rather than from the bell rows, so a capped day
 *    still emails in full. The trade, said out loud: rows past the cap are
 *    absent from the bell AND the inbox, because keeping them in the inbox
 *    needs a "hidden from bell" column and still pays for the write.
 *
 * Draft order is preserved within a recipient, so the first arrivals of a burst
 * are the ones that land.
 */
export function applyDailyCap(
  drafts: readonly CapDraft[],
  alreadyToday: ReadonlyMap<string, number>,
): CapDecision {
  const emit: CapDraft[] = []
  const suppressed = new Map<string, number>()
  const used = new Map<string, number>()

  for (const draft of drafts) {
    if ((EXEMPT_KINDS as readonly string[]).includes(draft.kind)) {
      emit.push(draft)
      continue
    }
    const spent = (alreadyToday.get(draft.userId) ?? 0) + (used.get(draft.userId) ?? 0)
    if (spent < NOTIFICATION_DAILY_CAP) {
      emit.push(draft)
      used.set(draft.userId, (used.get(draft.userId) ?? 0) + 1)
      continue
    }
    suppressed.set(draft.userId, (suppressed.get(draft.userId) ?? 0) + 1)
  }

  return {
    emit,
    overflow: [...suppressed].map(([userId, count]) => ({ userId, suppressed: count })),
  }
}

/** Every kind, for the ledger test. Re-exported so budget.test.ts imports one module. */
export { NOTIFICATION_KINDS }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/notifications/budget.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/budget.ts src/features/notifications/budget.test.ts
git commit -m "feat(notifications): own the volume budget and enforce a per-recipient daily cap"
```

---

### Task 13: Dedupe as a storage-layer guarantee, with two semantics

Two partial unique indexes, and each notification kind declares which it uses. This module is the pure decision the writer asks before it builds an `ON CONFLICT`, and it is what the two indexes in Task 16 are shaped to enforce.

**Permanent** — escalation ladders. Key format `deadline:{taskId}:{step}:{dueDate}`, so a legitimately moved date re-arms the ladder while a re-run of the daily tick fires nothing.

**Collapsing** — comments, mentions, accepted suggestions. Scoped `WHERE read = false AND dismissed_at IS NULL` so it resets once the reader has caught up; the next event after that opens a fresh row rather than silently incrementing one already dismissed.

**Collapse on the ENTITY, never the event**: five comments on one task are one row reading "5 new comments", keyed `task:{id}:comment`.

**Files:**
- Create: `src/features/notifications/dedupe.ts`
- Test: `src/features/notifications/dedupe.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type DedupeSemantics`, `type ExistingDedupeRow`, `type DedupeOutcome`, `function permanentKey(parts)`, `function entityCollapseKey(entityType, entityId, event)`, `function overflowKey(userId, tickDate)`, `function dedupeOutcome(semantics, existing)`. Tasks 17 and 19 import these.

- [ ] **Step 1: Write the failing test**

Create `src/features/notifications/dedupe.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  dedupeOutcome,
  entityCollapseKey,
  overflowKey,
  permanentKey,
  type ExistingDedupeRow,
} from './dedupe'

const existing = (over: Partial<ExistingDedupeRow> = {}): ExistingDedupeRow => ({
  collapseCount: 1,
  read: false,
  dismissedAt: null,
  ...over,
})

describe('key builders', () => {
  it('builds a permanent ladder key that re-arms on a changed due date', () => {
    const first = permanentKey(['deadline', 't-1', 'due_soon', '2026-08-25'])
    const moved = permanentKey(['deadline', 't-1', 'due_soon', '2026-09-01'])
    expect(first).toBe('deadline:t-1:due_soon:2026-08-25')
    expect(moved).not.toBe(first)
  })

  it('builds the same permanent key for a repeat of the same tick', () => {
    expect(permanentKey(['deadline', 't-1', 'due_soon', '2026-08-25']))
      .toBe(permanentKey(['deadline', 't-1', 'due_soon', '2026-08-25']))
  })

  it('collapses on the ENTITY, never the event', () => {
    // Five comments on one task are one row reading "5 new comments".
    expect(entityCollapseKey('task', 't-1', 'comment')).toBe('task:t-1:comment')
    expect(entityCollapseKey('task', 't-1', 'comment'))
      .toBe(entityCollapseKey('task', 't-1', 'comment'))
    expect(entityCollapseKey('task', 't-2', 'comment'))
      .not.toBe(entityCollapseKey('task', 't-1', 'comment'))
  })

  it('keys the overflow row per recipient per day', () => {
    expect(overflowKey('u-1', '2026-08-20')).toBe('notif:overflow:u-1:2026-08-20')
    expect(overflowKey('u-1', '2026-08-21')).not.toBe(overflowKey('u-1', '2026-08-20'))
  })
})

describe('dedupeOutcome — permanent', () => {
  it('inserts when the ladder rung has never fired', () => {
    expect(dedupeOutcome('permanent', null)).toEqual({ action: 'insert' })
  })

  it('does nothing on a re-run of the same daily tick', () => {
    expect(dedupeOutcome('permanent', existing())).toEqual({ action: 'skip' })
  })

  it('still does nothing once the rung has been read or dismissed', () => {
    // Permanent means permanent: a rung that already fired must not fire again
    // just because its reader cleared it.
    expect(dedupeOutcome('permanent', existing({ read: true }))).toEqual({ action: 'skip' })
    expect(dedupeOutcome('permanent', existing({ dismissedAt: new Date() })))
      .toEqual({ action: 'skip' })
  })
})

describe('dedupeOutcome — collapsing', () => {
  it('inserts the first event on an entity', () => {
    expect(dedupeOutcome('collapsing', null)).toEqual({ action: 'insert' })
  })

  it('increments while the reader has not caught up', () => {
    expect(dedupeOutcome('collapsing', existing({ collapseCount: 1 })))
      .toEqual({ action: 'increment', to: 2 })
    expect(dedupeOutcome('collapsing', existing({ collapseCount: 4 })))
      .toEqual({ action: 'increment', to: 5 })
  })

  it('opens a FRESH row once the reader has read it', () => {
    // The index is scoped WHERE read = false AND dismissed_at IS NULL, so a
    // read row no longer participates. The next event is genuinely new.
    expect(dedupeOutcome('collapsing', existing({ read: true }))).toEqual({ action: 'insert' })
  })

  it('opens a fresh row once the reader has dismissed it', () => {
    expect(dedupeOutcome('collapsing', existing({ dismissedAt: new Date() })))
      .toEqual({ action: 'insert' })
  })

  it('never silently increments a row the reader already cleared', () => {
    const outcome = dedupeOutcome('collapsing', existing({ read: true, collapseCount: 9 }))
    expect(outcome.action).toBe('insert')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/notifications/dedupe.test.ts`
Expected: FAIL with `Error: Failed to load url ./dedupe (resolved id: ./dedupe) ... Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/notifications/dedupe.ts`:

```ts
/**
 * Dedupe is a STORAGE-LAYER guarantee, with two semantics, and each kind
 * declares which one it uses.
 *
 * The two partial unique indexes on `notifications` are what actually enforce
 * this; the functions here are the pure decision a writer makes before it
 * builds an ON CONFLICT clause, and the shape those indexes are cut to fit.
 */
export type DedupeSemantics = 'permanent' | 'collapsing'

/** The row already sitting under this (user_id, dedupe_key), if any. */
export type ExistingDedupeRow = {
  collapseCount: number
  read: boolean
  dismissedAt: Date | null
}

export type DedupeOutcome =
  | { action: 'insert' }
  | { action: 'skip' }
  | { action: 'increment'; to: number }

/**
 * PERMANENT — escalation ladders.
 *
 * `deadline:{taskId}:{step}:{dueDate}`. The due date is IN the key on purpose:
 * a legitimately moved date re-arms the ladder, while a re-run of the daily
 * tick against an unchanged date fires nothing. ON CONFLICT DO NOTHING.
 */
export function permanentKey(parts: readonly string[]): string {
  return parts.join(':')
}

/**
 * COLLAPSING — comments, mentions, accepted suggestions.
 *
 * Keyed on the ENTITY, never the event: five comments on one task are ONE row
 * reading "5 new comments", not five rows. `task:{id}:comment`.
 */
export function entityCollapseKey(entityType: string, entityId: string, event: string): string {
  return `${entityType}:${entityId}:${event}`
}

/**
 * The daily cap's own row, one per recipient per Colombo day.
 *
 * Collapsing, so the seventh suppressed event of a day increments the row the
 * sixth opened rather than adding a second one.
 */
export function overflowKey(userId: string, tickDate: string): string {
  return `notif:overflow:${userId}:${tickDate}`
}

/**
 * What to do about a row that may already exist under this key.
 *
 * Permanent skips forever once fired — including after the reader clears it,
 * because "permanent" is exactly the promise that a rung fires once per key.
 *
 * Collapsing increments only while the reader has NOT caught up, because the
 * unique index it relies on is scoped `WHERE read = false AND dismissed_at IS
 * NULL`. Once the reader has read or dismissed the row it leaves the index, and
 * the next event opens a fresh row rather than silently incrementing one that
 * is already off the reader's screen.
 */
export function dedupeOutcome(
  semantics: DedupeSemantics,
  existing: ExistingDedupeRow | null,
): DedupeOutcome {
  if (existing === null) return { action: 'insert' }
  if (semantics === 'permanent') return { action: 'skip' }
  if (existing.read || existing.dismissedAt !== null) return { action: 'insert' }
  return { action: 'increment', to: existing.collapseCount + 1 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/notifications/dedupe.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/dedupe.ts src/features/notifications/dedupe.test.ts
git commit -m "feat(notifications): add the two dedupe semantics as a pure decision"
```

---

### Task 14: Recipient filtering, as a pure decision

Today every call site decides who may receive a row, and no call site does. The result: a deactivated contractor is still mentionable and still accrues rows, and a notification can point at a soft-deleted entity and 404 on click.

This module is the decision; Task 17 is the choke point that runs it. Doing it in one function rather than seven call sites is the whole point — it is the property that stays true when spec B adds three more call sites.

**Files:**
- Create: `src/features/notifications/recipients.ts`
- Test: `src/features/notifications/recipients.test.ts`

**Interfaces:**
- Consumes: `can`, `type Action`, `type Actor` from `@/features/auth/capabilities`.
- Produces: `type NotificationEntityType`, `const REACH_ACTION`, `type RecipientCandidate`, `type ReachTarget`, `type DropReason`, `type RecipientDecision`, `function selectRecipients(candidates, opts): RecipientDecision[]`. Task 17 calls it.

- [ ] **Step 1: Write the failing test**

Create `src/features/notifications/recipients.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Actor, UserRole } from '@/features/auth/capabilities'
import {
  REACH_ACTION,
  selectRecipients,
  type ReachTarget,
  type RecipientCandidate,
} from './recipients'

const actor = (id: string, role: UserRole, apps: string[] = []): Actor => ({
  id,
  role,
  scopeAppIds: new Set(apps),
})

const candidate = (
  id: string,
  role: UserRole,
  over: Partial<RecipientCandidate> = {},
): RecipientCandidate => ({
  actor: actor(id, role, over.actor?.scopeAppIds ? [...over.actor.scopeAppIds] : []),
  active: true,
  status: 'approved',
  ...over,
})

const target = (over: Partial<ReachTarget> = {}): ReachTarget => ({
  entityType: 'task',
  appIds: ['app-a'],
  deleted: false,
  ...over,
})

describe('REACH_ACTION', () => {
  it("asks the matrix the same question the entity's own page asks", () => {
    expect(REACH_ACTION).toEqual({
      app: 'app.view',
      task: 'app.view',
      sprint: 'app.view',
      meeting: 'meeting.intel.view',
    })
  })
})

describe('selectRecipients', () => {
  it('keeps an approved, active, in-scope recipient', () => {
    const decisions = selectRecipients(
      [candidate('u-1', 'member', { actor: actor('u-1', 'member', ['app-a']) })],
      { actorId: 'u-9', target: target() },
    )
    expect(decisions).toEqual([{ userId: 'u-1', keep: true }])
  })

  it('drops a deactivated recipient', () => {
    // A deactivated contractor is still mentionable today and still accrues
    // rows nobody will ever read.
    const decisions = selectRecipients(
      [candidate('u-1', 'member', { active: false, actor: actor('u-1', 'member', ['app-a']) })],
      { actorId: 'u-9', target: target() },
    )
    expect(decisions).toEqual([{ userId: 'u-1', keep: false, reason: 'inactive' }])
  })

  it('drops a recipient who is not approved', () => {
    const decisions = selectRecipients(
      [candidate('u-1', 'member', { status: 'pending', actor: actor('u-1', 'member', ['app-a']) })],
      { actorId: 'u-9', target: target() },
    )
    expect(decisions).toEqual([{ userId: 'u-1', keep: false, reason: 'not_approved' }])
  })

  it('drops the actor themselves — nobody is notified about their own action', () => {
    const decisions = selectRecipients(
      [candidate('u-1', 'member', { actor: actor('u-1', 'member', ['app-a']) })],
      { actorId: 'u-1', target: target() },
    )
    expect(decisions).toEqual([{ userId: 'u-1', keep: false, reason: 'self' }])
  })

  it('drops a recipient who cannot reach the entity', () => {
    const decisions = selectRecipients(
      [candidate('u-1', 'stakeholder', { actor: actor('u-1', 'stakeholder', ['app-z']) })],
      { actorId: 'u-9', target: target() },
    )
    expect(decisions).toEqual([{ userId: 'u-1', keep: false, reason: 'out_of_reach' }])
  })

  it("keeps a stakeholder who WAS granted the entity's app", () => {
    const decisions = selectRecipients(
      [candidate('u-1', 'stakeholder', { actor: actor('u-1', 'stakeholder', ['app-a']) })],
      { actorId: 'u-9', target: target() },
    )
    expect(decisions).toEqual([{ userId: 'u-1', keep: true }])
  })

  it('drops everyone when the entity is already soft-deleted', () => {
    const decisions = selectRecipients(
      [
        candidate('u-1', 'admin'),
        candidate('u-2', 'member', { actor: actor('u-2', 'member', ['app-a']) }),
      ],
      { actorId: 'u-9', target: target({ deleted: true }) },
    )
    expect(decisions).toEqual([
      { userId: 'u-1', keep: false, reason: 'entity_deleted' },
      { userId: 'u-2', keep: false, reason: 'entity_deleted' },
    ])
  })

  it('keeps everyone approved and active when the row names no entity', () => {
    // A notification about nothing in particular has no reach question to ask.
    const decisions = selectRecipients(
      [candidate('u-1', 'stakeholder', { actor: actor('u-1', 'stakeholder', []) })],
      { actorId: 'u-9', target: target({ entityType: null, appIds: [] }) },
    )
    expect(decisions).toEqual([{ userId: 'u-1', keep: true }])
  })

  it('reaches a meeting through ANY of its projects', () => {
    const decisions = selectRecipients(
      [candidate('u-1', 'member', { actor: actor('u-1', 'member', ['app-b']) })],
      { actorId: 'u-9', target: target({ entityType: 'meeting', appIds: ['app-a', 'app-b'] }) },
    )
    expect(decisions).toEqual([{ userId: 'u-1', keep: true }])
  })

  it('reports one reason per recipient and evaluates them in a stable order', () => {
    // A deactivated recipient who is ALSO the actor reads as inactive, not as
    // self: the account state is the more useful thing to log.
    const decisions = selectRecipients(
      [candidate('u-1', 'member', { active: false, actor: actor('u-1', 'member', ['app-a']) })],
      { actorId: 'u-1', target: target() },
    )
    expect(decisions).toEqual([{ userId: 'u-1', keep: false, reason: 'inactive' }])
  })

  it('is a no-op on empty input', () => {
    expect(selectRecipients([], { actorId: null, target: target() })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/notifications/recipients.test.ts`
Expected: FAIL with `Error: Failed to load url ./recipients (resolved id: ./recipients) ... Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/notifications/recipients.ts`:

```ts
import { can, type Action, type Actor } from '@/features/auth/capabilities'

/**
 * WHO MAY RECEIVE A ROW — the decision, moved off the call sites.
 *
 * Today every call site decides this and no call site does it. The result: a
 * deactivated contractor is still mentionable and still accrues rows, and a
 * notification can point at a soft-deleted entity and 404 on click.
 *
 * This module is the decision; createNotifications is the choke point that runs
 * it. Doing it in ONE function rather than seven call sites is the whole point:
 * it is the property that stays true when the next spec adds three more.
 */
export type NotificationEntityType = 'app' | 'task' | 'sprint' | 'meeting'

/**
 * The capability that answers "can this person reach this thing".
 *
 * Each one is the SAME action the entity's own page gates on, so a notification
 * can never point somewhere its recipient would be 404'd out of. Nothing here
 * invents a notification-specific permission — that would be a second matrix,
 * and a second matrix is how the first one goes stale.
 */
export const REACH_ACTION = {
  app: 'app.view',
  task: 'app.view',
  sprint: 'app.view',
  meeting: 'meeting.intel.view',
} as const satisfies Record<NotificationEntityType, Action>

export type RecipientCandidate = {
  /** Role + resolved app scope, exactly as `can()` wants it. */
  actor: Actor
  active: boolean
  /** users.status — 'pending' | 'approved' | 'rejected'. */
  status: string
}

export type ReachTarget = {
  /** Null when the row is about nothing in particular. */
  entityType: NotificationEntityType | null
  /** Every project the entity belongs to. A meeting can span several. */
  appIds: readonly string[]
  /** True when the entity has already been soft-deleted. */
  deleted: boolean
}

export type DropReason = 'entity_deleted' | 'inactive' | 'not_approved' | 'self' | 'out_of_reach'

export type RecipientDecision =
  | { userId: string; keep: true }
  | { userId: string; keep: false; reason: DropReason }

/**
 * Rules in a fixed order, so a dropped recipient always logs one reason and
 * always the same one:
 *
 *  1. the entity is gone      — nobody is notified about a trashed thing
 *  2. the account is inactive — the more useful fact than anything below it
 *  3. the account is unapproved
 *  4. the recipient is the actor — nobody is notified about their own action
 *  5. the recipient cannot reach the entity, resolved through `can()`
 */
export function selectRecipients(
  candidates: readonly RecipientCandidate[],
  opts: { actorId: string | null; target: ReachTarget },
): RecipientDecision[] {
  const { actorId, target } = opts
  return candidates.map((candidate): RecipientDecision => {
    const userId = candidate.actor.id
    if (target.deleted) return { userId, keep: false, reason: 'entity_deleted' }
    if (!candidate.active) return { userId, keep: false, reason: 'inactive' }
    if (candidate.status !== 'approved') return { userId, keep: false, reason: 'not_approved' }
    if (actorId !== null && userId === actorId) return { userId, keep: false, reason: 'self' }
    if (target.entityType === null) return { userId, keep: true }

    const reachable = can(candidate.actor, REACH_ACTION[target.entityType], {
      // Any-of, not all-of: being on ONE of the projects a meeting serves is
      // enough to be told about it, and the matrix's Resource type says so.
      appIds: target.appIds,
    })
    return reachable ? { userId, keep: true } : { userId, keep: false, reason: 'out_of_reach' }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/notifications/recipients.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/recipients.ts src/features/notifications/recipients.test.ts
git commit -m "feat(notifications): make recipient filtering one pure decision"
```

---

### Task 15: Migration — the `notifications` columns and the `type`-to-`text` conversion

Ten columns, one enum conversion, two `NOT NULL` drops. All additive; **no existing reader changes behaviour**, because `title` and `body` survive as the fallback and `type` keeps its values as text.

`entity_type`/`entity_id` carry **no foreign key on purpose** — a notification about a task must survive that task being trashed, and the click-through degrades to "no longer available" rather than the row vanishing. This is `activity_log`'s posture, unchanged.

`dismissed_at`, deliberately **not** `deletedAt`: `src/db/live.test.ts` check 5 fails the build for any table carrying a `deletedAt` not registered in `SOFT_TABLES`, and a notification is an ephemeral operational record, not trashable user content. The column carries a comment saying so.

**STOP CONDITIONS:** no migration runner, no `db:generate`, no hardcoded number, no editing an applied `.sql`. **Do not add `notifications` to `SOFT_TABLES`** — it stays at six members.

**Files:**
- Modify: `src/db/schema.ts` — the `notifications` table (lines 706-720)
- Create: `drizzle/<allocated>_notification_substrate.sql`
- Modify: `drizzle/meta/_journal.json`

**Interfaces:**
- Consumes: `type NotificationParams` from `./text` (Task 11), for `$type<>` on the jsonb column.
- Produces: `notifications.kind`, `.titleKey`, `.params`, `.entityType`, `.entityId`, `.dedupeKey`, `.dedupePermanent`, `.collapseCount`, `.dismissedAt`, `.digestState`; `notifications.type` and `.title` become nullable text. Tasks 16-23 all read or write these.

- [ ] **Step 1: Change the schema**

In `src/db/schema.ts`, replace the whole `notifications` table definition (its comment block and body) with:

```ts
// In-app notifications. One row per recipient. `actorId` is who triggered it,
// `link` is the in-app path to open, `meetingId` ties mention/meeting alerts to
// their source so deleting the meeting cleans them up.
//
// THE SUBSTRATE, not a feature. Every column below the original set exists so
// that a notification is (a) addressed to someone allowed to see it, (b)
// deduplicated in storage rather than by hope, (c) rate-capped per person, and
// (d) rendered in the reader's language at read time rather than frozen into
// English at write time.
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  // WAS the two-value `notification_type` pgEnum. Now plain text, and nullable,
  // for the same reason activity_log.verb is text: a new kind should be a
  // string at a call site, not a migration. Kept only so pre-substrate rows
  // keep their value; `kind` is what new rows carry.
  type: text('type'),
  // What happened. Backfilled from type::text, defaulted 'legacy' for anything
  // that had neither. The closed TypeScript list is features/notifications/kinds.ts.
  kind: text('kind').notNull().default('legacy'),
  // i18n key, rendered at read time by features/notifications/text.ts.
  titleKey: text('title_key'),
  // Parameter bag. IDS, NOT NAMES — a rename must move every historical row.
  // A snapshot label (actorLabel) is allowed only as a fallback for an id that
  // resolves to nothing, exactly as activity_log.entityLabel is used.
  params: jsonb('params').$type<NotificationParams>(),
  // NO FOREIGN KEY, on purpose, matching activity_log's posture: a notification
  // about a task must survive that task being trashed. The click-through
  // resolves and degrades to "no longer available" rather than the row
  // vanishing out from under the reader.
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  dedupeKey: text('dedupe_key'),
  // Which of the two partial unique indexes this row participates in. See
  // features/notifications/dedupe.ts for what each semantics promises.
  dedupePermanent: boolean('dedupe_permanent').notNull().default(false),
  collapseCount: integer('collapse_count').notNull().default(1),
  // PRE-SUBSTRATE ROWS ONLY. Read as a fallback when title_key is null, and
  // never written again. Deleting them waits on a backfill migration that is
  // deliberately not in this work.
  title: text('title'),
  body: text('body'),
  link: text('link'),
  meetingId: uuid('meeting_id').references(() => meetings.id, { onDelete: 'cascade' }),
  read: boolean('read').notNull().default(false),
  // DELIBERATELY NOT `deletedAt`. src/db/live.test.ts check 5 fails the build
  // for any table carrying a deletedAt that is not registered in SOFT_TABLES,
  // and a notification is an ephemeral operational record — it belongs in
  // neither the trash bin nor the six-table soft-delete contract. Naming it
  // dismissed_at keeps both facts true.
  dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  // none | queued | sent | failed. Transitioned in the same batch that sends,
  // so a cron retry cannot double-send.
  digestState: text('digest_state').notNull().default('none'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  // The inbox read: this person's notifications, newest first.
  index('notifications_user_created_idx').on(t.userId, t.createdAt.desc()),
])
```

Add to the imports at the top of `src/db/schema.ts`:

```ts
import type { NotificationParams } from '@/features/notifications/text'
```

**Leave `notificationType` (the pgEnum export, line 64) in place.** Dropping the TypeScript export is a separate cleanup; dropping the pg type is a separate migration. Neither is in scope here.

- [ ] **Step 2: Allocate the migration number and write the SQL**

Run, from the repo root:

```bash
NEXT=$(printf '%04d' $(( 10#$(ls drizzle/*.sql | sed 's#.*/##' | cut -c1-4 | sort -n | tail -1) + 1 )))
echo "allocated: $NEXT"
cat > "drizzle/${NEXT}_notification_substrate.sql" <<'SQL'
-- The notification substrate: ten columns, one enum-to-text conversion, two
-- NOT NULL drops. ALL ADDITIVE — no existing reader changes behaviour, because
-- title/body survive as the fallback and `type` keeps its values as text.
--
-- Replay-safe throughout, same discipline as 0029/0034: every statement must
-- survive running again against a database where it already ran.
--
-- The indexes are NOT here. They ship in the migration that follows, and the
-- two dedupe uniques ship in one after that, because a unique index can fail on
-- pre-existing duplicate rows and that failure must be diagnosable on its own
-- rather than rolling back ten columns with it.

-- `type` was the two-value notification_type pgEnum. Text, for the same reason
-- activity_log.verb is text: a new kind should be a string at a call site, not
-- a migration. USING type::text is exact — every value survives.
-- Nullable afterwards, because new rows carry `kind` instead.
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE text USING "type"::text;
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "type" DROP NOT NULL;
--> statement-breakpoint
-- title becomes the FALLBACK for pre-substrate rows and is never written again.
ALTER TABLE "notifications" ALTER COLUMN "title" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title_key" text;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "params" jsonb;
--> statement-breakpoint
-- No foreign key, on purpose, matching activity_log: the row outlives its
-- target. A notification about a trashed task degrades to "no longer
-- available" rather than disappearing from the reader's history.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "entity_type" text;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "entity_id" uuid;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" text;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_permanent" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "collapse_count" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
-- DELIBERATELY NOT deleted_at. src/db/live.test.ts fails the build for any
-- table carrying a deleted_at that is not registered in SOFT_TABLES, and a
-- notification is an ephemeral operational record, not trashable user content.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dismissed_at" timestamp with time zone;
--> statement-breakpoint
-- none | queued | sent | failed. Transitioned in the same batch that sends, so
-- a cron retry that finds rows already marked sends nothing.
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "digest_state" text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
-- BACKFILL: kind from the old type column, so pre-substrate rows keep their
-- meaning instead of all collapsing to 'legacy'. Idempotent by construction —
-- the WHERE stops matching once applied.
UPDATE "notifications" SET "kind" = "type" WHERE "type" IS NOT NULL AND "kind" = 'legacy';
SQL
node -e '
const fs = require("node:fs")
const p = "drizzle/meta/_journal.json"
const tag = process.argv[1]
const j = JSON.parse(fs.readFileSync(p, "utf8"))
if (j.entries.some((e) => e.tag === tag)) { console.log("journal already has", tag); process.exit(0) }
const idx = Number(tag.slice(0, 4))
const when = Math.max(...j.entries.map((e) => e.when)) + 100000
j.entries.push({ idx, version: "7", when, tag, breakpoints: true })
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n")
console.log("journal appended:", tag, "idx", idx, "when", when)
' "${NEXT}_notification_substrate"
```

- [ ] **Step 3: Verify without running it**

Run:

```bash
grep -c 'statement-breakpoint' drizzle/*_notification_substrate.sql
node -e 'JSON.parse(require("node:fs").readFileSync("drizzle/meta/_journal.json","utf8")); console.log("journal parses")'
npx tsc --noEmit
npm test
```

Expected: `14` statement breakpoints (15 statements). `journal parses`. `tsc` clean. Full suite PASS — **including `src/db/live.test.ts`**, whose check 5 must stay green: `notifications` has a `dismissedAt`, not a `deletedAt`, so it is not required in `SOFT_TABLES` and `SOFT_TABLES` stays at six. `src/features/notifications/queries.ts` still compiles because `NotificationItem.type` is declared locally as `'mention' | 'meeting'` and the column is now `string | null`; if `tsc` reports that mismatch, widen the local type to `string | null` in this task and leave the rest of `queries.ts` for Task 19.

- [ ] **Step 4: STOP — request human approval before any database touches this**

Print this and wait:

> Migration `<allocated>_notification_substrate.sql` is written and the journal entry appended. **I have not run it.** It converts a pgEnum column to text and drops two NOT NULLs, so it is the highest-risk migration in this plan. Verification after it runs, against `information_schema`:
>
> ```sql
> SELECT column_name, data_type, is_nullable, column_default
> FROM information_schema.columns
> WHERE table_name = 'notifications'
> ORDER BY ordinal_position;
> ```
>
> Expected: `type` is `text` and nullable; `title` is nullable; `kind`, `dedupe_permanent`, `collapse_count` and `digest_state` are NOT NULL with defaults `'legacy'`, `false`, `1`, `'none'`; `title_key`, `params`, `entity_type`, `entity_id`, `dedupe_key`, `dismissed_at` present and nullable. Also confirm the backfill landed:
>
> ```sql
> SELECT kind, count(*) FROM notifications GROUP BY kind ORDER BY kind;
> ```

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/meta/_journal.json drizzle/*_notification_substrate.sql
git commit -m "feat(db): add the notification substrate columns and convert type to text"
```

---

### Task 16: Migration — the remaining notification indexes, dedupe uniques in their own file

Three indexes that name the new columns, then the two partial uniques **in a separate file**, because a unique index can fail on pre-existing duplicate rows and that failure must be diagnosable on its own rather than rolling back the other three with it. That separation is the spec's requirement, not a preference.

**STOP CONDITIONS:** no migration runner, no `db:generate`, no hardcoded number, no editing an applied `.sql`. Apply the two files **in order**, and if the dedupe file fails, do not retry it — read the duplicate rows it names first.

**Files:**
- Modify: `src/db/schema.ts` — the `notifications` index array added in Task 15
- Create: `drizzle/<allocated>_notification_indexes.sql`
- Create: `drizzle/<allocated+1>_notification_dedupe.sql`
- Modify: `drizzle/meta/_journal.json` (two entries)

**Interfaces:**
- Consumes: the columns from Task 15.
- Produces: SQL indexes `notifications_user_read_created_idx`, `notifications_entity_idx`, `notifications_dedupe_permanent_idx`, `notifications_dedupe_collapsing_idx`. Task 17's `onConflictDoNothing`/`onConflictDoUpdate` targets rely on the last two existing.

- [ ] **Step 1: Change the schema**

In `src/db/schema.ts`, replace the `notifications` index array with:

```ts
}, (t) => [
  // THE BELL POLL. Every signed-in browser runs this from 20 seconds out, and
  // `notifications` carried no index at all until now — the "two indexed
  // queries" comment beside the poll was false for the table's whole life.
  // Partial on dismissed_at because a dismissed row is never in the answer.
  index('notifications_user_read_created_idx').on(t.userId, t.read, t.createdAt.desc())
    .where(sql`${t.dismissedAt} is null`),
  // The inbox read: this person's notifications, newest first.
  index('notifications_user_created_idx').on(t.userId, t.createdAt.desc()),
  // PERMANENT dedupe: one row per (recipient, key), forever. An escalation
  // rung fires once per key, and a moved due date changes the key rather than
  // the row — which is what re-arms the ladder without a second mechanism.
  uniqueIndex('notifications_dedupe_permanent_idx').on(t.userId, t.dedupeKey)
    .where(sql`${t.dedupePermanent}`),
  // COLLAPSING dedupe, scoped to rows the reader has not caught up with. Once
  // a row is read or dismissed it leaves this index, so the next event opens a
  // fresh row rather than silently incrementing one already off the screen.
  uniqueIndex('notifications_dedupe_collapsing_idx').on(t.userId, t.dedupeKey)
    .where(sql`not ${t.dedupePermanent} and ${t.read} = false and ${t.dismissedAt} is null`),
  // Cascade on trash: "every notification pointing at this entity", so a
  // trashed task's rows can be found without a full scan.
  index('notifications_entity_idx').on(t.entityType, t.entityId),
])
```

- [ ] **Step 2: Allocate both numbers and write both SQL files**

Run, from the repo root:

```bash
FIRST=$(printf '%04d' $(( 10#$(ls drizzle/*.sql | sed 's#.*/##' | cut -c1-4 | sort -n | tail -1) + 1 )))
SECOND=$(printf '%04d' $(( 10#$FIRST + 1 )))
echo "allocated: $FIRST then $SECOND"
cat > "drizzle/${FIRST}_notification_indexes.sql" <<'SQL'
-- The three notification indexes that name columns the previous migration
-- added. The two UNIQUE dedupe indexes are deliberately NOT here — they ship
-- in the very next file, because a unique index can fail on pre-existing
-- duplicate rows and that failure must be diagnosable on its own rather than
-- taking these three down with it.
--
-- Replay-safe: CREATE INDEX IF NOT EXISTS throughout.

-- THE BELL POLL, run by every signed-in browser from 20 seconds out. This
-- table has carried zero indexes since 0005 while that poll ran; the comment
-- beside it claiming "two indexed queries" has been false the whole time.
-- Partial on dismissed_at — a dismissed row is never in the answer.
CREATE INDEX IF NOT EXISTS "notifications_user_read_created_idx" ON "notifications" USING btree ("user_id","read","created_at" DESC) WHERE "notifications"."dismissed_at" is null;
--> statement-breakpoint
-- "Every notification pointing at this entity", so trashing a task can find
-- its rows without a full scan.
CREATE INDEX IF NOT EXISTS "notifications_entity_idx" ON "notifications" USING btree ("entity_type","entity_id");
SQL
cat > "drizzle/${SECOND}_notification_dedupe.sql" <<'SQL'
-- The two partial UNIQUE indexes that make dedupe a storage-layer guarantee
-- rather than a convention.
--
-- ITS OWN FILE, deliberately. A unique index is the one kind of index that can
-- FAIL on data that already exists, and when it does the useful next step is
-- reading the duplicate rows it named. Bundled with the plain indexes, that
-- failure would roll back work that had nothing to do with it and would be
-- diagnosed as "the index migration failed".
--
-- IF EITHER STATEMENT FAILS, DO NOT RETRY IT. Find the duplicates first:
--
--   SELECT user_id, dedupe_key, count(*)
--   FROM notifications
--   WHERE dedupe_key IS NOT NULL AND dedupe_permanent
--   GROUP BY user_id, dedupe_key HAVING count(*) > 1;
--
-- No row written before this substrate carries a dedupe_key at all, so both
-- indexes are expected to build against an effectively empty predicate today.
-- The guidance above is for the replay case, and for the day a bug writes one.

-- PERMANENT: one row per (recipient, key), forever. An escalation rung fires
-- once per key; a legitimately moved due date changes the KEY, which is what
-- re-arms a ladder without needing a second mechanism to do it.
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_permanent_idx" ON "notifications" USING btree ("user_id","dedupe_key") WHERE "notifications"."dedupe_permanent";
--> statement-breakpoint
-- COLLAPSING: scoped to rows the reader has not caught up with, so five
-- comments on one task are one row reading "5 new comments", and the first
-- comment AFTER the reader clears it opens a fresh row rather than silently
-- incrementing one already off the screen.
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_collapsing_idx" ON "notifications" USING btree ("user_id","dedupe_key") WHERE not "notifications"."dedupe_permanent" and "notifications"."read" = false and "notifications"."dismissed_at" is null;
SQL
node -e '
const fs = require("node:fs")
const p = "drizzle/meta/_journal.json"
const j = JSON.parse(fs.readFileSync(p, "utf8"))
for (const tag of process.argv) {
  if (j.entries.some((e) => e.tag === tag)) { console.log("journal already has", tag); continue }
  const idx = Number(tag.slice(0, 4))
  const when = Math.max(...j.entries.map((e) => e.when)) + 100000
  j.entries.push({ idx, version: "7", when, tag, breakpoints: true })
  console.log("journal appended:", tag, "idx", idx, "when", when)
}
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n")
' "${FIRST}_notification_indexes" "${SECOND}_notification_dedupe"
```

- [ ] **Step 3: Verify without running them**

Run:

```bash
ls drizzle/*_notification_indexes.sql drizzle/*_notification_dedupe.sql
node -e 'const j=JSON.parse(require("node:fs").readFileSync("drizzle/meta/_journal.json","utf8")); const w=j.entries.map(e=>e.when); console.log("strictly increasing:", w.every((n,i)=>i===0||n>w[i-1]))'
npx tsc --noEmit
npm test
```

Expected: both files listed. `strictly increasing: true`. `tsc` clean. Full suite PASS.

- [ ] **Step 4: STOP — request human approval before any database touches these**

Print this and wait:

> Two migrations are written and both journal entries appended. **I have not run them.** They must be applied in order, and the dedupe file is the one that can fail on existing data. Verification after they run:
>
> ```sql
> SELECT indexname FROM pg_indexes
> WHERE tablename = 'notifications' ORDER BY indexname;
> ```
>
> Expected five rows: `notifications_dedupe_collapsing_idx`, `notifications_dedupe_permanent_idx`, `notifications_entity_idx`, `notifications_user_created_idx`, `notifications_user_read_created_idx`.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/meta/_journal.json drizzle/*_notification_indexes.sql drizzle/*_notification_dedupe.sql
git commit -m "perf(db): index the bell poll and enforce both dedupe semantics as unique indexes"
```

---

### Task 17: `createNotifications` becomes the choke point

`createNotifications` is a bare `db.insert` with no transport, no queue, no callback, and no idea who is allowed to receive what. This task makes it the one place that decides.

Its **best-effort contract is unchanged and must stay unchanged**: it MUST NOT throw, and a notification failure MUST NOT fail the write it describes. Moving filtering inside it does not change that — a filter error drops the recipient and logs.

`db.batch` is deliberately **not** used here. Batching would make a single bad row lose the whole set, and a notification write is explicitly allowed to be partial: the contract is best-effort per row, not atomic across rows.

**Files:**
- Modify: `src/features/notifications/notify.ts:1-20`
- Test: `src/features/notifications/notify.test.ts`

**Interfaces:**
- Consumes: `selectRecipients`, `REACH_ACTION`, `type NotificationEntityType` from `./recipients` (Task 14); `applyDailyCap` from `./budget` (Task 12); `overflowKey`, `dedupeOutcome` from `./dedupe` (Task 13); `OVERFLOW_TITLE_KEY`, `type NotificationParams` from `./text` (Task 11); `toIsoDateInTimeZone`, `LK_TIMEZONE` from `@/lib/lk-holidays`; `scopeSourceFor` from `@/features/auth/capabilities`.
- Produces: the widened `type NewNotification` and `createNotifications(rows: NewNotification[]): Promise<void>` with the same signature. Task 18's call sites pass the new fields. `extractMentionedUserIds` is untouched.

- [ ] **Step 1: Write the failing test**

Create `src/features/notifications/notify.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Insert = { values: Record<string, unknown>[]; conflict: string }

const inserts: Insert[] = []
let userRows: Record<string, unknown>[] = []
let scopeRows: Record<string, unknown>[] = []
let entityRows: Record<string, unknown>[] = []
let countRows: Record<string, unknown>[] = []
let selectShouldThrow = false

/**
 * The reads happen in a fixed order inside createNotifications: recipients,
 * then scope rows for the seats that need them, then the entity, then today's
 * per-recipient counts. The mock serves them from that queue.
 */
let readQueue: Record<string, unknown>[][] = []

vi.mock('@/db', () => {
  const chain = () => {
    const thenable = {
      where: () => thenable,
      groupBy: () => thenable,
      limit: () => thenable,
      leftJoin: () => thenable,
      then: (resolve: (v: unknown) => unknown) => {
        if (selectShouldThrow) return Promise.reject(new Error('neon exploded')).then(resolve)
        return Promise.resolve(readQueue.shift() ?? []).then(resolve)
      },
    }
    return thenable
  }
  return {
    db: {
      select: () => ({ from: () => chain() }),
      insert: () => ({
        values: (values: Record<string, unknown>[]) => {
          const record: Insert = { values, conflict: 'none' }
          inserts.push(record)
          const result = {
            onConflictDoNothing: () => {
              record.conflict = 'nothing'
              return Promise.resolve(undefined)
            },
            onConflictDoUpdate: () => {
              record.conflict = 'update'
              return Promise.resolve(undefined)
            },
            then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
          }
          return result
        },
      }),
    },
  }
})

const { createNotifications } = await import('./notify')

const approved = (id: string, role = 'member') => ({
  id,
  role,
  active: true,
  status: 'approved',
  employmentType: 'permanent',
})

beforeEach(() => {
  inserts.length = 0
  userRows = []
  scopeRows = []
  entityRows = []
  countRows = []
  readQueue = []
  selectShouldThrow = false
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('createNotifications', () => {
  it('is a no-op on empty input and asks the database nothing', async () => {
    await createNotifications([])
    expect(inserts).toEqual([])
  })

  it('writes a row for an approved, active, in-scope recipient', async () => {
    readQueue = [[approved('u-1')], [{ userId: 'u-1', appId: 'app-a' }], [{ id: 't-1', appId: 'app-a' }], []]
    await createNotifications([{
      userId: 'u-1',
      actorId: 'u-9',
      kind: 'mention',
      titleKey: 'notif.mention.app',
      params: { actorId: 'u-9', appId: 'app-a' },
      entityType: 'task',
      entityId: 't-1',
      link: '/apps/logpup?tab=discussion',
    }])
    expect(inserts).toHaveLength(1)
    expect(inserts[0].values[0]).toMatchObject({
      userId: 'u-1',
      kind: 'mention',
      titleKey: 'notif.mention.app',
      collapseCount: 1,
    })
  })

  it('drops a deactivated recipient without writing anything', async () => {
    readQueue = [[{ ...approved('u-1'), active: false }], [], [{ id: 't-1', appId: 'app-a' }], []]
    await createNotifications([{
      userId: 'u-1', actorId: 'u-9', kind: 'mention',
      titleKey: 'notif.mention.app', params: {}, entityType: 'task', entityId: 't-1',
    }])
    expect(inserts).toEqual([])
  })

  it('drops the actor themselves', async () => {
    readQueue = [[approved('u-1')], [{ userId: 'u-1', appId: 'app-a' }], [{ id: 't-1', appId: 'app-a' }], []]
    await createNotifications([{
      userId: 'u-1', actorId: 'u-1', kind: 'mention',
      titleKey: 'notif.mention.app', params: {}, entityType: 'task', entityId: 't-1',
    }])
    expect(inserts).toEqual([])
  })

  it('drops a recipient who cannot reach the entity', async () => {
    readQueue = [
      [approved('u-1', 'stakeholder')],
      [{ userId: 'u-1', appId: 'app-z' }],
      [{ id: 't-1', appId: 'app-a' }],
      [],
    ]
    await createNotifications([{
      userId: 'u-1', actorId: 'u-9', kind: 'mention',
      titleKey: 'notif.mention.app', params: {}, entityType: 'task', entityId: 't-1',
    }])
    expect(inserts).toEqual([])
  })

  it('drops every recipient when the entity is already trashed', async () => {
    // The entity read comes back empty: the task is soft-deleted, so a
    // notification pointing at it would 404 on click.
    readQueue = [[approved('u-1')], [{ userId: 'u-1', appId: 'app-a' }], [], []]
    await createNotifications([{
      userId: 'u-1', actorId: 'u-9', kind: 'mention',
      titleKey: 'notif.mention.app', params: {}, entityType: 'task', entityId: 't-1',
    }])
    expect(inserts).toEqual([])
  })

  it("turns the sixth row of a person's day into one collapsing overflow row", async () => {
    readQueue = [[approved('u-1')], [{ userId: 'u-1', appId: 'app-a' }], [{ id: 't-1', appId: 'app-a' }], [{ userId: 'u-1', value: 5 }]]
    await createNotifications([{
      userId: 'u-1', actorId: 'u-9', kind: 'mention',
      titleKey: 'notif.mention.app', params: {}, entityType: 'task', entityId: 't-1',
    }])
    expect(inserts).toHaveLength(1)
    const row = inserts[0].values[0]
    expect(row).toMatchObject({
      userId: 'u-1',
      kind: 'system.overflow',
      titleKey: 'notif.overflow.more',
      dedupePermanent: false,
    })
    expect(String(row.dedupeKey)).toMatch(/^notif:overflow:u-1:\d{4}-\d{2}-\d{2}$/)
    expect(inserts[0].conflict).toBe('update')
  })

  it('uses ON CONFLICT DO NOTHING for a permanent dedupe key', async () => {
    readQueue = [[approved('u-1')], [{ userId: 'u-1', appId: 'app-a' }], [{ id: 't-1', appId: 'app-a' }], []]
    await createNotifications([{
      userId: 'u-1', actorId: 'u-9', kind: 'mention',
      titleKey: 'notif.mention.app', params: {}, entityType: 'task', entityId: 't-1',
      dedupeKey: 'deadline:t-1:due_soon:2026-08-25', dedupePermanent: true,
    }])
    expect(inserts).toHaveLength(1)
    expect(inserts[0].conflict).toBe('nothing')
  })

  it('uses ON CONFLICT DO UPDATE for a collapsing dedupe key', async () => {
    readQueue = [[approved('u-1')], [{ userId: 'u-1', appId: 'app-a' }], [{ id: 't-1', appId: 'app-a' }], []]
    await createNotifications([{
      userId: 'u-1', actorId: 'u-9', kind: 'mention',
      titleKey: 'notif.mention.app', params: {}, entityType: 'task', entityId: 't-1',
      dedupeKey: 'task:t-1:comment', dedupePermanent: false,
    }])
    expect(inserts).toHaveLength(1)
    expect(inserts[0].conflict).toBe('update')
  })

  it('derives kind from the legacy type when no kind is given', async () => {
    readQueue = [[approved('u-1')], [{ userId: 'u-1', appId: 'app-a' }], [], []]
    await createNotifications([{
      userId: 'u-1', actorId: 'u-9', type: 'meeting', title: 'Old style',
    }])
    expect(inserts[0].values[0]).toMatchObject({ kind: 'meeting', type: 'meeting' })
  })

  it('NEVER THROWS when the database fails, and logs instead', async () => {
    // The contract every call site depends on: losing a notification must not
    // report the write it describes as failed.
    selectShouldThrow = true
    await expect(createNotifications([{
      userId: 'u-1', actorId: 'u-9', kind: 'mention', titleKey: 'notif.mention.app', params: {},
    }])).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalled()
  })

  it('ignores a row with no userId, exactly as before', async () => {
    await createNotifications([{ userId: '', kind: 'mention', titleKey: 'notif.mention.app' }])
    expect(inserts).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/notifications/notify.test.ts`
Expected: FAIL — `TypeError: Cannot read properties of undefined (reading 'values')` on `inserts[0].values[0]`, because `createNotifications` today inserts every row it is given without reading anything, so the recipient/entity/count reads never happen and the filtered cases still write.

- [ ] **Step 3: Write minimal implementation**

Replace the top of `src/features/notifications/notify.ts` (its imports, `NewNotification` and `createNotifications`; leave `escapeRegExp` and `extractMentionedUserIds` exactly as they are) with:

```ts
import { and, count, eq, gte, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveMeetings, liveSprints, liveTasks } from '@/db/live'
import { appGrants, appRoleHistory, assignments, meetingApps, notifications, users } from '@/db/schema'
import { scopeSourceFor, type Actor, type EmploymentType, type UserRole } from '@/features/auth/capabilities'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { applyDailyCap } from './budget'
import { dedupeOutcome, overflowKey } from './dedupe'
import { isNotificationKind, type NotificationKind } from './kinds'
import { selectRecipients, type NotificationEntityType, type ReachTarget, type RecipientCandidate } from './recipients'
import { OVERFLOW_TITLE_KEY, type NotificationParams } from './text'

export type NewNotification = {
  userId: string
  actorId?: string | null
  /**
   * LEGACY, and optional. Kept so the pre-substrate call sites compile
   * unchanged; `kind` is what a new writer sets. Derived when absent.
   */
  type?: 'mention' | 'meeting'
  kind?: NotificationKind
  /** i18n key. Preferred over `title` on every new write. */
  titleKey?: string
  params?: NotificationParams
  /** PRE-SUBSTRATE ONLY. Never set these on a new writer. */
  title?: string
  body?: string | null
  link?: string | null
  meetingId?: string | null
  entityType?: NotificationEntityType | null
  entityId?: string | null
  dedupeKey?: string | null
  dedupePermanent?: boolean
}

/**
 * THE CHOKE POINT.
 *
 * Every notification in LogPup passes through here, and this is the only place
 * that decides who may receive one. Before this, every call site decided and no
 * call site did: a deactivated contractor was still mentionable and still
 * accrued rows, and a notification could point at a soft-deleted entity and 404
 * on click.
 *
 * Inside it, and NOWHERE else:
 *   - drop recipients who are inactive or not approved
 *   - drop the actor's own id — nobody is notified about their own action
 *   - drop recipients who cannot reach the entity, resolved through can()
 *   - drop rows whose entity is already soft-deleted
 *   - cap the recipient's day at NOTIFICATION_DAILY_CAP, collapsing the excess
 *     into ONE overflow row rather than dropping it
 *
 * Doing this in one function rather than seven call sites is the whole point:
 * it is the property that stays true when the next spec adds three more.
 *
 * BEST-EFFORT CONTRACT, UNCHANGED: this MUST NOT throw, and a notification
 * failure MUST NOT fail the write it describes. Every call site relies on that
 * today and none of them is being changed to handle a throw.
 *
 * NOT db.batch, deliberately. Batching would make one bad row lose the whole
 * set, and the contract here is best-effort per row rather than atomic across
 * rows — a partial write is the correct outcome, not a bug.
 */
export async function createNotifications(rows: NewNotification[]): Promise<void> {
  try {
    const valid = rows.filter((r) => r.userId)
    if (valid.length === 0) return

    const actorId = valid.find((r) => r.actorId)?.actorId ?? null
    const recipientIds = [...new Set(valid.map((r) => r.userId))]

    // 1. Who these people are.
    const people: { id: string; role: UserRole; active: boolean; status: string; employmentType: EmploymentType }[] =
      await db
        .select({
          id: users.id,
          role: users.role,
          active: users.active,
          status: users.status,
          employmentType: users.employmentType,
        })
        .from(users)
        .where(inArray(users.id, recipientIds))

    // 2. App scope, but ONLY for the seats whose reach depends on one. A
    //    workspace-wide seat needs no query, which is the same economy
    //    requireCapability already applies.
    const scopeByUser = new Map<string, Set<string>>()
    const needScope = people.filter((p) => scopeSourceFor(p.role) !== 'none')
    if (needScope.length > 0) {
      const byUser = (rowsIn: { userId: string; appId: string }[]) => {
        for (const row of rowsIn) {
          const set = scopeByUser.get(row.userId) ?? new Set<string>()
          set.add(row.appId)
          scopeByUser.set(row.userId, set)
        }
      }
      const managerIds = needScope.filter((p) => scopeSourceFor(p.role) === 'app_role_history').map((p) => p.id)
      const memberIds = needScope.filter((p) => scopeSourceFor(p.role) === 'assignments').map((p) => p.id)
      const grantIds = needScope.filter((p) => scopeSourceFor(p.role) === 'app_grants').map((p) => p.id)
      if (managerIds.length > 0) {
        byUser(await db
          .select({ userId: appRoleHistory.userId, appId: appRoleHistory.appId })
          .from(appRoleHistory)
          .where(and(
            inArray(appRoleHistory.userId, managerIds),
            sql`${appRoleHistory.effectiveTo} is null`,
            inArray(appRoleHistory.role, ['pm', 'lead']),
          )))
      }
      if (memberIds.length > 0) {
        byUser(await db
          .select({ userId: assignments.userId, appId: assignments.appId })
          .from(assignments)
          .where(inArray(assignments.userId, memberIds)))
      }
      if (grantIds.length > 0) {
        byUser(await db
          .select({ userId: appGrants.userId, appId: appGrants.appId })
          .from(appGrants)
          .where(inArray(appGrants.userId, grantIds)))
      }
    }

    // 3. Is the entity still there, and which projects does it belong to?
    const first = valid[0]
    const target = await resolveTarget(first.entityType ?? null, first.entityId ?? null)

    const candidates: RecipientCandidate[] = people.map((person) => ({
      actor: {
        id: person.id,
        role: person.role,
        employmentType: person.employmentType,
        scopeAppIds: scopeByUser.get(person.id) ?? new Set<string>(),
      } satisfies Actor,
      active: person.active,
      status: person.status,
    }))

    const keep = new Set(
      selectRecipients(candidates, { actorId, target })
        .filter((decision) => decision.keep)
        .map((decision) => decision.userId),
    )
    const permitted = valid.filter((row) => keep.has(row.userId))
    if (permitted.length === 0) return

    // 4. How much of today has each of them already spent?
    const tickDate = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)
    // Asia/Colombo is a fixed +05:30 offset with no DST, so the day's start is
    // exact rather than approximated. Never a UTC slice.
    const dayStart = new Date(`${tickDate}T00:00:00+05:30`)
    const spentRows: { userId: string; value: number }[] = await db
      .select({ userId: notifications.userId, value: count() })
      .from(notifications)
      .where(and(
        inArray(notifications.userId, [...keep]),
        gte(notifications.createdAt, dayStart),
      ))
      .groupBy(notifications.userId)
    const spent = new Map(spentRows.map((row) => [row.userId, Number(row.value)]))

    const decision = applyDailyCap(
      permitted.map((row) => ({ userId: row.userId, kind: kindOf(row) })),
      spent,
    )

    // 5. Write. The cap decides HOW MANY of each recipient's rows land, and
    //    applyDailyCap preserves draft order within a recipient, so the first
    //    arrivals of a burst are the ones that get their own row. Three write
    //    shapes below, because the ON CONFLICT clause differs per semantics.
    const seatsLeft = new Map<string, number>()
    for (const draft of decision.emit) {
      seatsLeft.set(draft.userId, (seatsLeft.get(draft.userId) ?? 0) + 1)
    }

    const plain: Record<string, unknown>[] = []
    for (const row of permitted) {
      const left = seatsLeft.get(row.userId) ?? 0
      if (left === 0) continue
      seatsLeft.set(row.userId, left - 1)
      const values = toValues(row)
      if (!row.dedupeKey) {
        plain.push(values)
        continue
      }
      if (row.dedupePermanent) {
        // dedupeOutcome('permanent', …) is DO NOTHING by construction; the
        // index is what enforces it, so no read-before-write is needed.
        await db.insert(notifications).values([values]).onConflictDoNothing({
          target: [notifications.userId, notifications.dedupeKey],
          where: sql`${notifications.dedupePermanent}`,
        })
        continue
      }
      await db.insert(notifications).values([values]).onConflictDoUpdate({
        target: [notifications.userId, notifications.dedupeKey],
        targetWhere: sql`not ${notifications.dedupePermanent} and ${notifications.read} = false and ${notifications.dismissedAt} is null`,
        set: {
          collapseCount: sql`${notifications.collapseCount} + 1`,
          createdAt: new Date(),
          params: values.params as NotificationParams,
        },
      })
    }
    if (plain.length > 0) await db.insert(notifications).values(plain)

    // 6. The cap's own rows. COLLAPSES, NEVER DROPS: the count is real and the
    //    row is a door, not a tombstone.
    for (const over of decision.overflow) {
      await db.insert(notifications).values([{
        userId: over.userId,
        kind: 'system.overflow',
        titleKey: OVERFLOW_TITLE_KEY,
        params: { count: over.suppressed, href: `/notifications?day=${tickDate}` },
        dedupeKey: overflowKey(over.userId, tickDate),
        dedupePermanent: false,
        collapseCount: over.suppressed,
        link: `/notifications?day=${tickDate}`,
      }]).onConflictDoUpdate({
        target: [notifications.userId, notifications.dedupeKey],
        targetWhere: sql`not ${notifications.dedupePermanent} and ${notifications.read} = false and ${notifications.dismissedAt} is null`,
        set: {
          collapseCount: sql`${notifications.collapseCount} + ${over.suppressed}`,
          params: sql`jsonb_set(${notifications.params}, '{count}', to_jsonb(${notifications.collapseCount} + ${over.suppressed}))`,
          createdAt: new Date(),
        },
      })
    }
  } catch (error) {
    // The contract: never throw. A notification that fails to write must not
    // turn a saved comment, a created meeting or an applied change request into
    // a reported failure.
    console.error('[notifications] createNotifications failed:', error)
  }
}

/** `kind`, derived once, so the cap and the row agree on what was written. */
function kindOf(row: NewNotification): NotificationKind {
  if (row.kind) return row.kind
  if (row.type && isNotificationKind(row.type)) return row.type
  return 'legacy'
}

function toValues(row: NewNotification): Record<string, unknown> {
  return {
    userId: row.userId,
    actorId: row.actorId ?? null,
    type: row.type ?? null,
    kind: kindOf(row),
    titleKey: row.titleKey ?? null,
    params: row.params ?? null,
    title: row.title ?? null,
    body: row.body ?? null,
    link: row.link ?? null,
    meetingId: row.meetingId ?? null,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    dedupeKey: row.dedupeKey ?? null,
    dedupePermanent: row.dedupePermanent ?? false,
    collapseCount: 1,
  }
}

/**
 * Is the entity still live, and which projects is it on?
 *
 * Reads the live_* subqueries, never the base tables — a notification about a
 * trashed task must not be written in the first place. An entity that resolves
 * to no row IS the deleted case, which is what `deleted: true` says.
 */
async function resolveTarget(
  entityType: NotificationEntityType | null,
  entityId: string | null,
): Promise<ReachTarget> {
  if (entityType === null || entityId === null) {
    return { entityType: null, appIds: [], deleted: false }
  }
  if (entityType === 'task') {
    const rows = await db.select({ appId: liveTasks.appId }).from(liveTasks).where(eq(liveTasks.id, entityId))
    return { entityType, appIds: rows.map((r) => r.appId), deleted: rows.length === 0 }
  }
  if (entityType === 'sprint') {
    const rows = await db.select({ appId: liveSprints.appId }).from(liveSprints).where(eq(liveSprints.id, entityId))
    return { entityType, appIds: rows.map((r) => r.appId), deleted: rows.length === 0 }
  }
  if (entityType === 'app') {
    const rows = await db.select({ appId: liveApps.id }).from(liveApps).where(eq(liveApps.id, entityId))
    return { entityType, appIds: rows.map((r) => r.appId), deleted: rows.length === 0 }
  }
  const rows = await db
    .select({ appId: meetingApps.appId })
    .from(liveMeetings)
    .leftJoin(meetingApps, eq(meetingApps.meetingId, liveMeetings.id))
    .where(eq(liveMeetings.id, entityId))
  return {
    entityType,
    appIds: rows.map((r) => r.appId).filter((id): id is string => id !== null),
    deleted: rows.length === 0,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/notifications/notify.test.ts && npx tsc --noEmit && npm test`
Expected: `notify.test.ts` PASS, 12 tests. `tsc` clean — the six existing call sites still compile because `type` and `title` remain accepted. Full suite PASS, including `src/db/live.test.ts` (the new reads go through `live*` subqueries, all named literally).

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/notify.ts src/features/notifications/notify.test.ts
git commit -m "feat(notifications): make createNotifications the filtering, deduping, rate-capped choke point"
```

---

### Task 18: The six existing call sites write `title_key` + `params`

`title` and `body` stay as columns for the rows already written, and they are **never written again**. This task is what makes that sentence true. Every call site stops composing an English sentence and passes the key plus the ids the renderer needs.

Six call sites, in three files. Each also declares its `entityType`/`entityId` and its dedupe semantics, which is what the filtering and collapsing added in Task 17 need in order to do anything.

**Files:**
- Modify: `src/features/apps/comment-actions.ts:78-90`
- Modify: `src/features/meetings/actions.ts:507-518`, `:638-651`, `:914-925`, `:1070-1080`
- Modify: `src/features/meetings/ai-actions.ts` — the `pendingNotifications` rows built before `:546`, and `:3199-3209`

**Interfaces:**
- Consumes: `createNotifications`, `type NewNotification` from `./notify` (Task 17); `entityCollapseKey` from `./dedupe` (Task 13).
- Produces: no new exports. Every write carries `kind`, `titleKey`, `params`, `entityType`, `entityId`, `dedupeKey`, `dedupePermanent`.

- [ ] **Step 1: Write the failing test**

Create `src/features/notifications/call-sites.test.ts` — a source-level guard, in the idiom `src/db/live.test.ts` and `src/features/search/registry/registry.test.ts` already use, because these six writes have no shared function to unit-test and mocking six server actions would test the mocks:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../..')

const CALL_SITE_FILES = [
  'features/apps/comment-actions.ts',
  'features/meetings/actions.ts',
  'features/meetings/ai-actions.ts',
]

/**
 * Every argument object passed to createNotifications, as source text. Crude
 * on purpose: this is the same static-scan discipline live.test.ts uses, and
 * it catches the one thing that matters — a writer that still composes a
 * sentence instead of naming a key.
 */
function callSiteText(relPath: string): string {
  return readFileSync(path.join(SRC, relPath), 'utf8')
}

describe('notification call sites', () => {
  it.each(CALL_SITE_FILES)('%s names a titleKey for every notification it writes', (relPath) => {
    const text = callSiteText(relPath)
    const writes = text.split('createNotifications(').length - 1
    expect(writes).toBeGreaterThan(0)
    expect(text.split('titleKey:').length - 1).toBeGreaterThanOrEqual(writes)
  })

  it.each(CALL_SITE_FILES)('%s no longer freezes an English sentence into title', (relPath) => {
    const text = callSiteText(relPath)
    // `title:` inside a notification payload is the frozen sentence this
    // substrate exists to remove. Meeting/task titles read from a row are
    // fine — those are `existing.title`, `meeting.title`, `parsed.data.title`.
    const frozen = [...text.matchAll(/^\s*title: `/gm)]
    expect(frozen.map((m) => m[0].trim())).toEqual([])
  })

  it.each(CALL_SITE_FILES)('%s tells createNotifications which entity the row is about', (relPath) => {
    const text = callSiteText(relPath)
    const writes = text.split('createNotifications(').length - 1
    expect(text.split('entityType:').length - 1).toBeGreaterThanOrEqual(writes)
  })

  it.each(CALL_SITE_FILES)('%s declares dedupe semantics on every write', (relPath) => {
    const text = callSiteText(relPath)
    const writes = text.split('createNotifications(').length - 1
    expect(text.split('dedupePermanent:').length - 1).toBeGreaterThanOrEqual(writes)
  })

  it('has not gained a seventh call site without this test being updated', () => {
    // A new writer is a new entry in CALL_SITE_FILES, not a silent exemption.
    const all = [
      'features/apps/comment-actions.ts',
      'features/meetings/actions.ts',
      'features/meetings/ai-actions.ts',
    ]
    expect(CALL_SITE_FILES).toEqual(all)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/notifications/call-sites.test.ts`
Expected: FAIL — `AssertionError: expected +0 to be greater than or equal to 1` on the `titleKey` assertion for all three files, and `AssertionError: expected [ 'title: `' ] to deeply equal []` on the frozen-sentence assertion.

- [ ] **Step 3: Write minimal implementation**

In `src/features/apps/comment-actions.ts`, replace the `createNotifications(...)` argument with:

```ts
      await createNotifications(
        mentionedIds.map((userId) => ({
          userId,
          actorId: authorId,
          kind: 'mention' as const,
          titleKey: 'notif.mention.app',
          // IDS, NOT NAMES: a person or a project renamed after this row is
          // written must move this row's text with it.
          params: { actorId: authorId, actorLabel: session.user.name ?? undefined, appId: app.id },
          entityType: 'app' as const,
          entityId: app.id,
          // Collapsing, on the ENTITY: five mentions in one discussion are one
          // row reading "…(5×)", not five rows.
          dedupeKey: entityCollapseKey('app', app.id, `mention:${userId}`),
          dedupePermanent: false,
          // Must point at the tab the thread actually lives on. Comments moved
          // off Overview onto their own Discussion section; a notification that
          // opens Overview drops the reader on a page with no comment on it.
          link: `/apps/${app.slug}?tab=discussion`,
        })),
      )
```

and add the import `import { entityCollapseKey } from '@/features/notifications/dedupe'`.

In `src/features/meetings/actions.ts`, add the same `entityCollapseKey` import and change the four payloads:

`:507` (invite on create) —

```ts
        .map((userId) => ({
          userId,
          actorId: session.user.id,
          kind: 'meeting' as const,
          titleKey: 'notif.meeting.invited',
          params: {
            actorId: session.user.id,
            actorLabel: session.user.name ?? undefined,
            meetingId,
          },
          entityType: 'meeting' as const,
          entityId: meetingId,
          dedupeKey: entityCollapseKey('meeting', meetingId, `invited:${userId}`),
          dedupePermanent: false,
          link: '/meetings',
          meetingId,
        })),
```

`:638` (move) —

```ts
        .map((userId) => ({
          userId,
          actorId: session.user.id,
          kind: 'meeting' as const,
          titleKey: 'notif.meeting.moved',
          params: {
            actorId: session.user.id,
            actorLabel: session.user.name ?? undefined,
            meetingId: existing.id,
          },
          entityType: 'meeting' as const,
          entityId: existing.id,
          dedupeKey: entityCollapseKey('meeting', existing.id, `moved:${userId}`),
          dedupePermanent: false,
          link: '/meetings',
          meetingId: existing.id,
        })),
```

`:914` (added / moved on edit) — the `notified` map currently holds a composed sentence; it holds a **key** now. Change the two loops that fill it to `notified.set(userId, 'notif.meeting.added')` and `notified.set(userId, 'notif.meeting.moved')`, then:

```ts
        .map(([userId, notificationKey]) => ({
          userId,
          actorId: session.user.id,
          kind: 'meeting' as const,
          titleKey: notificationKey,
          params: {
            actorId: session.user.id,
            actorLabel: session.user.name ?? undefined,
            meetingId,
          },
          entityType: 'meeting' as const,
          entityId: meetingId,
          dedupeKey: entityCollapseKey('meeting', meetingId, `${notificationKey}:${userId}`),
          dedupePermanent: false,
          link: '/meetings',
          meetingId,
        })),
```

`:1070` (mention in notes) —

```ts
      mentionedIds.map((userId) => ({
        userId,
        actorId: session.user.id,
        kind: 'mention' as const,
        titleKey: 'notif.mention.meeting',
        params: {
          actorId: session.user.id,
          actorLabel: session.user.name ?? undefined,
          meetingId,
        },
        entityType: 'meeting' as const,
        entityId: meetingId,
        dedupeKey: entityCollapseKey('meeting', meetingId, `mention:${userId}`),
        dedupePermanent: false,
        link: '/meetings',
        meetingId,
      })),
```

In `src/features/meetings/ai-actions.ts`, add the `entityCollapseKey` import and change the two writers.

The rows pushed into `pendingNotifications` (auto-assign) become:

```ts
      pendingNotifications.push({
        userId: assigneeId,
        actorId: session.user.id,
        kind: 'meeting' as const,
        titleKey: 'notif.task.auto_assigned',
        params: {
          actorId: session.user.id,
          actorLabel: session.user.name ?? undefined,
          meetingId,
          taskId,
        },
        entityType: 'task' as const,
        entityId: taskId,
        dedupeKey: entityCollapseKey('meeting', meetingId, `auto_assigned:${assigneeId}`),
        dedupePermanent: false,
        link: '/meetings',
        meetingId,
      })
```

(keep whatever local variable names that block already uses for `assigneeId`, `taskId` and `meetingId`; only the payload shape changes).

`:3199` (mention in a note segment) —

```ts
      mentionedIds.map((userId) => ({
        userId,
        actorId: session.user.id,
        kind: 'mention' as const,
        titleKey: 'notif.mention.meeting',
        params: {
          actorId: session.user.id,
          actorLabel: session.user.name ?? undefined,
          meetingId: meeting.id,
        },
        entityType: 'meeting' as const,
        entityId: meeting.id,
        dedupeKey: entityCollapseKey('meeting', meeting.id, `mention:${userId}`),
        dedupePermanent: false,
        link: '/meetings',
        meetingId: meeting.id,
      })),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/notifications/call-sites.test.ts && npx tsc --noEmit && npm test`
Expected: `call-sites.test.ts` PASS, 13 tests. `tsc` clean. Full suite PASS — `src/features/meetings/ai-actions.test.ts` and `src/features/admin/trash-actions.test.ts` both mock `createNotifications` with `vi.fn()`, so neither inspects the payload shape.

- [ ] **Step 5: Commit**

```bash
git add src/features/apps/comment-actions.ts src/features/meetings/actions.ts src/features/meetings/ai-actions.ts src/features/notifications/call-sites.test.ts
git commit -m "refactor(notifications): every call site writes a title key and ids, never a frozen sentence"
```

---

### Task 19: The read path renders keys, collapse counts and dead entities

The bell keeps its current shape; only the query underneath changes. Three things move: rows render from `title_key` + `params` (falling back to the stored sentence), a collapsed row wears its count, and a notification whose entity is gone renders as **unavailable rather than 404ing**.

**Files:**
- Modify: `src/features/notifications/queries.ts`
- Modify: `src/features/notifications/actions.ts:31-39`
- Modify: `src/features/notifications/components/notification-bell-client.tsx:129-146`
- Test: `src/features/notifications/queries.test.ts`

**Interfaces:**
- Consumes: `renderNotification`, `type NotificationParams`, `type ResolvedNames` from `./text` (Task 11); the columns from Task 15.
- Produces: `type NotificationItem` gains `kind: string`, `titleKey: string | null`, `params: NotificationParams | null`, `collapseCount: number`, `available: boolean`, and `title`/`link` become the **rendered** values; `function resolveNotificationNames(rows)`. Task 23's admin surface reads the same shape.

- [ ] **Step 1: Write the failing test**

Create `src/features/notifications/queries.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toNotificationItems } from './queries'

const NAMES = new Map<string, string>([['u-9', 'Shanika'], ['app-a', 'LogPup']])

const dbRow = (over: Record<string, unknown> = {}) => ({
  id: 'n-1',
  kind: 'mention',
  titleKey: 'notif.mention.app',
  params: { actorId: 'u-9', appId: 'app-a' },
  title: null,
  body: null,
  link: '/apps/logpup?tab=discussion',
  read: false,
  collapseCount: 1,
  createdAt: new Date('2026-08-20T04:30:00.000Z'),
  entityType: 'app' as string | null,
  entityId: 'app-a' as string | null,
  entityAlive: true,
  actorName: 'Shanika',
  actorAvatarUrl: null,
  ...over,
})

describe('toNotificationItems', () => {
  it('renders the title from the key and the current names', () => {
    const [item] = toNotificationItems([dbRow()], NAMES)
    expect(item.title).toBe('Shanika mentioned you in LogPup')
    expect(item.kind).toBe('mention')
    expect(item.available).toBe(true)
  })

  it('falls back to the stored sentence for a pre-substrate row', () => {
    const [item] = toNotificationItems(
      [dbRow({ titleKey: null, params: null, title: 'Nuwan mentioned you', kind: 'legacy' })],
      NAMES,
    )
    expect(item.title).toBe('Nuwan mentioned you')
  })

  it('wears the collapse count when several events collapsed into one row', () => {
    const [item] = toNotificationItems([dbRow({ collapseCount: 5 })], NAMES)
    expect(item.title).toBe('Shanika mentioned you in LogPup (5×)')
    expect(item.collapseCount).toBe(5)
  })

  it('marks a row whose entity is gone as unavailable and strips its link', () => {
    // A notification about a trashed task must not 404 on click. The row
    // survives the entity on purpose — no foreign key — so the read path is
    // where it degrades.
    const [item] = toNotificationItems([dbRow({ entityAlive: false })], NAMES)
    expect(item.available).toBe(false)
    expect(item.link).toBeNull()
    expect(item.title).toBe('Shanika mentioned you in LogPup')
  })

  it('leaves a row that names no entity available', () => {
    const [item] = toNotificationItems(
      [dbRow({ entityType: null, entityId: null, entityAlive: false })],
      NAMES,
    )
    expect(item.available).toBe(true)
    expect(item.link).toBe('/apps/logpup?tab=discussion')
  })

  it('prefers the params href over the stored link for an overflow row', () => {
    const [item] = toNotificationItems(
      [dbRow({
        kind: 'system.overflow',
        titleKey: 'notif.overflow.more',
        params: { count: 3, href: '/notifications?day=2026-08-20' },
        collapseCount: 3,
        entityType: null,
        entityId: null,
      })],
      NAMES,
    )
    expect(item.title).toBe('3 more updates today')
    expect(item.link).toBe('/notifications?day=2026-08-20')
  })

  it('maps an empty read to an empty list', () => {
    expect(toNotificationItems([], NAMES)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/notifications/queries.test.ts`
Expected: FAIL with `SyntaxError: The requested module './queries' does not provide an export named 'toNotificationItems'`.

- [ ] **Step 3: Write minimal implementation**

Replace `src/features/notifications/queries.ts` entirely with:

```ts
import { cache } from 'react'
import { and, count, desc, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import { db } from '@/db'
import { liveApps, liveMeetings, liveSprints, liveTasks } from '@/db/live'
import { notifications, users } from '@/db/schema'
import { renderNotification, type NotificationParams, type ResolvedNames } from './text'

// A notification's meetingId is nullable (mentions never carry one; meeting
// invites/moves do) — so a trashed meeting must hide only the notifications
// tied to it, never the ones that were never about a meeting at all. Left
// joining liveMeetings and requiring "no meetingId at all" OR "the meeting
// it names is still live" is what keeps both halves true at once.
const notificationMeetingIsLiveOrAbsent = or(
  isNull(notifications.meetingId),
  isNotNull(liveMeetings.id),
)

export type NotificationItem = {
  id: string
  kind: string
  /** Already RENDERED. The key and the bag are carried for debugging only. */
  title: string
  titleKey: string | null
  params: NotificationParams | null
  body: string | null
  link: string | null
  read: boolean
  collapseCount: number
  createdAt: Date
  /** False when the entity this row points at has been trashed. */
  available: boolean
  actorName: string | null
  actorAvatarUrl: string | null
}

/** The shape the two reads below select, before rendering. */
export type NotificationRow = {
  id: string
  kind: string
  titleKey: string | null
  params: NotificationParams | null
  title: string | null
  body: string | null
  link: string | null
  read: boolean
  collapseCount: number
  createdAt: Date
  entityType: string | null
  entityId: string | null
  entityAlive: boolean
  actorName: string | null
  actorAvatarUrl: string | null
}

/**
 * Pure, so the rendering rules are testable without a database.
 *
 * A row whose entity is gone renders as UNAVAILABLE rather than 404ing: the row
 * deliberately carries no foreign key so it outlives its target, which makes
 * the read path the only place that can degrade it honestly. It keeps its text
 * — "Shanika mentioned you in LogPup" is still true — and loses its link.
 */
export function toNotificationItems(
  rows: readonly NotificationRow[],
  names: ResolvedNames,
): NotificationItem[] {
  return rows.map((row) => {
    const available = row.entityType === null || row.entityId === null || row.entityAlive
    const rendered = renderNotification(
      {
        titleKey: row.titleKey,
        params: row.params,
        title: row.title,
        link: row.link,
        collapseCount: row.collapseCount,
      },
      names,
    )
    return {
      id: row.id,
      kind: row.kind,
      title: rendered.title,
      titleKey: row.titleKey,
      params: row.params,
      body: row.body,
      link: available ? rendered.href : null,
      read: row.read,
      collapseCount: row.collapseCount,
      createdAt: row.createdAt,
      available,
      actorName: row.actorName,
      actorAvatarUrl: row.actorAvatarUrl,
    }
  })
}

/**
 * id -> current display name, for every id any of these rows names.
 *
 * Three small reads rather than three joins on a jsonb path: the bell asks for
 * at most 20 rows, so the id sets are tiny, and a join through `params->>'appId'`
 * cannot use an index and would have to be written per key.
 */
export async function resolveNotificationNames(
  rows: readonly NotificationRow[],
): Promise<ResolvedNames> {
  const userIds = new Set<string>()
  const appIds = new Set<string>()
  const meetingIds = new Set<string>()
  for (const row of rows) {
    const p = row.params
    if (!p) continue
    if (p.actorId) userIds.add(p.actorId)
    if (p.appId) appIds.add(p.appId)
    if (p.meetingId) meetingIds.add(p.meetingId)
  }

  const names = new Map<string, string>()
  if (userIds.size > 0) {
    const found = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, [...userIds]))
    for (const row of found) names.set(row.id, row.name)
  }
  if (appIds.size > 0) {
    const found = await db
      .select({ id: liveApps.id, name: liveApps.name })
      .from(liveApps)
      .where(inArray(liveApps.id, [...appIds]))
    for (const row of found) names.set(row.id, row.name)
  }
  if (meetingIds.size > 0) {
    const found = await db
      .select({ id: liveMeetings.id, title: liveMeetings.title })
      .from(liveMeetings)
      .where(inArray(liveMeetings.id, [...meetingIds]))
    for (const row of found) names.set(row.id, row.title)
  }
  return names
}

/**
 * Whether each row's entity is still live.
 *
 * One read per entity kind, only for the kinds actually present. Everything
 * goes through the live_* subqueries, named literally so db/live.test.ts's
 * source scan can see them.
 */
async function resolveAliveness(
  rows: readonly { entityType: string | null; entityId: string | null }[],
): Promise<Set<string>> {
  const taskIds = rows.filter((r) => r.entityType === 'task' && r.entityId).map((r) => r.entityId as string)
  const appIds = rows.filter((r) => r.entityType === 'app' && r.entityId).map((r) => r.entityId as string)
  const sprintIds = rows.filter((r) => r.entityType === 'sprint' && r.entityId).map((r) => r.entityId as string)
  const meetingIds = rows.filter((r) => r.entityType === 'meeting' && r.entityId).map((r) => r.entityId as string)

  const alive = new Set<string>()
  if (taskIds.length > 0) {
    const found = await db.select({ id: liveTasks.id }).from(liveTasks).where(inArray(liveTasks.id, taskIds))
    for (const row of found) alive.add(row.id)
  }
  if (appIds.length > 0) {
    const found = await db.select({ id: liveApps.id }).from(liveApps).where(inArray(liveApps.id, appIds))
    for (const row of found) alive.add(row.id)
  }
  if (sprintIds.length > 0) {
    const found = await db.select({ id: liveSprints.id }).from(liveSprints).where(inArray(liveSprints.id, sprintIds))
    for (const row of found) alive.add(row.id)
  }
  if (meetingIds.length > 0) {
    const found = await db.select({ id: liveMeetings.id }).from(liveMeetings).where(inArray(liveMeetings.id, meetingIds))
    for (const row of found) alive.add(row.id)
  }
  return alive
}

/**
 * Both wrapped in React `cache` — per-request deduplication, not caching in the
 * stale-data sense. The header bell renders in the (app) layout while the
 * dashboard renders its own notifications card, so a single dashboard load asks
 * for this user's unread count twice. Nothing survives the request, so no
 * viewer can be served another's notifications.
 *
 * `limit` is part of the memo key: the bell asks for 20 and the dashboard card
 * for 8, so those stay two reads.
 *
 * NOW SERVED BY notifications_user_read_created_idx and
 * notifications_user_created_idx. The comment in actions.ts claiming "two
 * indexed queries" was false for this table's whole life until those existed.
 */
export const listNotifications = cache(async function listNotifications(
  userId: string,
  limit = 20,
): Promise<NotificationItem[]> {
  const raw = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      titleKey: notifications.titleKey,
      params: notifications.params,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      read: notifications.read,
      collapseCount: notifications.collapseCount,
      createdAt: notifications.createdAt,
      entityType: notifications.entityType,
      entityId: notifications.entityId,
      actorName: users.name,
      actorAvatarUrl: users.avatarUrl,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .leftJoin(liveMeetings, eq(notifications.meetingId, liveMeetings.id))
    .where(and(
      eq(notifications.userId, userId),
      isNull(notifications.dismissedAt),
      notificationMeetingIsLiveOrAbsent,
    ))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)

  const alive = await resolveAliveness(raw)
  const rows: NotificationRow[] = raw.map((row) => ({
    ...row,
    entityAlive: row.entityId !== null && alive.has(row.entityId),
  }))
  return toNotificationItems(rows, await resolveNotificationNames(rows))
})

export const unreadNotificationCount = cache(async function unreadNotificationCount(
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .leftJoin(liveMeetings, eq(notifications.meetingId, liveMeetings.id))
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.read, false),
        isNull(notifications.dismissedAt),
        notificationMeetingIsLiveOrAbsent,
      ),
    )
  return row?.value ?? 0
})
```

In `src/features/notifications/actions.ts`, no signature changes are needed — `NotificationSnapshot` already carries `NotificationItem[]`. Update the doc comment on `fetchNotificationSnapshot` so it stops asserting something that was false: replace "two indexed queries scoped to the caller's own rows" with:

```ts
 * Deliberately the smallest possible read rather than a route refresh: two
 * queries scoped to the caller's own rows — served by
 * notifications_user_read_created_idx and notifications_user_created_idx since
 * the substrate work; this table carried NO index at all before that, and this
 * comment claimed otherwise — no RSC re-render of the page behind it, and no
 * way for a caller to point it at anyone else's notifications.
```

In `src/features/notifications/components/notification-bell-client.tsx`, replace the icon choice and the row body inside `liveItems.map`:

```tsx
              const Icon = n.kind === 'mention'
                ? AtSign
                : n.kind === 'system.overflow'
                  ? Layers
                  : CalendarPlus
              const inner = (
                <>
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm leading-snug', !n.read && 'font-medium')}>{n.title}</p>
                    {n.body ? (
                      <p className="truncate text-xs text-muted-foreground">{n.body}</p>
                    ) : null}
                    {/*
                      Colour is never the only signal (WCAG 1.4.1): the dead
                      entity states itself in words rather than by being greyed.
                    */}
                    {!n.available ? (
                      <p className="text-xs text-muted-foreground">No longer available</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read ? (
                    <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </>
              )
```

and add `Layers` to the lucide import on line 6: `import { AtSign, Bell, CalendarPlus, Layers } from 'lucide-react'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/notifications/queries.test.ts && npx tsc --noEmit && npm test && npm run lint`
Expected: `queries.test.ts` PASS, 7 tests. `tsc` clean. Full suite PASS, `live.test.ts` included — every soft-deleted table here is read through a `live*` subquery named literally. Lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/queries.ts src/features/notifications/queries.test.ts src/features/notifications/actions.ts src/features/notifications/components/notification-bell-client.tsx
git commit -m "feat(notifications): render the bell from title keys, collapse counts and entity liveness"
```

---

### Task 20: `pruneNotifications` — the one hard delete

`notifications` is not a soft-deleted table and must not become one. `src/db/live.test.ts` check 4 confines `db.delete(` to named functions, so this exemption is an explicit, reviewed edit with its reason in the file — which is exactly the review this delete should get.

It must be a `function` **declaration**: check 4's `functionSpan` matches `function <name>(`, and a delete inside an arrow function assigned to a const would not match, leaving the exemption silently doing nothing.

**Files:**
- Create: `src/features/notifications/retention.ts`
- Modify: `src/db/live.test.ts` — the `DELETE_ALLOWED_FUNCTIONS` record
- Test: `src/features/notifications/retention.test.ts`

**Interfaces:**
- Consumes: nothing beyond `@/db` and the schema.
- Produces: `const NOTIFICATION_RETENTION_DAYS`, `function pruneNotifications(now: Date): Promise<number>`. Task 21's tick calls it.

- [ ] **Step 1: Write the failing test**

Create `src/features/notifications/retention.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteCalls: unknown[] = []
let returned: unknown[] = []

vi.mock('@/db', () => ({
  db: {
    delete: () => ({
      where: (predicate: unknown) => {
        deleteCalls.push(predicate)
        return { returning: async () => returned }
      },
    }),
  },
}))

const { NOTIFICATION_RETENTION_DAYS, pruneNotifications } = await import('./retention')

beforeEach(() => {
  deleteCalls.length = 0
  returned = []
})

describe('pruneNotifications', () => {
  it('keeps two months of history', () => {
    expect(NOTIFICATION_RETENTION_DAYS).toBe(60)
  })

  it('issues exactly one delete and reports how many rows went', async () => {
    returned = [{ id: 'n-1' }, { id: 'n-2' }]
    const removed = await pruneNotifications(new Date('2026-08-20T04:30:00.000Z'))
    expect(removed).toBe(2)
    expect(deleteCalls).toHaveLength(1)
  })

  it('reports zero when nothing is old enough', async () => {
    returned = []
    expect(await pruneNotifications(new Date('2026-08-20T04:30:00.000Z'))).toBe(0)
  })

  it('is a plain hard delete, because notifications is not a soft-deleted table', async () => {
    // Adding a deletedAt here would fail live.test.ts check 5 and drag
    // notifications into the six-table soft-delete contract it does not belong
    // in. dismissed_at is the reader's action; this is retention.
    returned = [{ id: 'n-1' }]
    await pruneNotifications(new Date('2026-08-20T04:30:00.000Z'))
    expect(deleteCalls).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/notifications/retention.test.ts`
Expected: FAIL with `Error: Failed to load url ./retention (resolved id: ./retention) ... Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/notifications/retention.ts`:

```ts
import { and, eq, isNotNull, lt, or } from 'drizzle-orm'
import { db } from '@/db'
import { notifications } from '@/db/schema'

/**
 * How long a notification is kept once its reader is done with it.
 *
 * Two months: long enough that "what was I told about that?" is answerable
 * across a quarter boundary, short enough that the table's growth is bounded by
 * something other than the product's age.
 */
export const NOTIFICATION_RETENTION_DAYS = 60

/**
 * THE ONE HARD DELETE in this feature, and a deliberate one.
 *
 * `notifications` is NOT a soft-deleted table and must not become one: adding a
 * deletedAt would fail src/db/live.test.ts check 5 and drag an ephemeral
 * operational record into the six-table soft-delete contract, where a trashed
 * notification would then be restorable, listable and purgeable like a
 * project. `dismissed_at` is the reader's action; this is retention.
 *
 * MUST STAY A `function` DECLARATION. live.test.ts check 4 confines db.delete(
 * per file to the function names in DELETE_ALLOWED_FUNCTIONS, and its
 * functionSpan matcher looks for `function <name>(` — a delete inside an arrow
 * function assigned to a const would not match, and the exemption would
 * silently do nothing while the check reported no offenders.
 *
 * Only rows the reader is finished with: read, or dismissed. An unread row from
 * three months ago is still something nobody has seen, and deleting it is the
 * system deciding on the reader's behalf that it did not matter.
 */
export async function pruneNotifications(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const removed = await db
    .delete(notifications)
    .where(
      and(
        lt(notifications.createdAt, cutoff),
        or(eq(notifications.read, true), isNotNull(notifications.dismissedAt)),
      ),
    )
    .returning({ id: notifications.id })
  return removed.length
}
```

In `src/db/live.test.ts`, add one entry to `DELETE_ALLOWED_FUNCTIONS`:

```ts
  // why: notification RETENTION, and the one hard delete in that feature.
  // `notifications` is deliberately NOT a soft-deleted table — it carries
  // `dismissed_at` rather than `deletedAt` precisely so check 5 keeps SOFT_TABLES
  // at six and an ephemeral operational record stays out of the trash bin. There
  // is nothing to restore here: a notification two months past the moment its
  // reader read or dismissed it has no second life, and keeping tombstones for
  // it would grow the very table this function exists to bound.
  'src/features/notifications/retention.ts': 'pruneNotifications',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/notifications/retention.test.ts src/db/live.test.ts && npx tsc --noEmit`
Expected: both PASS. `live.test.ts` check 4 reports no offenders (the delete is inside `pruneNotifications`), and check 5 still finds `SOFT_TABLES` at six. `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/retention.ts src/features/notifications/retention.test.ts src/db/live.test.ts
git commit -m "feat(notifications): add retention pruning as the feature's one reviewed hard delete"
```

---

### Task 21: `/api/cron/notify-tick` — the one scheduled entry point

LogPup is on Vercel **Hobby**: two cron jobs, daily granularity. `vercel.json` declares `/api/cron/backup` today. This adds the second and **last** one. Everything periodic becomes an ordered step inside it — retention pruning now, the digest in Task 23, spec C's deadline escalation later. **A second scheduled concern becomes a step, never a job**, and that sentence lives in the route's own comment so nobody adds one on a plan with no room for it.

The orchestration lives in `tick.ts` rather than in the route, so it is testable: `vitest.config.ts` matches `.ts` only, and importing `next/server` in a node test environment is a dependency the steps do not need.

**Files:**
- Create: `src/lib/cron-auth.ts`
- Create: `src/features/notifications/tick.ts`
- Create: `src/app/api/cron/notify-tick/route.ts`
- Modify: `vercel.json`
- Test: `src/features/notifications/tick.test.ts`
- Test: `src/lib/cron-auth.test.ts`

**Interfaces:**
- Consumes: `pruneNotifications` from `./retention` (Task 20).
- Produces: `function isCronAuthorized(request: Request): boolean`; `type TickResult`, `function runNotifyTick(now: Date): Promise<TickResult>`. Task 23 adds the digest step to `runNotifyTick`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/cron-auth.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isCronAuthorized } from './cron-auth'

const original = process.env.CRON_SECRET

beforeEach(() => {
  process.env.CRON_SECRET = 'sekrit'
})

afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = original
})

const req = (auth?: string) =>
  new Request('https://example.test/api/cron/notify-tick', {
    headers: auth === undefined ? {} : { authorization: auth },
  })

describe('isCronAuthorized', () => {
  it('accepts the bearer token Vercel Cron sends', () => {
    expect(isCronAuthorized(req('Bearer sekrit'))).toBe(true)
  })

  it('refuses a wrong token', () => {
    expect(isCronAuthorized(req('Bearer wrong'))).toBe(false)
  })

  it('refuses a missing header', () => {
    expect(isCronAuthorized(req())).toBe(false)
  })

  it('refuses everything when no secret is configured', () => {
    delete process.env.CRON_SECRET
    expect(isCronAuthorized(req('Bearer sekrit'))).toBe(false)
  })

  it('does not throw on a header of a completely different length', () => {
    // timingSafeEqual requires equal-length buffers; hashing both sides first
    // is what stops a short header throwing instead of refusing.
    expect(isCronAuthorized(req('x'))).toBe(false)
    expect(isCronAuthorized(req('Bearer ' + 'x'.repeat(5000)))).toBe(false)
  })
})
```

Create `src/features/notifications/tick.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { pruneMock } = vi.hoisted(() => ({ pruneMock: vi.fn() }))
vi.mock('./retention', () => ({ pruneNotifications: pruneMock, NOTIFICATION_RETENTION_DAYS: 60 }))

const { runNotifyTick } = await import('./tick')

const NOW = new Date('2026-08-20T04:30:00.000Z')

beforeEach(() => {
  pruneMock.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('runNotifyTick', () => {
  it('runs the prune step and reports what it did', async () => {
    pruneMock.mockResolvedValue(7)
    const result = await runNotifyTick(NOW)
    expect(pruneMock).toHaveBeenCalledWith(NOW)
    expect(result.steps.prune).toEqual({ ok: true, pruned: 7 })
    expect(result.ok).toBe(true)
  })

  it('reports a failed step instead of failing the whole tick', async () => {
    // One cron job carries every periodic concern in the product. A step that
    // throws must not take the others down with it, or one bad prune stops the
    // digest for everybody.
    pruneMock.mockRejectedValue(new Error('neon exploded'))
    const result = await runNotifyTick(NOW)
    expect(result.steps.prune).toEqual({ ok: false, error: 'neon exploded' })
    expect(result.ok).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })

  it('runs its steps in a fixed, declared order', async () => {
    pruneMock.mockResolvedValue(0)
    const result = await runNotifyTick(NOW)
    expect(Object.keys(result.steps)).toEqual(['prune'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/cron-auth.test.ts src/features/notifications/tick.test.ts`
Expected: FAIL — both files fail to resolve their module under test: `Error: Failed to load url ./cron-auth …` and `Error: Failed to load url ./tick …`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/cron-auth.ts`:

```ts
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Constant-time check of the bearer token Vercel Cron sends.
 *
 * A plain `===` leaks timing information proportional to the matching prefix
 * length, letting an attacker recover CRON_SECRET byte by byte. Hashing both
 * sides first also normalises their length, so timingSafeEqual — which requires
 * equal-length buffers — never throws regardless of what the caller sends.
 *
 * EXTRACTED HERE rather than duplicated: /api/cron/backup carries its own copy
 * of this logic today, and it is deliberately left alone (it is outside this
 * work's scope). A security check with two implementations is one that drifts,
 * so the new route imports this and the backup route can adopt it whenever it
 * is next touched.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const providedDigest = createHash('sha256').update(provided).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(providedDigest, expectedDigest)
}
```

Create `src/features/notifications/tick.ts`:

```ts
import { pruneNotifications } from './retention'

export type StepResult =
  | { ok: true; pruned: number }
  | { ok: true; queued: number; sent: number; failed: number }
  | { ok: false; error: string }

export type TickResult = {
  ok: boolean
  at: string
  steps: Record<string, StepResult>
}

/**
 * EVERYTHING PERIODIC, IN ONE PLACE.
 *
 * LogPup is on Vercel Hobby: two cron jobs, daily granularity. /api/cron/backup
 * is one. This is the other, and it is the LAST one. A second scheduled concern
 * becomes an ordered step in this function — never a second job — and the route
 * that calls it says so too.
 *
 * Steps are ordered and independently caught. One cron carries every periodic
 * concern in the product, so a step that throws must not take the others down
 * with it: a failing prune must not stop the digest for everybody. The result
 * names every step and its outcome, so a failure is visible in the invocation
 * log rather than inferred from a 500.
 *
 * Lives here rather than in the route handler so it can be tested: vitest
 * matches src/**\/*.test.ts and importing next/server in a node environment is
 * a dependency these steps do not need.
 */
export async function runNotifyTick(now: Date): Promise<TickResult> {
  const steps: Record<string, StepResult> = {}

  try {
    steps.prune = { ok: true, pruned: await pruneNotifications(now) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[notify-tick] prune failed:', error)
    steps.prune = { ok: false, error: message }
  }

  return {
    ok: Object.values(steps).every((step) => step.ok),
    at: now.toISOString(),
    steps,
  }
}
```

Create `src/app/api/cron/notify-tick/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { runNotifyTick } from '@/features/notifications/tick'
import { isCronAuthorized } from '@/lib/cron-auth'

/**
 * THE ONE SCHEDULED ENTRY POINT for everything notification-shaped.
 *
 * LogPup is on Vercel HOBBY: two cron jobs, daily granularity, and
 * /api/cron/backup already holds one of them. THIS IS THE SECOND AND LAST.
 *
 * DO NOT ADD ANOTHER CRON JOB. A new periodic concern — deadline escalation,
 * a weekly roll-up, anything — becomes an ordered step inside runNotifyTick
 * (src/features/notifications/tick.ts), never a new entry in vercel.json. This
 * is a plan constraint, not a preference: there is no third slot to add one to.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set,
 * which we require so the endpoint cannot be triggered by anyone else.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runNotifyTick(new Date())
  // 200 even when a step failed: the step results are the report, and a 500
  // would make Vercel retry a tick whose successful steps already ran.
  return NextResponse.json(result)
}
```

In `vercel.json`, extend the `crons` array:

```json
  "crons": [
    { "path": "/api/cron/backup", "schedule": "0 3 * * *" },
    { "path": "/api/cron/notify-tick", "schedule": "0 2 * * *" }
  ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/cron-auth.test.ts src/features/notifications/tick.test.ts && npx tsc --noEmit && npm run build`
Expected: both test files PASS, 8 tests. `tsc` clean. `npm run build` succeeds and lists `/api/cron/notify-tick` among the routes. **Two cron entries in `vercel.json` and no more** — this is the Hobby ceiling.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cron-auth.ts src/lib/cron-auth.test.ts src/features/notifications/tick.ts src/features/notifications/tick.test.ts src/app/api/cron/notify-tick/route.ts vercel.json
git commit -m "feat(notifications): add the one notify-tick cron with retention pruning as its first step"
```

---

### Task 22: `digestEligible` and `assembleDigest` — the pure half of the digest

The digest is one email per person per day, and it is a **one-shot credibility bet**: if it duplicates Google's own calendar invite mail, fires empty, or double-fires from a cron retry, everyone writes a filter rule within a week and every future channel goes to that folder with it.

The rule that prevents the first of those is written as **one function**, evaluated at send time and never at insert time — restoring a trashed meeting nulls `google_event_id`. The question it answers is "has Google already told these people?", and the honest predicate for that is the meeting's sync state, not the mere presence of an event id: an id-only check is right for CREATE failures and wrong for UPDATE failures, where the id is set and the guests were never told.

`calendarSyncState` is therefore an **optional field from day one**. Spec E adds the column; until then it is `undefined` and the helper degrades to the id-only rule with zero behaviour change — which makes the spec's `'failed'` case a passing test today rather than a pending one, and makes spec E's edit "nothing" instead of "one line nobody re-reads".

**Files:**
- Create: `src/features/notifications/digest.ts`
- Test: `src/features/notifications/digest.test.ts`

**Interfaces:**
- Consumes: `type NotificationParams` from `./text` (Task 11).
- Produces: `type CalendarSyncState`, `type DigestMeeting`, `function digestEligible(m: DigestMeeting): boolean`, `type DigestEvent`, `type Digest`, `function assembleDigest(events, meetings): Digest[]`. Task 23 calls both.

- [ ] **Step 1: Write the failing test**

Create `src/features/notifications/digest.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { assembleDigest, digestEligible, type DigestEvent, type DigestMeeting } from './digest'

const meeting = (over: Partial<DigestMeeting> = {}): DigestMeeting => ({
  id: 'm-1',
  title: 'Weekly sync',
  startsAt: new Date('2026-08-21T04:00:00.000Z'),
  googleEventId: null,
  attendeeIds: ['u-1'],
  ...over,
})

const event = (over: Partial<DigestEvent> = {}): DigestEvent => ({
  userId: 'u-1',
  titleKey: 'notif.mention.app',
  params: { actorId: 'u-9', appId: 'app-a' },
  occurredAt: new Date('2026-08-20T04:30:00.000Z'),
  ...over,
})

describe('digestEligible', () => {
  it('includes a meeting Google never got told about', () => {
    expect(digestEligible(meeting({ googleEventId: null }))).toBe(true)
  })

  it('excludes a meeting Google already emailed', () => {
    // Google sent its own invite with sendUpdates:'all'. Duplicating it is the
    // fastest way to teach everyone to filter this address.
    expect(digestEligible(meeting({ googleEventId: 'g-1', calendarSyncState: 'synced' }))).toBe(false)
  })

  it('INCLUDES a meeting whose id is set but whose sync failed', () => {
    // The case an id-only rule gets wrong, and the exact case this fallback
    // exists for: the event id is set from the original create, the UPDATE
    // failed, and the guests were never told about a change that already
    // landed in LogPup.
    expect(digestEligible(meeting({ googleEventId: 'g-1', calendarSyncState: 'failed' }))).toBe(true)
  })

  it('includes an orphaned meeting', () => {
    expect(digestEligible(meeting({ googleEventId: 'g-1', calendarSyncState: 'orphaned' }))).toBe(true)
  })

  it('degrades to the id-only rule while the sync-state column does not exist', () => {
    // calendarSyncState is optional precisely so this file needs no edit when
    // spec E adds the column. Undefined behaves exactly as today.
    expect(digestEligible(meeting({ googleEventId: 'g-1', calendarSyncState: undefined }))).toBe(false)
    expect(digestEligible(meeting({ googleEventId: null, calendarSyncState: undefined }))).toBe(true)
  })

  it('is evaluated per meeting, so restoring a trashed one is picked up', () => {
    // Restoring a trashed meeting nulls google_event_id. Evaluating this at
    // insert time would have frozen the old answer.
    const restored = meeting({ googleEventId: null, calendarSyncState: 'pending' })
    expect(digestEligible(restored)).toBe(true)
  })
})

describe('assembleDigest', () => {
  it('builds one digest per person from the EVENTS, not from the bell rows', () => {
    // A capped day still emails in full: the cap suppresses bell rows, and the
    // digest is assembled from what happened.
    const digests = assembleDigest([event(), event({ titleKey: 'notif.meeting.moved' })], [])
    expect(digests).toHaveLength(1)
    expect(digests[0].userId).toBe('u-1')
    expect(digests[0].lines).toHaveLength(2)
  })

  it('gives each person their own digest', () => {
    const digests = assembleDigest([event({ userId: 'u-1' }), event({ userId: 'u-2' })], [])
    expect(digests.map((d) => d.userId).sort()).toEqual(['u-1', 'u-2'])
  })

  it("orders a person's lines oldest first", () => {
    const digests = assembleDigest([
      event({ occurredAt: new Date('2026-08-20T09:00:00.000Z'), titleKey: 'notif.meeting.moved' }),
      event({ occurredAt: new Date('2026-08-20T04:00:00.000Z'), titleKey: 'notif.mention.app' }),
    ], [])
    expect(digests[0].lines.map((l) => l.titleKey)).toEqual(['notif.mention.app', 'notif.meeting.moved'])
  })

  it('adds a line for each eligible meeting, to each of its attendees', () => {
    const digests = assembleDigest([], [meeting({ attendeeIds: ['u-1', 'u-2'] })])
    expect(digests).toHaveLength(2)
    expect(digests[0].lines[0].titleKey).toBe('notif.digest.meeting')
    expect(digests[0].lines[0].params.meetingId).toBe('m-1')
  })

  it('adds no line for a meeting Google already emailed', () => {
    const digests = assembleDigest([], [meeting({ googleEventId: 'g-1', calendarSyncState: 'synced' })])
    expect(digests).toEqual([])
  })

  it('NEVER produces an empty digest — a mail with nothing in it is the fastest way to be filtered', () => {
    expect(assembleDigest([], [])).toEqual([])
    expect(assembleDigest([], [meeting({ attendeeIds: [] })])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/notifications/digest.test.ts`
Expected: FAIL with `Error: Failed to load url ./digest (resolved id: ./digest) ... Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/notifications/digest.ts`:

```ts
import type { NotificationParams } from './text'

/**
 * The states meetings.calendar_sync_state will carry.
 *
 * SPEC E OWNS THE COLUMN. It is declared here as an optional field on
 * DigestMeeting so digestEligible can read it from day one: until the column
 * exists the value is undefined and the rule degrades to the id-only half with
 * zero behaviour change. Spec E's build order then changes NOTHING here — the
 * alternative was "change one expression in one place", which is one expression
 * nobody re-reads.
 *
 * 'failed' means, precisely: guests have not been told about a change that
 * already landed in LogPup.
 */
export type CalendarSyncState = 'pending' | 'synced' | 'failed' | 'orphaned'

export type DigestMeeting = {
  id: string
  title: string
  startsAt: Date
  googleEventId: string | null
  attendeeIds: readonly string[]
  calendarSyncState?: CalendarSyncState
}

/**
 * HAS GOOGLE ALREADY TOLD THESE PEOPLE?
 *
 * Written as one function, and evaluated at SEND TIME, never at insert time:
 * restoring a trashed meeting nulls google_event_id, so an answer frozen at
 * insert would be wrong for exactly the meetings that most need the fallback.
 *
 * The honest predicate is the meeting's sync state, not the presence of an
 * event id. An id-only check is right for CREATE failures and wrong for UPDATE
 * failures, where the id is set from the original create and the guests were
 * never told about the change. Google emailed the `synced` meetings itself via
 * sendUpdates:'all'; LogPup covering the `failed` and `orphaned` ones is what
 * turns a silent calendar-failure path into a real fallback rather than half of
 * one.
 */
export function digestEligible(m: DigestMeeting): boolean {
  if (m.googleEventId === null) return true
  return m.calendarSyncState === 'failed' || m.calendarSyncState === 'orphaned'
}

export type DigestEvent = {
  userId: string
  titleKey: string
  params: NotificationParams
  occurredAt: Date
}

export type DigestLine = { titleKey: string; params: NotificationParams }

export type Digest = {
  userId: string
  lines: DigestLine[]
}

/**
 * One digest per person per day, assembled FROM THE EVENTS rather than from the
 * bell rows.
 *
 * That distinction is the whole reason the per-recipient daily cap is safe to
 * have: a capped day suppresses bell rows and still emails in full, so the cap
 * collapses what a person SEES without deciding what they are TOLD.
 *
 * NEVER PRODUCES AN EMPTY DIGEST. A mail with nothing in it is the fastest way
 * to be filtered, and the filter takes every future channel with it.
 */
export function assembleDigest(
  events: readonly DigestEvent[],
  meetings: readonly DigestMeeting[],
): Digest[] {
  const byUser = new Map<string, { line: DigestLine; at: Date }[]>()

  const push = (userId: string, line: DigestLine, at: Date) => {
    const list = byUser.get(userId) ?? []
    list.push({ line, at })
    byUser.set(userId, list)
  }

  for (const e of events) {
    push(e.userId, { titleKey: e.titleKey, params: e.params }, e.occurredAt)
  }

  for (const m of meetings) {
    if (!digestEligible(m)) continue
    for (const userId of m.attendeeIds) {
      push(userId, { titleKey: 'notif.digest.meeting', params: { meetingId: m.id } }, m.startsAt)
    }
  }

  return [...byUser]
    .filter(([, list]) => list.length > 0)
    .map(([userId, list]) => ({
      userId,
      lines: [...list].sort((a, b) => a.at.getTime() - b.at.getTime()).map((entry) => entry.line),
    }))
}
```

Add the digest line's template to `NOTIFICATION_TEXT` in `src/features/notifications/text.ts`:

```ts
  'notif.digest.meeting': (p, names) =>
    `${(p.meetingId && names.get(p.meetingId)) ?? GONE_MEETING} is coming up`,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/notifications/digest.test.ts src/features/notifications/text.test.ts`
Expected: `digest.test.ts` PASS, 13 tests; `text.test.ts` still PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/digest.ts src/features/notifications/digest.test.ts src/features/notifications/text.ts
git commit -m "feat(notifications): add digestEligible and assembleDigest, with sync state read from day one"
```

---

### Task 23: The digest transport seam, the send step, and the failure surface

Three preconditions, **all enforced in code rather than in a runbook**:

- **A verified sending domain.** Absent it, the digest step is a no-op that logs.
- **An admin-visible delivery-failure surface.** A silent bounce for a month is worse than no email at all.
- **`digest_state` on the row, transitioned in the same transaction that sends**, so a cron retry cannot double-send. A retry that finds rows already marked sends nothing.

The transport ships as a seam that returns a typed refusal. **Adding a mail dependency is a STOP condition** — it is not in this plan's budget and the decision belongs to whoever verifies the domain.

**Files:**
- Create: `src/features/notifications/digest-transport.ts`
- Create: `src/features/notifications/digest-step.ts`
- Create: `src/features/notifications/digest-queries.ts`
- Create: `src/app/(app)/admin/notifications/page.tsx`
- Modify: `src/features/admin/sections.ts`
- Modify: `src/features/notifications/tick.ts`
- Test: `src/features/notifications/digest-step.test.ts`

**Interfaces:**
- Consumes: `assembleDigest`, `digestEligible`, `type Digest` from `./digest` (Task 22); `renderNotification` from `./text` (Task 11); `runNotifyTick` from `./tick` (Task 21); `notifications.digestState` from Task 15; `requireCapability` from `@/features/auth/actor`.
- Produces: `type DigestSendResult`, `function digestSenderConfigured()`, `function sendDigest(digest)`; `type DigestStepResult`, `function runDigestStep(now)`; `type DigestFailure`, `function listDigestFailures(limit)`.

- [ ] **Step 1: Write the failing test**

Create `src/features/notifications/digest-step.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const batched: unknown[][] = []
let queued: Record<string, unknown>[] = []

vi.mock('@/db', () => {
  const chain = () => {
    const thenable = {
      where: () => thenable,
      leftJoin: () => thenable,
      orderBy: () => thenable,
      limit: () => thenable,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(queued).then(resolve),
    }
    return thenable
  }
  return {
    db: {
      select: () => ({ from: () => chain() }),
      update: () => ({ set: () => ({ where: () => ({ __statement: true }) }) }),
      batch: async (statements: unknown[]) => {
        batched.push(statements)
        return []
      },
    },
  }
})

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))
vi.mock('./digest-transport', () => ({
  sendDigest: sendMock,
  digestSenderConfigured: () => sendMock.getMockName() !== 'unconfigured',
}))

const { runDigestStep } = await import('./digest-step')

const NOW = new Date('2026-08-20T04:30:00.000Z')

beforeEach(() => {
  batched.length = 0
  queued = []
  sendMock.mockReset()
  sendMock.mockResolvedValue({ ok: true })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('runDigestStep', () => {
  it('does nothing at all when nothing is queued', async () => {
    queued = []
    const result = await runDigestStep(NOW)
    expect(result).toEqual({ queued: 0, sent: 0, failed: 0 })
    expect(sendMock).not.toHaveBeenCalled()
    expect(batched).toEqual([])
  })

  it('marks a sent digest in the SAME batch as the send, so a retry cannot double-send', async () => {
    queued = [{
      id: 'n-1', userId: 'u-1', titleKey: 'notif.mention.app',
      params: { actorId: 'u-9', appId: 'app-a' }, createdAt: NOW,
    }]
    const result = await runDigestStep(NOW)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ queued: 1, sent: 1, failed: 0 })
    expect(batched).toHaveLength(1)
    expect(batched[0]).toHaveLength(1)
  })

  it('marks a refused digest failed rather than losing it silently', async () => {
    // A silent bounce for a month is worse than no email at all, which is why
    // the refusal lands on a row an admin can see instead of in a log line.
    queued = [{
      id: 'n-1', userId: 'u-1', titleKey: 'notif.mention.app',
      params: {}, createdAt: NOW,
    }]
    sendMock.mockResolvedValue({ ok: false, reason: 'no_verified_domain', detail: 'DIGEST_FROM_DOMAIN is unset' })
    const result = await runDigestStep(NOW)
    expect(result).toEqual({ queued: 1, sent: 0, failed: 1 })
    expect(batched).toHaveLength(1)
  })

  it("groups a person's queued rows into ONE mail, not one per row", async () => {
    queued = [
      { id: 'n-1', userId: 'u-1', titleKey: 'notif.mention.app', params: {}, createdAt: NOW },
      { id: 'n-2', userId: 'u-1', titleKey: 'notif.meeting.moved', params: {}, createdAt: NOW },
    ]
    const result = await runDigestStep(NOW)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(result.queued).toBe(2)
    expect(result.sent).toBe(2)
  })

  it('never throws — a digest failure must not fail the tick', async () => {
    queued = [{ id: 'n-1', userId: 'u-1', titleKey: 'notif.mention.app', params: {}, createdAt: NOW }]
    sendMock.mockRejectedValue(new Error('transport exploded'))
    await expect(runDigestStep(NOW)).resolves.toMatchObject({ failed: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/notifications/digest-step.test.ts`
Expected: FAIL with `Error: Failed to load url ./digest-step (resolved id: ./digest-step) ... Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/notifications/digest-transport.ts`:

```ts
import type { Digest } from './digest'

export type DigestSendResult =
  | { ok: true }
  | { ok: false; reason: 'no_verified_domain' | 'no_transport'; detail: string }

/**
 * PRECONDITION 1, enforced in code rather than in a runbook: a verified sending
 * domain. Absent it, the digest step is a no-op that logs.
 */
export function digestSenderConfigured(): boolean {
  return Boolean(process.env.DIGEST_FROM_DOMAIN)
}

/**
 * THE SEND SEAM, and today it refuses.
 *
 * The digest is a one-shot credibility bet: if it duplicates Google's own
 * calendar mail, fires empty, or double-fires from a cron retry, everyone
 * writes a filter rule within a week and every future channel goes to that
 * folder with it. So it ships OFF, behind a typed refusal, and turns on when
 * the domain is verified.
 *
 * ADDING A MAIL DEPENDENCY IS A STOP CONDITION for the plan this file ships
 * under. No SDK, no SMTP client, no transactional-mail account. The refusal
 * below is what the digest step is built against, and it is a real return
 * value rather than a thrown error precisely so the step can record it on a row
 * an admin can see.
 */
export async function sendDigest(digest: Digest): Promise<DigestSendResult> {
  if (!digestSenderConfigured()) {
    console.warn(
      `[digest] skipped ${digest.lines.length} line(s) for ${digest.userId}: no verified sending domain`,
    )
    return { ok: false, reason: 'no_verified_domain', detail: 'DIGEST_FROM_DOMAIN is unset' }
  }
  console.warn(
    `[digest] would send ${digest.lines.length} line(s) to ${digest.userId}, but no transport is installed`,
  )
  return {
    ok: false,
    reason: 'no_transport',
    detail: 'A verified domain is configured but no mail transport is installed',
  }
}
```

Create `src/features/notifications/digest-step.ts`:

```ts
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { assembleDigest, type DigestEvent } from './digest'
import { sendDigest } from './digest-transport'
import type { NotificationParams } from './text'

export type DigestStepResult = { queued: number; sent: number; failed: number }

/**
 * PRECONDITION 3: digest_state transitions in the SAME batch as the send, so a
 * cron retry cannot double-send. A retry that finds rows already marked sends
 * nothing — which is what makes this step idempotent by construction rather
 * than by hoping the cron fires once.
 *
 * neon-http has no transaction(), so "same transaction" is one db.batch, the
 * house substitute (see features/people/actions.ts).
 *
 * Assembled from the EVENTS rather than from the bell rows, which is what lets
 * a day capped at five bell rows still email in full.
 */
export async function runDigestStep(now: Date): Promise<DigestStepResult> {
  // `now` is threaded in rather than read from the clock so the whole tick
  // shares one instant: every step in a single run must agree on which
  // Colombo day it is, or a tick straddling midnight prunes against one date
  // and digests against another.
  const startedAt = now
  const queued: { id: string; userId: string; titleKey: string | null; params: NotificationParams | null; createdAt: Date }[] =
    await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        titleKey: notifications.titleKey,
        params: notifications.params,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.digestState, 'queued'))

  if (queued.length === 0) return { queued: 0, sent: 0, failed: 0 }

  const events: DigestEvent[] = queued
    .filter((row): row is typeof row & { titleKey: string } => row.titleKey !== null)
    .map((row) => ({
      userId: row.userId,
      titleKey: row.titleKey,
      params: row.params ?? {},
      occurredAt: row.createdAt,
    }))

  // Meetings are added by the read that spec E's calendar work owns; today the
  // digest is assembled from queued notification rows alone, which is why the
  // second argument is empty rather than absent — assembleDigest's contract
  // does not change when meetings arrive.
  const digests = assembleDigest(events, [])

  let sent = 0
  let failed = 0
  for (const digest of digests) {
    const ids = queued.filter((row) => row.userId === digest.userId).map((row) => row.id)
    let ok = false
    try {
      ok = (await sendDigest(digest)).ok
    } catch (error) {
      console.error(`[digest] transport threw for ${digest.userId}:`, error)
      ok = false
    }
    // The state transition rides in the same batch as the decision that
    // produced it: whichever way it went, these rows leave 'queued' exactly
    // once, so a retry finds nothing to re-send.
    await db.batch([
      db
        .update(notifications)
        .set({ digestState: ok ? 'sent' : 'failed' })
        .where(and(inArray(notifications.id, ids), eq(notifications.digestState, 'queued'))),
    ])
    if (ok) sent += ids.length
    else failed += ids.length
  }

  console.info(
    `[digest] tick ${startedAt.toISOString()}: ${queued.length} queued, ${sent} sent, ${failed} failed`,
  )
  return { queued: queued.length, sent, failed }
}
```

Create `src/features/notifications/digest-queries.ts`:

```ts
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { notifications, users } from '@/db/schema'
import type { NotificationParams } from './text'

export type DigestFailure = {
  id: string
  recipientName: string | null
  recipientEmail: string | null
  titleKey: string | null
  params: NotificationParams | null
  createdAt: Date
}

/**
 * PRECONDITION 2: an admin-visible delivery-failure surface.
 *
 * A silent bounce for a month is worse than no email at all — that is the
 * failure mode that makes a channel untrustworthy without anyone noticing.
 * These rows are the ones whose digest_state ended at 'failed'.
 */
export async function listDigestFailures(limit = 50): Promise<DigestFailure[]> {
  return db
    .select({
      id: notifications.id,
      recipientName: users.name,
      recipientEmail: users.email,
      titleKey: notifications.titleKey,
      params: notifications.params,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.userId))
    .where(eq(notifications.digestState, 'failed'))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}
```

Create `src/app/(app)/admin/notifications/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { requireCapability } from '@/features/auth/actor'
import { listDigestFailures } from '@/features/notifications/digest-queries'
import { digestSenderConfigured } from '@/features/notifications/digest-transport'

/**
 * Delivery failures, so a bounce is a surface rather than a log line.
 *
 * A section this seat cannot see 404s rather than refusing — a stakeholder
 * probing /admin must not learn it exists. `forbidden()` is not used: it is
 * experimental in Next 16.3 and needs experimental.authInterrupts.
 */
export default async function AdminNotificationsPage() {
  const actor = await requireCapability('admin.view')
  if (!actor) notFound()

  const failures = await listDigestFailures()
  const configured = digestSenderConfigured()

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">Notification delivery</h1>
        <p className="text-sm text-muted-foreground">
          Digest email is {configured ? 'configured' : 'off — no verified sending domain'}. Every
          failure below is a person who was not told something LogPup thought they should know.
        </p>
      </header>

      {failures.length === 0 ? (
        <p className="rounded-md border border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No delivery failures.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Recipient</th>
                <th className="py-2 pr-4 font-medium">Notification</th>
                <th className="py-2 font-medium">Queued</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((failure) => (
                <tr key={failure.id} className="border-b border-border/60">
                  <td className="py-2 pr-4">
                    <span className="block">{failure.recipientName ?? 'Unknown'}</span>
                    <span className="block text-xs text-muted-foreground">
                      {failure.recipientEmail ?? '—'}
                    </span>
                  </td>
                  {/* The key, not a rendered sentence: this surface is for
                      diagnosis, and the key is what a reader greps for. */}
                  <td className="py-2 pr-4 font-mono text-xs">{failure.titleKey ?? 'legacy'}</td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {failure.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

In `src/features/admin/sections.ts`, add one entry immediately after the `/admin/audit` entry:

```ts
  {
    href: '/admin/notifications',
    label: 'Notification delivery',
    description: 'Digest failures, and whether email is configured at all',
    capability: 'admin.view',
  },
```

In `src/features/notifications/tick.ts`, add the digest as the second ordered step. Add the import `import { runDigestStep } from './digest-step'` and, after the prune block and before the `return`:

```ts
  try {
    const digest = await runDigestStep(now)
    steps.digest = { ok: true, queued: digest.queued, sent: digest.sent, failed: digest.failed }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[notify-tick] digest failed:', error)
    steps.digest = { ok: false, error: message }
  }
```

and update `tick.test.ts`'s order assertion to `expect(Object.keys(result.steps)).toEqual(['prune', 'digest'])`, adding `vi.mock('./digest-step', () => ({ runDigestStep: vi.fn().mockResolvedValue({ queued: 0, sent: 0, failed: 0 }) }))` at the top of that file alongside the existing retention mock.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/notifications/digest-step.test.ts src/features/notifications/tick.test.ts && npx tsc --noEmit && npm test && npm run lint && npm run build`
Expected: `digest-step.test.ts` PASS, 5 tests; `tick.test.ts` PASS, 3 tests. `tsc` clean. Full suite PASS. Lint clean. Build succeeds and lists `/admin/notifications`.

- [ ] **Step 5: Commit**

```bash
git add src/features/notifications/digest-transport.ts src/features/notifications/digest-step.ts src/features/notifications/digest-step.test.ts src/features/notifications/digest-queries.ts src/features/notifications/tick.ts src/features/notifications/tick.test.ts src/app/\(app\)/admin/notifications/page.tsx src/features/admin/sections.ts
git commit -m "feat(notifications): add the digest step behind a refusing transport, with an admin failure surface"
```

---

### Task 24: Migration — `apps.internal`

LogPup's own defects (spec C) must not corrupt client-facing portfolio metrics. One boolean, defaulted false, with no reader in this plan — it exists so that spec C's bug work has a column to exclude on rather than inventing one under schedule pressure.

**STOP CONDITIONS:** no migration runner, no `db:generate`, no hardcoded number, no editing an applied `.sql`.

**Files:**
- Modify: `src/db/schema.ts` — the `apps` table
- Create: `drizzle/<allocated>_app_internal.sql`
- Modify: `drizzle/meta/_journal.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `apps.internal` (SQL `internal`, `boolean NOT NULL DEFAULT false`). Spec C reads it.

- [ ] **Step 1: Add the column to the schema**

In `src/db/schema.ts`, inside the `apps` table definition, immediately after the `pmId` column, add:

```ts
  /**
   * LogPup's own projects, and anything else the studio builds for itself.
   *
   * Exists so that the studio's own defects cannot corrupt client-facing
   * portfolio metrics: a bug count, a hit-rate or a resolution time that mixes
   * internal tooling with client work answers no question either audience
   * asked. Defaulted false, so every existing app keeps its current meaning.
   *
   * NO READER IN THIS WORK, deliberately. The column ships with the substrate
   * so the deadlines-and-bugs spec has one to exclude on, rather than inventing
   * one under schedule pressure the week it needs it.
   */
  internal: boolean('internal').notNull().default(false),
```

- [ ] **Step 2: Allocate the migration number and write the SQL**

Run, from the repo root:

```bash
NEXT=$(printf '%04d' $(( 10#$(ls drizzle/*.sql | sed 's#.*/##' | cut -c1-4 | sort -n | tail -1) + 1 )))
echo "allocated: $NEXT"
cat > "drizzle/${NEXT}_app_internal.sql" <<'SQL'
-- apps.internal — LogPup's own projects, marked as such.
--
-- Exists so the studio's own defects cannot corrupt client-facing portfolio
-- metrics: a bug count or a resolution time that mixes internal tooling with
-- client work answers no question either audience asked.
--
-- Defaulted false, so every existing app keeps exactly the meaning it has
-- today, and NO READER ships with it. The column lands with the substrate so
-- the bug-tracking work has one to exclude on rather than inventing one under
-- schedule pressure the week it needs it.
--
-- Replay-safe: ADD COLUMN IF NOT EXISTS.
ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "internal" boolean DEFAULT false NOT NULL;
SQL
node -e '
const fs = require("node:fs")
const p = "drizzle/meta/_journal.json"
const tag = process.argv[1]
const j = JSON.parse(fs.readFileSync(p, "utf8"))
if (j.entries.some((e) => e.tag === tag)) { console.log("journal already has", tag); process.exit(0) }
const idx = Number(tag.slice(0, 4))
const when = Math.max(...j.entries.map((e) => e.when)) + 100000
j.entries.push({ idx, version: "7", when, tag, breakpoints: true })
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n")
console.log("journal appended:", tag, "idx", idx, "when", when)
' "${NEXT}_app_internal"
```

- [ ] **Step 3: Verify without running it**

Run:

```bash
git status --short drizzle/ src/db/schema.ts
node -e 'JSON.parse(require("node:fs").readFileSync("drizzle/meta/_journal.json","utf8")); console.log("journal parses")'
npx tsc --noEmit
npm test
```

Expected: exactly the new `.sql`, the journal, and `schema.ts`. `journal parses`. `tsc` clean. Full suite PASS.

- [ ] **Step 4: STOP — request human approval before any database touches this**

Print this and wait:

> Migration `<allocated>_app_internal.sql` is written and the journal entry appended. **I have not run it.** Verification after it runs:
>
> ```sql
> SELECT column_name, data_type, is_nullable, column_default
> FROM information_schema.columns
> WHERE table_name = 'apps' AND column_name = 'internal';
> ```
>
> Expected: one row, `boolean`, `NO`, default `false`.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/meta/_journal.json drizzle/*_app_internal.sql
git commit -m "feat(db): add apps.internal so studio work stays out of client metrics"
```

---

### Task 25: Final verification

No claim of completeness is made before this task runs and its output is pasted. Evidence before assertions, always.

**Files:**
- Modify: none.

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Types**

Run: `npx tsc --noEmit`
Paste the **actual** output. Expected: no output at all (a clean run prints nothing and exits 0). Any diagnostic is a failure — fix it before continuing, do not summarise it away.

- [ ] **Step 2: Tests**

Run: `npm test`
Paste the **actual** final summary lines — the `Test Files  N passed (N)` and `Tests  N passed (N)` lines verbatim. Expected: zero failures, and specifically these files present and passing:

```
src/features/search/registry/scope.test.ts
src/features/search/actions.test.ts
src/features/apps/search-providers.test.ts
src/features/people/search-providers.test.ts
src/features/sprints/search-providers.test.ts
src/features/meetings/search-providers.test.ts
src/features/sprints/task-status.test.ts
src/features/sprints/task-actions.test.ts
src/features/admin/change-request-appliers.test.ts
src/features/notifications/text.test.ts
src/features/notifications/budget.test.ts
src/features/notifications/dedupe.test.ts
src/features/notifications/recipients.test.ts
src/features/notifications/notify.test.ts
src/features/notifications/call-sites.test.ts
src/features/notifications/queries.test.ts
src/features/notifications/retention.test.ts
src/features/notifications/tick.test.ts
src/features/notifications/digest.test.ts
src/features/notifications/digest-step.test.ts
src/lib/cron-auth.test.ts
src/db/live.test.ts
src/features/search/registry/registry.test.ts
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Paste the **actual** output. Expected: no errors and no warnings.

- [ ] **Step 4: Build**

Run: `npm run build`
Paste the **actual** route table from the output. Expected: a successful build whose route list includes `/api/cron/notify-tick` and `/admin/notifications`.

- [ ] **Step 5: Assert the invariants this plan promised, by command**

Run and paste each:

```bash
# Every provider consumes the context. Expected: four files listed.
grep -ln 'ctx\.actor' src/features/*/search-providers.ts

# Exactly two cron jobs, the Hobby ceiling. Expected: 2
node -e 'console.log(JSON.parse(require("node:fs").readFileSync("vercel.json","utf8")).crons.length)'

# SOFT_TABLES is still six. Expected: the six names, and no "notifications".
grep -n "'apps', 'meeting_note_segments'" src/db/live.test.ts

# No migration number was hardcoded into this plan's work: every new .sql
# has a journal entry and the whens strictly increase. Expected: true
node -e 'const j=JSON.parse(require("node:fs").readFileSync("drizzle/meta/_journal.json","utf8"));const w=j.entries.map(e=>e.when);console.log(w.every((n,i)=>i===0||n>w[i-1]))'

# Every .sql on disk has a journal entry and vice versa. Expected: [] and []
node -e '
const fs=require("node:fs");
const j=JSON.parse(fs.readFileSync("drizzle/meta/_journal.json","utf8"));
const tags=new Set(j.entries.map(e=>e.tag));
const files=fs.readdirSync("drizzle").filter(f=>f.endsWith(".sql")).map(f=>f.replace(/\.sql$/,""));
console.log(files.filter(f=>!tags.has(f)), [...tags].filter(t=>!files.includes(t)));
'

# The dependency budget was not spent. Expected: no diff.
git diff --stat origin/main -- package.json package-lock.json
```

- [ ] **Step 6: Run the verification skill**

Use **superpowers:verification-before-completion**. Do not claim any part of this plan is complete until it has run and its checks are satisfied against the pasted output above — not against a memory of having run them.

- [ ] **Step 7: Request code review**

Use **superpowers:requesting-code-review**. Point the reviewer at these five specifically, because they are the ones a green test run does not prove:

1. **The palette scope filter.** Four provider files, four different query shapes. A `scope.kind === 'apps'` arm that was never added to one of them passes every test in that file's neighbours.
2. **`createNotifications`'s best-effort contract.** The function must not throw for any input. Six call sites depend on it and none of them handles a throw.
3. **The per-recipient cap's honesty.** `applyDailyCap`'s overflow count must equal the number of events actually suppressed. A dropped event is the failure this exists to prevent.
4. **The migration numbers.** Every `.sql` this work adds must have been numbered against then-current `main` at merge, with a matching journal entry and a strictly increasing `when`. Re-run the two node checks in Step 5 after any rebase.
5. **`SOFT_TABLES` and `DELETE_ALLOWED_FUNCTIONS`.** `notifications` must be in neither the soft-delete contract nor anywhere except the one `pruneNotifications` exemption.

---

## Self-review

Run against the spec after the plan was written, per the writing-plans skill.

**Spec coverage.** Every requirement maps to a task:

| Spec requirement | Task |
|---|---|
| ⌘K providers consume `ctx`; scope hangs off the registry's seam | 1-5 |
| A surface a seat cannot see 404s rather than refusing | Global Constraints; Task 23's page |
| Exactly one cron job, everything periodic a step inside it | 21 (route comment), 23 (second step) |
| Notification text is a key + parameter bag, never a frozen string | 11, 18, 19 |
| `params` carries ids, not names; `actorLabel` snapshot fallback only | 11, 18 |
| `title`/`body` stay as nullable fallback, never written again | 15, 18, 19 |
| Digest: verified domain, admin failure surface, `digest_state` in the same transaction | 23 |
| `digestEligible(meeting)` as one function, evaluated at send time | 22 |
| Recipient filtering moves inside `createNotifications` (five rules) | 14, 17 |
| Per-recipient daily cap of 5, overflow collapses and never drops | 12, 17 |
| Dedupe: two partial unique indexes, two semantics, collapse on the entity | 13, 16, 17 |
| Zero new notification kinds (`system.overflow` exempt, stated) | 11, 12 |
| The budget table lives in the substrate and is enforced by a test | 12 |
| `dismissed_at`, not `deletedAt`; `SOFT_TABLES` stays six | 15, 20 |
| `tasks.completed_at`, set on entering done, cleared on reopen | 6, 7, 8 |
| The fourth writer: the change-request applier | 9 |
| `notifications` columns + `type`-to-`text` | 15 |
| Five notification indexes + the tasks index | 10, 16 |
| The two indexes spec C owns are excluded, with the reason | Decision 8 |
| `apps.internal` | 24 |
| Hand-written SQL + hand-written journal; numbers allocated at merge | Global Constraints; 7, 10, 15, 16, 24 |
| Tests: dedupe semantics, recipient filtering, digest eligibility, the cap | 13, 14, 22, 12 |
| Tests: per-provider scope, `transitionTaskStatus` through three paths, the change request | 3-5, 8, 9 |
| Build order 1-6 | The BUILD ORDER section; task numbering follows it |
| Out of scope (new kinds, per-event email, push/Slack, SSE, preference matrix, backfill, dropping `title`) | None — each is named as excluded in the task or constraint that would otherwise pull it in |

**Placeholder scan.** No "TBD", no "similar to Task N", no "add appropriate error handling", no step that describes code without showing it. Every migration filename is produced by a runnable allocation command rather than a hardcoded number, which is the one place a literal would have been wrong. The two spec indexes that cannot execute are named, with the columns they need and the spec that owns them, rather than deferred vaguely.

**Type consistency, checked name by name.** `SearchScope`/`searchScopeFor`/`SEARCH_ACTIONS` (Task 1) are used with those exact names in Tasks 3-5. `SearchContext.actor` (Task 2) is what Tasks 3-5 read. `transitionTaskStatus(to, now)` returning `{ status, completedAt }` (Task 6) is called with that arity in Tasks 8 and 9; `isTaskStatus` (Task 6) is used in Task 9. `tasks.completedAt` (Task 7) is the property Tasks 8 and 9 write. `NOTIFICATION_KINDS`/`isNotificationKind` (Task 11) are used in Tasks 12 and 17; `OVERFLOW_TITLE_KEY`, `NotificationParams`, `ResolvedNames`, `renderNotification` (Task 11) are used in Tasks 15, 17, 19, 22 and 23. `applyDailyCap(drafts, alreadyToday)` returning `{ emit, overflow: [{ userId, suppressed }] }` (Task 12) is destructured exactly that way in Task 17. `overflowKey`, `entityCollapseKey`, `dedupeOutcome` (Task 13) are used in Tasks 17 and 18. `selectRecipients(candidates, { actorId, target })` and `ReachTarget`/`RecipientCandidate` (Task 14) are constructed with those field names in Task 17. `notifications.dedupePermanent`/`dedupeKey`/`collapseCount`/`dismissedAt`/`digestState`/`titleKey`/`params`/`entityType`/`entityId`/`kind` (Task 15) are the columns Tasks 16, 17, 19, 20 and 23 name. `pruneNotifications(now)` (Task 20) is called with that arity in Task 21. `runNotifyTick(now)`/`TickResult.steps` (Task 21) are what Task 23 extends and the route returns. `digestEligible`/`assembleDigest`/`DigestEvent`/`Digest` (Task 22) are used with those names in Task 23. `listDigestFailures`/`digestSenderConfigured` (Task 23) are what its page imports.

**Corrections made inline during review:**

- The stub this plan replaced said `SOFT_TABLES` had five members; `src/db/live.test.ts:29-32` asserts **six** (`apps` joined the set in `0043`). Corrected everywhere it is stated.
- The stub named `0042_org_holiday_revoke` as the highest migration on disk; it is `0044_ai_pref_model`, journal `idx: 44`, `when: 1787156000000`. No number is hardcoded anywhere in the plan as a result — every migration task computes its own.
- The stub carried a `meeting_followups (user_id, status)` index as a "pre-C replacement". The spec's consistency pass removed it: `meeting_followups` stays unindexed until spec C ships, which the spec calls "a real cost accepted knowingly". Dropped from this plan; Decision 8 states it.
- The spec's migration step 2 ("the four indexes … every column they name exists today") cannot execute as written, because the bell-poll index's predicate names `dismissed_at`, which arrives in step 3. Split into Tasks 10 and 16, with the reason recorded as Decision 11 and in both migrations' own comments. The dedupe uniques stay a separate file, as the spec requires.
