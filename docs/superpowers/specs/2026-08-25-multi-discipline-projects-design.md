# Multi-discipline projects — design

**Date:** 2026-08-25
**Status:** approved in brainstorming, not yet implemented
**Supersedes:** nothing. Extends the "watchdog calm" product into three new engineering disciplines.

## Problem

LogPup models exactly one kind of work: a software app. The studio also runs
**EPC** (engineering / procurement / construction), **hardware**, and
**networking** projects, and there are real jobs of those kinds waiting to be
entered. Today they can only be entered by lying — calling a substation build
an "app", a construction phase a "sprint", and a 40%-installed cable run
"in progress".

A second, live defect surfaced during this design and belongs to the same
subsystem: **nothing happens when a sprint ends.** It is documented in
§ WS3 and fixed there.

## What the codebase already gets right

Recon (7 parallel readers, `src/` in full) found the spine is far more neutral
than its vocabulary suggests. These need **zero domain change**:

- **Finance, entirely** — `rate_cards`, `person_rates`, `project_value`
  (`schema.ts:1966-2064`). Role rates key off `users.title` free text (`rate_cards.role`,
  `schema.ts:1968`); person overrides key off `users.id` by hard FK
  (`person_rates.userId`, `schema.ts:2011`); project value keys off `apps.id`
  (`schema.ts:2048`). `cost.ts:508` (`effortMix<C extends string>`, rationale
  at `:495-499`) is generic over the category on
  purpose so finance never re-declares a category list.
- **The capability matrix mechanism** — `can()` (`capabilities.ts:413-425`)
  does not know what an app *is*. Only the eight `'app.*'` action *names*
  (`capabilities.ts:97-100,:108-111`) plus `'danger.app.reset'` (`:251`, which
  a naive `app.*` sweep will miss) are software-flavoured, and only
  cosmetically.
- **Assignments / allocation / capacity** — person x project x percent over a
  half-open interval is generic staffing.
- **Soft delete, trash, write-gate, meeting visibility** — table-shaped, not
  domain-shaped.
- **Board view-model and ranking** — `board-view.ts:224-381` and
  `task-rank.ts` take no sprint parameter at all. `roadmap-layout.ts:60-90`
  `packRows` is generic interval packing.
- **Change-request routing** — knows only owner, requester, appId.
- **Activity verbs** — deliberately open (`activity/format.ts:4-9`, map at `:10-24`).

Only **two** columns on `apps` are software: `repoUrl` and `techTags`
(`schema.ts:224-225`).

The print route (`app/print/meetings/[id]/page.tsx:892`) and the trash card
(`admin/components/trash-card-logic.ts:32`) **already say "Project"**. The
vocabulary is mid-split already.

## What is actually welded on

1. **Three task states, `'done'` the only terminal one.** `taskStatus`
   (`schema.ts:87`) is redeclared independently **13x** — 5 named
   (`board-view.ts:30`, `task-actions.ts:22`, `change-request-appliers.ts:155`,
   `task-workload.ts:28`, `followups.ts:360`; three of them all called
   `TASK_STATUSES`) plus 8 anonymous inline unions (`plan-read.ts:205`,
   `board-bulk-bar.tsx:19`, `entry-queries.ts:110`, `ask-derivation.ts:34`,
   `ai-actions.ts:198`, `ai-actions.ts:2836`, `notes.ts:325`, `planner.ts:145`), structurally baked as
   object keys in 8+ types, and `'done'` appears **124 times across 43
   non-test files** — of which only ~48 are `task_status` (see WS0) —
   including raw SQL in 2 feature folders
   (`apps/contribution-queries.ts:71-72`, `people/queries.ts:849`) and one
   partial DB index (`schema.ts:484-486`). The code already admits the cost:
   `meetings/ask-derivation.ts:99-101` says outright *"there IS no blocked
   state in this schema"* — and the same admission is copy-pasted at
   `meetings/planner.ts:417-421`, so WS2 must revise both and substitutes a proxy. **This is the load-bearing
   blocker, not the rename.**
