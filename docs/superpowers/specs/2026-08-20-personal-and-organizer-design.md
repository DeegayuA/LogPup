# Personal Capture and the Organizer — `personal_items`, Promote-and-Assign, `/my-day` — Design

Date: 2026-08-20
Status: awaiting review
Spec D of 5 (see "Why this is five specs" in the substrate spec). Depends on A and C,
and on B for one step only — promoting an item to somebody other than yourself.

## Purpose

Four failures. The first three are about the same missing row; the fourth is
about the same missing row appearing twice.

1. **There is nowhere in LogPup to write something down for yourself.** Thirty-four
   tables in `src/db/schema.ts:77-1214`, and every content-bearing one is keyed to
   an app, a sprint, or a meeting. The only user-keyed rows in the whole schema are
   `daily_worklogs` (one per person per day — a report, not a list), `absences`,
   `user_ai_prefs`, `gemini_keys` and `webauthn_credentials`. Not one of them is a
   place to put "call the bank about the invoice". So that work lives in WhatsApp
   and Notes.app, and the studio's picture of anyone's day is systematically
   missing everything that was never a ticket.

2. **The fastest input surface in the product refuses exactly this.** `quickAssignTask`
   returns `'Start with a teammate's name, e.g. "shanika fix the login flow today"'`
   — `src/features/search/actions.ts:147`. ⌘K can create work for somebody else and
   nothing at all for you. The one keystroke people already have muscle memory for
   dead-ends on the most common case.

3. **The dashboard already renders four parallel lists of one day and reconciles
   none of them.** `MyDayZone` (`src/features/dashboard/components/dashboard-zones.tsx:90`)
   fans out to a tasks card, a follow-ups card, a meetings card and a notifications
   card, each with its own ordering. `getPersonFollowups`
   (`src/features/people/queries.ts:834`) never reads `resolvedByTaskId`
   (`schema.ts:678`) — so a follow-up already matched to a task renders once as a
   follow-up and once as a task, and closing the task silently resolves a row the
   person is still looking at. This is not a dedupe risk to design against; it is
   live double-counting on the most-visited page in the app.

4. **"Give this to someone else" has no moment.** Today it is one shot through
   `quickAssignTask` with no preview of what becomes visible, and — because
   `task-actions.ts` never imports `createNotifications` — no signal to the person
   receiving it. The moment work crosses from private to shared is the single most
   consequential act in this whole scope, and it currently has no ceremony, no
   preview, and no audit distinct from an ordinary task creation.

The thing that makes this one spec rather than two is that both halves are
governed by one rule: **privacy has to be a property of the table, not a property
of every query that reads it.** Get that wrong and people stop using it, at which
point the organizer has nothing to organize.

## Decisions

### The privacy boundary is a table boundary, not a `WHERE` clause

`scopeSourceFor` (`src/features/auth/capabilities.ts:250`) derives every scope in
the product from apps. A row with no app therefore has no scope — and the seats
that hold `all` do not care about scope at all: `task.edit` is `all` for admin and
superadmin (`capabilities.ts:104`), `trash.view` is `all` for auditor
(`:131`), `audit.view` is `all` for auditor (`:146`).

So a "private" row living inside `tasks` is readable by three seats **by
construction**, and stays private only for as long as roughly a dozen existing
readers — board view, `task-workload.ts`, `people/queries.ts`, `my-day-stats`,
activity, trash, ⌘K — each remember a filter nobody wrote a test for. Omission
fails open, silently, permanently.

**Rejected: `tasks.app_id` nullable plus an `is_private` flag.** This is the
obvious move and the worst one available. Beyond the scope hole above it breaks
`tasks_app_sprint_sort_idx` (`schema.ts:337-339`), `activity_log`'s denormalized
`appId`/`appName`, and every capacity query — and it requires an
`app_id IS NOT NULL` clause in a dozen readers where one omission is a permanent
leak with no failing test.

**Rejected: Postgres row-level security.** `neon-http` is stateless per statement;
there is no session to set a GUC on, and the repo has no RLS anywhere to model it
on. A security mechanism nobody in the codebase can already read is a security
mechanism nobody will maintain.

A separate table has no reader that is not `owner_id`-keyed, because it has no
reader at all until this spec writes one.

### No `app_id` and no `assignee_id`, by construction

`owner_id` is immutable after insert and no server action accepts an owner or an
assignee parameter. There is no transfer path.

"Give it to someone else" IS the moment it stops being personal, and that path is
promote-and-assign, which is public and audited.

**Rejected: an `assignee_id` column governed by a rule.** A column that exists
gets filled. The first time it does, the row is a task without permissions,
without an app, without a board and without an audit trail — and the second time
it does, somebody asks why it does not appear on a sprint.

