# Admin Panel Redesign — RBAC, Change Requests, Non-Daily Logging — Design

Date: 2026-08-19
Status: approved for planning

## Purpose

Three problems, one design, because they share a permission spine:

1. **The role model is two values wide.** `user_role` is `admin | member`. Every
   capability question in the app is therefore answered by a string comparison —
   48 of them across 31 files. There is no seat for a project coordinator who may
   fix data but must not delete it, no seat for a client who may look but not
   touch, and no seat for a compliance reviewer who needs the audit trail without
   the keys to the workspace.

2. **There is no approval path for a destructive or out-of-scope change.** A
   change is either permitted outright or refused. Corporate engineering practice
   (SE and EPC alike) needs the middle state: propose the change, have someone
   accountable sign it, then apply it with the signature attached.

3. **"No worklog row for this date" means five different things and the app
   cannot tell them apart** — on leave, on a public holiday, allocated to another
   project, part-time and not expected today, or genuinely missing. Every
   coverage number the panel could show today is wrong for anyone who does not
   log daily, which is most people most weeks.

## Users & roles

Two orthogonal axes. Baking reach into the role enum produces combinatorial
explosion the first time someone needs "admin, but only for these two projects";
keeping them separate means a new reach requirement is data, not a migration.

### Axis A — role (`user_role` widens 2 → 7)

| Role | Capability |
|---|---|
| `superadmin` | Everything, including the danger zone (DB clear) and granting `superadmin`. |
| `admin` | Org operations workspace-wide: approve signups, create/deactivate users, manage apps, review change requests, restore from trash. NOT the danger zone; cannot grant `superadmin`. |
| `manager` | Everything `admin` can do **that has a scope**, restricted to it (Axis B). Workspace-level acts stay with `admin`: approving a self-signup, creating a user, and granting any role above `member`. A scoped seat cannot widen the workspace. |
| `editor` | Edits freely inside assigned apps and on own records. Every delete, and every edit outside scope or outside the open window, opens a change request instead of mutating. |
| `member` | Logs own work, edits own records in-window, reads assigned apps. Today's `member`, unchanged. |
| `stakeholder` | Read-only, hard-scoped to explicitly granted apps, **plus exactly one write: reporting a defect in a granted app** (`bug.report`, from `2026-08-20-deadlines-and-bugs-design.md`). No people directory, no admin surfaces, no other apps, and no second write. The client/owner seat in an EPC engagement. |
| `auditor` | Read-only across everything the organisation decided, including `activity_log` and trash, with **one documented exclusion: `personal_items`** (see `2026-08-20-personal-and-organizer-design.md` §"The auditor carve-out" for the argument — an unpromoted private item is not an organisational act, writes no `activity_log` row, and becomes fully auditable the moment it is promoted to a task). Zero write capability. Compliance review without handing out an admin seat. |

Roles are NOT nested by integer level. `manager` is not "admin minus one" — it is
admin capability with a scope predicate. The implementation is an explicit
capability matrix; `role >= X` comparisons are forbidden.

`contractor` is deliberately not a role: it is `member` plus a restricted app
grant. If the label turns out to matter in the user table it is an additive enum
value later, which costs one migration statement.

### Axis B — scope

| Role | Scope source |
|---|---|
| `manager` | Apps where the user is the as-of `pm` or `lead` — open rows in `app_role_history` (`effective_to IS NULL`). **NOT `managesApp()`** — see the correction below. No new table. |
| `editor` | Apps the user is **assigned** to (`assignments`). Deliberately a different source than `manager`: broader membership, narrower power — edit inside the scope, request outside it. |
| `stakeholder` | Explicit rows in a new `app_grants` table. Read-only reach only. |
| `superadmin`, `admin`, `auditor` | Workspace-wide. |
| `member` | Own records plus apps they are assigned to (`assignments`). |

**Correction (2026-08-19): `managesApp()` is not the manager-scope predicate.**
`src/features/apps/project-manager.ts:25` resolves nothing structural — it
regex-matches the free-text `assignments.role` string (`/\bmanager\b/`, `/^pm\b/`,
product owner, scrum master) through `isProjectManagerRole()`, never reads
`app_role_history`, `apps.pm_id` or `apps.lead_id`, and returns **false for a
lead**. Scope decided by whatever string somebody typed into an assignment is not
auditable, which is the whole point of these seats.

`scopeAppIds(actor)` for a `manager` is therefore one indexed query:

