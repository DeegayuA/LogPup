# App PM/lead history as queryable intervals

Makes "who was PM/lead of this app, and when" a real, indexed query —
`app_role_history` mirrors `assignment_history`'s as-of pattern, applied to
`apps.pmId` / `apps.leadId` instead of team allocation.

## 1. Table shape and its invariant

New migration `drizzle/0034_app_role_history.sql`, journal `idx: 34`, `tag:
"0034_app_role_history"`, `when: 1786600003000` — confirmed strictly greater
than the newest `created_at` in `drizzle.__drizzle_migrations`
(`1786600002000`, migration 0033) before writing the file. No sibling
worktree (`../LogPup-sdd-a`, `../LogPup-sdd-d`, `../LogPup-mobile`) had a
journal entry past `idx: 31`, so `34` was free everywhere, not just on main.

```sql
CREATE TABLE app_role_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id        uuid NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          app_role_kind NOT NULL,      -- pg enum: 'pm' | 'lead'
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to   timestamptz,
  changed_by     uuid NOT NULL REFERENCES users(id),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

One row per `(appId, role)` *interval*, half-open `[from, to)`. **Invariant:
at most one open row (`effective_to IS NULL`) per `(app_id, role)`**,
enforced (not just documented) by a partial unique index:

```sql
CREATE UNIQUE INDEX app_role_history_one_open_idx
  ON app_role_history (app_id, role) WHERE effective_to IS NULL;