2. **Mandatory calendar time-box on every container.** `sprints.startDate` /
   `endDate` are both `.notNull()` (`schema.ts:395-396`), re-required in zod
   twice, and status is derived from date containment.
3. **At most one active container per project.** `sprints/actions.ts:100-116`
   and `:341-359` demote the existing active sprint in the same `db.batch`.
   EPC runs foundations || MEP || facade concurrently; hardware runs EVT
   rework during DVT; rollout waves overlap. All three violate this.
4. **Every task weighs exactly 1.** No `estimate`, `weight`, or `quantity`
   column exists. `completionPct = done/total` (`app-health.ts:137-140`). EPC
   reports percent complete against *installed quantity*.
5. **No hierarchy.** No `parent_id`, no `depends_on` anywhere — so no WBS
   rollup, no float, no critical path.

## Decisions taken

| # | Decision | Chosen |
|---|---|---|
| 1 | Spine | `apps` becomes the generic project table + required `kind` |
| 2 | Vocabulary | user-visible "App" becomes "Project"; `/apps` -> `/projects` + 308 |
| 3 | Work model | per-kind work period; `tasks` stays the universal item |
| 4 | Depth | all three registers, EPC first |
| 5 | Task states | widen to `todo|blocked|in_progress|in_review|rework|done|cancelled` |
| 6 | Progress | nullable `weight` + `uom` + `qtyComplete`; falls back to count |
| 7 | Rollout | the `isTerminal()` seam lands first, alone, verified |
| 8 | Period end | team reports, PM closes; nothing auto-closes |
| 9 | Unfinished work | PM chooses per task, default roll-over, carryover counted |
| 10 | Extensions | first-class, with reason + count + original end date |
| 11 | Nudging | notify assignees, persistent banner, block next period, feed meeting AI |
| 12 | Register permissions | auditable roles via `app_role_history`, **not** free text |
| 13 | Discipline seat | new `officer` role in `user_role`; register actions only |
| 14 | `completed_at` | cancelling never stamps it and never clears it |

### Note on decision 12

The brainstorm answer was "new per-discipline roles". The naive reading —
add `procurement officer` to the free-text regex in `lib/project-roles.ts` —
is **refused**, because `capabilities.ts:392-399` already ruled on exactly
this:

> NOT `managesApp()`. That helper regex-matches the free-text
> `assignments.role` string [...] Scope decided by whatever somebody typed
> into an assignment is not auditable, and auditability is the whole reason
> these seats exist.

So per-discipline roles extend `app_role_kind` (today `pm | lead`) and are
recorded in `app_role_history`, which is already append-only, already
as-of-queryable, and already the scope source for the `manager` seat.
`lib/project-roles.ts` stays exactly as it is — but **not** because it is
badge-only. It is the free-text definition behind `managesApp`/`managesAnyApp`
(`apps/project-manager.ts:34,:63`), which are live permission gates at
`apps/actions.ts:379`, `meetings/actions.ts:276`,
`meetings/ai-actions.ts:586,:621` and `meetings/load-actions.ts:109`, as its
own docblock records (`project-roles.ts:11-14`). That is precisely why no
discipline term may be added to its regexes: doing so would grant app-edit and
meeting-management rights through an unauditable typed string — the exact
failure decision 12 exists to prevent. Only its `ProjectRoleTone` consumers
are badge-only.

## Architecture

### The kind discriminator

```
project_kind = 'software' | 'epc' | 'hardware' | 'networking'
```

`apps.kind` is `NOT NULL DEFAULT 'software'` — correct for every existing row,
and the default is what keeps 4221 tests (242 files, measured on 817bf89 —
re-measure at branch point) and the e2e `beforeAll` insert
(`e2e/meeting-load.spec.ts:46-49`) green. The zod create schema gets the field
with `.default('software')`; the `.partial()` update schema gets it **without**
a default, because `update-input.test.ts:5-11,:13-19,:21-27,:29-36` assert exact
`toEqual` on the produced `set` object, and `:38-44` additionally depends on
an empty `set` being rejected — a default there makes `buildAppUpdate({})`
return `ok: true` and silently defeats the "Nothing to update" guard at
`update-input.ts:47`. That last one is a behaviour change, not a fixture
mismatch.

