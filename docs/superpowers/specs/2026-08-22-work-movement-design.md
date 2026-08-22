# Work movement, role KPIs, and three intake fixes

**Status:** design approved 2026-08-22, decisions in §6 answered, implementation in progress.
**Date:** 2026-08-22

---

## The question

> "How can I measure productivity? Some people may have 4 hours worked but nothing."

LogPup can already say how many minutes somebody logged. It cannot say whether anything
came of them. Four logged hours that shipped a feature and four logged hours that produced
nothing are, today, the same row.

This spec answers that — and the follow-on question, "how do I monitor a PM, a tech lead,
an architect, every role" — plus three intake items that arrived with it and share
infrastructure with the answer.

---

## Part 0 — What the data can and cannot answer

Everything below is verified against `src/db/schema.ts`. Nothing is assumed.

### The clock

`tasks` has **no completion timestamp**. It has `status`, `created_at`, `deleted_at`, and
nothing else that says *when* it became `done`.

The only clock is `activity_log`: append-only, no soft delete, carrying `actor_id`,
`verb` (`created` · `completed` · `reopened` · `moved` · `assigned` · `commented` · …),
`entity_type`, `entity_id`, `created_at`, `metadata`. It is indexed on
`(entity_type, entity_id, created_at)` and `(actor_id, created_at)` — both reads this
spec needs. The schema comments already establish the precedence rule: where a cached
column and `activity_log` disagree, **`activity_log` wins**.

Every "when did this move" figure in this document reads `activity_log`. No new
timestamp column is proposed on `tasks`.

### The ceiling — read this before designing any measure

**LogPup observes card movement and writing. It does not observe work.**

There is no git integration, no editor telemetry, no screen time. A developer can spend
eight real hours inside one hard task, log them honestly, and generate **zero**
`activity_log` rows, because they never moved the card.

This is the single most important constraint in this spec. It means:

- "No trace" **≠** "did nothing". It means *no trace*.
- Any measure built on absence-of-activity is a **prompt to write down what happened**,
  never evidence of idleness, and must be worded that way in the UI or it will be read as
  an accusation and will change behaviour instead of measuring it.
- The correct remedy offered next to such a row is *"add a note"* / *"move the card"* —
  never *"explain yourself"*.

### Seats, roles, and who is even measurable

| Concept | Column | Values |
|---|---|---|
| Permission seat | `users.role` | `superadmin` `admin` `manager` `editor` `member` `stakeholder` `auditor` |
| Job title | `users.title` | free text, nullable |
| Project role | `app_role_history.role` | `pm` \| `lead` — interval-tracked, one open row per `(app, role)` |
| Working role on a project | `assignments.role` | **free text**, plus `allocation_pct` |
| Career stage | `users.employment_type` | `permanent` `probation` `trainee` `intern` `contract` |
| Is a worklog even owed | `users.logging_expectation` | `daily` \| `none` |

Two consequences the design must respect:

1. **There is no architect role.** `app_role_kind` is `('pm','lead')` and nothing else.
   An architect today is either a `users.title` string or an `assignments.role` string —
   neither of which is a closed set, neither of which is interval-tracked, and neither of
   which can be trusted to spell the same word twice. **Decided: derive from `users.title`
   through a tested normaliser, and accept that the panel has no history — see §6.1.**

2. **`logging_expectation = 'none'` exists precisely for supervisory seats.** A PM or lead
   who only assigns and monitors produces no `daily_worklogs` rows at all. Any KPI that
   reads worklog coverage will show them at zero forever. PM and lead KPIs in this spec
   therefore read **no worklog data whatsoever**.

### Available tables

`worklog_entries` (`user_id`, `day` Asia/Colombo, `minutes` — *integer minutes, never
hours*, `app_id` nullable, `task_id` set only when `category='task'`, `category`, `billable`,
`note`, `source`) · `daily_worklogs` · `tasks` · `sprints` · `sprint_checkins` (self-reported
percent) · `activity_log` · `meetings` · `meeting_followups` · `meeting_load_decisions` ·
`bug_reports` · `change_requests` · `app_comments` · `absences` · `work_schedules` ·
`org_holidays` · `assignments` / `assignment_history` · `app_role_history` ·
`rate_cards` · `person_rates` · `project_value`.

