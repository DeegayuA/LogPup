# Project Manager (PM) on apps

Commit: `385ee0a` — "feat: require a PM on every app and record PM changes"

## 1. Migration (`drizzle/0033_app_pm.sql`)

Added `apps.pm_id uuid REFERENCES users(id)`: nullable → backfilled from
`lead_id` → `SET NOT NULL`, all in one file, replay-safe (`ADD COLUMN IF NOT
EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object`, idempotent `UPDATE …
WHERE pm_id IS NULL`, idempotent `SET NOT NULL`). Journal entry `idx: 33`,
`tag: "0033_app_pm"`, `when: 1786600002000` — strictly greater than 0032's
`1786600001000`, which `select created_at from drizzle.__drizzle_migrations
order by created_at desc limit 1` confirmed was the newest applied entry
before this ran. `pmId` mirrored into `src/db/schema.ts` as `notNull()`.

**Pre-migration safety check** (required before making the column NOT NULL
in one shot): queried the dev DB directly —

```
select id, name, lead_id from apps;
```

Both apps (`LogPup`, `AV SCADA RPP`) had a non-null `lead_id`
(`0be8f2df-5c7c-4904-9d53-9c6f5e516152`), so the backfill-then-NOT-NULL was
safe to do in one migration. Confirmed **before** writing the SQL, not
inferred from the grounding notes.

**Post-migration verification against `information_schema`** (never trusted
the runner's exit code alone, per this repo's migration discipline):

```
column_name: pm_id, is_nullable: NO, data_type: uuid
```

FK constraint `apps_pm_id_users_id_fk` present (`ON DELETE no action`,
matching `apps_lead_id_users_id_fk`'s existing behavior exactly — checked the
original in `drizzle/0000_complete_adam_warlock.sql` rather than guessing).
Both apps' `pm_id` came back equal to their `lead_id`, confirming the
backfill ran. `drizzle.__drizzle_migrations` ledger shows a new row with
`created_at = 1786600002000`, matching the journal's `when` exactly — so
Drizzle actually recorded this migration as applied, not silently skipped.

**Pre-existing, unrelated drift found and left alone**: `npm run db:status`
still reports `0023_sprint_checkins.sql` as edited-after-applied and
`0029_attribution_membership.sql` / `0030_sprint_sort_order.sql` as pending
against this dev DB. This is the known snapshot-chain drift documented in the
`logpup-development` skill ("Dev carries hand-applied schema from every
branch; prod/preview were never verified") — present before this task, not
caused by it, and out of scope to repair here (repairing it means rebuilding
the drizzle-kit snapshot chain, which the skill explicitly says not to do
opportunistically). Migration `0033_app_pm.sql` itself does **not** appear in
either the pending or the edited list — it applied cleanly.

## 2. History (audit trail, not an as-of index)

Used the existing `logActivity` mechanism — no new table.

- `createApp` logs the initial PM assignment: verb `created`, detail `with
  <PM name> as PM`, metadata `{ pmId: { from: null, to: <id> } }`.
- `updateApp` now also detects PM **and** lead changes (the lead half of this
  gap existed too — `apps.lead_id` was overwritten in place with no history
  row before this change) via a new pure function,
  `summarizeAppChanges(before, set, names)` in
  `src/features/apps/update-input.ts`. It compares the update's actual `set`
  object against the row's prior state and only emits a detail
  fragment/metadata key for fields that **genuinely changed** — a no-op save
  (the settings form resubmits every field every time) produces `{ detail:
  null, metadata: null }` and logActivity still fires (as it always did for
  any `updateApp` call) but carries no PM/lead-specific evidence. Multiple
  simultaneous changes (e.g. status + PM in one save) combine into one detail
  string: `"status to archived, PM to Jane Doe"`.

**This gives an audit trail, not as-of querying.** `activity_log` answers
"who changed the PM (or lead) and when" — it does not answer "who was PM on
12 June" from a single indexed query; that requires walking the log and
replaying changes in application code. If as-of querying is ever wanted, the
honest follow-up is an interval table shaped like `assignment_history`
(open/closed `effective_from`/`effective_to` rows, a partial unique index
enforcing "at most one open row"). That is a deliberate non-goal of this
change, not an oversight.

**Important scoping note discovered while verifying in the browser**: the
per-app "Activity" **tab** (`src/features/apps/activity-queries.ts`,
`getAppActivity`) is a *separate*, narrower feed built from
comments/tasks/meetings/`assignment_history` — it does **not** read
`activity_log` at all, and never has. PM/lead changes therefore do **not**
appear there. They *do* appear on the site-wide `/activity` page
(`src/features/activity/queries.ts`, `listActivity`), which is the page that
actually reads `activity_log` — this is the surface the task's "activity
trail" requirement refers to, and it works as verified below. This split
predates this change; wiring `activity_log` rows into the per-app tab too
would be a separate, larger change (a genuine merge of two feed sources) and
was not attempted.

## 3. Create form

`src/features/apps/components/app-form-dialog.tsx`: added a required PM
`Select` next to the existing Lead select, matching its markup/behavior
exactly (an `items` map so the trigger shows the person's name instead of a
raw UUID; an orphan-preservation entry for a PM who's since been
deactivated) but with **no** "No PM" item — there is nothing equivalent to
send. Uses Base UI's native placeholder state (`value={form.pmId || null}` +
`<SelectValue placeholder="Choose a PM…" />`) rather than a sentinel, since
unlike Lead there's no valid "unset" value to submit. `handleSubmit` blocks
the request client-side when no PM is chosen (`errors.pmId = 'Choose a PM'`).

