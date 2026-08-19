# Calendar Hardening — Organiser Handover, Full Patch, Classified Failure — Design

Date: 2026-08-20
Status: awaiting review
Spec 5 of 5 (see "Why this is five specs" in `2026-08-20-work-substrate-design.md`)

## Purpose

Four failures in one integration. They are grouped because they share one
property: each of them is silent. The meeting saves, the action returns `ok`,
and the thing that did not happen is written to `console.error` and nowhere a
person will ever look.

1. **Every calendar write is a single point of failure on one person's personal
   Google account, and it fires on a predictable schedule.** `syncCalendarInvite`
   (`src/features/meetings/actions.ts:296`) resolves the token with
   `.select({ googleRefreshToken }).where(eq(users.id, meeting.createdBy))` at
   `:310-313`; `syncCalendarTime` does the same at `:367-370`; `deleteMeeting`
   does it a third time at `:1123-1126`. The offboarding gate does not cover
   this: `countTransferableWork` (`src/features/people/handover-queries.ts:147`)
   counts assignments, open `app_role_history` rows and open tasks — not
   meetings. `getHandoverInventory` *does* list "Upcoming meetings they created"
   (`:113-118`), and `applyHandover`
   (`src/features/people/handover-actions.ts:54`) moves app roles, assignments,
   tasks and the work schedule — and **not that group**. So the inventory shows
   the meetings, offers no way to move them, and the deactivation proceeds. Every
   future meeting that person created becomes unpatchable and uncancellable at
   once.

2. **Title, agenda and attendee edits never reach guests.** Exactly three calls
   exist in `src/features/calendar/google-calendar.ts`: `createCalendarEvent`
   (`:44`), `updateCalendarEventTime` (`:90`), `deleteCalendarEvent` (`:195`).
   The middle one patches `start` and `end` and nothing else, by design, and its
   own comment says so. `updateMeeting` is honest about the consequence
   (`actions.ts:891-896`): "Only the time is pushed to Google … a title-only edit
   has nothing to send it", and it guards the call with `&& moved`. Rename a
   meeting, rewrite the agenda, add four people — twenty calendars keep the old
   title, the old agenda, and the old roster. The LogPup row and the invite the
   guests actually read diverge, permanently, with no signal on either side.

3. **A failed cancellation is swallowed by a bare `catch`.**
   `actions.ts:1129-1131` is `} catch { // Ignore — proceed with the soft delete
   regardless. }`. That comment is right about the soft delete and wrong about
   the ignoring: this is the one calendar failure where doing nothing leaves a
   live event holding a joinable Meet link on twenty calendars for a meeting that
   no longer exists in LogPup. It also cannot distinguish a 404 (the event was
   already gone — nothing is wrong) from `invalid_grant` (the event is still
   there and nobody can remove it). And `restoreMeeting`
   (`src/features/admin/trash-actions.ts:141`) nulls `googleEventId` on restore,
   on the stated premise that the event was cancelled on delete. When the cancel
   failed, that premise is false and the restore throws away the only handle
   anyone had on the stale event.

4. **Password and passkey users have no Google grant at all, and nothing says
   so until a save fails.** `src/lib/auth.ts:51` requests
   `openid email profile https://www.googleapis.com/auth/calendar.events` — only
   the Google provider. The `Credentials` providers at `:72`, `:117` and `:146`
   never mint a refresh token. `users.google_refresh_token` (`src/db/schema.ts:108`)
   is one nullable text column, so the app cannot tell "never connected" from
   "revoked" from "signed in but unticked the Calendar box on Google's granular
   consent screen" — a distinction `describeCalendarError` already knows how to
   make *after* a failure, and nobody can ask *before* one.

## Why this ships alone

E depends on nothing. It adds no notification kind, needs no notification
substrate, and does not touch ⌘K, `tasks`, `personal_items` or any of the
schema specs B–D own. Its only optional link to spec A is one ordered step
inside `/api/cron/notify-tick`, and that step is additive on the day that route
exists — until then the same work is read-triggered. Nothing here waits.

## Decisions

### The calendar owner becomes its own column; `created_by` stays the authorship fact

`meetings.calendar_organiser_id`, backfilled to `created_by`. Every token resolve
reads it. On the day it lands, behaviour is byte-for-byte what it is today,
because the backfill makes the two columns equal — which is exactly what makes it
safe to ship before the handover action exists.

