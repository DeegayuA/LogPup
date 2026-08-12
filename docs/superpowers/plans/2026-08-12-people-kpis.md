# People Work History, Observed Load & KPIs (C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every person page an honest, structurally leave-safe picture of observed load (meeting hours, task-completion events, declared allocation) and a merged 60-day work-history ledger — with zero manual timesheets, zero composite scores, zero leaderboards, and two signal rules that cannot fire on someone's absence.

**Architecture:** Pure shaping/signal modules (sibling-tested, no DB access) consume plain row shapes; thin bounded queries in `queries.ts` fetch those shapes and hand them straight to the pure modules; server components render the result with zero client JS. Two small, additive fixes to already-landed writers (`bulkUpdateTasks`'s per-task logging, `deriveAndInsertFollowups`'s re-analysis dedupe) make the substrate honest before anything reads it. No new tables, no new columns, no migration.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle + Neon Postgres (neon-http — NO transactions, `db.batch` only), Tailwind v4 + shadcn (Base UI), vitest.

**Spec:** `docs/superpowers/specs/2026-08-12-people-kpis-design.md`. It is long and opinionated about what is *not* built — read the section named in each task before coding, and read the whole "Rejected" section once up front so you don't accidentally reintroduce something it explicitly killed (follow-up resolution rate, opened-vs-resolved chart, debt-age signal, zero-task-events flag, cycle-time proxy, voice participation, overdue trend, `tasks.updatedAt` as a source, a `Meeting hrs · 7d` tile). Where this plan and the spec disagree, the spec wins on *intent*; this plan wins on exact file/line/signature detail, which was re-verified against the live tree while writing it and may have drifted further by the time you implement — re-verify again.

**Suite order:** D (soft deletes) → A (attendee recommender) → B (meeting load reduction) → **C (this plan)**. C assumes `src/db/live.ts` / `src/db/live.test.ts` exist and every meeting/task/sprint read already goes through them. C does **not** depend on B's `meeting_attendees.optional` column — if B has not landed, that is fine; the required/optional split stays out of scope either way (see Task 2).

**Branch:** `feat/people-kpis`, worktree `/Users/deeghayuadhikari/Documents/GitHub/LogPup-sdd-c`, stacked on B's branch if it has landed, otherwise on `feat/attendee-recommender` (which stacks on `feat/soft-deletes`). Before Task 1, confirm `src/db/live.ts` exports `liveMeetings`/`liveTasks`/`liveMeetingsAs`/`liveTasksAs` under those exact names — if D shipped with different names, use D's real names throughout and say so in your report.

## Global Constraints

- **Soft deletes are live.** Every read of meetings/tasks/sprints/meeting_note_segments/meeting_screenshots MUST go through the `live*` subqueries in `src/db/live.ts` (`liveMeetings`, `liveTasks`, `liveMeetingsAs(name)`, `liveTasksAs(name)`, etc.). `src/db/live.test.ts` is a static scan with six checks that **fails the build** on: a raw read of a soft table, an `alias()` of a soft table outside `live.ts`, a meeting-child-table read (`meeting_attendees`, `meeting_followups`, …) not co-occurring with `liveMeetings`/`liveMeetingsAs` in the same statement, `db.delete` outside the sanctioned admin/trash sites, a soft table missing from `SOFT_TABLES`, or `isNull(` beside `.sprintId` outside `sprints/backlog.ts`. Every new query C adds (`getPersonMeetingHours`, `getPersonTaskEvents`, `getPersonWorkHistory`) must join through `liveMeetings`/`liveTasks` from the first line written. **Never add yourself to its ALLOWLIST.**
- **`activity_log` and `assignment_history` are append-only** — D's spec explicitly does not filter them by soft-delete state, and C's reads of them do not need to join `liveMeetings`/`liveTasks` to satisfy the live-query test. The one exception: any read that needs a task's *current* row (e.g. the assignee fallback in Task 3) reads `tasks` itself and therefore must go through `liveTasks`.
- **Migration discipline (C needs none).** The spec is explicit: zero new tables, zero new columns, zero migrations — everything computes on read. Do **not** add a migration file for this plan. For the record, if a later task in this plan turns out to need one after all: number strictly after the highest existing migration (0026 is D's soft-delete migration, 0027 is A1's, B may add 0028+ — so C would be 0029+), register it in `drizzle/meta/_journal.json` with a `when` strictly greater than the newest `created_at` already in `drizzle.__drizzle_migrations` (or `db:migrate` silently skips it), and put a statement-breakpoint marker between every statement, never inside a comment. `npm run db:migrate` has been observed exiting 0 without applying anything — verify against `information_schema` by hand afterwards. This should not come up; if it does, stop and reconsider whether the spec's zero-migration goal is actually being honored.
- **neon-http has no transactions.** Multi-row writes use `db.batch`. C's two writer fixes are each a single-statement change to an existing insert, so this should not bite, but keep it in mind if a fix grows.
- Writes stay Server Actions returning `ActionResult` (`src/lib/action-result.ts`); errors are plain human sentences. Reads live in `queries.ts`, never inside components. **C adds no new mutating Server Actions** — its only writer-side changes are edits to two existing, already-authorized actions/functions.
- Pure logic goes in its own module with a sibling `.test.ts` (house style — see `allocation-history.ts`, `task-workload.ts`, `followup-split.ts`, `meeting-window.ts`, `iso-day.ts`, `activity-levels.ts` for the shape). **No DB access inside a pure module, ever.**
- Read `node_modules/next/dist/docs/` before touching Server Actions or revalidation (AGENTS.md) — relevant here because Task 1 edits two existing actions.
- Known pre-existing failures to leave alone: 7 tsc errors, `npm run lint` baseline 12 problems, the `smoke.spec.ts` drag test. Don't fix them as a drive-by; don't let a new failure hide among them either — diff the count.
- **NEVER `git stash`** — worktrees are shared across parallel agent sessions; stashing has destroyed a colleague's uncommitted work before. Commit or leave changes in place.
- The changelog (`src/lib/changelog.data.json`) is **auto-generated from git** by `scripts/generate-changelog.mjs` on `prebuild` — one entry per commit. There is no manual changelog task in this plan; write commit messages that read well as a changelog line, since one of them literally will be.

### Design invariants this plan must not soften

These are the ethical core of C, restated so no task can quietly drop one:

