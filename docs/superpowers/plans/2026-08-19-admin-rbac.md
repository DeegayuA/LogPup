# Admin RBAC, Change Requests and Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-value role string with a tested capability matrix, add an approval-gated change-request path for the edits and deletes that matrix refuses, and make a missing worklog day a computed status with a visible denominator instead of an absent row.

**Architecture:** One pure `(role, action) -> grant level` table plus one async resolver that turns a grant level into a yes/no against a concrete resource; every server action and admin route asks that resolver and nothing compares role strings. Work the matrix refuses becomes a `change_requests` row that a reviewer applies transactionally. Coverage becomes a pure function over schedules, absences, holidays and worklog rows, hung off the `isHoliday` seam `working-days.ts` already exposes.

**Tech Stack:** Next.js 16.3 App Router (server components, server actions), React 19, Drizzle ORM 0.45 on Postgres, vitest, Tailwind v4 tokens.

**Spec:** [docs/superpowers/specs/2026-08-19-admin-rbac-design.md](../specs/2026-08-19-admin-rbac-design.md)

## Global Constraints

- **Read a file before editing it.** Parallel sessions edit this tree constantly. Stage explicit paths — never `git add -A`, `commit -a`, `reset --hard`, `checkout -- .`, or `git stash`.
- **Never run `drizzle-kit generate`** (`npm run db:generate`). The snapshot chain is broken; generate would re-create existing tables without `IF NOT EXISTS`. Hand-write the `.sql` plus the `drizzle/meta/_journal.json` entry, modelled on `0031`.
- **Never edit an applied `.sql` file**, not even a comment — `db:status` compares sha256 to the ledger and an edited file reads "never applied" forever.
- **`--> statement-breakpoint` goes between statements, never inside a comment.** The splitter is a plain string split.
- **No migration runs against any database without explicit human approval.** Verify applied state with `information_schema`, never the runner's exit code.
- **Soft-delete only** for user content. The five new tables carry no `deletedAt` and `SOFT_TABLES` stays at five members — closure is by status (`change_requests`, `absences`), by `effectiveTo` (`work_schedules`), or by access revocation (`org_holidays`, `app_grants`, which delete plus write `activity_log`, exactly as `webauthn_credentials` is exempted today).
- **Worklog writes stay self-only.** There is no `worklog.write.any` action for any role, `superadmin` included. Correction power ships as a request routed to the row's owner.
- **Server-side enforcement only.** Client-side hiding is presentation. A section the actor lacks does not render, and its action still refuses on the server.
- **Do not use `forbidden()` / `unauthorized()`** from `next/navigation`. Both are experimental in Next 16.3 and require `experimental.authInterrupts` in `next.config.ts`, which is out of scope. Routes deny with `notFound()`; server actions return the existing `ActionResult` refusal shape.
- **No new dependencies.** No new palette, no raw hex — existing tokens only (`--success`, `--warning`, `--destructive`, `--muted-foreground`, `--holiday`, `--weekend`, `--text-2xs`). Identity colours come from `event-color.ts`.
- **Colour is never the only signal.** Every coverage state paints a word beside its colour (WCAG 1.4.1).
- **Every coverage figure shows numerator and denominator** — "18/20 expected days logged · 4 exempt", never a bare percentage.
- **All day math is Asia/Colombo** via `lk-holidays.ts` helpers and `working-days.ts`. Never a private weekday check, never UTC slicing.
- **Bilingual copy** (Sinhala + English) where the surrounding surface is bilingual; never force-translate.
- **This repo has zero component tests** (`vitest.config.ts` includes only `src/**/*.test.ts`). Do not introduce React Testing Library. TDD applies to the pure modules; UI is verified by `tsc`, lint, tests, build, and manual passes.
- **Commands:** test `npm run test`, lint `npm run lint`, build `npm run build`, types `npx tsc --noEmit`, migration status `npm run db:status`.
- **Do not touch:** `.env*`, `package.json`, lockfile, CI config, `src/features/meetings/**`, `src/features/transcription/**`, `src/features/speech/**`, `src/lib/auth.ts` sign-in behaviour, `node_modules/**`.
- **No git worktrees.** All work happens on `main` in the main worktree, concurrently with other agents and with Deeghayu's own session. Claim files before editing, re-read a file immediately before editing it, and stage only the explicit paths a task names. If a file you are about to edit is dirty from someone else's work, stop and report rather than overwriting.

## Decisions this plan is built on

Nine questions were settled before writing. Each one changes the code, so each is
stated here rather than buried in a task.

| # | Decision | Consequence |
|---|---|---|
| 1 | Existing `admin` → **`superadmin`** | Capability-preserving. Mapping to `admin` would strip DB-clear from every current admin. |
| 2 | Meetings authorization **is** in scope; meetings behaviour is not | 16 edits, not 55 — see decision 3. |
| 3 | The four meetings gates **keep their exported names and signatures**; only their bodies change | The 39 call sites do not move, and `src/features/transcription/actions.ts:33` stays out of the diff. |
| 4 | Seven creator-or-admin inline checks get their own **`meeting.admin`** action with no scope branch | Reach after the refactor is byte-for-byte what it is today. No PM silently gains power. |
| 5 | **No hard delete converts to soft delete** | `live.test.ts` documents why all three stay hard, and `assignments` already has a tombstone-based Trash kind. `SOFT_TABLES` stays 5. Delete semantics are a separate argument. |
| 6 | `manager` scope = **as-of `pm`/`lead` in `app_role_history`**, not `managesApp()` | `managesApp()` regex-matches free-text `assignments.role` and returns false for a lead. Scope must be auditable. |
| 7 | Absences are **retroactive without limit** | Approving leave for a past date flips those days to `exempt` immediately. Coverage is truth-as-known, never a frozen snapshot. |
| 8 | **Nobody reviews their own request except `superadmin`** | Prevents a sole-superadmin deadlock while keeping separation of duties. Self-approvals write `metadata.selfApproved = true`. |
| 9 | Coverage denominators are **fractional** | Saturday is 0.5 on both sides of the ratio. A full studio week is 5.5 expected days. |

## Toolchain facts this plan relies on, each verified

- `src/db/index.ts` is `drizzle-orm/neon-http`. **`db.transaction()` does not exist.**
  The house idiom is `db.batch([...])` — see `src/features/people/actions.ts:337-354`.
  Every "transactional" requirement below is implemented as one `db.batch`.
- `logActivity()` (`src/features/activity/log.ts:16`) **swallows its own errors** and
  issues its own insert. It can never be part of a batch. Where an audit row must
  succeed or fail with the write, the plan inlines `db.insert(activityLog)` into
  the batch instead of calling `logActivity`.
- `ACTIVITY_ENTITY_TYPES` (`src/features/activity/types.ts:5-20`) is a **closed**
  union with no `(string & {})` escape hatch. New entity types must be added there
  or every `logActivity` call in this feature is a type error. The column is
  `text`, so this is a code change with no migration.
- `readMigrationFiles` (`node_modules/drizzle-orm/migrator.js:6-10`) reads
  `meta/_journal.json` and the `.sql` files and **never reads a snapshot**. The
  missing snapshots (0027, 0028, 0031-0034) break `generate`, which is why it is
  forbidden, and do not affect `migrate`. Hand-written SQL plus a journal entry
  applies correctly.
- `ALTER TYPE … ADD VALUE` cannot go inside a `DO $$ … $$` block, so migration
  `0035` cannot use the repo's usual replay guard. It uses
  `ADD VALUE IF NOT EXISTS` instead, which is replay-safe on its own.
- `workingDayFraction(iso, isHoliday)` (`src/lib/working-days.ts:41`) already
  returns 1 / 0.5 / 0 and already folds holidays to 0. Coverage generalizes it and
  duplicates nothing.