### Promotion is a copy, and the note never crosses

Exactly these fields cross the boundary:

| `personal_items` | → `tasks` | why |
|---|---|---|
| `title` | `title` | the sentence already written; retyping it is friction with no privacy benefit |
| `due_date` | `due_date` | your date becomes the shared date. Spec C's `due_kind` defaults to `'target'` — promotion never mints a commitment |
| — | `app_id` | chosen in the dialog, required. Defaults to the person's highest-allocation app, the fallback `quickAssignTask` already uses |
| — | `assignee_id` | chosen in the dialog. May be yourself |
| — | `assignment_state` | **an assignee other than yourself opens an OFFER**, not an assignment — spec B's handshake, see below |
| — | `description` | typed fresh in the dialog. Empty by default |
| `note` | **never** | this is the entire point of the feature |
| sub-items | **never** | the checklist is your working method, not the deliverable |
| `sort_order` | not copied | `rankForAppend` on the target board |

The private `note` is **shown beside** the box the public description is typed
into, read-only. Copying is a keystroke; auto-filling is an accident, and the
accident is irreversible the moment the task is created.

The `personal_items` row survives with `promoted_task_id` set.

**Promoting to somebody else opens an offer; it does not hand them the work.**
Spec B's rule is that assigning to anyone but yourself opens an offer interval in
`task_assignment_history` with `assignment_state = 'offered'` and emits
`task.offered`, and promotion is a **fourth** write path to `tasks.assignee_id`
alongside `updateTask`, `moveTaskOnBoard` and `bulkUpdateTasks` — the one nobody
would think to look at, because it starts on a private list. A promotion that
wrote `assignee_id` directly would be the single door in the product that skips
the handshake, and the person on the other end would learn about the work from
the board rather than from a bell. So the two-step preview dialog says
**"Nuwan will be asked to accept"**, never wording that implies the work has
landed, and the item's own row reads "offered to Nuwan" until they answer.
Self-promotion lands `accepted` directly, per spec B's self-assign rule, with no
offer and no notification. Spec B's test 8 covers this door.

**Rejected: promotion as a move.** Deleting the personal row loses your handle on
work you originated at the exact moment it becomes other people's business, and
takes the note with it — the note that says why you wanted it in the first place.

**`@mentions` are processed exactly once, at promotion.** A `@Name` typed into a
private title or note renders as plain text and notifies nobody — running
`extractMentionedUserIds` over private text would leak the existence of the item
through the bell. Promotion runs it once, against the description actually copied.

### Status mirrors, one way, through spec A's consolidation

Once `promoted_task_id` is set, the item's own status control is disabled and its
status derives from the task. This is not a new mechanism: `meeting_followups`
already does exactly this through `resolvedByTaskId` (`schema.ts:678`) and
`syncLinkedFollowups` (`src/features/sprints/task-actions.ts:187`). Nothing is
ticked twice.

**The mirror rides `transitionTaskStatus`, spec A's consolidation, and must not be
hand-wired.** `syncLinkedFollowups` is called from `updateTask` (`:425`) and
`moveTaskOnBoard` (`:551`) and **not** from `bulkUpdateTasks` (`:570`) — so a bulk
move already leaves linked follow-ups open today. Wiring a second mirror into two
of three status writers would reproduce that bug on a second table. This is
precisely the accretion spec A consolidates to prevent, and it is why spec D
cannot ship before it.

### The auditor carve-out — the parked question, re-opened

The RBAC spec parked this deliberately: "Resolving the still-open *private notes*
question — unrelated, and it must not ride along on these migrations." This spec
is where it comes due, and it is stated here rather than smuggled in under a
different name.

Two capability rows. They are **not** the same shape, and an earlier draft of
this spec made them so — which would have 404ed `/my-day` for everybody.

| Action | superadmin | admin | manager | editor | member | stakeholder | auditor | `ownerId` source |
|---|---|---|---|---|---|---|---|---|
| `personal.item.manage` | own | own | own | own | own | none | none | `personal_items.owner_id` |
| `organizer.view` | all | all | all | all | all | none | none | — (no resource) |

**`organizer.view` is granted `all`, not `own`, and the reason is mechanical.**
`can()` is pure, synchronous and fails closed: `if (level === 'own') return owns`,
where `owns = resource?.ownerId != null && resource.ownerId === actor.id`
(`src/features/auth/capabilities.ts:286-298`, verified). A route render has no
resource to pass, so `can(actor, 'organizer.view')` at level `own` returns
`false` for **every** seat — `/my-day` would 404 for admins and members exactly
as it does for the stakeholder this spec intends to exclude, and the test that
only asserts the stakeholder and auditor 404 would ship green. `organizer.view`
is a surface-level read of your own page with no row behind it, so it takes the
shape `trash.view` and `audit.view` already use: `all` for the seats that hold
it, `none` for the seats that do not. The scoping is done by the *query* —
every read on `/my-day` is filtered to `actor.id` — never by the grant level.

