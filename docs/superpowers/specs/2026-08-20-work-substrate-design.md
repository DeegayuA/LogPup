# Work-Management Substrate — Scope, Delivery, and the Missing Column — Design

Date: 2026-08-20
Status: awaiting review
Spec 1 of 5 (see "Why this is five specs" below)

## Purpose

Four failures, one spec, because they share one property: none of them is a
feature, and every feature anyone wants to build next lands on top of them.

1. **⌘K answers questions the asker is not allowed to ask.** `SearchContext` is
   threaded into all four `src/features/*/search-providers.ts` and not one
   provider reads it — `grep -n 'ctx\.' src/features/*/search-providers.ts`
   returns nothing. `universalSearch` gates only on signed-in-and-approved. This
   was latent while every seat was `admin` or `member`; it stopped being latent
   when `grantAppAccess` shipped, and a client seat is weeks away. A stakeholder
   with a login can type three letters and enumerate the entire portfolio —
   every app, every task title, every person.

2. **Notifications are stored and never delivered.** `createNotifications` is a
   bare `db.insert` with no transport, no queue, no callback. The type column
   admits exactly two values, `mention | meeting`. There is no task kind, no
   deadline kind, no follow-up kind. Every feature in specs B–E needs to reach a
   person, and today nothing does.

3. **The `notifications` table has ZERO indexes** — verified against
   `drizzle/0005`, which creates none. Every signed-in browser polls it from 20s
   while the code comment beside the poll claims "two indexed queries". That
   comment is false. It survives only because volume is near zero, and every
   later spec raises volume.

4. **`tasks.completed_at` does not exist.** Four separate workstreams — the
   promises hit-rate view, bug resolution time, the organizer's "done today",
   and coverage reconciliation — each need it and each would defer it as someone
   else's problem. `status = 'done'` records that a task is finished and throws
   away when.

None of these is visible on a screen. That is exactly why they need their own
spec: bundled into a feature they get cut for schedule, and every one of them is
cheaper to fix now than after the row counts grow.

## Why this is five specs

The full work-management scope — deadlines, bugs, mentions, assignment,
notifications, calendar, personal to-dos, organizer — is roughly ten schema
changes and two new tables across seven capabilities. As one document it is
unreviewable and unbuildable.

| Spec | Covers | Depends on |
|---|---|---|
| **A (this one)** | Migration unblock, indexes, ⌘K scoping, `completed_at`, notification substrate | — |
| B | Assignment notifies, task mentions notify, uuid mention tokens, `mentions` table | A |
| C | Deadline grading and slip history; bugs as `tasks.kind` + satellite | A |
| D | `personal_items`, promote-and-assign, `/my-day` organizer | A, C (B for promoting to somebody else) |
| E | Calendar organizer handover, full event patch, classified failures | — |

Each ships useful alone. This spec adds **zero user-visible features** and is
still worth shipping on its own: it closes a live data leak and removes a
full-table scan from the most-polled query in the product.

## Decisions

### ⌘K scoping hangs off the seam the command registry already built

`docs/superpowers/specs/2026-08-19-command-registry-design.md` refactored search
into a provider registry and says so explicitly: the refactor "does add the seam
where a future scope filter would hang", and it names a `scope` field on
`SearchProvider` as deferred work. This spec is that deferred work. It does NOT
introduce a competing mechanism — every provider consumes the `ctx` that
registry already threads.

Two rules the registry spec states and this one inherits unchanged: `visible(ctx)`
is presentation only and never a permission check, and the server action behind
every hit is independently guarded. Scope filtering here is about what the index
returns, which is a different failure from what a command renders — a hit whose
title leaks a client's project name has already done the damage, even if
clicking it 404s.

A surface a seat cannot see returns a per-route 404, not a refusal. A
stakeholder probing `/admin` must not learn it exists.

### Scheduling: exactly one cron job