The rejected alternative is to keep using `created_by` and "just reassign it
during offboarding". That silently rewrites who created a meeting, which is the
fact `activity_log` was written against and the fact the meeting detail renders.
Migration `0034_app_role_history.sql` exists in this repo because overwriting a
historical holder in place destroys the answer to "who held this on 12 June". The
same mistake, one table over, is not cheaper.

### Handover is an explicit action, and its permission row is shaped like `meeting.admin`

A Google event cannot change owner across two personal accounts through the API.
Handover is therefore: cancel the event on the outgoing organiser's calendar,
null `google_event_id`, set the new organiser, create a fresh event on **their**
calendar. Guests receive one cancellation and one new invite. The action says so
before it runs; it MUST NOT present this as seamless.

That shape is why the permission row is `meeting.calendar.organiser` with grants
`all / all / own / own / own / none / none`, resolved against
`calendar_organiser_id` — the same shape the RBAC spec gave `meeting.admin`
(`src/features/auth/capabilities.ts:116`) and for the same stated reason. A
`scoped` branch would read as "a PM may manage meetings on their project", and
what it would actually grant is the power to write an event onto a colleague's
personal Google Calendar using that colleague's stored refresh token, without
them present. `meeting.manage` is `scoped` for manager and editor
(`capabilities.ts:110`); folding handover into it hands every PM that power as a
side effect of a table row nobody re-reads. It gets its own action instead, and
widening it later is a visible one-cell edit.

Two preconditions, checked before anything is cancelled:

- the incoming organiser's `google_token_status` must be `'ok'`. Handing a
  meeting to someone whose grant is dead cancels twenty invites and creates
  nothing.
- the actor may not hand a meeting to themselves out of someone else's calendar
  unless they hold the `all` grant — the `own` grant means *your* meeting, not
  *any* meeting on your project.

Order is cancel-then-create, not create-then-cancel. Create-first would leave a
duplicate live event on failure, and a duplicate invite is a thing you must then
find and cancel with the same token that just failed. Cancel-first fails to a
state the repo already has a recovery action for: `google_event_id IS NULL` is
precisely the precondition `retryCalendarInvite` (`actions.ts:529`, guarded at
`:535`) requires. The recovery path is not new code; it is the button already on
the meeting.

### The full patch is `events.patch` with the whole roster, and `sendUpdates` is a decision

`updateCalendarEvent` joins the module beside `updateCalendarEventTime`. Three
rules, each preventing a specific loss:

- **`patch`, never `update`.** `events.update` replaces the resource. Sending a
  body without `conferenceData` through `update` drops the Meet room, which is
  the one field on the event that cannot be reconstructed from LogPup — the room
  is minted by Google and only exists as a property of the event.
- **The attendee array replaces the whole list.** So it is always built from the
  current `meeting_attendees` roster via the existing `attendeeEmails` helper
  (`actions.ts:278`), never as a delta. Google preserves `responseStatus` for
  attendees whose email is unchanged and starts new ones at `needsAction`; a
  delta send silently drops everyone omitted.
- **`sendUpdates` is chosen per change kind.** `'all'` when the time or the
  roster changed — those are the two facts a person needs in their inbox.
  `'none'` when only the title or agenda changed: the entry on their calendar
  updates silently, which is the correct outcome. A twenty-person studio that
  gets a Google email every time somebody fixes a typo in an agenda mutes the
  calendar, and Google's invite mail is currently the only channel in this
  product that actually reaches anyone (see spec A's rule that LogPup MUST NOT
  email about a meeting with a non-null `google_event_id`).

The rejected alternative is to keep patching time only and "add the rest later".
Later never comes for an invisible failure, and every week it does not come the
guest-visible copy of the meeting drifts further from the row LogPup grades
itself against.

### A failure becomes a fact on the row, not a line in a log

`meetings` gains `calendar_sync_state`, `calendar_synced_at` and
`calendar_error`. The warning strings `inviteWarning` / `moveWarning`
(`actions.ts:109-116`) stay exactly as they are — they are good sentences — but
they stop being the *only* record. Today a dead token produces the same yellow
banner on every save until everyone clicks past it, and six weeks later nobody
knows which meetings guests can actually see. Sticky state on the meeting plus
one admin list is the fix; a better toast is not.

