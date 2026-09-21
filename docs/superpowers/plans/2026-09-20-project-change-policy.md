# Project change policy — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-09-20-project-change-policy-design.md`

**Goal:** Fix the PM/tech-lead permission gaps the capabilities audit found (phase 1), then land the per-project auto-save-vs-sign-off switch the ask calls for (phase 2+). Phase 1 is independently useful and ships with no migration.

**Global constraints:** `main` is shared with a parallel session — never `git stash`/`add -A`/`commit -a`/`reset --hard`/`checkout -- .`; stage explicit paths, `git commit --only <paths>`. Never touch `src/db/schema.ts` until its migration (Task 5) is confirmed applied by the user. `capabilities.ts` stays pure and synchronous per (action, role) — no `role === 'x'` comparisons, no private "who is a manager" checks anywhere in this plan.

---

### Phase 1a — kill the second manager definition [x] landed

Delete the `!isAdminRole(actor.role) && !(await managesApp(actor.id, parsedId.data))` conjunct and its now-unused import at `src/features/apps/actions.ts:379`. `requireCapability('app.edit', { appId })` at `:371` is already the whole check. Leave `managesApp` untouched everywhere it's a UNION (meetings gates) — it only gets removed where it's ANDed.

**Files:** `src/features/apps/actions.ts`, `src/features/apps/actions.test.ts`

**TDD:** Failing test first — a `manager` actor whose only project link is an open `app_role_history` row with `role='lead'` (no manager-shaped free-text assignment) must pass `updateApp`. Red before the delete, green after.

**Verify:** `npx vitest run src/features/apps` exit 0 · `npx tsc --noEmit -p tsconfig.json` exit 0

---

### Phase 1b — pass the forgotten Resource [x] landed

Add `{ appId }` (or the matching resource) to every capability check that omits it:
- `src/features/sprints/actions.ts` lines 85, 160, 234, 330, 395, 419, 444, 472 — guard moves below `safeParse` for `createSprint`; the other seven read the sprint row first, then pass `{ appId: existing.appId }`.
- `src/features/people/actions.ts` lines 202, 251, 324 — `app.assign`.
- `src/features/apps/actions.ts:582` — `app.archive`.
- Change `err('Admins only')` → `err('Not allowed')` at the four sprint sites that say it. The same rewording also landed in `src/features/sprints/task-actions.ts` (deleteTask, bulkUpdateTasks) and `src/features/notion/actions.ts` (export gate) — both were the same stale-copy shape, folded into this task since they're the same one-line fix.

**Files:** `src/features/sprints/actions.ts`, `src/features/people/actions.ts`, `src/features/apps/actions.ts`, `src/features/sprints/task-actions.ts`, `src/features/notion/actions.ts` (+ colocated `*.test.ts` for each)

**TDD:** One failing test per action first — a manager scoped via `app_role_history` creates a sprint, renames one, and adds a person; each currently fails with "Admins only"/"Not allowed".

**Verify:** `npx tsc --noEmit -p tsconfig.json` exit 0 · `npx eslint --ignore-pattern '.claude/' --ignore-pattern '.next-e2e/' .` exit 0 · `npx vitest run` exit 0 with the new per-action tests green

---

### Phase 1c — task edit through the matrix [x] landed

`task-actions.ts:395-397`: replace `isAdmin || isAssignee` with `can(actor, 'task.edit', { appId: existing.appId, ownerId: existing.assigneeId })`. Mirror the same call client-side in `task-dialog.tsx:139-145` instead of re-deriving the check.

**Files:** `src/features/sprints/task-actions.ts`, `src/features/sprints/components/task-dialog.tsx` (+ colocated test)

**TDD:** Regression test first — assignee still passes (`own`), PM passes (`scoped`), unrelated member is refused. Confirm red before the swap.

**Verify:** `npx vitest run src/features/sprints` exit 0 · `npx tsc --noEmit -p tsconfig.json` exit 0

---

### Phase 1d — open the routes [x] landed

- `apps/[slug]/page.tsx:128-130` settings tab gate: `isAdmin` → `can(actor,'app.edit',{appId: app.id})`; same swap on the header Edit dialog at `:418`/`:832`. Delete stays `can(actor,'app.delete')` (admin-only, unchanged).
- `admin/approvals/page.tsx:23` and the nav row in `src/features/admin/sections.ts`: resource-less `can(actor,'request.review')` → `effectiveGrant(actor.role, actor.employmentType, 'request.review') !== 'none'`. (Not `src/components/shell/nav-items.ts` — that file has no `request.review` gate at all, only an icon-map entry; the admin nav's capability gate lives in `sections.ts`'s `visibleSections`.)
- Widen `updateApp`'s pre-change select (`apps/actions.ts:392-399`) from `{slug,name,status,leadId,pmId}` to the full live row, so `detectConflict` can see every field this feature will later route through sign-off. Comment on the widened select naming the staleness trap it closes.