**`personal.item.manage` stays at `own`, and its `ownerId` source is named in
the row above rather than inherited silently**, the discipline spec B pins for
`task.assign.answer` and spec C for `deadline.set`. A new action that inherits
its owner source by convention is a permission bug waiting for its first
ambiguous row.

**CREATE is guarded by the write, not by `can()`.** There is no row yet, so
there is no `ownerId` to check: passing `{ownerId: actor.id}` would be true by
construction and gate nothing, and passing nothing would deny every create. So
create is guarded by the seat holding `personal.item.manage` at all — i.e.
`capFor(role, 'personal.item.manage') !== 'none'` — and by the insert writing
`owner_id = actor.id` from the session, never from the form. Every other verb
(edit, complete, reorder, soft-delete, restore, purge, promote) loads the row
first and passes it as the resource, so `own` does real work there. Said out loud
because "the create check passes for everyone" looks like a bug to the next
reader, and it is the correct behaviour: a person may always write their own
private list, and cannot write anybody else's because the owner column is not
theirs to set.

There is deliberately **no `personal.item.view` action at any level.** A read
action is the cell somebody widens to `scoped` in six months "just for leads",
and the widening looks like a one-line diff.

**The auditor row is the carve-out, and it is real.** `capabilities.test.ts:48-58`
asserts the auditor holds no write anywhere; the auditor's *read* promise —
read-only across everything, including `activity_log` and trash — is prose in the
RBAC spec, not a test. `personal_items` is the first table in the schema the
auditor cannot read.

The justification, so nobody re-litigates it: an auditor reads the record of the
organisation's decisions. An unpromoted personal item is not a decision the
organisation made. It wrote no `activity_log` row, changed no shared state,
appeared in no report and bound nobody. There is nothing there to audit. The
moment it becomes a decision — promotion — it becomes a `tasks` row, and the
auditor reads it in full along with the `activity_log` entry promotion writes.
The carve-out is not "some organisational acts are unauditable"; it is "not
everything a person types is an organisational act".

The consequence, said out loud rather than discovered: **LogPup keeps no record
that a private item ever existed.** Create, edit, complete and delete of an
unpromoted item write no `activity_log` row. That is the correct trade and it goes
into the schema comment on the table, so a future compliance question is answered
by reading the table rather than by somebody quietly adding logging to the private
path.

**And the RBAC spec's auditor row is amended in the same change that lands this
one.** `2026-08-19-admin-rbac-design.md` currently defines the seat as "Read-only
across everything including `activity_log` and trash", which this spec makes
false in two ways at once — one table the auditor cannot read, and one class of
act that writes no `activity_log` row to read. Leaving the amendment for later
means the ladder answers a compliance question wrongly, in writing, from the
document people go to for exactly that answer. The RBAC row names
`personal_items` as the single documented exclusion and links here for the
argument; the same sentence goes in the schema comment, so the exclusion is
discoverable from both directions.

And the structural refusal, because it will be tested within a quarter: a lead
will ask to see personal items "just so I know what people are working on". If
there is a config flag it gets turned on, and the day it does everyone moves back
to Notes.app and the data is gone permanently. There is no scoped read path to
switch on. That is the mechanism, not the policy.

`personal.item.manage` matches the write-action regex at `capabilities.test.ts:49`
(`manage`), so the existing auditor sweep already pins the auditor cell at `none`.
Widening it turns a shipped test red rather than passing review.

### `personal_items` joins `SOFT_TABLES`, and that costs five edits

The table carries `deleted_at`/`deleted_by`, so check 5 (`src/db/live.test.ts:501`)
fails the build unless it is registered. All five edits land in the same commit as
the table, before any reader exists — the `meetingApps` precedent, and the reason
that precedent is written down:

1. `livePersonalItems` / `livePersonalItemsAs` in `src/db/live.ts`.
2. A `SOFT_TABLES` entry.
3. `live.test.ts:29` asserts `SOFT_TABLES` covers an exact set of soft-deleted
   tables, by name. On disk today that set is **six** — `apps`,
   `meeting_note_segments`, `meeting_screenshots`, `meetings`, `sprints`,
   `tasks` (`apps` joined with `drizzle/0043_app_soft_delete.sql`). It becomes
   **seven**. **This spec owns that count**, and the diff comment says so: the
   assertion is going six → seven for `personal_items` and for nothing else.
   Spec C deliberately does not pin a total — its satellite carries no
   `deletedAt` and asserts its own absence instead — so a reviewer seeing this
   guard test edited is seeing the one spec entitled to edit it.
