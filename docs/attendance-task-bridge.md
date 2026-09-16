# Attendance bridge — serving LogPup tasks to the Attendance Web App

**Status: all three parts are BUILT here. Nothing works end to end until the secrets are set on
both deployments.** The Attendance half is built too
(`Attendance-Web-App/LOGPUP_TASKS_INTEGRATION.md`). The two files describe one feature, and the
contract section below must stay identical in both.

| Part | State |
|---|---|
| One — the task API (`/api/external/*`) | Built. tsc, lint, build all exit 0 |
| Three — notifications, both directions | Built, including the in-app assignment notice LogPup never had |
| Two — sign-in handoff, Attendance → LogPup | Built. `0071_sso_redemptions` applied 2026-09-16; table, indexes and ledger row verified against Neon. Needs `LOGPUP_SSO_SECRET` on both sides |
| Two — sign-in handoff, LogPup → Attendance | Built. `POST /api/sso/attendance-handoff` + the button, in the sidebar footer AND the mobile sheet |

See "Built in this repo" near the end for the file list.

---

## What this is

An Alta Vision employee is assigned work in LogPup (`tasks`, on a sprint board, inside an app).
They spend their working day in the Attendance Web App — check-in, leave, the daily task log.
Today those are two disconnected windows: LogPup work is invisible where the person actually is,
and "what did you do today" gets typed twice.

This bridge gives the Attendance app a **read of that person's own LogPup tasks**, and a
**write-back of status only**. LogPup stays the system of record for the task; Attendance is a
second surface onto it.

It also adds **sign-in handoff in both directions** (Part two) and **notifications in both
directions** (Part three). All three parts share the domain gate and the email join, and each
ships independently of the others.

One dependency runs the other way, and it is easy to miss: **Part three requires Part one's
shared status writer**, and it requires wiring an in-app assignment notification LogPup does not
currently have. See the top of Part three.

### What does NOT cross

Stated up front because each of these is a request that will arrive later, and should be refused
without re-litigating it:

- **No task creation from Attendance.** A task belongs to an app and a sprint, and a creator who
  cannot see the board cannot pick either. Quick-add stays in LogPup.
- **No mirroring into Firestore.** Tasks are read live per request. A copy in `assigned_tasks`
  would be a second source of truth for one work item, and the first time the two disagreed
  nobody would know which was right. See "Why not mirror" below.
- **No reassignment, no due-date change, no delete.** Those are LogPup decisions made with the
  board in view.
- **No cross-tenant exposure.** Only `altavision.lk` addresses resolve. Southern Lanka
  (carecode.org) never sees a LogPup task, and cannot, even holding a valid key.

---

## Identity: how a LogPup user and an Attendance user become the same person

**The join key is the work email, lowercased. Nothing else.**

| | LogPup | Attendance |
|---|---|---|
| Table / collection | `users` (`src/db/schema.ts:130`) | `users` (Firestore), typed `AppUser` |
| Identity field | `email` — `notNull().unique()` | `email` |
| Primary key | `id` (uuid) | `epf_number` / Firebase `uid` |

LogPup has no EPF number and Attendance has no LogPup uuid, so email is the only field both sides
already hold for the same human.

**`users.personal_email` MUST NOT be used for matching.** The schema comment on that column is
explicit: it is contact metadata, never identity, and no sign-in path reads it. Matching on it
here would make it a second way to be recognised as somebody, which is the precise thing that
comment exists to prevent. Same rule for `github_login`.

A LogPup user whose email matches no Attendance user simply never appears there, and the reverse.
That is the correct outcome, not a bug to paper over with fuzzy name matching.

---

## The domain gate

"Alta Vision only" is enforced **twice, independently**. Either layer alone would be enough on a
good day; the point is that neither is the only thing standing there.

1. **In LogPup (this repo).** A new env var `LOGPUP_BRIDGE_DOMAINS` (default `altavision.lk`)
   lists the email domains the bridge will resolve. An address outside it returns
   `{ matched: false }` — the same shape as an unknown user, deliberately, so the endpoint cannot
   be used to enumerate which domains are configured.
2. **In Attendance.** A new tenant feature flag `logpupTasks`, on for the `altavision` tenant
   only. Attendance is one deployment serving several domains off different Firestore databases,
   so that is where "not carecode.org" is actually said.

This is **not** a reuse of `ALLOWED_EMAIL_DOMAINS`. That var decides who may sign in to LogPup,
and it currently carries four domains (`altavision.lk`, `syntaxgenie.com`, `pearlcluster.lk`,
`altavision.co.uk`). Widening sign-in must never silently widen what a shared API key can read.
Two different questions, two different vars.

---

## Authentication

A server-to-server shared secret, sent as `x-api-key`. This is the shape the Attendance app
already speaks — it consumes the Solar app the same way (`Attendance-Web-App/src/lib/solarApi.ts`)
— so the receiving side needs no new concept.

- New env var: **`LOGPUP_EXTERNAL_API_KEY`**. No default, no fallback. Absent means every request
  is refused, because an unauthenticated task API is a public read of everyone's work.
- Compare with `timingSafeEqual` over SHA-256 digests of both sides, exactly as
  `src/app/api/cron/notify-tick/route.ts` already does for `CRON_SECRET`. Copy that approach
  rather than inventing a second one; a plain `===` on a secret leaks its prefix to a patient
  caller.
- The key identifies **the calling application, not a user**. Every endpoint therefore takes the
  acting person's `email` as an explicit parameter and re-derives permission from it. Holding the
  key must never mean "act as anyone".

---

## Endpoints

All under `/api/external/`, mirroring the namespace Solar uses, so the Attendance-side proxy and
its API-playground path restriction (`path.startsWith('/api/external/')`) work unchanged.

Every handler needs:

```ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
```

`nodejs` because `timingSafeEqual` is a node builtin; `force-dynamic` for the same reason the
cron routes carry it — these read a header and must never be cached.