Already designed and **not** to be duplicated or contradicted:
[`2026-08-20-project-cost-and-worth-design.md`](2026-08-20-project-cost-and-worth-design.md)
derives earned value from `worklog_entries.billable` plus rates.

---

## Part 1 — The measurement model

### 1.1 The rule that shapes everything

**Measure the work, not the worker.**

The unit of every figure below is a *task*, a *project*, a *sprint*, or a *week*. Where a
figure is attributed to a person it is attributed as *context on a piece of work* — "this
task is stuck, Nuwan holds it" — never as *a property of the person* — "Nuwan's score is 62".

**No composite score. No index. No rating. No leaderboard.** Not in the UI, not in a
returned type, not in a CSV. This team is small enough that a single ranked number would
change behaviour far more than it would measure it, and the first thing it would change is
how people log time — destroying the input every other figure depends on.

Role KPIs, which were explicitly asked for, are delivered as **panels of individually
traceable measures**, each naming its own source and its own limits. That is the form in
which "PM KPI" is a useful management tool rather than a number to optimise.

### 1.2 Three measures answer "4 hours and nothing"

#### M1 · Time with no visible outcome

**Definition.** For a person-day: minutes in `worklog_entries` for that `user_id` and `day`
where the day produced **no** `activity_log` row with `actor_id` = that user and
`created_at` inside the same Asia/Colombo day.

**Source.** `worklog_entries.minutes`, `worklog_entries.day`, `worklog_entries.user_id` ·
`activity_log.actor_id`, `activity_log.created_at`.

**Worked example.** Ama logs 240 minutes on 2026-08-19 against task *Rework the invoice
export*. `activity_log` holds no row with `actor_id = ama` on 2026-08-19. M1 for
(ama, 2026-08-19) = **240 minutes with no visible outcome**.

**What it does NOT mean.** It does not mean Ama did nothing. Per §0 it means LogPup saw
nothing — most often because the work was inside one card that never moved. The UI copy is
*"4h logged, nothing written down"* with an *"Add a note"* action. It is never *"4h, no
output"*.

**Suppression.** Zero-minute days, days fully covered by an approved `absences` row, and
non-working days per `work_schedules` / `org_holidays` are excluded before the measure runs
— they are not "no outcome", they are "not a working day".

#### M2 · Stalled tasks *(the honest per-work version of the same question)*

**Definition.** A task is **stalled** when it has at least one `worklog_entries` row pointing
at it (`task_id`) *and* its most recent `activity_log` row (`entity_type='task'`,
`entity_id`=task) is more than `STALL_DAYS` **working days** old, *and* `status <> 'done'`.

**Source.** `worklog_entries.task_id` · `activity_log` (entity index) · `tasks.status` ·
working days via `src/lib/working-days.ts` (Saturday = 0.5).

**Worked example.** *Rework the invoice export* has 11h logged across three people; its last
`activity_log` row is `moved` on 2026-08-11; today is 2026-08-22 → 8.5 working days →
**stalled**.

**Why this is the measure that matters.** It is a fact about a *task*, it names a real
problem ("11 hours are sitting in something that has not moved in eight days"), and the
action is unambiguous: go unstick it. It cannot be read as an accusation because its
subject is not a person.

**What it does NOT mean.** A long, genuinely hard task is indistinguishable from an
abandoned one. `STALL_DAYS` is therefore a threshold for *asking*, not for *concluding* — and at 3 days it asks early on purpose.
Default: **3 working days** (decided, see §6.2), stated in the UI.

#### M3 · Throughput, per project per week

**Definition.** Count of `activity_log` rows with `verb='completed'`, `entity_type='task'`,
bucketed by Asia/Colombo ISO week, grouped by the task's `app_id`.

**Source.** `activity_log` · `tasks.app_id`.

**Worked example.** LogPup, week 2026-W34: 14 completions. Trailing-4-week median: 9.

**What it does NOT mean.** Not comparable across projects (task granularity differs wildly),
and **never divided by headcount** to produce a per-person rate — that is the leaderboard by
another name. It is a project's own trend against its own history, and nothing else.

**Reopen guard.** `verb='reopened'` on the same `entity_id` after a `completed` cancels that
completion out of the count. Otherwise close/reopen/close inflates the number, which is the
first way this measure would be gamed.

