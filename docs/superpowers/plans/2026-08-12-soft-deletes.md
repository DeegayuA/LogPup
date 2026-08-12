# App-wide Soft Deletes (D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every user-initiated delete becomes a guarded soft delete; admins get a Trash card with who/when/restore/purge; live-query discipline is CI-enforced.

**Architecture:** Per-table `deletedAt`/`deletedBy` on the five real delete paths (meetings, tasks, sprints, meeting_note_segments, meeting_screenshots). Reads go through connection-free `live*` subqueries in `src/db/live.ts`; `src/db/live.test.ts` statically scans the tree and fails CI on any raw read of a soft table or unjoined meeting-child read. Purge keeps the old `db.delete` bodies, admin-only, delete-first race-safe ordering.

**Tech Stack:** Next.js 16 App Router, Drizzle 0.45 + neon-http (NO transactions — `db.batch` only), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-12-soft-deletes-design.md` — every task below names the spec section it implements; read that section before coding.

## Global Constraints

- Migration file is **`drizzle/0023_soft_delete.sql`** (spec says 0022 but the parallel session took it: `0022_meeting_task_auto_assign.sql` exists). Never renumber existing files; never hand-edit committed migrations.
- `npm run db:migrate` is broken repo-wide (exits 1 silently). Apply SQL by hand against `DATABASE_URL` the way 0021 was applied, and record it applied in the plan checklist.
- NEVER module-scope `db.select()` — `src/db/index.ts` lazy Proxy crashes `next build` without `DATABASE_URL`. `live.ts` must use `new QueryBuilder()` from `drizzle-orm/pg-core`.
- Preserve every existing auth gate and every already-landed `logActivity` call in the six action files; the parallel session is active on main — **re-verify each file:line cited here against the live tree before editing** (use worktree isolation per user's standing preference; verify-and-adopt their changes).
- `deleteGeminiKey` is NOT touched (hard delete stays — security exception, spec front section).
- `clearTestData` and `backup.ts` enumerations unchanged (spec: External cleanup).
- All error strings plain human sentences per `src/lib/action-result.ts`; mutations end in the existing revalidate helpers.
- Per AGENTS.md read `node_modules/next/dist/docs/` guidance before touching server actions/revalidation.

---

### Task 1: Migration + schema columns

**Files:**
- Create: `drizzle/0023_soft_delete.sql`
- Modify: `src/db/schema.ts` (meetings ~:187, tasks ~:148, sprints ~:137, meetingNoteSegments ~:338, meetingScreenshots ~:431 — re-locate in live tree)

**Interfaces:**
- Produces: `deletedAt: timestamp('deleted_at', { withTimezone: true })`, `deletedBy: uuid('deleted_by').references(() => users.id)` on the five tables. Later tasks import these columns via the table objects.

- [ ] **Step 1: Write `drizzle/0023_soft_delete.sql`** (replay-safe, 0015 house style):

```sql
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");
ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "sprints" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");
ALTER TABLE "meeting_note_segments" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "meeting_note_segments" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");
ALTER TABLE "meeting_screenshots" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "meeting_screenshots" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id");
CREATE INDEX IF NOT EXISTS "meetings_starts_live_idx" ON "meetings" ("starts_at") WHERE "deleted_at" IS NULL;
DROP INDEX IF EXISTS "tasks_app_sprint_sort_idx";
CREATE INDEX IF NOT EXISTS "tasks_app_sprint_sort_idx" ON "tasks" ("app_id","sprint_id","sort_order") WHERE "deleted_at" IS NULL;
```

(Before writing the DROP/CREATE of `tasks_app_sprint_sort_idx`, read its current column list from `src/db/schema.ts` and mirror it exactly — the parallel session may have changed it.)

- [ ] **Step 2: Add the two columns to each of the five tables in `schema.ts`** with one shared comment block above meetings, assignment_history style: "Soft delete: reads go through src/db/live.ts; enforcement is src/db/live.test.ts. skip = deletedAt IS NOT NULL. Children of a trashed meeting are live-iff-meeting-live (derived, no columns)."
- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` clean.
- [ ] **Step 4: Apply the SQL by hand** with `psql "$DATABASE_URL" -f drizzle/0023_soft_delete.sql` (or the neon SQL editor path used for 0021). Verify: `\d meetings` shows `deleted_at`.
- [ ] **Step 5: Commit** — `git add drizzle/0023_soft_delete.sql src/db/schema.ts && git commit -m "feat: soft-delete columns and live partial indexes (D1)"`