```

This is narrower than `assignment_history`'s `(userId, appId)` key, because a
role here is a single scalar column on `apps` — there is one PM and at most
one lead at a time, not a set of allocations. There is deliberately **no
`change_kind`/tombstone column**: neither role has a summed quantity a stale
value could corrupt, and `leadId` — the only one of the two that can go back
to "nobody" — is fully described by a **closed row with nothing reopened
after it**. `appRoleAsOf` finds no row covering that instant and correctly
reports no lead; no special case is needed. Verified this exact path live in
the browser (see §6).

Supporting indexes, same shape as `assignment_history`'s: `(app_id,
effective_from)` for the per-app timeline, `(user_id, effective_from)` for
the per-person view, `(effective_from, effective_to)` for as-of lookups.

## 2. Backfill and its sentinel

One open row per app for its current `pm_id`, and one for `lead_id` where
non-null, with `effective_from = apps.created_at`. `changed_by` is inferred
(oldest admin, else the app's own `pm_id` as a guaranteed-non-null fallback)
— there is no real actor to name for a change nobody made through the app.

**The sentinel**: every backfilled row's `note` is set to the exact fixed
string `'backfilled at migration'` — `BACKFILLED_APP_ROLE_NOTE` in
`src/features/apps/role-history.ts` — not a prose description. This is
deliberate and non-negotiable: this repo has already been burned once by the
alternative. Migration 0015 backfilled `assignment_history` with
`effective_from = GREATEST(user.created_at, app.created_at)`, and because
those rows were indistinguishable from observed ones, a whole planned feature
had to drop as-of allocation as untrustworthy. `isBackfilled(note)` is a
plain equality check against the sentinel, unit-tested (`role-history.test.ts`),
and both the app-side and person-side UI cards call it through
`buildRoleTimeline`'s `backfilled` flag to render "Assumed at migration time
— not an observed change" instead of presenting an assumed date as fact.

## 3. Half-open boundary convention

`[effectiveFrom, effectiveTo)` — identical to `assignment_history`. A change
closes the old row and opens the new one from the **same** JS `Date`
instant, so at exactly that instant the successor wins and never both. Pinned
in `appRoleAsOf` (`src/features/apps/role-history.ts`) and covered by
dedicated tests: an instant strictly inside an interval, exactly on the start
boundary (included) and exactly on the end boundary (excluded), the instant
one holder is replaced by another (only the successor matches), before any
history exists (`null`), an app whose PM never changed (same row answers
every instant, including far in the future), a different role never matching
(`role` is part of the predicate), and a cleared lead reporting `null` once
its closing instant is reached.

## 4. Write path (`src/features/apps/actions.ts`)

- `createApp`: pre-generates `appId` via `crypto.randomUUID()` (same pattern
  `createMeeting` uses) so the initial PM row — and lead row, if one was
  chosen — can be inserted in the **same `db.batch`** as the `apps` insert
  itself. No gap where an app exists with no recorded PM start.
- `updateApp`: computes `pmChanging` / `leadChanging` by comparing
  `buildAppUpdate`'s `set` object against the row read immediately before the
  write (the same no-op discipline `summarizeAppChanges` already applies to
  the activity-log detail). Only for a field that actually changed does the
  batch include `closeOpenAppRoleInterval` + a new `buildAppRoleEntry`
  insert. **An unchanged value writes nothing** — verified both directly
  against the dev DB and live in the browser (§6). Clearing the lead
  (`leadId → null`) closes the open interval and inserts nothing, per the
  no-tombstone design in §1.
- Both existing `logActivity` calls are untouched and still fire — this is
  additive to the audit trail, not a replacement. The stale comment in
  `update-input.ts` that predicted "the honest follow-up is an interval table
  shaped like assignment_history; this does not attempt it" was updated to
  point at the table that now exists.

## 5. Read path

- Pure logic: `src/features/apps/role-history.ts` (`appRoleAsOf`,
  `buildRoleTimeline`, `buildAppRoleEntry`, `isBackfilled`,
  `BACKFILLED_APP_ROLE_NOTE`) — no database import, sibling
  `role-history.test.ts` (15 tests, all passing, see §7).
- DB access: `getAppRoleHistory(appId)` in `src/features/apps/queries.ts`
  (per-app timeline) and `getPersonAppRoleHistory(userId)` in
  `src/features/people/queries.ts` (per-person view — "which apps has this
  person been PM/lead of, and when", the question the user actually asked
  from the person's side). Both route their rows through the same
  `buildRoleTimeline` so "backfilled" cannot mean something different on the
  two surfaces.

## 6. Surfaced in the UI

- **App page**: `AppRoleHistoryCard` (`src/features/apps/components/`), on
  the Settings tab, directly under the "App details" card that edits
  PM/lead — the timeline sits right next to where the fact it describes is
  changed. Fetched only when `tab === 'settings'`, matching the page's
  existing tab-scoped-fetch discipline.
- **Person page**: `PersonAppRoleHistoryCard` (`src/features/people/
  components/`), titled "Project roles", placed alongside the existing
  `AllocationHistoryCard` — that card answers "how much of their time went
  where", this one answers "what were they in charge of".
- Every entry shows role (PM/lead badge), holder, `from – to` (or "now" +
  a "Current" badge), and either "Set by `<name>`" (observed) or "Assumed at
  migration time — not an observed change" (backfilled) — never presenting
  an assumed date as fact.

## 7. Verification output

**`npx tsc --noEmit`** — clean, no output.

**`npm run lint`** — 23 pre-existing problems (3 errors, 20 warnings), all in
files this task never touched (`meeting-form.tsx`, `meeting-panels.tsx`,
`meeting-intel.tsx`, `note-timeline.tsx`, `sprints/queries.ts`,
`ai-actions.ts`, `apple-icon.tsx`, `record-timeline.tsx`,
`command-center.tsx`, `notes.test.ts`). No new problems added.

**`npx vitest run`** — **2007/2007 passed** (120 files). Baseline was
~1992; the 15 new tests in `role-history.test.ts` account for the difference
exactly. No baseline test broken.

**`npx vitest run src/db/live.test.ts`** — **18/18 passed**, all green.
This task adds no new read of `meetings`/`tasks`/`sprints`/
`meeting_note_segments`/`meeting_screenshots` — `app_role_history` only joins
`apps` and `users` (via `pm`/`lead`-style aliases), neither of which is
soft-deletable, so `src/db/live.ts`'s live* subqueries were never in scope
for this change.

**`npm run db:migrate`** — reported success (never trusted alone, per this
repo's migration discipline). Verified directly against
`information_schema` / `pg_indexes` / `pg_constraint` / `pg_enum` afterward:

```
table exists:      app_role_history
columns:            id uuid NOT NULL · app_id uuid NOT NULL · user_id uuid NOT NULL
                     · role USER-DEFINED (app_role_kind) NOT NULL
                     · effective_from timestamptz NOT NULL
                     · effective_to timestamptz NULL · changed_by uuid NOT NULL
                     · note text NULL · created_at timestamptz NOT NULL