### 1.3 Role panels

Each role is asked the question only that role can answer for. Every figure below already
has its source named in §0 or §1.2.

#### Engineer / editor / member

| Figure | Source | Reads |
|---|---|---|
| Stalled tasks they hold | M2 filtered by `tasks.assignee_id` | *work* |
| Days with time logged and nothing written | M1 | *prompt, not verdict* |
| Effort mix | `worklog_entries.category` share | task vs meeting vs review vs support vs admin |
| Rework rate | `activity_log` `reopened` after `completed`, tasks they completed | *quality signal* |

`employment_type` in (`trainee`, `intern`, `probation`) is **displayed on the panel** so
figures are never read against permanent-staff expectations. It changes no threshold; it
changes the reader.

#### Tech Lead — `app_role_history.role = 'lead'`, open interval

The lead's output is **flow**. Every figure is a property of the project, over the interval
they actually held the role (`effective_from` → `effective_to`), so a lead is never shown a
number from before they took it on.

| Figure | Source |
|---|---|
| Cycle time, median | first `activity_log` `created` → `completed`, per task |
| Work in progress | `tasks.status='in_progress'` count vs. contributor count |
| Stalled work in the project | M2, project-scoped |
| Unassigned open tasks | `tasks.assignee_id is null and status <> 'done'` |
| Sprint carry-over | tasks open at `sprints.ends_on`, per sprint |
| Bug reopen rate | `bug_reports.status` transitions via `activity_log` |
| Review latency | `worklog_entries.category='review'` against project throughput |

**Reads no worklog coverage.** See §0 — `logging_expectation='none'`.

#### Project Manager — `app_role_history.role = 'pm'`, open interval

The PM's output is **kept promises and an honest plan**. `tasks` already carries every
column this needs and they exist for exactly this purpose.

| Figure | Source | Note |
|---|---|---|
| Commitments met | `tasks.due_kind='committed'`, completion date from `activity_log` vs `due_date` | the headline PM figure |
| Deadline churn | `tasks.due_changed_count` | increments only on non-null → *different* non-null |
| Plan drift | `tasks.original_due_date` vs current `due_date` | `original_due_date` is write-once by design |
| Commitments naming nobody | `due_kind='committed'` and `due_commitment_note is null` | a promise to no one |
| Follow-ups owed past due | `meeting_followups` | |
| Meeting load created | `meeting_load_decisions` + the `meeting-load` feature | already built |
| Decision latency | `change_requests` pending age | |

**Depends on Part 4** (deadline upload). Until PMs can get committed dates into the system
in bulk, "commitments met" measures a column almost nobody has filled in — and a KPI
computed over four rows is worse than no KPI. **Build Part 4 before this panel ships.**

#### Architect

**Membership comes from `users.title`, normalised — see §6.1.** LogPup has no architect role, so this panel has no history and states that. The figures it carries:


| Figure | Source |
|---|---|
| Cross-project rework | `activity_log` `reopened`, grouped by `app_id` |
| Change requests reviewed / latency | `change_requests` |
| Design comments left | `app_comments` |
| Projects touched vs projects assigned | `worklog_entries.app_id` vs `assignments` |

#### Admin / manager

| Figure | Source |
|---|---|
| Approval latency | `change_requests`, `absences` pending age |
| People with no assignment | `assignments` vs live users |
| Capacity over / under | existing `capacity-hours.ts` |
| Pending signups | `users.status='pending'` |

#### Stakeholder / auditor

**No KPI panel, deliberately.** These are read-only seats that produce no work in LogPup.
Generating figures for them would produce a page of zeroes that reads as poor performance.
The panel says so in one sentence instead.

### 1.4 Fairness rules — non-negotiable, applied before any measure

1. **Absence is invisible.** Days covered by an approved `absences` row are removed from
   every denominator. Note `absence_kind` already includes `other_project` and
   `no_work_assigned`, and the schema comment states both are the studio's problem and must
   not count against the person. This spec honours that.
2. **Schedules are respected.** Working days come from `work_schedules`, `org_holidays`, and
   `src/lib/working-days.ts` (Saturday = 0.5). A 3-day-a-week person is never measured
   against 5.
3. **Role interval scoping.** Lead and PM figures cover only `app_role_history` intervals
   the person actually held.
