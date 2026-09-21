# Project change policy — PM/lead parity + per-project sign-off

2026-09-20. Fixes the PM/tech-lead permission gaps found in the capabilities matrix audit, then adds the per-project approve-vs-autosave switch the ask calls for. Design produced by a 3-way judge panel (`minimal` / `correct` / `ux`) synthesized into one build.

**The ask, verbatim:** "PMs can do anything to projects, create sprint, edit, add or remove people, etc, need approval from tech lead or auto save (project settings will define it); tech lead also can do anything"

**Verdict (why this design, not one of the three candidates):** The "ux" spine wins — sign-off is routing applied AFTER authorisation, never a narrower permission, so `capabilities.ts` stays pure and one grant per (action, role) survives. Grafted from "correct": the requestable-field allowlist that keeps `buildApplyStatement` a single statement. From "minimal": the pure gate predicate that takes the app row as an argument, not a second `Actor` scope set.

## Audit findings

A capabilities/permissions audit ran 61 verification checks against the ask; these 28 were confirmed as real gaps (not refuted). Grouped by theme, with file:line and one-line impact.

**Root cause — the second manager definition (blocks the ask directly, high severity):**
- `scope-source-contradiction`, `lead-manager-ambiguity`, `managesapp-still-in-use-after-matrix-migration` — `src/features/apps/actions.ts:379` ANDs `requireCapability('app.edit')` (scoped via `app_role_history`, `actor.ts:72-82`) with `managesApp(...)` (free-text `assignments.role` regex via `isProjectManagerRole`, `project-roles.ts:20-28`, which returns `false` for `'lead'`). A recorded tech lead passes the matrix and is then denied. Conjunctive gate only ever subtracts.

**Missing resource on capability checks (blocks PM/lead scoped access, high severity):**
- `sprint-actions-missing-resource` — 8 sites in `src/features/sprints/actions.ts` (lines 85, 160, 234, 330, 395, 419, 444, 472) call the guard with no `{ appId }`, so `can()` fails closed for `scoped` grants and returns "Admins only" even though `sprint.manage` is `manager:S`.
- `assignment-actions-missing-resource` — `src/features/people/actions.ts:202,251,324` same shape for `app.assign`.
- `archive-app-missing-resource` — `src/features/apps/actions.ts:582` same shape for `app.archive`.

**Task editing bypasses the matrix (high):**
- `task-edit-pm-access-incomplete` — `src/features/sprints/task-actions.ts:395-397` hardcodes `isAdmin || isAssignee`; `isAdminRole` excludes `manager`, yet `task.edit` is `manager:S` in the matrix (`capabilities.ts:146`). PM/lead cannot edit tasks the matrix already grants them.

**UI hides what the server already allows (high/medium):**
- `app-edit-hidden-from-pm`, `settings-tab-is-app-admin-only`, `app-tab-nav-lacks-settings-route-to-pm` — `src/app/(app)/apps/[slug]/page.tsx:128-130` (and the edit dialog at :418/:832) gate on `isAdmin`, while `capabilities.ts:100` + `actions.ts:371` already grant `app.edit` scoped to manager. PM/lead has server access and no UI route.
- `approvals-inbox-not-discoverable` — `src/app/(app)/admin/approvals/page.tsx:23` gates the approvals queue on a resource-less `can(actor,'request.review')`, which fails closed for a scoped grant — a tech lead gets `notFound()` on the queue this feature is about to fill.
- `request-change-dialog-unreachable` — `src/features/admin/components/request-change-dialog.tsx` is declared, exports `createChangeRequest`'s only caller, and is imported nowhere. No UI path files a change request today.

**No per-project policy exists (high/medium — the feature itself):**
- `no-project-policy-setting`, `no-per-project-setting`, `approval-policy-column-missing`, `missing-approval-mode-column`, `no-per-project-settings-ui`, `app-form-has-no-policy-field` — `apps` (`schema.ts:237-291`) has no policy/settings column and no settings table exists anywhere; nothing implements "auto save or needs approval" per project. `change_requests` infrastructure already exists and is keyed by an entity, but `SUPPORTED_ENTITY_TYPES` (`change-request-appliers.ts:20`) does not include `'app'`, and `mayReview` has no app-specific branch — filing an app change request routes to no one in particular today.
- `no-change-request-routing-for-apps` — `apps/actions.ts:462` writes `apps` directly via `db.update`; no `change_requests` row is ever created for an app edit.