### `GET /api/external/tasks`

The signed-in Attendance user's own LogPup tasks.

| Param | Required | Notes |
|---|---|---|
| `email` | yes | The person whose tasks to return. Lowercased before lookup. |
| `status` | no | `open` (default — `todo` plus `in_progress`) or `all`. |
| `limit` | no | Default 50, hard cap 200. |

Response:

```jsonc
{
  "success": true,
  "matched": true,
  "user": { "id": "<uuid>", "email": "someone@altavision.lk", "name": "Someone" },
  "count": 2,
  "data": [
    {
      "id": "<task uuid>",
      "title": "Wire the payroll export",
      "description": "…or null",
      "status": "in_progress",
      "priority": 2,
      "dueDate": "2026-09-19",
      "dueKind": "committed",
      "dueCommitmentNote": "Promised to Finance",
      "originalDueDate": "2026-09-12",
      "isPrimaryAssignee": true,
      "assigneeCount": 3,
      "app":    { "id": "<uuid>", "name": "Attendance Web App", "slug": "attendance" },
      "sprint": { "id": "<uuid>", "name": "Sprint 14", "endDate": "2026-09-26" },
      "completedAt": null,
      "createdAt": "2026-09-01T04:12:00.000Z",
      "url": "https://<logpup-host>/apps/attendance"
    }
  ],
  "timestamp": "2026-09-11T09:00:00.000Z"
}
```

An unknown or out-of-domain email returns `200` with
`{ "success": true, "matched": false, "count": 0, "data": [] }`. **Not a 404.** A distinguishable
"no such user" turns the endpoint into an address oracle for anyone holding the key.

#### Query notes that are easy to get wrong

- **Read `liveTasks`, never `tasks`.** `src/db/live.ts` exports soft-delete-filtered subqueries.
  Querying the base table serves deleted tasks into another application, where nobody will ever
  see the trash page that explains them. Same for `liveApps` and `liveSprints`.
- **"Assigned to me" is the `task_assignees` join, not `assignee_id`.** `tasks.assignee_id` is
  the *accountable* person; `task_assignees` is everybody on it, and always contains that person
  (migration 0064 backfilled it). Someone genuinely on a task but not primary would otherwise
  never see it. Return `isPrimaryAssignee` so the Attendance UI can say which they are. The
  reverse direction is already indexed by `task_assignees_user_idx`.
- **Order by `due_date` ascending, nulls last, then `priority` descending.** This is "what is on
  my plate, soonest first", and `tasks_assignee_due_idx` is the partial index built for exactly
  that read (`deleted_at is null and status <> 'done'`), so the default `status=open` call hits
  it.
- **`due_date` is a `date`, and it leaves as the string it is.** Do not put it through
  `new Date()`. The schema comment says why: `new Date('2026-08-12')` is midnight UTC, still the
  11th west of Greenwich, and Attendance renders in Asia/Colombo.

### `PATCH /api/external/tasks/{id}/status`

```jsonc
// request
{ "email": "someone@altavision.lk", "status": "done", "note": "optional, 500 chars max" }
// response
{ "success": true, "task": { /* same task shape as above, after the change */ } }
```

Refusals, all shaped `{ "success": false, "error": "<sentence>" }`:

| Situation | HTTP |
|---|---|
| Bad or missing `x-api-key` | 401 |
| `email` out of domain, or no such user | 403 |
| `id` not a uuid, or task soft-deleted / absent | 404 |
| Caller is not an assignee of that task | 403 |
| `status` not one of `todo` / `in_progress` / `done` | 400 |
| A maintenance freeze is armed | 503 |

**The permission rule here is narrower than LogPup's own, on purpose.** `updateTask`
(`src/features/sprints/task-actions.ts:391`) lets an admin edit anyone's task. This endpoint lets
**only an assignee move their own task**, never on someone else's behalf. Admin reach is a
LogPup-UI power exercised with the board in view; an API key that also carried it would mean a
compromised Attendance deployment could rewrite the whole workspace. Do not "fix" this asymmetry
by adding the admin branch.

---

## Code changes in this repo

### 1. `src/lib/bridge-auth.ts` (new)

Key verification and the domain check, so no route handler carries its own copy.

```ts
export function bridgeKeyValid(header: string | null): boolean   // timing-safe
export function bridgeDomains(): string[]                        // LOGPUP_BRIDGE_DOMAINS
export function bridgeEmailAllowed(email: string): boolean
export async function resolveBridgeUser(email: string): Promise<{ id: string; email: string; name: string } | null>
```

`resolveBridgeUser` must also require `users.active` **and** `users.status === 'approved'`. A
deactivated or still-pending account has no business receiving work through a side door; the
`/deactivated` and `/pending` routes exist because LogPup itself stops those people at the login.

Model the pure half on `src/lib/allowed-domains.ts` — env-driven, no imports, unit-tested — and
add `src/lib/bridge-auth.test.ts` beside it, matching the `*.test.ts` convention every sibling in
`src/lib/` follows.

### 2. `src/features/sprints/task-status-write.ts` (new) — the important one

A status change is **not** one UPDATE. The full sequence currently lives inside `updateTask` and
`moveTaskOnBoard`, and three of its four steps are invisible unless you have read them:

1. `transitionTaskStatus(current, next, now)` decides `completed_at` as well as `status`.
   Bypassing it produces a row that reads "done" and answers "never completed", and every
   throughput and cycle-time reader downstream believes it.
2. The UPDATE itself.
3. `syncLinkedFollowups(taskId, from, to)` resolves or reopens the meeting follow-up the task was
   created from. Skip it and the meeting to task to resolution loop silently stops closing.
4. `logActivity(...)` — the activity feed, and the authority that outranks `tasks.completed_at`
   when the two disagree.

