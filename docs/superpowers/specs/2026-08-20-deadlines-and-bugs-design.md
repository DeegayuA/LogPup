# Deadlines and Bugs — Grading the Date, Discriminating the Work — Design

Date: 2026-08-20
Status: awaiting review
Spec C of 5 — see "Why this is five specs" in
`docs/superpowers/specs/2026-08-20-work-substrate-design.md`. Depends on A.

## Purpose

Three failures, one spec, because all three are the same failure wearing
different clothes: the product records work but not what the work *is* or what
was *promised* about it.

1. **One deadline column that means two incompatible things.** `tasks.due_date`
   (`src/db/schema.ts:326`) is the only deadline field in the product. Its own
   comment says it is set from phrases like "today" / "friday" typed into the ⌘K
   quick-add. It is also what an accepted meeting suggestion writes when someone
   told a client a date out loud. Three writers — `createTask`
   (`task-actions.ts:328`), `updateTask` (`task-actions.ts:388`, input at `:67`),
   `quickAssignTask` (`search/actions.ts:214`), plus the suggestion accept path
   (`meetings/notes.ts:208-217`, `meetings/ai-actions.ts:3994`) — and five
   readers: `dueState` (`people/task-workload.ts:65-68`), `isOverdue`
   (`sprints/board-view.ts:160`), `people/now.ts:92`, the app overdue counts
   (`apps/queries.ts:157`, `:429`), and the dashboard's Overdue / Due-soon tiles
   (`dashboard/my-day-stats.ts:33-47`). Every one of them treats "I jotted
   Friday" and "we promised the client the 12th" as the same fact. An overdue
   list that mixes those two is ignored within six weeks, and then the one
   column that *did* mean something is dead too.

   The comparison itself is right and must not be touched:
   `task-workload.ts:11-17` documents why a due date is compared as a
   `YYYY-MM-DD` string against a business-timezone `todayIso` and deliberately
   never parsed into a `Date` — `new Date('2026-08-12')` is midnight UTC, which
   is still the 11th west of Greenwich.

2. **There is no bug or issue entity at all.** No table, no discriminator on
   `tasks`, no severity, no reporter, no resolution. `taskStatus`
   (`src/db/schema.ts:63`) is exactly `todo | in_progress | done`. Today a
   defect is a task whose title starts with "BUG:", which means the studio
   cannot answer "how many open blockers does this client have", cannot tell a
   fixed thing from a not-a-bug thing a month later, and cannot separate the
   reporter's judgement of severity from the PM's judgement of schedule.

3. **The AI already extracts deadlines and throws them away.**
   `meeting_ai_notes.deadlines` (`src/db/schema.ts:592`) is jsonb shaped
   `[{ item, owner, due }]` where `due` is documented at `schema.ts:581` as a
   free-text date PHRASE. It is parsed exactly once, client-side, by
   `parseSpokenDueDate` (`meetings/components/meeting-notes-model.ts:51`) to
   render a hint chip, and by `findDueDateHint` for a suggestion that has no
   date of its own (`meetings/components/note-timeline.tsx:122-127`). Nothing
   persists a date. Nothing queries it. The panel renders as a list of deadlines
   with owners and dates, and is tracked by nothing — so the moment real
   deadlines exist beside it, it becomes actively misleading rather than merely
   inert.

And a fourth, smaller, that falls out of the first: `meeting_followups`
(`schema.ts:651-682`) has no due date and no index block at all, while the
dashboard's "I owe" tile counts it (`my-day-stats.ts:47-60`). The product's
carry-forward debt list is an undated pile.

## Decisions

### Grade the column you have. Do not add a second date.

`tasks.due_kind text NOT NULL DEFAULT 'target'`, two values, `target` and
`committed`. A `committed` date has a counterparty and a note; a `target` does
not. Everything else — the string comparison, `dueState`, `isOverdue`, the
board's overdue filter, the tiles — reads the same column it reads today and
changes not at all.

**Rejected: a `deadlines` table, seeded from `meeting_ai_notes.deadlines`.** The
schema looks like it is asking for one — there is already a jsonb list of
`{item, owner, due}`. It is not asking; that jsonb is a transcript extract. A
deadline with no work attached to it is a wish, and a `deadlines` table would
within a month need an assignee, a status, comments and a history, at which
point it is a second and worse `tasks`. Worse, it would fork every reader listed
in Purpose 1 on day one.

**Rejected: a second `committed_due_date` column.** Two date columns means every
one of those five readers must decide which one it means, and the first reader
that picks wrong is a client date that silently stops being tracked. One column
with a grade has exactly one answer.

**Rejected: a timestamp deadline, now and permanently.** The first request after
this ships will be "due Friday 5pm". Granting it turns every string comparison
in `task-workload.ts`, `board-view.ts` and `coverage.ts` into a timezone
question and re-introduces the exact bug `iso-day.ts` was written to kill. This
is a documented refusal, not a backlog item.

### `original_due_date` is written once, and the once is a transition

`original_due_date date` is written on the first `NULL → non-NULL` transition of
`due_date` and never touched again — not on a move, not on a clear, not on a
trash restore, not on reassignment. That is what makes "we promised the 12th,
it is now the 26th" survivable: every other candidate for the answer is
destroyed by exactly the operations that make the question worth asking.