`calendar_error` stores a **classification key**, not a rendered sentence.
This is the one place this spec refines its brief, and the reason is the same
one spec A gave for `notifications.title_key`: LogPup's surfaces are bilingual
Sinhala + English, and a sentence written at failure time is a permanent
decision about a reader whose language is not known until read time. So
`describeCalendarError` (`google-calendar.ts:137`) splits: `classifyCalendarError(error)`
returns the key, `describeCalendarError` becomes `sentenceFor(classify(error))`
and keeps its exported name, signature and every one of its current callers
unchanged. The whole diagnostic ladder in its docblock — the seven-day refresh
token expiry on a project still in Testing status, the `accessNotConfigured`
versus `insufficientPermissions` split, the two places googleapis hides the real
reason — survives untouched. Only the return type gains a sibling.

### The pull is one fact, on a read trigger, with a cron floor

Push everything. Pull at most two facts. Ask a human for anything else. This spec
ships the first fact — **the event was cancelled or its time diverged in
Google** — recorded to `calendar_drift jsonb` and surfaced as a banner with two
buttons, "Use Google's time" (calls the existing `rescheduleMeeting`) and "Push
LogPup's version" (calls the new `updateCalendarEvent`). Nothing is ever applied
automatically.

The pull is `events.list` once per distinct organiser, `singleEvents: true`,
`updatedMin` = that organiser's oldest `calendar_synced_at`, `timeMin = now - 2h`,
`timeMax = now + 14d`, reconciled by `google_event_id`. Per-meeting `events.get`
is rejected: at twenty people it is forty-plus calls a tick against personal
tokens on one shared Cloud project quota, for no additional fact.

Where it lives, given Hobby: `vercel.json` today declares one cron
(`/api/cron/backup`, `0 3 * * *`), and spec A claims the second for
`/api/cron/notify-tick`. That is the plan's ceiling — **there is no room for a
calendar cron and this spec does not ask for one.** The pull runs as a
best-effort server action fired when the meetings page or a meeting detail
mounts, no-op when `calendar_synced_at` is under ten minutes old, plus one
ordered step inside `notify-tick` as the floor for meetings nobody opened. The
step is additive on the day that route exists; until then read-triggered is the
whole mechanism, which is why this spec still ships independently of A.

### `google_calendar_id` ships as a column with no UI

`DEFAULT 'primary'`, read in place of the three hardcoded `calendarId: 'primary'`
literals (`google-calendar.ts:64`, `:97`, `:197`). It is the cheap eighty percent
of the shared-calendar answer: a studio calendar every organiser can write to
removes the personal-account SPOF without a service account, and adopting it
later is then a data change rather than a second migration over every meeting.

No picker in the UI yet, deliberately. On a shared calendar, a second organiser
patching an event they did not create needs "make changes to events" on that
calendar, and the 403 that comes back when they do not have it is **not** the
insufficient-scope 403 — `classifyCalendarError` would mislabel it today, and
mislabelling is how a fixable permission problem becomes "Google is broken". The
column lands now because it is free; the switch waits on that classification.

### `google_token_status` is written on observation and never guesses

`users` gains `google_token_status`, `google_scopes` and `google_checked_at`.
`src/lib/auth.ts` writes `google_scopes` from `account.scope` on every Google
sign-in, which is what makes an unticked Calendar checkbox detectable at sign-in
rather than at first failure. Every calendar call site sets `'ok'` on success and
downgrades from the classification on failure.

Two rules that matter more than the column:

- **A 5xx never downgrades anyone.** Google being unavailable for ten minutes
  must not mark every user in the workspace as broken; that state would then sit
  there being wrong until each of them happened to succeed again.
- **`'unknown'` is a value, and it never renders as "fine".** Existing token
  holders backfill to `'unknown'`, not `'ok'`, because nobody has checked them.
  This is the same discipline as the FreeBusy refusal below: rendering unknown as
  good is the specific failure that destroys trust in an availability surface,
  and it is no better here.

Values: `none | unknown | ok | invalid_grant | insufficient_scope | api_disabled`.
`text` plus a TS union, not a `pgEnum` — the repo's standing reason (Postgres
forbids using a freshly `ADD VALUE`'d member in the same transaction) applies,
and `activity_log.verb` already sets the precedent.