- `revalidatePath(path, 'layout')` is the documented way to invalidate a segment's
  children (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md:160-165`).
  `revalidateAdmin()` (`src/lib/revalidate-admin.ts:19`) currently calls
  `revalidatePath('/admin')`, which will NOT invalidate the new child sections.
- `src/components/ui/` has **no** `skeleton`, `separator`, `tooltip`, `checkbox`,
  `radio-group`, or `sheet`. Any task needing one adds it as a local component in
  the same task, built from existing tokens — not a new dependency.
- `vitest.config.ts` globs `src/**/*.test.ts` only. No `.tsx` tests exist and none
  are added.

## File structure

**Permission core** — pure and sync, so it can be imported by client components.

| File | Responsibility |
|---|---|
| `src/features/auth/capabilities.ts` | `Action` union, `GrantLevel`, the `ROLE_GRANTS` table, and the sync `can()`. Zero imports from `@/db`. |
| `src/features/auth/capabilities.test.ts` | Every (role × action) cell, plus the negative assertions. |
| `src/features/auth/actor.ts` | `Actor` type, `loadActor()` (one scope query), `requireCapability()` guard for server actions. The only async part. |
| `src/features/auth/actor.test.ts` | Scope resolution against fixture rows. |

**Change requests** — flat files under the admin slice, matching `trash-*.ts`.

| File | Responsibility |
|---|---|
| `src/features/admin/change-request-appliers.ts` | The closed applier registry: one function per `entityType` that turns a payload into batch statements and checks the pre-image. Pure except for statement construction. |
| `src/features/admin/change-request-appliers.test.ts` | Pre-image conflict detection per entity type. |
| `src/features/admin/change-request-actions.ts` | `createChangeRequest`, `approveChangeRequest`, `rejectChangeRequest`, `withdrawChangeRequest`. |
| `src/features/admin/change-request-queries.ts` | Inbox, my-requests, per-entity trail. |
| `src/features/admin/change-request-routing.ts` | Pure: who may review this request. Includes the self-approval rule. |
| `src/features/admin/change-request-routing.test.ts` | The self-approval matrix. |

**Non-daily logging** — under the worklog slice, because coverage is worklog domain.

| File | Responsibility |
|---|---|
| `src/features/worklog/coverage.ts` | `computeCoverage`, `formatCoverage`. Pure, sync, no db. |
| `src/features/worklog/coverage.test.ts` | The fixture below, status by status. |
| `src/features/worklog/schedules.ts` | `SchedulePattern`, `STUDIO_DEFAULT_PATTERN`, `patternForDay()` over effective-dated rows. Pure. |
| `src/features/worklog/schedules.test.ts` | As-of selection and the one-open-row invariant. |
| `src/features/worklog/absence-actions.ts` | Create, approve, reject, withdraw. |
| `src/features/worklog/absence-queries.ts` | Approved-day set for a window; pending list for the inbox. |
| `src/features/worklog/schedule-actions.ts` | Set a schedule (closes the open row, opens a new one). |
| `src/features/worklog/org-holiday-actions.ts` | Add and revoke company holidays. |
| `src/features/worklog/coverage-queries.ts` | Assembles `CoverageInput` from the db and calls the pure core. |

**Admin area** — one route segment per section.

| File | Responsibility |
|---|---|
| `src/app/(app)/admin/layout.tsx` | Capability-guarded shell and section nav. |
| `src/app/(app)/admin/page.tsx` | Overview. Rewritten from the current flat page. |
| `src/app/(app)/admin/{people,approvals,apps,absences,audit,trash,danger}/page.tsx` | One section each. |
| `src/features/admin/components/admin-nav.tsx` | Nav, rendered from the actor's capabilities. |
| `src/features/admin/components/approvals-inbox.tsx` | Unified signups + change requests + absences. |
| `src/features/admin/components/coverage-figure.tsx` | The one component allowed to render a coverage number. |

**Modified**

| File | Change |
|---|---|
| `src/db/schema.ts` | Widen `userRole`; add 4 enums and 5 tables. |
| `src/features/activity/types.ts` | 5 new `ACTIVITY_ENTITY_TYPES` members. |
| `src/lib/revalidate-admin.ts` | `revalidatePath('/admin', 'layout')`. |
| `src/db/live.test.ts` | Two new `DELETE_ALLOWED_FUNCTIONS` entries for the grant/holiday revocations. |
| 7 files with `requireAdmin()` | Import the shared guard instead. |
| 4 meetings gate bodies + 12 inline checks | Ask the matrix. Signatures unchanged. |
| `src/features/sprints/permissions.ts` | `canMoveTask` delegates to the matrix, signature unchanged. |
| `src/features/admin/permissions.ts` | `wouldLeaveNoAdmins` → `wouldLeaveNoSuperadmins`. |

---

### Task 1: The capability matrix

The whole feature rests on this file. It is pure and synchronous — no `@/db`
import, no `await` — for three reasons: `canMoveTask` is called from a **client**
component (`src/features/sprints/components/board-column.tsx:6,117`), it is called
per row inside a map (`src/features/sprints/task-actions.ts:596`, which would
become N round trips if it went async), and a table-driven test over 308 cells is
only affordable when each cell is a pure lookup.

`GrantLevel` is per-action reach, **not** role rank. The levels nest
(`own ⊂ scoped ⊂ all`) so the resolver is four cases, but that nesting describes
reach over one action. `manager` holding `scoped` where `editor` holds `none`
says nothing about their relative rank anywhere else, and no code may ask.

**Files:**
- Create: `src/features/auth/capabilities.ts`
- Test: `src/features/auth/capabilities.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type UserRole`, `const USER_ROLES`, `type Action`, `type GrantLevel`,
  `type Actor`, `type Resource`, `const ROLE_GRANTS`, `function can(actor, action, resource?)`.

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/capabilities.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { userRole } from '@/db/schema'
import {
  ROLE_GRANTS,
  USER_ROLES,
  can,
  type Action,
  type Actor,
  type UserRole,
} from '@/features/auth/capabilities'

const actor = (role: UserRole, over: string[] = []): Actor => ({
  id: 'actor-1',
  role,
  scopeAppIds: new Set(over),
})

describe('USER_ROLES', () => {
  // capabilities.ts must stay client-importable, so it declares the role union
  // itself rather than importing the pg enum. This test is the only thing
  // stopping the two from drifting apart.
  it('matches the user_role pg enum exactly', () => {
    expect([...USER_ROLES].sort()).toEqual([...userRole.enumValues].sort())
  })
})

describe('ROLE_GRANTS', () => {
  it('gives every role a grant for every action', () => {
    const actions = Object.keys(ROLE_GRANTS) as Action[]
    for (const action of actions) {
      for (const role of USER_ROLES) {
        expect(ROLE_GRANTS[action][role], `${role} × ${action}`).toBeDefined()
      }
    }
  })

  it('has no worklog.write.any action, for anybody', () => {
    // A worklog is a first-person record. A manager writing that number turns a
    // self-report into a managed metric, at which point it measures nothing.
    expect(Object.keys(ROLE_GRANTS)).not.toContain('worklog.write.any')
  })

  it('gives auditor no write capability at all', () => {
    const writes = (Object.keys(ROLE_GRANTS) as Action[]).filter((a) =>
      /\.(create|edit|delete|grant|approve|assign|restore|purge|manage|deactivate|write|dbclear|remove)/.test(a),
    )
    expect(writes.length).toBeGreaterThan(10)
    for (const action of writes) {
      expect(ROLE_GRANTS[action].auditor, `auditor × ${action}`).toBe('none')
    }
  })

  it('denies stakeholder the people directory and every worklog', () => {
    expect(ROLE_GRANTS['user.view.directory'].stakeholder).toBe('none')
    expect(ROLE_GRANTS['worklog.view'].stakeholder).toBe('none')
    expect(ROLE_GRANTS['coverage.view'].stakeholder).toBe('none')
  })

  it('separates admin from superadmin on exactly three powers', () => {
    for (const action of ['danger.dbclear', 'trash.purge', 'user.role.grant.superadmin'] as const) {
      expect(ROLE_GRANTS[action].superadmin).toBe('all')
      expect(ROLE_GRANTS[action].admin).toBe('none')
    }
  })

  it('refuses an editor every delete', () => {
    for (const action of ['task.delete', 'meeting.delete', 'trash.restore'] as const) {
      expect(ROLE_GRANTS[action].editor).toBe('none')
    }
  })

  it('keeps manager out of workspace-widening acts', () => {
    expect(ROLE_GRANTS['user.create'].manager).toBe('none')
    expect(ROLE_GRANTS['user.approve'].manager).toBe('none')
    expect(ROLE_GRANTS['user.role.grant'].manager).toBe('none')
  })

  it('lets only superadmin review their own request', () => {
    expect(ROLE_GRANTS['request.review.self'].superadmin).toBe('own')
    for (const role of USER_ROLES.filter((r) => r !== 'superadmin')) {
      expect(ROLE_GRANTS['request.review.self'][role], role).toBe('none')
    }
  })

  it('gives meeting.admin no scope branch, preserving today reach', () => {
    // rsvp/share/followup checks are creator-or-admin today with no managesApp
    // arm. 'scoped' anywhere in this row would silently hand every PM three
    // powers they do not currently hold.
    const row = ROLE_GRANTS['meeting.admin']
    expect(Object.values(row)).not.toContain('scoped')
  })
})

describe('can', () => {
  it('resolves all without needing a resource', () => {
    expect(can(actor('admin'), 'user.create')).toBe(true)
  })

  it('resolves none whatever the resource', () => {
    expect(can(actor('member'), 'user.create', { ownerId: 'actor-1', appId: 'app-1' })).toBe(false)
  })

  it('resolves own against ownerId', () => {
    expect(can(actor('member'), 'worklog.write.own', { ownerId: 'actor-1' })).toBe(true)
    expect(can(actor('member'), 'worklog.write.own', { ownerId: 'someone-else' })).toBe(false)
  })

  it('resolves scoped against the actor scope set', () => {
    const manager = actor('manager', ['app-1'])
    expect(can(manager, 'app.edit', { appId: 'app-1' })).toBe(true)
    expect(can(manager, 'app.edit', { appId: 'app-2' })).toBe(false)
  })

  it('lets scoped fall back to ownership', () => {
    // own ⊂ scoped: your own row is always inside your scope, even when the row
    // carries no appId at all.
    expect(can(actor('manager', []), 'task.edit', { ownerId: 'actor-1', appId: null })).toBe(true)
  })

  it('fails closed when own or scoped is asked without a resource', () => {
    expect(can(actor('member'), 'worklog.write.own')).toBe(false)
    expect(can(actor('manager', ['app-1']), 'app.edit')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run src/features/auth/capabilities.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/auth/capabilities"`.

- [ ] **Step 3: Write the matrix**

Create `src/features/auth/capabilities.ts`:

```ts
/**
 * The one place that answers "may this person do this?".
 *
 * PURE AND SYNCHRONOUS ON PURPOSE. This module is imported by client
 * components (board-column.tsx) and called per row inside maps
 * (task-actions.ts:596). An async `can()` would mean either a database round
 * trip per row or a capability check that cannot run on the client at all.
 * Everything that needs the database — resolving which apps an actor reaches —
 * happens once per request in `actor.ts` and arrives here as a plain Set.
 *
 * NOT A ROLE LADDER. Grants are per (action, role). The levels nest for one
 * action — own ⊂ scoped ⊂ all — but nothing anywhere may compare two roles.
 * `role >= X` is the bug this table exists to prevent.
 */

export const USER_ROLES = [
  'superadmin',
  'admin',
  'manager',
  'editor',
  'member',
  'stakeholder',
  'auditor',
] as const

export type UserRole = (typeof USER_ROLES)[number]

/** Reach over ONE action. Never a comparison between roles. */
export type GrantLevel = 'none' | 'own' | 'scoped' | 'all'

export type Actor = {
  id: string
  role: UserRole
  /** Apps this actor reaches. Resolved once per request by `loadActor`. */
  scopeAppIds: ReadonlySet<string>
}

/** What is being acted on. Both fields are optional; a missing one fails closed. */
export type Resource = {
  ownerId?: string | null
  appId?: string | null
}

const N = 'none' satisfies GrantLevel
const O = 'own' satisfies GrantLevel
const S = 'scoped' satisfies GrantLevel
const A = 'all' satisfies GrantLevel

type Row = Record<UserRole, GrantLevel>

/**
 * Action-major so one line reads as one capability across the whole org.
 * Column order is fixed: superadmin, admin, manager, editor, member,
 * stakeholder, auditor.
 */
export const ROLE_GRANTS = {
  // People
  'user.view.directory':        { superadmin: A, admin: A, manager: A, editor: A, member: A, stakeholder: N, auditor: A },
  'user.view.detail':           { superadmin: A, admin: A, manager: A, editor: S, member: S, stakeholder: N, auditor: A },
  'user.create':                { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.approve':               { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.deactivate':            { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'user.profile.edit':          { superadmin: A, admin: A, manager: S, editor: O, member: O, stakeholder: O, auditor: O },
  'user.role.grant':            { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.role.grant.superadmin': { superadmin: A, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'user.schedule.edit':         { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Apps
  'app.view':                   { superadmin: A, admin: A, manager: A, editor: S, member: S, stakeholder: S, auditor: A },
  'app.create':                 { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  'app.edit':                   { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'app.archive':                { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'app.assign':                 { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'app.role.assign':            { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'app.grant.stakeholder':      { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Worklog — there is deliberately no worklog.write.any at any level
  'worklog.view':               { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: A },
  'worklog.write.own':          { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'worklog.backfill':           { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'worklog.correct.request':    { superadmin: S, admin: A, manager: S, editor: S, member: N, stakeholder: N, auditor: N },
  'coverage.view':              { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: A },
  // Tasks and sprints
  'task.create':                { superadmin: A, admin: A, manager: S, editor: S, member: S, stakeholder: N, auditor: N },
  'task.edit':                  { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: N },
  'task.move':                  { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: N },
  'task.delete':                { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'sprint.manage':              { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'checkin.delete':             { superadmin: A, admin: A, manager: S, editor: O, member: O, stakeholder: N, auditor: N },
  // Meetings
  'meeting.manage':             { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: N },
  'meeting.intel.view':         { superadmin: A, admin: A, manager: S, editor: S, member: S, stakeholder: S, auditor: A },
  'meeting.delete':             { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'meeting.admin':              { superadmin: A, admin: A, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'followup.delete':            { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  // Change requests
  'request.create':             { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'request.withdraw':           { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'request.review':             { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'request.review.self':        { superadmin: O, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  // Absences and calendar
  'absence.create':             { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N },
  'absence.view':               { superadmin: A, admin: A, manager: S, editor: S, member: O, stakeholder: N, auditor: A },
  'absence.approve':            { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'holiday.manage':             { superadmin: A, admin: A, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  // Trash
  'trash.view':                 { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: A },
  'trash.restore':              { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
  'trash.purge':                { superadmin: A, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
  // Audit and danger
  'audit.view':                 { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: A },
  'admin.view':                 { superadmin: A, admin: A, manager: A, editor: N, member: N, stakeholder: N, auditor: A },
  'danger.dbclear':             { superadmin: A, admin: N, manager: N, editor: N, member: N, stakeholder: N, auditor: N },
} as const satisfies Record<string, Row>

export type Action = keyof typeof ROLE_GRANTS

/**
 * Fails closed. An `own` or `scoped` action asked without the resource it needs
 * is a denial, never an allow — a caller that forgot the resource must be told
 * no rather than accidentally granted everything.
 */
export function can(actor: Actor, action: Action, resource?: Resource): boolean {
  const level = ROLE_GRANTS[action][actor.role]
  if (level === 'none') return false
  if (level === 'all') return true

  const owns = resource?.ownerId != null && resource.ownerId === actor.id
  if (level === 'own') return owns
  if (owns) return true
  return resource?.appId != null && actor.scopeAppIds.has(resource.appId)
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/features/auth/capabilities.test.ts`
Expected: PASS, 20 tests.
Note: the `USER_ROLES` match test will FAIL until Task 3 widens the pg enum. Mark
it `it.fails` with a comment naming Task 3, and flip it back in Task 3's step 5.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/capabilities.ts src/features/auth/capabilities.test.ts
git commit -m "feat(auth): capability matrix replacing role-string checks"
```

---

### Task 2: The actor, its scope, and the server-action guard

`can()` needs a `scopeAppIds` set. This is the only part that touches the
database, and it runs **once per request**, not once per check. `manager` scope
comes from open `app_role_history` rows — NOT from `managesApp()`, which
regex-matches free-text `assignments.role` and returns false for a lead.

**Files:**
- Create: `src/features/auth/actor.ts`
- Test: `src/features/auth/actor.test.ts`

**Interfaces:**
- Consumes: `Actor`, `Action`, `Resource`, `can` from Task 1.
- Produces: `scopeSourceFor(role)`, `loadActor(): Promise<Actor | null>`,
  `requireCapability(action, resource?): Promise<Actor | null>`.

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/actor.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { scopeSourceFor } from '@/features/auth/actor'

describe('scopeSourceFor', () => {
  it('reads manager scope from app_role_history, never from assignments', () => {
    // managesApp() regex-matches free-text assignments.role and returns false
    // for a lead. Scope decided by a typed string is not auditable.
    expect(scopeSourceFor('manager')).toBe('app_role_history')
  })

  it('reads editor and member scope from assignments', () => {
    expect(scopeSourceFor('editor')).toBe('assignments')
    expect(scopeSourceFor('member')).toBe('assignments')
  })

  it('reads stakeholder scope from explicit grants only', () => {
    expect(scopeSourceFor('stakeholder')).toBe('app_grants')
  })

  it('never queries for workspace-wide roles', () => {
    for (const role of ['superadmin', 'admin', 'auditor'] as const) {
      expect(scopeSourceFor(role)).toBe('none')
    }
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/auth/actor.test.ts`
Expected: FAIL — cannot resolve `@/features/auth/actor`.

- [ ] **Step 3: Write the actor module**

Create `src/features/auth/actor.ts`:

```ts
import { and, eq, isNull, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { appGrants, appRoleHistory, assignments } from '@/db/schema'
import { auth } from '@/lib/auth'
import { can, type Action, type Actor, type Resource, type UserRole } from '@/features/auth/capabilities'

/**
 * Where a role's app scope comes from. Split out as a pure function so the
 * routing decision is testable without a database, and so the answer for
 * `manager` is written down in exactly one place.
 */
export type ScopeSource = 'none' | 'app_role_history' | 'assignments' | 'app_grants'

export function scopeSourceFor(role: UserRole): ScopeSource {
  switch (role) {
    case 'manager':
      return 'app_role_history'
    case 'editor':
    case 'member':
      return 'assignments'
    case 'stakeholder':
      return 'app_grants'
    case 'superadmin':
    case 'admin':
    case 'auditor':
      return 'none'
  }
}

/**
 * ONE query per request. Every `can()` call afterwards is a pure lookup against
 * the set this returns — that is why `can` can stay synchronous and why it can
 * be imported by client components.
 */
export async function loadActor(): Promise<Actor | null> {
  const session = await auth()
  const user = session?.user
  if (!user?.id) return null

  const role = user.role as UserRole
  const source = scopeSourceFor(role)
  if (source === 'none') {
    return { id: user.id, role, scopeAppIds: new Set() }
  }

  const rows =
    source === 'app_role_history'
      ? await db
          .select({ appId: appRoleHistory.appId })
          .from(appRoleHistory)
          .where(
            and(
              eq(appRoleHistory.userId, user.id),
              isNull(appRoleHistory.effectiveTo),
              inArray(appRoleHistory.role, ['pm', 'lead']),
            ),
          )
      : source === 'assignments'
        ? await db
            .select({ appId: assignments.appId })
            .from(assignments)
            .where(eq(assignments.userId, user.id))
        : await db
            .select({ appId: appGrants.appId })
            .from(appGrants)
            .where(eq(appGrants.userId, user.id))

  return { id: user.id, role, scopeAppIds: new Set(rows.map((r) => r.appId)) }
}

/**
 * The one guard every server action uses. Returns the actor on success and
 * null on refusal, matching the existing `requireAdmin()` contract exactly so
 * the seven call sites it replaces keep their `if (!x) return err(...)` shape.
 */
export async function requireCapability(
  action: Action,
  resource?: Resource,
): Promise<Actor | null> {
  const actor = await loadActor()
  if (!actor) return null
  return can(actor, action, resource) ? actor : null
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run src/features/auth/actor.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/actor.ts src/features/auth/actor.test.ts
git commit -m "feat(auth): actor scope resolution and the shared capability guard"
```

---

### Task 3: Migration 0037 — widen the role enum, alone

This migration ships by itself. Postgres cannot use a new enum value in the same
transaction that adds it, which is exactly why the backfill that maps `admin` to
`superadmin` is migration `0039` and not part of this file. `ALTER TYPE … ADD
VALUE` also cannot go inside a `DO $$ … $$` block, so this file cannot use the
repo's usual `EXCEPTION WHEN duplicate_object` guard — `ADD VALUE IF NOT EXISTS`
is replay-safe on its own.

**Files:**
- Create: `drizzle/0037_user_role_expand.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/db/schema.ts:8`

- [ ] **Step 1: Confirm the number is still free**

```bash
ls drizzle/*.sql | tail -3
python3 -c "import json;j=json.load(open('drizzle/meta/_journal.json'));print(j['entries'][-1])"
ls -d ../LogPup-* 2>/dev/null && grep -h '"tag"' ../LogPup-*/drizzle/meta/_journal.json 2>/dev/null | tail -5
```
Expected as of 2026-08-19: highest committed is `0035_ai_usage_events`
(`when: 1787155100000`) and `0036_key_sharing_prefs` is UNCOMMITTED in this tree
from a parallel session. **These numbers moved twice during planning.** If the
highest has moved again, renumber all three files and all three journal entries
before writing a single line of SQL, and say so. Never assume the numbers in this
plan are still free — that assumption has cost this repo four regeneration cycles.

- [ ] **Step 2: Write the migration**

Create `drizzle/0037_user_role_expand.sql`:

```sql
-- Widen user_role from admin|member to the seven-seat ladder.
--
-- SHIPS ALONE, ON PURPOSE. Postgres refuses to use a new enum value in the
-- same transaction that added it, so the backfill that remaps existing admins
-- to superadmin is 0039, two files later. Putting them together produces
-- "unsafe use of new value of enum type" at apply time.
--
-- No DO $$ guard here, unlike every other migration in this folder: ALTER TYPE
-- ... ADD VALUE is not allowed inside a function or transaction block on all
-- paths. IF NOT EXISTS gives the same replay safety on its own.
--
-- Additive only. Nobody's access changes when this applies — 'admin' and
-- 'member' keep meaning exactly what they meant.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'superadmin';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'manager';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'editor';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'stakeholder';
--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'auditor';
```

- [ ] **Step 3: Add the journal entry**

Append to `entries` in `drizzle/meta/_journal.json`, keeping `when` strictly
increasing above `1786600003000`:

```json
{ "idx": 37, "version": "7", "when": 1787155300000, "tag": "0037_user_role_expand", "breakpoints": true }
```

- [ ] **Step 4: Widen the Drizzle enum**

In `src/db/schema.ts:8`, replace the enum declaration:

```ts
export const userRole = pgEnum('user_role', [
  'superadmin',
  'admin',
  'manager',
  'editor',
  'member',
  'stakeholder',
  'auditor',
])
```

- [ ] **Step 5: Re-enable the drift test from Task 1**

In `src/features/auth/capabilities.test.ts`, change the `it.fails` back to `it`
and remove the comment naming Task 3.

Run: `npx vitest run src/features/auth/capabilities.test.ts && npx tsc --noEmit`
Expected: PASS. `tsc` may now flag the two-value `z.enum(['admin','member'])` at
`src/features/admin/actions.ts:93` — leave it; Task 5 owns that file.

- [ ] **Step 6: STOP — do not run the migration**

Migrations require explicit human approval before touching any database. Report
that `0035` is written and waiting.

- [ ] **Step 7: Commit**

```bash
git add drizzle/0037_user_role_expand.sql drizzle/meta/_journal.json src/db/schema.ts src/features/auth/capabilities.test.ts
git commit -m "feat(db): widen user_role to the seven-seat ladder"
```

---

### Task 4: Migrations 0038 and 0039 — the five tables, then the remap

`0038` creates everything new. `0039` remaps existing `admin` rows to
`superadmin` and must be a separate file because `0035` added that value.

**Files:**
- Create: `drizzle/0038_rbac_tables.sql`, `drizzle/0039_admin_to_superadmin.sql`
- Modify: `drizzle/meta/_journal.json`, `src/db/schema.ts`, `src/db/live.test.ts`

- [ ] **Step 1: Write 0036**

Create `drizzle/0038_rbac_tables.sql`. Replay-safe throughout, same discipline as
`0034` — `DO $$ … EXCEPTION WHEN duplicate_object` for types and constraints,
`IF NOT EXISTS` for tables and indexes.

```sql
-- The five tables behind approval-gated edits and non-daily logging.
--
-- Replay-safe throughout, same discipline as 0019/0021-0034.
--
-- NONE of these tables gets a deleted_at, and SOFT_TABLES stays at five.
-- Each closes by a different mechanism, stated per table below, because
-- "restorable from Trash" is wrong for all five: a withdrawn request and a
-- revoked access grant are not lost content.
DO $$ BEGIN
	CREATE TYPE "public"."change_request_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."change_request_op" AS ENUM('edit', 'delete', 'restore');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."absence_kind" AS ENUM('annual', 'sick', 'unpaid', 'training', 'other_project', 'no_work_assigned', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."absence_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- CLOSES BY STATUS. A request is never deleted; 'withdrawn' is the requester
-- closing their own, 'rejected' is a reviewer declining it. The row is the
-- audit trail, so removing it would destroy the record the feature exists for.
CREATE TABLE IF NOT EXISTS "change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_label" text NOT NULL,
	"operation" "change_request_op" NOT NULL,
	-- { before: {...}, after: {...} }. `before` is the pre-image captured when
	-- the request was filed and is what makes stale-approval detection possible:
	-- none of the target tables has an updated_at to compare against.
	"payload" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" "change_request_status" DEFAULT 'pending' NOT NULL,
	"app_id" uuid,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- CLOSES BY effective_to. Same half-open [from, to) shape as
-- app_role_history, including the one-open-row unique index, so a change to
-- part-time never rewrites what was true last month.
CREATE TABLE IF NOT EXISTS "work_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	-- {"mon":1,"tue":1,"wed":1,"thu":1,"fri":1,"sat":0.5,"sun":0}
	-- A row exists ONLY for someone who deviates from the studio default, which
	-- keeps living in working-days.ts. No row means the default.
	"pattern" jsonb NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"changed_by" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- CLOSES BY STATUS, like change_requests.
CREATE TABLE IF NOT EXISTS "absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	-- Both bounds INCLUSIVE. A one-day absence has start_date = end_date.
	-- Deliberately different from the half-open intervals above, because these
	-- are dates a person states in words ("I am out Monday to Wednesday"), not
	-- machine intervals, and an exclusive end is the classic off-by-one here.
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"kind" "absence_kind" NOT NULL,
	"reason" text,
	"status" "absence_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- REVOKED BY DELETE. A company holiday that was cancelled did not happen; a
-- tombstone would make every coverage read filter for it forever. The delete
-- is named in live.test.ts's DELETE_ALLOWED_FUNCTIONS with this rationale.
CREATE TABLE IF NOT EXISTS "org_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"name" text NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_holidays_day_unique" UNIQUE("day")
);
--> statement-breakpoint

-- REVOKED BY DELETE, for the same reason webauthn_credentials is exempted:
-- this is an access key. A restorable grant is a key that can come back from
-- the dead. Revocation must be absolute.
CREATE TABLE IF NOT EXISTS "app_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"granted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_grants_user_app_unique" UNIQUE("user_id","app_id")
);
--> statement-breakpoint
```

Foreign keys follow, one `DO $$ … EXCEPTION WHEN duplicate_object` block each,
copying `0034`'s exact wording: `change_requests.requester_id` → `users` cascade;
`reviewer_id` → `users` no action; `app_id` → `apps` cascade;
`work_schedules.user_id` → `users` cascade, `changed_by` → `users` no action;
`absences.user_id` and `created_by` → `users` cascade / no action, `reviewer_id`
→ `users` no action; `org_holidays.created_by` → `users` no action;
`app_grants.user_id` and `app_id` → cascade, `granted_by` → no action.

Then the indexes:

```sql
CREATE INDEX IF NOT EXISTS "change_requests_status_created_idx" ON "change_requests" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_requests_entity_idx" ON "change_requests" USING btree ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_requests_requester_idx" ON "change_requests" USING btree ("requester_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "work_schedules_user_from_idx" ON "work_schedules" USING btree ("user_id","effective_from");
--> statement-breakpoint
-- THE INVARIANT, copied from app_role_history_one_open_idx: at most one open
-- schedule per person. Two open rows would make "what was expected of them on
-- 12 June" ambiguous, which is the whole question coverage answers.
CREATE UNIQUE INDEX IF NOT EXISTS "work_schedules_one_open_idx" ON "work_schedules" USING btree ("user_id") WHERE "work_schedules"."effective_to" is null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "absences_user_start_idx" ON "absences" USING btree ("user_id","start_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "absences_status_start_idx" ON "absences" USING btree ("status","start_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_grants_user_idx" ON "app_grants" USING btree ("user_id");
```

Overlapping approved absences are prevented in `absence-actions.ts`, not by an
`EXCLUDE` constraint: that needs `btree_gist`, which is not verified present on
this Neon instance, and a failed extension install mid-migration is worse than an
application-level check with a test.

- [ ] **Step 2: Write 0037**

Create `drizzle/0039_admin_to_superadmin.sql`:

```sql
-- Capability-preserving remap. Today's admin can clear the database, so the
-- faithful destination is superadmin, not the new (narrower) admin seat.
-- Mapping admin -> admin would silently strip a power every current admin
-- holds, which is a security change disguised as a rename.
--
-- Operators demote to admin/manager from the new panel once the roles exist.
--
-- Idempotent by construction: the WHERE clause stops matching once applied.
-- Separate file from 0035 because Postgres refuses to use an enum value in
-- the transaction that added it.
UPDATE "users" SET "role" = 'superadmin' WHERE "role" = 'admin';
```

- [ ] **Step 3: Journal entries**

```json
{ "idx": 38, "version": "7", "when": 1787155400000, "tag": "0038_rbac_tables", "breakpoints": true },
{ "idx": 39, "version": "7", "when": 1787155500000, "tag": "0039_admin_to_superadmin", "breakpoints": true }
```

- [ ] **Step 4: Mirror the tables in schema.ts**

Add the five tables to `src/db/schema.ts` using the file's existing idioms —
`pgTable`, `uuid('...').primaryKey().defaultRandom()`,
`timestamp('...', { withTimezone: true }).defaultNow().notNull()`, `date('...')`,
and `jsonb('pattern').$type<SchedulePattern>()` following the one typed-jsonb
precedent at `activityLog.metadata` (`schema.ts:810`). Indexes go in the table's
second callback argument, and the two one-open-row unique indexes use
`.where(sql\`${t.effectiveTo} is null\`)`, copying `appRoleHistory` at `:135`.

Each table carries a comment stating which of the three closure mechanisms it
uses and why, in the style of the existing schema comments.

- [ ] **Step 5: Name the two plain deletes in live.test.ts**

`live.test.ts`'s `DELETE_RE` scan is keyed on file and function paths, not on
whether a table has a `deletedAt`. Add two entries to `DELETE_ALLOWED_FUNCTIONS`
(`src/db/live.test.ts:296`), matching the surrounding entries' style — a
function path and a written rationale:

```ts
'features/worklog/org-holiday-actions.ts:revokeOrgHoliday':
  'A cancelled company holiday did not happen. A tombstone would make every ' +
  'coverage read filter for it forever, and there is nothing here a person ' +
  'would be distressed to lose — the activity_log row is the record.',
'features/admin/app-grant-actions.ts:revokeAppGrant':
  'An access key, exactly like webauthn_credentials. Revocation must be ' +
  'absolute: a restorable grant is a key that can come back from the dead.',
```

Run: `npx vitest run src/db/live.test.ts`
Expected: PASS. `SOFT_TABLES` is untouched and check 1 still sees exactly five.

- [ ] **Step 6: STOP — do not run the migrations**

Report that `0037`, `0038` and `0039` are written and waiting for approval. When
approval comes, verify with `information_schema`, never the runner's exit code:

```sql
SELECT unnest(enum_range(NULL::user_role));
SELECT table_name FROM information_schema.tables
 WHERE table_name IN ('change_requests','work_schedules','absences','org_holidays','app_grants');
SELECT role, count(*) FROM users GROUP BY role;
```

- [ ] **Step 7: Commit**

```bash
git add drizzle/0038_rbac_tables.sql drizzle/0039_admin_to_superadmin.sql drizzle/meta/_journal.json src/db/schema.ts src/db/live.test.ts
git commit -m "feat(db): change requests, schedules, absences, org holidays, app grants"
```

---

### Task 5: Collapse the seven `requireAdmin()` copies

`requireAdmin()` is duplicated verbatim in seven files, none importing a shared
helper. Each is `session?.user?.role !== 'admin'` → `null`. They become one
import of `requireCapability`, which has the same return contract, so every
`if (!session) return err(...)` call site keeps its shape.

**Files:**
- Modify: `src/features/admin/actions.ts:28,93,119,130,152,190,488`
- Modify: `src/features/admin/trash-actions.ts:43`
- Modify: `src/features/sprints/actions.ts:58`
- Modify: `src/features/sprints/task-actions.ts:126`
- Modify: `src/features/apps/actions.ts:21,364`
- Modify: `src/features/people/actions.ts:31`
- Modify: `src/features/notion/actions.ts:13`
- Modify: `src/features/sprints/permissions.ts`
- Modify: `src/features/admin/permissions.ts`, `src/features/admin/permissions.test.ts`

**Interfaces:**
- Consumes: `requireCapability` (Task 2), `can` (Task 1).
- Produces: no new exports. `canMoveTask` and `canEditUser` keep their signatures;
  `wouldLeaveNoAdmins` is renamed `wouldLeaveNoSuperadmins`.

- [ ] **Step 1: Write the failing test for the renamed invariant**

In `src/features/admin/permissions.test.ts`, replace the `wouldLeaveNoAdmins`
tests with:

```ts
import { wouldLeaveNoSuperadmins } from '@/features/admin/permissions'

describe('wouldLeaveNoSuperadmins', () => {
  it('blocks the last superadmin from being demoted or deactivated', () => {
    expect(wouldLeaveNoSuperadmins(0)).toBe(true)
  })

  it('allows it while another active superadmin remains', () => {
    expect(wouldLeaveNoSuperadmins(1)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/admin/permissions.test.ts`
Expected: FAIL — `wouldLeaveNoSuperadmins` is not exported.

- [ ] **Step 3: Rename the invariant and delegate `canMoveTask`**

In `src/features/admin/permissions.ts`, rename `wouldLeaveNoAdmins` to
`wouldLeaveNoSuperadmins` and update its comment: the workspace MUST always
retain at least one active `superadmin`, because that is the only seat that can
grant the seat back.

Replace the body of `src/features/sprints/permissions.ts`, keeping the exported
signature byte-for-byte so `board-column.tsx:6,117` and `task-actions.ts:596`
do not change:

```ts
import { can, type Actor } from '@/features/auth/capabilities'

/**
 * Signature unchanged so the client component and the per-row map in
 * task-actions keep working untouched. The decision now comes from the matrix.
 */
export function canMoveTask(actor: Actor, assigneeId: string | null): boolean {
  return can(actor, 'task.move', { ownerId: assigneeId, appId: null })
}
```

Where a call site currently passes `(role, userId, assigneeId)`, it now passes
the `Actor` it already has from `loadActor()`. In the client component, the
actor is serialized by the server component that renders it — `Actor` is a plain
object plus a `Set`, so pass `scopeAppIds` as an array and rebuild the `Set` in
the client boundary.

- [ ] **Step 4: Swap the seven guards**

In each of the seven files, delete the local `requireAdmin()` and replace its
call sites with the capability the action actually needs:

| File | Old | New |
|---|---|---|
| `admin/actions.ts` `setUserRole` | `requireAdmin()` | `requireCapability('user.role.grant')`, plus a second check: granting `superadmin` needs `user.role.grant.superadmin` |
| `admin/actions.ts` `createUser` | `requireAdmin()` | `requireCapability('user.create')` |
| `admin/actions.ts` `approveUser` / `rejectUser` | `requireAdmin()` | `requireCapability('user.approve')` |
| `admin/actions.ts` `setUserActive` | `requireAdmin()` | `requireCapability('user.deactivate', { ownerId: targetId })` |
| `admin/actions.ts` `setUserOrgTags` / `Phone` / `PersonalEmail` / `Title` | `requireAdmin()` | `requireCapability('user.profile.edit', { ownerId: targetId })` |
| `admin/actions.ts` `clearTestData` | `requireAdmin()` | `requireCapability('danger.dbclear')` |
| `admin/trash-actions.ts` restores | `requireAdmin()` | `requireCapability('trash.restore', { appId })` |
| `admin/trash-actions.ts` purges | `requireAdmin()` | `requireCapability('trash.purge')` |
| `sprints/actions.ts` | `requireAdmin()` | `requireCapability('sprint.manage', { appId })` |
| `sprints/task-actions.ts` `deleteTask` | `requireAdmin()` | `requireCapability('task.delete', { appId, ownerId: assigneeId })` |
| `apps/actions.ts` create/archive | `requireAdmin()` | `requireCapability('app.create')` / `('app.archive', { appId })` |
| `apps/actions.ts:364` admin-or-PM | inline | `requireCapability('app.edit', { appId })` |
| `people/actions.ts` assign/update/remove | `requireAdmin()` | `requireCapability('app.assign', { appId })` |
| `notion/actions.ts` | `requireAdmin()` | `requireCapability('app.edit', { appId })` |

Also widen `roleInput` at `admin/actions.ts:93` from `z.enum(['admin','member'])`
to `z.enum(USER_ROLES)`, and change the last-admin count at `:119` to count
active `superadmin` rows.

- [ ] **Step 5: Verify the grep**

Run:
```bash
grep -rn "role === 'admin'\|role !== 'admin'\|role === \"admin\"" src/ \
  | grep -v 'src/features/auth/capabilities.ts'
```
Expected at this point: hits only in `src/features/meetings/**` (Task 6) and in
test fixtures that construct a session object. Paste the output.

- [ ] **Step 6: Run the suite**

Run: `npm run test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/ src/features/sprints/ src/features/apps/actions.ts src/features/people/actions.ts src/features/notion/actions.ts
git commit -m "refactor: route every admin guard through the capability matrix"
```

---

### Task 6: Meetings — four gate bodies, twelve inline checks

The 39 call sites do not move. The four gates keep their exported names,
parameters and return types exactly, so `src/features/transcription/actions.ts:33`
— which is outside scope and calls `canManageMeeting` — stays out of the diff.

**Files:**
- Modify: `src/features/meetings/actions.ts:171` (gate), `:908`
- Modify: `src/features/meetings/ai-actions.ts:557,578,1222,1867,2221,2960,3074,3463`
- Modify: `src/features/meetings/keyframe-access.ts:34`
- Modify: `src/features/meetings/followup-move-actions.ts:73,165,218`
- Modify: `src/features/meetings/rsvp-actions.ts:163,234`
- Modify: `src/features/meetings/share-actions.ts:56`

- [ ] **Step 1: Write the failing test for the preserved-reach action**

Add to `src/features/auth/capabilities.test.ts`:

```ts
describe('meeting.admin preserves today reach', () => {
  const creator = { id: 'u1', role: 'member', scopeAppIds: new Set<string>() } as const
  const pm = { id: 'u2', role: 'manager', scopeAppIds: new Set(['app-1']) } as const

  it('lets the creator act on their own meeting', () => {
    expect(can(creator, 'meeting.admin', { ownerId: 'u1', appId: 'app-1' })).toBe(true)
  })

  it('does NOT let a pm act on a meeting they did not create', () => {
    // rsvp/share/followup checks are creator-or-admin today, with no managesApp
    // arm. This assertion is what stops the refactor widening them.
    expect(can(pm, 'meeting.admin', { ownerId: 'u1', appId: 'app-1' })).toBe(false)
  })

  it('still lets a pm manage the same meeting through meeting.manage', () => {
    expect(can(pm, 'meeting.manage', { ownerId: 'u1', appId: 'app-1' })).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/auth/capabilities.test.ts`
Expected: FAIL if `meeting.admin` carries a `scoped` anywhere. It should already
pass from Task 1 — if it does, note that and move on. This test exists to make
the constraint permanent, not to drive new code.

- [ ] **Step 3: Rewrite the four gate bodies**

`actions.ts:171` — signature `(session, meeting) => Promise<boolean>` unchanged:

```ts
async function canManageMeeting(session: Session, meeting: MeetingRow): Promise<boolean> {
  const actor = await loadActor()
  if (!actor) return false
  return can(actor, 'meeting.manage', { ownerId: meeting.createdBy, appId: meeting.appId })
}
```

`ai-actions.ts:578` — signature `(meetingId) => Promise<{session, meeting} | null>`
unchanged; it keeps loading the meeting, and only the decision line changes to the
same `can(...)` call.

`ai-actions.ts:557` `canReadMeetingIntel(user, meeting)` — attendee is a fourth
reach source that the matrix does not model, so it stays as an explicit `||`
branch after the `can()` call, with a comment saying why:

```ts
if (can(actor, 'meeting.intel.view', { ownerId: meeting.createdBy, appId: meeting.appId })) return true
// Attendance is per-meeting, not per-app, so it cannot be a scope source —
// scopeAppIds is resolved once per request and an attendee list is per row.
return isAttendee(user.id, meeting.id)
```

`keyframe-access.ts:34` `canServeKeyframe` stays pure. Its `isAdmin` parameter is
renamed `canViewTrashed` and the route computes it as
`can(actor, 'trash.view', { appId })`. The flag logic is unchanged; update the
seven test call sites in `keyframe-access.test.ts` to the new parameter name.

- [ ] **Step 4: Replace the twelve inline checks**

| Site | Becomes |
|---|---|
| `ai-actions.ts:1222` `author.role === 'admin'` | `can(authorActor, 'meeting.manage', { ownerId, appId })` |
| `ai-actions.ts:1867` | `can(actor, 'meeting.manage', …)` |
| `ai-actions.ts:2221` `!isAdmin && !isCreator && !isSelf` | `!can(actor, 'meeting.admin', { ownerId: followup.ownerId }) && !isSelf` |
| `ai-actions.ts:2960`, `:3074` `canAddPeople` | `can(actor, 'user.create')` — adding a new person from the speaker dialog IS creating a user |
| `ai-actions.ts:3463` | `can(actor, 'user.create')`, same reason |
| `followup-move-actions.ts:73` | `can(actor, 'meeting.admin', { ownerId: meeting.createdBy })` |
| `followup-move-actions.ts:165` `deleteFollowup` | `requireCapability('followup.delete', { appId })` |
| `followup-move-actions.ts:218` `editFollowupText` | `requireCapability('meeting.admin', { ownerId: meeting.createdBy })` |
| `rsvp-actions.ts:163`, `:234`, `share-actions.ts:56` | `can(actor, 'meeting.admin', { ownerId: meeting.createdBy })` |

- [ ] **Step 5: The acceptance grep must now be clean**

Run:
```bash
grep -rn "role === 'admin'\|role !== 'admin'\|role === \"admin\"" src/ \
  | grep -v 'src/features/auth/capabilities.ts' \
  | grep -v '\.test\.ts'
```
Expected: **zero hits.** Paste the output. Test fixtures that build a session
object are allowed and are excluded above; nothing else is.

- [ ] **Step 6: Run everything**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/meetings/ src/features/auth/capabilities.test.ts
git commit -m "refactor(meetings): fold the four gates into the capability matrix"
```

---

### Task 7: Change requests — routing, appliers, actions

Three files, three responsibilities: who may review (pure), how a payload becomes
statements (pure construction), and the actions that tie them together.

**Files:**
- Create: `src/features/admin/change-request-routing.ts` + `.test.ts`
- Create: `src/features/admin/change-request-appliers.ts` + `.test.ts`
- Create: `src/features/admin/change-request-actions.ts`
- Create: `src/features/admin/change-request-queries.ts`
- Modify: `src/features/activity/types.ts:5-20`

**Interfaces:**
- Consumes: `can`, `Actor`, `Action` (Task 1); `requireCapability` (Task 2).
- Produces: `mayReview(actor, request)`, `APPLIERS`, `applyChangeRequest(...)`,
  `createChangeRequest`, `approveChangeRequest`, `rejectChangeRequest`,
  `withdrawChangeRequest`, `getApprovalsInbox`, `getMyRequests`.

- [ ] **Step 1: Write the failing routing test**

Create `src/features/admin/change-request-routing.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mayReview } from '@/features/admin/change-request-routing'
import type { Actor } from '@/features/auth/capabilities'