LogPup is on Vercel **Hobby** — two cron jobs, daily granularity. The design
therefore has ONE scheduled entry point, `/api/cron/notify-tick`, and everything
periodic is an ordered step inside it: digest assembly, notification retention
pruning, and (from spec C) deadline escalation.

This is a constraint, not a preference, and it is written into the route's own
comment so nobody adds a second cron on a plan that has no room for one. A
second scheduled concern becomes a step, never a job.

Consequence for spec C: deadline escalation runs once daily. That is correct
anyway — an escalation ladder that fires more than once a day is a nag.

### Notification text is a key and a parameter bag, never a frozen string

`notifications.title` today is a denormalized English sentence written at insert
time. LogPup's user-facing surfaces are bilingual Sinhala + English, so a stored
sentence is a permanent decision made at write time about a reader whose
language is not known until read time.

Replace it with `title_key text` plus `params jsonb`, rendered at read time.

And one rule about what goes *in* the bag, because it is the same decision one
level down: **`params` carries ids, not names.** `actorId`, `appId`, `taskId`,
resolved to current display names in the read-time pass that already renders
`title_key`. Freezing `actorName` or `appName` into jsonb at write time is a
stored sentence with extra steps — a person renames, an app is renamed, and
every historical row keeps the old label for as long as it lives. Where a
fallback is genuinely needed for an actor who has since been purged, store it as
a clearly-named snapshot (`actorLabel`) that the renderer falls back to only
when the id resolves to nothing, the convention `activity_log` already sets with
`entityLabel`. This document owns that convention; specs B and C carry it.

The alternative — store the sentence, add a second column later — means a
migration over every stored row, and the rows most worth translating are the
ones already written. There is no cheap retrofit here, which is why this sits in
the substrate spec rather than being deferred to whichever feature notices first.

`title` and `body` stay as nullable columns for the existing rows and are read as
a fallback when `title_key` is null. They are never written again. Deleting them
waits on a backfill migration that is deliberately not in this spec.

### The digest is one email per person per day, and it has preconditions

Email is in scope, digest-only. It is a one-shot credibility bet: if it
duplicates Google's own calendar invite mail, fires empty, or double-fires from a
cron retry, everyone writes a filter rule within a week and every future channel
goes to that folder with it.

Three preconditions, all enforced in code rather than in a runbook:

- A verified sending domain. Absent it, the digest step is a no-op that logs.
- An admin-visible delivery-failure surface. A silent bounce for a month is worse
  than no email at all.
- `digest_state` on the row, transitioned in the same transaction that sends, so
  a cron retry cannot double-send. A retry that finds rows already marked sends
  nothing.

And one hard rule, written as one function rather than as a sentence:
**`digestEligible(meeting)`**, evaluated at send time and never at insert time —
restoring a trashed meeting nulls `google_event_id`.

The question the rule answers is "has Google already told these people?", and
the honest predicate for that is the meeting's sync state, not the presence of
an event id. An id-only check is right for CREATE failures and wrong for UPDATE
failures, where the id is set and the guests were never told. Spec E
(`2026-08-20-calendar-hardening-design.md`) adds `meetings.calendar_sync_state`
and defines `'failed'` as precisely *guests have not been told about a change
that already landed in LogPup* — the exact case this fallback exists for, and
the exact case an id-only rule excludes permanently.

The target rule:

```
digestEligible(m) =
  m.google_event_id IS NULL
  OR m.calendar_sync_state IN ('failed', 'orphaned')
```

Spec A ships before spec E, so **the first implementation is the id-only half**
— `m.google_event_id IS NULL` — inside that one function, carrying a comment
that names `calendar_sync_state` as the column which completes it. E's build
order then changes one expression in one place rather than re-deriving a rule
nobody re-reads. Google emailed the `synced` meetings itself via
`sendUpdates:'all'`; LogPup covering the `failed` and `orphaned` ones is what
turns today's silent calendar-failure path into a real fallback rather than half
of one.

### Recipient filtering moves inside `createNotifications`