4. `SOFT_TABLE_NAMES` (`live.test.ts:152`) gains `personalItems`. That regex — not
   the array in `live.ts` — is the actual enforcement for checks 1 and 2, and it
   can only see a table named in it as a literal.
5. `DELETE_ALLOWED_FUNCTIONS` gains `purgeOwnPersonalItem`.

Restore is owner-only, from an owner-only "Recently deleted" on `/my-day`.

**Admin Trash does not list personal items, and the mechanism is omission.**
`getTrash` (`src/features/admin/trash-queries.ts:45`) is an explicit six-source
enumeration, not a scan over `SOFT_TABLES`. So the exclusion costs nothing — but
it also looks like an oversight to the next person who "completes" that list, and
completing it would ship the leak. A comment in that file states why the seventh
source is absent.

### Check 6 — the owner predicate is enforced by a file scan

New check in `live.test.ts`, in the house style: any file under `src/` that names
`personalItems` in a `.from(` / `*Join(` / `alias(` must also contain
`eq(personalItems.ownerId` somewhere in the same file.

It is file-scoped and therefore imperfect, exactly like checks 1 through 4, and
its comment says so. What it buys is turning "somebody forgot the `WHERE`" from an
undetectable privacy leak into a red test on the commit that introduces it.

**Rejected: trusting code review.** The four checks already in that file exist
because review did not catch the equivalent mistakes on `meetings`.

### `/my-day` is a read. It owns no status.

Six named buckets, first match wins, in this order. Each answers a different
question, which is why they are not merged:

| Bucket | The question | Contents |
|---|---|---|
| `now` | what is happening in the next 90 minutes | meetings in progress or starting within 90 minutes |
| `late` | what did I already miss | anything dated before today — tasks, follow-ups, personal items |
| `today` | what is due today | anything dated today |
| `owed` | who is waiting on me | open `meeting_followups` you own, dated or not |
| `moving` | what am I in the middle of | tasks at `in_progress` not already placed |
| `mine` | what did I write down for myself | undated personal items, newest first |

An item appears in **exactly one** bucket. That rule is one sentence, and it is the
entire ordering argument. Within a bucket: `dueOrStartIso ?? '9999-12-31'`, then
priority descending, then age descending (oldest debt first), then source rank
(meeting, task, follow-up, personal), then id — total and deterministic.

**Rejected: a computed relevance score.** An urgency number blending due date,
priority, age and meeting proximity is the reason people distrust planners.
Nobody can predict it, nobody can argue with it, and one tweak silently reorders
everyone's day. The first person who disagrees with their own list stops opening
the page, and they are right to.

Every row carries a one-sentence reason for its placement: "3 days overdue", "due
today", "10:00 – 10:30", "open since 12 Mar", "no date". Bucket meaning is never
carried by colour alone — `--success` / `--warning` / `--destructive` colour the
badge and a word states what it means. `--chart-*` is for chart series and is not
used here.

Each bucket caps at **7 rendered rows** with an explicit "+N more" that expands in
place, and shows its true count. No infinite scroll of debt: a page that renders
forty overdue items is a page people close.

**Dedupe is hard, and it lives in the pure module, not in the tiles:**

- a personal item with `promoted_task_id` set → the task renders, the item does not
- an open follow-up with `resolvedByTaskId` set → the task renders, the follow-up
  does not (this is failure 3, fixed)
- a personal item whose `linked_task_id` matches a rendered task → folds into that
  row as "your note", never a second row

`buildMyDayStats` (`src/features/dashboard/my-day-stats.ts:28`) reads the same
module, so the tiles and the list can never disagree. Putting dedupe in the tile
builder is how "Due soon" ends up permanently one higher than the list below it.

Inline actions write to the source of record and nowhere else: `updateTask`
(`task-actions.ts:349`), `resolveFollowup` (`meetings/ai-actions.ts:2296`),
`respondToMeeting` (`meetings/rsvp-actions.ts:66`). The organizer has no status
column of its own, because the moment it has one it is a fourth to-do list telling
a fifth story about the same work.

### The organizer and the daily worklog: two ends of one day, one seam

This is the question that decides whether either surface gets used, so it is
answered rather than left to emerge.

- **`/my-day` is morning intent.** Read-only, mostly over other people's records,
  and it is not a record of anything.
- **`/worklog` is the evening first-person statement.** `daily_worklogs.percent`
  means "of what I planned today", self-scored (`schema.ts:984-986`), and
  `coverage.ts` treats the row's existence as evidence a person showed up.

