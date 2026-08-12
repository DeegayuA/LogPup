# Dashboard Redesign + Activity Trail — Design Spec

Date: 2026-08-12 · Branch: main · Status: approved (user: "code it")

## Decisions (from brainstorm)

- Orientation: **my day first, team below**; admins get extra blocks.
- Blocks confirmed: portfolio health tiles, mentions/notifications, admin pending
  approvals, follow-ups owed to me.
- Layout: **three zones** (My day / Team / Portfolio), grid density per user rule —
  4-up desktop, 3-up tablet, 2- or 1-up mobile.
- Activity trail: **everyone sees everything**; forward-only from ship date.

## 1. Dashboard layout (`/`)

Server component, one `Promise.all`, no client fetches. Every block header links to
its full page.

- **Header**: greeting + date (kept) + unread-mentions chip.
- **My day**: 4 stat tiles — Due today, Overdue, Follow-ups I owe, Meetings today —
  derived with the already-tested helpers behind `/people/[id]` (task-workload,
  followup-split, meeting-window). Below: My tasks (due-ordered), My follow-ups
  (I-owe + owed-to-me, oldest first), Today & upcoming meetings (RSVP inline).
  Reuse the person-page cards where props allow rather than writing near-twins.
- **Team**: Capacity heat (kept, admin-editable) beside Active sprints (kept).
- **Portfolio**: health tile row (Apps · Open · Overdue · At-risk → `/apps`) served
  by a shared query so `/apps` and dashboard cannot drift; Notifications feed;
  Recent activity feed (last 10, §2); Pending approvals compact card (admin only).

## 2. Activity trail (`activity_log`)

The user's ask, verbatim: "keep a track of everything, who did what, which page,
which thing, when, need complete backtrack."

- **Table** `activity_log`:
  - `id` uuid pk
  - `actor_id` uuid → users (no cascade; users are never hard-deleted)
  - `verb` text — created / updated / deleted / moved / completed / assigned /
    unassigned / rsvp / resolved / approved / rejected / commented / …(open set,
    deliberately text not enum so a new verb needs no migration)
  - `entity_type` text — app / task / sprint / meeting / user / assignment /
    comment / followup
  - `entity_id` uuid, **no FK** — a log row must survive its entity's deletion
  - `entity_label` text — name denormalized at write time, same reason
  - `app_id` uuid + `app_name` text, nullable — grouping context, no FK
  - `page_path` text — page the action belongs to, e.g. `/apps/logpup`
  - `detail` text nullable — human fragment ("moved to In progress")
  - `metadata` jsonb nullable — before/after values (the backtrack)
  - `created_at` timestamptz default now
  - Indexes: `(created_at)`, `(entity_type, entity_id, created_at)`,
    `(actor_id, created_at)`.
- **Writer** `logActivity()` in `src/features/activity/log.ts`, called inside every
  mutating server action — apps, tasks, sprints, meetings (incl. RSVP, notes,
  follow-up resolution), assignments (alongside existing `assignment_history`),
  comments, admin user edits, own-profile edits. **Never throws**: failure is
  console.error'd, the user's action still succeeds. Not logged: sign-ins, reads.
- **Reads** `listActivity({ limit, before?, actorId?, entityType?, appId?, from?,
  to? })` — `created_at desc`, keyset pagination on `(created_at, id)`.
- **`/activity` page**: filter bar (person / type / app / date range), day-grouped
  list, "load more". Sidebar + ⌘K entries added. Visible to all members.
- Migration `0021`, `IF NOT EXISTS` everywhere, applied manually
  (`npm run db:migrate` is broken repo-wide — see memory logpup-migrations-untracked).

## 3. Errors & performance

- Log write swallowed on failure; never blocks or fails the wrapped action.
- Feed queries hit the new indexes; dashboard adds ~4 queries to the existing 4,
  all in the one `Promise.all`.
- New client JS only in the two feed cards' "load more" and the /activity filters.

## 4. Testing

Repo pattern is logic-only tests:

- `logActivity` swallows a DB failure (spy asserts console.error, action resolves).
- Filter/condition builder for `listActivity` is a pure function with its own tests.
- My-day tiles reuse helpers already covered by task-workload / followup-split tests.
- One representative action test asserting the log row shape + no-throw-on-log-failure
  (mocked db, same style as set-user-title.test.ts).

## Out of scope

- Backfilling history from before ship date (impossible — never recorded).
- Per-entity embedded timelines on app/person pages (later; `listActivity` already
  supports the filter).
- Interleaving `assignment_history` into the feed (later).