### Task 2: `src/db/live.ts` + enforcement test

**Files:**
- Create: `src/db/live.ts`
- Create: `src/db/live.test.ts`

**Interfaces:**
- Produces (later tasks import these exact names): `liveMeetings`, `liveTasks`, `liveSprints`, `liveNoteSegments`, `liveScreenshots` (subquery objects usable in `.from()`/joins); `liveMeetingsAs(name: string)`, `liveTasksAs(name)`, `liveSprintsAs(name)`, `liveNoteSegmentsAs(name)`, `liveScreenshotsAs(name)`; `SOFT_TABLES` (array of `{ table, sqlName, live, liveAs }`); `MEETING_CHILD_TABLES` (array of sql names).

- [ ] **Step 1: Write `live.ts`:**

```ts
import { QueryBuilder } from 'drizzle-orm/pg-core'
import { isNull } from 'drizzle-orm'
import {
  meetings, tasks, sprints, meetingNoteSegments, meetingScreenshots,
} from './schema'

// Connection-free: QueryBuilder builds SQL without a client, so importing
// this module never touches the lazy db Proxy (build-time safety).
const qb = new QueryBuilder()

const liveOf = <T extends typeof meetings | typeof tasks | typeof sprints
  | typeof meetingNoteSegments | typeof meetingScreenshots>(t: T, name: string) =>
  qb.select().from(t).where(isNull(t.deletedAt)).as(name)

export const liveMeetings = liveOf(meetings, 'live_meetings')
export const liveTasks = liveOf(tasks, 'live_tasks')
export const liveSprints = liveOf(sprints, 'live_sprints')
export const liveNoteSegments = liveOf(meetingNoteSegments, 'live_note_segments')
export const liveScreenshots = liveOf(meetingScreenshots, 'live_screenshots')

// A fixed subquery object cannot appear twice in one statement — self-joins
// and multi-references mint a fresh aliased subquery per call.
export const liveMeetingsAs = (name: string) => liveOf(meetings, name)
export const liveTasksAs = (name: string) => liveOf(tasks, name)
export const liveSprintsAs = (name: string) => liveOf(sprints, name)
export const liveNoteSegmentsAs = (name: string) => liveOf(meetingNoteSegments, name)
export const liveScreenshotsAs = (name: string) => liveOf(meetingScreenshots, name)

export const SOFT_TABLES = [
  { table: meetings, sqlName: 'meetings', live: liveMeetings, liveAs: liveMeetingsAs },
  { table: tasks, sqlName: 'tasks', live: liveTasks, liveAs: liveTasksAs },
  { table: sprints, sqlName: 'sprints', live: liveSprints, liveAs: liveSprintsAs },
  { table: meetingNoteSegments, sqlName: 'meeting_note_segments', live: liveNoteSegments, liveAs: liveNoteSegmentsAs },
  { table: meetingScreenshots, sqlName: 'meeting_screenshots', live: liveScreenshots, liveAs: liveScreenshotsAs },
] as const

export const MEETING_CHILD_TABLES = [
  'meetingAttendees', 'meetingAiNotes', 'meetingFollowups', 'meetingSpeakers',
  'meetingTaskSuggestions', 'meetingRecordingSegments',
] as const
```