**Rejected: deriving it from `activity_log` at render time.** `activity_log` is
and stays the audit trail, but answering "what did we originally say" from it
means a jsonb scan per card on the board and the person page. A column that is
written once is cheaper than a query that is run thousands of times.

`due_changed_count integer NOT NULL DEFAULT 0` increments only on a
`non-NULL → different non-NULL` transition. Its schema comment must state that
it is a **recomputable cache over `activity_log`** and never the record — so
that when the two disagree, nobody argues about which one is right.

Consolidate all three writers behind one `applyDueDate` helper, the same move
spec A makes for `transitionTaskStatus`. Today three call sites write `due_date`
independently; grading, the once-only original, and the counter each have to be
right in all three or the invariant is a lie. One helper is what stops six
behaviours accreting across three diverging call sites.

### Committing is one capability; moving a commitment is a different one

Three rows, because they are three questions:

| Action | superadmin | admin | manager | editor | member | stakeholder | auditor |
|---|---|---|---|---|---|---|---|
| `deadline.set` | all | all | scoped | scoped | own | none | none |
| `deadline.commit` | all | all | scoped | none | none | none | none |
| `deadline.move.committed` | all | all | scoped | none | none | none | none |

`deadline.set` at level `own` resolves `ownerId` against **`tasks.assigneeId`**,
stated explicitly because `can()` fails closed on `own` with no resource and
`canMoveTask` already passes `assigneeId` as `ownerId`
(`src/features/sprints/permissions.ts`). A new action that inherits its owner
source silently is a permission bug waiting for its first ambiguous row.

Setting `due_kind = 'committed'` additionally requires a non-empty
`due_commitment_note` naming who it was promised to. This is not ceremony: the
named failure is `committed` becoming a seniority badge — "my manager cares" —
and the note is the counter-pressure. The promises view renders the note **text**
as its primary column, so a promise with no named counterparty looks empty,
because it is.

**An editor who lacks `deadline.move.committed` is routed to `change_requests`,
not refused.** That machinery is built and I verified it rather than assuming:
`createChangeRequest` / `approveChangeRequest` exist
(`src/features/admin/change-request-actions.ts:44`, `:95`), `'task'` is already
in `SUPPORTED_ENTITY_TYPES` (`change-request-appliers.ts:17`), `detectConflict`
compares a stored pre-image field by field (`:36-48`), and
`buildApplyStatement` spreads the `after` object generically into
`db.update(table).set(after)` (`:58-66`) — so a due-date change request needs
**zero applier changes**. The `{before, after}` payload carries `dueDate`,
`dueKind` and `dueCommitmentNote`.

One honesty correction this spec inherits and must not overstate: approval is
`db.batch` plus an explicit pre-image conflict check
(`change-request-actions.ts:118-127`), not a transaction — `neon-http` has none.
Nothing here strengthens that claim.

### Escalation is a pure function. Suppression is about the nudge, never the number.

```
escalationStep(dueDate, dueKind, status, todayIso, suppressedDays)
  → 'none' | 'due-soon' | 'due-today' | 'overdue' | 'breached'
```

Zero database access, table-driven tests, one module, serving both tasks and
follow-ups. `due-soon` is within 7 **working** days; `breached` is `committed`
and overdue by two or more working days.

**The critical rule, stated so nobody softens it later: an item `isOverdue` is
NEVER suppressed. Only the nudge to the person is.** The client still does not
have the thing. An approved absence does not move a date, does not change
`isOverdue`, and does not remove the item from any manager-facing at-risk list —
it removes the person from the recipient list for that day and adds a sentence
to the card ("Nimal was on approved leave 18–22 Aug").

Four suppression sources, and all four now have real write paths, which is why
this is buildable today rather than aspirational:

| Source | Write path, verified |
|---|---|
| Approved absence | `worklog/absence-actions.ts:46` create, `:163` approve |
| Gazetted LK holiday | `src/lib/lk-holidays.ts` (data), `working-days.ts:28-32` |
| Org holiday | `worklog/org-holiday-actions.ts:19` |
| Zero-fraction work schedule | `worklog/schedule-actions.ts:32` |