`api_disabled` is a project-level fact observed through one user, so the admin
list groups by status: everyone showing `api_disabled` at once reads correctly as
"somebody has to turn the Calendar API on in Cloud Console", which is the one
failure in the ladder that re-consenting does nothing for.

## Data model

All changes additive. No existing reader changes behaviour.

**`meetings`** — six columns:

```
calendar_organiser_id  uuid REFERENCES users(id)          -- backfill = created_by
google_calendar_id     text NOT NULL DEFAULT 'primary'
calendar_sync_state    text NOT NULL DEFAULT 'none'       -- none|synced|failed|drifted|orphaned
calendar_synced_at     timestamptz
calendar_error         text                               -- classification KEY, not a sentence
calendar_drift         jsonb                              -- the pull's report, never applied
```

`calendar_organiser_id` is nullable with no default so the backfill is the only
thing that ever sets it for existing rows and is idempotent by its own `WHERE`
clause. It carries no `ON DELETE` behaviour because `users` is never hard-deleted
in this product.

`calendar_sync_state` is the sticky fact the toast could not be. `'orphaned'`
is the one that matters: a Google event that outlived its LogPup meeting.
`'failed'` means guests have not been told about a change that already landed in
LogPup.

`calendar_drift` is jsonb because it is a report, not a queried fact:
`{ cancelledInGoogle, googleStart, googleEnd }`. Cleared on either resolution.

**Two indexes on `meetings`:**

```
(calendar_organiser_id, starts_at)
  WHERE deleted_at IS NULL AND google_event_id IS NOT NULL
(calendar_sync_state, starts_at)
  WHERE calendar_sync_state IN ('failed','drifted','orphaned')
```