indexes:             app_role_history_pkey (id)
                     app_role_history_app_from_idx (app_id, effective_from)
                     app_role_history_user_from_idx (user_id, effective_from)
                     app_role_history_as_of_idx (effective_from, effective_to)
                     app_role_history_one_open_idx UNIQUE (app_id, role)
                       WHERE effective_to IS NULL
fks:                 app_role_history_app_id_apps_id_fk    → apps(id) ON DELETE CASCADE
                     app_role_history_user_id_users_id_fk  → users(id) ON DELETE CASCADE
                     app_role_history_changed_by_users_id_fk → users(id)
enum app_role_kind:  pm, lead
row counts by role:  pm: 3 (3 backfilled) · lead: 2 (2 backfilled)
migrations ledger:   id 34, created_at '1786600003000' — matches the journal's
                     `when` exactly, so drizzle actually recorded this as
                     applied, not silently skipped.
```

**Invariant actually enforced, not just declared** — attempted to insert a
second open `pm` row for an app that already had one open:

```
Rejected as expected: duplicate key value violates unique constraint
"app_role_history_one_open_idx"
open pm rows after attempted violation (should still be 1): 1
```

**Pre-existing, unrelated drift found via `npm run db:status`**:
`0023_sprint_checkins.sql` still reports edited-after-applied and
`0029_attribution_membership.sql` / `0030_sprint_sort_order.sql` still report
pending against this dev DB — the known snapshot-chain drift the
`logpup-development` skill documents. Confirmed via `git diff --stat` on
those three files that this session made **zero** changes to them — the
drift predates this task and is out of scope to repair here. Migration
`0034_app_role_history.sql` itself appears in **neither** the pending nor the
edited list.

## 8. Browser verification (dev server on :3000, reachable)

No interactive browser-automation tool is available directly to this agent.
Authenticated instead the way a prior session on this same repo documented
(`.superpowers/app-pm-report.md`): a throwaway Playwright script
(`@playwright/test`, already a dev dependency) driving the **already-running
human dev server on :3000** — never the dedicated e2e port :3400 — via the
real "Dev login" button (`DEV_LOGIN_EMAIL`, active whenever `NODE_ENV !==
'production'`). Real login, not a stub.

Used the pre-existing, already-archived `PM Test App 1786624225377`
(`/apps/pm-test-app-1786624225377`) left over from the prior PM feature's own
browser exercise, rather than touching either of the two real apps
(`LogPup`, `AV SCADA RPP`).

Observed, in order (screenshots taken; see the settings-tab and person-page
captures from this session):

1. **Before any change**: PM & lead history showed exactly 1 entry — Irushi
   Anupama, PM, Current, backfilled ("Assumed at migration time — not an
   observed change").
2. **Changed PM to Ramath Manjitha, set Lead to Shakya Samarasinghe** (lead
   was previously unset) via the real Settings-tab "Edit app" form, saved.
   History became 3 entries: the new PM row (Current, "Set by deeghayus" —
   observed, not backfilled), the new Lead row (Current, "Set by
   deeghayus"), and the **previous PM's row now closed** (`Aug 13 – Aug 13`)
   while still correctly showing its **original** backfilled label — closing
   a row does not touch its `note`.
3. **No-op save**: opened "Edit app" again, changed nothing, saved. History
   was byte-for-byte identical before and after — **0 rows added**,
   confirmed by direct comparison of the rendered list.
4. **Reverted**: PM back to Irushi Anupama, Lead cleared back to unset.
   History became 4 entries: Irushi Anupama reopened as PM (a genuinely new
   interval, "Set by deeghayus"), Ramath Manjitha's PM interval closed,
   Shakya Samarasinghe's Lead interval **closed with nothing reopened**
   (confirms the no-tombstone "clear the lead" design end-to-end — the app
   header correctly read "Lead not set" afterward, live-derived from
   `apps.leadId`, and `app_role_history` agrees), and the original backfilled
   PM row, unchanged.
5. **Person page** (`/people/<Deeghayu Adhikari's id>`): "Project roles" card
   rendered alongside "Allocation history", showing 4 entries for that
   person across their two real apps — all four correctly labeled "Assumed
   at migration time — not an observed change" (this person's roles have not
   been edited since the backfill).