Today every call site decides who may receive a row, and no call site does. The
result: a deactivated contractor is still mentionable and still accrues rows, and
a notification can point at a soft-deleted entity and 404 on click.

`createNotifications` becomes the choke point. Inside it, and nowhere else:

- drop recipients who are inactive or not `approved`
- drop the actor's own id — nobody is notified about their own action
- drop recipients who cannot reach the entity, resolved through `can()`
- drop rows whose entity is already soft-deleted
- **cap the recipient's day.** At most **5** immediate rows per recipient per
  weekday — the budget in the next section, made mechanism. The sixth and every
  one after it create no row of their own; they upsert a single collapsing
  overflow row keyed `notif:overflow:{userId}:{tickDate}`, with
  `title_key = notif.overflow.more` and `params = {count, href}`, whose link
  opens the inbox filtered to that day.

The cap belongs here and nowhere else. A ceiling stated as prose inside a feature
spec is a number nobody can enforce and every later spec forgets; a ceiling
written into the one function every kind must pass through is a number that
survives specs C and D and the kinds nobody has scoped yet. It is also the only
thing that bounds a *burst*: spec C's ladder keys on the due date, so one sprint
slip touching twenty tasks legitimately re-arms twenty ladders on the next tick,
and no per-kind rule anywhere can see that the same person is on the receiving
end of all of them.

Two properties it must have, stated so nobody later "simplifies" them away:

- **Overflow collapses; it never drops.** The count is real and the row is a
  door, not a tombstone. Silently discarding the sixth event is the failure this
  cap exists to prevent, not a cheaper version of it.
- **The suppressed facts stay reachable.** Each still sits on its own surface —
  the task, the promises list, spec D's `/my-day` — and the daily digest is
  assembled from the events rather than from the bell rows, so a capped day
  still emails in full. The trade being accepted, said out loud rather than
  discovered: rows past the cap are absent from the bell *and* the inbox,
  because keeping them in the inbox needs a "hidden from bell" column and still
  pays for the write.

Doing this in one function rather than seven call sites is the whole point: it is
the property that stays true when spec B adds three more call sites.

### Dedupe is a storage-layer guarantee, with two semantics

Two partial unique indexes, and each notification kind declares which it uses.

**Permanent** (`dedupe_permanent = true`) — escalation ladders. Key format
`deadline:{taskId}:{step}:{dueDate}`, so a legitimately moved date re-arms the
ladder while a re-run of the daily tick fires nothing. `ON CONFLICT DO NOTHING`.

**Collapsing** (`dedupe_permanent = false`) — comments, mentions, accepted
suggestions. `ON CONFLICT DO UPDATE` incrementing `collapse_count`, with the
index scoped `WHERE read = false AND dismissed_at IS NULL` so it resets once the
reader has caught up. The next event after that opens a fresh row rather than
silently incrementing one already dismissed.

Collapse on the ENTITY, never the event: five comments on one task are one row
reading "5 new comments", keyed `task:{id}:comment`.

This spec ships the mechanism and **zero new notification kinds**. Adding a kind
before the mechanism exists is the sequence that produces the volume incident.

### The notification budget is one table, and it lives here

Volume is the failure this whole substrate is built against, so the ceiling
belongs in the substrate spec rather than in whichever feature spec happened to
state it first. **This document owns the number and the table below.** Spec B
stated it first and handed out headroom informally; that is now this table, and
a later spec adds its rows here and spends against what is left.

**At most 5 immediate in-app notifications per person per weekday.** The table
says what the system is *supposed* to cost; the cap in `createNotifications` is
what happens when it costs more.