A second writer that implements step 2 and forgets 1, 3 and 4 is the realistic failure of this
whole feature, and it fails **quietly**. So:

- **Move** the existing private `syncLinkedFollowups` (`task-actions.ts:208`) into this new module
  and export it. A pure relocation; `task-actions.ts` then imports it.
- Export `applyTaskStatusChange({ taskId, actorId, actorName, next, now, note? })`, which runs all
  four steps and returns the updated row. Follow-up sync stays inside its own `try`/`catch`: it
  must never fail the task move it rides on.
- **This module carries no `'use server'` directive.** That directive makes every export a POST
  endpoint, and a route handler importing from such a file is how server-action internals end up
  reachable from a browser. `task-actions.ts` keeps its directive; this file must not have one.
- Then point `updateTask` and `moveTaskOnBoard` at it, so there is exactly one status writer. Do
  this in the same change, not "later" — two writers is the state this module exists to end.

Tests in `task-status-write.test.ts`: `todo` to `done` stamps `completed_at`; `done` to `todo`
clears it; `done` to `done` leaves it untouched; a non-assignee is refused.

### 3. `src/app/api/external/tasks/route.ts` (new)
### 4. `src/app/api/external/tasks/[id]/status/route.ts` (new)

Thin: verify key, resolve user, query or call `applyTaskStatusChange`, serialize. Every rule lives
in the two modules above so the handlers stay boring.

A shared `src/app/api/external/serialize.ts` holding the task-to-JSON mapper is worth it
immediately: both routes return the same shape, and the write route returning a subtly different
one is the kind of drift that surfaces as a blank field in another app weeks later.

### 5. The write freeze — verify, don't assume

`src/db/write-gate.ts` gates writes at the database boundary, and `tasks` is **not** in
`FREEZE_EXEMPT_TABLES`. So the status write is already refused during a maintenance window
without this bridge doing anything. What is missing is the *sentence*: the gate throws, and a raw
driver error crossing an application boundary reaches an Attendance user as "something went
wrong". Catch it in the status route and answer `503` with a plain "LogPup is in a maintenance
window — try again shortly". Add a test asserting this, because the behaviour under test is one
this repo gets for free and could therefore lose for free.

### 6. `src/lib/rate-limit.ts` — read its warning before reusing it

That module documents itself as in-memory, per-process, and explicitly **"do NOT reuse for a
multi-instance or public-facing deployment"**. LogPup is on Vercel. A limiter there is a comfort
blanket, not a control. Either accept that and say so in a comment at the call site, naming the
limitation, or leave it out. What actually bounds this endpoint is the `limit` cap of 200 and the
single trusted caller. Do not let a rate limiter that cannot work create the impression that
something is enforced.

### 7. `.env.example`

```bash
# ── Attendance bridge (see docs/attendance-task-bridge.md) ──
# Shared secret the Attendance Web App sends as x-api-key. No default: unset means refuse.
LOGPUP_EXTERNAL_API_KEY=
# Email domains the bridge will resolve. NOT the same list as ALLOWED_EMAIL_DOMAINS above —
# widening who may sign in must not widen what a shared API key can read.
LOGPUP_BRIDGE_DOMAINS=altavision.lk
# HS256 secret for the sign-in handoff, both directions. Distinct from the key above and from
# Attendance's ATTENDANCE_JWT_SECRET (which is Solar's): three integrations, three secrets.
# Unset means the attendance-sso provider is not registered at all.
LOGPUP_SSO_SECRET=
```

### 8. `CLAUDE.md`

One line under a new "External API" note pointing here, so the next session finds the contract
before re-deriving it.

> The sign-in handoff adds four more files in this repo — a `sso_redemptions` table and its
> migration, a provider in `src/lib/auth.ts`, a receiver page at `src/app/sso/attendance/`, and
> a handoff route for the reverse direction. They are specified in Part two below and can ship
> in a separate change; nothing in Part one depends on them.

---

## Why not mirror the tasks into Firestore

The alternative is a sync that copies LogPup tasks into Attendance's `assigned_tasks`. Rejected:

- **Two sources of truth for one work item.** The moment a sync lags or fails, the same task has
  two statuses and nothing says which is right. Live reads cannot drift, because there is only
  one copy.
- **Attendance's `assigned_tasks` already means something else** — a task raised by a supervisor
  inside the attendance workflow, with its own events trail, flags, comments and EPF-keyed
  assignees. Putting foreign rows in it makes every existing query a special case.
- **Deletes and soft deletes.** A task trashed in LogPup would need a tombstone push, or it
  lingers in Firestore indefinitely.
- **Cost.** The live read is one indexed Postgres query per poll. The mirror is a write per task
  per change, forever, plus a reconciliation job.

The real cost of live reads is that **LogPup being down means the section is empty**. That is
acceptable, and must be *designed for* rather than discovered: the Attendance side degrades to an
empty section with a quiet "couldn't reach LogPup" line, never a broken page. The Solar proxy
already does exactly this — `catch` then `200` with an empty list — and the Attendance-side doc
repeats the requirement.

---

## Part two: navigating between the two apps

Reading a task in Attendance is half of it. The other half is getting to the board — and back
again — without typing a password at the boundary. Two separate mechanisms, because the two apps
mint sessions in completely different ways.

### The rule that comes first

**A single-sign-on link is a convenience, never a way in.** Every rule that already governs who
may enter LogPup applies unchanged to an SSO arrival:

- **No auto-provisioning, ever.** Google sign-in auto-provisions and lands the person as
  `status='pending'`. SSO must behave like the Notion and GitHub providers instead: it succeeds
  only for an address that **already matches an allowed user**, and creates nothing. Otherwise
  the Attendance app becomes a way to mint LogPup accounts, and whoever holds the Attendance
  signing secret decides who works here.
- **The domain gate applies.** `bridgeEmailAllowed(email)` is checked before the lookup, same as
  the task endpoints.