They do not compete because they answer different questions in different tenses,
and only one of them is a record. The whole coupling is **one row at the bottom of
`/my-day`**: a close-out that says whether today is already logged and links to
`/worklog`. One sequence, not two lists.

Three couplings deliberately not built:

- **The organizer never writes `daily_worklogs`, and `percent` is never derived
  from completed items.** Derive it and a self-report becomes a metric people game
  by splitting tasks — and the one honest number in the product stops measuring
  anything. This is irresistible the moment `tasks.completed_at` exists, which is
  why it is refused here in writing rather than in review.
- **The organizer does not feed the AI note draft.** `draftWorklogNote`
  (`src/features/worklog/draft-actions.ts:24`) already reads the caller's own
  `activity_log` for the day and needs no new input — every promoted task the
  person closed is already in there. A private item is not, by design, and piping
  private text into a Gemini prompt for a note the person then publishes is exactly
  the boundary crossing this spec exists to prevent. **Zero change to
  `draft-actions.ts`.**
- **`/my-day` does not replace the dashboard's My Day zone in this spec.** The zone
  keeps its four cards; `/my-day` is the reconciled view and the capture surface.
  Retiring the zone is a follow-up once the organizer has been used for a month,
  and doing it in the same change would put a dashboard rewrite inside a privacy
  review.

### ⌘K stops dead-ending

No parsed assignee → create a **personal item**, and say so: "Saved to your list —
private". A parsed assignee still means a real task on a real app, byte-for-byte as
today. This replaces the refusal at `search/actions.ts:147` with the thing the
person was most likely trying to do.

Personal items enter `universalSearch` through one owner-keyed provider — the
`ctx` seam spec A builds — and the predicate is in the query, never in a filter
downstream. ⌘K is a shared surface: one forgotten `WHERE` turns the palette into a
private-notes leak with autocomplete, which is why check 6 exists.

### Route and guard

`/my-day`, nav jump key **`T`** — D, W, A, P, M and V are taken
(`src/components/shell/nav-items.ts:32-46`) and letters must be unique.

A stakeholder or auditor navigating to `/my-day` gets `notFound()`. The guard is
`can(actor, 'organizer.view')` with **no resource argument**, which is why that
action is granted `all` rather than `own` — see the carve-out section; `can()`
fails closed on `own` with nothing to own, so the `own` version denies every
seat. This repo does not set `experimental.authInterrupts`, so `unauthorized()`
and `forbidden()` are unavailable; and a per-route 404 is the correct answer
anyway — a client seat must not learn the surface exists. `params` and `searchParams` are Promises in Next 16;
`error.tsx`'s second prop is `retry`, not `reset`.

## Data model

**This spec adds exactly one table and zero columns to existing tables.**
`tasks.completed_at` and `tasks_assignee_open_idx` come from spec A.
`tasks.kind`, `meeting_followups.due_date` **and the
`meeting_followups (user_id, status, due_date)` index** all come from spec C —
the index keys a column only C adds, so C ships it in the same migration as the
column and spec A no longer lists it at all. If any of them is missing, this spec
does not build.

**`personal_items`** — the private antechamber to `tasks`. Promotion is the only door.

```
id                 uuid PK default gen_random_uuid()
owner_id           uuid NOT NULL references users(id) ON DELETE CASCADE
title              text NOT NULL
note               text
status             text NOT NULL default 'open' CHECK (status IN ('open','done'))
completed_at       timestamptz
due_date           date
parent_id          uuid references personal_items(id) ON DELETE CASCADE
depth              smallint NOT NULL default 0 CHECK (depth IN (0,1))
sort_order         double precision NOT NULL default 0
promoted_task_id   uuid references tasks(id) ON DELETE SET NULL
linked_task_id     uuid references tasks(id) ON DELETE SET NULL
linked_meeting_id  uuid references meetings(id) ON DELETE SET NULL
linked_followup_id uuid references meeting_followups(id) ON DELETE SET NULL
created_at         timestamptz NOT NULL default now()
updated_at         timestamptz NOT NULL default now()
deleted_at         timestamptz
deleted_by         uuid references users(id)

CHECK ((linked_task_id IS NOT NULL)::int
     + (linked_meeting_id IS NOT NULL)::int
     + (linked_followup_id IS NOT NULL)::int <= 1)
```

Reasons for the non-obvious ones:

- **`owner_id` cascades.** An offboarded person's private list has no successor and
  no reader; there is nothing for a tombstone to serve.
- **`note` is a separate column from `title` precisely so promotion can copy one
  and not the other.** One text field would make the boundary a substring rule.
- **`status` is `text` + `CHECK`, not a `pgEnum`.** The repo's standing rule, stated
  at `schema.ts:898-901` for `activity_log.verb`: a new state is a string at a call
  site, not a migration — and Postgres cannot use a freshly added enum value in the
  transaction that adds it, which this schema warns about twice.