- [ ] **Step 2: Write `live.test.ts`** — static source scan (vitest, node fs; sync walk of `src/` collecting `.ts`/`.tsx`, skipping `*.test.ts`):
  - Check 1 raw-read ban: any file whose text matches `/\.from\((meetings|tasks|sprints|meetingNoteSegments|meetingScreenshots)[),]/` or `/(?:leftJoin|innerJoin|rightJoin)\((meetings|tasks|sprints|meetingNoteSegments|meetingScreenshots)[),]/` must be in `ALLOWLIST`.
  - Check 2 alias ban: `/alias\((meetings|tasks|sprints|meetingNoteSegments|meetingScreenshots)\b/` — same allowlist.
  - Check 3 join-required: a file matching `/\.from\((meetingAttendees|meetingAiNotes|meetingFollowups|meetingSpeakers|meetingTaskSuggestions|meetingRecordingSegments)[),]/` must also contain `liveMeetings` (import or use) or be allowlisted.
  - Check 4 delete confinement: `/db\.delete\(/` allowed only in `features/admin/trash-actions.ts`, `features/admin/actions.ts` (clearTestData), the gemini key actions file (locate the real deleteGeminiKey file first and pin it), scripts, and allowlisted cleanup blocks.
  - Check 5 completeness: every schema export carrying a `deletedAt` column appears in `SOFT_TABLES` (import schema, reflect over exported pgTables).
  - Check 6 backlog predicate confinement: `/isNull\([^)]*sprintId\)/` appears only in `src/features/sprints/backlog.ts`.
  - `ALLOWLIST` starts as the exact current offender list (discover by running the test) — each entry carries a `// why` comment; Tasks 3–5 shrink it to: `db/live.ts`, `features/admin/trash-queries.ts`, `features/admin/trash-actions.ts`, `features/admin/backup.ts`, the legacy-notes EXISTS probe site, and the keyframes proxy route.
- [ ] **Step 3: Run** `npx vitest run src/db/live.test.ts` — expect FAIL listing every unconverted site. Copy that list into the Task-4 checklist.
- [ ] **Step 4: Commit** — `git commit -m "feat: live-query subqueries and CI enforcement of soft-delete reads (D2)"` (test may stay red until Task 4 — acceptable, it is the worklist; do NOT skip/todo it).

### Task 3: Convert the five delete actions

**Files:**
- Modify: `src/features/meetings/actions.ts` (deleteMeeting ~:492-538), `src/features/sprints/task-actions.ts` (deleteTask), `src/features/sprints/actions.ts` (deleteSprint), the deleteNoteSegment action file (grep `deleteNoteSegment` — meetings feature), `src/features/meetings/ai-actions.ts` (deleteMeetingKeyframe)
- Test: extend each feature's existing mocked-action test file (set-user-title.test.ts idiom)

**Interfaces:**
- Consumes: schema columns (Task 1).
- Produces: delete actions now soft; each returns the same ActionResult shape as before.

- [ ] **Step 1: Per action, replace the `db.delete(...)` core** with:

```ts
const marked = await db.update(meetings)
  .set({ deletedAt: new Date(), deletedBy: session.user.id })
  .where(and(eq(meetings.id, meetingId), isNull(meetings.deletedAt)))
  .returning({ id: meetings.id })
if (marked.length === 0) return err('Meeting not found')
```

Rules per spec (Cascade rule / External cleanup): deleteMeeting — Google Calendar event delete STAYS (guests must stop seeing it), `googleEventId` kept on the row, blob sweep REMOVED; deleteMeetingKeyframe — `del()` call REMOVED, cap checks count LIVE frames only; deleteNoteSegment — the `source==='voice'` refusal preserved verbatim; deleteSprint — still returns released-tasks count computed over live tasks; keep every auth gate and `logActivity` call, change verb payloads to `'deleted'`.
- [ ] **Step 2: Neutral labels** — `logActivity` entityLabel for segments/keyframes becomes `'a note segment in <meeting title>'` / `'a screen keyframe in <meeting title>'` via an exported const template in the file (test asserts the template output contains no segment/keyframe content).
- [ ] **Step 3: Dialog copy** — every delete confirm dialog for these five: "Moves to Trash — admins can view and restore it." (segments/keyframes variant adds: "The content is retained until an admin permanently deletes it.") Locate via grep for the existing confirm strings.
- [ ] **Step 4: Mocked-action tests** — per action: double-delete returns err and writeSpy shows single UPDATE; non-authorized caller unchanged behavior; deleteMeeting stub asserts no `del()` call and calendar delete still invoked.
- [ ] **Step 5: Run** `npx vitest run src/features` — green. **Commit** `"feat: soft-delete the five delete paths (D3)"`