**Notifications and hygiene (low, worth fixing in the same pass):**
- `notifications-not-sent-on-approval`, `no-approval-notification` — `approveChangeRequest`/`rejectChangeRequest` (`change-request-actions.ts:95,166`) only write `activityLog`; nothing calls `createNotifications`. The requester finds out only by opening `/admin/approvals` and reading `getMyRequests`.
- `registry-commands-wiring` — `FEATURE_COMMANDS` (`commands.ts:43`) is a hand-maintained spread list; a new feature directory must be added there explicitly or ⌘K silently misses it (only bites if this work adds a new feature directory — it doesn't).

**Confirmed non-issues** (verified, correctly not blocking): `staleness-check-exists`, `apply-on-approval-works`, `notification-call-pattern`, `user-remove-consistent`, `finance-view-intentional-not-contradictory`, `totality-test-enforces-all-actions`, `scope-enforcement-independent`, `no-test-pins-app-delete-value` — the approval apply/staleness machinery and the finance/audit gating are already correct and are reused as-is.

## Decisions

**1. Delete the second manager definition, not widen it.**
Delete the `!isAdminRole(actor.role) && !(await managesApp(actor.id, parsedId.data))` conjunct and its import at `actions.ts:379`. `requireCapability('app.edit', { appId })` at `:371` is already the whole check, and the comment at `:367-369` already says so.
*Rejected:* adding `'lead'` to `isProjectManagerRole` — widens a free-text regex to answer a table-backed question, which is the conflict itself. Also rejected: leaving `managesApp` "during migration" — it is ANDed here, not unioned, so it only ever subtracts.

**2. Leave `managesApp` alone everywhere it widens, not gates.**
It stays in `meetings/actions.ts:269`, `meetings/ai-actions.ts` and `canReadMeetingIntel`, where it is a UNION that widens access for free-text-assigned people. Removing it there narrows live access for real users and is a separate change with its own blast radius. **Rule: `managesApp` may widen, never gate.**

**3. Pass the forgotten `Resource` everywhere a guard already has the row.**
`{ appId }` at the eight sprint sites, three people sites, and the archive-app site. Change `err('Admins only')` to `err('Not allowed')` at the four sprint sites that say it — the matrix already grants what the ask wants; the caller was throwing it away and lying about why.
*Rejected:* widening the matrix rows to `'all'` — that grants every manager every project.

**4. Task editing routes through `can()`, not a hardcoded label check.**
`task-actions.ts:395-397`: `isAdmin || isAssignee` becomes `can(actor, 'task.edit', { appId: existing.appId, ownerId: existing.assigneeId })`. Mirror the same call client-side in `task-dialog.tsx:139-145` instead of re-deriving.
*Rejected:* adding `manager` to `isAdminRole` — a role comparison smuggled into a label predicate, widening ~30 other call sites.

**5. The policy lives as one enum column on `apps`, not a settings table.**
`changePolicy: appChangePolicy('change_policy').notNull().default('auto_save')`, enum `app_change_policy` values `('auto_save','lead_approval')`, beside `status`. Hand-written `drizzle/0072_app_change_policy.sql` + `_journal.json` entry (drizzle-kit generate is broken in this repo).
*Why an enum, not a boolean:* `appStatus`, `changeRequestStatus` and `changeRequestOp` are the house pattern; a third mode later costs an enum value, not a rename. Default `'auto_save'` describes every existing row truthfully — every write lands directly today — so the column is inert on landing: no backfill, no data risk.
*Rejected:* a `project_policies` table or a jsonb `apps.settings` blob — a second permission system outside `capabilities.ts`, unqueryable for "which projects require sign-off". A `requires_approval boolean` — a flag, not an answer, no room for a third mode. A second `approver_id` column — a third home for a fact `app_role_history` and `apps.leadId` already record.

**6. No tech lead on a `lead_approval` project degrades to auto-save.**
`needsSignoff` returns `false` when `leadId` is `null`. No CHECK constraint.
*Why:* `apps.leadId` is nullable and `updateApp` already has a live path that clears it. A CHECK turns that existing, shipped path — on a DB shared with a parallel session — into a raw `23514` the moment it fires. The alternative to degrading is a project nobody can change.
*Rejected:* a DB CHECK constraint (the "correct" design) — normally the right rung, not when it retro-breaks a shipped write path on a live shared database.

**7. The gate predicate is pure and takes the app row as an argument.**
One export in `src/features/auth/capabilities.ts`, beside `APPROVAL_ACTIONS`:

```ts
/** Project SHAPE, never project WORK. Routing, not permission. */
const SIGNOFF_ACTIONS = ['app.edit', 'app.archive'] as const

export function needsSignoff(
  actor: Actor,
  action: Action,
  gate: { changePolicy: AppChangePolicy; leadId: string | null },
): boolean {
  if (!has(SIGNOFF_ACTIONS, action)) return false
  if (gate.changePolicy !== 'lead_approval') return false
  if (gate.leadId === null) return false      // nobody to sign
  if (gate.leadId === actor.id) return false  // the signer never queues their own
  return effectiveGrant(actor.role, actor.employmentType, action) === 'scoped'
}
```

`effectiveGrant === 'scoped'` is what makes admins (level `'all'`) bypass with no role comparison — the "never write role ladders" constraint holds by construction. Taking the gate as an argument, not as an `Actor` field, means zero extra query: `updateApp` already fetches the app row, and client components already receive it.
*Rejected:* a new `app.change.review` action + `Actor.leadAppIds`/`Actor.signoffAppIds` (both other designs) — adds a per-request query for every manager on every page load, gated question or not. Also rejected: gate-everything-`scoped` (routes editors' and members' task writes to the lead too) — far broader than the ask.

**8. Phase 1 gates only `app.edit` and `app.archive`.**
Never `sprint.manage`, `task.*`, `meeting.*`, `bug.*`, `worklog.review`, `deadline.*`, `absence.approve`. `app.assign` and `app.role.assign` (adding/removing people) are phase 2, named and deferred below. UI copy must say "changes to this project's details and status", never "changes".
*Why:* board work under sign-off is a queue the lead stops opening, and then app edits stop getting signed too. `app.edit`/`app.archive` are both plain `UPDATE`s the existing applier registry already handles.

**9. What an approved app request may change: an allowlist enforced at filing time.**
`APP_REQUESTABLE_FIELDS = name, description, repoUrl, techTags, aliases, status, internal, changePolicy`. Explicitly **not** `pmId` or `leadId`.
*Why:* `buildApplyStatement` (`change-request-appliers.ts:171-188`) returns one `db.update`, and neon-http has no `transaction()`. A `pmId`/`leadId` change must write `apps` AND the `appRoleHistory` close+open pair in the same batch — a generic spread that skipped that pair would silently break scope resolution for the person it names.
*Rejected:* widening `buildApplyStatement` to return `Statement[]` so approved requests can move PM/lead — real risk for a case that's already a direct `app.role.assign` write.

**10. Interception point: inside the server action, after `requireCapability`, before the write batch.**
One helper, `src/features/apps/signoff.ts`, called from `updateApp` and `archiveApp`. Returns `{ id: string } | null` — the new request id when it filed one, `null` when the caller proceeds as today.
*Why:* `requireCapability` returns `Actor | null` with no payload channel to file a request; routing there means a third return shape for ~100 actions. Capability-first also means the deactivation check, the employment cap, and the maintenance freeze all win before any policy read.
*Rejected:* client-only routing ("Send for approval" button, actions left alone) — `activity_log` would record the PM's direct write as though no policy existed, and any other route to the action bypasses the queue silently.

**11. Who signs: the app's lead, with the admin family as fallback.**
`ReviewableRequest` gains `leadId?: string | null`; `mayReview` (`change-request-routing.ts:30`) gains a branch above the generic tail: if `request.entityType === 'app'`, the app's lead signs via `can(actor,'request.review',{appId})`, everyone else needs `effectiveGrant(...,'request.review') === 'all'`. `getApprovalsInbox` fills `leadId` via a `leftJoin(apps, ...)` — no new query.
*Why:* the existing generic tail is `can(actor,'request.review',{appId})`, and `request.review` is `manager:S` — so today ANY manager scoped to the app, including a co-PM, could sign another PM's request. The branch is strictly narrower. Keeping `can` on the lead arm preserves the employment cap (`request.review` is in `APPROVAL_ACTIONS`, so a trainee/intern lead cannot sign and it falls to admin).
*Rejected:* a new `app.change.review` action + `leadAppIds` scope set — same outcome, two new concepts.

**12. Open the approvals queue route.**
`admin/approvals/page.tsx:23`'s resource-less `can(actor,'request.review')` becomes `effectiveGrant(actor.role, actor.employmentType,'request.review') !== 'none'`. Same widening on the nav row. `getApprovalsInbox` already scopes rows via `mayReview`.
*Why:* a resource-less `can` on a `manager:S` action fails closed, so a tech lead currently gets `notFound()` on the very queue this feature fills.

**13. Widen `updateApp`'s pre-change select before wiring sign-off.**
From `{slug,name,status,leadId,pmId}` to the full live row.
*Why:* `detectConflict` (`appliers.ts:39-52`) diffs only fields present in `before`. With the partial select, a competing change to `aliases`, `techTags`, `description`, `repoUrl` or `internal` goes undetected and is silently clobbered — through the workflow that exists to prevent clobbering. `apps` has no `updatedAt` (the applier's own comment names it), so this is the only guard available.

**14. Who may flip the policy: no special rule.**
`changePolicy` is an ordinary `app.edit` field (added to `update-input.ts`, **not** `create-input.ts` — a project is born `auto_save`). Under `lead_approval`, a PM's attempt to flip it back routes as a request the lead signs; the lead's and admins' own writes never queue.
*Why:* zero extra code, and the loop closes itself — flipping sign-off ON always auto-saves (harmless), flipping it OFF always requires the lead.
*Rejected:* a new `app.policy.set` matrix row — expresses something the existing gate already expresses.

**15. Deactivated/offboarded lead: no special check at write time.**
Requests still file and remain signable by the admin family. The settings card shows an amber note when the app's lead is inactive.
*Why:* `requireCapability` already refuses a deactivated actor, so they cannot sign; a queue is never orphaned because admins hold `'all'`. Reading `users.active` at write time would cost a join for a case the admin fallback already covers.

**16. Maintenance freeze refuses outright; it never queues.**
`requireCapability`'s `isFrozenByMaintenance` check runs before `routeForSignoff` and gets no exemption. Policy is read at write time only: flipping to `auto_save` leaves pending rows pending (never auto-approved); flipping to `lead_approval` never retro-gates an already-applied write.
*Why:* a freeze that quietly fills a queue ends in a stampede when it lifts. Auto-approving a queue on a settings change is a mass write with one click, approved on the requester's behalf — exactly the signature the row exists to prevent.
*Hazard on record:* `createChangeRequest` uses `loadActor` + `can`, **not** `requireCapability` (verified `change-request-actions.ts:50`), so it bypasses the freeze on its own — hence the rule that it is only ever called from inside an action that has already passed `requireCapability`.

**17. Notifications: file to the lead, resolve to the requester.**
`createNotifications` (`notify.ts:89`, type `'system'`): on filing → the app's lead; on approve AND reject → `request.requesterId`, carrying the reviewer and the note. Called **after** the write batch, never inside it (best-effort, swallows its own errors; the activity row stays in the batch).

**18. Cmd-K: no registry change needed.**
No new feature directory, no `FEATURE_COMMANDS` change. Widening the `/admin/approvals` nav gate gives the palette its destination row for free. Confirm `registry.test.ts` Check 2 still passes after the nav widening.

## Data contracts

```ts
// src/db/schema.ts — beside `status` on `apps`
export const appChangePolicyEnum = pgEnum('app_change_policy', ['auto_save', 'lead_approval'])
// column: changePolicy: appChangePolicyEnum('change_policy').notNull().default('auto_save')

// src/features/auth/capabilities.ts — beside APPROVAL_ACTIONS
const SIGNOFF_ACTIONS = ['app.edit', 'app.archive'] as const
export function needsSignoff(
  actor: Actor,
  action: Action,
  gate: { changePolicy: AppChangePolicy; leadId: string | null },
): boolean

// src/features/apps/signoff.ts
export async function routeForSignoff(actor: Actor, req: {
  action: Action; entityId: string; entityLabel: string; appId: string
  gate: { changePolicy: AppChangePolicy; leadId: string | null }
  operation: 'edit'; before: Record<string, unknown>; after: Record<string, unknown>; reason: string
}): Promise<{ id: string } | null>
// null => caller proceeds with its own direct write, as today.
// { id } => caller returns ok({ queued: id }) and does NOT write apps.

// Result shape at the two call sites (updateApp, archiveApp):
// ok({ queued: id })  — UI checks `'queued' in res.data`; ActionResult itself is unchanged.

// src/features/admin/change-request-routing.ts
interface ReviewableRequest {
  // ...existing fields
  leadId?: string | null
}
// mayReview gains an 'app' branch above the generic tail (Decision 11).

// src/features/admin/change-request-appliers.ts
// SUPPORTED_ENTITY_TYPES += 'app'; TABLES += { app: apps }
// currentRowFor gains an 'app' arm selecting APP_REQUESTABLE_FIELDS from live apps

// src/features/admin/change-request-actions.ts — createChangeRequest
export const APP_REQUESTABLE_FIELDS = [
  'name', 'description', 'repoUrl', 'techTags', 'aliases', 'status', 'internal', 'changePolicy',
] as const
// zod refine: entityType === 'app' => payload keys ⊆ APP_REQUESTABLE_FIELDS (pmId, leadId always rejected)

// Notifications (src/features/notifications/notify.ts, createNotifications, type: 'system')
// - on file:    -> app.leadId
// - on approve: -> request.requesterId (carries reviewer + note)
// - on reject:  -> request.requesterId (carries reviewer + note)
// called AFTER the db.batch, never inside it
```

## Edge rules

| Case | Rule |
|---|---|
| PM is also the lead | `needsSignoff` returns `false` when `gate.leadId === actor.id` — the signer never queues their own change. |
| No tech lead on a `lead_approval` project | Degrades to auto-save (`leadId === null` short-circuits `needsSignoff`). Amber note on the settings card. |
| Lead deactivated | No write-time check; `requireCapability` already refuses a deactivated actor from signing. Request stays open, admin family can still sign. Amber note when the app's lead is inactive. |
| Employment caps | `request.review` stays in `APPROVAL_ACTIONS`; a trainee/intern lead cannot sign — falls through to admin (`'all'`). |
| Maintenance freeze | Refuses the write outright before `routeForSignoff` runs. Never queues during a freeze. |
| Policy toggled mid-flight | Read at write time only. Flipping to `auto_save` never auto-approves pending rows. Flipping to `lead_approval` never retro-gates an already-applied write. |
| Multi-project entities | Not applicable in phase 1 — gate is scoped by `appId` on `app.edit`/`app.archive` only; sprints/tasks/meetings are never gated, so no entity spans two policies. |
| `changePolicy` itself | An ordinary `app.edit` field. Under `lead_approval`, turning it OFF routes to the lead; turning it ON always auto-saves. Not present on create (`update-input.ts` only) — a project is born `auto_save`. |

## UI surfaces

- **Settings tab visibility** (`apps/[slug]/page.tsx:128-130`, edit dialog `:418/:832`): `isAdmin` → `can(actor,'app.edit',{appId})`. Delete stays admin-only.
- **Settings card**, two radios (not a switch, so the "off" state says what it means):
  - "Save changes straight away / වෙනස්කම් වහාම සුරකී"
  - "Tech lead approves first / තාක්ෂණික ප්‍රධානියා පළමුව අනුමත කරයි" — shows the lead's name and the sentence "Project details and status wait for {lead}. Sprints, tasks, meetings and the board are never held up."
  - Second radio disabled with "Name a tech lead first" when `leadId` is null; amber note when a `lead_approval` project has lost its lead.
- **Submit flow under sign-off**: primary button reads "Send to {lead} for approval"; reveals a required one-line reason field before submit (`change_requests.reason` is `NOT NULL` — asking after the fact invites "asdf").
- **Pending indicator**: a persistent inline pill "Rename waiting on {lead} · view" sourced from `getMyRequests`, not just a toast — stops the same edit being resubmitted three times.
- **Generic fallback**: `request-change-dialog.tsx` becomes reachable (it exists today, imported nowhere).
- States: skeleton / empty / inline error, bilingual, reuses the existing pending-amber token only — no new colour.
- **Approvals queue route**: `/admin/approvals` page + nav row opened to any actor with non-`none` `request.review` grant, not just admins.

## Assumed defaults

Recorded as `Assumed:` pending user confirmation — each is the synthesis's `recommendedDefault`, not yet a user decision.

1. **ASSUMED — Sign-off scope.** Add/remove people is **not** covered in phase 1; only project details and status (`app.edit`, `app.archive`). *Why it matters:* the ask literally names "add or remove people". Covering it now needs a new `change_request_op` value (`'create'`, today only `edit|delete|restore`), a multi-statement applier, and extracting `removeAssignment`'s tombstone-then-history-then-delete triple so two callers share it — roughly triple the risk. Shipping without it means the UI must say "details and status", never "changes".
2. **ASSUMED — No tech lead behaviour.** Auto-save, with an amber "sign-off paused — no tech lead" note, rather than blocking all changes. *Why it matters:* blocking means a project nobody can change until an admin intervenes; the lead can be cleared via an existing shipped path, so this state is reachable today, not hypothetical.
3. **ASSUMED — Can a PM turn sign-off back off?** No — under `lead_approval` the flip routes as a request the lead signs; turning it ON always auto-saves. *Why it matters:* decides whether the setting is a constraint or a suggestion. Costs zero extra code, but means a PM who enabled sign-off by accident needs the lead to undo it.

## Deferred

- **`people/[id]` page has no `user.view.detail` gate.** Everything on that page renders for any signed-in viewer regardless of scope (stakeholder: `none`, editor/member: `scoped` in the matrix, unenforced in the route). Pre-existing, outside this audit's scope — needs a product decision on what a non-manager may see of someone else's profile before a gate is added.
- **`deadline.set` / `deadline.commit` are enforced nowhere yet.** Only `deadline.move.committed` gained real enforcement in this pass (the committed-deadline gate in `task-actions.ts`); setting or committing a deadline in the first place still has no matrix check.
- **Phase-2 sign-off for assignments and sprints** — see the next bullet below (unchanged from the original deferral).
- **Phase 2 — assignments/sprints under sign-off.** `app.assign` / `app.role.assign` gated, once an assignment applier + `change_request_op: 'create'` exist. Named explicitly in Decision 8 and Assumed default 1.
- **Expiry on pending requests.** No auto-expire; a request sits until signed, rejected, or superseded by a conflict. Not scoped here.
- **Push/email notification polish beyond the in-app `createNotifications` call** — the base notification (Decision 17) ships; richer digest/email delivery is out of scope.
- **`managesApp` cleanup at its remaining (widening) call sites** — explicitly left alone (Decision 2); a future pass could replace the free-text regex with the same `app_role_history` source used everywhere else, but that is an access-narrowing change with its own review, not bundled here.
- **`registry-commands-wiring` hardening** (import-and-spread safety net for `FEATURE_COMMANDS`) — noted as a low-severity hygiene item in the audit, not needed by this feature since no new feature directory is added.
- **Expiry on pending `change_requests`.** No auto-expire; a request sits until signed, rejected, or superseded by a conflict — same rule as the general "Expiry on pending requests" bullet above, restated because it applies to the app-entity requests this feature adds too.

**Wiring step (after migration 0072 is applied):** `needsSignoff`/`AppChangePolicy` (`capabilities.ts`) and `routeForSignoff` (`src/features/apps/signoff.ts`) are landed and tested but inert — nothing calls `routeForSignoff` yet. See the plan's "Wiring step" section for the exact task list (`schema.ts` column, `update-input.ts` field, `APP_REQUESTABLE_FIELDS`, the `currentRowFor` app arm, and the `updateApp`/`archiveApp` call sites).