| Spec | Kind | Recipient | Dedupe | Expected/person/weekday |
|---|---|---|---|---|
| B | `task.offered` | offeree | permanent | ~1.0 |
| B | `task.declined` | assigner | permanent | ~0.2 |
| B | `task.forced` | assignee | permanent | ~0.1 |
| B | `mention` | mentioned person | collapsing | ~1.0 |
| C | `deadline.due_soon` | assignee / follow-up owner | permanent | ~1.0 |
| C | `deadline.overdue` | assignee / follow-up owner | permanent | ~0.3 |
| C | `deadline.breached` | assignee / follow-up owner | permanent | ~0.05 |
| C | `deadline.breached` (PM copy) | app PM — **one aggregated row per PM per tick** | permanent | ~0.05 org-wide, ≤1.0 for a PM |
| D | — | — | — | **zero new kinds**; adds volume to `task.offered` via promote-and-assign, already priced in B's row |
| E | — | — | — | **zero new kinds**, deliberately |
| **Total** | **7 kinds** | | | **~3.7, ~4.6 for a PM** |

Three rules come with the table, and each exists because the informal version
failed once:

- **A spec that adds a kind adds a row with a real number before it ships.** "It
  will be low volume" is not a number. Spec C is the case that proves it: three
  kinds driven by a daily sweep over every open dated task and follow-up, costed
  at nothing, is how a bell dies and takes meeting invites down with it.
- **A fan-out is priced per RECIPIENT, not per event.** One breached item that
  copies the PM is two rows, and a PM who owns five apps is exactly why spec C's
  PM copy is aggregated to one row per PM per tick rather than one per task.
- **A sweep-driven kind is priced over the item's LIFE, not per tick.** Spec C's
  ladder fires each rung at most once per item per due date, so ~15 dated items
  living ~15 weekdays is ~1 row per person per weekday, not 15. A kind whose
  cost cannot be written that way does not belong on a daily sweep.

The remaining headroom is small on purpose. It is also the reason this spec
ships zero kinds of its own.

### `dismissed_at`, deliberately not `deletedAt`

`src/db/live.test.ts` fails the build for any table carrying a `deletedAt` not
registered in `SOFT_TABLES`. A notification is an ephemeral operational record,
not trashable user content — it belongs in neither the trash bin nor the
five-table soft-delete contract. Naming the column `dismissed_at` keeps both
facts true, and the column carries a comment saying so.

## Data model

All changes additive. No existing reader changes behaviour.

**`tasks`** — one column, shipped alone in its own migration:

```
completed_at  timestamptz NULL
```

Set on every transition into `done`, cleared on reopen, through a single new
`transitionTaskStatus` helper that `updateTask`, `moveTaskOnBoard` and
`bulkUpdateTasks` all call. Today those three paths each write `status`
independently; consolidating them now is what stops six behaviours accreting
across three diverging call sites in specs C and D.

**There is a fourth writer, and it is not obvious: an approved change request.**
`buildApplyStatement` (`src/features/admin/change-request-appliers.ts:58-66`) is
`db.update(table).set(after).where(eq(table.id, entityId))` — a generic spread —
and `'task'` is already in `SUPPORTED_ENTITY_TYPES` (`:17`), so this path is live
the day spec C ships. A change request carrying `status: 'done'` therefore writes
the status, never calls `transitionTaskStatus`, and leaves `completed_at` null —
silently corrupting all four workstreams the column exists for, through the one
door that has a reviewer attached to it.

**`TABLES.task`'s generic statement is replaced by a task-specific applier** that
builds its statements by calling `transitionTaskStatus` (this spec) and
`applyDueDate` (spec C). The generic applier stays correct for entity types that
carry no invariants; `task` has stopped being one. This document owns the
`completed_at` half of that applier and spec C
(`2026-08-20-deadlines-and-bugs-design.md`) owns the due-date half; both say so.

**Rejected: refusing `status` in a task change-request payload at file time.**
The file-time-failure discipline the applier's own docblock argues for is the
right instinct and the wrong tool here, because it cannot be applied to the
due-date keys — spec C deliberately routes an under-privileged committed-date
move *through* a change request, so refusing those keys at file time would
delete the flow the guard is meant to protect. One door, one applier.

