# One meeting, several projects — build plan

Status: **plan only.** No code, no schema change, no migration in this wave (`AGENTS.md`
wave rule + `.claude/skills/logpup-development/SKILL.md`: `drizzle-kit generate` is
FORBIDDEN, migrations are hand-written SQL + a hand-written journal entry).

Scope of the decision, already made and not relitigated here: a join table, many-to-many,
**every project equal, no primary project**. Migration number **0040** is claimed.

Line numbers are from the working tree at the time of writing and drift constantly —
three other sessions are editing this repo. Treat the **function name** as the anchor and
re-grep before touching anything. Everything below was read in the source; anything that
could not be verified is marked `[unverified]`.

---

## 1. The join table

### Shape

```ts
// src/db/schema.ts — placed immediately after `meetings`, before `meetingAttendees`,
// so the two membership tables of a meeting read together.
export const meetingApps = pgTable('meeting_apps', {
  meetingId: uuid('meeting_id').notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  appId: uuid('app_id').notNull()
    .references(() => apps.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.meetingId, t.appId] }),
  index('meeting_apps_app_idx').on(t.appId),
])
```

SQL for 0040:

```sql
CREATE TABLE IF NOT EXISTS "meeting_apps" (
  "meeting_id" uuid NOT NULL REFERENCES "meetings"("id") ON DELETE CASCADE,
  "app_id"     uuid NOT NULL REFERENCES "apps"("id")     ON DELETE CASCADE,
  CONSTRAINT "meeting_apps_pk" PRIMARY KEY ("meeting_id","app_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meeting_apps_app_idx" ON "meeting_apps" ("app_id");
```