- **`status === 'rejected'` is refused; deactivated is not.** Copy the passkey provider's
  reasoning verbatim (`src/lib/auth.ts:241`): a deactivated person's session is minted and
  reaches `/deactivated`, which is the screen that explains their situation. Refusing outright
  would show them a login failure instead of an answer.
- **`isRemoved(u.id)` is checked**, as the passkey provider does.
- **No role, no capability, no org tag arrives in the token.** The token says who; LogPup decides
  what. A claim shipped from another application would be a second, weaker source of truth for
  every permission in this repo.

### Attendance to LogPup

Attendance mints a short-lived HS256 JWT and sends the person to a LogPup receiver. It already
does exactly this for the Solar app (`Attendance-Web-App/src/app/api/solar-sso/route.ts`), so the
minting half needs no invention; this repo builds the receiving half, which Solar's docs describe
but this codebase has never had.

**Token claims** — deliberately minimal:

```jsonc
{
  "sub": "someone@altavision.lk",   // the email IS the subject; LogPup has no other handle
  "email": "someone@altavision.lk",
  "name": "Someone",                 // display only, never written to users.name
  "jti": "<uuid>",                   // replay guard, see below
  "iat": …, "exp": …                 // 3 minutes
}
```

No `epf`, no `phone`, no `role`. The Solar token carries all three because Solar uses them;
LogPup uses none, and a claim nobody reads is a claim somebody will eventually start reading.

**New env var: `LOGPUP_SSO_SECRET`.** Not `LOGPUP_EXTERNAL_API_KEY` and emphatically not
Attendance's `ATTENDANCE_JWT_SECRET`, which is Solar's. Three integrations, three secrets: one
compromised handoff must not hand over the others.

#### 1. Replay: `src/db/schema.ts` — a new `sso_redemptions` table

The token travels in a URL. URLs land in browser history, referrer headers, proxy logs and
screenshots, so a bearer token in one is readable after the fact. A three-minute expiry narrows
the window; it does not close it.

`webauthn_login_tokens` already solves this problem in this repo, and the shape to copy is not
the table but the **atomic redemption**: the write *is* the check, so a replay loses a database
race rather than being caught by a read that happened a moment earlier.

```ts
export const ssoRedemptions = pgTable('sso_redemptions', {
  jti: text('jti').primaryKey(),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
```

Redemption is `INSERT`, and a duplicate `jti` violates the primary key. Catch that one error and
refuse. Do not "check then insert" — two tabs opening the same link race, and the loser gets in.

Do **not** reuse `webauthn_login_tokens` for this. That table means "a passkey login is in
flight", and rows in it that came from somewhere else make its name a lie.

Two further obligations, both easy to miss:

- **`FREEZE_EXEMPT_TABLES` in `src/db/write-gate.ts` must list `sso_redemptions`.** Signing in is
  a write — that set already carries `users` and `webauthn_login_tokens` for precisely this
  reason. Omit it and a maintenance window locks out the admin who needs to get in to end the
  window, which is the one failure that feature must not have.
- **Retention.** Rows are dead the moment `expiresAt` passes. Add the delete to the existing
  retention step in `src/app/api/cron/notify-tick/route.ts`. That handler's comment is explicit
  that everything periodic becomes an ordered step inside it and never a second cron job —
  LogPup is on Vercel Hobby, two jobs, both already spoken for, and a third entry in
  `vercel.json` fails the deploy.

#### 2. `src/lib/auth.ts` — a new `attendance-sso` Credentials provider

Model it on the `passkey` provider immediately above it in the file.

```ts
Credentials({
  id: 'attendance-sso',
  name: 'Attendance',
  credentials: { token: {} },
  async authorize(creds) { /* verify → redeem jti → look up by email → refusals above */ },
})
```

Register it **only when `LOGPUP_SSO_SECRET` is set**, using the conditional-spread pattern the
Notion and GitHub providers already use. The comment there gives the reason: constructing a
provider with a possibly-undefined secret registers a broken sign-in option instead of simply
omitting one.

Verify with `jose`'s `jwtVerify`, pinning the algorithm to `HS256`. Passing the algorithm
explicitly is not ceremony — a verifier that accepts whatever the token's own header claims will
accept `alg: none`.

#### 3. `src/app/sso/attendance/page.tsx` — the receiver

A client page that reads `?token=` and `?next=`, calls
`signIn('attendance-sso', { token, redirectTo: next })`, and shows a plain "Signing you in…"
while it does. On failure it lands on the normal sign-in page with the ordinary message, not a
stack trace.

**`next` must be validated as a same-origin relative path** — it must start with a single `/` and
not `//`. An unvalidated `next` is an open redirect, and an open redirect on a sign-in route is
the classic way to harvest a session by bouncing someone to a lookalike host. Reject anything
else and fall back to `/`.

This page must be reachable while signed out. Check `src/proxy.ts` and the `(app)` route group's
layout: LogPup pins users to `/profile` when `mustChangePassword` is set and gates routes behind
a session, so `/sso/attendance` needs to sit outside that the way `/sign-in` and `/pending` do.
**Verify this rather than assuming it** — a receiver that redirects to the login page before it
can redeem the token is a handoff that never works, and it fails only in the signed-out case
nobody tests.

`mustChangePassword` deserves one explicit decision: someone arriving by SSO has not typed the
starter password, so pinning them to `/profile` is still correct. Leave that behaviour alone.

### LogPup to Attendance

The reverse needs a different mechanism, because Attendance sessions are Firebase Auth sessions
and only the Firebase Admin SDK can mint one.

The flow, which Attendance's `LOGPUP_TASKS_INTEGRATION.md` specifies in full:

1. This repo adds `POST /api/sso/attendance-handoff` (session-required, ordinary `auth()`), which
   signs a JWT with the same `LOGPUP_SSO_SECRET` and the same claim shape, and returns the
   Attendance URL to open.