A **pending** absence suppresses nothing, exactly mirroring
`coverage.ts:43` ("APPROVED absences only. A pending absence never exempts a
day.") and `approvedAbsenceDays` (`worklog/absence-queries.ts:67`). Two
mechanisms disagreeing about what a pending absence means is how the whole
absence model stops being trusted.

**Rejected: auto-extending a deadline by approved leave.** It sounds humane and
it is precisely wrong — a client's date does not move because a developer went
to a wedding, and silently rewriting a promise is the one thing this entire spec
exists to prevent. The correct behaviour is the opposite: the item stays
overdue and visible, the person stops being nudged, and the approver is warned
at approval time so a human decides whether to renegotiate. Approving an absence
therefore surfaces, before commit, every open `committed` deadline owned by that
person inside the range, with app and PM. The warning **informs; it does not
block**.

### One escalation function serves tasks and follow-ups

`meeting_followups` gains `due_date` and `due_kind`, the same pair with the same
meanings. A follow-up whose `resolved_by_task_id` is set takes its escalation
from the task and does not fire independently — `schema.ts:678-680` already
documents that moving that task to `done` auto-resolves the row and moving it
back reopens it, so two nudges for one obligation is a bug the existing link
already tells us how to avoid.

### Escalation is a STEP inside `/api/cron/notify-tick`, not a job

Vercel **Hobby**: two cron jobs, daily granularity. `vercel.json` declares
exactly one today (`/api/cron/backup`, `0 3 * * *`). Spec A owns the single
scheduled entry point in the whole product. This spec adds **no cron and no
route** — deadline escalation is an ordered step inside `notify-tick`.

**Rejected: `/api/cron/deadline-sweep`.** A reminder tick, a digest builder and
an overdue sweeper are three names for one job, and the plan has room for
neither the second job nor the second failure surface.

Consequence, and it is the correct one anyway: escalation evaluates once per
day. A ladder that fires more than once a day is a nag.

### Deadline notifications are kinds and keys, never enum values or sentences

Spec A converts `notifications.type` to `text` and puts the real vocabulary in
`kind`. This spec contributes three strings — `deadline.due_soon`,
`deadline.overdue`, `deadline.breached` — and **zero `ALTER TYPE`
statements anywhere**. Postgres forbids using a freshly `ADD VALUE`-d enum
member in the transaction that added it, on a database whose migrations are
applied by hand; the `activity_log.verb` comment (`schema.ts:897-901`) already
records the house answer: "a new verb is a new string at a call site, not a
migration."

Dedupe uses spec A's **permanent** semantics, key
`deadline:{taskId}:{step}:{dueDate}`, so a legitimately moved date re-arms the
ladder and a re-run of the tick fires nothing. Spec A owns the column and the
partial unique index; this spec only declares which semantics its kinds use.

Rows carry `title_key` + `params`, never a frozen sentence — surfaces are
bilingual Sinhala + English and the reader's language is not known at write
time. `params` carries `{ taskTitle, appName, dueDate, days }`.

Volume cap, structural rather than social: **at most one notification per item
per step per due date, four steps for the life of an item.** The bell today
carries meeting invites and mentions — low volume, high signal. A daily sweep
can trivially triple it and train twenty people to ignore the bell, which
quietly breaks meeting invites too.

`breached` additionally notifies the app's current PM, resolved at tick time
from `apps.pm_id` (`schema.ts:144`, NOT NULL, so a recipient always exists), and
escalates no further. `app_role_history` is the audit of who held the role, not
the routing table. Resolve the PM at tick time and never bake it into the dedupe
key — otherwise the key encodes yesterday's PM and today's is never told.

### Bugs are `tasks.kind = 'bug'` plus a 1:1 satellite — not a `bugs` table

This is the load-bearing decision in the spec and it deserves the full argument.

`liveTasks` is referenced across **18 files**, verified with
`grep -rl liveTasks src`: `sprints/queries.ts`, `sprints/task-actions.ts`,
`sprints/actions.ts`, `sprints/backlog.ts`, `sprints/suggest-actions.ts`,
`sprints/search-providers.ts`, `people/queries.ts`,
`people/handover-queries.ts`, `apps/queries.ts`,
`apps/contribution-queries.ts`, `apps/activity-queries.ts`,
`admin/trash-queries.ts`, `meetings/ai-actions.ts`, `db/live.ts`, plus four
test files. One `kind` column puts bugs on the sprint board, the backlog, person
workload, app contributions, the ⌘K palette, admin Trash and the nightly backup
**simultaneously**, and lets each of those filter or badge by kind when it wants
to.

Everything a defect needs, `tasks` already has and already got right.
`app_id` is NOT NULL (`schema.ts:303`) — a problem for personal to-dos, exactly
correct for a defect, which is always a defect *in something*. `sprint_id` is
nullable (`schema.ts:304`), so the untriaged inbox is already modelled for free
as "a bug with no sprint". `priority` 0–3 (`schema.ts:309`), fractional
`sort_order` (`schema.ts:323`), soft-delete with a live view, `dueDate` and
everything this spec just built on top of it.

**Rejected in full: a `bugs` table.** It sounds like clean modelling and it is
the central mistake available here. Its real cost, itemised against this repo:

- A sixth `SOFT_TABLES` entry. `src/db/live.ts:37-43` holds exactly five, and
  `live.test.ts:29-31` asserts *exactly* five by name.
- A new `liveOf(...)` view export and a new `liveBugsAs` alias builder.
- A new group in `admin/trash-queries.ts`, plus a restore arm **and** a purge
  arm in `admin/trash-actions.ts`.
- A new arm in `admin/backup.ts` (`:4`, `:43`, `:69`) or bugs are silently
  absent from the nightly backup.
- A second fractional-rank implementation (`sprints/task-rank.ts` and the
  precision-exhaustion rebalance documented at `schema.ts:310-322`).
- A second search provider, or bugs are invisible in ⌘K.
- Four new capability rows duplicating `task.create` / `task.edit` /
  `task.move` / `task.delete` (`capabilities.ts:103-106`).
- Eighteen files that each either grow a second query or silently omit bugs.

And after paying all of it, the outcome is a **sprint board that does not show
the bugs blocking the sprint**. That is not hypothetical: it is precisely the
failure `task-workload.ts:5-9` records about `due_date` — "a question the system
held the answer to and never answered."

The honest cost of the discriminator is table pollution: bug-only nullable
columns on the hottest table in the product. That is why the bug fields live in
a satellite, `task_bug_details`, keyed 1:1 on `task_id`. `tasks` gains exactly
**one** column. The board joins the satellite only where it needs severity; the
detail panel joins it for repro. At studio scale that is a primary-key lookup
against a few hundred rows.

### `kind` is `text`, not a pgEnum

`text NOT NULL DEFAULT 'task'` with a TypeScript union `'task' | 'bug'`. A
future `chore` or `spike` should be a string at a call site, not a migration —
the `activity_log.verb` precedent (`schema.ts:897-901`), whose stated reason
applies here unchanged.

### Severity and priority are different columns, and neither derives the other

`priority` already exists on `tasks` and means **when we will do it** — a
scheduling decision, owned by the PM, correctly re-litigated every sprint
planning. `severity` lives on the satellite and means **how bad it is when it
happens** — an observation about the defect, owned by the reporter, which must
not move because the schedule moved.

Merge them and you get one of two rots, both fatal: reporters inflate severity
because severity is the only lever that gets work scheduled, or PMs quietly
downgrade severity to justify not scheduling — which destroys the historical
record, so "how many blockers did we ship last quarter" becomes permanently
unanswerable. Separate columns, separate actions, separate permissions.

Severity **may** seed an initial priority at creation as a pre-filled default
the reporter can change. It must never maintain the relationship: changing
severity later does not change priority, and changing priority does not change
severity.

### `taskStatus` gains NO new values

Triage, resolution and verification are nullable column **pairs** on the
satellite. `triaged_at IS NULL` *is* the triage inbox. `verified_at IS NULL` on
a `done` bug *is* the verify queue.

A fourth enum value costs four things at once:

1. The board's three-column model gains a fourth case in every reader that
   switches on status (`sprints/board-view.ts`, `sprints/backlog.ts`).
2. `my-day-stats.ts` arithmetic — Due soon, Overdue, and the open/done split —
   silently miscounts, because "open" is currently `status !== 'done'`
   (`task-workload.ts:104`, `:130`).
3. `coverage.ts` and the follow-up auto-resolve sync (`task-actions.ts:198-211`)
   both key off `done` and would need a second definition of finished.
4. Postgres forbids using a freshly `ADD VALUE`-d member inside the transaction
   that added it, on a database whose migrations are hand-applied.

The repo has already litigated this exact trade and chosen the other way. The
`meetingTaskSuggestions.acceptedBy` comment (`schema.ts:805-816`) argues
verbatim for a nullable column over an `auto_accepted` enum value, for these
reasons. Following its own precedent costs nothing and disagreeing with it costs
a schema argument in every future review.

**A bug that is `done` but not yet verified counts as OPEN in every aggregate
the product shows** — app health, portfolio counts, person workload. A figure
that counts unverified fixes as closed is a figure that lies, and the pile it
hides grows without limit because nothing makes it visible.

### `task_bug_details` has no `deletedAt`, deliberately

It is live iff its task is — exactly the `MEETING_CHILD_TABLES` situation
`src/db/live.ts:57-62` already handles and documents. It is registered in a new
`TASK_CHILD_TABLES` export in the **same commit that creates the table**, before
any reader exists, for the reason that block already gives: "adding them after
the first reader exists means the guard stays blind for exactly as long as it
matters."

This keeps `live.test.ts` check 5 (`:501`, "every schema table with a deletedAt
column is in SOFT_TABLES") passing and `SOFT_TABLES` at exactly five. A table
with a `deletedAt` not registered in `SOFT_TABLES` **fails the build**, so the
choice here is deliberate rather than an omission.

`task_bug_details` is added to `admin/backup.ts` in the same commit. Forgetting
it is silent: every repro step in the product would be absent from the nightly
Blob backup with nothing failing.

### `meeting_task_suggestions` gains `suggested_kind`

One column, `text NOT NULL DEFAULT 'task'`, and the existing one-click "Add
task" card becomes "File as bug" when the model classifies an item as a defect.
The entire accept path is reused unchanged — `suggestedUserId`,
`suggestedDueDate`, `suggestedAppId`, `createdTaskId`, `acceptedBy`, the
auto-accept cap (`meetings/notes.ts:180-220`,
`meetings/ai-actions.ts:3950-3994`). The default means every existing row and
every existing reader stays correct with no backfill.

**No value is added to the `followupKind` pgEnum** (`schema.ts:66`). Filing a
follow-up as a bug creates a task with `kind = 'bug'` and sets the existing
`resolved_by_task_id` (`schema.ts:678`). The link already expresses it, already
auto-resolves, and already reopens.

**AI never writes a `committed` deadline.** Any AI-derived date —
`meeting_ai_notes.deadlines[].due` phrases, `suggested_due_date` — lands as
`due_kind = 'target'` and is parsed through the existing `parseTaskIntent`
grammar (`src/lib/task-intent.ts:311`), never a second date parser. A phrase the
grammar cannot resolve ("after the Ministry signs off") produces no date and the
raw phrase is preserved in the text: not dropped, not guessed at.

### `apps.internal` keeps LogPup's own defects out of client metrics

From spec A. LogPup files its own bugs against a reserved app row so it uses
identical machinery, and every portfolio and app-health aggregate filters
`internal = true` out. Without it, dogfooding silently corrupts the numbers a
client-facing lead reads, and the health card becomes something people learn to
ignore.

### Bugs are never attributed to a person — including indirectly

No "bugs caused by", no defect leaderboard, no quality score, anywhere in the
product. This is the one failure whose trust does not come back: the month
after it ships, people stop filing bugs about each other's work, which is the
only mechanism the system had.

The indirect version is cut too, and it is the one that sneaks in. **Activity
phrasing for a bug names the APP and the DEFECT, never the assignee.** Two new
verbs, `triaged` and `verified`, go into `VERB_PHRASES`
(`activity/format.ts:10-24`); unknown verbs already fall through verbatim
(`:47`), so adding them is a phrasing improvement rather than a requirement, and
the phrase they produce must read "triaged bug · Login loop on Vela", not
"triaged Nimal's bug".

## Data model

All changes additive. No existing reader changes behaviour.

**`tasks`** — five columns:

```
kind                 text NOT NULL DEFAULT 'task'      -- 'task' | 'bug'; text, not enum
due_kind             text NOT NULL DEFAULT 'target'    -- CHECK IN ('target','committed')
due_commitment_note  text                              -- required non-empty when committed
original_due_date    date                              -- written once, on first NULL→non-NULL
due_changed_count    integer NOT NULL DEFAULT 0        -- cache over activity_log, never the record
```

Every default is chosen so that every existing row is correct without a
backfill, and every existing reader is correct without an edit.

**Indexes on `tasks`:**

```
(due_date) WHERE due_kind = 'committed' AND deleted_at IS NULL AND status <> 'done'
(app_id, kind, status) WHERE deleted_at IS NULL AND kind <> 'task'
```

The first is the promises view — deliberately narrow, and if it ever grows past
a few hundred rows the studio has stopped meaning "committed", which is itself
the signal worth having. The second covers "open bugs in this app" for the
health card and the triage inbox; excluding `kind = 'task'` keeps it to the bug
minority rather than duplicating the table. `tasks_app_sprint_sort_idx`
(`schema.ts:333`) is keyed `(app_id, sprint_id, sort_order)` and still covers
every board render unchanged.

**Two indexes spec A lists are moved here**, because they name columns that do
not exist until this spec ships and would fail on creation:
`tasks (app_id, kind, status)` (spec A already flags "kind arrives in spec C")
and `meeting_followups (user_id, status, due_date) WHERE status = 'open'`. Spec
A's `meeting_followups` index therefore drops to `(user_id, status)` if it ships
first, or waits. Whoever integrates must not create either index before its
column.

**`task_bug_details`** — the satellite, primary-keyed on `task_id` so it needs
no id of its own:

```
task_id              uuid PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE
reported_by          uuid NOT NULL REFERENCES users(id)
severity             text NOT NULL DEFAULT 'minor'   -- blocker|major|minor|trivial
steps                text
expected             text
actual               text
environment_note     text
triaged_at           timestamptz
triaged_by           uuid REFERENCES users(id)
resolution           text        -- fixed|duplicate|not_a_bug|wont_fix|cannot_reproduce
verified_at          timestamptz
verified_by          uuid REFERENCES users(id)
duplicate_of_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL
source_meeting_id    uuid REFERENCES meetings(id) ON DELETE SET NULL
source_followup_id   uuid REFERENCES meeting_followups(id) ON DELETE SET NULL
source_label         text
created_at           timestamptz NOT NULL DEFAULT now()
CHECK (duplicate_of_task_id IS NULL OR duplicate_of_task_id <> task_id)
```

Column reasons, only where the reason is not obvious:

- **No `deleted_at`**, per the decision above. Live iff its task is.
- `ON DELETE CASCADE` on `task_id` is safe *because* tasks are soft-deleted: the
  cascade can only fire from the allowlisted trash purge, where discarding the
  repro steps along with the task is the right outcome.
- `reported_by` is NOT NULL with no `onDelete` rule, following
  `activity_log.actorId`'s documented reasoning (`schema.ts:895-896`): accounts
  are deactivated, never deleted, so the join is safe and the reporter stays a
  real person with an avatar.
- `severity` is `text` with a TS union rather than a pgEnum, for the same reason
  `kind` is.
- `triaged_at`/`triaged_by` and `verified_at`/`verified_by` are the nullable
  pairs that replace an entire status ladder. `resolution` is *why it left*,
  which `status = 'done'` cannot express — without it, "not a bug" and "fixed"
  are indistinguishable a month later and the defect rate is uninterpretable.
- `duplicate_of_task_id` uses SET NULL for the same reason
  `meetingFollowups.resolvedByTaskId` does (`schema.ts:670-677`): purging the
  canonical bug should un-link, not delete the record that a report existed. The
  CHECK is the cheap half of the cycle guard; resolving a chain to its root
  before writing is the action's half.
- `source_*` is meeting provenance, both FKs SET NULL, with `source_label` as
  the denormalized snapshot that keeps "came from the Tuesday client review"
  readable after a purge — the convention `activity_log` already uses for
  `entityLabel` / `appName`.

**Indexes on `task_bug_details`:**

```
(triaged_at) WHERE triaged_at IS NULL                       -- the triage inbox
(reported_by, verified_at)                                  -- my verify queue
(duplicate_of_task_id) WHERE duplicate_of_task_id IS NOT NULL
```

The first stays tiny forever because rows leave it permanently once triaged. The
third has two readers: rendering "also reported by" on a canonical bug, and the
pre-delete check that blocks trashing a bug other duplicates point at.

**`meeting_followups`** — two columns and one index:

```
due_date  date
due_kind  text NOT NULL DEFAULT 'target'   -- CHECK IN ('target','committed')
(user_id, status, due_date) WHERE status = 'open'
```

The same pair as `tasks`, so one escalation function serves both and no parallel
deadline concept exists. The index serves the "I owe" tile, the person page and
the tick's follow-up pass in one shape; the table has **zero** indexes today.

**`meeting_task_suggestions`** — one column:

```
suggested_kind  text NOT NULL DEFAULT 'task'
```

**Capabilities** — three rows in `src/features/auth/capabilities.ts`'s
`ROLE_GRANTS`, per the table in Decisions. No bug-specific edit/move/delete
rows: those are `task.edit` / `task.move` / `task.delete`
(`capabilities.ts:103-106`) and stay `task.*`. Two bug rows:

| Action | superadmin | admin | manager | editor | member | stakeholder | auditor |
|---|---|---|---|---|---|---|---|
| `bug.report` | all | all | scoped | scoped | scoped | scoped | none |
| `bug.triage` | all | all | scoped | scoped | none | none | none |

`bug.report` granting `stakeholder: scoped` is a deliberate, named widening — a
client seat that can see an app must be able to report a defect in it, and it is
the only capability in the whole matrix where a stakeholder gains a write. It is
also unreachable until `/admin/apps` ships a grant path for `app_grants`, and
that dependency is stated rather than discovered.

## Migrations

Hand-written SQL plus hand-written `drizzle/meta/_journal.json` entries;
`drizzle-kit generate` is forbidden in this repo. Replay-safe throughout —
`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `DO $$ … EXCEPTION
WHEN duplicate_object` — modelled on `drizzle/0034_app_role_history.sql`, whose
header states that discipline for exactly this reason.

**Migration numbers are allocated at merge time, never in advance.** The tree
already shows what happens otherwise: `0040` was claimed by four parallel
sessions and `drizzle/0040_meeting_apps.sql` won. Latest on disk today is
`drizzle/0041_employment_and_logging.sql`. Any number written into this document
would be wrong by construction, so none is.

**Zero `ALTER TYPE … ADD VALUE` statements in this spec.** Not for
`task_status`, not for `notification_type`, not for `followup_kind`. Every new
vocabulary is `text`.

Ordered, one concern each:

1. `tasks` deadline grading — the four deadline columns plus the committed
   partial index. Shipped alone and first, because `applyDueDate` and the
   escalation module both depend on it and nothing else does.
2. `tasks.kind` plus the `(app_id, kind, status)` partial index.
3. `task_bug_details`, its three indexes and its CHECK — separate, because a
   new table with FKs is the statement most likely to fail against an
   unexpected database state and must be diagnosable in isolation.
4. `meeting_followups.due_date` / `due_kind` plus its index.
5. `meeting_task_suggestions.suggested_kind`.

No migration runs against any database without explicit human approval, and each
is verified against `information_schema` rather than the runner's exit code —
`npm run db:migrate` has reported success while applying nothing.

## Pages & flows

**No new page and no new nav section.** Deadlines and defects are attributes of
work, not places.

- **Task card and dialog** (`sprints/components/task-card.tsx:92-104`,
  `task-dialog.tsx:350`) gain the grade beside the date, the commitment note
  when there is one, and the slip line ("promised 12 Aug · moved 3 times") when
  `due_changed_count > 0`. The date input and its string round-trip are
  unchanged.
- **A narrow per-app Promises list**, filtered to `due_kind = 'committed'`,
  rendering the note text as the primary column. If that list is long, it is
  telling you the grade has collapsed, not that it needs a page.
- **Bug filing** from the app page, from ⌘K, and from the meeting suggestion
  card, defaulting the app to the one the reporter is currently looking at.
  Title and severity are enough to file. A plain title/description ILIKE search
  over open bugs in the same app shows "N similar open bugs" *before* the submit
  button.
- **Triage inbox** — `triaged_at IS NULL`, scoped per app, default-owned by
  `apps.pm_id` (NOT NULL, so an owner always exists), on the app page and the
  PM's dashboard. There is no delivery layer that nags: a queue that is not on a
  page someone already opens every morning does not exist. It shows the age of
  its oldest item, because a graveyard that looks empty is how reporting stops.
  Triage sets severity, app, priority, sprint and assignee in one action and
  stamps `triaged_at`/`triaged_by`. Changing the app **nulls `sprint_id`** —
  nothing in the schema prevents a cross-app sprint pointer today and this
  feature is what would expose it.
- **Verify queue** — `done` and `verified_at IS NULL`, on the reporter's own
  dashboard tile, because they are the only person with both the motive and the
  knowledge to close it. When the reporter is deactivated it falls through to
  the app's PM, or every bug they filed sits unverified forever and quietly
  inflates the open count.
- **Absence approval** warns about straddled committed deadlines before commit,
  and does not block.

UX rules, non-negotiable and all pre-existing:

- Colours from existing tokens in `src/app/globals.css` only: `--destructive`
  for breached, `--warning` for overdue, `--muted` for target. `--chart-*` is
  for real chart series and is not touched here.
- **Never colour-only state.** Every deadline badge and every severity badge
  carries a word. The deadline ramp has four steps, which is more than colour
  can carry legibly even before WCAG 1.4.1.
- Empty, loading and error states for every new surface; skeletons, not
  spinners.
- Bilingual copy where the surrounding surface is bilingual.

Next.js 16 facts that differ from training data and bite here: `params` and
`searchParams` are Promises; `error.tsx`'s second prop is `retry`, not `reset`;
`unauthorized()` / `forbidden()` need `experimental.authInterrupts`, which this
repo does **not** set — so a route a seat may not see calls `notFound()`. Server
*actions* return a refusal `ActionResult`; *routes* 404. A stakeholder must not
learn a surface exists by being refused it.

## Error handling

Every server action returns `ActionResult` from `@/lib/action-result` and is
permission-guarded server-side. Client-side hiding is presentation only.

- Setting `due_kind = 'committed'` with an empty note →
  `err('Say who this was promised to')`.
- Moving or **clearing** a committed date with the capability but no reason →
  `err('Say why the date is moving')`, never a silent fall-through. Clearing a
  promise is the most audit-worthy deadline action there is and the easiest one
  to build as a no-op; it requires the same capability and reason as a move, and
  it does **not** reset `original_due_date` or `due_changed_count`.
- Moving a committed date without the capability → a change request is created
  and the action returns `ok()` with its id. This is not a refusal and must not
  read like one. Approving one that has gone stale fails loudly through the
  existing `detectConflict` path.
- A `kind = 'bug'` task moving to `done` with a null `resolution` → `err` naming
  what is missing, enforced in **all three** of `updateTask`, `moveTaskOnBoard`
  and `bulkUpdateTasks`. Partial enforcement is worse than none, because it
  teaches people which door to use. It is enforced in the action rather than a
  CHECK constraint: no constraint on `tasks` can see the satellite, and one
  written there would fire against `kind = 'task'` rows.
- Soft-deleting a bug that other live duplicates point at → `err` naming the
  count, rather than cascading or orphaning them behind a soft-deleted row that
  every `liveTasks` read returns nothing for.
- Marking a duplicate whose target is itself a duplicate resolves to the root
  before writing. The CHECK catches self-reference; chains and cycles are the
  action's job.
- Flipping `kind` from `bug` back to `task` **retains** the
  `task_bug_details` row. Deleting it means the repro steps, reporter and
  severity are gone on the flip back — a data-loss bug produced by a UI toggle.
- The escalation step inside `notify-tick` is best-effort: a failure logs and
  does not fail the tick or any sibling step.
- `LK_HOLIDAYS` covers **2026 only** (`src/lib/lk-holidays.ts:4-11`). When a due
  date's year has no holiday data, working-day arithmetic degrades to calendar
  days **visibly and in words**, never silently. In January 2027 every
  "due in 3 days" quietly becomes wrong otherwise, with no error to notice.
- A due date that lands on a Sunday or a Poya day is stored **exactly as typed**
  and warned about by name. Silently sliding a date a human chose is worse than
  letting them choose a bad one.

## Testing

TDD, following `permissions.test.ts` / `missing-days.test.ts` conventions —
Vitest, relative imports, no globals. `vitest.config.ts` includes
`src/**/*.test.ts` **only**; `.tsx` is not matched, so nothing testable may live
in a component file.

Pure, table-driven:

1. **`escalationStep`** across all five steps, with each of the four suppression
   sources asserted separately; a **pending** absence suppresses nothing; and
   the load-bearing assertion — `isOverdue` is identical with and without
   suppression, only the recipient list differs.
2. **`applyDueDate` transitions** — `original_due_date` written on the first
   `NULL → non-NULL` and unchanged by a move, a clear, a restore and a
   reassignment; `due_changed_count` increments only on
   `non-NULL → different non-NULL`.
3. **`dueVsSprint`** — `no-date | no-sprint | inside | after-sprint-end |
   before-sprint-start`, with the board and dialog rendering the conflict in
   words.
4. **Capability matrix rows** folded into the existing table-driven
   `capabilities.test.ts`, with explicit assertions that `deadline.commit` and
   `deadline.move.committed` are `none` for `member`, `stakeholder` and
   `auditor`, and that `deadline.set` at `own` resolves against `assigneeId`.

Integration, mocked-`db` idiom:

5. An under-privileged committed move creates a `change_requests` row and
   mutates the task not at all; approving a stale one returns the conflict.
6. A `kind = 'bug'` task refuses `done` without a resolution through each of
   `updateTask`, `moveTaskOnBoard` and `bulkUpdateTasks` — three cases, one per
   door.
7. Trashing a bug that two live duplicates point at is refused with the count.

Guard tests, which are the ones that fail silently if forgotten:

8. `live.test.ts` check 5 still passes and `SOFT_TABLES` is still exactly five
   after `task_bug_details` exists — i.e. the satellite really has no
   `deleted_at`.
9. `TASK_CHILD_TABLES` contains `taskBugDetails`, and `admin/backup.ts` includes
   the table. Both omissions are invisible in every other test.

## Build order

1. **`tasks` deadline columns and `applyDueDate`**, consolidating the three
   writers. Nothing else in this spec can be correct before the writers are one.
2. **`escalation.ts`** — the pure module and its tests. No UI, no database.
3. **Escalation as a step inside `/api/cron/notify-tick`.** Blocked on spec A's
   notification substrate: the kinds, the dedupe key, the `title_key`/`params`
   render path and the index all belong to A.
4. **`meeting_followups.due_date` / `due_kind`**, so the one escalation function
   serves both and the "I owe" tile stops being an undated pile.
5. **Deadline grading in the UI** — card, dialog, the promises list, the absence
   approval warning.
6. **`tasks.kind` + `task_bug_details`**, with the `TASK_CHILD_TABLES` and
   `backup.ts` registrations in the **same commit** as the migration.
7. **Triage, resolution and verification actions**, and the three queues on
   pages people already open.
8. **`meeting_task_suggestions.suggested_kind`** → "File as bug", reusing the
   accept path unchanged.

Steps 1–5 ship useful without 6–8; steps 6–8 ship useful without any
bug-specific escalation. The bug half is **optional for** the deadline half and
**blocking for** nothing: both read `tasks` regardless of `kind`.

## Out of scope (YAGNI)

Every cut, with the reason, so nobody re-adds it in a review.

**The one that ends the system it measures:**

- **Bugs attributed to a person.** No "bugs caused by", no defect leaderboard,
  no quality score, on the person page or anywhere else. Within a month people
  stop filing bugs about each other's work, which is the only mechanism the
  system had, and that trust does not come back.
- **The indirect version, cut too.** Activity phrasing for a bug names the APP
  and the DEFECT, never the assignee. This is how the cut above gets re-added
  without anyone noticing they did it.

**Deadline cuts:**

- **Deriving priority from severity** ("blocker ⇒ priority 3"). It quietly
  re-merges the two concepts the whole design separates, removes the PM's
  ability to say "yes it's a blocker for that client, no we're not doing it this
  sprint", and hands reporters a scheduling lever disguised as an observation.
- **Auto-extending deadlines by approved leave.** A client's date does not move
  because someone went to a wedding. It silently rewrites promises, which is the
  one thing this spec exists to prevent.
- **Full RRULE recurrence** — exceptions, "this and all future occurrences"
  editing, materialized series. The edit semantics alone are more state machine
  than the rest of the deadline model combined, for a studio whose real
  requirement is "the weekly client report".
- **Task dependencies with auto-shifting dates.** Nobody maintains the edge list
  past week three, and the auto-shift moves dates people committed to without a
  human deciding — destroying exactly the trust the target/committed split
  exists to create. If dependency ever ships it is advisory and writes no dates.
- **Start dates on every task.** A second date nobody maintains, stale within a
  sprint, making the roadmap look precise while being fiction. The sprint *is*
  the do-window and the board already renders it.
- **Snooze.** Infinite deferral with no trail — a bulk bump that looks like a UI
  preference rather than a data change.
- **Percent-complete on tasks.** `sprint_checkins` already carries a
  self-reported percent at sprint level; a second self-reported number at task
  granularity produces two disagreeing progress figures and no forecast.
- **Adding `due_date` to `bulkUpdateTasks`.** Verified: `bulkUpdateInput.patch`
  (`sprints/task-actions.ts:112-119`) accepts `status`, `assigneeId`, `priority`
  and `sprintId` and no date. Leave it that way — the Friday bulk-bump of sixty
  overdue tasks to next Friday is currently impossible, and the cheapest way to
  keep it impossible is not to build the door.
- **Pushing task due dates into Google Calendar as events.** Hundreds of events
  in twenty personal calendars, dependent on each person's
  `googleRefreshToken`, with no reliable delete path when a date moves or a task
  is trashed. A per-user revocable read-only `.ics` feed is the only acceptable
  future shape, and it is not this pass.
- **A `/deadlines` page.** Deadlines are an attribute of work, not a place.
- **Time-of-day deadlines, SLA timers, business-hours countdowns.** Refused, not
  deferred — see the timestamp argument in Decisions.
- **Per-user reminder preferences, quiet hours, digest frequency.** Meaningless
  configuration for a channel spec A has not shipped yet.

**Bug cuts:**

- **A separate bug board or bug nav section.** Feels tidy; guarantees the sprint
  board lies about what the sprint contains.
- **AI duplicate detection with auto-merge.** Gemini is already in the stack so
  it looks free. The cost asymmetry is brutal: a false merge buries a real
  defect inside a closed ticket nobody reopens, while manual duplicate triage
  costs two minutes. The plain ILIKE "similar open bugs" list captures most of
  the value at zero risk.
- **Merging duplicates at all.** A duplicate stays a visible row pointing at the
  canonical bug. Three independent reports of one defect is a priority signal
  that merging destroys.
- **A structured environment form** — browser, OS, version, device, build,
  region. Nobody fills twelve fields; completion collapses and the form stops
  people reporting. One free-text `environment_note` line.
- **Required repro fields.** Required fields cut reporting volume far more than
  they improve report quality. A low-quality bug in the system can be improved
  at triage; one that never got filed is rediscovered in production.
- **`caused_by_task_id` / regression linking.** The field nobody fills, so the
  fraction that *is* filled makes regressions look rare and the data actively
  misleads.
- **Screenshot and file attachments**, first cut only, with the cost named: the
  full `meeting_screenshots` pattern — Blob storage, a private serving route, a
  live view, a `SOFT_TABLES` entry, a trash-queries group and restore/purge arms
  — or `live.test.ts` check 5 fails the build.
- **Threaded comments on a bug**, watchers, multi-assignee, and a customer
  identity for reporters who are not LogPup users. Each is a cross-cutting
  change belonging to another spec.
- **External tracker sync** — GitHub Issues, Jira, Linear. `apps.repo_url`
  exists and nothing reads issues; two-way sync is a project, not a field.
- **Bug analytics** — defect density, escape rate, MTTR, burn charts.
  Meaningless until `tasks.completed_at` (spec A) has months of honestly-triaged
  data behind it, and building the chart first is what pressures people into
  gaming the inputs.