4. **`null` is not `0`, everywhere, at the type level.** "No data" and "zero" are different
   answers and must be different values. `number | null`, never `number` defaulted to 0 —
   the same rule `signals.ts` already enforces for `mergeableMeetings`.
5. **Minimum denominator.** A ratio over fewer than 5 observations renders as "not enough
   yet", not as a percentage. Three tasks is not a cycle time.

### 1.5 Failure modes and gaming — how each measure breaks

| # | Failure | What LogPup does |
|---|---|---|
| F1 | **Card-shuffling.** M1/M3 reward `activity_log` rows, so moving cards back and forth manufactures activity. | M3 nets out `reopened`; M1 is capped at "a prompt to write a note" and is never aggregated into a person-level figure, so there is nothing to inflate *toward*. |
| F2 | **Task splitting.** Throughput counts completions, so ten trivial tasks beat one hard one. | M3 is never compared across projects or people, only against a project's own trailing median. Cycle-time median moves in the opposite direction and sits beside it. |
| F3 | **Silent deep work misread as idleness.** The §0 ceiling — the most likely real harm here. | M1 is worded as a writing prompt, never shown as a ranking, and is suppressed on absence and non-working days. |
| F4 | **Deadline gaming.** A PM avoids `due_kind='committed'` so nothing can be missed. | "Commitments met" always renders beside the *count* of commitments made. A denominator of zero is visible, not flattering. |
| F5 | **Supervisory zero.** A PM shows no hours and reads as unproductive. | PM and lead panels read no worklog data at all. |
| F6 | **Stale cache drift.** `tasks.due_changed_count` is documented as a recomputable cache over `activity_log`. | Where they disagree, `activity_log` wins — already the schema's stated rule. |

---

## Part 2 — Ignore the template lines in an uploaded bug report

### The bug

`src/features/bugs/bug-csv.ts` writes an import template containing **one example row**
(`BUG_CSV_EXAMPLE_ROW`, "Sprint switcher forgets the backlog"). Its own comment argues the
preview step prevents accidental import: *"it is right there in the table with its title,
waiting to be looked at."*

That is a **human** safeguard, not a code one, and it fails — which is what prompted this
item. `parseBugCsv` has no example-row check. Download the template, add your rows, upload:
the example is filed as a real bug in your project.

### The rule

In `parseBugCsv`, a body row is **dropped as template scaffolding** when every cell that is
populated in that row matches `BUG_CSV_EXAMPLE_ROW` for the same column, compared after
`trim()` and case-folding.

Deliberately **every populated cell**, not "any":

- Untouched example row → every cell matches → dropped.
- Title edited, rest left as the example → title differs → **kept**, because somebody
  filling the template in place is filing a real bug.
- A genuine bug that happens to reuse the example's title → other cells differ → kept.

The row is reported, not silently vanished: the preview gains a line —
*"1 template example row ignored"* — in the same place `ignoredColumns` is already
surfaced. Never an error; the file is valid.

Row numbering is unaffected: `parseBugCsv` already numbers from the top of the file
including the header, and dropping a row must not renumber the ones below it.

### Secondary — pasted issue templates

A description pasted from a GitHub-style issue template carries scaffolding of its own:
HTML comments (`<!-- describe the steps -->`) and headings with nothing under them. Strip
both at intake, in a pure helper, from `bugReportInput.description`:

- Remove `<!-- ... -->` blocks entirely, including multi-line.
- Remove a markdown heading line whose section body is empty.
- **Never** strip a heading that has content under it — the structure is the reporter's.

If stripping empties the description below `min(10)`, **keep the original** and let
validation speak. A helpful cleaner that deletes somebody's whole bug report is worse than
no cleaner.

### Files

`src/features/bugs/bug-csv.ts` (pure, has tests) · `src/features/bugs/report-input.ts`
(pure, has tests) · `bug-csv-import-dialog.tsx` for the one preview line.
No schema change. No migration.

---

## Part 3 — Project people as CSV, with names and emails

### What

On a project page, export the team: **name, work email, project role, allocation %, PM/lead
flag, employment type**.

### Infrastructure — already built, reuse it