**Files:** `src/app/(app)/apps/[slug]/page.tsx`, `src/app/(app)/admin/approvals/page.tsx`, `src/features/admin/sections.ts`, `src/features/apps/actions.ts`

**Verify:** `npx tsc --noEmit -p tsconfig.json` · `npx eslint ...` · full `npx vitest run` (confirm `registry.test.ts` Check 2 still passes) · `npm run build` exit 0 (src/app touched) · `npx playwright test e2e/smoke.spec.ts`

**Ship phase 1 here** — independently useful, no migration required.

---

### Phase 1e — surfaces the review found downstream [x] landed, this session

The 1a–1d matrix fixes (`can()`, real scope, `{ appId }`) changed what the server actually allows; these are every UI/action surface a follow-up review found still gating on the OLD `isAdmin`/`isAssignee` shape after that, one line each:

- `src/features/worklog/absence-queries.ts` (+ `absence-queries.test.ts`) — reads scoped by `worklog.review`/real appId reach, not admin-only.
- `src/features/worklog/absence-actions.ts` — approve/reject routed through the same scoped grant as the queries above.
- `src/features/admin/approval-queries.ts` — approvals inbox row visibility matches `mayReview`, not an admin check.
- `src/features/admin/sections.ts` — nav visibility for the approvals section reads the real grant, not `isAdminRole`.
- `src/features/meetings/ai-actions.ts` — `assignSpeaker`'s `writeAssignment`/`assignmentDeferred` split on `canAssignApp` (app.assign, scoped) rather than admin-only; a scoped PM/lead's attribution no longer silently drops the assignment while reporting success.
- `src/features/notion/actions.ts` — export gate on `app.edit` scoped, `err('Not allowed')` not `'Admins only'`.
- `src/app/(app)/people/[id]/page.tsx` — workload/assignment cards gated on the real `app.assign`/`app.edit` scope for that person's apps, not `isAdmin`.
- `src/features/people/components/team-panel.tsx`, `src/features/people/components/assignments-card.tsx` — Add/Edit/Remove controls gated on `canAssign` passed from the page's scoped grant.
- `src/features/sprints/components/board.tsx`, `board-column.tsx`, `roadmap.tsx`, `roadmap-timeline.tsx`, `task-dialog.tsx` — `canManageTasks`/`canDeleteTasks`/`canManageSprints` threaded from the page's scoped `can()` calls in place of `isAdmin` props; `task-dialog.tsx`'s client-side `can()` now takes the viewer's real role instead of a fabricated admin/member pair (this session: also confirmed `board-column.tsx`'s move affordance honours `canManageTasks`, and fixed a leftover "Only admins can reschedule sprints" line in `roadmap-timeline.tsx` to name the PM/lead too).
- `src/features/sprints/task-actions.ts` — `deleteTask` and `moveTaskOnBoard` route through `task.delete`/`task.move` with real scope; `bulkUpdateTasks` skips (not silently applies to) cards outside the actor's scope; the committed-deadline gate (`deadline.move.committed`) checks the real scope rather than admin-only.

**Files:** listed above.

**Verify:** `npx tsc --noEmit -p tsconfig.json` exit 0 · `npx vitest run` exit 0 · `npx eslint ...` exit 0

---

### Phase 2 — migration file only [x] landed

Hand-write the migration (drizzle-kit generate is broken in this repo):

```sql
CREATE TYPE "public"."app_change_policy" AS ENUM('auto_save','lead_approval');
ALTER TABLE "apps" ADD COLUMN "change_policy" "app_change_policy" DEFAULT 'auto_save' NOT NULL;
```

File: `drizzle/0072_app_change_policy.sql`. Add the matching `idx-72` entry to `drizzle/meta/_journal.json`, immediately after `0071_sso_redemptions`. **Do NOT touch `src/db/schema.ts` in this task** — a declared column whose migration hasn't run breaks every read of `apps` for every session on the shared dev DB.

**Files:** `drizzle/0072_app_change_policy.sql`, `drizzle/meta/_journal.json`

**Verify:** files exist; journal parses as valid JSON; `idx` is `72` and the `tag` matches the filename. Nothing else runs — the column is undeclared, so the tree is unchanged for every session until Task "Apply the migration" below lands.

---

### Apply the migration **[USER — Claude cannot run this]**

1. `npm run db:migrate`
2. `npm run db:status` — confirm `0072` shows applied
3. Confirm the column exists:
   ```sql
   select column_name from information_schema.columns
   where table_name = 'apps' and column_name = 'change_policy';
   ```
   Expect one row back.