**Incidental finding, left untouched**: while this test was running, `AV
SCADA RPP`'s PM changed live from Deeghayu Adhikari to Irushi Anupama,
`changed_by` a **different** user id than the "deeghayus" dev-login session
used for this test — i.e. a genuine, independent, concurrent edit by another
real session, not caused by this verification. `app_role_history` recorded
it correctly (one closed row retaining its original backfilled note, one new
open row, invariant intact) — an unplanned but welcome confirmation the write
path behaves correctly under real concurrent usage, not just my own test
actions. Per this repo's multi-session discipline, left it exactly as found
rather than reverting someone else's real change.

## 9. Commit — anomaly, reported rather than papered over

Before this agent ran its own `git add <explicit paths> && git commit`, an
automated checkpoint process in this environment committed (and pushed) the
**entire working tree** under the message `.` — commit `50b2946`, on top of
`385ee0a`. This is a recurring, pre-existing pattern in this repo's history
(bare `.` commits appear repeatedly, e.g. `7e7dc90`, `a80bf63`, `29a2bdf`,
predating this task) — not something this agent invoked (no `git add -A`,
`git commit -a`, `stash`, or `reset` was ever run here).

Verified the resulting commit's contents directly:

- Every file this task intended to change or create is present, correctly,
  exactly as written: `drizzle/0034_app_role_history.sql`,
  `drizzle/meta/_journal.json`, `src/db/schema.ts`,
  `src/features/apps/{actions,queries,update-input,role-history,role-history.test}.ts`,
  `src/features/apps/components/app-role-history-card.tsx`,
  `src/features/people/{queries}.ts`,
  `src/features/people/components/app-role-history-card.tsx`,
  `src/app/(app)/apps/[slug]/page.tsx`, `src/app/(app)/people/[id]/page.tsx`.
- `src/features/speech/` and `src/features/worklog/` — the two directories
  this task was explicitly told to leave alone — are **not** in this commit's
  diff. Confirmed via `git show --stat`.
- The same commit also swept in unrelated, already-uncommitted work from
  other concurrent activity that this agent never touched:
  `.superpowers/app-pm-report.md` (a pre-existing file from the earlier PM
  feature that had apparently never been committed), and
  `src/features/dashboard/components/{capacity-heat,capacity-heat-editable}.tsx`
  (a different in-flight change this agent did not author).

Since commit `50b2946` is already pushed and `origin/main` already points at
it, giving it the intended message (`feat: keep app PM and lead history as
queryable intervals`) would require either amending a shared, already-pushed
commit or a `git reset` + recommit — both need a force-push to update
`origin/main`, which this agent will not do without the user explicitly
requesting it (git safety protocol). Left the commit exactly as the
automated process created it and reported this plainly rather than silently
claiming a clean, purpose-built commit that did not happen.