- **`due_date` is a `date`**, compared as `YYYY-MM-DD` against a business-timezone
  `todayIso` from `isoDayOf` (`src/features/people/iso-day.ts:73`), never parsed
  into a `Date`. Backdating is allowed — deliberately **not** the worklog's
  `isFutureWorkDay` guard (`worklog-day.ts:33`). "I should have done this Tuesday"
  is normal for a to-do and forbidden for a worklog, because one is a plan and the
  other is a claim about work done.
- **`depth` is capped at 1** by a `CHECK`, and the create action rejects a parent at
  depth 1 with "Checklists are one level deep — promote this into a task instead."
- **`sort_order` is `double precision`** and reuses `src/features/sprints/task-rank.ts`
  (`rankBetween`, `planInsert`, `rankForAppend`, `RANK_GAP`). Every read orders by
  `(sort_order, created_at, id)` — the default is 0 and ⌘K inserts at 0, so ties are
  normal and a bare `ORDER BY sort_order` returns a list that reshuffles itself
  between renders. That is the trap `schema.ts:319-323` already documents for tasks.
- **Every link FK is `ON DELETE SET NULL`, never `CASCADE`.** Deleting a meeting
  must not delete your private note about the meeting.
- **At most one link.** A row that is simultaneously about a task, a meeting and a
  follow-up has no rendering and no reason.

**Four indexes**, one per access path:

```
(owner_id, status, sort_order)  WHERE deleted_at IS NULL                    -- the list
(owner_id, due_date)            WHERE deleted_at IS NULL AND status='open'  -- the date buckets
(parent_id)                     WHERE deleted_at IS NULL                    -- checklist expansion
(promoted_task_id)              WHERE promoted_task_id IS NOT NULL          -- the status mirror
```

The mirror index earns its place because it is consulted inside every task status
write, not on a page render. `notifications` shipped with zero indexes and is now
polled by every signed-in browser (spec A, failure 3); this table is read on every
`/my-day` render and must not repeat it.

**Two capability rows** in `src/features/auth/capabilities.ts`, `own` or `none` and
nothing else, with the auditor carve-out written above them as a comment.

## Migrations

