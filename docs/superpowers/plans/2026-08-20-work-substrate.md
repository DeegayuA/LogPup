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