2. Attendance verifies it, finds the user by email, and exchanges it for a Firebase custom token
   — the mechanism its passkey login already uses.

**This route mints a token naming the session's own user and nobody else.** The email is read
from `getSessionUser()`, never from the request body. A handoff endpoint that accepts a target
email is an impersonation endpoint.

### Where the buttons go

In the app shell's sidebar footer, beside the existing links — one row, the LogPup mark, the
label "Attendance". Copy the interaction model from `SolarAppButton.tsx` rather than writing a
new one; three of its details were paid for in production and are not obvious:

- **A top-level navigation on touch devices, a new tab on desktop.** Only a top-level navigation
  triggers OS link-capturing, so an installed Attendance PWA opens in the installed app instead
  of a browser tab.
- **The desktop placeholder tab is opened synchronously, before the `await`,** or the browser
  blocks it as a popup. It is opened *without* `noopener` — with it, `window.open` returns null
  and the handle is lost, leaving an orphaned blank tab; `opener` is severed afterwards instead.
- **Every failure falls back to opening the app's plain URL.** This is the part that matters most
  and is the easiest to drop: both apps are PWAs with persistent sessions, so the overwhelmingly
  common case is that the person is *already signed in at the other end* and the SSO round trip
  was never needed. A broken handoff should cost a click, not a journey.

### Deep links

Navigation is rarely "open the other app". It is "open this task's board". Both sides therefore
carry a `next` path:

- Attendance to LogPup: a LogPup task row links to `next=/apps/<slug>`. That is what the `url`
  field in the task payload is for.
- LogPup to Attendance: `next=/tasks`, or `/dashboard` from the sidebar.

Both must run the same relative-path validation described above. One shared helper, on each side,
with its own unit test.

---

## Part three: notifications, both directions

Two events cross:

| Event | Origin | Reaches |
|---|---|---|
| A task is assigned to somebody | LogPup | That person's Attendance bell, and their phone |
| A task's status is changed | Attendance | The assigner and the other assignees, in LogPup |

### Before anything else: LogPup does not notify on assignment today

`src/features/sprints/assignment-notice.ts` is written, documented and unit-tested. It is called
from **nowhere**. `grep` for `buildAssignmentNotice` outside its own test file returns nothing, and
`createNotifications` has no caller anywhere under `features/sprints`.

So the honest statement of this work is not "forward LogPup's assignment notification to
Attendance". It is: **build LogPup's assignment notification, then fan it out.** Getting that
order wrong produces the absurd result where an Alta Vision employee is told on their phone about
a task that the app the task actually lives in never mentioned.

Wire it first, as its own change, and confirm it works inside LogPup alone.

#### Where it goes

The one place that knows an assignment happened is `setTaskAssignees`
(`src/features/sprints/task-assignees.ts:193`), which already computes exactly what is needed:
`diffAssignees` returns `change.add`, the people newly put on the task, distinct from the ones who
were already there. Re-deriving that in a caller would mean re-implementing the diff.

But `setTaskAssignees` returns an `AssigneeChange` and writes nothing else — **keep it that way**.
It is called from `createTask`, `updateTask` and the paste and suggestion paths, and a
notification fired from inside a batch helper is a side effect none of those callers can see or
suppress. Have the callers pass `change.add` to `createNotifications` after their write succeeds,
which is the shape every other notifying action in this repo already uses.

`shouldNotifyAssignee` in that same pure module already answers "does this person get told",
including the self-assignment case. Use it; do not re-test the condition at the call site.

#### The row to write

```ts
await createNotifications([{
  userId: assigneeId,
  actorId: session.user.id,
  type: 'system',
  kind: 'task.assigned',
  title: notice.title,
  body: notice.body,
  link: notice.link,
  entity: { type: 'task', id: taskId },
  params: { taskId, appId, actorId: session.user.id },
  visibility: { action: 'app.view', resource: { appId } },
}])
```

Four notes, each of which the schema or `notify-rules.ts` will punish you for getting wrong:

- **`kind` is the discriminator, `type` is legacy.** The schema comment is explicit: `kind` is free
  text precisely so a new kind of notification needs no migration. Use `'task.assigned'`.
- **`type: 'system'` is a compromise, and worth naming.** The enum's three values are `mention`,
  `meeting` and `system`, and the comment says `system` means "the workspace talking about itself
  rather than a person talking to a person". An assignment is a person talking to a person, so
  none of the three fits. The alternative is adding an enum value, and this repo documents why
  that is unpleasant — Postgres forbids using a freshly `ADD VALUE`'d member in the same
  transaction, which is why `activity_log.verb` is `text`. Take `'system'`, and check what the
  bell's icon logic reads: if it picks the icon off `type`, an assignment will wear a system icon
  until somebody moves that logic to `kind`.
- **`params` carries ids, never names.** The column comment states the reason: freezing
  `actorName` into jsonb is how an inbox ends up asserting something that stopped being true when
  a person is renamed. Rendering resolves ids at read time.
- **`visibility` is not optional thinking.** `recipientsFor` runs `can()` against it, because a
  notification is a read of the thing it names, and one that opens a page the reader may not see
  is a permission leak that arrives by itself. Gate on the app.

`createNotifications` also drops the actor themself, drops deactivated and unapproved people, and
applies the per-day cap. That is all handled; do not re-implement any of it at the call site.

### Direction A: LogPup assignment reaches the Attendance bell

#### Why a webhook, and not the poll we already have

Attendance polls `/api/external/tasks` every 60 seconds, so a newly assigned task *appears*
without any new mechanism. That is not a notification. The point of a notification is to reach
somebody whose phone is in their pocket and whose Attendance tab is closed, and only a server-side
FCM push does that. A client poll cannot, by construction.

So LogPup calls out. One `POST`, best effort.

