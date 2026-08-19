# Reaching People — Mentions, Assignment, and the Delegation Handshake — Design

Date: 2026-08-20
Status: awaiting review
Spec B of 5 — depends on A (`docs/superpowers/specs/2026-08-20-work-substrate-design.md`)

## Purpose

Spec A built a pipe that reaches a person and deliberately shipped zero
notification kinds. This spec is the first thing that goes down it, and it goes
down it because four affordances in the product currently look like they work
and do nothing.

1. **Manual task assignment notifies NOBODY.**
   `src/features/sprints/task-actions.ts` never imports `createNotifications` —
   verified: its import block (`:1-18`) has no `@/features/notifications/notify`
   entry, and `grep -rn createNotifications src/` returns hits in meetings and
   app comments only. Meanwhile the AI auto-assign path DOES notify
   (`src/features/meetings/ai-actions.ts:508` builds the row, `:545` sends it).
   So the model handing you work tells you, and your project manager handing you
   work does not. That is exactly the wrong asymmetry, and it applies to all
   three write paths — `updateTask` (`:349`), `moveTaskOnBoard` (`:451`),
   `bulkUpdateTasks` (`:570`).

2. **An @mention in a task notifies nobody.** `task-dialog.tsx:228` renders
   `MentionTextarea`, complete with a picker, a popover and — at `:235-241` — a
   client-side "assigned from mention" toast. No task action anywhere calls
   `extractMentionedUserIds`; its only three callers are
   `meetings/actions.ts:1068`, `meetings/ai-actions.ts:3195` and
   `apps/comment-actions.ts:74`. A person types `@Nuwan can you look at this`,
   sees it render as a link, and Nuwan is never told. A silently broken
   affordance is worse than an absent one: it consumes the author's belief that
   they communicated.

3. **Mentions are a name regex over the whole user table.**
   `extractMentionedUserIds` (`src/features/notifications/notify.ts:29-41`)
   builds one `RegExp` per known user from their display name, longest-first,
   case-insensitive, and every call site loads `db.select({id, name}).from(users)`
   with **no active or status filter** (`comment-actions.ts:73`). Consequences,
   all live today: a rename silently un-links every mention that person ever
   received; two people with the same name are both notified forever; a rejected
   signup is mentionable; and there is no record of who was mentioned where, so
   editing a body re-notifies from scratch and "mentions of me" cannot exist.