```sql
SELECT app_id FROM app_role_history
WHERE user_id = $1 AND effective_to IS NULL AND role IN ('pm','lead')
```

Consequence, stated plainly: a person whose only claim to management is
`assignments.role = 'Project Manager'` has **no** manager scope until an admin
records them as `pm` or `lead` on the app. The People section surfaces exactly
that list at migration time so the gap is visible rather than discovered.
`managesApp()` itself is left alone — the meetings gates that use it keep working
until they are folded into the matrix.

Per-project roles (`assignments.role` free text, `app_role_kind` `pm`/`lead`) are
unchanged and remain orthogonal to global roles. A global `member` who is `pm` on
an app keeps the project-management powers `managesApp()` already grants them
today; the `manager` global role is what additionally grants people-administration
inside that same scope.

### Migration mapping — capability-preserving, not name-preserving

Today's `admin` can clear the database. The faithful map is therefore:

- existing `admin` → **`superadmin`**
- existing `member` → `member`

Mapping `admin` → `admin` would silently strip a power every current admin holds.
Operators demote to `admin`/`manager` from the new panel once the roles exist.

`wouldLeaveNoAdmins` generalizes to `wouldLeaveNoSuperadmins`: the workspace MUST
always retain at least one active `superadmin`.

## Architecture

### Permission layer

One module, two layers. The split is what makes exhaustive testing affordable.

```
// pure, synchronous, zero database access
roleGrants(role: UserRole, action: Action): 'none' | 'own' | 'scoped' | 'all'

// resolves a grant level against a concrete resource
can(actor: Actor, action: Action, resource: Resource): Promise<boolean>
```

Layer 1 is a literal table keyed by `(role, action)`. Every cell is asserted by a
single table-driven test, so "every role × action pair is covered" is one test
file rather than a two-hundred-case slog, and an unfilled cell is a compile error
rather than a silent `false`.

Layer 2 resolves:

- `own` → `resource.ownerId === actor.id`
- `scoped` → `managesApp(actor.id, resource.appId)` or an `app_grants` row
- `all` → `true`
- `none` → `false`

`Action` is a closed string union — `'user.role.grant'`, `'app.delete'`,
`'worklog.write.own'`, `'worklog.correct.request'`, `'absence.approve'`,
`'request.review'`, `'audit.view'`, `'trash.restore'`, `'danger.dbclear'`, and so
on. A typo is a type error, never a permission hole.

Location: `src/features/auth/permissions.ts` (the actor and its role come from
the session, which `features/auth` already owns). `src/features/admin/permissions.ts`
keeps `canEditUser` / `wouldLeaveNoSuperadmins` as admin-specific invariants and
delegates capability questions upward. `src/features/sprints/permissions.ts`
(`canMoveTask`) folds into the matrix as `task.move.own` / `task.move.any`.

**Meetings folds in too (decided 2026-08-19).** The earlier scope freeze on
`src/features/meetings/**` is lifted for this refactor: its three composite gates
become matrix actions rather than string comparisons.

| Today | Becomes |
|---|---|
| `canManageMeeting` (`actions.ts:171`, `ai-actions.ts:578`) — admin \|\| creator \|\| `managesApp` | `meeting.manage` resolved `own` / `scoped` / `all` |
| `canReadMeetingIntel` (`ai-actions.ts:557`) — admin \|\| creator \|\| PM \|\| attendee | `meeting.intel.view`, with attendee as a fourth scope source |
| `canServeKeyframe` (`keyframe-access.ts:34`) — `isAdmin` plus deleted flags | `trash.view` for the deleted-blob case; the flag logic is unchanged |

**The 39 call sites do not move.** The four gates keep their exported names,
parameters and return types exactly; only their bodies change to ask the matrix.
That keeps `src/features/transcription/actions.ts:33` — which calls
`canManageMeeting` and is outside scope — out of the diff entirely, and turns a
55-expression refactor into 16 edits: 4 gate bodies plus 12 inline checks.

**`meeting.admin` preserves the narrow reach.** Seven inline checks
(`rsvp-actions.ts:163`, `:234`, `share-actions.ts:56`, `followup-move-actions.ts:165`,
`:218`, `:73`, `ai-actions.ts:2221`) are creator-or-admin with **no `managesApp`
branch**. Folding them into `meeting.manage` would silently hand every PM three
powers they do not hold today. They get their own action instead, which
deliberately does not consult app scope:

| Role | `meeting.admin` |
|---|---|
| `superadmin`, `admin` | `all` |
| everyone else | `own` — resolves against `meetings.createdBy` |

Behaviour after the refactor is byte-for-byte what it is today. Widening it later
is then a visible one-cell edit, not a side effect.

The seven verbatim copies of `requireAdmin()` (`admin/actions.ts:28`,
`admin/trash-actions.ts:43`, `sprints/actions.ts:58`, `sprints/task-actions.ts:126`,
`apps/actions.ts:21`, `people/actions.ts:31`, `notion/actions.ts:13`) collapse to
one imported guard. Meetings' AI, transcription, and speech behaviour is NOT
touched — only the authorization expressions inside those files.

Enforcement is server-side in every server action and route. Client-side hiding
is presentation only. Sections the actor cannot use MUST NOT render at all —
never render-then-error.

### Change requests

One table serves every proposal, in both directions.

Approval applies the proposed diff inside a transaction and writes `activity_log`
with the reviewer as actor and the requester recorded in `metadata`. Rejection
mutates nothing. Withdrawal is the requester closing their own request.

**Nobody reviews their own request, except a `superadmin` (decided 2026-08-19).**
The reviewer candidate set always excludes the requester. A `superadmin` is the
one exception — they may approve their own request, because the alternative is a
sole-superadmin workspace that can never approve anything. Every self-approval
writes `activity_log` with `selfApproved: true` in `metadata` so a compliance
review can list them in one query. A test asserts both halves: a `manager`
cannot approve their own leave, and a `superadmin` can.

Reviewer routing is policy, not a stored column:

- `entityType = 'worklog'` → routes to the **row's owner**
- everything else → routes to the actor's scope chain: managers of the app, then
  admins, then superadmins

`change_requests` has no delete action of its own — `withdrawn` is a status — so
it is exempted from the soft-delete enforcement scan by name and documented in
place, exactly as `daily_worklogs` and `webauthn_credentials` already are in
`src/db/live.ts`.

**One rule the applier registry acquires as soon as the entity types acquire
invariants.** `buildApplyStatement`
(`src/features/admin/change-request-appliers.ts:58-66`) is
`db.update(table).set(after)` — a generic spread — which is correct for a table
whose columns are independent facts and silently wrong for one whose columns must
be written together. `tasks` becomes the second kind in
`2026-08-20-deadlines-and-bugs-design.md` (`original_due_date` and
`due_changed_count` are stamped only by `applyDueDate`) and in
`2026-08-20-work-substrate-design.md` (`completed_at` only by
`transitionTaskStatus`), so `TABLES.task` becomes an entity-specific applier that
calls those helpers instead of spreading. **Approval is a write path, not an
exemption from one.** The registry keeps its closed-registry discipline; specs A
and C own the two halves of the task applier and each states it.

### Worklog corrections — the self-only rule survives

`daily_worklogs.percent` means "of what I planned today", self-scored. A manager
writing that number converts a self-report into a managed metric, at which point
it stops measuring anything. The settled product rule — worklog writes are
self-only, no admin on-behalf — therefore stands.

Corporate correction power is delivered without breaking it: a manager or editor
opens a **correction request** against the row, and it routes to the owner, who
accepts (their own hand applies the diff) or rejects. The audit trail records
both the proposal and the acceptance.

Consequence for the capability matrix: there is no `worklog.write.any` action at
any role, including `superadmin`. The matrix must make that absence explicit and
a test must assert it.

### Non-daily logging

`src/lib/working-days.ts` already accepts an injectable `isHoliday(iso)`
callback. That parameter is the seam this whole feature hangs from; nothing in
the existing day math needs rewriting.

**`work_schedules`** — effective-dated per user, half-open `[from, to)`, at most
one open row per user, copying the `app_role_history` shape and its unique index
exactly. Weekday fractions stored as jsonb (`{"mon":1,"tue":1,…,"sat":0.5,"sun":0}`).

A row exists ONLY when someone deviates from the studio default (Mon–Fri 1.0,
Saturday 0.5, Sunday 0, as defined in `working-days.ts`). No row means the
default, so the table stays near-empty for a normal team and the default keeps
living in exactly one place.

**`absences`** — self-declared, manager-approved. Kinds: `annual`, `sick`,
`unpaid`, `training`, `other_project`, `no_work_assigned`, `other`. An approved
absence makes each covered day `exempt`. Approved `other_project` days are exempt
— that work was logged in another system and LogPup must not count it as a miss.