One migration, one table, one concern. Hand-written SQL plus a hand-written
`drizzle/meta/_journal.json` entry; `drizzle-kit generate` is forbidden in this
repo. Replay-safe throughout, modelled on `drizzle/0034_app_role_history.sql`:
`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and a
`DO $$ … EXCEPTION WHEN duplicate_object THEN null; END $$;` wrapper for each
`ADD CONSTRAINT`, which has no `IF NOT EXISTS` form.

**The number is allocated at merge time, not here.** `main` is at `0043` today
(`drizzle/0043_app_soft_delete.sql`) and `0040` was claimed by four parallel
sessions at once. Journal `when` values must strictly increase against
then-current `main`.

No enum. Nothing in this spec ships `ALTER TYPE … ADD VALUE`.

No migration runs against any database without explicit human approval, and it is
verified against `information_schema` rather than the runner's exit code —
`npm run db:migrate` has reported success while applying nothing.

## Pages & flows

**`/my-day`** — server-rendered, wrapped in React `cache` (the `getSession` pattern
at `src/lib/session.ts` is why), reading five sources. It does not poll. Suspense
boundaries stream, with controls painting before data — the `people/history`
pattern.

- The six buckets, capped, each row with its reason sentence.
- A right-hand rail holding the capture box and the full private list, expandable
  from the `mine` bucket header. One route, because two routes for one person's own
  items is the third to-do list.
- "Recently deleted" — owner-only, restore and purge.
- One close-out row at the bottom: whether today is logged, and a link to `/worklog`.

**Promotion** — a two-step dialog. Step two is a preview that names, in words,
exactly what becomes visible and to whom: *"Everyone on Falcon will see this title
and description. Your note and your checklist stay private."* It requires both
`can(actor, 'personal.item.manage')` and `can(actor, 'task.create', { appId })`
against the target app — composed from two existing checks rather than a new
`personal.item.promote` cell that could later be widened.

**Empty states.** A new account's `/my-day` is a capture box, not "You're all caught
up" — the second is a lie about an empty account, and it is the first thing a new
hire sees. Empty, loading and error states for every bucket; skeletons, not
spinners. Bilingual Sinhala + English where the surrounding surfaces already are;
never force-translate. Personal item titles are the person's own text and are
stored as typed — never translated, and never frozen into a notification sentence
(spec A's `title_key` + `params` rule governs generated text, of which this spec
generates none).

**⌘K** — no assignee parsed, create a personal item and say it is private.

## Error handling

Every server action returns `ActionResult` from `@/lib/action-result`, calls the
capability guard before touching the database, and never throws. Client-side hiding
is presentation only.

- **Double promotion** (double-click, two tabs). There are no transactions on
  `neon-http`, so the guard is inside the write:
  `UPDATE … SET promoted_task_id = $1 WHERE id = $2 AND promoted_task_id IS NULL RETURNING id`.
  Zero rows means somebody already promoted it — the action returns `ok` with the
  existing task id, never a second task.
- **Parent completed with open children.** Mark the parent done, touch no children,
  render "2 unfinished steps". Silently closing children destroys information the
  person deliberately entered.
- **Parent soft-deleted.** `ON DELETE CASCADE` does not fire on a soft delete, so
  children are soft-deleted in the same batch. An orphaned child is unreachable and
  still counts in the organizer.
- **Promoted task trashed.** `ON DELETE SET NULL` does not fire either. The item
  reads through `liveTasks`, finds nothing live, reopens itself and says "the task
  this became was deleted" — and re-mirrors if the task is restored from Trash.
  Staying done forever silently loses an item still owed.
- **Promoted task reassigned.** The item stays yours and stays linked, relabelled
  "now with Nuwan". Disappearing loses your thread on work you originated.
- **Linked meeting deleted.** The column goes null; the item keeps its title and
  note and degrades to "(meeting removed)". It never vanishes.
- **`sort_order` collapse** after ~50 inserts at one spot: call `planInsert` and take
  its rebalance branch, never a raw midpoint.
- **Two tabs dragging the same item.** Last write wins on a `double precision`
  column, which is acceptable; the list re-fetches on focus so the loser's tab does
  not show a stale order.
- **Promotion notifies nobody until spec B lands.** Spec A ships the substrate with
  zero kinds, and the kind promotion needs is **`task.offered`** — spec B ships
  that one and deliberately ships no `task.assigned`, because a bare "assigned"
  bell re-cut as an offer two weeks later teaches two meanings for one row.
  Until `task.offered` exists, promoting to somebody else is **disabled in the
  dialog**, not silently un-notifying: an offer nobody is told about is an offer
  nobody answers, and it would leave the task parked in `offered` forever.
  Self-promotion works from day one, since it opens no offer and notifies nobody
  by design. The dialog says which one is unavailable and why, so the gap is
  visible rather than looking broken.

## Testing

TDD, following `permissions.test.ts` and `missing-days.test.ts` conventions —
Vitest, relative imports, no globals. `vitest.config.ts` includes `src/**/*.test.ts`
only; `.tsx` is not matched, so every assertion below lives in a `.ts` module.

Pure, table-driven, in `src/features/organizer/agenda.test.ts`:

1. **Bucketing.** One fixture day with a meeting in 40 minutes, a 3-day-overdue
   task, a task due today, an undated owed follow-up, an `in_progress` task and two
   undated personal items. Assert every item's bucket, the total order, and the
   exact reason string.
2. **Dedupe.** A personal item with `promoted_task_id`, a follow-up with
   `resolvedByTaskId`, and a personal item whose `linked_task_id` matches a rendered
   task. Assert one row each, and which one survives.
3. **Cap.** Twelve overdue items render 7 plus "+5 more", and the bucket count reads
   12, not 7.
4. **Promotion field map.** A pure `promotionPayload(item, form)` asserting `note` is
   absent from the output and `description` comes only from the form. This is the
   test that must go red if anyone ever "helpfully" pre-fills the description.
5. **Depth guard.** A child of a depth-1 item is rejected with the checklist message.

Structural, in `src/db/live.test.ts`:

6. **Check 6** — every file reading `personalItems` also names `eq(personalItems.ownerId`.
7. `SOFT_TABLES` covers exactly **seven** tables — the six on disk today plus
   `personal_items` — and `personalItems` is in `SOFT_TABLE_NAMES`.

Capability, in `capabilities.test.ts`:

8. `personal.item.manage` is `own` for the five seats that hold it and `none` for
   `stakeholder` and `auditor` — never `scoped` or `all`, asserted as a negative
   over the whole row so widening turns it red. `organizer.view` is `all` for
   those same five and `none` for the other two, asserted the same way; **and one
   assertion that `can(actor, 'organizer.view')` with NO resource returns `true`
   for each of the five**, which is the test that would have caught the `own`
   version and the only one that actually exercises the route guard's calling
   convention.
9. No action key matching `/^personal\.item\.view/` exists.

Integration, mocked-`db` idiom:

10. A second user's id returns zero personal items from every read path.
11. `/my-day` **renders for admin, manager, editor and member** — the assertion
    that would have caught `organizer.view` granted at `own`, since `can()` fails
    closed with no resource and every seat would have 404ed — and returns 404 for
    a stakeholder and for an auditor.
12. Double promotion returns the same task id twice and creates one task.

## Build order

1. The table plus the five `live.ts` / `live.test.ts` edits, and check 6. **Lands
   alone** — it is the only step that touches build gates, and a failing gate mixed
   into a feature diff is a bad afternoon.
2. The two capability rows, the auditor carve-out comment, and tests 8–9.
3. `src/features/organizer/agenda.ts` — bucketing, dedupe, reasons — with tests 1–3.
   Pure, before any page exists.
4. `personal_items` server actions: create, edit, complete, reorder, soft-delete,
   restore, `purgeOwnPersonalItem`.
5. `/my-day` — the six buckets over five sources through React `cache`, plus the
   capture rail and "Recently deleted".
6. Promotion. Gated on spec C's `tasks.kind`, so the organizer reads one table for
   tasks and bugs rather than growing a sixth source — and, for promotion to
   anyone but yourself, on spec B's offer handshake. Self-promotion ships without
   B; promoting to somebody else is disabled until `task.offered` exists.
7. The ⌘K quick-add fallback.
8. The close-out row linking to `/worklog`.

**Depends on spec A** (`2026-08-20-work-substrate-design.md`): `tasks.completed_at`
and the `transitionTaskStatus` consolidation (the mirror rides it),
`tasks_assignee_open_idx`, and the ⌘K `ctx` scoping seam.
**Depends on spec C** (`2026-08-20-deadlines-and-bugs-design.md`): `tasks.kind` for
the single task read, `meeting_followups.due_date` — without it the `owed` bucket
is the only undated one and follow-ups can never enter `late` or `today` — **and
the `meeting_followups (user_id, status, due_date)` index**, which spec C owns
because it keys a column spec C adds. An earlier draft of this list attributed
that index to spec A; spec A no longer ships it.
**Depends on spec B** (`2026-08-20-reaching-people-design.md`) for step 6 only:
promotion to somebody else opens an offer and emits `task.offered`. Steps 1–5 and
7–8 do not need B, and self-promotion does not either.

## Out of scope (YAGNI)

- **`day_plans` as a separate commitment table.** It is genuinely the right answer to
  a forty-item day, and building it before anyone has forty items gives you a second
  state store synchronised with nothing. People plan Monday enthusiastically, never
  un-plan, and by Thursday it holds four days of stale commitments that make the
  organizer wrong instead of useful. Build it when people are visibly dragging — and
  only with roll-forward and a one-click clear, because without those it is the
  drift, not the fix.
- **`personal_items.planned_for`.** Cut for the same reason at one-column scale. The
  `mine` bucket plus manual rank already lets a person put today's intent at the top
  of their own list, in a column they already understand. A second date that nothing
  enforces and nothing clears goes stale on the same schedule `day_plans` would.
- **Real subtasks via `tasks.parent_task_id`.** It looks like the natural
  generalisation of checklists and it brings parent status rollup, children in a
  different sprint from the parent, double-counted capacity, and a delete-semantics
  question with no good answer. At twenty people nobody needs a WBS. A personal item
  linked to a shared task **is** the checklist — "my steps for your task" — and it is
  private, which is what people actually want from a checklist anyway.
- **A computed relevance score for ordering.** Nobody can predict it, nobody can
  argue with it, and one tweak silently reorders everyone's day.
- **Cross-user visibility of a personal item in any form** — opt-in, read-only, for
  admins, "just this one item with Nuwan". A shared personal item is a task without
  permissions, an app, an audit trail or a board. The answer is always: promote it.
- **A `personal.item.view` action at any level**, for the same reason.
- **Recurring personal items.** A materialized RRULE series generates undone rows
  forever and turns the organizer into a wall of missed recurrences people learn to
  ignore. If it ever ships: generate the next single instance on completion of the
  current one. Never a series.
- **Auto-filling `daily_worklogs.percent`** from completed items, and **piping
  personal item text into `draftWorklogNote`**. Both argued above; both listed here
  because both will be proposed again.
- **Any cron of its own.** The 30-day purge of soft-deleted personal items and the
  offboarding purge are ordered **steps inside `/api/cron/notify-tick`** (spec A),
  never a second job. Vercel Hobby allows two, and this product has one entry point
  by design.
- **Email about anything in this spec.** Digest only, one per person per day (spec A),
  and a private row has nothing to say to anyone.
- **Rich text, attachments, and full-text search inside notes.** Owner-scoped title
  match is enough at this size, and a note nobody else can read does not need an
  index.
- **Retiring the dashboard's `MyDayZone`.** Correct eventually; not in the change
  that establishes a privacy boundary.