**This must land before Phase 3.** A `schema.ts` declaration for `change_policy` without this migration applied raises `42703` on every read of `apps`, for every parallel session, the instant it's declared.

---

### Phase 3 — declare and wire the pure half (all dead code, zero behaviour change) [partial] landed as inert code (not wired)

Status this session: `src/features/auth/capabilities.ts` — `SIGNOFF_ACTIONS`/`isSignoffAction`, `APP_CHANGE_POLICIES`/`AppChangePolicy`, and `needsSignoff(actor, action, gate)` are landed, pure, and take `gate` as a caller-supplied parameter (no `db` read) — nothing calls it yet. **Still open, deliberately not touched this session** (HARD RULE — migration 0072 unapplied): `src/db/schema.ts` (`appChangePolicyEnum` + `changePolicy` column) and `src/features/apps/update-input.ts` (`changePolicy` field). See "Wiring step" below.

- `src/db/schema.ts`: `appChangePolicyEnum` pgEnum + `changePolicy` column beside `status` — **only after the migration above is confirmed applied**.
- `src/features/auth/capabilities.ts`: `SIGNOFF_ACTIONS` + `needsSignoff(actor, action, gate)` beside `APPROVAL_ACTIONS`, per the spec's Data contracts section.
- `src/features/apps/update-input.ts`: `changePolicy: z.enum([...]).optional()` — **not** `create-input.ts` (a project is born `auto_save`).
- `src/features/apps/activity-summary.ts` (`summarizeAppChanges`): gains a policy-change fragment.
- Tests: `needsSignoff` truth table — PM gated, lead exempt, admin exempt (`'all'`), null lead exempt, `auto_save` exempt, ungated action (e.g. `sprint.manage`) exempt.

**Files:** `src/db/schema.ts`, `src/features/auth/capabilities.ts`, `src/features/auth/capabilities.test.ts`, `src/features/apps/update-input.ts`, `src/features/apps/activity-summary.ts`

**Verify:** `npm run db:drift` clean · `npx tsc --noEmit -p tsconfig.json` exit 0 · full `npx vitest run` exit 0 · `npm run build` exit 0 (schema.ts is a build trigger). Nothing calls `needsSignoff` yet, so behaviour is unchanged.

---

### Phase 4 — the routing layer (still unreachable from the UI) [ ] not yet landed

Status this session: not started by this task — `SUPPORTED_ENTITY_TYPES` in `change-request-appliers.ts` is still `['task','sprint','meeting','worklog']` (no `'app'` arm, no `APP_REQUESTABLE_FIELDS`), and `change-request-routing.ts`'s `mayReview` has no `leadId`/`'app'` branch yet. `src/features/apps/signoff.ts` (Phase 5, below) calls the existing public `createChangeRequest` action with `entityType: 'app'` regardless — that action accepts any string `entityType` and refuses unsupported ones only at filing time, so `signoff.ts` needed no import from this phase and isn't blocked by it landing later, but a real filing attempt against `entityType: 'app'` will be refused by `isSupportedEntityType` until this phase lands.

- `change-request-appliers.ts`: `SUPPORTED_ENTITY_TYPES += 'app'`; `TABLES += { app: apps }`; `currentRowFor` gains an `'app'` arm selecting `APP_REQUESTABLE_FIELDS` from live `apps`.
- `change-request-actions.ts` (`createChangeRequest`): `APP_REQUESTABLE_FIELDS` const + zod refine — a payload containing `pmId` or `leadId` is refused at filing.
- `change-request-routing.ts`: `ReviewableRequest` gains `leadId?: string | null`; `mayReview` gains the `entityType === 'app'` branch above the generic tail (spec Decision 11).
- `change-request-queries.ts` (`getApprovalsInbox`): `leftJoin(apps, eq(apps.id, changeRequests.appId))` to fill `leadId` — no new query.
- Tests: co-PM refused, lead allowed, requester-is-lead falls to `request.review.self`-equivalent behaviour, trainee/intern lead falls to admin, admin always allowed, stale pre-image refused by field name (from the widened select in Phase 1d).

**Files:** `src/features/admin/change-request-appliers.ts`, `src/features/admin/change-request-actions.ts`, `src/features/admin/change-request-routing.ts`, `src/features/admin/change-request-queries.ts`, + colocated `*.test.ts`

**Verify:** `npx tsc --noEmit -p tsconfig.json` · `npx eslint ...` · full `npx vitest run` exit 0 with the new routing and applier tests green

---

### Phase 5 — wire the two call sites (first real behaviour change) [partial] landed as inert code (not wired)