#### `src/features/notifications/attendance-webhook.ts` (new)

```ts
export async function postAssignmentToAttendance(events: AttendanceEvent[]): Promise<void>
```

Payload:

```jsonc
{
  "events": [{
    "eventId": "<uuid>",              // idempotency key, see below
    "kind": "task.assigned",
    "occurredAt": "2026-09-11T09:00:00.000Z",
    "recipientEmail": "someone@altavision.lk",
    "actorName": "Someone Else",
    "title": "Someone Else assigned you “Wire the payroll export”",
    "body": "Attendance Web App · committed, due 2026-09-19",
    "link": "/tasks",
    "taskId": "<uuid>",
    "appSlug": "attendance"
  }]
}
```

Rules:

- **Signed, not keyed.** HMAC-SHA256 over the exact raw request body with a new
  `LOGPUP_WEBHOOK_SECRET`, sent as `x-logpup-signature`, plus `x-logpup-timestamp` which the
  receiver requires to be within five minutes. A bearer key would be replayable and would also be
  a fourth thing to rotate; a signature binds the secret to the body. **Four secrets now exist and
  each does one job** — the task API key, the SSO secret, this, and Solar's, which is unrelated.
- **`recipientEmail`, never an EPF.** LogPup has no EPF number and must never learn one. The
  receiver resolves the person.
- **Nothing is sent for a recipient outside `LOGPUP_BRIDGE_DOMAINS`.** Filter before the request,
  not at the far end. A notification for a `syntaxgenie.com` employee has no business leaving the
  building.
- **`eventId` is stable per (notification row, recipient).** The receiver keys its Firestore doc
  off it, so a retry writes the same document rather than a second bell entry.
- **Best effort, and it must stay that way.** Called after the assignment has already been
  written, wrapped so nothing thrown escapes — the same contract `createNotifications` itself
  keeps, and for the same reason: a failure here must never report a saved assignment as failed.
- **`await` it, do not fire and forget.** On Vercel the function may be frozen the moment the
  response is sent, and a floating promise is simply lost. One short timeout — three seconds —
  then give up.

#### What a dropped webhook costs, stated rather than engineered around

One failed POST is one missed interruption. The task itself still arrives, because the Attendance
tasks section polls for it. That is the same trade this repo's own daily notification cap already
makes on purpose: *a capped day loses the interruption and not the information.*

So **no outbox table, no retry queue, no second cron job** in v1. `notify-tick` is explicit that
everything periodic must become an ordered step inside it rather than a third `vercel.json` entry,
which fails the deploy on Hobby. If missed notifications turn out to matter, the right fix is a
`notification_outbox` table drained by a step inside that existing tick — not a new job, and not
in this change.

### Direction B: a status change from Attendance notifies LogPup

This one needs no transport at all. `applyTaskStatusChange` (Part one, change 2) is already
becoming the single status writer for every path — the board, the dialog, and the external API.
Add a fifth step to it: `createNotifications`.

**Recipients:** the other assignees, plus `task_assignees.added_by` for the acting person's row —
the nearest thing to "who put them on this" — and never the actor. `recipientsFor` drops the actor
automatically, so pass the full set and let the one door do its job.

```ts
kind: 'task.status_changed',
entity: { type: 'task', id: taskId },
params: { taskId, appId, actorId, from, to },
dedupe: { key: `task-status:${taskId}`, permanent: false },
visibility: { action: 'app.view', resource: { appId } },
```

**Collapse-while-unread dedupe is the load-bearing choice.** Somebody dragging a task through
`todo` to `in_progress` to `done` in one sitting generates three events. Without dedupe that is
three bell rows about one task. The non-permanent mode collapses them while unread and resets once
seen, which is exactly the semantics `notifications_dedupe_collapse_idx` enforces in the database.

**This changes LogPup's own behaviour, and that is intended.** Because the writer is shared, status
changes made on the LogPup board start notifying too. Do not special-case the API path to avoid
that: a notification that depends on which window the person used is the kind of inconsistency
nobody can explain later. It also settles the open question this document previously left — the
answer is now yes, and the daily cap plus this dedupe are what keep it from becoming noise.

**Whether a LogPup status change should also reach the Attendance bell** is deliberately not built.
The event channel in Direction A would carry it, and the recipients would be the same people. It is
left out because every one of those recipients is already a LogPup user who just got a LogPup
notification, and telling the same person the same thing twice on two devices is how people turn
both off.

### Env additions

```bash
# Where LogPup posts task events. Unset disables the fan-out entirely (the in-app
# notification is unaffected).
ATTENDANCE_WEBHOOK_URL=https://attendance.altavision.lk/api/logpup/events
# HMAC-SHA256 signing secret for that POST. Not the API key, not the SSO secret.
LOGPUP_WEBHOOK_SECRET=
```

---

## Built in this repo