Per-kind fields are nullable columns on the same row, not a JSON blob — they
are queried, filtered, and displayed, and a blob is unindexable and untypeable.

| kind | fields |
|---|---|
| software | `repoUrl`, `techTags` (existing) |
| epc | `siteLocation`, `contractValue`, `clientRef` |
| hardware | `targetRevision`, `productFamily` |
| networking | `siteCount`, `regionRef` |

### Register permission model

New `app_role_kind` values: `procurement_officer`, `site_engineer`,
`hardware_lead` — recorded in `app_role_history`, which is already
append-only and as-of-queryable. A new `officer` seat in `user_role` reads
scope from those rows (see below). New capability actions in the matrix
(`capabilities.ts`), each `S` (scope) for `manager` and `officer`, `N` for
everyone below:

```
procurement.view / procurement.write
deliverable.view / deliverable.write
bom.view / bom.write
netsite.view / netsite.write
cutover.approve
```

Scope resolution is **single-source per role, not a union**: `scopeSourceFor`
(`capabilities.ts:390-411`) maps each `UserRole` to exactly one of
`app_role_history | assignments | app_grants | none`, and `loadActor`
(`actor.ts:71-91`) runs exactly one query for it. Only `manager` reads
`app_role_history`, and that query hard-filters
`inArray(appRoleHistory.role, ['pm','lead'])` (`actor.ts:80`).

Granting a `procurement_officer` project scope therefore needs three changes,
not zero:

(a) widen the hardcoded `['pm','lead']` filter at `actor.ts:80` to a list
    derived from `app_role_kind`;
(b) decide which `UserRole` a discipline officer holds — `user_role`
    (`schema.ts:16-24`) has no procurement seat, and seating them as
    `manager` hands them every other `manager: S` cell (`app.edit`,
    `app.archive`, `app.assign`, `app.role.assign`,
    `app.grant.stakeholder`, `absence.approve`);
(c) if that seat is `manager`, add a per-action discriminator, because
    `manager` scope is today one flat set shared by every `manager: S` action.

`actor.test.ts:5-9` pins the current single-source exclusivity by name and
must be extended in the same commit.

**(b) is decided: a new `officer` seat in `user_role`**, sitting between
`manager` and `editor`. `scopeSourceFor('officer')` returns
`app_role_history`, filtered to the discipline roles rather than
`['pm','lead']`. The officer seat is granted the register actions at scope
level and **nothing else** — explicitly `N` for `app.edit`, `app.archive`,
`app.assign`, `app.role.assign`, `app.grant.stakeholder` and
`absence.approve`. Rejected alternative: seating them as `manager`, because
`manager` scope is one flat set shared by every `manager: S` action, so it
would hand a procurement officer all six of those.

Two costs this seat carries, both mandatory in the same commit:

- **Every action row in the capability matrix gains an `officer` column.**
  There is no default; an omitted cell is a type error, which is the point.
- **`registry.test.ts:512` fires.** It is a compile-time bidirectional-extends
  check pinning `PaletteContext['user']['role']` to the exact role union, and
  it exists precisely because `role === 'admin'` keeps compiling and keeps
  passing when the enum widens — it just goes silently false for every new
  role. It has already fired once for this reason. Widen it deliberately;
  never by loosening the assertion.

### Registers

Each register table carries `appId`, joining the 16 tables that already
carry one (`schema.ts:295,323,361,392,411,510,575,1118,1151,1415,1553,1667,1791,1824,1848,2048`), soft-delete
columns, and registers itself with ⌘K via its own `commands.ts` +
`search-providers.ts` — `registry.test.ts:157,230` **fails a feature that
does neither**, and `:283` additionally requires every provider to name
`effectiveGrant`.

**EPC — procurement package**: `ref`, `title`, `vendor`, `status`
(`draft|rfq|quoted|po_placed|in_transit|delivered|accepted`), `rfqDate`,
`poDate`, `poValue`, `eta`, `needByDate`, `longLead` boolean.
`needByDate` vs `eta` is the risk signal.