Status this session: `src/features/apps/signoff.ts` (new) — `routeForSignoff(actor, req)` per the spec's Data contracts signature, landed with `src/features/apps/signoff.test.ts` (6 cases: `auto_save` no-op, PM+`lead_approval` files and returns `{id}`, actor-is-lead exempt, admin exempt, null `leadId` degrades to auto-save, plus a filing-failure-throws regression). It calls the existing public `createChangeRequest` action (no duplicate filing logic) and comments the maintenance-freeze hazard (`createChangeRequest` uses `loadActor`+`can`, not `requireCapability` — only ever call this from inside an action that already passed `requireCapability`).

**Still open — the actual wiring, deliberately not done this session** (needs Phase 4 landed, and per the HARD RULE, needs migration 0072 applied and `schema.ts` declared first): calling `routeForSignoff` from `updateApp`/`archiveApp`, and the `createNotifications` calls on file/approve/reject. See "Wiring step" below.

**Files:** `src/features/apps/signoff.ts`, `src/features/apps/actions.ts`, `src/features/admin/change-request-actions.ts`

**Verify:** `npx tsc --noEmit -p tsconfig.json` · `npx eslint ...` · full `npx vitest run` · an integration test asserting a PM's `updateApp` on a `lead_approval` app writes a `change_requests` row and does **not** write `apps`

---

### Wiring step (after migration 0072 is applied) [ ] not yet landed

One 10-line pass, only once "Apply the migration" above is confirmed done. Exactly:

- [ ] `src/db/schema.ts` — `appChangePolicy` pgEnum referencing `APP_CHANGE_POLICIES` (from `capabilities.ts`, not a re-declared literal) + the `changePolicy` column on `apps`, beside `status`.
- [ ] `src/features/apps/update-input.ts` — add the `changePolicy` field (not `create-input.ts`; a project is born `auto_save`).
- [ ] `src/features/admin/change-request-actions.ts` — `APP_REQUESTABLE_FIELDS` += `'changePolicy'`.
- [ ] `src/features/admin/change-request-appliers.ts` — the `currentRowFor` arm for `app` gains `changePolicy` in its selected fields.
- [ ] `src/features/apps/actions.ts` — `updateApp`/`archiveApp` call `routeForSignoff(actor, req)` with `gate` built from the live row (`{ changePolicy: row.changePolicy, leadId: row.leadId }`); on `{ id }` return `ok({ queued: id })` and skip the direct write.
- [ ] Phase 6 (UI) — see below.

**Files this touches:** `src/db/schema.ts`, `src/features/apps/update-input.ts`, `src/features/admin/change-request-actions.ts`, `src/features/admin/change-request-appliers.ts`, `src/features/apps/actions.ts`.

---

### Phase 6 — UI

- Settings card: two radios (auto-save / lead approval), lead's name, the narrow-scope sentence ("Sprints, tasks, meetings and the board are never held up"), disabled state with "Name a tech lead first" when `leadId` is null, amber note when a `lead_approval` project has lost its lead. Bilingual strings per the spec's UI surfaces section.
- Submit flow under sign-off: button label "Send to {lead} for approval"; required one-line reason revealed before submit.
- Pending pill from `getMyRequests`: "Rename waiting on {lead} · view".
- Wire `request-change-dialog.tsx` as the generic fallback trigger (currently declared, imported nowhere).
- Skeleton / empty / inline-error states on the pending list, reusing the existing pending-amber token.

**Files:** `src/features/apps/components/app-form-dialog.tsx`, `src/app/(app)/apps/[slug]/page.tsx`, `src/features/admin/components/request-change-dialog.tsx`

**Verify:** `npx tsc --noEmit -p tsconfig.json` · `npx eslint ...` · full `npx vitest run` · `npm run build` · browser check on port 3400 as a PM and as the lead (`take_snapshot`, `take_screenshot`, zero console errors, no 4xx/5xx) · `npm run e2e`

---

### Phase 7 — record

- Spec (already drafted): `docs/superpowers/specs/2026-09-20-project-change-policy-design.md` — keep its Data contracts and Deferred sections current as phases land; mark phases complete here as they ship.
- This plan file: tick each phase's checkbox as it lands.
- `README.md` Features bullet for the per-project sign-off switch.
- `graphify update .` (background) — restore `graphify-out/graph.html` from `HEAD` afterward if the update deletes it; never stage that deletion.
- One memory entry: sign-off is a route, not a permission — the matrix answers "may they", the policy answers "does it land now".

**Files:** `docs/superpowers/specs/2026-09-20-project-change-policy-design.md`, `docs/superpowers/plans/2026-09-20-project-change-policy.md`, `README.md`, `graphify-out/**`, `~/.claude/projects/-Users-deeghayuadhikari-Documents-GitHub-LogPup/memory/`

**Verify:** spec and plan exist with both required sections; `MEMORY.md` index line added; graphify-out paths listed unstaged in the recap