| File | What it is |
|---|---|
| `src/lib/bridge-auth.ts` + `.test.ts` | Key check, domain gate, user resolution. 13 cases |
| `src/features/sprints/task-status-write.ts` + `.test.ts` | The shared status writer; `syncLinkedFollowups` relocated here, `statusActivity` de-duplicated out of the two actions |
| `src/app/api/external/serialize.ts` | One task-to-JSON mapper, shared by both routes |
| `src/app/api/external/tasks/route.ts` | GET the person's own tasks |
| `src/app/api/external/tasks/[id]/status/route.ts` | PATCH one status |
| `src/features/sprints/assignment-notify.ts` | Wires `assignment-notice.ts` up at last, and fans out |
| `src/features/notifications/attendance-webhook.ts` | Signed outbound POST |
| `src/features/sprints/task-actions.ts` | `createTask` / `updateTask` now notify; both actions share the extracted helpers |
| `drizzle/0071_sso_redemptions.sql` + journal entry | **Applied** 2026-09-16 |
| `src/db/schema.ts` — `ssoRedemptions` | The replay guard. Primary key IS the mechanism |
| `src/db/write-gate.ts` | `sso_redemptions` added to `FREEZE_EXEMPT_TABLES` — signing in is a write |
| `src/features/auth/attendance-sso.ts` + `.test.ts` | Hand-rolled HS256 verify + atomic redemption. 19 cases, happy paths minted with the real `jose` |
| `src/lib/auth.ts` — `attendance-sso` provider | Conditionally registered; four refusals; added to the signIn callback's early-return list |
| `src/lib/safe-next.ts` + `.test.ts` | Relative-path validation, shared by both directions |
| `src/app/sso/attendance/page.tsx` + receiver component | Outside `(app)` and outside the proxy matcher |
| `src/proxy.ts` | `sso` excluded from the matcher — the receiver runs signed OUT |
| `src/app/api/cron/notify-tick/route.ts` | The expiry sweep, as step one's second half |
| `src/features/auth/attendance-sso.ts` — `signAttendanceHandoff` | The outbound mint. Email is an argument; the route reads it from the session |
| `src/app/api/sso/attendance-handoff/route.ts` | Session-required, returns the URL to open |
| `src/components/shell/attendance-app-button.tsx` | The button. SolarAppButton's interaction model, LogPup's NavLink styling |
| `src/components/shell/sidebar.tsx` + `mobile-nav.tsx` | Where it renders. BOTH — see below |
| `.env.example` | Six vars, four distinct secrets |

Also changed, as fixes review surfaced: `createNotifications` now RETURNS the recipient ids that
survived its gate (it returned `void`; every existing caller ignores it), so the Attendance
webhook pushes to exactly the people the in-app row went to. Deriving that set a second time in
the webhook was the bug — a deactivated person, or one without `app.view` on the app, would have
had the task title pushed to their phone while the inbox correctly withheld it. `moveTaskOnBoard`
now notifies a new assignee, and `bulkUpdateTasks` now syncs linked meeting follow-ups.

Three things changed in existing behaviour, all intended and all worth knowing:

- **LogPup now notifies on assignment.** It never did. `assignment-notice.ts` was written,
  documented and unit-tested, and called from nowhere — `grep` for `buildAssignmentNotice`
  outside its own test returned nothing. Building the Attendance fan-out on top of an event that
  did not exist would have meant telling somebody on their phone about a task the app the task
  lives in never mentioned.
- **A status change now notifies the other people on the task**, wherever it was made. Because
  the writer is shared, that includes the board and the dialog, not just the API. This is
  deliberate: a notification that depends on which window somebody used is an inconsistency
  nobody can explain later. The daily cap and collapse-while-unread dedupe are what keep it from
  becoming noise.

### The trust model, stated plainly

`LOGPUP_EXTERNAL_API_KEY` is the only authority on these endpoints and it names no user. Anyone
holding it — a compromised Attendance deployment, a leaked environment variable, an operator
there — can read every in-domain person's task list and move any of their tasks, with the write
recorded in `activity_log` as that person's own action. `metadata.via = 'attendance'` is the only
forensic trace that it came through the bridge.

There is no rate limit on either route: `src/lib/rate-limit.ts` documents itself as in-memory and
per-process and explicitly refuses responsibility for a multi-instance deployment, which Vercel
is. What actually bounds the endpoints is the `limit` cap of 200 and a single trusted caller.

This is accepted, not overlooked. It is written down so the next person weighing "can we give
this key to X" is weighing the real thing.

### Pre-existing LogPup bugs this work uncovered

Found by review while building. **None of them is caused by the bridge**, and the first one
changes how you should read `task_assignees` everywhere.

1. **`task_assignees` is not maintained by the normal UI, so the schema's stated invariant does
   not hold.** `setTaskAssignees` is the only writer, and `createTask`/`updateTask` call it only
   behind `if (assigneeIds)` — but the board composer and the task dialog send the scalar
   `assigneeId` and never the array. Only the meeting AI path sends it. So every task created or
   reassigned through the normal UI has `tasks.assignee_id` set and **no join row**, while
   `src/db/schema.ts` says the table "ALWAYS CONTAINS that person". `moveTaskOnBoard` is the one
   path that does keep it in sync, which is why this looks fine in a drag test.
   *Handled here:* both external routes read the UNION of the column and the join, so the bridge
   is correct either way. *Not fixed here:* repairing assignment semantics touches the core
   write paths and deserves its own change and its own review.
2. **A committed write can be followed by `err()`.** In `createTask` and `updateTask`, the
   INSERT/UPDATE and `setTaskAssignees` are in one `try` with no transaction — neon-http has
   none. If the second throws, the first has already committed and the action returns an error,
   skipping `logActivity`, the follow-up sync and the notification. That leaves a task at `done`
   with a `completed_at` and no `completed` activity row, which is the one pairing
   `task-status.ts` says nothing can reconstruct.
3. **No rowcount check on the status UPDATE.** `applyTaskStatusChange` and both actions update
   without `.returning()`, so a task soft-deleted between the read and the write reports success
   and logs an activity row for a change that did not happen. `deleteTask` does check.
4. **A bulk status change logged `verb: 'updated'`**, so `features/signals/observe.ts` classifies
   a bulk completion as `task.moved` and it never reaches the throughput readers. Not changed —
   the summary row is deliberately one row for the batch, and picking a verb for a mixed patch
   is a decision, not a fix.

Items 2, 3 and 4 are left as found and reported rather than fixed as drive-bys.

### Part two was held on the migration; it is not any more

`0071_sso_redemptions` was applied on 2026-09-16 (`npm run db:migrate`), and the table, both
indexes and the ledger row were verified against Neon afterwards. The five pieces that were
deliberately held until then — the `schema.ts` declaration, the `FREEZE_EXEMPT_TABLES` entry, the
retention sweep, the provider and the receiver page — all landed together with it.