`toCsv` / `csvCell` / `csvFilename` in `src/features/admin/bulk-logic.ts` (RFC 4180
quoting, CRLF, and the formula-injection guard on leading `=` `+` `-` `@`) and `downloadCsv`
in `src/features/admin/components/csv-download.ts` (UTF-8 BOM so Excel does not mangle
Sinhala names; `URL.revokeObjectURL` deferred a tick for Safari).

Client-side Blob, no endpoint — the export can only ever contain rows already on the page,
so it cannot hand back a row the reader was not allowed to see. That property is the reason
the pattern exists and must be preserved here.

### Columns

| Header | Source |
|---|---|
| Name | `users.name` |
| Email | `users.email` |
| Project role | `assignments.role` |
| Allocation % | `assignments.allocation_pct` |
| Project position | `app_role_history` open interval → `PM` / `Tech lead` / blank |
| Employment | `users.employment_type` |

### Rules

- **`users.personal_email` is never exported.** The schema comment states sign-in resolves
  `email` and only `email`; the personal address is contact-only and belongs in no bulk file.
- **Removed people are excluded** via the `user_deletions` tombstone table — a person who
  has left must not appear on a current team roster. Note this is the *directory* rule, not
  the *attribution* rule: past work keeps resolving their name elsewhere, as designed.
- **Gate.** Visible to project members, `admin`, `manager`, `superadmin`. **Not** to
  `stakeholder` — a stakeholder seat has no reason to bulk-download staff email addresses.
  `auditor` follows whatever the existing audit-seat policy is; confirm rather than assume.
- Filename: `<app-slug>-team-YYYY-MM-DD.csv` via the existing `csvFilename`.

---

## Part 4 — Deadline upload for PMs and tech leads

### What

A CSV import that sets deadlines on existing tasks in bulk. Mirrors the bug import exactly —
same parser shape, same preview-then-confirm, same per-row reasons.

**Sets deadlines on existing tasks. Does not create tasks.** Creating work from a
spreadsheet is a different feature with different failure modes, and merging the two makes a
typo in a task title silently create a duplicate task instead of reporting a missing one.

### Columns

| Header | Required | Maps to |
|---|---|---|
| `task_id` **or** `task_title` | one of | task lookup, scoped to the project |
| `due_date` | yes | `tasks.due_date` (`YYYY-MM-DD`, Asia/Colombo, string-compared — never `new Date()`) |
| `due_kind` | no | `tasks.due_kind`, `target` \| `committed`, default `target` |
| `commitment_note` | when `due_kind = 'committed'` | `tasks.due_commitment_note` |

A `task_title` matching zero or more than one live task in the project is an **invalid row
with a reason**, never a guess. Ambiguity resolved by guessing is how a client deadline
lands on the wrong task.

### Write rules — these already exist and must be honoured, not reimplemented

- `original_due_date` is **write-once**, on the first `null → non-null` transition only.
  The schema comment is explicit: not on a move, a clear, a restore, or a reassignment.
- `due_changed_count` increments **only** on `non-null → different non-null`. First-set and
  clear both leave it alone.
- The action layer — not a CHECK constraint — requires `due_commitment_note` when
  `due_kind='committed'`. The import calls that layer rather than writing rows directly.
- Every changed task writes an `activity_log` row. Without it the PM panel's "commitments
  met" has no completion clock, and a bulk deadline change is invisible in the timeline —
  the one change most worth being able to trace.

### Permission

The project's **current PM or lead** (open `app_role_history` interval), or `admin` /
`superadmin`. Checked server-side in the action, never in the dialog.

### Template

Ships with the same one-example-row convention as the bug template — **and Part 2's
example-row rule applies to it from day one**, so this import cannot repeat the bug it was
copied from.

### Files

`src/features/deadlines/deadline-csv.ts` + test (pure) · `import-actions.ts` (`'use server'`) ·
a dialog modelled on `bug-csv-import-dialog.tsx`. Reuses `splitCsvRows` — extract it from
`bug-csv.ts` to a shared CSV module rather than copying it; a second RFC 4180 parser in this
repo is a future divergence.

**No schema change. No migration.** Every column this needs already exists.

---

## Part 5 — Where it all surfaces

- **`/intel`** — M2 (stalled work) becomes a new `SignalKind`. Adding one breaks the
  exhaustive switches in `briefing-fallback.ts` and `intel/page.tsx` *on purpose*; fix each.