1. **No manual timesheets, ever.** "Hours" means *observed load* — calendar meeting hours, task-flow events, declared allocation — and every label, tile, caption and code comment that touches these numbers says so. Never "hours worked", never "attended" (meetings), never "attendance".
2. **No composite score, no leaderboard.** No surface anywhere combines these signals into one number about a person, ranks people against each other, or computes `observed hours ÷ allocationPct`. That ratio is banned **by name** — if you find yourself computing it for *any* reason (even "just for a sanity check log line"), stop.
3. **Structurally leave-safe signals only.** There is no leave table. A signal rule must be *incapable* of reading leave as decline, not merely unlikely to. The meeting-hours signal is therefore rising-only, baselined on a *qualifying-week* median (in-tenure, non-zero, no gazetted holiday) so a leave week or a holiday week can never depress the baseline and manufacture a flag on return. If you can construct a fixture where three quiet weeks (leave, or a public-holiday cluster) cause a flag on the person's return to normal load, the implementation is wrong — this is a mandatory test case, not a nice-to-have.
4. **Task completions come from `activity_log` events, never `tasks.updatedAt`.** `tasks` has no `updatedAt`/`completedAt` column on `main` today (verified — see `task-workload.ts`'s own header comment), and even if a later sub-project adds one, C must not consume it: a last-touch timestamp re-dates a closure and cannot distinguish a status change from a title edit. `bulkUpdateTasks` currently writes **one summary row** per batch and zero `'completed'` rows — Task 1 fixes that going forward; Task 3 handles the legacy summary rows that already exist.
5. **Task throughput carries no signal rule.** No target, no decline flag, no "zero events this week" flag — the spec cuts that one by name because it measures board adoption, not diligence, and is trivially gamed. `task-events.ts` (Task 3) exports no signal function at all; if you find yourself adding one, you are reintroducing a rejected feature.
6. **Allocation churn counts admin actions, not the person's behaviour.** It is derived from `assignment_history` rows — someone else editing this person's allocation — so absence can never move it. Rows whose `effectiveFrom` coincides with the migration-0015 backfill must be excluded (see Task 4 for exactly how — the spec's "shared backfill instant" premise turned out to be wrong on the real migration SQL, and this plan corrects it).
7. **Longitudinal per-person surfaces are self + admin only.** Today, verified by reading `src/app/(app)/people/[id]/page.tsx` and every card in `src/features/people/components/`: **every signed-in member sees a colleague's entire person page** — full allocation timeline and trend, the full 26-week activity graph, every open task, every follow-up, the ±60-day meeting list. There is no viewer-based gating anywhere on that page today, and the page has never called `auth()`/`getSession()`. That is "today's exposure level." C adds the FIRST viewer check this page has ever had, and uses it only to gate the *new* longitudinal surfaces (12-week meeting-hours chart, completions/week bars, the 60-day merged ledger, both signal sentences) — every existing card stays exactly as exposed as it is today.
8. **Week keys are the Monday ISO date in Asia/Colombo, on both sides, always.** Never `'YYYY-Www'` — that format breaks at the ISO-year boundary (`2027-W53`... actually the trap case is `2026-W53`, which runs Dec 28 2026 – Jan 3 2027, so three of its days print as `2027` under a naive `date-fns getISOWeek`/`getISOWeekYear` pairing done wrong). The Monday-date string sidesteps the whole class of bug. SQL side: `date_trunc('week', ts)` (Postgres's week truncation is already ISO/Monday-based). JS side: a single tested helper (Task 2) — never hand-rolled per module.
9. **Chart captions stating a metric's limits are baked into the SVG as chart-area `<text>`,** not as HTML outside the `<svg>`. A screenshot crop of just the chart region must not be able to strip the caveat. `role="img"` + `aria-label` still carries the same information for assistive tech — the two are additive, not alternatives.

---

### Task 1: Upstream writer fixes — per-task bulk logging, assignee snapshots, follow-up dedupe

**Files:**
- Modify: `src/features/sprints/task-actions.ts` (`bulkUpdateTasks`, currently lines 558–635; `updateTask`'s status-change `logActivity` call, currently line 397; `moveTaskOnBoard`'s status-change `logActivity` call, currently line 523 — **re-verify all three against the live tree**, D's soft-delete conversion of `tasks` reads to `liveTasks` will have touched this file)
- Modify: `src/features/meetings/ai-actions.ts` (`deriveAndInsertFollowups`, currently lines 822–861, called once from `persistMeetingAnalysis` at line 1178)
- Extend: `src/features/sprints/task-actions.test.ts` if it exists, else create it; extend `src/features/meetings/followups.test.ts` or create `src/features/meetings/ai-actions.test.ts` for the dedupe (mocked-action idiom, see `src/features/admin/set-user-title.test.ts`)

**Interfaces:**
- No new exported functions. `bulkUpdateTasks` and `deriveAndInsertFollowups` keep their existing signatures. `bulkUpdateTasks`'s existing `db.select({...})` for `rows` gains `status: tasks.status` (via `liveTasks`, per D).

Read first: spec section "Task completions/week" (the bulk-hole diagnosis) and "Open follow-up debt" (the dedupe requirement). Both fixes are independent of each other and of the rest of this plan — land them first so every later query reads a substrate that is already correct, and so their tests can assert against the *real* landed payload shape rather than a guess.

- [ ] **Step 1: Write the failing test for per-task bulk logging first.** In the bulk-update test file, mock `db` the way `set-user-title.test.ts` does (a `writeSpy`/`logSpy` capturing every `logActivity` call — mock `@/features/activity/log`). Assert: a bulk patch that sets `status: 'done'` on 3 tasks whose prior statuses were `['todo', 'in_progress', 'done']` logs the existing ONE summary row (`verb: 'updated'`, unchanged — do not remove it, other surfaces may read it) **plus** exactly 2 additional rows with `verb: 'completed'`, `entityType: 'task'`, one per task that was NOT already done, each `entityId` = that task's id, each `metadata` = `{ assigneeId: <that task's row.assigneeId>, status: { from: <that task's prior status>, to: 'done' } }` — nothing for the task that was already `'done'` (no phantom re-completion). A bulk patch setting `status: 'todo'` on a task previously `'done'` logs one additional `verb: 'reopened'` row, same metadata shape. A bulk patch that does **not** touch `status` (e.g. only `priority`) logs only the existing summary row and nothing per-task.
- [ ] **Step 2: Run, watch it fail.** `npx vitest run src/features/sprints/task-actions.test.ts` (or wherever you placed it).
- [ ] **Step 3: Implement.** In `bulkUpdateTasks`, after the existing summary `logActivity` call: if `patch.status !== undefined`, iterate `allowed` (the rows actually written, which now carry `status` from the widened select) and, for each row whose OLD `status !== patch.status`, fire one more `logActivity` call with `verb: patch.status === 'done' ? 'completed' : row.status === 'done' ? 'reopened' : 'moved'` (mirror the exact three-way branch already used in `updateTask`/`moveTaskOnBoard` for consistency — do not invent a fourth verb), `entityId: row.id`, `entityLabel: row.title`, `appId: row.appId`, `metadata: { assigneeId: row.assigneeId, status: { from: row.status, to: patch.status } }`. These are best-effort/non-blocking exactly like the existing summary call (`logActivity` never throws — see `src/features/activity/log.ts`), so a straightforward `for` loop with sequential `await`s is fine at this data scale (bulk selections cap at 100 rows per `bulkUpdateInput`'s existing zod schema).
- [ ] **Step 4: Write the failing test for assignee-snapshot metadata on the two single-task sites.** In `updateTask`'s and `moveTaskOnBoard`'s existing status-change tests (or new ones alongside them), assert that when a status change fires, `metadata.assigneeId` equals the task's assignee **at the time of the change** (`existing.assigneeId`, already in scope in both functions) — added alongside the existing `metadata.status` shape, not replacing it.
- [ ] **Step 5: Implement.** In both `updateTask` and `moveTaskOnBoard`, change `metadata = { status: { from: existing.status, to: nextStatus } }` to `metadata = { assigneeId: existing.assigneeId, status: { from: existing.status, to: nextStatus } }` (adjust the local variable name to match whichever function you're in). Non-status-change branches (assignee-change, priority-change) are untouched.
- [ ] **Step 6: Note the landing date.** Once this step is actually merged, you will hardcode the ISO date it landed as `TASK_EVENT_ATTRIBUTION_SNAPSHOT_SINCE` inside `task-events.ts` in Task 3 — that constant does not exist yet; just keep today's date in mind (or check `git log` for this commit's date once made) for when Task 3 asks for it. This is a genuine one-time historical fact, not a placeholder — do not invent a date, use the real one.
- [ ] **Step 7: Write the failing test for follow-up re-analysis dedupe.** New test (mocked `db`, following the `logActivity`-mock idiom): call the module's re-analysis path twice with the same `sourceMeetingId` and overlapping `(personName, text, kind)` payloads. Assert: (a) before the second insert, a `db.delete(meetingFollowups).where(and(eq(sourceMeetingId, X), isNull(createdBy), eq(status, 'open')))`-shaped call fires (assert on your delete spy's `where` args or the resulting captured predicate, whichever your mock harness makes easiest); (b) a row whose `(personName, text, kind)` matches a **resolved** row from the first pass is **not** re-inserted on the second pass (resolved items are read first and diffed against); (c) a manually-added row (`createdBy` non-null) is never touched by the delete, in either pass.
- [ ] **Step 8: Run, watch it fail.** `npx vitest run src/features/meetings`
- [ ] **Step 9: Implement the dedupe in `deriveAndInsertFollowups`.** Before the existing `if (rows.length > 0) await db.insert(meetingFollowups).values(rows)`: (a) `await db.delete(meetingFollowups).where(and(eq(meetingFollowups.sourceMeetingId, sourceMeetingId), isNull(meetingFollowups.createdBy), eq(meetingFollowups.status, 'open')))` — this is a `db.delete` on a table that is **not** one of D's five soft tables (`meeting_followups` stays a real delete per D's own "ALREADY SOFT... status flips" classification, so this does not need `live.test.ts` allowlisting); (b) `SELECT personName, text, kind FROM meeting_followups WHERE sourceMeetingId = X AND status != 'open'` (i.e. resolved/deferred survivors) and build a `Set` of `` `${personName} ${text} ${kind}` `` keys; (c) filter the freshly-derived `rows` to drop any whose composite key is in that set before inserting. Both new reads/writes go through `liveMeetings`-adjacent tables only insofar as `meeting_followups` itself needs no live wrapper (it isn't one of the five soft tables) — but its `sourceMeetingId` still points at a `meetings` row, so if you ever need the meeting's own liveness here, join `liveMeetings`; the dedupe as specified does not need to.
- [ ] **Step 10: Full local verify.** `npx vitest run src/features/sprints src/features/meetings`, `npx tsc --noEmit` (no *new* errors vs. the known 7). **Commit:** `feat: per-task bulk activity logging, assignee snapshots, and follow-up re-analysis dedupe (C-1)`

### Task 2: `iso-day.ts` week-key helper + `observed-load.ts` — meeting-hours shaping and signal

**Files:**
- Modify: `src/features/people/iso-day.ts`, `src/features/people/iso-day.test.ts`
- Create: `src/features/people/observed-load.ts`, `src/features/people/observed-load.test.ts`

**Interfaces:**
- `iso-day.ts` adds: `isoWeekMonday(iso: string): string` — the Monday-date key (`YYYY-MM-DD`) of the ISO week containing `iso`.
- `observed-load.ts` produces:
  ```ts
  export const OBSERVED_LOAD_WINDOW_WEEKS = 12
  export const DECLINED_STAT_WINDOW_WEEKS = 4
  export const MEETING_LOAD_TRAILING_WEEKS = 4
  export const MEETING_LOAD_RATIO = 1.25
  export const MEETING_LOAD_MIN_HOURS_ABS = 10
  export const MEETING_LOAD_SUSTAIN_WEEKS = 2
  export const MEETING_LOAD_MIN_QUALIFYING_WEEKS = 8
  export const MEETING_HOURS_CHART_CAPTION =
    'As the calendar reads today — a floor. Meetings outside LogPup are invisible; ' +
    'overlapping invites double-count; RSVPs, reschedules and deletions rewrite past ' +
    'weeks; an invite is not attendance.'

  export type MeetingHoursRow = { weekStart: string; hours: number }

  export type WeeklyHours = {
    weekStart: string
    hours: number
    /** True only for the week containing `todayIso` — chart hatches it, text says "so far". */
    partial: boolean
    /** True when this Colombo week contains a date present in LK_HOLIDAYS. False, not undefined, once the map has no entry — see the 2026-only degradation note below. */
    holiday: boolean
  }

  export type MeetingHoursSignal =
    | { fired: false; suppressed: true; reason: 'too-few-qualifying-weeks' }
    | { fired: false; suppressed: false }
    | { fired: true; weeksSustained: number; trailingMean: number; qualifyingMedian: number }

  export type ObservedLoadSummary = {
    weeks: WeeklyHours[]              // dense-filled, oldest first, length OBSERVED_LOAD_WINDOW_WEEKS + 1 (the partial week)
    thisWeekHours: number             // weeks.at(-1).hours
    declinedCount: number             // declined invites in the trailing DECLINED_STAT_WINDOW_WEEKS weeks
    qualifyingWeekCount: number
    signal: MeetingHoursSignal
  }

  export function buildWeeklyHours(rows: MeetingHoursRow[], todayIso: string, windowWeeks?: number): WeeklyHours[]
  export function meetingHoursSignal(weeks: WeeklyHours[], tenureStartWeek: string): MeetingHoursSignal
  export function buildObservedLoadSummary(input: {
    hoursRows: MeetingHoursRow[]
    declinedCount: number
    todayIso: string
    userCreatedAtIso: string
  }): ObservedLoadSummary
  ```
  Module header must state, verbatim in spirit: "LK_HOLIDAYS covers 2026 only — a chart week that lands in 2027 silently loses its holiday annotation (`holiday: false` even on a real holiday) until the map is extended. This is accepted, not hidden — noted here per the design spec."

Read first: spec section "Meeting load — scheduled hours/week" in full, twice. This is the highest-stakes module in the plan — the leave-safety guarantee lives here.

- [ ] **Step 1: `isoWeekMonday` tests first**, in `iso-day.test.ts`. Cover: a Wednesday maps to that week's Monday; a Monday maps to itself; **the ISO-year-boundary case**: `isoWeekMonday('2027-01-01')` must equal `'2026-12-28'` (Jan 1 2027 is a Friday, and ISO week 53 of 2026 runs Mon Dec 28 2026 – Sun Jan 3 2027 — so the first three days of January 2027 belong to a *2026*-numbered ISO week; a naive `` `${year}-W${week}` `` implementation would either mis-key this or need year-crossing logic the Monday-date format sidesteps entirely). Also assert the function throws on a malformed input (matching `isoDayAdd`'s existing contract).
- [ ] **Step 2: Implement `isoWeekMonday`.** Compute the ISO weekday of `iso` (Mon=1..Sun=7) via `new Date(toUtcMidnight-equivalent).getUTCDay()` transformed as `((getUTCDay() + 6) % 7) + 1` (reuse the existing UTC-midnight arithmetic pattern already in the file — do not introduce a second date-parsing path), then `isoDayAdd(iso, -(weekday - 1))`.
- [ ] **Step 3: Run + commit the helper alone if you like, or fold into Step 10's commit** — your call; either way `npx vitest run src/features/people/iso-day.test.ts` must pass before continuing.
- [ ] **Step 4: Write `buildWeeklyHours` tests.** Dense-fill: given rows for only 3 of the 12 weeks, the other 9 appear at `hours: 0`. Partial marking: the week containing `todayIso` is `partial: true` regardless of whether it has rows; every other week is `partial: false`. Overlap double-count: two overlapping meetings both not-declined sum their full duration into the same week (assert this is a documented *feature* here, not a bug — the test name should say so). Holiday annotation: a week whose Monday–Sunday span (Colombo) contains a `LK_HOLIDAYS` key is `holiday: true`; assert this using a real 2026 date from `lk-holidays.ts` (e.g. the week containing `2026-04-14`, Sinhala/Tamil New Year) so the test breaks honestly if that file's dates ever change. A week entirely in 2027 is `holiday: false` (graceful 2026-only degradation, not a crash).
- [ ] **Step 5: Implement `buildWeeklyHours`.** Generate the `OBSERVED_LOAD_WINDOW_WEEKS + 1` Monday keys ending at `isoWeekMonday(todayIso)` (via repeated `isoDayAdd(monday, -7)`), left-join `rows` by `weekStart`, mark `partial` where `weekStart === isoWeekMonday(todayIso)`, and mark `holiday` by checking each of the week's 7 days (`isoDayRange(weekStart, isoDayAdd(weekStart, 6))`) against `getLkHoliday` from `@/lib/lk-holidays` (parse each `YYYY-MM-DD` as a Colombo-noon `Date` the same way `person-tasks-card.tsx`'s `formatDueDate` does, to avoid a UTC-midnight rollback).
- [ ] **Step 6: Write `meetingHoursSignal` tests — every one of these is mandatory, not optional coverage.** (a) **Return-from-leave must-not-fire**: 3 near-zero weeks (leave) followed by a return to a completely normal, previously-typical load — the leave weeks are excluded from the qualifying set (non-zero requirement), the median is computed over the OTHER qualifying weeks, and normal load does not exceed 1.25× that median, so it does not fire. (b) **New-hire must-not-fire**: `tenureStartWeek` lands mid-window; weeks before it are non-qualifying regardless of their (zero) hours; fewer than `MEETING_LOAD_MIN_QUALIFYING_WEEKS` qualifying weeks in the window ⇒ `{ fired: false, suppressed: true, reason: 'too-few-qualifying-weeks' }`. (c) **Holiday-cluster must-not-fire**: construct a window with several holiday weeks (use real April 2026 LK_HOLIDAYS dates — Bak Poya, Good Friday, the Sinhala/Tamil New Year pair) at reduced hours, followed by unchanged June-level load; the holiday weeks are excluded from the qualifying median, so June's ordinary load doesn't read as "1.25× a median that was artificially dragged down by New Year." (d) **Falling series never flags**: a monotonically decreasing trailing-4 mean must never produce `fired: true` regardless of ratio math (assert this directly — the rule is one-directional by construction, not by a lucky threshold). (e) **2-consecutive-week persistence**: a single week crossing the ratio+absolute thresholds does NOT fire; the same crossing sustained into the following week DOES, with `weeksSustained` reflecting it. (f) A trivial fire case with hand-picked numbers, so the ratio/absolute-floor arithmetic itself is pinned (e.g. qualifying median 8h, trailing-4 mean 12h ⇒ 12/8 = 1.5 ≥ 1.25 AND 12 ≥ 10 ⇒ fires when sustained 2 weeks; the same 12h against a median of 12h does not, since 1.0 < 1.25).
- [ ] **Step 7: Implement `meetingHoursSignal`.** Qualifying weeks = `weeks.filter(w => w.weekStart >= tenureStartWeek && w.hours > 0 && !w.holiday && !w.partial)` (the partial current week is never qualifying — it's incomplete by definition). If `qualifyingWeekCount < MEETING_LOAD_MIN_QUALIFYING_WEEKS`, return the suppressed shape. Else compute the qualifying median once; for each of the most recent `MEETING_LOAD_SUSTAIN_WEEKS` **full** (non-partial) weeks, compute that week's own trailing-`MEETING_LOAD_TRAILING_WEEKS`-*qualifying*-week mean (walking backward from that week, skipping non-qualifying weeks, same as the baseline) and check `mean >= MEETING_LOAD_RATIO * qualifyingMedian && mean >= MEETING_LOAD_MIN_HOURS_ABS`; fire only if **every** one of those `MEETING_LOAD_SUSTAIN_WEEKS` checkpoints passes.
- [ ] **Step 8: Write `buildObservedLoadSummary` tests.** It composes the above and is mostly glue — assert `thisWeekHours` reads from the partial week (label-truth: this is literally "this week so far", never a fabricated trailing-7-days figure), `declinedCount` passes through unmodified, and the whole shape round-trips through a realistic fixture.
- [ ] **Step 9: Implement + run everything.** `npx vitest run src/features/people/observed-load.test.ts src/features/people/iso-day.test.ts`
- [ ] **Step 10: Commit:** `feat: Colombo Monday-key helper and leave-safe meeting-load shaping (C-2)`

### Task 3: `task-events.ts` — task-completion shaping and attribution (no signal rule)

**Files:** Create `src/features/people/task-events.ts`, `src/features/people/task-events.test.ts`

**Interfaces:**
```ts
export const TASK_EVENT_WINDOW_WEEKS = 12
/** The date Task 1 of this plan actually merged — set this to the real
 *  merge date, not a placeholder, once Task 1 is committed. Bulk-done
 *  completions before this date have no per-task activity_log row at all
 *  and are only visible here via the legacy-row expansion below. */
export const TASK_EVENT_ATTRIBUTION_SNAPSHOT_SINCE = '<ISO date — fill in from Task 1's commit>'

export type TaskEventKind = 'completed' | 'reopened'

/** One raw activity_log row already narrowed by the query to task
 *  completion/reopen verbs, PLUS legacy bulk-done 'updated' rows (see
 *  expandTaskEvents). currentAssigneeId comes from a batched liveTasks
 *  lookup keyed by taskId — null when the task has since been trashed or
 *  the id is otherwise untraceable. */
export type RawTaskEventRow = {
  id: string
  taskId: string
  verb: string                              // 'completed' | 'reopened' | 'updated'
  createdAt: Date                           // activity_log.createdAt, timestamptz — passed through as-is
  metadata: Record<string, unknown> | null
  currentAssigneeId: string | null
}

export type ShapedTaskEvent = {
  taskId: string
  kind: TaskEventKind
  createdAt: Date
  assigneeId: string
  /** True when metadata carried no snapshot and the CURRENT assignee was
   *  used instead — the caption-worthy fact ("older completions follow the
   *  task's current assignee; reassignment moves those between people"). */
  attributedByFallback: boolean
}

/** Shared by task-events.ts and work-history.ts so attribution logic has
 *  exactly one definition. Returns null when neither the snapshot nor a
 *  current assignee is available (unattributable — caller must drop the row,
 *  never attribute it to "nobody" as if that were a fact about the task). */
export function resolveTaskEventAssignee(
  metadata: Record<string, unknown> | null,
  currentAssigneeId: string | null,
): { assigneeId: string; viaFallback: boolean } | null

/** Expands raw rows into one ShapedTaskEvent per real completion/reopen,
 *  including fanning legacy bulk-done 'updated' rows (verb='updated' AND
 *  metadata.patch.status==='done') out across metadata.taskIds — one
 *  ShapedTaskEvent per id in that array, always attributedByFallback=true
 *  since a bulk summary row never carried a per-task snapshot. Rows that
 *  resolveTaskEventAssignee cannot attribute are silently dropped (not
 *  zeroed onto anyone). */
export function expandTaskEvents(rows: RawTaskEventRow[]): ShapedTaskEvent[]

export type WeeklyTaskEvents = { weekStart: string; completed: number }

export type TaskEventsSummary = {
  weeks: WeeklyTaskEvents[]           // dense-filled over TASK_EVENT_WINDOW_WEEKS + partial current week
  /** MIN(createdAt) over ALL qualifying events ever for this person — never
   *  a hardcoded date, even though the constant above is (they answer
   *  different questions: one is "when did the mechanism improve", the
   *  other is "how far back does THIS person's data go"). null when they
   *  have none. */
  historyBeginsAt: Date | null
  /** Share (0..1) of events in `weeks` attributed via fallback rather than
   *  a snapshot — drives the "older completions follow the current
   *  assignee" caption; 0 when there are no events at all. */
  fallbackShare: number
}

export function buildTaskEventsSummary(
  events: ShapedTaskEvent[],
  todayIso: string,
  historyBeginsAt: Date | null,
): TaskEventsSummary

export function taskEventsChartCaption(historyBeginsIso: string | null): string
```
**No signal-rule export exists in this module, on purpose.** If a future change wants one, that is a new spec decision, not a gap in this plan.

Read first: spec section "Task completions/week" in full, and the "Rejected → Zero-task-events flag" entry (so you understand *why* there is deliberately no floor/silence detector here).

- [ ] **Step 1: `resolveTaskEventAssignee` tests first.** `metadata.assigneeId` present ⇒ `{ assigneeId: that, viaFallback: false }`, current-assignee ignored entirely. `metadata` null/missing the key, `currentAssigneeId` present ⇒ `{ assigneeId: current, viaFallback: true }`. Both absent ⇒ `null`. `metadata.assigneeId` present but not a string (defensive — a jsonb column can hold anything) ⇒ falls back to current, same as absent.
- [ ] **Step 2: Implement + run.** Small, pure, no surprises.
- [ ] **Step 3: `expandTaskEvents` tests — the contract test IS the point of this task.** Pin the REAL landed payload shape from Task 1: a bulk-done row is `{ id, taskId: entityId-of-first-task, verb: 'updated', createdAt, metadata: { patch: { status: 'done' }, taskIds: ['t1','t2','t3'] }, currentAssigneeId: <ignored for this row itself> }` — assert it expands to exactly 3 `ShapedTaskEvent`s, `kind: 'completed'`, one per id in `taskIds`, each `attributedByFallback: true`. A direct `verb: 'completed'` row with `metadata.assigneeId` set expands to exactly 1 event, `attributedByFallback: false`. A `verb: 'updated'` row whose `metadata.patch.status` is anything other than `'done'` (or absent) expands to nothing (it's a plain edit, not a completion — this is what keeps assignee-only/priority-only bulk edits from polluting the count). A `verb: 'reopened'` row expands to 1 `kind: 'reopened'` event. A row `expandTaskEvents` cannot attribute (per Step 1's null case) is dropped, not zeroed.
- [ ] **Step 4: Implement `expandTaskEvents`** on top of `resolveTaskEventAssignee`. For the bulk-fan-out path, each unnested id needs its OWN `currentAssigneeId` — design the query in Task 6 to hand every row (including the fanned-out ids implicitly, via the row's own `metadata.taskIds`) a way to look this up; simplest is for the query to attach a `currentAssigneeByTaskId: Record<string,string|null>` alongside `rows` rather than trying to pre-flatten `RawTaskEventRow` — **adjust the exported type above if you take this path and say so in your report**; the shape above is the target contract, not a hard constraint on internal query plumbing.
- [ ] **Step 5: `buildTaskEventsSummary` tests.** Dense-fill and partial-week marking mirror `buildWeeklyHours` (same `isoWeekMonday` helper — reuse it, do not reimplement week math a second time). Reopens **never decrement a past week** — a `reopened` event does not subtract from the week its matching `completed` event landed in; it is its own thing, and the weekly `completed` count only ever counts `kind === 'completed'` events (assert this explicitly: a task completed in week N and reopened in week N+1 leaves week N's count untouched). `historyBeginsAt` passes through unchanged from the caller (this function does not compute the MIN itself — that's a query-level aggregate, see Task 6) and weeks before it, if any fall inside the display window, are a documented "no events yet" state distinguishable from a real zero (expose this as `weeks[i].completed === 0` is indistinguishable numerically from "before history began" — note in the module header that the CALLER (the component) is responsible for rendering weeks before `historyBeginsAt` differently, using the axis marker, not this function inventing a third state).
- [ ] **Step 6: Implement.** `fallbackShare = events.length === 0 ? 0 : events.filter(e => e.attributedByFallback).length / events.length`.
- [ ] **Step 7: `taskEventsChartCaption` test + implement.** `taskEventsChartCaption('2026-08-13')` → `` `at least — some closures (bulk edits before 2026-08-13, born-done tasks, unlogged writes) are not counted.` `` (adjust the literal date to whatever Task 1 actually landed on); `taskEventsChartCaption(null)` → the same sentence with the bulk-edits clause dropped entirely (nobody has any legacy bulk rows to caveat) rather than printing a `null`-shaped date — write out the exact fallback sentence you choose and pin it in the test.
- [ ] **Step 8: Run everything, commit:** `feat: task-completion event shaping from activity_log, no signal rule (C-3)`

### Task 4: `allocation-history.ts` — churn count and signal

**Files:** Modify `src/features/people/allocation-history.ts`, `src/features/people/allocation-history.test.ts`

**Interfaces:**
```ts
/** Verbatim text of the note migration 0015 writes on every backfilled row
 *  (see drizzle/0015_assignment_history.sql). The spec's original plan to
 *  exclude backfill rows by a single shared `effectiveFrom` "backfill
 *  instant" does not match the real migration: effectiveFrom is
 *  GREATEST(user.createdAt, app.createdAt) PER ROW, which differs across a
 *  person's apps whenever an app was created after they joined — so there
 *  is no one instant to filter on. The note text is the actual invariant
 *  the migration guarantees, so it is what this filters on instead. */
export const ALLOCATION_HISTORY_BACKFILL_NOTE =
  "Backfilled from the live assignment when allocation history was introduced. " +
  "effective_from is the earliest date the pairing was possible (later of the " +
  "person's and the app's creation), and the actor is inferred, not recorded."

export const CHURN_WINDOW_DAYS = 30
export const CHURN_FIRE_THRESHOLD = 3

export type ChurnWindow = {
  count: number
  windowDays: number
  fired: boolean
}

export function countAllocationChanges(entries: TimelineEntry[], now: Date): ChurnWindow
```

Read first: spec section "Allocation trend (shipped) + churn" and re-read `drizzle/0015_assignment_history.sql`'s `INSERT` (already open in your context if you're following this plan in order — the `effective_from` expression is `GREATEST(u."created_at", ap."created_at") AT TIME ZONE 'UTC'`, and the fixed `note` string is the SELECT's last literal).

- [ ] **Step 1: Write the failing tests first.** Role-text-only `'updated'` entries (same `appId`, `allocationPct === previousPct`, `role !== previousRole`) are excluded from the count. A `'updated'` entry where the *percentage* changed (role may or may not) IS counted. `'assigned'` and `'removed'` entries are always counted (a removal is a real act). Entries sharing one `effectiveFrom` instant across different apps collapse into exactly ONE event (mirror `allocationTotalSeries`'s existing instant-collapsing precedent). **The corrected backfill fixture**: build entries for a person with 2 apps, one created well before the person joined and one created shortly after — i.e. `effectiveFrom` differs between the two backfilled rows — both carrying `note: ALLOCATION_HISTORY_BACKFILL_NOTE`; assert `countAllocationChanges` returns `{ count: 0, fired: false }` regardless of the differing timestamps (this is the case the spec's original "one shared instant" premise would have gotten wrong). A non-backfill entry with an unrelated, human-written `note` is counted normally. Threshold edges: exactly `CHURN_FIRE_THRESHOLD` events inside `CHURN_WINDOW_DAYS` of `now` fires; `CHURN_FIRE_THRESHOLD - 1` does not; an event exactly `CHURN_WINDOW_DAYS` old is inside the window (inclusive), one day older is not.
- [ ] **Step 2: Implement `countAllocationChanges`.** Filter `entries` to drop role-text-only updates and backfill-note rows; collapse the remainder by `effectiveFrom.getTime()` into distinct instants; count the instants whose `effectiveFrom` falls within `[now - CHURN_WINDOW_DAYS days, now]`; `fired = count >= CHURN_FIRE_THRESHOLD`.
- [ ] **Step 3: Run + commit.** `npx vitest run src/features/people/allocation-history.test.ts`. **Commit:** `feat: allocation churn count with corrected backfill exclusion (C-4)`

### Task 5: `work-history.ts` — merged 60-day ledger

**Files:** Create `src/features/people/work-history.ts`, `src/features/people/work-history.test.ts`

**Interfaces:**
```ts
export const WORK_HISTORY_WINDOW_DAYS = 60

export type WorkHistoryEventType = 'allocation' | 'meeting' | 'task' | 'followup'

export type WorkHistoryEvent = {
  type: WorkHistoryEventType
  id: string
  atMs: number          // epoch ms — the pure module never sees a naive-vs-tz distinction, only instants
  text: string           // fully humanized, e.g. "Sprint planning · 1.5h · invited, did not decline"
}

export type WorkHistoryDay = { dayIso: string; events: WorkHistoryEvent[] }

export type WorkHistoryAllocationInput = TimelineEntry   // reused as-is from allocation-history.ts

export type WorkHistoryMeetingInput = {
  id: string
  title: string
  startsAtMs: number
  endsAtMs: number
  response: 'pending' | 'going' | 'maybe' | 'declined'
}

export type WorkHistoryTaskInput = {
  id: string                 // activity_log row id (or a synthetic `${parentId}:${taskId}` for a fanned-out bulk row — must stay unique for React keys)
  taskId: string
  taskTitle: string
  verb: 'created' | 'moved' | 'completed' | 'reopened'
  createdAtMs: number
  actorId: string
  actorName: string
  assigneeId: string | null   // null only when unattributable — such rows render with no owner clause, never silently mis-owned
  assigneeName: string | null
}

export type WorkHistoryFollowupInput = {
  id: string
  text: string
  kind: 'question' | 'action'
  status: 'open' | 'resolved' | 'deferred'
  meetingTitle: string
  /** Opened entries date by the SOURCE MEETING's start; resolved entries by resolvedAt. Caller picks the right one and hands it here — this module does not know which field means what. */
  atMs: number
  isResolved: boolean
}

export function mergeWorkHistory(input: {
  allocation: WorkHistoryAllocationInput[]
  meetings: WorkHistoryMeetingInput[]
  tasks: WorkHistoryTaskInput[]
  followups: WorkHistoryFollowupInput[]
  windowStartMs: number
  nowMs: number
}): WorkHistoryDay[]
```

Read first: spec section "Work-history surface" in full.

- [ ] **Step 1: Write the failing tests first.** Deterministic day grouping via `isoDayOf`, not `toISOString().slice(0,10)` (a fixture near a Colombo day boundary — e.g. `20:31 UTC`, which is already the next Colombo day — must group correctly; a naive UTC-slice implementation would put it on the wrong day, exactly the bug `iso-day.ts`'s header describes the activity graph having shipped with once). Newest-first day ordering, and within a day: fixed type precedence + timestamp + id as the tiebreak (pin an exact ordering with same-instant fixtures from different types so the sort is provably deterministic, not "whatever the JS engine's sort stability happens to do"). A `'removed'` allocation entry renders as a removal sentence, never as "0% → 0%" or any percentage-update phrasing (reuse `describeAllocationChange` from `allocation-history.ts` for the text — do not reimplement its branching here). A meeting entry never says "attended" — assert the literal substring `'attended'` is absent from every generated meeting event's `text` across the whole fixture set; the phrase must be a form of "invited, did not decline" (going/maybe/pending) or "declined". A task entry where `actorId !== assigneeId` includes "closed by `<actor name>`"; where they're equal, it doesn't. A followup opened entry uses the source-meeting-start instant; a resolved entry uses `resolvedAt` and its text notes resolution is stamped at the next analyzed meeting. Every input row outside `[windowStartMs, nowMs]` is dropped (60-day truncation, tested at both edges). Empty input on all four arrays returns `[]`.
- [ ] **Step 2: Implement.** Map each of the four input arrays into `WorkHistoryEvent[]` (four small internal mappers, each producing the exact humanized text the tests pin), concatenate, filter to the window, group by `isoDayOf(new Date(atMs))`, sort days newest-first and events within a day by the tested tiebreak, drop empty days.
- [ ] **Step 3: Run + commit.** `npx vitest run src/features/people/work-history.test.ts`. **Commit:** `feat: pure work-history ledger merge across allocation, meeting, task and follow-up events (C-5)`

### Task 6: Bounded queries — `getPersonMeetingHours`, `getPersonTaskEvents`, `getPersonWorkHistory`

**Files:** Modify `src/features/people/queries.ts`

**Interfaces:**
```ts
export async function getPersonMeetingHours(userId: string): Promise<ObservedLoadSummary>
export async function getPersonTaskEvents(userId: string): Promise<TaskEventsSummary>
export async function getPersonWorkHistory(userId: string): Promise<WorkHistoryDay[]>
```
(Note on naming: the spec's design doc calls the third one `getPersonWorkHistoryInputs` — this plan names it `getPersonWorkHistory` and has it call `mergeWorkHistory` internally before returning, mirroring the file's own existing convention exactly — see `getPersonAllocationHistory`'s doc comment: "ONE query, two pure derivations — the shaping lives in allocation-history.ts". Keep that symmetry; do not return raw un-merged rows to the page.)

Read first: `getPersonActivity` (immediately above where you'll add these, in the same file) for the exact naive-timestamp-as-UTC + `LK_TZ_SQL` idiom to copy, and `getPersonAllocationHistory`/`getPersonWorkload` for the "one function, a couple of internal queries, pure derivation before returning" shape.

- [ ] **Step 1: `getPersonMeetingHours`.** Two internal reads in `Promise.all`: (a) weekly hours — `SUM(extract(epoch from (liveMeetings.endsAt - liveMeetings.startsAt)) / 3600.0)` grouped by `to_char(date_trunc('week', (liveMeetings.startsAt at time zone 'UTC') at time zone ${LK_TZ_SQL}), 'YYYY-MM-DD')`, `FROM meetingAttendees JOIN liveMeetings ON meetingAttendees.meetingId = liveMeetings.id WHERE meetingAttendees.userId = $userId AND meetingAttendees.response != 'declined' AND liveMeetings.startsAt >= <13-week-back UTC lower bound, loose by a day like getPersonActivity's `since`>` — mirror `meeting-window.ts`'s "did not decline" convention exactly (`response != 'declined'`, pending counts); (b) declined count — same join, `response = 'declined' AND startsAt >= <4-week-back bound>`; (c) `users.createdAt` for this `userId` (a trivial third read, or fold into (a)/(b) via a join if you prefer — either is fine, just don't make it sequential-blocking on the other two). Call `buildObservedLoadSummary` with all three and return its result directly.
- [ ] **Step 2: `getPersonTaskEvents`.** Reads: (a) direct rows — `activityLog` where `entityType = 'task' AND verb IN ('completed','reopened')`, left-joined to `liveTasks` on `entityId` for the current-assignee fallback, filtered to rows attributable to `userId` (either `metadata->>'assigneeId' = userId` OR (`metadata->>'assigneeId'` is null/absent AND `liveTasks.assigneeId = userId`)), bounded to the trailing `TASK_EVENT_WINDOW_WEEKS + 1` weeks; (b) legacy bulk-done rows — `activityLog` where `entityType = 'task' AND verb = 'updated' AND metadata->'patch'->>'status' = 'done'`, same date bound, **fetched without a person filter in SQL** (there are at most a handful of these ever, company-wide, at this scale — filtering happens after expansion, in JS, once you know which fanned-out taskId belongs to which person); for these, batch-fetch `currentAssigneeByTaskId` via one `liveTasks WHERE id IN (<every id in every row's metadata.taskIds, deduped>)` lookup — batch the read, never loop per id. (c) `historyBeginsAt` — the same two-source filter as (a)+(b) but with NO date lower bound, reduced to `MIN(createdAt)` (two small aggregate queries, take the earlier of the two in JS; at 9-person scale this is cheap even unbounded). Feed everything through `expandTaskEvents` (filtering the bulk-expanded events to this person's `userId` post-expansion) then `buildTaskEventsSummary`.
- [ ] **Step 3: `getPersonWorkHistory`.** Four bounded, 60-day reads, each independent (no dependency on the other five person-page queries — this function re-reads its own slice, matching this file's existing precedent of `getCapacityHistoryOverview` and `getPersonAllocationHistory` independently re-querying overlapping `assignmentHistory` data rather than threading results between functions): (a) `assignmentHistory` for `userId`, `effectiveFrom >= windowStart`, same shape as `getPersonAllocationHistory`'s existing select, run through `buildAllocationTimeline` for the humanized `TimelineEntry[]`; (b) `meetingAttendees JOIN liveMeetings`, `userId = $userId AND startsAt >= windowStart AND startsAt <= now`; (c) task activity — broader than Task 6 Step 2's set: `verb IN ('created','moved','completed','reopened')` (not just completion verbs) attributed to this person the same way, `createdAt >= windowStart`, joined to `liveTasks`/`users` for `taskTitle`/`actorName`/`assigneeName`; (d) `meetingFollowups` opened-or-resolved touching this person (`userId = $userId OR createdBy = $userId`) with `sourceMeetingId`'s `startsAt` (for opened dating) or `resolvedAt` (for resolved dating) inside the window. Map each into the shapes `mergeWorkHistory` expects and call it with `windowStartMs`/`nowMs`.
- [ ] **Step 4: Typecheck + run.** `npx tsc --noEmit`, `npx vitest run src/features/people`. Also run `npx vitest run src/db/live.test.ts` right now, before writing any component — every new read above must already satisfy the six checks (join `liveMeetings`/`liveTasks` correctly) or this will fail loudly and tell you exactly which statement is wrong. **Commit:** `feat: bounded queries for observed load, task events and the work-history ledger (C-6)`

### Task 7: `person-stats.ts` extension + shared `WeeklyBars` chart

**Files:**
- Modify: `src/features/people/person-stats.ts`, `src/features/people/person-stats.test.ts`
- Modify: `src/features/people/components/person-stat-row.tsx` (grid: `xl:grid-cols-7` → `xl:grid-cols-8`)
- Create: `src/features/people/components/weekly-bars.tsx` (no test file — presentational, house style leaves components untested; see `allocation-trend.tsx`/`capacity-bar.tsx` for precedent)

**Interfaces:**
```ts
// person-stats.ts — PersonStatsInput gains one field:
export type PersonStatsInput = {
  // ...existing fields unchanged...
  meetingHoursThisWeek: number
}
// buildPersonStats(input) now returns 8 PersonStat entries; the new one:
// { key: 'meeting-hours', label: 'Meeting hrs · this wk', value: input.meetingHoursThisWeek,
//   meta: 'so far · scheduled, not declined', tone: 'normal' }   // tone is ALWAYS 'normal' — see below

// weekly-bars.tsx
export function WeeklyBars(props: {
  weeks: { weekStart: string; value: number; partial?: boolean; holiday?: boolean; belowHistoryStart?: boolean }[]
  /** Whole sentences, rendered as wrapped <text> INSIDE the <svg> viewBox — see Global Constraints §9. */
  captionLines: string[]
  ariaLabel: string
  valueSuffix?: string        // 'h' for hours, '' for a plain completion count
}): JSX.Element
```

Read first: `allocation-trend.tsx` in full (the `600×120` viewBox, `vector-effect="non-scaling-stroke"`, `role="img"` + full-sentence `aria-label`, server-safe-no-client-APIs conventions this must match) and spec's Global Constraints §9 (SVG-baked captions) above.

- [ ] **Step 1: `buildPersonStats` test first.** The new 8th stat's `tone` is `'normal'` under every input, including a high `meetingHoursThisWeek` value that would (elsewhere) fire the rising-load signal — **this tile never turns amber or red, ever**; assert this with a deliberately extreme value (e.g. 60) to make the "always normal" guarantee unmistakable in the test, not just an accidental pass. `meta` always contains the literal words `'so far'` and `'scheduled, not declined'` (label-truth, matching the existing `meetings` tile's own precedent one entry above it).
- [ ] **Step 2: Implement** the new stat entry in `buildPersonStats`, appended after the existing `'followups'` entry (or wherever reads naturally — order is a UI call, not a contract, but keep the array length at 8 and don't reorder the existing 7 keys, since nothing else in the codebase should have to change to accommodate this).
- [ ] **Step 3: Bump `PersonStatRow`'s grid** from `xl:grid-cols-7` to `xl:grid-cols-8`. No test exists for this file (presentational); a manual `npm run dev` check that 8 tiles wrap sanely at common widths is enough — note in your report that you eyeballed it.
- [ ] **Step 4: Build `WeeklyBars`.** Bars (not the step-line `AllocationTrend` uses — a discrete weekly count wants discrete columns), `viewBox="0 0 600 160"` (taller than `AllocationTrend`'s 120 to leave room for the baked-in caption text at the bottom), `vector-effect="non-scaling-stroke"` on any stroke, `role="img"` with a **complete sentence** `aria-label` naming the current value, the peak, and the window size (mirror `AllocationTrend`'s aria-label style exactly). A `partial` bar renders with a diagonal hatch fill (an SVG `<pattern>`, defined once in a `<defs>`) AND the word "so far" as a small `<text>` label beneath just that bar — color/hatch alone never carries the meaning (WCAG 1.4.1, same rule `CapacityBar`'s header comment states and this file must honor identically). A `holiday` bar gets a small marker glyph above it AND the word "holiday" in its own tooltip-free inline `<text>` (no hover-only content — this renders server-side with no JS, so nothing can be hover-only). A `belowHistoryStart` bar (task-events chart only) renders as an empty/greyed column with "no events yet" text, visually distinct from a real zero-value bar. `captionLines` render as one or more `<text>` elements positioned inside the chart area at a small `font-size`, wrapped manually across lines (compute wrap points in JS against a rough character-width budget for `VIEW_W`, same class of problem `AllocationTrend` doesn't have to solve because its caption is short — do not skip wrapping and let long lines overflow the viewBox).
- [ ] **Step 5: Run + commit.** `npx vitest run src/features/people/person-stats.test.ts`, `npx tsc --noEmit`. **Commit:** `feat: eighth person-stat tile and a shared weekly-bars chart with baked-in captions (C-7)`

### Task 8: `ObservedLoadCard` and `PersonWorkHistoryCard`

**Files:** Create `src/features/people/components/observed-load-card.tsx`, `src/features/people/components/person-work-history-card.tsx`

**Interfaces:**
```ts
export function ObservedLoadCard(props: {
  totalPct: number
  observedLoad: ObservedLoadSummary
  taskEvents: TaskEventsSummary | null   // null when the viewer is not privileged — see below
  churn: ChurnWindow
  canSeeLongitudinal: boolean
}): JSX.Element

export function PersonWorkHistoryCard(props: {
  days: WorkHistoryDay[]                 // [] when the viewer is not privileged, or genuinely no events
  canSeeLongitudinal: boolean
}): JSX.Element
```

Read first: spec sections "Observed-load surface" and "Work-history surface" in full. Both are server components — no `'use client'`, no interactive state beyond native `<details>` (precedent: `person-tasks-card.tsx`).

- [ ] **Step 1: `ObservedLoadCard` — the always-public strips.** Header sentence, verbatim: "Observed load — what the calendar and board can see. Not worked hours: leave, ad-hoc calls, and off-tool work are invisible to it." A permanent audience footer stating, per strip, exactly who sees it (see Step 3). Strip 1, DECLARED SHARE: reuse `CapacityBar` + `totalPct`, label "declared share of capacity — a statement, not a measurement" — visible to everyone, no gating. Strip 2, SCHEDULED MEETING HOURS: for everyone, `observedLoad.thisWeekHours` as "This week so far: N.Nh" plus "Declined `observedLoad.declinedCount` invites (4w) — capacity protected" at equal visual prominence (same font size/weight as the hours figure — this is a deliberate design requirement, not a suggestion: declining must never read as the lesser or apologetic number on the strip). Strip 3, TASK FLOW: for everyone, note that the created/week contribution graph itself lives unchanged on `PersonActivityCard` below and is not duplicated here — this strip, for a non-privileged viewer, renders nothing beyond that pointer sentence.
- [ ] **Step 2: `ObservedLoadCard` — the gated strips.** When `canSeeLongitudinal`: under Strip 2, render `<WeeklyBars weeks={observedLoad.weeks...} captionLines={[MEETING_HOURS_CHART_CAPTION]} ... valueSuffix="h" />`; if `observedLoad.signal.fired`, a plain sentence under this strip: `` `Meeting hours have run above the 12-week norm for the last ${observedLoad.signal.weeksSustained} weeks.` `` immediately followed, always, by the standing disclaimer "LogPup has no leave records — discuss before concluding anything." If `observedLoad.signal.suppressed`, render nothing (not even the "not enough data" case — the spec calls this a neutral, non-alarming state; a worded "not enough history yet to judge" line here is acceptable if you want one, but never a blank alarming silence and never a colored indicator). Under Strip 1 (not Strip 3 — churn is about the *declaration*, not the calendar), if `churn.fired`: `` `Declared allocation changed ${churn.count} times in the last 30 days.` `` plus the same standing disclaimer. Under Strip 3, when `taskEvents` is non-null: `<WeeklyBars weeks={taskEvents.weeks...} captionLines={[taskEventsChartCaption(taskEvents.historyBeginsAt ? isoDayOf(taskEvents.historyBeginsAt) : null)]} ... />`, with weeks before `taskEvents.historyBeginsAt` passed to `WeeklyBars` with `belowHistoryStart: true` rather than as zeros.
- [ ] **Step 3: Audience footer, worded exactly per strip.** "Declared share: visible to everyone. This week's hours and declined count: visible to everyone. The 12-week trend, task-flow bars and both signal sentences: visible to you and admins." (Adjust wording to taste, but every clause above must be present in some form — this is the "permanent audience footer" the spec requires on every new card, and it must be TEXT, not a tooltip or icon-only affordance.)
- [ ] **Step 4: `PersonWorkHistoryCard`.** Header: "Everything LogPup recorded in the last 60 days. Work LogPup never saw — untracked meetings, off-tool work, leave — is not here." Footer: "Visible to: you and admins." (spec's exact phrase). When `!canSeeLongitudinal`, the card renders NOTHING beyond a short explanatory line ("This section is visible to the person themself and admins.") — do not render an empty-looking card that reads as "there's nothing here" (that's a lie, not an empty state) versus "you can't see this" (the truth). When `canSeeLongitudinal && days.length === 0`, use `SectionEmpty` (existing precedent) with a hint distinguishing "genuinely nothing in 60 days" from the not-visible case above. Otherwise: render each `WorkHistoryDay` as a dated section, events inside as a list, per-entry an icon (from `lucide-react`, following `person-followups-card.tsx`'s `role="img"` + `aria-label` precedent — color/icon never alone) PLUS the event type named in words (never icon-only). First ~15 entries total (across all days, oldest-cut) visible; the remainder inside a native `<details>` (exact `person-tasks-card.tsx` "Show N more" pattern — copy its markup/class names for visual consistency, don't invent a new disclosure style).
- [ ] **Step 5: Run.** `npx tsc --noEmit` (components are untested by house convention, but must still typecheck cleanly against the Task 6/7 exports). **Commit:** `feat: observed-load and work-history cards, gated to self and admins (C-8)`

### Task 9: Page mount — viewer gating, eight-read Promise.all, layout

**Files:** Modify `src/app/(app)/people/[id]/page.tsx`

- [ ] **Step 1: Add the page's first viewer check.** Import `getSession` from `@/lib/session` (the cached wrapper — see its own header comment on why to prefer it over calling `auth()` directly in anything that renders). Await it BEFORE the existing `Promise.all` (it's cheap — the `(app)` layout has already paid for the underlying `auth()` call this request, and `getSession`'s `React.cache` wrapper deduplicates it). Compute `const viewerId = session?.user?.id; const isAdmin = session?.user?.role === 'admin'; const canSeeLongitudinal = Boolean(viewerId && (isAdmin || viewerId === userId))`.
- [ ] **Step 2: Widen the `Promise.all`** from six reads to eight: add `getPersonMeetingHours(userId)` (always — it feeds the public "this week so far" tile and stat row) and, gated, `canSeeLongitudinal ? getPersonTaskEvents(userId) : Promise.resolve(null)` and `canSeeLongitudinal ? getPersonWorkHistory(userId) : Promise.resolve([])` — this is a genuine "gated content never reaches the wire" measure (the query itself never runs for a non-privileged viewer, not merely "runs but isn't rendered"), and it also saves two real database round trips on the common (colleague-viewing) path. Update the block comment from "SIX READS, ALL IN PARALLEL" to name the real new count (eight function calls; two of them may resolve trivially) and explain the gating in one sentence, matching the file's existing comment density.
- [ ] **Step 3: Compute churn** via `countAllocationChanges(history.timeline, new Date())` — no new query, per spec ("Zero new queries").
- [ ] **Step 4: Extend `buildPersonStats`'s call** with `meetingHoursThisWeek: observedLoad.thisWeekHours` (the SAME object the card below renders from — this is the anti-drift contract the spec names explicitly; do not compute a second, separately-derived "this week" figure anywhere).
- [ ] **Step 5: Mount both new cards.** `ObservedLoadCard` goes ABOVE `PersonActivityCard` (per spec: "mounted above PersonActivityCard"), full-width (`lg:col-span-2`), passing `taskEvents` (may be `null`) and `churn` and `canSeeLongitudinal` straight through. `PersonWorkHistoryCard` goes in its OWN `lg:col-span-2` slot directly below `AllocationHistoryCard` (per spec — the untouched card stays exactly where it is; the ledger is new, added after it, not interleaved).
- [ ] **Step 6: Verify layout order reads sensibly top-to-bottom** on mobile (single column: DOM order is display order, same reasoning the page's existing comment already states for the grid) — Assignments → Tasks → Follow-ups → Meetings → **Observed load** → Activity graph → Allocation history → **Work history**. If you think a different placement reads better, that's a legitimate call to make and note in your report, but the two new cards must land in their spec-named relative positions (above PersonActivityCard; below AllocationHistoryCard) at minimum.
- [ ] **Step 7: Run + commit.** `npx vitest run`, `npx tsc --noEmit`, `npx vitest run src/db/live.test.ts`. **Commit:** `feat: mount observed-load and work-history on the person page with self+admin gating (C-9)`

### Task 10: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full suite.** `npx vitest run` — every new pure-module test green, nothing pre-existing newly broken.
- [ ] **Step 2: Live-query discipline.** `npx vitest run src/db/live.test.ts` — all six checks pass, and confirm by eye that the `ALLOWLIST` in `src/db/live.test.ts` has not grown (grep the diff of that file — it should be untouched by this plan entirely).
- [ ] **Step 3: Typecheck.** `npx tsc --noEmit` — count errors, compare to the known baseline of 7; report the exact count and, if it differs, which lines are new versus pre-existing.
- [ ] **Step 4: Lint.** `npm run lint` — compare the problem count to the known baseline of 12; same reporting standard.
- [ ] **Step 5: Build.** `npx next build` — must succeed (this also re-runs `scripts/generate-changelog.mjs` via `prebuild`, which is how your commit messages become the changelog — nothing to do here beyond letting it run).
- [ ] **Step 6: Manual spot-check** (no e2e harness change is in scope for this plan — the spec's test plan is explicitly "Vitest, pure modules only... queries stay thin and untested; components presentational", so there is no Task 11 e2e task by design). In `npm run dev`, open a person page as: (a) that person themself — confirm the 12-week chart, completions bars, and 60-day ledger render, with both signal sentences present if and only if their underlying condition is met; (b) an admin viewing someone else — same surfaces render; (c) an ordinary member viewing a colleague — confirm NONE of the gated surfaces render (network tab: the page's RSC payload should not contain the 12-week series or ledger text at all — search the raw HTML for a phrase from `MEETING_HOURS_CHART_CAPTION`; it must not appear for viewer (c)). Report all three checks honestly, including any that fail.
- [ ] **Step 7: Report.** Summarize pass/fail per step above; do not weaken an assertion or skip a check to make the report look cleaner.

## Open questions for the human

1. **`WeeklyBars`' generic width/tick density** was left to the implementer's judgment (12 weekly bars at 600px vs. `AllocationTrend`'s continuous line) rather than pinned exactly, since the spec describes the surfaces in prose, not pixels — flag if a specific visual spec exists elsewhere that this plan should have followed instead.
2. **The `PersonWorkHistoryCard` non-privileged message** ("This section is visible to the person themself and admins.") is this plan's own wording, not a literal quote from the spec — the spec states the card doesn't render for other members but doesn't specify what, if anything, should appear in its place; veto or approve before Task 8 if you'd rather it render nothing at all.
3. **`TASK_EVENT_ATTRIBUTION_SNAPSHOT_SINCE`** is deliberately left as a fill-in-after-Task-1 constant rather than a guessed date, since this plan is written before Task 1 is implemented and the real merge date isn't known yet — confirm that's acceptable rather than wanting a provisional placeholder date reserved now.