`db:status` still reports `0050_worklog_entry_app.sql` as "edited after it was applied". That is
a pre-existing hash mismatch on an unrelated migration, not drift: the schema change itself is
applied and `db:migrate` is not the fix. `npm run db:drift` is clean.

Four decisions inside those five pieces are worth knowing, because none is obvious from the
spec above and each was made against a real alternative:

- **The token is verified by hand, not with `jose`.** `src/features/auth/google-one-tap.ts`
  records the standing reason: jose is in `node_modules` only as a transitive dependency of
  next-auth, so importing it directly makes LogPup break the day next-auth changes its
  dependency tree. One Tap had a third option (Google's tokeninfo endpoint) and this has none,
  so the choice was a lockfile write or thirty lines of HMAC. HS256 is a plain keyed hash — no
  key discovery, no certificate chain, no algorithm negotiation. The one classic JWT mistake
  that does apply, trusting the token's own `alg`, is refused before anything is computed.
  The unit tests mint their happy-path tokens with `jose`'s `SignJWT` — the exact call
  Attendance makes — so the hand-rolled verifier is proved against the real thing rather than
  against itself.
- **The jti is spent BEFORE the user lookup**, not after the refusals. A token captured from
  browser history is therefore burnt on its first presentation whatever the answer turns out to
  be; deferring the write would leave a refused token live and hand an attacker unlimited
  retries against it.
- **The sweep keeps a spent row for an hour past its expiry.** The row's job is to make a second
  redemption lose a database race, and it is needed for as long as the token can still verify —
  which, because the verifier allows 30 seconds of clock skew past `exp`, is slightly longer than
  the token's own lifetime. Deleting on the stroke of expiry would reopen a half-minute window
  in which a captured link verifies AND finds no record of having been spent.
- **`safeNext` also rejects a leading backslash**, which the spec's "starts with a single `/`
  and not `//`" rule does not. Browsers normalise `\` to `/` in URLs, so `/\evil.example`
  becomes protocol-relative *after* a `//` check has already passed it. **The Attendance side's
  copy does not have this rule yet** — see `Attendance-Web-App/src/app/api/logpup-sso/route.ts`.

The other direction landed with it. Two notes on it that the spec above does not cover:

- **The button renders in the mobile sheet as well as the desktop sidebar footer.** The spec says
  "the app shell's sidebar footer", and shipping only that would have been defensible and wrong:
  the touch branch of the interaction model — a top-level navigation, so an installed Attendance
  PWA captures the link — only ever runs on a phone, which is the one device that never sees the
  desktop sidebar. `mobile-nav.tsx`'s `<nav>` closes the sheet on `<a>` clicks only, so the
  button sits outside it and closes the sheet itself through `onNavigate`.
- **`ATTENDANCE_APP_URL` is new, optional, and deliberately not the only copy of that URL.** The
  route reads it (defaulting to production, mirroring how Attendance names this repo with
  `LOGPUP_APP_URL`). The BUTTON hardcodes the same URL, because its fallback is needed exactly
  when the request to that route failed and so cannot come from the response. SolarAppButton
  hardcodes its counterpart for the same reason. If the deployment moves, both change together.

---

## Contract summary (must match the Attendance doc word for word)

**Status mapping.** LogPup's enum is lowercase and internal; Attendance's is title-case and shown
to people. Map at the boundary, in one function, on the Attendance side:

| LogPup `task_status` | Attendance `TaskStatus` |
|---|---|
| `todo` | `Pending` |
| `in_progress` | `On Progress` |
| `done` | `Completed` |

LogPup has no equivalent of a custom Attendance status, and Attendance must never send one. The
API rejects anything outside the three with a `400`.

**Request and response shapes:** as specified under "Endpoints" above.

**Polling:** 60 seconds while the tasks page is open, plus on window focus. Not 30. The Solar
integration learned this at 300-plus users; the faster cadence doubled backend load for no
visible freshness win.

---

## Rollout

1. Ship the LogPup side first, keyed, with `LOGPUP_BRIDGE_DOMAINS` set and the Attendance flag
   still off. Nothing consumes it yet; verify with `curl`.
2. Ship the Attendance side with `logpupTasks` off for every tenant.
3. Turn the flag on for `altavision` only, through the tenant registry. No deploy needed.
4. Watch the LogPup activity feed. Status changes made from Attendance appear there under the
   acting person's name, which is the end-to-end proof that identity resolution is correct.

Part two ships after, and separately:

5. ~~Add `sso_redemptions` and run the migration.~~ **Done 2026-09-16.** It is in
   `FREEZE_EXEMPT_TABLES` and in the retention step, both verified before the provider was
   registered.
6. Set `LOGPUP_SSO_SECRET` on both deployments — the same value on each, or the signature
   verifies against nothing. **This is the only remaining step, and until it is done the
   `attendance-sso` provider is not registered at all, arriving handoffs are refused, and the
   outbound route answers 503 (which the button turns into its plain-URL fallback, so the button
   keeps working — it just stops signing anybody in).** The buttons themselves are built.
7. Test the two refusals that matter, deliberately, on a real deployment: **a replayed link**
   (open the same SSO URL twice — the second must fail), and **an unknown email** signed with a
   valid secret (must refuse, and must not create a user). If either succeeds, stop.

## Open questions

- ~~Should a status change from Attendance notify anyone in LogPup?~~ **Decided: yes.** See
  Part three, Direction B. The activity-log entry remains the floor and is non-negotiable; the
  notification sits on top of it. The noise objection that originally deferred this is answered by
  collapse-while-unread dedupe plus the existing daily cap, not by dropping the feature.
- **`note` on a status change** is accepted and written into `activity_log.detail`. There is no
  LogPup column for it today. If notes turn out to matter, that is a schema change, not something
  to smuggle into the description field.
