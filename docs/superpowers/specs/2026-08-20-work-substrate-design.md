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
| D | `personal_items`, promote-and-assign, `/my-day` organizer | A, C |
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

And one hard rule: **LogPup MUST NOT email about a meeting when
`meetings.google_event_id IS NOT NULL`** — Google already emailed those people
via `sendUpdates:'all'`. It SHOULD when the column is null, which turns today's
silent calendar-failure path into a real fallback. Evaluate at send time, never
at insert time: restoring a trashed meeting nulls `google_event_id`.

### Recipient filtering moves inside `createNotifications`

Today every call site decides who may receive a row, and no call site does. The
result: a deactivated contractor is still mentionable and still accrues rows, and
a notification can point at a soft-deleted entity and 404 on click.

`createNotifications` becomes the choke point. Inside it, and nowhere else:

- drop recipients who are inactive or not `approved`
- drop the actor's own id — nobody is notified about their own action
- drop recipients who cannot reach the entity, resolved through `can()`
- drop rows whose entity is already soft-deleted

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

**Three indexes on tables that lack them:**

```
tasks:             (assignee_id, due_date) WHERE deleted_at IS NULL AND status <> 'done'
tasks:             (app_id, kind, status)  WHERE deleted_at IS NULL   -- kind arrives in spec C
meeting_followups: (user_id, status, due_date) WHERE status = 'open'
```

`tasks_app_sprint_sort_idx` is keyed `(app_id, sprint_id, sort_order)` and cannot
serve "my open tasks by due date", so every dashboard render is a full scan
today, for every user, on the most-visited page. `meeting_followups` has no index
at all.

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
2. The six indexes — no schema change, pure performance, safe to apply any time.
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
3. **Digest eligibility** — a meeting notification with `google_event_id` set is
   excluded; the same row with it null is included; evaluated at send time.

Integration, mocked-`db` idiom:

4. Each of the four search providers filters by `ctx`, asserted per provider with
   a stakeholder actor granted exactly one app.
5. `transitionTaskStatus` sets `completed_at` on entering `done` and clears it on
   reopen, through all three call paths.

## Build order

1. ⌘K scope filtering. **Blocking** — a client seat is weeks away.
2. `tasks.completed_at` plus the `transitionTaskStatus` consolidation.
3. The six indexes.
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