Gazetted holidays are NOT modelled here; `lk-holidays.ts` remains their source.

**`org_holidays`** — admin-editable company shutdown days that compose on top of
the gazetted map through the same `isHoliday` callback, so a company holiday no
longer requires a deploy.

**`src/features/worklog/coverage.ts`** — new pure module. Per `(user, date)`:

| Status | Meaning |
|---|---|
| `logged` | A `daily_worklogs` row exists. |
| `off` | Schedule fraction is 0, or the day is a gazetted or org holiday. |
| `exempt` | An approved absence covers the day. |
| `not-yet-due` | Today, or before the person's join date. |
| `missing` | Expected and not logged. |

`missing-days.ts` gains an injectable `isExempt(iso)` mirroring `isHoliday` — it
is extended, not replaced, so `MAX_BACKFILL_DAYS` (10) and the join-date window
keep working exactly as they do now.

**Denominators are mandatory.** Every coverage figure renders as
"18/20 expected days logged · 4 exempt", never a bare percentage. A percentage
without its denominator is the bug this feature exists to fix.

**Backfill window.** Logging or editing a day older than the cutoff opens a
change request rather than writing silently. The cutoff reuses
`MAX_BACKFILL_DAYS`.

**Retroactive leave is unlimited (decided 2026-08-19).** An absence may be filed
for any past date, and approval flips those days to `exempt` immediately, even if
a report already counted them missing. Coverage is always the truth as currently
known, never a frozen snapshot — a sick day entered a week late stops counting
against the person the moment it is approved. The backfill cutoff above governs
*worklog writes*, not absence filing; the two are deliberately different because
a worklog is a claim about work done and an absence is a claim about work not
owed.

Half-day leave is out of scope for this pass (see YAGNI).

## Data model (Postgres via Drizzle)

New enums:

- `change_request_status`: `pending | approved | rejected | withdrawn`
- `change_request_op`: `edit | delete | restore`
- `absence_kind`: `annual | sick | unpaid | training | other_project | no_work_assigned | other`
- `absence_status`: `pending | approved | rejected | withdrawn`

Widened enum:

- `user_role`: `+ superadmin, manager, editor, stakeholder, auditor`

New tables:

**`change_requests`** — `id`, `requesterId`, `entityType`, `entityId`,
`entityLabel`, `operation`, `payload` jsonb (proposed diff), `reason`, `status`,
`reviewerId` nullable, `reviewedAt` nullable, `reviewNote` nullable, `appId`
nullable (scope routing), `createdAt`, `updatedAt`.
Indexes: `(status, createdAt)` for the inbox; `(entityType, entityId)` for the
per-entity trail; `(requesterId, createdAt)` for "my requests".

**`work_schedules`** — `id`, `userId`, `pattern` jsonb, `effectiveFrom`,
`effectiveTo` nullable, `changedBy`, `note` nullable, `createdAt`.
Unique partial index: one open row per user. Index on `(userId, effectiveFrom)`.

**`absences`** — `id`, `userId`, `startDate`, `endDate`, `kind`, `reason`,
`status`, `reviewerId` nullable, `reviewedAt` nullable, `reviewNote` nullable,
`createdBy`, `createdAt`, `updatedAt`.
Indexes: `(userId, startDate)`, `(status, startDate)`.

**`org_holidays`** — `id`, `day` date unique, `name`, `note` nullable,
`createdBy`, `createdAt`.

**`app_grants`** — `id`, `userId`, `appId`, `grantedBy`, `createdAt`. Unique
`(userId, appId)`.

Soft-delete posture — decided, not deferred. **None of the five NEW tables gets a
`deletedAt`.** `SOFT_TABLES` does grow, but for existing tables, not these — see
"Hard deletes convert" below.

`change_requests` and `absences` close via status (`withdrawn`, `rejected`);
`work_schedules` closes via `effectiveTo`. None of the three is ever deleted, so
there is nothing for a trash bin to hold.

`org_holidays` and `app_grants` are revoked by a plain delete plus an
`activity_log` entry. The repo's no-hard-delete rule protects *user content* —
the things a person would be distressed to lose and expects to restore from
Trash. A revoked stakeholder grant is the opposite: an access removal that must
be absolute, for the same reason `webauthn_credentials` is exempted by name. A
restorable grant is a key that can come back from the dead.