**`notifications`** — the substrate:

```
kind             text NOT NULL DEFAULT 'legacy'   -- backfilled from type::text
title_key        text                              -- i18n key; title/body become fallback
params           jsonb                             -- render-time parameter bag
entity_type      text                              -- no FK, matching activity_log's posture
entity_id        uuid                              -- no FK: the row outlives its target
dedupe_key       text
dedupe_permanent boolean NOT NULL DEFAULT false
collapse_count   integer NOT NULL DEFAULT 1
dismissed_at     timestamptz
digest_state     text NOT NULL DEFAULT 'none'      -- none | queued | sent | failed
```

`type` (the two-value pgEnum) is converted to `text` so a new kind is a string at
a call site rather than a migration — the precedent `activity_log.verb` already
sets in this schema, and the reason given there applies unchanged here.

`entity_type`/`entity_id` carry no foreign key on purpose. A notification about a
task must survive that task being trashed; the click-through resolves and
degrades to a "no longer available" state rather than the row vanishing.

**Five indexes on `notifications`, which has none today:**

```
(user_id, read, created_at DESC) WHERE dismissed_at IS NULL   -- the bell poll
(user_id, created_at DESC)                                     -- the inbox
UNIQUE (user_id, dedupe_key) WHERE dedupe_permanent
UNIQUE (user_id, dedupe_key) WHERE NOT dedupe_permanent AND read = false AND dismissed_at IS NULL
(entity_type, entity_id)                                       -- cascade on trash
```

**One index on a table that lacks one:**

```
tasks:             (assignee_id, due_date) WHERE deleted_at IS NULL AND status <> 'done'
```

`tasks_app_sprint_sort_idx` is keyed `(app_id, sprint_id, sort_order)` and cannot
serve "my open tasks by due date", so every dashboard render is a full scan
today, for every user, on the most-visited page.

**Two indexes an earlier draft of this spec listed here are NOT in this spec**,
and the reason is that they cannot execute: `tasks (app_id, kind, status)` names
`tasks.kind`, and `meeting_followups (user_id, status, due_date)` names a
`due_date` column that `meeting_followups` does not have (verified —
`schema.ts` has no `due_date` on that table and no index block for it at all).
Both columns arrive in spec C, and this spec has no dependencies and ships
first, so both indexes would fail on creation here. **Spec C
(`2026-08-20-deadlines-and-bugs-design.md`) owns both, with C's definitions**,
in the same migration as the columns they key. `meeting_followups` therefore
stays unindexed until C ships, which is a real cost accepted knowingly: an index
this spec cannot create is not a cost it can avoid.

**`apps`** — one column, because LogPup's own defects (spec C) must not corrupt
client-facing portfolio metrics:

```
internal  boolean NOT NULL DEFAULT false
```

## Migrations

Hand-written SQL plus hand-written `drizzle/meta/_journal.json` entries;
`drizzle-kit generate` is forbidden in this repo. Replay-safe throughout,
modelled on `drizzle/0034_app_role_history.sql`.

**Migration numbers are allocated at merge time, not in advance.** Number 0040 is
currently claimed by four parallel sessions at once. Assigning a number to work
in flight is a failure this repo has already paid for repeatedly; the plan
allocates against then-current `main` at integration.

Ordered, one concern each:

1. `tasks.completed_at` — alone, first, so the four dependents unblock immediately.
2. The four indexes — no schema change, pure performance, and genuinely safe to
   apply any time now that every column they name exists today.
3. `notifications` columns plus the `type`-to-`text` conversion.
4. The two dedupe partial unique indexes — separate, because they can fail on
   pre-existing duplicate rows and must be diagnosable in isolation.
5. `apps.internal`.

No migration runs against any database without explicit human approval, and every
one is verified against `information_schema` rather than the runner's exit code —
`npm run db:migrate` has reported success while applying nothing.

## Pages & flows

Almost nothing user-visible. That is the point.