`IF NOT EXISTS` on both, because this repo hand-applies SQL and has re-run statements
before (SKILL.md's ledger-drift note). `--> statement-breakpoint` between statements and
**never inside a comment** — the splitter is a plain string split.

### Keys and indexes, and what each is for

- **`PRIMARY KEY (meeting_id, app_id)`** is the invariant (a project appears on a meeting
  at most once — this is what makes a double-submit from the picker a no-op rather than a
  duplicate) *and* the access path for the dominant read, "which projects is this meeting
  on", whose leading column is `meeting_id`. Same construction as `meetingAttendees`'
  `primaryKey({ columns: [t.meetingId, t.userId] })`.
- **`meeting_apps_app_idx` on `(app_id)`** is the reverse direction — "which meetings is
  this project on" — which is `getMeetingsForApp`, the app page's meeting counts,
  `getAppActivity`'s meetings branch and `suggest-actions.ts`. Without it every one of
  those becomes a full scan, and the `app_id` foreign key's cascade delete has no index
  to use either. `tasks` already learned this lesson the expensive way (the comment on
  `tasks_app_sprint_sort_idx`: *"`tasks` had no index at all, so every board render was a
  full scan + sort"*).
- **No partial `WHERE deleted_at IS NULL` predicate** on either, unlike
  `tasks_app_sprint_sort_idx` and `meetings_starts_live_idx` — there is no `deleted_at`
  here, and liveness lives on `meetings`, which every reader joins through anyway.

### Why exactly these columns

**Two columns and nothing else.** The precedent is `meetingAttendees` (schema.ts): the
same many-to-many against `meetings`, a composite primary key, and only columns that a
person can actually see and change (`response`, `optional`). It carries no `createdAt`, no
`addedBy`. Everything this table would put in such columns already exists elsewhere:

- *Who linked this project and when* → `activity_log`. `setMeetingApp`
  (`src/features/meetings/actions.ts`) already writes
  `metadata: { appId: { from, to } }`; the multi-project successor writes
  `metadata: { appIds: { added, removed } }` in the same place.
- *Ordering* → there is deliberately **no** `sortOrder` and **no** `isPrimary`. Both would
  reintroduce a primary project through the back door. Display order is
  `ORDER BY apps.name` at every read site: deterministic, meaningful to a reader, and it
  does not repaint when a project is added.

**No `meeting_apps_history` sibling**, unlike `appRoleHistory` / `assignmentHistory` /
`meetingAttendeeHistory`. Those three exist because someone genuinely asks "who was PM on
12 June" or "how much was she allocated last quarter" — an *as-of* question over a
continuing state, and in `assignmentHistory`'s case a summed quantity a stale value would
corrupt. A meeting is a point event: nobody asks which projects a 45-minute standup
covered *as of* some earlier date. If that question ever appears, `activity_log` already
holds the change events with actor and timestamp.

### The soft-delete question — answered: **no `deletedAt` on this table**

Four independent reasons, each checkable:

1. **`src/db/live.test.ts` check 5** asserts *every* schema table with a `deletedAt`
   column is in `SOFT_TABLES`. A `deletedAt` here therefore forces a `liveMeetingApps`
   subquery + a `liveMeetingAppsAs()` alias into `src/db/live.ts`, a sixth `SOFT_TABLES`
   entry, and a filter that every future reader has to remember. That cost is paid forever
   for a row that has no content.
2. **There is nothing to retract.** Soft deletes exist here so a person can get back
   something they lost — a meeting's notes, a task's history. Unlinking a project loses
   nothing: the same control that unlinked it relinks it in one click, and the change is
   already in the trail.
3. **The meeting's own soft delete already covers it.** `meeting_apps` is a meeting child
   table in exactly the sense `src/db/live.ts` documents: live iff its meeting is live, no
   `deletedAt` of its own, guarded by joining `liveMeetings`. Trashing a meeting sets
   `meetings.deleted_at` and touches nothing else, so the project links survive untouched
   and **restore is automatic** — `restoreMeeting` clears `deletedAt` and the meeting comes
   back with all its projects. A `deletedAt` on the join rows would make restore a
   two-table operation and give a future maintainer a second thing to forget.
4. **`meetingAttendees` already answered the identical question** and answered it this
   way. `live.test.ts`'s own comment on the `updateMeeting` exemption states the rule:
   *"'removed from the meeting' has no soft state to be in — the row's absence IS the
   fact."* The same sentence is true of a project.

**Consequence that must be handled in the same commit:** unlinking is a hard
`db.delete(meetingApps)`, which trips **`live.test.ts` check 4**. Two edits are required:

- `MEETING_CHILD_TABLES` in `src/db/live.ts` gains `'meetingApps'`, **and** the separate
  hand-written regex `CHILD_TABLE_NAMES` in `live.test.ts` gains `meetingApps`. These two
  lists are independent strings and **no test asserts they agree** — updating only the
  first changes an error message and enforces nothing.
- `DELETE_ALLOWED_FUNCTIONS` in `live.test.ts` is typed `Readonly<Record<string, string>>`
  — **one allowed function per file** — and `src/features/meetings/actions.ts` has already
  spent its slot on `updateMeeting`. The type must widen to
  `string | readonly string[]` (and `check4MatchIndexes` must union the spans) so both
  `updateMeeting` and the new `setMeetingApps` can be named. Widening to a *file*
  allowlist instead would convert a real check back into convention — don't.

---

## 2. Every reader of `meetings.appId`, and what it becomes

Two grep families cover the whole surface. Column-level reads
(`liveMeetings.appId` / `meetings.appId`) and object-level reads (`meeting.appId`,
`existing.appId`, `row.appId`, `sourceMeeting.appId`, `ctx.meeting.appId`).

### 2.1 The type everything hangs off

`src/features/meetings/queries.ts` — `MeetingSummary` and `meetingColumns`.

```
appId: string | null
appName: string | null      →    apps: { id: string; name: string; slug: string }[]
appSlug: string | null           // ordered by name; [] is the app-less meeting
```

`meetingColumns` **loses the `leftJoin(apps, …)`** entirely. The app list is attached by a
second batched query keyed on the meeting ids, exactly the way `attachAttendees` already
handles the same row-multiplication problem in this file (its comment: joining "would
multiply each meeting row per attendee and complicate the ordering/pagination"). One
`inArray` query per page, never one per meeting.

### 2.2 Query sites

| Site | Today | Becomes |
|---|---|---|
| `meetings/queries.ts` `listMeetings` | `leftJoin(apps, eq(liveMeetings.appId, apps.id))` | no join; `attachApps(rows)` after `attachAttendees` |
| `meetings/queries.ts` `getMeetingsForApp(appId)` | `.where(eq(liveMeetings.appId, appId))` | `.innerJoin(meetingApps, eq(meetingApps.meetingId, liveMeetings.id)).where(eq(meetingApps.appId, appId))` — one row per meeting because the join is pinned to one app; then attach the **full** app list so the tab can show sibling projects |
| `meetings/queries.ts` `getMeetingById` (`cache()`-wrapped; the print route's source) | leftJoin | no join; attach |
| `meetings/queries.ts` `getUpcomingMeetingsForUser` | leftJoin | no join; attach. **Note: this function has no caller** — verified by grep, only its own definition and one comment reference it. Convert it or delete it; do not leave a third shape lying around |
| `apps/queries.ts` `listApps` meeting counts (`select appId, count(), thisWeek, max(createdAt) … where isNotNull(appId) groupBy(appId)`) | groups by the column | `from(meetingApps).innerJoin(liveMeetings, eq(meetingApps.meetingId, liveMeetings.id)).groupBy(meetingApps.appId)`. `isNotNull` disappears — a row only exists for a real project. A meeting on 3 projects now counts 1 toward each, which is the honest reading of `AppStats.meetings.total` |
| `apps/queries.ts` `getAppCounts` (`select count(), max(createdAt) … where eq(liveMeetings.appId, appId)`) | column filter | same innerJoin, `where eq(meetingApps.appId, appId)` |
| `apps/activity-queries.ts` `getAppActivity` meetings branch (`.where(eq(liveMeetings.appId, appId))`) | column filter | `.innerJoin(meetingApps, …).where(eq(meetingApps.appId, appId))`. **This is why the app's Activity tab needs no `activity_log` surgery** — it reads `liveMeetings` directly, not the trail |
| `sprints/suggest-actions.ts` (sprint-goal draft: `meetingAiNotes ⋈ liveMeetings where appId = …`, `limit(3)`) | column filter | same innerJoin on `meetingApps`. The `limit(3)` is safe because the join is pinned to one app, so a joint meeting cannot occupy the slot three times — keep `orderBy(desc(startsAt))` after the join |
| `people/queries.ts` `getPersonMeetings` (`leftJoin(apps, eq(liveMeetings.appId, apps.id))`; feeds the dashboard's `PersonMeetingsCard` and `/people/[id]`) | one `appName`/`appSlug` per row | drop `appName`/`appSlug` from the row selection; attach an app list per meeting id after `splitPersonMeetings`. `person-meetings-card.tsx` renders `entry.appSlug && entry.appName` as one link — becomes up to two links then `+N` |
| `admin/trash-queries.ts` ×3 (`listTrash` meetings, note-segments, screenshots — each `leftJoin(apps, eq(meetings.appId, apps.id))` on the **raw** table, allowlisted) | one `appName` per trashed row | join `meetingApps` and aggregate to a name list, or — enough for a trash card — one label built from the first app name + `+N`. Must still read the RAW `meetings` table; this file is on `live.test.ts`'s ALLOWLIST for exactly that reason |
| `app/api/meeting-keyframes/[...path]/route.ts` (`appId: meetings.appId` on a RAW read feeding `canReadMeetingIntel`) | single app | second read of `meeting_apps` for that meeting id (raw, no `liveMeetings` — the route is allowlisted precisely because an admin must preview a trashed keyframe), pass `appIds: string[]` |
| `meetings/search-providers.ts` | see §2.5 | see §2.5 |

### 2.3 Permission gates — the ones that must not be got wrong

| Site | Today | Becomes |
|---|---|---|
| `meetings/actions.ts` `canManageMeeting` | `managesApp(session.user.id, meeting.appId)` | `managesAnyApp(session.user.id, meeting.appIds)` |
| `meetings/ai-actions.ts` `canReadMeetingIntel` | `managesApp(user.id, meeting.appId)` | `managesAnyApp(...)` |
| `meetings/ai-actions.ts` `canManageMeeting` | `managesApp(session.user.id, meeting.appId)` | `managesAnyApp(...)` |

`managesAnyApp` is a **new export in the existing `src/features/apps/project-manager.ts`**,
one query with `inArray(assignments.appId, appIds)`, still deciding with
`isProjectManagerRole` from `src/lib/project-roles.ts`. That keeps ONE definition of
"manager". Never write a private role check; never widen it to leads (project-manager.ts's
comment: leads/architects stay reviewers, deliberately not here).

**ANY-of, not all-of.** This is not a new opinion — `src/features/auth/capabilities.ts`
already ships it. `Resource` has both `appId` and `appIds`, and its comment reads: *"a
resource may belong to more than one project — a meeting spanning several projects is the
live case… being PM of one of the projects a meeting serves is enough to manage that
meeting, and requiring all of them would mean a joint meeting could only be managed by
someone who runs every project in it."* `can()` implements it:
`resource?.appIds?.some((id) => actor.scopeAppIds.has(id))`.

So **capabilities.ts needs no change at all.** Meeting gates simply pass `appIds` where
they move to `can()`. Note `meeting.manage`, `meeting.intel.view`, `meeting.delete` and
`followup.delete` are all `scoped` for `manager`, and `meeting.admin` is deliberately
`own`-only with no `scoped` arm anywhere in its row — do not add one.

`[unverified]` — no meeting call site imports `can()` / `requireCapability` today (grep:
only `admin/trash-actions.ts`, `sprints/*`, `admin/actions.ts`, `notion/actions.ts`,
`people/actions.ts`, `apps/actions.ts`, `worklog/absence-actions.ts` do). The meeting gates
are still `managesApp`-based, so the migration to `can()` is separate work; this plan only
requires that whichever path is live receives `appIds`, not `appId`.

### 2.4 Write sites

| Site | Today | Becomes |
|---|---|---|
| `meetings/actions.ts` `meetingFields` (zod, shared by create + update so the two can never drift) | `appId: z.uuid().nullable()` | `appIds: z.array(z.uuid())` — `[]` is legal and means "no project". Dedup with `new Set` before writing, exactly as `attendeeIds` already does, or the composite PK rejects the whole batch |
| `meetings/actions.ts` `createMeeting` | inserts `appId` inside the `db.batch` | one extra statement in the **same** `db.batch`, skipped when the list is empty (`db.batch` takes a non-empty tuple, and the meeting insert is always first). neon-http has no transactions — the batch is what keeps the rows from landing apart |
| `meetings/actions.ts` `updateMeeting` | `set({ appId, … })` | reconcile `added`/`removed` against the current rows — the attendee pattern already in this function — with both writes spread into the existing `db.batch` |
| `meetings/actions.ts` `setMeetingApp(meetingId, appId)` | one-field write, no-op guard, activity row, revalidate both apps | **`setMeetingApps(meetingId, appIds)`**. Keep the no-op guard (set equality, not string equality) — without it the trail fills with rows recording nothing. Keep "nothing else is touched": no calendar sync (the project is not part of the Google event), no notifications. The `db.delete(meetingApps)` for `removed` lives **inside this function** (§1's `DELETE_ALLOWED_FUNCTIONS` note) |
| `meetings/actions.ts` `revalidateMeetingPaths(appId)` | one `slugForApp` query, then `/apps/<slug>`, `/meetings`, `/`, `revalidateAdmin()` | takes `appIds: string[]`, resolves **all** slugs in one `inArray` query (not N round trips), revalidates each. Callers that pass old-and-new (`updateMeeting`, `setMeetingApps`) pass the **union** |
| `admin/trash-actions.ts` `restoreMeeting` / `purgeMeeting` (`.returning({ …, appId: meetings.appId })` → `revalidateMeetingTrashPaths(row.appId)`) | reads the column off the returning row | must read `meeting_apps` **before** the purge — a purge cascades those rows away, so a read after it returns nothing and no project page ever revalidates. Restore may read either side |

### 2.5 `src/features/meetings/search-providers.ts` — the LIMIT bug

Today: `leftJoin(apps, eq(liveMeetings.appId, apps.id))` … `.limit(PALETTE_RESULT_LIMIT)`.
`PALETTE_RESULT_LIMIT` is **6** (`src/features/search/registry/limits.ts`).

The naive port keeps the `leftJoin` and points it at `meetingApps`. That is a defect with
two heads:

1. A meeting on 4 projects becomes **4 identical rows** — same id, same title, four
   different `appName`s. The palette renders four "Sprint sync" entries.
2. Postgres applies `LIMIT` to the **joined** rows. Those 4 duplicates consume 4 of the 6
   slots, so three genuinely different meetings that match the query never reach the user.
   The palette gets *worse* the more joint meetings exist — the exact opposite of what this
   feature is for.

**Fix: aggregate. Two queries, LIMIT on the meetings alone.**

```ts
const rows = await db
  .select({ id: liveMeetings.id, title: liveMeetings.title, startsAt: liveMeetings.startsAt })
  .from(liveMeetings)
  .where(or(ilike(liveMeetings.title, pattern), ilike(liveMeetings.agenda, pattern)))
  .orderBy(desc(liveMeetings.startsAt))
  .limit(PALETTE_RESULT_LIMIT)          // 6 meetings, always

if (rows.length === 0) return []

const appRows = await db
  .select({ meetingId: meetingApps.meetingId, name: apps.name })
  .from(meetingApps)
  .innerJoin(apps, eq(meetingApps.appId, apps.id))
  .where(inArray(meetingApps.meetingId, rows.map((r) => r.id)))
  .orderBy(asc(apps.name))              // stable subtitle across renders
```

A second round trip rather than a correlated aggregate: it is the pattern already used in
`meetings/queries.ts` (`attachAttendees`), it keeps the SQL readable, and providers already
run in one `Promise.all` (`registry/providers.ts` `runProviders`), so the latency is not
serialised against the other four providers.

**Subtitle rule (agreed): up to two project names, then `+N`.**

```ts
const names = byMeeting.get(m.id) ?? []
const subtitle =
  names.length === 0 ? format(m.startsAt, 'MMM d')          // unchanged app-less behaviour
  : names.length <= 2 ? names.join(' · ')
  : `${names[0]} · ${names[1]} +${names.length - 2}`
```

The date fallback stays exactly as it is — the file's comment already explains why ("a date
is the next most useful thing to tell apart two meetings called 'Weekly sync' when neither
belongs to an app"), and that sentence remains true.

The file's header comment currently says *"The join to `apps` is a LEFT join because
meetings.appId is nullable"*. That stops being true and must be rewritten in the same edit,
not left behind.

`src/features/search/registry/providers.ts` needs **no change** — it imports
`@/features/meetings/search-providers`, which is not inside `src/features/search/**`. No new
⌘K registration is needed either: `meetings/` already has both a `commands.ts` and a
`search-providers.ts`, so `registry.test.ts` stays green.

### 2.6 UI sites

| Site | Today | Becomes |
|---|---|---|
| `components/meeting-form.tsx` — `FormState.appId: string`, `NO_APP` sentinel, one `<Select>` with a `SelectValue` label mapper, `handleAppChange`, `emptyState(defaultAppId)`, `editing.appId ?? ''` | one project | multi-select over the same `apps` prop, built from existing `src/components/ui/` primitives; **no new colour or token**. `NO_APP` disappears — "no project" is an empty selection with an explicit empty-state line, not a sentinel item |
| `meeting-form.tsx` `prefillTeam(appId)` + `applyTeamPrefill` (`attendee-prefill.ts`) | one `teamForApp` call; the previous app's team is withdrawn the moment the app changes | one call per **added** project; the prefilled set becomes the union of the selected projects' teams. `applyTeamPrefill`'s swap-with-provenance contract is unchanged and must stay: manual picks survive, only prefilled ids are swapped. `pendingTeamAppId` becomes a set, or the "loading the team" line lies while a second fetch is still running |
| `meeting-form.tsx` `withAutoTitle` → `autoMeetingTitle({ appName, startsAt })` | one name | suggest **only while exactly one project is selected**. With 2+, leave the title alone: `meetingFields.title` is `max(120)` and concatenating names overflows it. `isAutoMeetingTitle` still protects a human-typed title either way |
| `components/meeting-project-select.tsx` (`MeetingProjectSelect` → `setMeetingApp`) | single Select, optimistic value with restore-on-failure, `aria-live` "Saving…" | multi-select calling `setMeetingApps`. Keep the optimistic value and the live region — they are the only feedback this control has. Toast copy must change: "Filed under X" / "no longer filed under an app" cannot describe a set |
| `components/meeting-detail-dialog.tsx` — one `<Badge>` linking `/apps/{appSlug}`, else a plain badge, else the `No app` outline badge when `canRefile` is false | one badge | one badge per project (a dialog has room for all of them). The `No app` badge stays for the empty case, still suppressed when the picker below says the same thing |
| `components/meeting-list.tsx` — `showAppBadge && meeting.appName`; **`showAppBadge={false}` on the app page's Meetings tab** (`app/(app)/apps/[slug]/page.tsx`) | one badge, hidden entirely on the app page | the prop's meaning must change from *hide the badge* to *hide **this** project's badge*. See risk **R2** — left as-is, a joint meeting reads as if it belonged only to the project whose page you are on |
| `components/meeting-list.tsx` `editing={{ appId: meeting.appId, … }}` and `appId={meeting.appId}` → `MeetingIntelPanel` | scalar | `appIds` |
| `components/meetings-time-grid.tsx` — `meeting.appName` in the visible chip footer and in two `sr-only` label arrays | one name | first name + `+N` visibly (the block already fits only two lines — its comment says a third gets sliced through the glyphs); **all** names in the `sr-only` string, where there is no width limit |
| `components/meetings-month-calendar.tsx` `chipLabel` | `meeting.appName` in the a11y label | all names, joined |
| `components/meeting-notes.tsx`, `note-timeline.tsx`, `meeting-intel.tsx`, `action-item-board.tsx` — each takes `appId: string \| null` and passes it down; `action-item-board` disables "Add task" on `!appId && !suggestion.suggestedAppId` | scalar prop | `appIds: string[]`; the disable predicate becomes `appIds.length === 0 && !suggestion.suggestedAppId`, and the `title` hint ("Link this meeting to an app first") stays literally true |
| `app/print/meetings/[id]/page.tsx` — `editBase.appId` (the masthead editor re-submits the whole meeting through `updateMeeting`), the running-foot `· {appName}`, the fact-box `Project` row | scalar | `appIds`; the 7.5pt running foot shows first + `+N` (it truncates); the fact-box `Project` row lists all names — it is the row a reader uses to place the document. Sinhala shaping stays browser-render-only (SKILL.md) |
| `app/print/meetings/[id]/print-masthead-edit.tsx` `MeetingEditBase.appId` | scalar | `appIds` |
| `features/meetings/event-color.ts` `meetingColorKey` — `return meeting.appId ?? null` | scalar fallback | `[...appIds].sort().join('\|')` when non-empty, else `null`. Sorted, exactly like the attendee branch above it, so storage order can never give one meeting two colours. **Do not** use "the first app" — the chip would recolour when a project is added or renamed. `eventColorSlot` / `eventDotClasses` / `eventSolidClasses` are unchanged; a per-project dot reuses `eventDotClasses(appId)`, the ONE 8-slot system. No second hash, no new token |

### 2.7 AI / intel sites (`src/features/meetings/ai-actions.ts`)

| Site | Today | Becomes |
|---|---|---|
| `insertAutoNotesAndSuggestions` — `hasApp: (resolvedAppId ?? meeting.appId) !== null` and `targetAppId = (resolvedAppId ?? meeting.appId)` | falls back to the meeting's one app | fall back **only when the meeting has exactly one project**. With 2+ and no confident route, `hasApp` is `false` → `shouldAutoAssign` returns false (`notes.ts`) → the item becomes a manual card a human files. The existing mechanism doing the right thing with **no new code**, and it is honest: nothing guesses a project |
| `acceptTaskSuggestion` — `targetAppId = suggestion.suggestedAppId ?? meeting.appId` | same fallback | same rule; with 2+ and no `suggestedAppId`, the accept path must ask which project rather than pick one |
| `assignSpeaker` → `planSpeakerAssignment({ appId: meeting.appId, assignedAppIds })` in `notes.ts`, plus the `needsAssignment && meeting.appId !== null` branch, the `apps.name` lookup, and the `assignments` + `assignmentHistory` inserts | writes a real allocation against the meeting's one app | only offer the assignment when the meeting has **exactly one** project. With 2+, still make the two unambiguous claims — the `meeting_speakers` label mapping and the `meeting_attendee_history` row — and tell the admin which project to allocate on. Silently allocating someone to a project nobody named is a data-integrity bug, not a UX nit |
| `fetchAttendeeAppLists` / `unionAppOptions` / `attendeeAppsPromptBlock` | derived from **attendees'** assignments and open tasks — never from `meeting.appId` | unchanged. Optionally add the meeting's own projects to the routing vocabulary so a project on the invite but on nobody's assignment list is still routable |
| `logActivity` calls carrying `appId: meeting.appId` / `sourceMeeting.appId` / `ctx.meeting.appId` (`ai-actions.ts` ×10, `actions.ts` ×6, `followup-move-actions.ts` ×4, `text-replace-actions.ts` ×1) | one project per row | see §2.8 |
| `getMeetingPrep` | **already ignores `meeting.appId` entirely** — it derives each attendee's apps from `assignments` + task-discovery | see risk **R4**: it now needs the meeting's project set to narrow against, or a joint meeting's prep shows projects that are not on the agenda |

### 2.8 `activity_log` — decision

`activityLog.appId` is a **plain nullable uuid with no foreign key**, denormalised on
purpose ("for grouping a feed by product after the product is gone"). It is read by
`activity/filters.ts` (`/activity`'s app filter), `activity/queries.ts` (the feed's app chip
and the filter's app list), and `apps/contribution-queries.ts` (a `count()` of rows per
actor per app).

**Decision: keep exactly one activity row per mutation. Set `appId`/`appName` to the single
project when the meeting has exactly one, and to `null` otherwise, with the full set in
`metadata.appIds`.**

Rejected alternative — one row per project — because `getAppContributions` does `count()`
of `activity_log` rows grouped by actor. Three rows for one action would report a person as
having done three things. That is a **wrong number**; a null is a **missing** one, and this
repo's rule is that a wrong statement on screen is a defect. One-row-per-mutation is also
what the table's own comment promises ("Append-only trail of every mutation… the complete
backtrack").

Stated consequences, not hidden:

- A multi-project meeting will not appear under `/activity`'s app filter. Fix if wanted:
  `or(eq(activityLog.appId, id), and(eq(entityType,'meeting'), inArray(entityId, <meeting ids for app>)))`
  in `activity/filters.ts`.
- Multi-project meeting actions stop counting toward `getAppContributions`. Same shape of
  fix, or accept it and say so where the number is rendered.
- The app page's **Activity tab is unaffected** — `apps/activity-queries.ts` reads
  `liveMeetings` directly, not the trail, and gets its `meetingApps` innerJoin in §2.2.

### 2.9 Not affected — verified, so nobody "fixes" them

- `src/features/meetings/ics.ts`, `src/features/calendar/google-calendar.ts`,
  `src/features/meetings/share.ts`, `src/features/meetings/commands.ts` — **zero**
  occurrences of `appId`/`appName`. The invite surfaces do not know about projects and
  should not learn.
- `src/features/auth/capabilities.ts` — already multi-project (`Resource.appIds`).
- `event-color.ts`'s hue functions — unchanged; only `meetingColorKey`'s fallback moves.
- `fetchCarriedFollowups` — carries an item to whatever meeting its person attends next,
  with **no app filter at all** today. Unchanged by this work (see §4.2(b)).

---

## 3. Backfill, the app-less meeting, and the fate of `meetings.appId`

### Backfill

```sql
INSERT INTO "meeting_apps" ("meeting_id","app_id")
SELECT "id","app_id" FROM "meetings" WHERE "app_id" IS NOT NULL
ON CONFLICT DO NOTHING;
```

- **No `deleted_at IS NULL` filter.** Soft-deleted meetings are backfilled too,
  deliberately: a trashed meeting must restore with its project intact, and
  `admin/trash-queries.ts` renders the project name on the trash card.
- `ON CONFLICT DO NOTHING` makes the statement re-runnable. This repo hand-applies SQL and
  has re-run statements; a second run must be a no-op, not a `23505`.
- No referential repair is needed: `meetings.app_id` already
  `REFERENCES apps(id) ON DELETE SET NULL`, so every non-null value points at a live app.
- **Verify with `information_schema`, never the runner's exit code** (SKILL.md —
  `npm run db:migrate` has reported success while applying nothing):
  ```sql
  SELECT to_regclass('public.meeting_apps');                 -- must not be null
  SELECT count(*) FROM meetings WHERE app_id IS NOT NULL;    -- must equal the next line
  SELECT count(*) FROM meeting_apps;
  SELECT count(*) FROM meeting_apps ma
    LEFT JOIN meetings m ON m.id = ma.meeting_id AND m.app_id = ma.app_id
   WHERE m.id IS NULL;                                       -- must be 0
  ```
- Journal entry hand-written into `drizzle/meta/_journal.json`, `when` strictly increasing
  past `0039`'s `1787155500000`. **Never edit an applied `.sql`** afterwards — not even a
  comment; `db:status` compares `sha256(file)` to the ledger and an edited file reads
  "never applied" forever.

### A meeting with no project stays valid

Zero rows in `meeting_apps`. There is no "at least one" constraint and there cannot be one
in SQL — which is correct, because a company all-hands belongs to nobody. **"No project" is
`COUNT(*) = 0`**, occupying exactly the place `appId IS NULL` occupies today. Every reader
must render the same neutral state it renders now for null:

- `meeting-detail-dialog.tsx`: the `No app` outline badge (still suppressed when the refile
  picker below says the same thing).
- `search-providers.ts`: the `format(startsAt, 'MMM d')` subtitle fallback.
- `event-color.ts`: a `null` colour key → the neutral chip, never a default hue. The file's
  reasoning holds unchanged: *"A colour meaning 'no product' would read as just another
  product."*
- `meeting-list.tsx` and the calendar chips: no badge, no name.
- `shouldAutoAssign`: `hasApp: false` → manual card.

### `meetings.appId`: **dropped — in two steps**

**Rejected: keeping it as a deprecated read.** Against the reader list in §2, a
still-readable column that nobody writes produces false statements, not merely stale ones:

- `canManageMeeting` / `canReadMeetingIntel` would gate on the stale scalar. A PM of the
  project listed *second* on a joint meeting would be **locked out of their own project's
  meeting** — a permission bug, not cosmetics.
- The app page's badge, the print masthead's `Project` row, the palette subtitle and the
  calendar chip would each keep naming one project for a meeting that serves three.
- `logActivity` would keep attributing every follow-up and note edit to one project.

Also rejected: keeping it as a maintained "first project" mirror — that is a primary project
under another name, and the decision forbids one.

**The two steps, and why not one:**

1. **0040** creates `meeting_apps`, indexes it, and backfills. It does **not** touch
   `meetings.app_id`. In the same code wave, `appId` is deleted from the `meetings` object
   in `src/db/schema.ts` and every reader in §2 is rewritten. Removing the field from the
   drizzle definition while the physical column still exists is safe in both directions:
   drizzle only emits columns it knows about, and `app_id` is nullable with no default, so
   inserts that omit it succeed. This is what makes the rewrite **enforced by the compiler**
   rather than by discipline — every object-level read becomes a type error somebody has to
   deal with.
2. **A later migration**, claiming whatever number is free at the time, issues
   `ALTER TABLE "meetings" DROP COLUMN "app_id";` — run only after `information_schema`
   confirms 0040 landed **in production** and the new readers have been serving there.

Doing the drop inside 0040 inverts the safe expand/contract order: if the migration lands
before the deploy, any still-running code selecting `app_id` errors immediately. SKILL.md is
explicit that "dev DB proves nothing about prod" and that prod/preview were never verified,
so the plan must not depend on migration and deploy being simultaneous.

**Ownership note:** `src/db/schema.ts` and `drizzle/**` belong to `logpup-fa`. Both step-1
edits land in their files. Claim them explicitly before writing, and re-check the next free
migration number against **every** worktree's `_journal.json` (`../LogPup-mobile`,
`../LogPup-sdd-a`, `../LogPup-sdd-d`, and `.claude/worktrees/*`) — numbers have collided
three ways in this repo before.

---

## 4. Who should attend

Everything below is a **suggestion list**. `createMeeting` / `updateMeeting` write
`meeting_attendees` only from the `attendeeIds` a human submitted, and that must not change:
an auto-invited person is a claim the product cannot stand behind.

### 4.1 The projects' PM and lead

**Source: `apps.pmId` and `apps.leadId`** — not `assignments`, not `managesApp`.

```sql
SELECT a.id AS app_id, a.name, a.slug, a.pm_id, a.lead_id
  FROM apps a
 WHERE a.id IN (:appIds);
```

Why these columns: `schema.ts`'s comment on `app_role_history` says it outright — *"apps.pmId
/ apps.leadId stay THE live state, untouched"*. `pmId` is `NOT NULL` (migration 0033 added it
nullable, backfilled from `lead_id`, then locked it), so **every project has exactly one PM**.
`leadId` is nullable, so a project may have no lead, and the UI must **say so** rather than
render a blank row.

Use `app_role_history` **only** when the meeting is in the past and the question is "who held
it then":

```sql
SELECT app_id, user_id, role
  FROM app_role_history
 WHERE app_id IN (:appIds)
   AND role IN ('pm','lead')
   AND effective_from <= :at
   AND (effective_to IS NULL OR effective_to > :at);
```

`app_role_history_one_open_idx` (unique on `(app_id, role) WHERE effective_to IS NULL`)
guarantees at most one open row per role per project, so no dedup is needed — this is the same
shape `loadActor` uses in `src/features/auth/actor.ts`. Rows written by migration 0034 carry
`note = BACKFILLED_APP_ROLE_NOTE` (`'backfilled at migration'`,
`features/apps/role-history.ts`); `isBackfilled(note)` exists so a surface can say "assumed at
migration" rather than "observed". For a *current* attendance suggestion the interval does not
matter, which is the second reason to prefer `apps.pmId`/`leadId`.

**`managesApp` is not the attendance source.** It regex-matches free text in
`assignments.role`; `capabilities.ts` says so explicitly — *"Scope decided by whatever somebody
typed into an assignment is not auditable."* `managesApp` decides **permission**;
`apps.pmId`/`leadId` decide **who runs the project**. They can disagree — see risk R6.

### 4.2 Anyone holding an open item that belongs on the agenda

Four queries, all over data that exists today.

**(a) Open tasks on these projects**

```sql
SELECT t.assignee_id, t.app_id, count(*) AS open_count
  FROM tasks t
 WHERE t.deleted_at IS NULL              -- i.e. read through liveTasks
   AND t.app_id IN (:appIds)
   AND t.status <> 'done'
   AND t.assignee_id IS NOT NULL
 GROUP BY t.assignee_id, t.app_id;
```

**(b) Open follow-ups they owe from earlier meetings**

`fetchCarriedFollowups` in `ai-actions.ts`, unchanged in shape:
`meeting_followups ⋈ liveMeetings ON source_meeting_id`, `status = 'open'`,
`user_id IS NOT NULL`, and either `target_meeting_id = :meetingId` (pinned) or
(`target_meeting_id IS NULL` AND `source_meeting_id <> :meetingId` AND
`source.starts_at < :startsAt`) (carried). The `innerJoin` to `liveMeetings` is what makes a
trashed source meeting's items disappear from every future meeting's prep.

For the *attendance suggestion only*, narrow to items whose source meeting shares a project
with this one, by joining `meeting_apps` on the source meeting id. Do **not** narrow
`fetchCarriedFollowups` itself — carry-forward is deliberately project-agnostic today ("any
earlier meeting's still-open item follows its person to whatever meeting they attend next"),
and quietly changing that would drop items people are relying on.

**(c) Check-in disagreement on a running sprint of these projects**

```sql
-- the same "running now" predicate getActiveSprints and getMeetingPrep use
SELECT s.id, s.name, s.app_id
  FROM sprints s
 WHERE s.deleted_at IS NULL
   AND s.app_id IN (:appIds)
   AND (s.status = 'active'
        OR (s.status = 'planned' AND s.start_date <= :todayIso AND s.end_date >= :todayIso));
```

then `getCheckinsForSprints(sprintIds)` (`sprints/checkin-queries.ts` — the documented ONE
grouped query, never one per person) plus that sprint's tasks. The person belongs on the
invite when `checkinGap(reported, computeTaskProgress(tasks, userId))` is `'ahead'` or
`'behind'`. Exact rule in §5.

**(d) Blocked or unassigned sprint work**

```sql
SELECT t.id, t.title, t.sprint_id, t.app_id
  FROM tasks t
 WHERE t.deleted_at IS NULL
   AND t.sprint_id IN (:runningSprintIds)
   AND t.assignee_id IS NULL
   AND t.status <> 'done';
```

Addressed to the project's **PM** (`apps.pmId`), not to an individual — nobody owns it yet,
which is exactly the point.

**Truth-rule note on "blocked":** `taskStatus` is
`pgEnum('task_status', ['todo','in_progress','done'])`. **There is no blocked state in this
schema.** Do not invent one, do not derive one from a title keyword, and do not put the word
"blocked" on screen. The two things the data can honestly say are *unassigned* (above) and
*overdue and still in progress* (`status = 'in_progress' AND due_date < today`). Anything more
needs a schema change, which this wave does not have.

### 4.3 What must not be claimed

`src/features/meetings/attendee-score.ts` and the `meeting_attendee_recommendations` table
exist and are fully written, **but the scorer has no non-test caller** — verified by grep. No
plan sentence and no UI string may say the recommender decides who attends. Risk R7 covers
what it would need first.

---

## 5. What to ask, per person per project

Every line is **derived at read time from a live row**. Nothing is stored. That single
constraint is what makes the disappearance rules below automatic rather than a cleanup job
somebody has to remember.

| Line | Query | Disappears when |
|---|---|---|
| **"N tasks past due on `<project>`"** | `liveTasks` where `appId = P`, `assigneeId = U`, `status <> 'done'`, `dueDate IS NOT NULL`, `dueDate < today` — `today` from `toIsoDateInTimeZone(new Date())` (Asia/Colombo, `src/lib/lk-holidays.ts`), never a UTC slice. Same predicate as `getAppCounts`' `overdue` and `notes.ts`'s `isOverdue` (due *today* is not overdue) | the task moves to `done`, its `dueDate` moves out, it is reassigned, or it is soft-deleted (`liveTasks` stops returning it). No cached copy exists to go stale |
| **"Follow-up owed from `<earlier meeting>`"** | `fetchCarriedFollowups(meeting, caller)` exactly as it is — `status = 'open'`, `userId = U`, pinned-or-carried, `innerJoin liveMeetings` | `status` flips to `'resolved'` (`resolveFollowup`), **or** the linked task moves to done — `resolvedByTaskId` + `decideFollowupResolutionOnTaskStatusChange` (`followups.ts`) is wired into `updateTask` / `moveTaskOnBoard`, and moving the task back out reopens the follow-up — **or** the source meeting is trashed (the `innerJoin` drops it). Note `responseNote` deliberately does **not** close it: *"she said the client hasn't replied yet" is an update, not an answer* (schema.ts) |
| **"Said X%, board says Y%"** (`ahead` / `behind`) | `sprintCheckins` for the running sprints of `P`, plus `computeTaskProgress(sprintTasks, U)`; verdict from `checkinGap(reported, computed)` with `CHECKIN_GAP_THRESHOLD = 15` and a strict `>` (`src/features/sprints/checkins.ts`) | recomputed on every read. The `sprint_checkins` schema comment says it: the computed side is *"derived at read time, never persisted next to it, so the gap… can't quietly compare a fresh report against a stale snapshot of the board."* The line drops to `'none'` the moment the board catches up or they re-check-in, and `deleteSprintCheckin` removes the row outright. `'unknown'` (no tasks to compare) must be said **in words**, never rendered identically to `'none'` |
| **"At risk: `<reason>`"** on a project they lead | `appHealth(input, today)` from `src/features/apps/app-health.ts` — **import `health.reasons` and render verbatim**; never restate, never re-word, never re-derive. `listApps()` already computes it per app; for a chosen set, feed the same inputs (`status`, task counts, `pickCurrentSprint`, `sprintCount`, `memberCount`, `leadId`, `lastActivityOn` via `toIsoDateInTimeZone(…, LK_TIMEZONE)`). Show only where `apps.leadId = U` or `apps.pmId = U` | `appHealth` is pure and re-run per request; there is no stored health row. A reason vanishes when its input does — the overrun sprint closes, `tasks.overdue` drops, activity lands inside `STALE_ACTIVITY_DAYS`. An archived project returns `level: 'dormant', reasons: []`, so it contributes nothing |
| **"M unassigned tasks in `<sprint>`"** (to the PM) | §4.2(d) | someone is assigned, the task is done, or it is soft-deleted |
| **"K tasks overdue and still in progress"** (the honest stand-in for "blocked") | `liveTasks`, `sprintId ∈ running sprints of P`, `status = 'in_progress'`, `dueDate < today` | same as the overdue rule above |

### The rule that keeps the list from going stale

**Nothing on this list may be persisted.** Concretely, and enforceably:

- **No `meeting_agenda_items` table.** A stored ask survives its item closing.
- **Never write the list into `meetings.agenda`.** That column is human prose the organiser
  typed; a generated snapshot in it is stale the instant a task is ticked, and no mechanism
  exists that could ever clear it.
- The panel is produced by a server action re-run per open — the contract `getMeetingPrep`
  already has ("an inline check-in only needs THIS refetched"), behind the same
  `canReadMeetingIntel` gate, because these rows lay out named people's workloads across
  projects.
- The **print route** (`/print/meetings/[id]`) re-derives at request time. It already calls
  `getMeetingById` per request, so it is on the same footing; a PDF is a snapshot of a moment,
  and the export stamp (`Exported <timestamp>`) already tells the reader that.
- Bilingual: Sinhala + English code-switching is normal — never force-translate.
  `bilingualText` / `bilingualLead` exist for leading-Sinhala lines. Person, project and
  sprint names are **data**, not copy, and are never translated.

---

## 6. Risks

**R1 — the palette LIMIT.** A `leftJoin` to `meeting_apps` duplicates a meeting once per
project and the duplicates are counted by `.limit(6)`, so one 4-project meeting hides three
other results. *Prevented by* the two-query aggregate in §2.5, plus a test that a query
matching one 4-project meeting and five others returns six **distinct** meeting ids.

**R2 — the app page's Meetings tab lies by omission.** `app/(app)/apps/[slug]/page.tsx`
passes `showAppBadge={false}` because "you are already in this project". Unchanged, a meeting
that also serves two other projects renders as if it belonged to this one alone. *Prevented
by* redefining the prop to *hide this project's chip, show the rest*, and by an assertion that
the tab renders the sibling names.

**R3 — a kept-but-deprecated `meetings.appId`.** The permission gates read it, so a PM of the
second-listed project is locked out of their own project's meeting; four display surfaces name
one project for a meeting that serves three. *Prevented by* removing the field from the drizzle
definition in the same wave (every read becomes a compile error) and dropping the physical
column only after prod is verified.

**R4 — `getMeetingPrep` is project-blind.** It derives each attendee's apps from `assignments`
+ task-discovery and **never reads `meeting.appId`**. On a joint meeting an attendee assigned
to a fourth, unrelated project still shows that project's open/overdue counts, which reads as
"this project is on the agenda". *Prevented by* intersecting `AttendeeAppPrep.apps` with the
meeting's project set when the meeting has ≥1 project, keeping today's union when it has none
— **and by updating `assembleMeetingPrep`'s doc comment**, which currently describes the union
as the rule and would otherwise become a false comment.

**R5 — the calendar chip recolours on edit.** If `meetingColorKey`'s fallback becomes "the
first app", adding or renaming a project repaints the block. *Prevented by*
`[...appIds].sort().join('|')` — the same sorted-ids trick the attendee branch already uses,
with the reasoning already written in that file.

**R6 — PM-by-role and PM-by-column disagree.** `apps.pmId` (who runs the project) and
`managesApp` (free-text `assignments.role` regex) are different facts and can name different
people. *Prevented by* using each for exactly one job — `apps.pmId`/`leadId` for the attendance
suggestion, `managesAnyApp` / `can(…, { appIds })` for permission — and never letting a UI
string say "you can edit this because you are the PM" unless it asked the permission path.

**R7 — the unwired recommender.** `attendee-score.ts` takes a single `appId`, `appIdInferred`,
`appName` and one app's `techTags`, and its rule **R8** caps everyone at optional when `appId`
is null. Wiring it to a multi-project meeting would either silently score against one project
or refuse to mark anyone required. `sameSeries` (`attendee-series.ts`) also compares scalar
`appId`s, so series inference silently stops matching once meetings carry sets. *Prevented by*
not wiring it this wave, and — when it is wired — by making `AttendeeScoreContext` take
`appIds` (with its R8 keyed off "empty set") and `sameSeries` compare sorted id sets.

**R8 — migration number collision.** 0040 is free in main's `_journal.json` (0039 is the last,
`when: 1787155500000`), but `logpup-fa` owns `drizzle/**` and is doing absences/RBAC, and three
sibling worktrees carry their own journals. *Prevented by* re-checking every `_journal.json` at
write time and confirming with `logpup-fa` before claiming the number; `when` strictly
increasing; never editing an applied `.sql`.

**R9 — the soft-delete guard silently does nothing.** `MEETING_CHILD_TABLES` (`live.ts`) is
used **only in an error message**; the real enforcement is the hand-written
`CHILD_TABLE_NAMES` regex string in `live.test.ts`, and **no test asserts the two agree**.
Adding `meetingApps` to one and not the other leaves the new table unguarded while looking
guarded. *Prevented by* editing both in the same commit — and, better, by adding the missing
assertion that the regex covers every name in the const.

**R10 — CI goes red on the unlink.** `DELETE_ALLOWED_FUNCTIONS` allows **one function per
file** and `meetings/actions.ts` has already spent its slot on `updateMeeting`. *Prevented by*
widening the value type to `string | readonly string[]` (and unioning the spans in
`check4MatchIndexes`) in the same commit, with a `// why` comment. Never quiet it with a
file-level ALLOWLIST entry.

**R11 — silent data loss on restore-from-backup.** `src/features/admin/backup.ts`
`buildSnapshot()` exports `meetings` and `meetingAttendees` but would not export
`meeting_apps`. A restore would bring every meeting back with its projects erased, and **no
test covers this**. *Prevented by* adding `meetingApps` to `buildSnapshot` in the same wave.

**R12 — trash purge revalidates nothing.** `purgeMeeting` reads
`.returning({ appId: meetings.appId })` **after** the delete. Read from `meeting_apps` and the
purge cascades those rows away first, so no `/apps/<slug>` is ever revalidated and the project
page keeps showing a purged meeting until something else invalidates it. *Prevented by* reading
the project ids **before** the delete statement.

**R13 — revalidation N+1.** `revalidateMeetingPaths` costs one `slugForApp` query today; the
naive port costs one per project, on a path already doing a Google call. *Prevented by* one
`inArray` slug lookup, and by passing the **union** of removed and added projects from
`updateMeeting` and `setMeetingApps` — the project a meeting **left** needs re-rendering as
much as the one it joined, which is exactly what those two functions already do for the
single-app case.

**R14 — the auto-title overflows or invents.** `autoMeetingTitle` takes one name and
`meetingFields.title` is `max(120)`. *Prevented by* suggesting only while exactly one project
is selected; `isAutoMeetingTitle` continues to protect a human-typed title.

**R15 — speaker attribution guesses a project.** `planSpeakerAssignment` writes a real
`assignments` row (and its history interval) against `meeting.appId`. With N projects there is
no defensible choice. *Prevented by* offering the assignment only at exactly one project, and
otherwise doing just the label mapping and the attendance row — the two claims that are
unambiguous.

**R16 — auto-assign files a task into the wrong project.** `resolvedAppId ?? meeting.appId`
has no safe answer at N. *Prevented by* falling back only at exactly one project; at 2+ with no
confident route `hasApp` is false, `shouldAutoAssign` returns false, and the item becomes a
manual card. No new code — but the card's existing hint ("Link this meeting to an app first")
must be reworded so it stays literally true.

**R17 — a stale ask-list.** Any persistence of the derived lines — a table, a snapshot into
`meetings.agenda`, a cached server-action result — re-creates the exact failure this feature
exists to remove. *Prevented by* the hard constraint in §5: nothing is stored, every line is
re-derived per read, and the print route re-derives at request time.

**R18 — parallel-session collisions.** This work touches `src/db/schema.ts` and `drizzle/**`
(**`logpup-fa`**). It does **not** touch `src/features/gemini/**`, `worklog-form.tsx` or
`(app)/worklog/page.tsx` (**`logpup-ce`**), and it does **not** touch `src/features/search/**`
(**`logpup-49`**) — `search-providers.ts` lives under `src/features/meetings/`, and
`registry/providers.ts` needs no edit. *Prevented by* claiming the schema/drizzle files
explicitly, re-reading every file immediately before editing, and never running `git stash` /
`git add -A` / `git commit` / `git reset` / `git checkout -- .`.

**R19 — a new colour sneaks in.** Per-project chips must reuse `eventDotClasses(appId)` from
`src/features/meetings/event-color.ts` — the ONE 8-slot system with literal Tailwind classes.
No second hash, no gradient, no new token. Empty, loading and error states for every new
surface; skeletons over spinners; controls render before data
(`src/app/(app)/people/history/page.tsx` is the Suspense-split model).