const actor = (id: string, role: Actor['role'], apps: string[] = []): Actor => ({
  id, role, scopeAppIds: new Set(apps),
})
const request = (requesterId: string, appId: string | null = 'app-1') => ({
  requesterId, appId, entityType: 'task' as const, status: 'pending' as const,
})

describe('mayReview', () => {
  it('lets an admin review anyone else request', () => {
    expect(mayReview(actor('a1', 'admin'), request('u1'))).toBe(true)
  })

  it('lets a manager review inside their scope only', () => {
    expect(mayReview(actor('m1', 'manager', ['app-1']), request('u1', 'app-1'))).toBe(true)
    expect(mayReview(actor('m1', 'manager', ['app-1']), request('u1', 'app-2'))).toBe(false)
  })

  it('refuses a manager their own request', () => {
    // Separation of duties. A scoped seat approving its own paperwork is the
    // exact failure an approval workflow exists to prevent.
    expect(mayReview(actor('m1', 'manager', ['app-1']), request('m1', 'app-1'))).toBe(false)
  })

  it('refuses an admin their own request', () => {
    expect(mayReview(actor('a1', 'admin'), request('a1'))).toBe(false)
  })

  it('allows a superadmin their own request', () => {
    // The one exception: a sole-superadmin workspace could otherwise never
    // approve anything. Logged with metadata.selfApproved = true.
    expect(mayReview(actor('s1', 'superadmin'), request('s1'))).toBe(true)
  })

  it('refuses an editor, a member and a stakeholder outright', () => {
    for (const role of ['editor', 'member', 'stakeholder'] as const) {
      expect(mayReview(actor('x', role, ['app-1']), request('u1', 'app-1'))).toBe(false)
    }
  })

  it('routes a worklog correction to the row owner, not the scope chain', () => {
    // daily_worklogs is a first-person record. Only the owner may accept a
    // correction to it, whatever anyone else capability says.
    const req = { ...request('m1'), entityType: 'worklog' as const, ownerId: 'u9' }
    expect(mayReview(actor('a1', 'admin'), req)).toBe(false)
    expect(mayReview(actor('u9', 'member'), req)).toBe(true)
  })

  it('refuses review of anything not pending', () => {
    expect(mayReview(actor('a1', 'admin'), { ...request('u1'), status: 'approved' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/admin/change-request-routing.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Write the routing rule**

Create `src/features/admin/change-request-routing.ts`:

```ts
import { can, type Actor } from '@/features/auth/capabilities'

export type ReviewableRequest = {
  requesterId: string
  appId: string | null
  entityType: string
  status: string
  /** Only set for worklog corrections: the owner of the row being corrected. */
  ownerId?: string
}

/**
 * Pure. Who may sign this request.
 *
 * Two rules that are not capability lookups:
 *  1. A worklog correction routes to the ROW OWNER and nobody else. Worklog
 *     writes are self-only; a correction applied by anyone else would convert
 *     a self-report into a managed metric.
 *  2. Nobody reviews their own request — except a superadmin, because the
 *     alternative is a sole-superadmin workspace that can never approve
 *     anything. Self-approvals are logged with metadata.selfApproved = true.
 */
export function mayReview(actor: Actor, request: ReviewableRequest): boolean {
  if (request.status !== 'pending') return false

  if (request.entityType === 'worklog') {
    return request.ownerId === actor.id
  }

  if (request.requesterId === actor.id) {
    return can(actor, 'request.review.self', { ownerId: actor.id })
  }

  return can(actor, 'request.review', { appId: request.appId })
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/features/admin/change-request-routing.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the failing applier test**

The applier registry is closed — one entry per supported `entityType`. A generic
"apply any diff" applier cannot exist here: `db.batch` needs a statically built
array of statements, and none of the target tables has an `updatedAt` to detect
a stale approval, so each applier compares the payload's `before` pre-image
field by field.

Create `src/features/admin/change-request-appliers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { detectConflict, SUPPORTED_ENTITY_TYPES } from '@/features/admin/change-request-appliers'

describe('detectConflict', () => {
  it('passes when the row still matches the pre-image', () => {
    const before = { title: 'Ship the thing', assigneeId: 'u1' }
    expect(detectConflict(before, { title: 'Ship the thing', assigneeId: 'u1', other: 9 })).toBeNull()
  })

  it('names the field that moved under the request', () => {
    const before = { title: 'Ship the thing', assigneeId: 'u1' }
    expect(detectConflict(before, { title: 'Ship it', assigneeId: 'u1' }))
      .toBe('title')
  })

  it('treats a vanished row as a conflict', () => {
    expect(detectConflict({ title: 'x' }, null)).toBe('row no longer exists')
  })

  it('only supports entity types with a written applier', () => {
    // A generic applier is impossible: db.batch needs statically built
    // statements. An unsupported type must refuse loudly at request time,
    // not silently at approval time.
    expect(SUPPORTED_ENTITY_TYPES).toEqual(['task', 'sprint', 'meeting', 'worklog', 'assignment'])
  })
})
```

- [ ] **Step 6: Run it and watch it fail, then write the appliers**

Run: `npx vitest run src/features/admin/change-request-appliers.test.ts`
Expected: FAIL.

Create `src/features/admin/change-request-appliers.ts` exporting
`SUPPORTED_ENTITY_TYPES`, `detectConflict(before, current)` returning the first
mismatched field name or `null`, and `APPLIERS`, a
`Record<EntityType, (id, after) => SQL>` that builds one update statement each.
Deletes build the soft-delete update the entity already uses; restores build its
inverse.

- [ ] **Step 7: Extend the activity vocabulary**

`ACTIVITY_ENTITY_TYPES` (`src/features/activity/types.ts:5-20`) is a closed union
with no escape hatch. Add five members with a comment in the file's existing
style: `'change_request'`, `'absence'`, `'work_schedule'`, `'org_holiday'`,
`'app_grant'`. The column is `text`, so no migration.

- [ ] **Step 8: Write the actions**

Create `src/features/admin/change-request-actions.ts`. Four actions, house idiom
throughout (`'use server'`, zod input, `requireCapability`, `ok`/`err`,
`revalidatePath`, `unexpected()` wrapper).

`approveChangeRequest` is the one that matters:

```ts
// db.transaction() does not exist on neon-http. db.batch is the house
// substitute (people/actions.ts:337-354) and needs statements built up front.
//
// logActivity() is NOT used here: it swallows its own errors and issues its
// own insert, so it can never be part of the batch. An approval whose audit
// row silently failed would be an approval nobody can trace, so the insert is
// inlined and fails with the write.
const conflict = detectConflict(request.payload.before, currentRow)
if (conflict) return err(`Cannot approve — ${conflict} changed since this was requested`)

await db.batch([
  APPLIERS[request.entityType](request.entityId, request.payload.after),
  db.update(changeRequests).set({
    status: 'approved', reviewerId: actor.id, reviewedAt: new Date(), reviewNote: note,
  }).where(eq(changeRequests.id, request.id)),
  db.insert(activityLog).values({
    actorId: actor.id,
    verb: 'approved',
    entityType: 'change_request',
    entityId: request.id,
    entityLabel: request.entityLabel,
    appId: request.appId,
    metadata: {
      requesterId: request.requesterId,
      operation: request.operation,
      selfApproved: request.requesterId === actor.id,
    },
  }),
])
```

`rejectChangeRequest` writes status and note only — it MUST NOT touch the target.
`withdrawChangeRequest` is guarded by `request.withdraw` against the requester's
own row.

- [ ] **Step 9: Prove the editor-delete path**

Add to `src/features/admin/change-request-routing.test.ts` a test asserting the
matrix refuses `task.delete` to an `editor` and permits `request.create`, so the
server action's only available path is to file a request:

```ts
it('leaves an editor with request.create as the only delete path', () => {
  const editor = actor('e1', 'editor', ['app-1'])
  expect(can(editor, 'task.delete', { appId: 'app-1' })).toBe(false)
  expect(can(editor, 'request.create', { ownerId: 'e1' })).toBe(true)
})
```

- [ ] **Step 10: Run and commit**

Run: `npm run test && npx tsc --noEmit`

```bash
git add src/features/admin/change-request-*.ts src/features/activity/types.ts
git commit -m "feat(admin): approval-gated change requests"
```

---

### Task 8: Schedules, absences, org holidays

**Files:**
- Create: `src/features/worklog/schedules.ts` + `.test.ts`
- Create: `src/features/worklog/schedule-actions.ts`
- Create: `src/features/worklog/absence-actions.ts`, `absence-queries.ts`
- Create: `src/features/worklog/org-holiday-actions.ts`
- Create: `src/features/admin/app-grant-actions.ts`

**Interfaces:**
- Produces: `STUDIO_DEFAULT_PATTERN`, `patternForDay(rows, iso)`,
  `overlaps(a, b)`, `approvedDaySet(absences)`.

- [ ] **Step 1: Write the failing schedule test**

Create `src/features/worklog/schedules.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { STUDIO_DEFAULT_PATTERN, overlaps, patternForDay } from '@/features/worklog/schedules'

const row = (from: string, to: string | null, sat: number) => ({
  effectiveFrom: from, effectiveTo: to,
  pattern: { ...STUDIO_DEFAULT_PATTERN, sat },
})

describe('patternForDay', () => {
  it('returns the studio default when nobody has a row', () => {
    expect(patternForDay([], '2026-04-08')).toEqual(STUDIO_DEFAULT_PATTERN)
  })

  it('keeps the studio default as Mon-Fri 1, Sat 0.5, Sun 0', () => {
    // The default lives in working-days.ts and must not fork. A row exists
    // ONLY for someone who deviates from it.
    expect(STUDIO_DEFAULT_PATTERN).toEqual({
      mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 0.5, sun: 0,
    })
  })

  it('picks the row whose half-open interval covers the day', () => {
    const rows = [row('2026-01-01', '2026-04-01', 0.5), row('2026-04-01', null, 0)]
    expect(patternForDay(rows, '2026-03-31').sat).toBe(0.5)
    expect(patternForDay(rows, '2026-04-01').sat).toBe(0)
  })

  it('treats effectiveTo as exclusive', () => {
    // Half-open [from, to), same as app_role_history. An inclusive end would
    // make two rows both cover the boundary day.
    const rows = [row('2026-01-01', '2026-04-01', 0.5)]
    expect(patternForDay(rows, '2026-04-01')).toEqual(STUDIO_DEFAULT_PATTERN)
  })
})

describe('overlaps', () => {
  it('detects two absences sharing a day, inclusive on both ends', () => {
    expect(overlaps(
      { startDate: '2026-04-06', endDate: '2026-04-08' },
      { startDate: '2026-04-08', endDate: '2026-04-10' },
    )).toBe(true)
  })

  it('allows adjacent absences', () => {
    expect(overlaps(
      { startDate: '2026-04-06', endDate: '2026-04-07' },
      { startDate: '2026-04-08', endDate: '2026-04-10' },
    )).toBe(false)
  })
})
```

- [ ] **Step 2: Run, fail, implement, pass**

Run: `npx vitest run src/features/worklog/schedules.test.ts` (FAIL, then PASS).
`patternForDay` scans for the row where `effectiveFrom <= iso < effectiveTo`,
falling back to `STUDIO_DEFAULT_PATTERN`. `overlaps` is inclusive on both bounds,
matching the `absences` DDL comment.

- [ ] **Step 3: Write the actions**

`schedule-actions.ts` — `setWorkSchedule` closes the open row
(`effectiveTo = now`) and inserts the new one in a single `db.batch`, preserving
the one-open-row unique index. Guarded by `user.schedule.edit`.

`absence-actions.ts` — `createAbsence` (guarded `absence.create`, refuses if
`overlaps` any existing approved or pending row for that user), `approveAbsence`
and `rejectAbsence` (guarded `absence.approve`, and `mayReview`-style
self-approval rule applies: only a `superadmin` approves their own).
**Retroactive with no limit** — a past `startDate` is valid, and approving it
flips those days to `exempt` immediately.

`org-holiday-actions.ts` — `addOrgHoliday` / `revokeOrgHoliday`, guarded
`holiday.manage`. `revokeOrgHoliday` is a plain delete plus an `activity_log`
row, named in `DELETE_ALLOWED_FUNCTIONS` in Task 4.

`app-grant-actions.ts` — `grantAppAccess` / `revokeAppGrant`, guarded
`app.grant.stakeholder`. Same plain-delete posture, same named exemption.

- [ ] **Step 4: Run and commit**

```bash
git add src/features/worklog/schedule*.ts src/features/worklog/absence*.ts src/features/worklog/org-holiday-actions.ts src/features/admin/app-grant-actions.ts
git commit -m "feat(worklog): work schedules, absences, org holidays, app grants"
```

---

### Task 9: The coverage calculator

The heart of the non-daily-logging half. Pure, synchronous, no database. It does
not re-derive day math: `workingDayFraction(iso, isHoliday)`
(`src/lib/working-days.ts:41`) already returns 1 / 0.5 / 0 and already folds
holidays to 0, with "a holiday always wins over Saturday" documented there.
Coverage generalizes that one function to a per-user pattern.

**Files:**
- Create: `src/features/worklog/coverage.ts` + `.test.ts`
- Create: `src/features/worklog/coverage-queries.ts`
- Modify: `src/features/worklog/missing-days.ts:29,66-67`

**Interfaces:**
- Consumes: `SchedulePattern`, `patternForDay` (Task 8).
- Produces: `CoverageStatus`, `CoverageInput`, `CoverageDay`, `CoverageSummary`,
  `computeCoverage`, `formatCoverage`.

- [ ] **Step 1: Write the failing test**

Create `src/features/worklog/coverage.test.ts`. One window, every status.
Weekdays are verified against the real calendar; `2026-04-13` and `2026-04-14`
are gazetted public holidays (`src/lib/lk-holidays.ts:63-64`).

```ts
import { describe, expect, it } from 'vitest'
import { computeCoverage, formatCoverage } from '@/features/worklog/coverage'

// A 3.5-day week: Mon/Wed/Fri full, Saturday half, Tue/Thu/Sun off.
const PART_TIME = { mon: 1, tue: 0, wed: 1, thu: 0, fri: 1, sat: 0.5, sun: 0 }
const ORG_HOLIDAYS = new Set(['2026-04-14'])
const GAZETTED = new Set(['2026-04-13', '2026-04-14'])

const input = (over: Partial<Parameters<typeof computeCoverage>[0]> = {}) => ({
  from: '2026-04-06',
  to: '2026-04-20',
  loggedDays: new Set(['2026-04-08', '2026-04-10', '2026-04-17', '2026-04-18']),
  exemptDays: new Set(['2026-04-15']),
  isHoliday: (iso: string) => GAZETTED.has(iso) || ORG_HOLIDAYS.has(iso),
  patternFor: () => PART_TIME,
  joinedOn: '2026-04-08',
  today: '2026-04-19',
  ...over,
})

describe('computeCoverage', () => {
  const statusOf = (s: ReturnType<typeof computeCoverage>, day: string) =>
    s.days.find((d) => d.day === day)?.status

  it('gives every day in the window exactly one status', () => {
    const s = computeCoverage(input())
    expect(s.days).toHaveLength(14)
    expect(statusOf(s, '2026-04-06')).toBe('not-yet-due')  // scheduled, but before the join date
    expect(statusOf(s, '2026-04-07')).toBe('not-yet-due')
    expect(statusOf(s, '2026-04-08')).toBe('logged')
    expect(statusOf(s, '2026-04-09')).toBe('off')          // Thursday, pattern 0
    expect(statusOf(s, '2026-04-10')).toBe('logged')
    expect(statusOf(s, '2026-04-11')).toBe('missing')      // Saturday half day, not logged
    expect(statusOf(s, '2026-04-12')).toBe('off')          // Sunday
    expect(statusOf(s, '2026-04-13')).toBe('off')          // gazetted holiday beats a full pattern day
    expect(statusOf(s, '2026-04-14')).toBe('off')          // gazetted AND org holiday, counted once
    expect(statusOf(s, '2026-04-15')).toBe('exempt')       // approved leave
    expect(statusOf(s, '2026-04-16')).toBe('off')
    expect(statusOf(s, '2026-04-17')).toBe('logged')
    expect(statusOf(s, '2026-04-18')).toBe('logged')       // Saturday, logged
    expect(statusOf(s, '2026-04-19')).toBe('not-yet-due')  // today — rule 2 beats rule 4
  })

  it('counts half days as 0.5 on BOTH sides of the ratio', () => {
    const s = computeCoverage(input())
    expect(s.expected).toBe(4)     // 1 + 1 + 0.5(missing Sat) + 1 + 0.5(logged Sat)
    expect(s.logged).toBe(3.5)
    expect(s.missing).toBe(0.5)
    expect(s.exempt).toBe(1)
    expect(s.off).toBe(5)
    expect(s.notYetDue).toBe(3)
    expect(s.extra).toBe(0)
  })

  it('holds expected === logged + missing', () => {
    const s = computeCoverage(input())
    expect(s.expected).toBe(s.logged + s.missing)
  })

  it('never counts an exempt day against the person', () => {
    const withoutLeave = computeCoverage(input({ exemptDays: new Set() }))
    // The same day, without the approved absence, becomes a miss and joins the
    // denominator. That difference is the entire point of the feature.
    expect(withoutLeave.expected).toBe(5)
    expect(withoutLeave.missing).toBe(1.5)
  })

  it('does not let a log on an unowed day inflate the denominator', () => {
    const s = computeCoverage(input({
      loggedDays: new Set(['2026-04-08', '2026-04-10', '2026-04-17', '2026-04-18', '2026-04-12']),
    }))
    expect(statusOf(s, '2026-04-12')).toBe('logged')  // logged outranks off
    expect(s.extra).toBe(1)
    expect(s.expected).toBe(4)                        // unchanged
  })

  it('counts a day logged during approved leave as work, not as leave', () => {
    const s = computeCoverage(input({
      loggedDays: new Set(['2026-04-08', '2026-04-10', '2026-04-15', '2026-04-17', '2026-04-18']),
    }))
    expect(statusOf(s, '2026-04-15')).toBe('logged')
    expect(s.extra).toBe(1)
  })
})

describe('formatCoverage', () => {
  it('always shows numerator and denominator', () => {
    expect(formatCoverage(computeCoverage(input())))
      .toBe('3.5/4 expected days logged · 1 exempt')
  })

  it('strips a trailing .0 but keeps a real half', () => {
    const whole = computeCoverage(input({
      patternFor: () => ({ mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 0, sun: 0 }),
    }))
    expect(formatCoverage(whole)).not.toMatch(/\.0/)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/worklog/coverage.test.ts`
Expected: FAIL — cannot resolve `@/features/worklog/coverage`.

- [ ] **Step 3: Write the calculator**

Create `src/features/worklog/coverage.ts` with the types from the design doc and
this precedence, evaluated top to bottom. **The order is the specification** —
each rule is here because the opposite order produces a wrong number.

```ts
/**
 * 1. day < joinedOn      -> 'not-yet-due'   nobody owes work before they started
 * 2. day >= today        -> 'not-yet-due'   today is still in progress; counting
 *                                           it missing accuses everyone every morning
 * 3. logged              -> 'logged'        LOGGED OUTRANKS OFF AND EXEMPT. Someone
 *                                           who worked a holiday, or worked during
 *                                           approved leave, has that work counted
 * 4. fraction === 0      -> 'off'           one rule covers Sunday, gazetted holiday,
 *                                           org holiday and a schedule that says zero,
 *                                           because workingDayFraction folds holidays to 0
 * 5. exempt              -> 'exempt'        approved absence
 * 6. otherwise           -> 'missing'
 *
 * where fractionFor(iso) = isHoliday(iso) ? 0 : patternFor(iso)[weekday(iso)]
 *
 * A day is OWED when fraction > 0, it is not exempt, and it is due. `expected`
 * sums the fractions of owed days; off, exempt and not-yet-due never enter the
 * denominator. That is the fix this module exists for.
 */
```

`formatCoverage` renders at most one decimal, strips a trailing `.0`, and always
emits both numbers: `"3.5/4 expected days logged · 1 exempt"`. It appends
`· N extra` only when `extra > 0`. **A bare percentage is never produced by this
module or rendered anywhere.**

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/features/worklog/coverage.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Extend missing-days.ts without replacing it**

`missing-days.ts` keeps `MAX_BACKFILL_DAYS = 10` (`:29`) and its
excludes-today rule (`:66-67`) exactly as they are. It gains one injectable
parameter mirroring the existing `isHoliday` seam:

```ts
export function missingWorkDays(
  …existing params,
  isExempt: (iso: string) => boolean = () => false,
)
```

Extended, not rewritten — every existing caller keeps working with the default.

- [ ] **Step 6: Write coverage-queries.ts**

Assembles `CoverageInput` from the database and calls the pure core: the user's
`work_schedules` rows, approved `absences` expanded to a day set, `org_holidays`
merged with `isGazettedHoliday` into one `isHoliday`, and the `daily_worklogs`
days in the window. Guarded by `coverage.view`.

- [ ] **Step 7: Run everything and commit**

Run: `npm run test && npx tsc --noEmit`

```bash
git add src/features/worklog/coverage.ts src/features/worklog/coverage.test.ts src/features/worklog/coverage-queries.ts src/features/worklog/missing-days.ts
git commit -m "feat(worklog): coverage statuses with fractional denominators"
```

---

### Task 10: The admin shell

`/admin` stops being one page and becomes a section area. Every section is
capability-guarded, and a section the actor lacks **does not render in the nav
and 404s if typed directly** — never render-then-error.

`forbidden()` and `unauthorized()` from `next/navigation` are NOT used: both are
experimental in Next 16.3 and require `experimental.authInterrupts` in
`next.config.ts`, which is out of scope. `notFound()` is the sanctioned denial,
and it is also the right answer — a stakeholder probing `/admin` must not learn
it exists.

**Files:**
- Create: `src/app/(app)/admin/layout.tsx`
- Create: `src/features/admin/components/admin-nav.tsx`
- Create: `src/features/admin/components/coverage-figure.tsx`
- Modify: `src/lib/revalidate-admin.ts:19`

- [ ] **Step 1: Fix the revalidation seam first**

`revalidateAdmin()` calls `revalidatePath('/admin')`, which invalidates the page
only. Once `/admin` has child segments, that leaves every section stale. The
documented fix
(`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md:160-165`)
is the `'layout'` type, which invalidates the segment and everything beneath it:

```ts
export function revalidateAdmin(): void {
  // 'layout' invalidates /admin AND every section under it. A bare
  // revalidatePath('/admin') only busts the overview page, which would leave
  // Trash, Approvals and People showing pre-delete data.
  revalidatePath('/admin', 'layout')
}
```

- [ ] **Step 2: Write the layout**

Create `src/app/(app)/admin/layout.tsx`. Server component. Note that `params`
is async in Next 15+ (`layout.md:89`) — this layout takes no params, but any
section that does must await them.

```tsx
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await loadActor()
  // Not "no session" — deliberately the same answer for "signed in but not
  // entitled". A stakeholder must not learn this route exists.
  if (!actor || !can(actor, 'admin.view')) notFound()

  return (
    <div className="…">
      <AdminNav sections={visibleSections(actor)} />
      <main>{children}</main>
    </div>
  )
}
```

`visibleSections(actor)` is a pure function over the section table below, so the
nav and the guards read from one list and cannot disagree.

| Route | Section | Capability |
|---|---|---|
| `/admin` | Overview | `admin.view` |
| `/admin/people` | People | `user.view.directory` |
| `/admin/approvals` | Approvals | `request.review` |
| `/admin/apps` | Apps & assignments | `app.edit` |
| `/admin/absences` | Absences & calendar | `absence.view` |
| `/admin/audit` | Audit trail | `audit.view` |
| `/admin/trash` | Trash | `trash.view` |
| `/admin/danger` | Danger zone | `danger.dbclear` |

- [ ] **Step 3: Build the nav**

`admin-nav.tsx` renders only the sections it is handed. Requirements from the
design system: heading order from one `h1`; `usePathname` for the active state;
active state is **not colour alone** (weight plus a left rule); full keyboard
path with visible `focus-visible`; on mobile the nav collapses to a horizontal
scroller inside its own `overflow-x-auto` container, never a hidden sidebar with
no replacement. Existing tokens only — `--sidebar*`, `--border`, `--muted-foreground`.

The Danger zone entry is separated by a rule and rendered last, in
`--destructive`, with its own group label. Structural separation, not just colour.

- [ ] **Step 4: Build the one component allowed to render a coverage number**

`coverage-figure.tsx` takes a `CoverageSummary` and renders
`formatCoverage(...)` — numerator, denominator, and the exempt tally. Numbers are
mono with `tabular-nums` and never `text-xl` or larger. There is no prop that
produces a bare percentage, by construction.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Manual: sign in as each of the seven roles (seed script) and confirm the nav
shows exactly the sections that role's row permits, and that typing a forbidden
section's URL 404s.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/admin/layout.tsx src/features/admin/components/admin-nav.tsx src/features/admin/components/coverage-figure.tsx src/lib/revalidate-admin.ts
git commit -m "feat(admin): capability-guarded section shell"
```

---

### Task 11: The eight sections

Each section is one page, built in this order. Every one gets designed empty,
loading and error states — skeletons, not spinners — and controls render before
data (Suspense-split, `people/history` is the pattern to copy). `src/components/ui/`
has **no** `skeleton`, `separator` or `tooltip`; the first section that needs one
adds it as a local component built from existing tokens, and the rest reuse it.

**Files:** `src/app/(app)/admin/{page,people/page,approvals/page,apps/page,absences/page,audit/page,trash/page,danger/page}.tsx`
plus components under `src/features/admin/components/`.

- [ ] **Step 1: Overview (`/admin`)**

Rewrites the current flat page. Org coverage with denominators (via
`coverage-figure`), pending-approval counts split by kind, and org health. Every
tile links to the section that acts on it. No tile shows a bare percentage.

- [ ] **Step 2: People (`/admin/people`)**

The existing `user-table` gains role (now seven values), status, work schedule,
and scope. **It must surface the migration gap**: people whose only claim to
management is a free-text `assignments.role` have no manager scope until an
admin records them as `pm` or `lead`. List them explicitly rather than letting
it be discovered.

Role changes route through `setUserRole`, which now needs
`user.role.grant.superadmin` for the top seat. The last-superadmin invariant
refuses with a message naming the rule.

- [ ] **Step 3: Approvals (`/admin/approvals`)**

One inbox, three sources: pending signups (existing `pending-approvals-card`),
change requests, absence requests. Each row shows requester, what changes,
old → new, reason, and age. Approve and reject are two-step for destructive
operations. A self-filed row is visibly marked and, for anyone but a superadmin,
its approve control does not render.

- [ ] **Step 4: Apps & assignments (`/admin/apps`)**

Existing `apps-table` plus per-app assignments, `pm`/`lead` (writing
`app_role_history`, which is now also the manager scope source), and stakeholder
grants.

- [ ] **Step 5: Absences & calendar (`/admin/absences`)**

Team calendar for the month, absence review, work schedules, org holidays.
`calendar.tsx` is raw react-day-picker with range mode unwired — wire range mode
here or render a plain month grid; do not add a dependency.

- [ ] **Step 6: Audit trail (`/admin/audit`)**

Reads `activity_log` with actor, entity-type and date filters. Self-approvals are
filterable — `metadata.selfApproved` is indexed by the query, not scanned in JS.

- [ ] **Step 7: Trash (`/admin/trash`)** — existing `trash-card`, moved, unchanged.

- [ ] **Step 8: Danger zone (`/admin/danger`)**

`superadmin` only, structurally separated, two-step confirm, destructive styling,
placed away from safe actions.

- [ ] **Step 9: Verify each section**

Per section: heading order from one `h1`; empty state naming the next action;
loading skeleton matching the real layout; full keyboard path; contrast on any
new muted tone; mobile collapse with wide content scrolling in its own container.

Run: `npx tsc --noEmit && npm run lint && npm run build`

- [ ] **Step 10: Commit per section**

One commit per section, `feat(admin): <section> section`.

---

### Task 12: Offboarding — the handover inventory

Added to this plan rather than deferred, because it is not independent of the
coverage work: once `work_schedules` exists, a person who leaves keeps accruing
`missing` days forever unless their schedule is closed. A leaver reading
"0/20 logged" every month makes every org-health number wrong.

**Files:**
- Create: `src/features/people/handover-inventory.ts` + `.test.ts`
- Create: `src/features/people/handover-queries.ts`
- Modify: `src/features/auth/capabilities.ts` (one new action)

**Interfaces:**
- Produces: `HandoverGroup`, `HandoverInventory`, `TRANSFERABLE_GROUPS`,
  `splitAllocation(total, shares)`, `getHandoverInventory(userId)`.

- [ ] **Step 1: Write the failing test**

Create `src/features/people/handover-inventory.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { NON_TRANSFERABLE, TRANSFERABLE_GROUPS, splitAllocation } from '@/features/people/handover-inventory'

describe('TRANSFERABLE_GROUPS', () => {
  it('covers every kind of open work a person can hold', () => {
    expect(TRANSFERABLE_GROUPS).toEqual([
      'assignments',
      'app_roles',
      'tasks',
      'meetings',
      'followups',
      'change_requests',
      'absences',
      'app_grants',
    ])
  })

  it('names what can never transfer, and why', () => {
    // A worklog is a first-person record — worklog writes are self-only, with
    // no admin on-behalf. Reassigning one would rewrite what somebody said
    // they did. Check-ins are the same shape. Credentials are keys.
    expect(NON_TRANSFERABLE.map((n) => n.table)).toEqual([
      'daily_worklogs',
      'sprint_checkins',
      'webauthn_credentials',
      'gemini_keys',
    ])
    for (const entry of NON_TRANSFERABLE) {
      expect(entry.reason.length).toBeGreaterThan(20)
    }
  })
})

describe('splitAllocation', () => {
  it('preserves the total when dividing across successors', () => {
    expect(splitAllocation(100, [{ userId: 'a', pct: 60 }, { userId: 'b', pct: 40 }]))
      .toEqual([{ userId: 'a', pct: 60 }, { userId: 'b', pct: 40 }])
  })

  it('refuses a split that does not add up', () => {
    expect(() => splitAllocation(100, [{ userId: 'a', pct: 60 }, { userId: 'b', pct: 30 }]))
      .toThrow(/90.*100/)
  })

  it('allows a deliberate drop to nobody', () => {
    // Leaving a group unassigned is a choice the summary states explicitly,
    // not a silent skip.
    expect(splitAllocation(100, [])).toEqual([])
  })
})
```

- [ ] **Step 2: Run, fail, implement, pass**

Run: `npx vitest run src/features/people/handover-inventory.test.ts`

`handover-queries.ts` assembles the inventory: `assignments` with
`allocationPct`; open `app_role_history` rows where they are `pm`/`lead` plus the
`apps.pm_id`/`lead_id` columns those mirror; live undone `tasks` assigned to
them; future `meetings` they created; unresolved `meeting_followups` attributed
to them; `change_requests` where they are the pending requester or routed
reviewer; `pending` absences; `app_grants` they hold. Guarded by `user.offboard`.

- [ ] **Step 3: Add the capability**

One row in `ROLE_GRANTS`, and one line in the Task 1 test asserting it:

```ts
'user.offboard': { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N },
```

- [ ] **Step 4: Commit**

```bash
git add src/features/people/handover-*.ts src/features/auth/capabilities.ts src/features/auth/capabilities.test.ts
git commit -m "feat(people): handover inventory for a departing person"
```

---

### Task 13: Offboarding — apply, and stop the coverage bleed

**Files:**
- Create: `src/features/people/handover-actions.ts`
- Create: `src/app/(app)/admin/people/[id]/handover/page.tsx`
- Modify: `src/features/admin/actions.ts` (`setUserActive`)
- Modify: `src/features/activity/types.ts` (one more entity type)

- [ ] **Step 1: Write the failing test for the deactivation gate**

```ts
it('refuses to deactivate while transferable work remains', async () => {
  const result = await setUserActive({ userId: 'leaver', active: false })
  expect(result.ok).toBe(false)
  expect(result.error).toMatch(/3 apps.*12 tasks/)
})

it('deactivates with an explicit acknowledgement, and records the choice', async () => {
  const result = await setUserActive({ userId: 'leaver', active: false, acknowledgeUntransferred: true })
  expect(result.ok).toBe(true)
})
```

- [ ] **Step 2: Write `applyHandover`**

One `db.batch`. As-of intervals **close and reopen** — they are never
overwritten:

```ts
// Same discipline as app_role_history's one-open-row invariant: close the
// departing person's interval, open the successor's. Overwriting user_id in
// place would erase the fact that the first person ever held the role, which
// is exactly the loss 0034 was written to prevent.
await db.batch([
  ...closes,        // set effective_to on the leaver's open rows
  ...opens,         // insert the successor's open rows
  ...liveMirrors,   // apps.pm_id / lead_id / tasks.assignee_id
  ...auditRows,     // one inline db.insert(activityLog) per affected entity
])
```

`logActivity` is not used — it swallows its own errors and issues its own
insert, so a handover whose audit trail silently failed would be untraceable.
The inserts are inlined and fail with the write.

- [ ] **Step 3: Close the schedule — the coverage rule**

In the same batch, close the leaver's open `work_schedules` row with
`effectiveTo = lastWorkingDay + 1 day`, and open nothing. `patternForDay` then
falls through to... **nothing**: a closed schedule with no successor row means
`computeCoverage` must treat the person as having no expected days past that
date.

Add the test that pins it:

```ts
it('stops expecting work from a departed person', () => {
  const s = computeCoverage(input({
    patternFor: (iso) => (iso >= '2026-04-15' ? ALL_ZERO : PART_TIME),
  }))
  // Every day from the 15th on is 'off', never 'missing'. A leaver who still
  // reads 0/20 every month makes every org-health number wrong.
  expect(s.days.filter((d) => d.day >= '2026-04-15' && d.status === 'missing')).toHaveLength(0)
})
```

- [ ] **Step 4: Build the flow**

Three steps on one route: inventory (grouped, counted) → successor selection
(all-to-one, or divide per group with a live-updating allocation total) →
preview (every row, old → new, per-group counts) → confirm. Nothing writes before
the confirm. Groups left unassigned are stated in the preview summary, never
silently skipped.

- [ ] **Step 5: Verify and commit**

Run: `npm run test && npx tsc --noEmit && npm run lint && npm run build`

```bash
git add src/features/people/handover-actions.ts src/app/\(app\)/admin/people src/features/admin/actions.ts src/features/activity/types.ts
git commit -m "feat(people): offboarding handover with allocation splitting"
```

---

### Task 14: Verification and review

- [ ] **Step 1: The acceptance greps, pasted**

```bash
grep -rn "role === 'admin'\|role !== 'admin'\|role === \"admin\"" src/ \
  | grep -v 'src/features/auth/capabilities.ts' | grep -v '\.test\.ts'
grep -rn "db.transaction" src/
grep -rn "deletedAt" src/db/live.ts | head
```
Expected: zero, zero, and `SOFT_TABLES` still holding exactly five tables.

- [ ] **Step 2: The full suite, pasted**

```bash
npm run test && npx tsc --noEmit && npm run lint && npm run build
```
Paste the real output. Do not claim green without it.

- [ ] **Step 3: Migration verification, after approval only**

Apply to a copy of the dev database, then verify against `information_schema` —
never the runner's exit code — using the three queries in Task 4 Step 6. Confirm
every pre-existing user retains equivalent access: every former `admin` is now
`superadmin`, every former `member` is still `member`, and no row has a role
outside the seven.

- [ ] **Step 4: Invoke `superpowers:verification-before-completion`**

- [ ] **Step 5: Invoke `superpowers:requesting-code-review`**

Three lenses: framework correctness (server/client boundaries, the serialized
`Actor`, `revalidatePath` coverage), accessibility (WCAG 2.1 AA on all eight
sections plus the handover flow), and visual craft.

---

## Self-review

Run against the spec before starting Task 1.

**Spec coverage.** Role matrix → Task 1. Scope → Task 2. Enum widening → Task 3.
Tables and remap → Task 4. `requireAdmin` collapse → Task 5. Meetings → Task 6.
Change requests → Task 7. Schedules, absences, holidays, grants → Task 8.
Coverage → Task 9. Panel → Tasks 10–11. Handover → Tasks 12–13. Verification →
Task 14. **Not yet covered by any task, and deliberately so:** the free-text
`assignments.role` regex in `managesApp()` is left alone — the meetings gates
that use it keep working, and replacing it is a separate change.

**Known gaps carried forward, each with a named owner task.**

| Gap | Where it surfaces |
|---|---|
| `src/lib/auth.ts:202` and `e2e/seed-user.ts:10,35` write literal `role: 'admin'`, which after `0037` is no longer the top seat | Out of scope (`auth.ts` sign-in behaviour is a stop condition). Raise before Task 3 runs against any database. |
| `assignments` soft-delete conversion (36 files, drags `managesApp`) | Deliberately deferred. Named follow-up. |
| `src/components/ui/` has no `skeleton`, `separator`, `tooltip`, `checkbox`, `radio-group` or `sheet` | Task 11 Step 1 adds the first as a local component. |
| Half-day *leave* | Out of scope. Half-day *weeks* are handled; a half-day absence is not. |

**Type consistency.** `Actor`, `Action`, `GrantLevel`, `Resource` are defined in
Task 1 and used unchanged in Tasks 2, 5, 6, 7, 12. `SchedulePattern` is defined
in Task 4 (schema) and Task 8 (pure module) — they must be the same type, and
Task 8 imports it rather than redeclaring it. `CoverageSummary` is produced in
Task 9 and consumed in Tasks 10, 11, 13.

---

## Execution

Two options:

1. **Subagent-driven (recommended)** — a fresh subagent per task with review
   between tasks. Tasks 1, 2, 7, 8, 9 and 12 are pure-module TDD and parallelize
   cleanly; Tasks 3–6 are sequential because each depends on the enum and the
   guard existing.
2. **Inline execution** — batch execution in one session with checkpoints.

Migrations stop for human approval regardless of which is chosen.