4. **`users.aliases` is a dead column.** Declared at `src/db/schema.ts:116` with
   a seven-line comment explaining that `matchPersonToAttendee` compares only
   `users.name`'s first whitespace token and therefore needs this. `grep -rn
   aliases src/` returns exactly one hit: the declaration. Zero readers, zero
   writers, since the day it shipped.

None of these needs a new subsystem. Three of them are one function and one
table away, and the fourth is a consumer change.

## Decisions

### Mentions become uuid tokens; the name regex survives as the legacy path

New mention text is written by the picker as `@[Display Name](u:<uuid>)`.
The renderer resolves the uuid; the display name inside the brackets is a
cosmetic snapshot, re-rendered from the current `users.name` at read time so a
rename updates every historical mention instead of breaking it.

The alternative — keep plain `@Name` and fix the matcher — cannot work, and the
reason is structural rather than a matter of effort: the only moment a human
disambiguates which Nuwan they mean is the moment they pick one out of the
popover. Every downstream name matcher in this repo exists because that
information was thrown away at that moment (`matchPersonToAttendee`,
`followups.ts`, and `extractMentionedUserIds` itself). We stop throwing it away.

**The existing tail is not backfilled and not re-resolved.** Every
`app_comments.body`, `meeting_note_segments.text` and legacy `meetings.notes`
blob written before this ships keeps its plain `@Name` text, and the legacy
regex keeps running over it — but only over bodies containing no explicit
token, so a body cannot be read twice by two matchers. A backfill would have to
guess which of two same-named people was meant, and guessing is the exact
failure this change exists to end. The tail is therefore permanent, bounded, and
shrinking: it never grows again after the picker changes.

That legacy branch is load-bearing and this repo has already lost one
load-bearing legacy probe to a merge conflict — which is why
`src/db/live.test.ts:590` exists as "check 7: the legacy-notes probe is still
called", asserting a call count so that deleting the calls fails the build even
when the file survives. The legacy mention path gets the same treatment (see
Testing).

**Auto-upgrade is deliberately narrow.** On submit, a bare `@token` is rewritten
into an explicit token only when `matchMentions` (`src/lib/mention-match.ts`,
which already ranks exact → name-prefix → word-prefix → tokens → initials →
substring → fuzzy) returns exactly one candidate of kind `exact` or
`name-prefix`. Anything ambiguous, and anything reached only through the fuzzy
fallback, stays plain text, renders **unhighlighted**, and notifies nobody. The
author sees grey text where they expected a link. Silently upgrading a fuzzy
match is how you notify the wrong person and never find out.

### The `mentions` unique index is the anti-spam mechanism

One new table. Its `UNIQUE (source_type, source_id, mentioned_user_id)` is not
bookkeeping — it is the entire de-duplication story for mentions, and it lives
at the storage layer specifically so that the seven call sites that extract
mentions cannot each get it wrong.

Re-running extraction over an edited body inserts nothing. Editing yesterday's
worklog note four times inserts one row and sends one notification. A mention
notifies **exactly once, ever**.

This is a different guarantee from spec A's collapsing dedupe index, and both
are needed. Spec A's collapsing index resets once the reader catches up — by
design, so the sixth comment on a task after you have read the first five opens
a fresh row. Under that index alone, editing a body after the recipient read the
mention would notify them again. Under the `mentions` unique index alone, three
genuinely different mentions of you would be three bell rows. Together: the
notification row collapses per entity while unread, and the mention row makes
re-extraction structurally inert. State this in both files' comments, because
the obvious future "simplification" is to delete one of them.

**No foreign key on `source_id`,** matching `activity_log.entityId`
(`schema.ts:910` — a plain `uuid` with no `.references()`, deliberately). A
mention is evidence that must outlive a trashed or purged source. A
denormalized `source_label` keeps an orphaned row readable as a sentence.
Visibility is enforced at read time by joining the relevant live view per
`source_type`, exactly the shape `notificationMeetingIsLiveOrAbsent` already
uses (`src/features/notifications/queries.ts:12-15`).

`mentions` gets **no `deletedAt`**. `src/db/live.test.ts:501` reflects over the
schema and fails the build for any table carrying one that is not registered in
`SOFT_TABLES`; the table is an append-only index, not trashable user content, so
it belongs in neither. The column's absence is the decision, and it is written
into the schema comment.

### `users.aliases` gets wired up, in exactly two places, or it dies again

Wired. Into the **picker's** candidate matching, and into
`matchPersonToAttendee`, which its own schema comment (`schema.ts:109-116`) says
it was created for. Nowhere else. Specifically **never** into free-text
extraction: an alias like `DA` matched against prose invents mentions out of
ordinary sentences.

The alternative was dropping the column. Rejected because dropping is a
destructive, non-additive migration to delete a column that is the correct fix
for the two places names are already known to be unreliable, in a studio where
`W.A.D.N. Perera` and `Nuwan` are the same person.

Two details that decide whether it survives this time:

- **Editing is not admin-only.** `user.profile.edit` is already `own` for
  editor/member/stakeholder and `scoped`/`all` above (`capabilities.ts:83`), so
  aliases ride the existing action and the existing capability, and the person
  who actually knows their alternate name can enter it. Admin-only alias editing
  is how the column died the first time.
- **An alias that collides with another active user's name or alias is
  refused.** Aliases feed `matchPersonToAttendee`, which attributes transcript
  lines; a self-set alias equal to a colleague's name would let someone hijack
  attribution. The check is one query at write time, and the refusal names the
  collision.

### Assignment is an offer, recorded as a half-open interval

`task_assignment_history`, with `[effective_from, effective_to)` and one open row
per task enforced by a partial unique index. This is the repo's own pattern,
running four times already: `assignment_history_one_open_idx`
(`schema.ts:277-279`), `app_role_history_one_open_idx` (`schema.ts:207-209`),
`meeting_attendee_history_one_open_idx`, `work_schedules_one_open_idx`. Task
assignment is the one mutable-owner relationship in the product with no history
at all — the missing fifth instance, not a new idea.

The open row's `state` (`offered` | `accepted` | `declined`) is denormalized onto
`tasks.assignment_state text NOT NULL DEFAULT 'accepted'`, so no existing read
grows a join. The default is what makes the migration additive AND truthful:
the studio has been working on the assumption that assigned means accepted, so
backfilling every existing task as `accepted` records what actually happened
rather than inventing a pending queue on day one.

Assigning to yourself lands directly as `accepted` — there is no one to ask.
Assigning to anyone else, including the AI auto-assign path
(`ai-actions.ts:465-545`), opens an offer. A model guessing an owner from a
transcript is precisely the case where "nobody agreed" is most likely, so
exempting it would be backwards.

Rejected alternative: **a fourth `taskStatus` enum value.** It breaks
`board-view.ts`'s column model, every `STATUS_LABELS` switch
(`task-actions.ts:24-28`), and the follow-up auto-resolve wiring — and Postgres
forbids using a freshly `ADD VALUE`'d enum member in the transaction that added
it, a restriction this schema documents twice. Beyond the mechanics: acceptance
is orthogonal to progress. You can accept work and not start it, and you can be
mid-work on something you never formally accepted.

**`assignment_state` is a social record and MUST NOT be a permission input.** It
is never read by `can()`, never by `canMoveTask`. An offer does not block the
work: `tasks.assigneeId` moves at offer time, so the offeree can start
immediately if they want to. An offer that blocks work is strictly worse than
today's silent assignment, because it adds a gate on top of the same surprise.

### Decline requires a reason and returns the task to a named person

Never to unassigned limbo — an orphaned task is how a decline becomes a way to
make work disappear. The decline closes the open interval and opens a new one
whose assignee is the **assigner**, `state = 'accepted'`,
`change_kind = 'declined'`, carrying the reason.

If the assigner is inactive by then, the task returns to `apps.pm_id` instead,
`change_kind = 'handed_back'`. `apps.pm_id` is `NOT NULL` (`schema.ts`, "Project
manager. Unlike leadId, this is required"), so there is always a person. Nothing
in the schema guarantees that person is *active*; the return path checks and
falls through to the workspace's admins if not, rather than assuming.

Three defences against the handshake becoming a rubber stamp in a hierarchical
studio, all required, none optional:

- A third button, **"Accept, not this sprint"**, rendered at equal visual weight
  with Accept. It captures what people usually mean and cannot say.
- Decline reasons go **privately to the assigner** and never into the rendered
  activity feed. The `activity_log` row records that a decline happened; the
  reason lives in `task_assignment_history.reason` and renders only to the two
  people involved.
- **No decline count appears as a number on any person's page, ever.** The
  moment it does, nobody declines again and the mechanism is dead while still
  costing a click.

### Unanswered offers are a read on the assigner's dashboard, never a nag

An offer sitting for three business days surfaces as a tile — "Awaiting their
answer" — on the **assigner's** dashboard, computed at read time as a `WHERE`
clause over open rows: `state = 'offered' AND effective_from` older than three
business days, using the existing `src/lib/working-days.ts`.

Two things this deliberately is not.

It is not a cron. Spec A fixed the entry-point count at one,
`/api/cron/notify-tick`, on a Hobby plan with room for two, and this
computation needs no scheduler at all: it is always correct when computed on a
page someone is already loading, with no idempotence story, no delivery record
and no retry semantics to own.

It is not an auto-accept timer. **Auto-accept after N days converts "nobody
looked at this" into "they agreed to this"**, which is the specific lie that
kills a tracker. The limbo is real information — it means the offer was never
seen — and the right response is to bother the person who asked, not to
fabricate consent from the person who did not answer.

### Four relationships, two built, two cut

People say "assignment" for four different things. Separating them is most of
the design work here.

| Relationship | What it is | Verdict |
|---|---|---|
| **Assignee** | Accountability. Exactly one. The thing that counts in workload. | Exists (`tasks.assigneeId`), gains the handshake. |
| **Mention** | A moment. Point-in-time, confers no standing, no obligation. | Built here. |
| **Watcher** | A subscription. Ongoing, self-service, zero obligation, zero capacity cost. | **Cut** — see below. |
| **Reviewer** | A gate. Ongoing, obligation, blocks a transition. | **Cut** — `change_requests` already is this. |

**Watchers are cut from this spec**, against the scoping run's recommendation,
and the reason is a precondition rather than a cost. A subscription has no
product until there is an event stream worth subscribing to. Today a task emits
exactly two events a third party could want — it was assigned, and someone was
mentioned in it — and both already reach the people who care, by name. There are
no task comments to subscribe to: `app_comments` is app-level
(`schema.ts:701-707`, keyed `appId`), not task-level. So `task_watchers` would
ship a table, a mute column, four auto-watch rules and a settings affordance in
order to deliver an unread dot. Re-open this when task-level comments exist;
that is the event that makes a watcher mean something.

**Reviewers are cut permanently.** `change_requests` (`schema.ts:1063`) already
models propose → review → apply, already has `request.create`,
`request.withdraw`, `request.review` and `request.review.self` in the matrix
(`capabilities.ts:119-124`), and has zero lines of consuming code. A
`tasks.reviewer_id` would be a second, incompatible approval flow in a
twenty-person studio that does not have enough people to staff one — and a
`reviewer_id` no query enforces is worse than nothing, because it looks like a
control and is a label.

### Two new capability rows, and one of them is an escape hatch

The RBAC matrix has landed (`src/features/auth/capabilities.ts`, seven roles,
`ROLE_GRANTS` at `:76-149`), so these compose with real code rather than a plan.

```
'task.assign.force':  { superadmin: A, admin: A, manager: S, editor: N, member: N, stakeholder: N, auditor: N }
'task.assign.answer': { superadmin: O, admin: O, manager: O, editor: O, member: O, stakeholder: N, auditor: N }
```

`task.assign.answer` resolves `own` against **the open interval's
`assignee_id`** — not `tasks.createdBy`, not `tasks.assigneeId` at request time.
Naming the `ownerId` source in the matrix row rather than letting each caller
infer one is the difference between an offer only its recipient can answer and
one anybody who touched the task can answer. `can()` fails closed when an `own`
action arrives without a resource (`capabilities.ts:236-240`, `:273-285`), so a caller that
forgets is denied, not granted.

`task.assign.force` — set `state = 'accepted'` directly, for offboarding and
reorgs — is added to `APPROVAL_ACTIONS` (`capabilities.ts:157-161`), which caps
it to `none` for trainee and intern. That list's charter is "deciding something
on behalf of the organisation, rather than doing the work", and deciding that
someone owns work they did not agree to is exactly that.

Three things keep the escape hatch from becoming the default, which is the
observed fate of every skip-the-handshake button: it **requires a typed
reason**; it writes `metadata.forced = true` on the `activity_log` row, so a
compliance review lists every use with one filter — the same shape as
`metadata.selfApproved` on `request.review.self`; and it renders visibly rarer
in the UI than the ordinary path.

Fourteen new asserted matrix cells. That is the whole permission cost of this
spec, and it is stated because the matrix is asserted cell-by-cell and nobody
costed it during scoping.

### Notification kinds: four, and what they spend

Spec A ships the mechanism with zero kinds. This spec adds the first four. The
budget is **at most 5 immediate in-app notifications per person per weekday**.

| Kind | Recipient | Dedupe | Key | Expected/person/weekday |
|---|---|---|---|---|
| `task.offered` | Offeree | **Permanent** | `task:{taskId}:offer:{historyRowId}` | ~1.0 |
| `task.declined` | Assigner | **Permanent** | `task:{taskId}:decline:{historyRowId}` | ~0.2 |
| `task.forced` | Assignee | **Permanent** | `task:{taskId}:forced:{historyRowId}` | ~0.1 |
| `mention` | Mentioned person | **Collapsing** | `{entityType}:{entityId}:mention` | ~1.0 |

**Running total after spec A + B: 4 kinds, ~2.3 rows per person per weekday
against a ceiling of 5.** Specs C, D and E have ~2.7 rows of headroom between
them. That number is the budget, and a later spec that wants a fifth kind spends
against this table rather than adding to it silently.

Why each dedupe semantic:

- The three assignment kinds are **permanent**, keyed on the history row's id.
  Keying on the interval row rather than the task is what lets a genuine
  re-offer after a decline re-arm — a new interval is a new key — while a retry,
  a double-submit or a re-render fires nothing. `ON CONFLICT DO NOTHING`.
- `mention` is **collapsing on the entity**, per spec A's rule that collapse
  keys the entity and never the event: three mentions of you across three
  comments on one app are one row reading "3 mentions", and the next mention
  after you read it opens a fresh row. The `mentions` unique index separately
  guarantees each individual mention contributes at most once, ever.

Two kinds that are deliberately absent:

- **Nothing notifies the assigner on ACCEPT.** They asked for it; acceptance is
  the expected outcome, and a bell row for the expected outcome is how a bell
  dies. Accepted offers change a count on the assigner's dashboard read.
- **Bulk offer reuses `task.offered`**, one aggregated row per recipient, keyed
  `task:offer-batch:{batchId}`, with `title_key = notif.task.offered.many` and
  `params = {actorName, count, appName, href}`. Forty acceptance prompts for one
  offboarding would guarantee the feature is disabled inside a week.

Every row stores `title_key` + `params`, never a sentence — surfaces are
bilingual Sinhala + English and the reader's language is not known at write time.
Keys: `notif.task.offered.one`, `notif.task.offered.many`,
`notif.task.declined`, `notif.task.forced`, `notif.mention.entity`.

### A mention that cannot be delivered is recorded and reported, never dropped

`createNotifications` is spec A's choke point and already drops recipients who
are inactive, unapproved, the actor themselves, or out of scope. For mentions
that filtering has a second half this spec owns: **the `mentions` row is written
anyway**, with `suppressed_reason` set (`no_access` | `inactive` | `self` |
`assignment_supersedes`), and the action returns a non-fatal advisory naming the
person — "Nuwan can't see Atlas — mention recorded, not notified."

Without that advisory, half the org spends six months believing they told
someone. It will be the first thing cut for looking noisy. It must not be.

Two composition rules:

- **A stakeholder gets no picker at all.** `user.view.directory` is `none` for
  that seat (`capabilities.ts:78`), and the picker is a directory with
  autocomplete. Gating only the notification and still rendering the picker
  would leak the whole people list to the client seat that RBAC exists to
  contain.
- **When one action both mentions someone and offers them the task, exactly one
  bell row is created and it is the assignment one.** The mentions row is still
  written, with `suppressed_reason = 'assignment_supersedes'`.

## Data model

All changes additive. No existing reader changes behaviour.

**`mentions`** — new table, append-only, no `deletedAt`:

```
id                  uuid pk
source_type         text NOT NULL   -- app_comment | note_segment | meeting_notes | task | worklog | followup
source_id           uuid NOT NULL   -- NO FK, activity_log's posture
source_label        text NOT NULL   -- denormalized; keeps a purged row readable
mentioned_user_id   uuid NOT NULL references users
actor_id            uuid NOT NULL references users
app_id              uuid            -- denormalized, for scoped reads
notified            boolean NOT NULL DEFAULT false
suppressed_reason   text            -- no_access | inactive | self | assignment_supersedes
created_at          timestamptz NOT NULL DEFAULT now()
```

Indexes:

```
UNIQUE (source_type, source_id, mentioned_user_id)   -- THE anti-spam mechanism
(mentioned_user_id, created_at DESC)                 -- "mentions of me"
```

Neither user reference carries an `onDelete` rule, matching
`activity_log.actorId` (`schema.ts:904`). Users in this product are deactivated,
never deleted; a cascade here is a rule that can only ever fire by accident.

`source_type` values are drawn from **one exported const union shared with
`activity_log.entityType` and `notifications.entity_type`**, with a test
asserting all three read from it. Three tables inventing three vocabularies is
how a per-entity audit join silently returns nothing.

**`task_assignment_history`** — new table, the fifth as-of interval:

```
id             uuid pk
task_id        uuid NOT NULL references tasks on delete cascade
app_id         uuid NOT NULL      -- denormalized: the dashboard read filters by scope without a join
assignee_id    uuid               -- NULL = an unassigned interval
assigned_by    uuid
state          text NOT NULL      -- offered | accepted | declined
change_kind    text NOT NULL      -- assigned | reassigned | unassigned | accepted | declined | handed_back | auto | forced
reason         text               -- REQUIRED by the action for declined and forced
effective_from timestamptz NOT NULL
effective_to   timestamptz
created_at     timestamptz NOT NULL DEFAULT now()
```

Indexes:

```
UNIQUE (task_id) WHERE effective_to IS NULL   -- at most one open row per task
(task_id, effective_from)                      -- per-task timeline, "reassigned 3+ times"
(assignee_id, effective_from)                  -- per-person timeline
(app_id, state) WHERE effective_to IS NULL     -- the "awaiting answer" dashboard read
```

`state` and `change_kind` are `text`, not pgEnums, following the rule
`activity_log.verb` sets in this schema: both vocabularies will grow, and a new
value should be a string at a call site rather than a migration.

No `as_of (effective_from, effective_to)` index, breaking with the other four
interval tables on purpose. That index exists there to serve whole-team scans
that **sum** across rows — `capacityAsOf` over `assignment_history`. Nothing
sums across this table: every read is either one task's timeline or the set of
open rows. An index nothing uses is a write cost on the hottest table in the
product.

**`tasks`** — one column:

```
assignment_state  text NOT NULL DEFAULT 'accepted'   -- offered | accepted | declined
```

**No backfill of `task_assignment_history`.** The table starts empty and its
history begins the first time a real event happens. A reader that finds no open
row for a task falls back to `tasks.assigneeId`, which is what every reader does
today. Backfilling from `activity_log`'s `assigned` verbs was considered and
rejected: it is exactly the mistake migration 0015 made with
`assignment_history`, producing inferred `effective_from` values
indistinguishable from observed ones, and a whole planned feature had to drop
as-of allocation as untrustworthy in consequence. `0034_app_role_history.sql`
documents that incident at length and answers it with a fixed sentinel note
string; here the cheaper answer is available — do not fabricate the rows at all.

**`users.aliases`** — no schema change. Consumer change only, in the two places
named above.

## Migrations

Hand-written SQL plus hand-written `drizzle/meta/_journal.json` entries;
`drizzle-kit generate` is forbidden in this repo. Replay-safe throughout —
`IF NOT EXISTS` on every table and index, `DO $$ … EXCEPTION WHEN
duplicate_object` on every constraint — modelled on
`drizzle/0034_app_role_history.sql`.

**Migration numbers are allocated at merge time, never in advance.** The
committed journal runs to `0041_employment_and_logging` (`when: 1787155700000`)
and an uncommitted `0042` is already on disk in this worktree — which is the
whole argument: `when` values must exceed the last entry's and strictly
increase, and four parallel sessions once claimed 0040 at the same time. This
spec therefore names no number, and its three files are numbered against
then-current `main` at integration.

Ordered, one concern each:

1. `mentions` — table, two indexes, no backfill.
2. `task_assignment_history` — table, four indexes. Ships separately from (3)
   because the unique index can fail on nothing today but the column default in
   (3) rewrites every row in `tasks`, and the two failures must be diagnosable
   apart.
3. `tasks.assignment_state`, with its `DEFAULT 'accepted'`.

No migration runs against any database without explicit human approval, and each
is verified against `information_schema` rather than the runner's exit code —
`npm run db:migrate` has reported success while applying nothing.

## Pages & flows

- **Mention picker** (`src/components/mention-textarea.tsx`) writes tokens
  instead of bare names, ranks with `aliases` folded into the candidate tokens,
  and shows a secondary line — the person's app or role — so two people with the
  same display name are distinguishable. Not rendered at all for a stakeholder.
- **`MentionText`** parses tokens first, then falls back to the legacy name pass
  for token-free bodies. It keeps building React nodes from string slices and
  keeps never touching `innerHTML`.
- **Task dialog** — the assignee field reads "Offer to" when the target is not
  the actor. If an approved `absences` row (`schema.ts:1136`, indexed
  `absences_user_start_idx`) covers today, an inline warning names their return
  date. It warns; it does not block. A task due after someone returns is a
  perfectly reasonable offer.
- **Task card** — an "Offered" badge: the word plus `--warning`, never colour
  alone. "Declined" uses `--destructive`. `--chart-*` is for chart series and is
  not touched.
- **Offer response** — Accept, "Accept, not this sprint", Decline. Decline opens
  a required-reason field; submitting with an empty reason is refused client-
  side and server-side.
- **Dashboard** gains two tiles, "Offered to you" and "Awaiting their answer".
  The existing Overdue and Due soon tiles keep their arithmetic exactly —
  offered tasks are excluded from them and counted in the new pair. Changing
  what an existing tile counts is a silent product change; adding tiles is not.
- **Mentions of me** is a filter on the existing notifications inbox, not a new
  route and not a new feature directory. `registry.test.ts` checks 1 and 4 fail
  the build for any `src/features/*` directory lacking a `commands.ts` or a
  `search-providers.ts` without an allowlist entry and a reason; a new directory
  for one filtered list would buy two allowlist entries and a `commands.ts` to
  serve a query the inbox already runs.

Next.js 16 facts that differ from older training data and apply here: `params`
and `searchParams` are Promises; `error.tsx`'s second prop is `retry`, not
`reset`; `unauthorized()`/`forbidden()` require `experimental.authInterrupts`,
which this repo does not set, so a surface a seat may not reach returns
`notFound()`.

## Error handling

- Every new server action returns `ActionResult` from `@/lib/action-result` and
  is guarded server-side with `requireCapability`. Client-side hiding is
  presentation only — `canMoveTask` already documents that it deliberately
  under-grants (`src/features/sprints/permissions.ts:10-16`).
- **The one-open-row unique violation is surfaced, never swallowed.**
  `neon-http` has no transactions, so a concurrent accept and reassign can both
  try to close the same open interval; the partial unique index turns that into
  a caught constraint error instead of two open rows and a history that lies.
  It returns `err('Someone just reassigned this — reload')`.
- Close-and-open goes out as one `db.batch` with a single JS `Date` used for
  both the old row's `effective_to` and the new row's `effective_from`, so the
  intervals abut exactly rather than leaving a gap an as-of read falls into.
- Mention extraction is best-effort and separately caught, inheriting spec A's
  contract: `createNotifications` MUST NOT throw, and a notification failure MUST
  NOT fail the write it describes. The existing app-comment path already has
  this shape (`comment-actions.ts:72-92`) and it is the model.
- A mention whose recipient cannot reach the source returns `ok` with an
  advisory, never `err`. The write succeeded; the delivery did not.
- Trashing a task leaves its open interval open — the task is soft-deleted, not
  gone — and the offer disappears from the offeree's queue through the
  `liveTasks` join. Restore brings the pending offer back, unanswered, with its
  **original** `effective_from`, so the three-business-day clock is honest about
  the whole elapsed time. No new notification is created on restore.

## Testing

TDD, following `permissions.test.ts` and `live.test.ts` conventions — Vitest,
relative imports, no globals. `vitest.config.ts` includes `src/**/*.test.ts`
only; a `.tsx` test is never run and is green forever with zero tests executed.

Pure, table-driven:

1. **Token parsing** — a token-only body, a mixed body, a legacy-only body, a
   malformed uuid, a display name containing `]`, and a token inside otherwise
   ordinary prose. Asserts extracted ids and the rendered slice boundaries.
2. **Legacy fallback** — a plain-text `@Name` body still resolves. Plus a
   guard in the shape of `live.test.ts:590`'s check 7: the legacy branch is
   asserted to still be *called*, by call count, so deleting the calls while
   leaving the function on disk fails the build. That check exists because this
   repo already lost one load-bearing legacy probe to a merge resolution.
3. **Auto-upgrade** — a single `exact` match upgrades; a single `name-prefix`
   upgrades; two candidates do not; a `fuzzy`-only match does not, and notifies
   nobody.
4. **Interval transitions** — self-assign lands `accepted` with no offer;
   offer → accept; offer → decline returns to the assigner with
   `assignment_state = 'accepted'` and a non-null reason; decline with an
   inactive assigner returns to `apps.pm_id`; `effective_to` of the closed row
   equals `effective_from` of the opened one.
5. **Matrix cells** — `task.assign.force` and `task.assign.answer` across all
   seven roles, plus `capFor('trainee', 'task.assign.force') === 'none'`.
6. **Unanswered-offer arithmetic** — three business days across a weekend, a
   gazetted holiday and an `org_holidays` row, through the existing
   `working-days.ts` `isHoliday` callback.

Integration, mocked-`db` idiom:

7. **The mentions unique index** — calling the edit action three times over the
   same body produces exactly one `mentions` row and exactly one notification.
   Asserted through `toSQL()` on the built statement, the way `live.test.ts`
   proves `liveMeetings` emits `deleted_at is null`, since there is no database
   in the test environment.
8. **Assignment notifies** — each of `updateTask`, `moveTaskOnBoard` and
   `bulkUpdateTasks` reaches `createNotifications` on an assignee change, and
   `bulkUpdateTasks` emits one aggregated row per recipient rather than one per
   task.
9. **Suppression is recorded, not dropped** — an out-of-scope mention writes the
   `mentions` row with `suppressed_reason = 'no_access'`, creates no
   notification, and returns `ok` with the advisory naming the person.
10. **Shared entity vocabulary** — `activity_log.entityType`,
    `notifications.entity_type` and `mentions.source_type` all read from the one
    exported const union.

## Build order

1. **Token format, picker, renderer.** No schema, no notifications. Ships alone
   and stops the rename bomb from growing on day one.
2. **`mentions` table plus extraction at every surface that renders
   `MentionTextarea`** — task title and description (the live broken
   affordance), app comments, note segments, legacy meeting notes, worklog
   notes, follow-up text — and the `mention` kind. A surface that renders the
   picker and does not extract must not ship.
3. **`aliases`** into the picker and `matchPersonToAttendee`, with the collision
   refusal.
4. **`task_assignment_history` + `tasks.assignment_state`**, offer/accept/decline,
   `task.offered` / `task.declined` / `task.forced`, and the two matrix rows.
   Manual assignment stops being silent **here**, not earlier: shipping a bare
   `task.assigned` kind first and re-cutting it as `task.offered` two weeks later
   teaches people two meanings for one bell row and forces a dedupe re-key over
   live rows.
5. **The assigner dashboard read** — "Offered to you", "Awaiting their answer",
   three business days.

## Out of scope (YAGNI)

Each with the reason, so nobody re-adds it without answering the reason.

- **Multi-assignee tasks.** `canMoveTask` passes `assigneeId` as `ownerId` into
  `can()`'s `own` level (`permissions.ts:18-27`). Many-to-many means either
  `can()` takes an array — and every `own` check in the product changes meaning
  — or somebody adds a membership lookup and `can()` stops being pure and
  synchronous, the one property `capabilities.ts:4-9` documents as load-bearing
  because it is imported by client components and called per row. Beyond the
  code: two names on a task is no name on a task.
- **Auto-accept after N days.** Converts "nobody looked" into "they agreed".
- **Assigning to a role, team, orgTag or app.** `tasks.assigneeId` stays a
  `users` reference. Unassigned plus a **Claim** button is the answer to "anyone
  can take this", and it produces a real acceptance instead of a group that
  nobody in particular owes anything to.
- **`tasks.reviewer_id` or any approval gate on todo → done.** A second approval
  system beside `change_requests`, which is already designed, already has its
  capability rows, and has no consumers yet. Building the second guarantees
  neither is finished.
- **A unified `task_participants (task_id, user_id, role)` table.** Maximally
  DRY and definitely wrong: the four relationships have different lifecycles,
  different mutability, and exactly one belongs in the capacity sum. Share the
  table and every workload query must remember to filter by role — one day one
  will not, and somebody's capacity page reads 340%.
- **Rich text or markdown bodies.** The mention token is the only markup this
  product needs. A renderer over user-authored text is a new XSS surface, a
  sanitiser to maintain, and a migration of every existing body, in exchange for
  bold text. `MentionText` builds React nodes from string slices and never sets
  `innerHTML`; that property is kept.
- **Watchers / `task_watchers`.** No event stream to subscribe to yet — task
  comments do not exist (`app_comments` is app-level, `schema.ts:701`).
  Re-open when they do.
- **`@orgTag` group mentions.** Would need expansion to concrete ids at write
  time (a stored group reference makes a March mention of `@backend` silently
  mean different people in June), a count confirmation above eight people, and
  a refusal for the whole directory. Three UI decisions for a demand no surface
  has expressed.
- **`mentions.meeting_id`.** A fourth pointer vocabulary for one source type.
  `source_type` + `source_id` + the live-view join per type covers every read.
- **Backfilling `task_assignment_history` from `activity_log`.** The 0015
  lesson, documented in `0034_app_role_history.sql`.
- **Notifying the assigner on accept.** The expected outcome. Dashboard count,
  not a bell row.
- **A cron for unanswered offers.** Spec A fixed the count at one scheduled
  entry point; this is a `WHERE` clause over open rows and is always correct
  when computed at read time.
- **Notification preferences, quiet hours, per-kind switches.** Spec A already
  cut the kind × channel matrix. Volume is fixed at the source — dedupe keys,
  aggregated bulk, no watcher tier — not with a switch that lets the two people
  who find the settings page opt out of the notifications the feature exists to
  deliver.
- **Dropping `users.aliases` or the `notification_type` pgEnum.** Both are
  destructive, non-additive changes. The column is wired up here; the enum is
  superseded by spec A's `text` conversion and left in place.
- **Refactoring `updateTask`'s permission guard.** It still asks
  `isAdminRole(session.user.role) || isAssignee` (`task-actions.ts:359-361`)
  rather than the matrix. That is the RBAC spec's call-site sweep, not this
  spec's; the handshake is added behind whatever guard is there so the two
  changes stay separable in review. Noted here so it is a known ordering
  dependency rather than a discovery.