### Hard deletes stay hard, and get gated (decided 2026-08-19)

Five hard-delete paths exist outside the trash mechanism. **None of them
converts.** `src/db/live.test.ts`'s `DELETE_ALLOWED_FUNCTIONS` (:296-360) already
names three of them with written rationales, and those rationales are right:

| Path | The repo's stated reason it stays hard |
|---|---|
| `deleteSprintCheckin` (`checkin-actions.ts:174`) | "0% is an answer, absence is the lack of one" — a check-in row means *I answered*; a soft-deleted one would still mean answered. The row has to be removable, not markable. |
| `removeAssignment` (`people/actions.ts:351`) | A `deletedAt` would break the non-partial `assignments_user_app_idx` and make every capacity query over-count. `assignments` **already has a Trash kind**, backed by `assignment_history` `changeKind='removed'` tombstones — a second representation would contradict the first. |
| `deleteFollowup` (`followup-move-actions.ts:186`) | "meeting_followups is deliberately outside the trash." |
| `purge*` (`trash-actions.ts:460`–`604`) | Purge IS the trash bin's floor. |
| `clearTestData` (`admin/actions.ts:34`) | The danger zone. |

What changes is **who may reach them**, not what they do. Each gets a capability
and an `activity_log` entry:

| Path | Capability |
|---|---|
| `deleteSprintCheckin` | `checkin.delete` (`own` for everyone, `scoped` for manager+) |
| `deleteFollowup` | `followup.delete` (`admin` and up; `editor` gets a change request) |
| `removeAssignment` | `app.assign` |
| `purge*` | `trash.purge` — `superadmin` only |
| `clearTestData` | `danger.dbclear` — `superadmin` only |

`SOFT_TABLES` is **untouched by this pass** — whatever it holds when this lands,
it holds after. (It has moved since: `apps` joined it in
`drizzle/0043_app_soft_delete.sql`, and `personal_items` joins it in
`2026-08-20-personal-and-organizer-design.md`. Neither is this pass's business,
which is the point.) `live.ts`, `live.test.ts`, the Trash grouping, and the three
delete statements are untouched here. Delete
semantics are a separate argument from access control, and mixing them would put
a 47-file query retarget in the same diff as the permission rewrite that reads
those same queries.

`live.test.ts` needs no change at all. Its `DELETE_RE` scan is keyed on file and
function paths, not on whether a table has a `deletedAt` — so the new plain
deletes for `org_holidays` and `app_grants` (access revocations, not content) DO
need naming, as two new `DELETE_ALLOWED_FUNCTIONS` entries with their rationale
written in the house style. That is the only edit to that file. Each of the five tables carries a comment stating which of the three
closure mechanisms it uses and why, in the style of the existing schema comments.

## Migrations

Repo rule: `drizzle-kit generate` is forbidden until the snapshot chain is
repaired. These are hand-written SQL plus journal entries, modelled on `0031`.

**Migration numbers are allocated at merge time against then-current `main`, not
in advance**; journal `when` values must strictly increase. An earlier version of
this document named its numbers ahead of the work, and every one of them was
wrong within days — which is why all five of the specs that compose with this one
(`2026-08-20-work-substrate-design.md` and its siblings A–E) refuse to name a
number and each cite the same failure. A number written into a branch is a merge
conflict with a plausible-looking resolution.

Three migrations, one concern each, in this order:

1. **`user_role` expand** — enum widening only. Postgres cannot use a new enum
   value in the same transaction that adds it, so this migration ships alone and
   adds nothing else.
2. **RBAC tables** — the five new tables and four new enums.
3. **`admin` → `superadmin`** — remap existing `admin` rows.

*Historical note, so a reader is not sent looking for files that do not exist:*
this work shipped as `drizzle/0037_user_role_expand.sql`,
`drizzle/0038_rbac_tables.sql` and `drizzle/0039_admin_to_superadmin.sql`. The
numbers this document originally reserved — 0035 and 0036 — went to
`0035_ai_usage_events` and `0036_key_sharing_prefs` while this work was in
flight.

Every migration verified against `information_schema`, never the runner's exit
code — `npm run db:migrate` has reported success while applying nothing. Human
approval required before any migration runs against any database.

## Pages & flows

`/admin` stops being one page and becomes a section area with nav in
`src/app/(app)/admin/layout.tsx`. Each section is capability-guarded; a section
the actor lacks does not render in the nav.