### Task 4: Backlog builder + read-site conversion

**Files:**
- Create: `src/features/sprints/backlog.ts` (+ `backlog.test.ts`)
- Modify: every file the Task-2 test lists — expected set (re-verify): `src/features/meetings/queries.ts`, `src/features/sprints/queries.ts` (~:176 isNull site), `src/features/sprints/task-actions.ts` (~:230 isNull site, bulkUpdateTasks sprint validation), `src/features/apps/queries.ts` + activity/comment aggregate queries, `src/features/people/queries.ts`, `src/features/search/actions.ts` (5 queries + quickAssign), `src/features/notifications/queries.ts`, `src/features/dashboard/` meeting/task cards, `src/features/meetings/ai-actions.ts` (alias block ~:1989-1993 → `liveTasksAs`; canManageMeeting both variants; canReadMeetingIntel; getMeetingIntel; getMeetingNoteTimeline)

**Interfaces:**
- Consumes: `liveMeetings`/`liveTasks`/`liveSprints`/`liveTasksAs` etc. (Task 2 exact names).
- Produces: `isBacklogRow(task, sprint)` pure predicate + a composable backlog select builder in `backlog.ts`, used by both call sites.

- [ ] **Step 1: Write `backlog.test.ts`** — fixture rows: task with `sprintId: null` IN backlog; task of a live sprint NOT in backlog; task of a trashed sprint IN backlog; trashed task NEVER in backlog.
- [ ] **Step 2: Implement backlog.ts** (`liveTasks leftJoin liveSprints on sprintId, where liveSprints.id IS NULL`); convert both isNull sites.
- [ ] **Step 3: Convert every remaining listed site** to `live*` sources. Notifications: `leftJoin(liveMeetings, eq(notifications.meetingId, liveMeetings.id))` + `or(isNull(notifications.meetingId), isNotNull(liveMeetings.id))`. Legacy-notes probe in getMeetingNoteTimeline: raw-table EXISTS over `meetingNoteSegments` with `// allowlisted: did-segments-EVER-exist probe — trashing the last segment must not resurrect the legacy notes blob`.
- [ ] **Step 4: Run** `npx vitest run src/db/live.test.ts` — GREEN with final allowlist. Full `npx vitest run` + `npx tsc --noEmit` green.
- [ ] **Step 5: Commit** `"feat: route all reads through live subqueries; backlog builder (D4)"`

### Task 5: Trash queries + restore/purge actions

**Files:**
- Create: `src/features/admin/trash-queries.ts`, `src/features/admin/trash-actions.ts` (+ `trash-actions.test.ts`, and pure `trash-grouping.ts` + test if grouping logic exceeds a few lines)

**Interfaces:**
- Produces: `getTrash(): Promise<TrashGroup[]>` where `TrashGroup = { kind: 'meeting'|'task'|'sprint'|'segment'|'keyframe'|'assignment', rows: TrashRow[] }`, `TrashRow = { id, label, context, deletedByName, deletedByAvatarUrl, deletedAt, parentTrashed: boolean }`; actions `restoreMeeting|restoreTask|restoreSprint|restoreSegment|restoreKeyframe|restoreAssignment(id)` and `purgeMeeting|purgeTask|purgeSprint|purgeSegment|purgeKeyframe(id, confirm)` — all `ActionResult`, all admin-gated.