- **⌘K** returns only what the actor may reach. Each provider consumes the `ctx`
  the command registry already threads.
- **The bell** keeps its current shape; only the query underneath changes, and
  rows render from `title_key` + `params`.
- **Digest email** stays off until the sending domain is verified, and its
  failures appear on an admin surface rather than in a log.

## Error handling

- `createNotifications` keeps its best-effort contract: it MUST NOT throw, and a
  notification failure MUST NOT fail the write it describes. Moving filtering
  inside it does not change that — a filter error drops the recipient and logs.
- The digest step is idempotent by construction: `digest_state` transitions in
  the same transaction as the send.
- A notification whose entity is gone renders as unavailable rather than 404ing.

## Testing

TDD, following `permissions.test.ts` and `missing-days.test.ts` conventions —
Vitest, relative imports, no globals. Note `vitest.config.ts` includes
`src/**/*.test.ts` only; `.tsx` is not matched.

Pure, table-driven:

1. **Dedupe key semantics** — permanent keys re-arm on a changed date and no-op
   on a repeat tick; collapsing keys increment while unread and open a fresh row
   after dismissal.
2. **Recipient filtering** — inactive, non-approved, self, and out-of-scope
   recipients are each dropped, asserted one case per rule.
3. **Digest eligibility** — asserted through `digestEligible(meeting)`, not
   inline: a meeting with `google_event_id` set and `calendar_sync_state`
   `'synced'` is excluded, the same row with the id null is included, a row with
   the id set and state `'failed'` is **included** (the case an id-only rule gets
   wrong, and the case the fallback exists for), and every case is evaluated at
   send time. The `failed` case is written now and marked pending against spec
   E's column, so E's edit has a test waiting for it.
4. **The per-recipient daily cap** — the fifth row of a day lands normally; the
   sixth creates no row of its own and opens one collapsing
   `notif:overflow:{userId}:{tickDate}` row; the seventh increments its
   `collapse_count` rather than adding another; and the count on the overflow row
   equals the number of events actually suppressed. A dropped event fails this
   test, which is the point.

Integration, mocked-`db` idiom:

5. Each of the four search providers filters by `ctx`, asserted per provider with
   a stakeholder actor granted exactly one app.
6. `transitionTaskStatus` sets `completed_at` on entering `done` and clears it on
   reopen, through all three call paths.
7. **An approved change request carrying `status: 'done'` sets `completed_at`.**
   This is the fourth door, it has no UI, and nothing else in the suite would
   notice it silently writing the status alone. Spec C adds the mirror assertion
   for `original_due_date` on the same applier.

## Build order

1. ⌘K scope filtering. **Blocking** — a client seat is weeks away.
2. `tasks.completed_at` plus the `transitionTaskStatus` consolidation.
3. The four indexes.
4. Notification substrate: columns, dedupe, filtering inside `createNotifications`.
5. `/api/cron/notify-tick`, with retention pruning as its only step.
6. Digest, gated on the verified domain and the failure surface.

## Out of scope (YAGNI)

- **Any new notification kind.** The substrate ships with zero. Kinds arrive in
  specs B and C, on top of a mechanism that can absorb them.
- **Immediate per-event email** — twenty people at five events a day is a hundred
  mails a day from the studio's own domain. This is the specific mechanism by
  which notification systems die.
- **Web push, Slack, WhatsApp, Teams.** Slack in particular makes Slack the read
  surface, forking read state into two systems that never reconcile.
- **SSE or WebSockets.** The bell already backs off and suspends on hidden tabs;
  Vercel functions plus `neon-http` are hostile to persistent connections.
- **A full kind × channel preference matrix** — 45 switches nobody configures.
  Presets are the product, and they belong in spec B where kinds exist.
- **Backfilling legacy notification rows to `title_key`.** The fallback path
  handles them; a backfill is a later, separate migration.
- **Deleting `notifications.title`/`body`.** They stay as the fallback until that
  backfill exists.