| Route | Contents | Minimum capability |
|---|---|---|
| `/admin` | Overview: coverage with denominators, pending-approval counts, org health | `admin.view` |
| `/admin/people` | Roles, status, schedules, scope, org tags | `user.view.all` |
| `/admin/approvals` | Unified inbox: signups + change requests + absence requests | `request.review` |
| `/admin/apps` | Apps, assignments, pm/lead, stakeholder grants | `app.edit` |
| `/admin/absences` | Team calendar, absence review, work schedules, org holidays | `absence.approve` |
| `/admin/audit` | `activity_log` reader with actor/entity/date filters | `audit.view` |
| `/admin/trash` | Existing trash and restore | `trash.view` |
| `/admin/danger` | DB clear, structurally separated | `danger.dbclear` |

Flows:

- **Editor proposes a delete** → change request created, requester sees it under
  "my requests", reviewer sees it in the inbox, approval applies and logs.
- **Manager proposes a worklog correction** → routes to the owner, who accepts or
  rejects from their own worklog surface.
- **Person books leave** → absence created `pending`, manager approves, covered
  days flip to `exempt` and stop counting as missing.
- **Stakeholder signs in** → sees only granted apps; every other route 404s.
- **Manager books leave** → routes to an `admin`, never back to themselves.

## UX

Design system is "watchdog calm" (`docs/superpowers/specs/2026-08-10-logpup-design.md`).
Build with the `designing-ui` skill and polish with `craft`.

- Empty, loading, and error states for every surface. Skeletons, not spinners.
- Suspense-split with controls rendering before data — `people/history` is the
  pattern to copy.
- Bilingual copy (Sinhala + English) where the existing surfaces are bilingual;
  never force-translate.
- Identity colours come from `event-color.ts`. No second hash, no new palette.
- Destructive controls render only for actors who hold the capability.
- Every coverage figure shows numerator and denominator.

## Error handling

- Server actions return the existing `ActionResult` shape; permission denial is a
  refusal result, not a thrown exception, except on routes where 404 is the
  correct answer (a stakeholder probing `/admin` must not learn it exists).
- Change-request approval is transactional: diff application and `activity_log`
  write succeed together or neither happens.
- An approval whose target changed since the request was filed MUST fail loudly
  with a conflict message rather than clobbering the newer state.
- Absence approval on a day already logged does not delete the log — the day
  reads `logged`, which outranks `exempt`.

## Testing

TDD via `superpowers:test-driven-development` for the two pure cores, which are
where the correctness lives:

1. **Capability matrix** — one table-driven test asserting every `(role, action)`
   cell, both what each role CAN and CANNOT do. Explicit assertion that
   `worklog.write.any` exists for nobody, `superadmin` included.
2. **Coverage calculator** — a part-time user with a Saturday, a gazetted Poya
   day, an org holiday, an approved `other_project` absence, and a genuinely
   missing day, in one window, asserting all five statuses and the denominator.

Integration-level, following existing `permissions.test.ts` and `trash-*.test.ts`
patterns:

- An `editor` calling a delete server action directly (bypassing the UI) creates
  a pending request and mutates nothing.
- A `stakeholder` calling any admin or people-directory action is refused
  server-side.
- Approving a stale change request fails with a conflict.
- `grep -rn "role === 'admin'" src` returns hits only inside the permission
  module.

## Build order

1. Capability matrix + scope resolver, with tests. No UI. Refactor the 48
   existing call sites onto `can()`.
2. The three migrations above, numbered at merge time, applied only after human
   approval and verified via `information_schema`.
3. Change-request table, actions, and approval application.
4. Schedules, absences, org holidays, and `coverage.ts`; extend `missing-days.ts`.
5. `/admin` section layout and the eight sections.
6. Verification pass, then code review.

## Out of scope (YAGNI)

- Half-day leave. Absences are whole days this pass.
- Multi-country holiday calendars. `LK_HOLIDAYS` plus `org_holidays` covers the
  studio; a second country is a later table, not a speculative column now.
- A `contractor` role. It is `member` plus a restricted grant until a real user
  needs the label.
- Time-boxed or expiring role grants.
- Delegation ("approve on my behalf while I am away").
- Any change to meetings *behaviour* — AI, transcription, speech, notes, or UI.
  Meetings' authorization expressions ARE in scope (see "Meetings folds in too");
  nothing else in that feature is.
- Resolving the still-open "private notes" question — unrelated, and it must not
  ride along on these migrations.