- [ ] **Step 1: trash-queries.ts** — one bounded SELECT per soft table, RAW (allowlisted, `// trash: the one read that wants deleted rows`), `WHERE deleted_at IS NOT NULL`, join users on deletedBy, ORDER BY deleted_at DESC, per-source LIMIT 50, merged + re-limited ~50 with per-group counts; plus assignment_history open `changeKind='removed'` section. Labels: meetings/tasks/sprints use titles; segments/keyframes use the neutral templates from Task 3.
- [ ] **Step 2: trash-actions.ts restores** — inverse guarded UPDATE (`isNotNull(deletedAt)` → clear both columns). Preflights: segment/keyframe restore blocked with err('Restore the meeting first') while parent meeting trashed; keyframe restore re-checks MAX_KEYFRAMES_PER_MEETING against live frames; restoreMeeting nulls `googleEventId` and returns ok with warning "Calendar invite was cancelled and is not re-sent — use Add to calendar."; restoreAssignment = guarded db.batch closing the 'removed' tombstone + re-inserting the assignments row, mirroring createAssignment's existing batch, err('They are already assigned to this app') on live-row conflict.
- [ ] **Step 3: purges** — delete-first race-safe order per spec External cleanup: (1) collect blob pathnames raw, (2) `db.delete(T).where(and(eq(id), isNotNull(deletedAt)))`, 0 rows → STOP (concurrent restore), (3) best-effort `del()` pathnames. Admin + typed-confirm string (`confirm === 'delete forever'` checked server-side), `logActivity` verb `'purged'`.
- [ ] **Step 4: Tests** — mocked-action: member gets err on every trash action, writeSpy untouched; purge-after-restore stub returns 0 rows and no `del()`; restore of live row errs; restoreAssignment conflict path. Pure grouping/nesting test.
- [ ] **Step 5: Run suites; commit** `"feat: admin trash queries, restore and purge actions (D5)"`

### Task 6: Trash card UI + keyframe proxy auth

**Files:**
- Create: `src/features/admin/components/trash-card.tsx`
- Modify: `src/app/(app)/admin/page.tsx` (mount between Apps card and Danger zone), keyframes proxy route if present (locate `/api/meeting-keyframes` in live tree — parallel session may have landed it)

- [ ] **Step 1: TrashCard** — server component fed by `getTrash()` in the page's existing `Promise.all`; groups with headers, rows: label + context, deleter avatar+name, relative time, Restore button (useTransition client leaf), "Delete forever" behind typed-confirm dialog ("permanently removes the data and its stored files"). Segments/keyframes nested under meeting label, Restore disabled with "restore the meeting first" tooltip while parent trashed. Footnote: deactivated users / archived apps live under their own cards.
- [ ] **Step 2: Keyframe proxy** (if the route exists): pathname → `meeting_screenshots` row → non-admin requires frame live AND meeting live, else 404; admin bypass for trash preview; add route file to live.test.ts allowlist with comment.
- [ ] **Step 3: Manual check** — trash a meeting in dev; keyframe URL 404s for a member; admin sees it in Trash and restores; verify with `npm run dev`.
- [ ] **Step 4: Commit** `"feat: admin trash card with restore and typed-confirm purge (D6)"`

### Task 7: E2E + full verification

**Files:**
- Modify/Create: `e2e/` serial spec following existing smoke.spec.ts harness (workers:1, RUN_ID-tagged rows, afterAll cleanup via `{ db }` import)

- [ ] **Step 1: E2E** — (1) create meeting → delete → gone from /meetings list → admin Trash shows it with deleter name → Restore → back on list (db-assert deletedAt IS NULL); (2) delete task → backlog/board hides it → restore; (3) purge path: delete meeting, purge with typed confirm, db-assert row gone; (4) double-restore returns the inline err, no crash.
- [ ] **Step 2: Full gate** — `npx tsc --noEmit && npx vitest run && npm run lint && npm run build` all green; `npx playwright test` for the new spec.
- [ ] **Step 3: Commit** `"test: soft-delete e2e coverage (D7)"`