Server-side: new `src/features/apps/create-input.ts` exports
`appCreateInput`, a plain (non-`'use server'`) zod schema with `pmId:
z.uuid()` — required, no `.optional()`, unlike `leadId`. Pulled out of
`actions.ts` specifically so it's unit-testable (a `'use server'` file can
only export async functions, so the schema itself can't live there and still
be imported into a test). `createApp` uses it instead of the old inline
`appInput`.

## 4. Edit anytime

Both places an app is edited use the *same* `AppFormDialog` component (the
header's "Edit app" button and the Settings tab), so one change covered both:
`src/app/(app)/apps/[slug]/page.tsx` now passes `pmId: app.pmId` into
`initialValues` at both call sites. `src/features/apps/update-input.ts`'s
`appUpdateInput` gained `pmId: z.uuid()` (no `.nullable()`, unlike `leadId` —
when the key is present it must be a real id; the field can be omitted from
a partial update like any other, but never sent as a clear-sentinel).

Also added a PM column to the admin `AppsTable`
(`src/features/admin/components/apps-table.tsx`), another pre-existing Lead
inline-edit surface, with the same "no clear option" behavior.

## 5. Display

- `AppHeader` (`app-header.tsx`): identity line now reads
  `/slug · PM <name> · Lead <name> · Repo`.
- `AppCard` (`app-card.tsx`): two labelled lines, `PM · <name>` and `Lead ·
  <name>`, stacked rather than concatenated — the two apps in the dev DB were
  backfilled with `pm = lead`, so a single combined string ("PM · X · Lead ·
  X") would have read as a run-on the moment that's true, which is the
  common case right now.
- Admin `AppsTable`: PM column next to Lead.
- Search (`browse.ts`'s `queryMatches`): PM's name added to the free-text
  haystack the /apps search box already matches lead/description/tags/team
  members against — small, low-risk, and consistent with treating PM as a
  first-class field alongside lead.

## Tests

- `src/features/apps/create-input.test.ts` (new): `appCreateInput` rejects a
  missing/empty/non-uuid PM, accepts a valid one, still requires a name, and
  leaves lead optional.
- `src/features/apps/update-input.test.ts` (extended): `buildAppUpdate`
  accepts a valid PM / rejects a non-uuid one. New `summarizeAppChanges`
  suite — no entry when the PM (or anything) is unchanged, no entry for
  unrelated-field-only updates, records a PM change with the resolved name
  and a generic fallback when the name can't be resolved, records a lead
  change (including to "no lead"), doesn't log a lead change when the value
  is identical, and combines multiple simultaneous changes into one
  detail/metadata pair.
- `src/features/apps/browse.test.ts` (extended): `queryMatches` matches on
  PM name too.

## Verification output

- `npx vitest run` — **1992/1992 passed** (baseline was ~1977; the 15 new
  tests above account for the difference exactly). No baseline test broken.
- `npx tsc --noEmit` — clean.
- `npm run lint` — same pre-existing 23 problems (3 errors, 20 warnings) as
  before this change, all in files this task never touched (`meeting-form.tsx`,
  `meeting-panels.tsx`, `meeting-intel.tsx`, `note-timeline.tsx`,
  `sprints/queries.ts`, `ai-actions.ts`, `apple-icon.tsx`,
  `record-timeline.tsx`, `command-center.tsx`, `notes.test.ts`). No new
  problems added.
- `npx vitest run src/db/live.test.ts` — **18/18 passed** (all green; this
  task added no new read of `meetings`/`tasks`/`sprints`/
  `meeting_note_segments`/`meeting_screenshots` — the only new join is
  `users` via a `pm` alias, which carries no soft-delete column).

## Browser exercise (dev server on :3000, reachable)

Authenticated via the repo's existing dev-login credentials bypass
(`DEV_LOGIN_EMAIL` in `.env.local`, active whenever `NODE_ENV !==
'production'` — the same mechanism `e2e/auth.setup.ts` uses, just driven with
a throwaway Playwright script against the already-running human dev server
on :3000 instead of the e2e suite's dedicated :3400, which the e2e config
explicitly says never to touch). Real login, not a stub — the account is a
genuine seeded admin.

Observed, in order:

1. **Create without a PM → blocked.** Filled in a name, left PM unset,
   clicked "Create app". The dialog stayed open, the PM `Select` went into
   `aria-invalid` state, and a "Choose a PM" error appeared under it. No
   request reached the server with a missing PM (confirmed no "App created"
   toast, no new row).
2. **Create with a PM → succeeded.** Chose "Shanika Ayasmanthi" as PM, left
   Lead unset, submitted. Got the "App created" toast.
3. **App detail page** showed `PM Shanika Ayasmanthi` (later `PM Irushi
   Anupama` after the edit below) `· Lead not set` in the header identity
   line — the two roles displayed and clearly distinguished, as required.
4. **Edit → changed the PM.** Opened "Edit app", changed PM from Shanika
   Ayasmanthi to Irushi Anupama, saved. Got the "App updated" toast.
5. **Activity trail confirmed on `/activity`** (the site-wide feed — see the
   per-app-tab scoping note above): filtering by "PM Test App" showed exactly
   two rows —
   - `deeghayus created app PM Test App … with Shanika Ayasmanthi as PM`
   - `deeghayus updated app PM Test App … PM to Irushi Anupama`

   Cross-checked directly against the database (`select … from activity_log
   where app_id = …`) — both rows exist with correct `metadata`:
   `{"pmId":{"to":"...","from":null}}` on create and
   `{"pmId":{"to":"...","from":"..."}}` on the update, with the `from` id
   matching the PM chosen at creation.

Cleanup: the test app was archived (not hard-deleted, per this repo's
no-hard-deletes rule) rather than left cluttering the two real apps in the
shared dev DB.

## User action required

None for this change to function. If as-of PM/lead history ("who was PM on
a given date") is ever wanted, that is a new, separate interval table
(`assignment_history`-shaped) — a product decision to make deliberately, not
something this change attempts.