**EPC — deliverable register**: `number`, `title`, `discipline`, `revision`,
`issuedFor` (`IFR|IFA|IFC`), `dueDate`, `issuedDate`.

**Hardware — BOM line**: `partNo`, `description`, `qtyRequired`,
`qtyReceived`, `supplier`, `leadTimeDays`, `unitCost`, `moq`, `longLead`.
Partial quantities are the whole point; this is why a BOM cannot be tasks.

**Hardware — revision**: `rev`, `status`, `builtQty`, `testedQty`, `gate`.

**Networking — site**: `code`, `address`, `state`
(`planned|surveyed|cabled|configured|live`), `regionRef`.
**device**: `hostname`, `model`, `mgmtIp`, `siteId`.
**cutover window**: `start`, `end`, `rollbackPlan`, `approvedBy`.

Tasks link to a register row through one nullable `registerRef` pair
(`registerKind` + `registerId`) rather than four nullable FKs — four FKs on
`tasks` for mutually-exclusive parents is four indexes and four join paths
for one relationship.

### Finance roll-up

`procurementPackage.poValue` and `bomLine.qtyRequired * unitCost` feed the
existing `project_value` / cost surfaces. Committed spend becomes derived
rather than typed. No finance table changes shape.

### AI

Six prompts say "software team" verbatim
(`meetings/ai-actions.ts:1097,:1447,:1670`, `sprints/suggest-actions.ts:94`,
`sprints/paste-actions.ts:83`, `speech/actions.ts:37`). A seventh,
`apps/actions.ts:99`, is software-flavoured in different phrasing ("the apps a
software studio runs") and needs the same treatment. These become
kind-parameterised. The code-switching word list
(`"sprint", "deploy", "bug", "PR", "server"`) is duplicated across **seven**
prompts in three different shapes. Verbatim five-term:
`ai-actions.ts:1106-1109`, `ai-actions.ts:1457-1459`,
`transcription/live-protocol.ts:73`. Four terms, no "server":
`speech/actions.ts:41`. Slash-delimited three-term: `ai-actions.ts:1682-1684`.
Unquoted three-term: `meetings/assistant-actions.ts:195-197`. Unquoted
four-term incl. "worklog": `intel/prompt.ts:58-60`. Because four sites are
paraphrases, **the extraction is done by reading each prompt, not by
grepping**. It is extracted to one per-kind vocabulary module first, then
widened. The glossary field label
(`"term": "software/technical term used"`, `ai-actions.ts:1132,:1715`) becomes
discipline-neutral.

Deterministic matchers that feed AI surfaces get per-kind branches, not
replacements: `lib/agenda-topics.ts:64-375` (19 buckets, 7 explicitly
engineering), `lib/job-roles.ts:17-44` (already hand-stretched with a
hardware/EMC group at `:47`), `worklog/entry-language.ts:44-78`.

**Caution recorded for the register AI paths.** A sibling session probed the
Gemini `auth_tokens` endpoint and found the repo's status classification
wrong. Any AI call added by these registers must use the corrected mapping,
**not** the pattern already in the tree:

| status | actual meaning |
|---|---|
| `403` | **no credential reached Google** ("unregistered callers") — our bug, not the user's key |
| `400` + `API_KEY_INVALID` | the key really is bad (**not** 401/403) |
| `400` + `FAILED_PRECONDITION` | billing or region |
| `429` | quota |

The existing code maps `401 || 403` to "your key was rejected", which reports
a dropped-header bug as the user's key being bad. Two further traps from the
same investigation: an error branch that shadows `lastBadMessage` silently
discards a 400 whenever any key in the pool also 403s — that is how one
regression stayed invisible — and blaming a key at model level for a 403
poisons `readiness.ts` across every AI feature. Defer key-level blame, the way
`callGeminiCore` already does. Also corrected: Live **is** free-tier on both
models; an earlier note in this repo's history saying otherwise is wrong.

## Workstreams

Each ships as its own spec + plan + verified commit.

### WS0 — the terminal-status seam

Introduce `isTerminal(status)` and `OPEN_STATUSES` in
`features/sprints/task-status.ts` and route the **`task_status` comparisons
only** through them. No behaviour change, no migration, no enum change.

`features/sprints/task-status.ts` **already exists** (89 lines, exporting
`TaskStatusPatch` and `transitionTaskStatus`) — the two helpers are ADDED to
it, not a new module.

`'done'` appears **124 times across 43 non-test files**, but the literal is
shared by four unrelated enums that must **not** be routed through a task
helper — none of them gains `cancelled` in WS2:

  - `sprint_status` (`sprint-date-range.ts:131`) — incl. the demotion writes
    at `actions.ts:111,:350` and the derivations at `:148,:170`
  - `MeterPhase` (`gemini/ai-meter.ts:25`)
  - `SegmentPhase`/`SegmentState` (`meetings/segment-queue.ts:26`)
  - `DONE_STATUSES` (`lib/escalation.ts:109`), a cross-entity set that
    already contains `archived|resolved|cancelled`

Only ~48 of the 124 are `task_status`; roughly 36 further occurrences are
comment prose. **The sweep is done by reading each site, never by grepping the
literal** — a literal sweep here breaks the sprint demotion path, the AI
meter, and the recording uploader. WS4 renames the sprint enum separately.

The discipline already exists in exactly one place and is the model:
`checkins.ts:29-33` counts not-`'done'` as unfinished *specifically* so a new
status defaults to "unfinished" rather than silently inflating percentages.

**Lands first, alone, verified green** (`tsc` clean + 4221 vitest across 242 files, re-measured at branch point + eslint).
A sibling session is waiting on this commit to rebase `task-actions.ts`
multi-assignee work onto it — seam-then-feature merges cleanly; the reverse
conflicts in the same function bodies.

### WS1 — the project spine

`apps.kind` + per-kind fields + the vocabulary sweep.

- 284 `/apps` string literals across 107 non-test files (+70 in tests). Some
  are **emitted into AI prompt text** (`intel/context-pack.ts:288,454,476`,
  `signals.ts:284,391`) — `prompt.ts:57` instructs the model to write only
  routes present in the facts, so a stale route there produces a dead link in
  generated prose.
- ~225 user-visible copy occurrences + ~28 nav labels / titles / headings.
  `src/components/shell/nav-items.ts:50` alone feeds sidebar, mobile sheet,
  the shortcuts overlay, `G A` (derived at `search/registry/commands.ts:122`),
  and a ⌘K row — 8 importers in total.
  `activity/format.ts:26-28` prints raw `'app'` into feed sentences with no
  copy string to grep.
- `/apps` and `/apps/[slug]` gain permanent redirects to `/projects`.
  Slugs stay **globally unique** — no per-kind nesting, so changing a
  project's kind never changes its URL.
- Two guard tests fight the directory move **by construction** and are fixed
  in the same commit: `live.test.ts:163` (every ALLOWLIST path must exist on
  disk) and `registry.test.ts:440` (`NO_COMMANDS`/`NO_SEARCH` keys must name
  real feature dirs). `lib/tracked-imports.test.ts` additionally requires
  every new module to be `git add`ed — it exists because unstaged modules
  passed tsc, vitest, eslint and `next build` and died on a fresh clone five
  times in one evening.

### WS2 — widened lifecycle + weight

Requires WS0.

```
task_status = todo | blocked | in_progress | in_review | rework | done | cancelled
isTerminal  = done | cancelled
```

`transitionTaskStatus` (`task-status.ts:72-73`) hard-codes `'done'` as the
only terminal state when stamping `completed_at`:
`const wasDone = current === 'done'; const isDone = next === 'done'`.
Widening `isTerminal` means a task entering `cancelled` gets **no**
`completedAt` stamp, and a task moving `done -> cancelled` gets
`completedAt: null` — **silently erasing a real completion time**. That
file's own docblock (`:1-29`) states a bad `completed_at` write is a hole that
cannot be reconstructed, and names the writers that all inherit the answer
(createTask, updateTask, moveTaskOnBoard, bulkUpdateTasks, plus the
change-request applier).

**Decided: cancelling never stamps `completed_at` and never clears it.**
A task entering `cancelled` from a non-terminal state gets no stamp; a task
moving `done -> cancelled` **keeps** its existing stamp, because it really was
finished on that date and no other record of when survives. Clearing stays
tied to *reopening* — a move from any terminal state back to a non-terminal
one clears the stamp, exactly as `done -> in_progress` does today. So the rule
generalises from `next === 'done'` to `isTerminal(next)` for the clear
condition, and from `current === 'done'` to `current === 'done'` — unchanged —
for the stamp condition. Both branches get a test naming the erasure they
prevent.

Plus nullable `weight`, `uom`, `qtyComplete` on `tasks`. Progress becomes
weight-aware **where weight is set** and falls back to `done/total` where it
is null — which is every existing row, so no project changes behaviour.

The **one** partial index embedding `status <> 'done'` —
`tasks_assignee_due_idx` (`schema.ts:484-486`, created by
`drizzle/0057_work_substrate.sql:29`) — is dropped and rebuilt against
`isTerminal`'s set. `tasks_app_sprint_sort_idx` (`schema.ts:480`) is partial
on `deleted_at is null` only and is untouched.

### WS3 — period closeout and extensions

**The live defect.** Verified: when a sprint's end date passes, *no write
happens*. The condition is already detected loudly at read time — `appHealth`
adds its largest single penalty (`SPRINT_OVERRUN_POINTS = 40`,
`app-health.ts:209`, applied at `:261-267`) with the reason "ended N days ago
and is still open", `plan-read.ts:137-146` reads the sprint as `overdue`, and
`app-card.tsx:118,:241` renders "Nd over" in destructive red. What never
happens is a state transition, a notification, or any record of what was left
unfinished. **WS3's new `ended` state must keep all three of those signals
firing** — see below.

- No cron closes it — the only two crons are `backup` and `notify-tick`
  (`vercel.json:6-9`). `backup` reads every sprint row into its snapshot
  (`admin/backup.ts:42`) but writes nothing; `notify-tick` never touches the
  table.
- `initialSprintStatus` (`sprint-date-range.ts:146`) is *persisted* only at
  creation (`actions.ts:92`). Its only other caller is `isSprintRunningNow`
  (`sprint-date-range.ts:171`), which recomputes it at read time and never
  writes it back.
- **Three** writes set a sprint to `done`: `actions.ts:111` and `:350` are the
  single-active-per-project demotion, and `actions.ts:361` is a deliberate
  manual close reachable from the sprint status select
  (`sprint-status-select.tsx:19,:29`) and the edit dialog — a variable write
  (`.set({ status })`) that a literal grep for `status: 'done'` misses.
  **Nothing closes a sprint automatically** — it closes only when a person
  picks "Done", or as a side effect of someone starting the next one.
  Decision 8's "PM closes" half therefore already exists as a bare status
  flip; WS3 replaces it with the closeout ritual rather than inventing it.
- `isSprintRunningNow` returns `true` unconditionally for `status ==='active'`
  (`sprint-date-range.ts:169`), so every surface derived from it —
  `pickCurrentSprint` (`app-health.ts:152-162`) and its callers — reads an
  expired active sprint as running forever, while every surface derived from
  `sprintDayProgress().phase` (`app-health.ts:121-122`) already reads it as
  `ended`. **The two disagree.**
- No `closeSprint` action exists. No carryover logic exists anywhere in `src/`.
- `updateSprintDates` is a plain edit: no reason, no count, no history.

Observed in production: a project showing `0d left`, `0 done / 2 in progress`,
still badged **Active**, untouched for 6 days.

`sprint_checkins` (`schema.ts:1453`) already holds a per-person `percent` +
`note`, uniquely indexed `(sprint_id, user_id)` — but it is a mid-sprint
standup tool with no end-of-period trigger. Closeout **reuses this table**
rather than inventing a second one.

Design:

- A new period state `ended` sits between `active` and `done`. An expired
  period leaves `active` on the daily tick and enters `ended` — so it can
  never again read as running — but is **not** closed.
- On the end date, `notify-tick` (already daily at 09:00 Colombo) notifies
  every assignee holding non-terminal tasks: *done / what's left / how many
  more days*. The answer upserts into `sprint_checkins`.
- The PM gets a closeout card listing every response and every unfinished
  task, each defaulting to **roll over to next period**, overridable per task
  to *back to backlog* or *cancel*. `cancelled` is why this needs WS2.
- Carryover is recorded on the task (`carriedOverCount`, first period kept),
  making *"this has slipped 3 sprints"* a real query for the first time.
- **Extension is its own action**: new end date + reason + requester +
  approver, with `originalEndDate` and `extensionCount` on the period —
  mirroring `tasks.originalDueDate` (`schema.ts:457`) / `dueChangedCount`
  (`schema.ts:461`), which already solved the *date-provenance* half of this
  for task deadlines. The reason / requester / approver half is new: `tasks`
  records no reason for a date move.
- An `ended`-but-unclosed period shows a persistent banner on the project
  board and dashboard, and **blocks creating or activating the next period**.
- Closeout responses feed the next meeting's prep, the way follow-up questions
  already surface.

The display bug is deliberately **not** hotfixed ahead of this workstream.
`isSprintRunningNow` returning `true` for an expired active sprint is
**load-bearing**: `pickCurrentSprint` (`app-health.ts:152-162`) is built on
it, and `appHealth`'s 40-point overrun flag (`app-health.ts:261`) fires only
on the sprint it returns — as `pickCurrentSprint`'s own docstring records
(`app-health.ts:142-147`). Making the predicate honest on its own would drop
expired sprints out of every "running now" surface **and silence the loudest
existing signal that one is overdue**. Introducing `ended` must therefore
re-point `pickCurrentSprint` and the `appHealth` guard at the new state in the
same commit. The symptom and the cure ship together.

### WS4 — work-period generalisation

`sprints` becomes the generic period container:

- `startDate` / `endDate` become **nullable** (a milestone has no duration;
  today `sprintDayProgress` clamps `totalDays` to `Math.max(...,1)` at
  `app-health.ts:119` and so reads "100% elapsed" forever).
- The single-active demotion (`actions.ts:100-116`, `:341-359`) is removed —
  concurrent periods become legal. `pickCurrentSprint` (`app-health.ts:152-162`)
  must return a set, not a single. `roadmap-layout.ts:60-90` was already
  built to draw overlapping bands.
- Per-kind vocabulary: **Sprint** / **Phase** / **Revision** / **Wave**.
  Storage is one table; only the label and the board header change.

### WS5 — EPC registers (procurement + deliverables)
### WS6 — hardware (BOM + revisions)
### WS7 — networking (sites + devices + cutover)

Shape defined under *Registers* above. Each is a self-contained feature dir
with its own ⌘K wiring, activity verbs, and permission actions.

## Sequencing

```
WS0 seam ──▶ WS1 spine ──▶ WS2 lifecycle+weight ──▶ WS3 closeout ──▶ WS4 periods ──▶ WS5 EPC ──▶ WS6 HW ──▶ WS7 net
```

WS1 is placed second, ahead of the lifecycle work, because real EPC jobs are
waiting to be entered and WS1 alone makes them enterable — name, team, PM,
meetings, tasks, costs. The registers refine what is already usable.

## Migrations

**Hard constraints, from `.claude/skills/logpup-development`:**

- `drizzle-kit generate` is **unusable** — 63 applied migrations, journal
  high-water `idx 63`, `idx 11` missing, and only 28 snapshots (none >= 0031).
  Generate would diff against a stale snapshot and re-create existing tables
  **without** `IF NOT EXISTS`. Every migration here is **hand-written SQL +
  journal entry**; 0031 is the model.
- Never edit an applied `.sql`, not even a comment — `db:status` compares
  `sha256(file)` to the ledger.
- `--> statement-breakpoint` between statements, never inside a comment.
- Verify with `information_schema`, never the runner's exit code —
  `db:migrate` has reported success while applying nothing.
- Slot allocation, confirmed 2026-08-25 with the sibling session **while it
  was mid-write**: **0064** (`task_assignees`) and **0066**
  (`meetings.next_meeting_at`) are theirs; **0065** is the first slot for this
  work. Subsequent migrations take **0067 onward** — 0066 is spoken for, so
  this work is *not* contiguous and must not assume `last + 1`.
  The journal is re-read immediately before **each** write, across every
  worktree, and a writer that finds its slot taken **aborts rather than
  renumbers** — renumbering mid-write is how the existing `idx 11` gap was
  created.
- **`npm run db:migrate` is not run by this session** — it is classifier-blocked
  and must be run by the user.

A declared-but-unmigrated column is a **live outage** on the shared dev DB, not
a warning: `scripts/check-schema-drift.ts:19-22` deliberately **exits 0**.
Schema declaration and applied migration land together or not at all.

## Testing

- **Zero existing tests fail from adding `kind` alone.** `live.test.ts:565` is
  the only schema-reflecting test and it looks only for `deletedAt`. That is
  **exposure, not safety** — every workstream adds the assertions its own
  invariant needs.
- Known breakage to fix in-commit: `apps/create-input.test.ts:22-25,:32-38`
  (red unless the zod field carries a default); `update-input.test.ts:5-11,:29-36`
  (red *if* it gets one); `create-input.test.ts:7-10,12-15,17-20,27-30` stay
  green **for the wrong reason** and must be re-pointed.
- Rename breakage is enumerated: `activity/format.test.ts:44,:104`,
  `admin/bulk-logic.test.ts:135,146,155,161,211`, `apps/activity.test.ts:106`,
  `people/allocation-history.test.ts:359`,
  `intel/signals.test.ts:179,187,198,207,264,436`,
  `intel/briefing-fallback.test.ts:216`, `worklog/entries.test.ts:100`,
  `apps/tabs.test.ts:47-78`, `apps/browse.test.ts:98-240`,
  `registry.test.ts:480,524,530,539,547`, `admin/trash-queries.test.ts:63-70`,
  `notifications/entity-kinds.test.ts:28,30,54`,
  `worklog/note-app-tags.test.ts:18-59`.
- **e2e hard break**: `e2e/meeting-load.spec.ts:46-49` inserts an app directly;
  a `kind` with no DB default throws Postgres 23502 in `beforeAll` and takes
  down all 5 tests. The column default prevents this. UI create-path breakage
  at `e2e/smoke.spec.ts:66-84` (cascading to `:86`, `:112`) and
  `e2e/soft-delete.spec.ts:167-175` is fixed with the form.
- `npm test` **never typechecks** (`vitest.config.ts:9` has no `typecheck`
  block and globs only `src/**/*.test.ts`), so `tsc` runs separately in every
  verification step.

## Parallel-session protocol

`main` is shared with other live Claude sessions.

- Never `git stash` — the stash is shared across worktrees.
- Never `git add -A`, `commit -a`, `reset --hard`, or `checkout -- .`.
  Stage explicit paths; `git commit --only <paths>`.
- `e2e/.auth/state.json` is tracked and carries session tokens — never commit
  updates to it.
- Git author is identical for every session, so authorship cannot attribute
  commits. Claim files via SendMessage before editing; verify peer claims
  against `git status` rather than trusting them.
- Known concurrent claims, as of 2026-08-25:
  - `src/features/sprints/task-actions.ts` (multi-assignee) — **WS0 lands
    before it**; the sibling session is holding for that commit.
  - `src/db/schema.ts` — the sibling is appending a `taskAssignees` table
    beside `tasks`. Purely additive and disjoint from this work's `tasks`
    columns and `task_status` widening, but **both sessions append to the same
    file**: expect a textual conflict there and resolve by keeping both
    blocks.
  - **The app shell** — the sibling is adding sidebar collapse in
    `src/components/` / `app/(app)/layout.tsx` plus a `commands.ts`. WS1's
    vocabulary sweep edits `src/components/shell/nav-items.ts`, which feeds
    the sidebar, the mobile sheet, the shortcuts overlay, `G A` and a ⌘K row
    (8 importers). **These overlap.** WS1 must re-confirm shell ownership
    before touching `nav-items.ts` or the ⌘K registry.