- **`/progress`** — the role panels live here, one panel per role the reader holds, plus the
  project panels for projects where they are PM or lead.
- **`/apps/[slug]`** — project throughput trend (M3), stalled work, team CSV (Part 3),
  deadline import (Part 4).
- **`/people/[id]`** — engineer panel, own-profile and manager view only.
- **`/admin`** — the admin/manager panel.

---

## Part 6 — Decisions *(answered 2026-08-22)*

1. **Architect role — derive from `users.title`.** No migration. The consequences are real
   and are handled rather than ignored:
   - Titles are matched through a **normaliser**: lowercased, punctuation and whitespace
     collapsed, then tested against a known alias set (`architect`, `solution architect`,
     `software architect`, `technical architect`, `principal architect`, `system architect`,
     …). The alias list is a pure, tested constant — not a regex buried in a query.
   - A title that normalises to nothing recognised is **not** an architect. Silent misses
     are the accepted cost of this option, so the panel states its own membership rule and
     lists who it matched, letting a wrong answer be seen rather than guessed at.
   - **There is no history.** `users.title` is current state with no interval, so architect
     figures are *as-of-now over the whole window*, not scoped to when the person held the
     title — unlike PM and lead, which are interval-scoped via `app_role_history`. The
     panel says so. If the role ever needs history, that is when it earns an enum.
2. **`STALL_DAYS` = 3 working days.** Saturday counts 0.5. Stricter than the proposed 5:
   catches a stall sooner, at the cost of more rows that turn out to be "it is just a hard
   task". The threshold is stated in the UI so a reader can discount accordingly.
3. **Minimum denominator = 5 observations** before any ratio renders a percentage.
4. **Auditor seat and the team CSV** — still to confirm against the existing audit policy.
   Until confirmed, `auditor` is treated as **not granted** bulk email export: the
   restrictive default is the recoverable one.
5. **Part 2 — both strippers in scope.** The CSV example-row drop *and* the pasted
   issue-template cleaner.

---

## Part 7 — Out of scope

Git, CI, or editor telemetry · any per-person composite score, index, or ranking · time
tracking that is not self-reported · comparing throughput across projects · comparing people
to each other anywhere in the product · retroactively inferring completion dates for tasks
completed before `activity_log` covered them.

---

## Part 8 — Testing

Every module in Parts 1–4 is **pure**: no `@/db` import, no `new Date()` — `todayIso`
arrives as a parameter, the same contract `signals.ts` and `src/features/meeting-load/`
already keep. Each gets a vitest file beside it, tested by value.

Specific cases that must exist:

- M1 returns **null**, not 0, for a person with no worklog rows at all.
- M1 is suppressed across an approved absence, a holiday, and a non-working weekday.
- M2 counts Saturday as 0.5 of a working day.
- M3 nets a `reopened` against its prior `completed` (F1).
- A PM with `logging_expectation='none'` produces a full panel with no zeroes.
- A lead's figures exclude the period before their `app_role_history` interval opened.
- An untouched `BUG_CSV_EXAMPLE_ROW` is dropped; the same row with an edited title is kept.
- Description stripping that would empty the field returns the original untouched.
- A deadline row whose `task_title` matches two live tasks is invalid, with a reason.
- `original_due_date` is unchanged by a second deadline import.
- The team CSV never contains `personal_email`, and excludes a tombstoned user.

Existing guards that will fire and must be satisfied, not bypassed: `src/db/live.test.ts`
(soft-delete `live*` reads, `DELETE_ALLOWED_FUNCTIONS`) and
`src/features/search/registry/registry.test.ts` (`NO_COMMANDS` / `NO_SEARCH` need written
reasons for any new feature directory).

---

## Part 9 — Order of work

1. **Part 2** — bug template rows. Smallest, pure, fixes a live data-quality bug today.
2. **Shared CSV module** — lift `splitCsvRows` out of `bug-csv.ts`.
3. **Part 3** — team CSV. Reuses existing infrastructure, no new reads.
4. **Part 4** — deadline import. *Gates the PM panel.*
5. **Part 1 pure modules** — M1, M2, M3 + fairness rules, with tests, no UI.
6. **Part 1 queries** — batched reads, `live*` throughout.
7. **Part 5 surfaces** — `/intel` signal first, then the role panels.

All §6 decisions are answered, so every part below is unblocked.