The first serves both readers that exist: the offboarding question ("what does
this person still organise?") and the pull's grouping by organiser. Without it
each is a full `meetings` scan. The second is the admin attention list, and it is
partial because the rows that need attention are a permanent minority — an index
over all five states would be mostly `'none'` and mostly useless.

**`users`** — three columns:

```
google_token_status  text NOT NULL DEFAULT 'none'   -- backfill 'unknown' where a token exists
google_scopes        text[]
google_checked_at    timestamptz
```

**No index on `users`.** Twenty rows. Adding one because the query looks like a
filter is cargo cult, and it would need maintaining forever.

**No new table, and therefore nothing for `SOFT_TABLES`.** This is stated because
`src/db/live.test.ts:501` fails the build for any schema table carrying a
`deletedAt` not registered there. Nothing in this spec carries one. Nothing in
this spec issues a `db.delete`, so `DELETE_ALLOWED_FUNCTIONS` (`live.test.ts:308`)
is untouched too. Both facts belong in the migration's comment so a later reader
does not have to re-derive them.

**Two permission rows** in `ROLE_GRANTS` (`src/features/auth/capabilities.ts:76`),
column order fixed as the table demands:

```
'meeting.calendar.organiser':  superadmin A, admin A, manager O, editor O, member O, stakeholder N, auditor N
'integration.health.view':     superadmin A, admin A, manager N, editor N, member N, stakeholder N, auditor A
```

`meeting.calendar.organiser` resolves `own` against `calendar_organiser_id`, not
`created_by` — the whole point is that those diverge. `integration.health.view`
gives manager `none` on purpose: the RBAC spec's rule is that workspace-level
acts stay with `admin`, and "who in this workspace can send calendar invites" is
a workspace-operations list in the same family as approving a signup. `auditor`
gets `all`, read-only, consistent with every other row.

## Migrations

Hand-written SQL plus hand-written `drizzle/meta/_journal.json` entries;
`drizzle-kit generate` is forbidden in this repo. Replay-safe throughout,
modelled on `drizzle/0034_app_role_history.sql` — `ADD COLUMN IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object THEN null;
END $$` for constraints, and backfills whose `WHERE` clause stops matching once
applied.

**Migration numbers are allocated at merge time, not in advance.** The highest on
`main` today is `0041_employment_and_logging`, and 0040 was recently claimed by
four parallel sessions at once. Numbers are assigned against then-current `main`
at integration; a number written into a branch is a merge conflict with a
plausible-looking resolution.

Two migrations, one concern each:

1. **`meetings` calendar columns, the backfill, and the two indexes.** The
   backfill is `UPDATE meetings SET calendar_organiser_id = created_by WHERE
   calendar_organiser_id IS NULL` — idempotent, and it is what makes the column
   switch a no-op on day one.
2. **`users` token-status columns**, with `google_token_status` backfilled to
   `'unknown'` where `google_refresh_token IS NOT NULL`. Deliberately a second
   file: it can be applied and verified without touching a meeting, and it is the
   one whose backfill encodes a judgement ("we do not know these are good")
   worth being able to point at in isolation.

No migration runs against any database without explicit human approval, and each
is verified against `information_schema` rather than the runner's exit code —
`npm run db:migrate` has reported success while applying nothing.

## Pages & flows

- **Meeting composer** — before the save, not after. When the would-be
  organiser's `google_token_status` is not `'ok'`, a badge and one sentence:
  guests will get the `.ics` file from `/api/meetings/[id]/ics` instead of an
  emailed invite, with a "Reconnect Google" affordance. This replaces learning it
  from a post-save `calendarWarning` on a meeting that has already gone out.
- **Meeting detail** — the sticky state, in words. `'failed'` reads "Guests have
  not been told about this change"; `'orphaned'` reads "The Google event may
  still be live"; `'drifted'` renders the two-button banner. Colours from
  `src/app/globals.css` only — `--warning` for `failed`/`drifted`, `--destructive`
  for `orphaned`, `--success` for `synced`; `--chart-*` is for real chart series
  and appears nowhere here. Every badge carries a word: state is never conveyed
  by colour alone.
- **Organiser handover** — on the meeting detail for the organiser and on the
  admin meeting row, behind `meeting.calendar.organiser`. A confirmation that
  states the cost in plain words before it runs: guests get one cancellation and
  one new invite.
- **Offboarding** — `getHandoverInventory`'s `meetings` group switches its source
  from `liveMeetings.createdBy` to `calendarOrganiserId`; `countTransferableWork`
  gains the same count so the deactivation gate at
  `src/features/admin/actions.ts:207-215` actually fires on it; `applyHandover`
  gains a `meetingOrganiserSuccessorId` that runs the handover per meeting. This
  is the flow the whole spec exists for — the failure in Purpose 1 is precisely
  that the inventory lists these and the apply ignores them.
- **Admin integration health** — one list, every active user, grouped by
  `google_token_status`, with `google_checked_at`. Behind `integration.health.view`.
  A seat without it gets `notFound()`, per-route, not a refusal: `unauthorized()`
  and `forbidden()` need `experimental.authInterrupts`, which this repo does not
  set, and a stakeholder probing an admin route must not learn it exists.

Next.js 16 facts these pages must obey and which differ from most training data:
`params` and `searchParams` are Promises and must be awaited; the second prop of
`error.tsx` is `retry`, not `reset`.

## Error handling

Every new server action — `reassignMeetingOrganiser`, `resolveCalendarDrift`,
`syncMeetingCalendar`, `recoverOrphanedCalendarEvent` — returns `ActionResult`
from `@/lib/action-result`, is guarded server-side through `requireCapability`
against a row in `ROLE_GRANTS` (never an ad-hoc role string), writes
`activity_log`, and calls `revalidatePath`. Client-side hiding is presentation
only.

**Cancellation classifies into three outcomes**, replacing the bare `catch` at
`actions.ts:1129`:

1. **404** — the event is already gone. This is not a failure. State goes to
   `'none'`, `calendar_error` is cleared, and the soft delete proceeds silently.
   Today this is indistinguishable from a live orphan, which is why the current
   code cannot report anything useful either way.
2. **No token, `invalid_grant`, `insufficient_scope`, `api_disabled`, 403** — the
   event may still be live. State goes to `'orphaned'`, `calendar_error` gets the
   key, `google_event_id` is **retained** on the row (as it already is), one
   `activity_log` row is written, and the meeting appears on the admin attention
   list. The soft delete still proceeds — the meeting row is the source of truth
   and blocking a delete on Google's availability would be worse.
3. **5xx** — transient. State `'orphaned'`, key `unavailable`, and the recovery
   action is a retry that will probably work. No user's `google_token_status`
   changes.

**The recovery path is named, including where it is a person rather than an API
call.** `recoverOrphanedCalendarEvent` re-issues the cancel with the organiser's
token, behind `meeting.calendar.organiser` — it emails twenty guests a
cancellation, and that is not a message a mis-click should be able to send from a
list view. When the organiser's grant is dead, **no token in the system can
cancel that event**, and the honest surface says so: it names the organiser and
the event and tells the operator to ask that person to delete it from their own
calendar. Pretending an API retry always works is how an orphan sits there for a
month.

**Restore must not throw away the handle.** `restoreMeeting`
(`trash-actions.ts:141`) nulls `googleEventId` on the premise that the event was
cancelled on delete. When `calendar_sync_state = 'orphaned'` that premise is
false. Restore therefore retries the cancel first; if that fails, it refuses and
says why. Nulling the id there would leave a live event nobody can ever reference
again.

Everything else keeps the contract the module already has and states in its own
comments: the calendar path is best-effort, never throws, and never fails the
write it describes. `logActivity` swallows its own errors by design, so a sync
that logs nothing still completes; conversely the pull must never leave
`calendar_sync_state` stuck mid-flight if it dies partway, which is why state is
written once, at the end, from a resolved outcome.

**The refusals go in the module comment**, in the style `google-calendar.ts`
already uses for `conferenceDataVersion` and the `describeCalendarError` ladder —
because every one of them is a thing a reasonable person will propose again:

> Two-way sync is refused. Google gives you `updated` and `etag`, not per-field
> provenance, and there is no answer for both-sides-changed between polls. In a
> workspace where meetings carry transcripts, note timelines, follow-ups and
> accepted task suggestions, a wrong merge is not a wrong calendar entry — it is
> orphaned work. Push everything, pull at most two facts, ask a human for
> anything else.
>
> A `status: 'cancelled'` event never soft-deletes the LogPup meeting. Any guest
> clicking "remove from my calendar" can produce that state, and deleting the
> meeting would take the transcript, the note timeline, the follow-ups and the
> task suggestions out of every view with it. Raise drift; never delete.

## Testing

TDD, following the conventions in `google-calendar.test.ts` and
`permissions.test.ts` — Vitest, relative imports, no globals. Note
`vitest.config.ts` includes `src/**/*.test.ts` only; `.tsx` is not matched, so
every rule below lives in a pure module rather than in a component.

Pure, table-driven:

1. **`classifyCalendarError`** over the fixtures `google-calendar.test.ts`
   already carries, one case per branch of the existing ladder: `invalid_grant`
   from both the OAuth body and the message, `accessNotConfigured` via
   `response.data.error.errors[0].reason`, `SERVICE_DISABLED` via
   `details[].reason`, the generic 403, 401, 404, 5xx. Plus one assertion that
   `describeCalendarError` returns the same sentences it returns today — the
   refactor must be provably invisible to its existing callers.
2. **`calendarSendUpdates(changed)`** — `'all'` for a time change, `'all'` for a
   roster change, `'none'` for title-only and agenda-only, `'all'` when a time
   change and an agenda change arrive together. This is a pure decision function
   precisely so the rule is testable without a fake client.
3. **`planOrganiserHandover`** — returns the ordered steps, and refuses with a
   reason when the incoming organiser's `google_token_status` is not `'ok'`.
   Asserts the order is cancel-then-create, because create-first is the plausible
   "safer" reordering somebody will try.
4. **Cancellation classification** — 404 resolves to "already gone", every other
   failure resolves to `'orphaned'` with a key, 5xx does not downgrade a user's
   token status.

Against a fake `calendar_v3` client, in the existing style:

5. **`updateCalendarEvent` request shape** — `patch` is called and `update` is
   not; the attendee array is the full roster and not a delta; `conferenceData`
   is never sent on a patch; `calendarId` comes from `google_calendar_id` and is
   not the literal `'primary'`.

Permission matrix:

6. **`meeting.calendar.organiser` is `own` for `manager`** — the single
   assertion the row exists to protect. A PM who manages the project may not hand
   over a meeting organised by someone else. If a later edit widens this cell to
   `scoped`, this test fails and names the reason.

## Build order

1. `classifyCalendarError` / `sentenceFor` split, with the invisibility test.
   Pure, no schema, no behaviour change. **First**, because everything below
   persists its output.
2. Migration 1, then switch all three token resolves (`actions.ts:310`, `:367`,
   `:1123`) and all three `calendarId` literals to read the new columns. No
   behaviour change by construction — the backfill makes the columns equal.
3. Full event patch: `updateCalendarEvent`, wired into `updateMeeting` in place
   of the `&& moved` guard at `:894-896`.
4. Classified cancellation, `calendar_sync_state` writes, and the `restoreMeeting`
   guard. **This is the one that stops a live Meet link outliving its meeting**;
   it is third only because it wants the classifier and the columns first.
5. Migration 2, `auth.ts` scope capture, and status writes at every call site.
6. Admin integration-health list and the composer pre-flight warning.
7. `reassignMeetingOrganiser`, then the offboarding wiring —
   `countTransferableWork`, the inventory's source column, and `applyHandover`.
8. The pull: `syncMeetingCalendar` on read, plus the drift banner. The
   `notify-tick` step is one line added when spec A's route exists.

## Out of scope (YAGNI)

- **Two-way sync.** Refused, not deferred, for the reason written into the module
  comment above: no per-field provenance, no answer for both-sides-changed, and a
  wrong merge here orphans real work rather than mis-setting a calendar entry.
- **Auto-deleting the LogPup meeting when the Google event is cancelled.** Any
  guest clicking "remove from my calendar" would take the transcript, the note
  timeline, the follow-ups and the task suggestions with it. Raise drift; never
  delete.
- **Google push/watch channels.** They need a publicly reachable webhook,
  channels that expire every seven days and a re-registration job that does not
  exist, re-registration after every deploy, and correct handling of the 410
  sync-token invalidation. The pull described above is roughly forty lines. And
  the decisive constraint: Hobby has no room for a second cron, so the "real
  time" alternative cannot even be scheduled.
- **Google FreeBusy, and scheduling built on it.** `src/lib/auth.ts:51` requests
  `calendar.events` only, so **every existing grant is insufficient until that
  person re-consents**, and password/passkey users have no grant at all. A
  scheduler in that state renders unknown as free for everyone it cannot see,
  which is the exact failure that destroys trust in a scheduler. LogPup-internal
  availability — `meetings` + `absences` + `org_holidays` + `work_schedules` —
  needs no token and covers the studio's actual question; it belongs in its own
  spec, built first.
- **A service account with domain-wide delegation.** It genuinely fixes the token
  SPOF, and it does so by requiring a Workspace super-admin to grant LogPup
  org-wide impersonation of every user — a permanent audit liability far larger
  than the problem. `google_calendar_id` is the cheap eighty percent.
- **The RSVP mirror** (the second of the two permitted pull facts). It must write
  through the existing `attendanceHistoryStatements` helper
  (`rsvp-actions.ts:36`) via `db.batch` so the as-of interval on
  `meeting_attendee_history` stays true, which makes it an RSVP change wearing a
  calendar hat. Named here so the next person adds it in that file, not this one.
- **Recurring meetings.** A real gap, and a whole spec: a `meeting_series`
  template, materialised concrete `meetings` rows (never virtual instances —
  every downstream table is keyed to a concrete `meetings.id`), a bounded
  horizon, and a `SOFT_TABLES` registration. It does not belong inside a
  hardening pass.
- **Writing a Google event per task due date.** Write amplification on somebody's
  personal token for every board drag, plus a cleanup path on every soft delete,
  plus all-day events carrying RSVP semantics they should not have.
- **A subscribable per-user ICS feed.** The natural companion to the previous
  item, and it introduces an unauthenticated bearer-token route that will be
  pasted into a group chat. Separate spec, with hash-only token storage and
  revocation, or not at all.
- **A UI for `google_calendar_id`.** The column ships; the picker waits on
  classifying the shared-calendar 403 apart from the insufficient-scope 403.
- **Encrypting `users.google_refresh_token`.** It is plaintext `text`
  (`schema.ts:108`) while `gemini_keys.encrypted_key` is AES-256-GCM through
  `src/lib/crypto.ts`. That is a real finding and it is deliberately not here: it
  touches every read of the column and is a security change that must not ride
  inside a feature spec where it will be reviewed as an implementation detail.
- **Non-Google providers.** The `.ics` route and the Outlook deep link in
  `src/features/meetings/ics.ts` already cover Outlook, Apple and CalDAV
  adequately for a twenty-person studio.
- **Any new notification kind.** Zero, on purpose — it is what lets this spec
  ship without spec A.
