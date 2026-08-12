# Meeting Load Reduction (B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce total meeting load org-wide: honest invited-hours metrics, per-series drift and output analysis, and an advisory suggestion engine (merge / shorten / cancel-review / trim) a human applies. Nothing in B ever mutates a meeting, an `endsAt`, or `meeting_attendees` — every suggestion is a read-only observation plus a deep link into a flow the organizer already owns.

**Architecture:** A dozen small pure modules (math, grouping, and the suggestion engine itself) each with a sibling `.test.ts`, computed **live at render** from the same numbers the metric surfaces show — no cron, no stored suggestion queue, no on-visit generator. Persistence is exactly one table: `meeting_load_decisions`, which only ever holds `accepted`/`dismissed` rows (`'open'` is never stored — it's whatever the live engine produces minus whatever's in that table). Two query modules enforce visibility by TYPE SHAPE: `queries.ts` exports org-facing types that cannot structurally hold a `userId`, and `admin-queries.ts` exports named rows behind two gated call sites (the `/admin` page and the organizer-scoped card on `/meetings`).

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle + Neon Postgres (NO transactions — `db.batch` only), Tailwind v4 + shadcn (Base UI), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-12-meeting-load-reduction-design.md`. It is long and authoritative — each task below names the spec sections to read before coding. Where this plan and the spec disagree, the spec wins for *intent*; where the spec's file paths, line numbers or filenames are stale against the current tree (several are — see "Grounding corrections" below), this plan's paths win and you should say so in your report.

**Suite position:** D (soft deletes) → A1 (attendee recommender) → **B (this plan)** → C (people KPIs). B reads two things A1 owns: the shared `seriesKey`/`sameSeries` normaliser (`src/features/meetings/attendee-series.ts`) and A1's schema (`meeting_attendee_recommendations`, `meeting_attendees.optional`).

**Branch:** `feat/meeting-load-reduction`, worktree `/Users/deeghayuadhikari/Documents/GitHub/LogPup-sdd-b`, stacked on `feat/attendee-recommender` (worktree `/Users/deeghayuadhikari/Documents/GitHub/LogPup-sdd-a`) at its current head.

**Is B blocked on A1?** No, at the code level. Verified directly against the A1 worktree: A1's Task 1 (commit `5ad5fa6`) already landed migration `0026_attendee_recommendations.sql`, which contains the **entire** schema footprint B reads — `meeting_attendee_recommendations` (with `hardEvidenceCount`), `meeting_attendees.optional`, and the `meeting_note_segments` index B's participation metric needs. A1's remaining tasks (5–9: Gemini validator, orchestrator/actions, scheduling UI, other surfaces, e2e) touch none of B's files and add no further migrations. Until those land, `meeting_attendee_recommendations` simply has zero rows and every `meeting_attendees.optional` is `false` — which is not an error state, it is the exact "data-present, not migration-landed" gate the spec asks for (Assumptions, "Trim-invite activates per-series..."): R5 (Task 9) is written to naturally emit nothing until real evidence rows exist, and the required/optional hours split (Tier-1 metric, "Post-A" note) naturally reads as 100% required until then. **No task in this plan is blocked; two behaviors (R5 firing, the optional/required split) are gated on A1 data richness by design, not by build order.**

## Grounding corrections (read before Task 1)

The spec was written against an earlier state of the tree. Three corrections, verified directly against the current `feat/attendee-recommender` worktree, that change *where* work in this plan lands (not *what* it does):

1. **Series normaliser filename.** The spec's "Section 15"/metrics text says `src/features/meetings/series-key.ts`. The actual file A1 built is `src/features/meetings/attendee-series.ts`, exporting `seriesKey(title: string): string | null` and `sameSeries(a, b): boolean`. Import from there. Its own doc comment is explicit that it does NOT implement the establishment window or the 2+/6-occurrence/180-day threshold — "The window ... and the established/2+ threshold live with the caller, not here." So Task 2 below (`series-groups.ts`) is new work this plan must do; it is not a re-implementation of anything A1 already tested (its sibling `attendee-series.test.ts` covers only string normalisation, confirmed by reading it — no establishment-window tests exist there).
2. **Migration number.** `drizzle/` in the A1 worktree tops out at `0026_attendee_recommendations.sql` with nothing further planned in A1's remaining tasks. **B's migration is `0027`.** Re-verify `ls drizzle/` before Task 1 in case something landed in the meantime.
3. **Dashboard layout.** The spec's dashboard placement ("existing Promise.all lines 21-30", "appended... under UpcomingMeetings, grid lines 50-56") describes a layout that has since been replaced by a "My day / Team / Portfolio" redesign (`src/app/(app)/page.tsx`, current `Promise.all` at lines 69-95, three zones at lines 142-189). There is no `UpcomingMeetings` component anymore. Task 14 places `MeetingLoadCard` in the **Team** zone (alongside `CapacityHeat`/`ActiveSprints`, lines 170-173) rather than a personal "my meetings" column — the metric is org-wide, not personal, so Team is the more honest zone despite the spec's original placement intent.

Also worth knowing before Task 12: `meeting_attendee_recommendations` is **not yet** registered in `src/db/live.ts`'s `MEETING_CHILD_TABLES` or in `live.test.ts`'s `CHILD_TABLE_NAMES` regex — a gap in A1, not B's to fix, but it means the automated check-3 scan will **not** catch a raw, unjoined read of that table from B's code. Join `liveMeetings` on it by hand anyway; do not rely on the static check here.

## Global Constraints

- **Soft deletes are live.** Every read of `meetings`/`tasks`/`sprints`/`meeting_note_segments`/`meeting_screenshots` MUST go through the `live*` subqueries in `src/db/live.ts`. `src/db/live.test.ts` enforces this with six checks and WILL fail the build otherwise: raw `.from()`/join of a soft table (check 1), `alias()` of a soft table (check 2), reading a meeting child table (`meetingAttendees`, `meetingAiNotes`, `meetingFollowups`, `meetingSpeakers`, `meetingTaskSuggestions`, `meetingRecordingSegments`) without also referencing `liveMeetings` in the same file (check 3), `db.delete(...)` outside sanctioned sites (check 4), every schema table with `deletedAt` registered in `SOFT_TABLES` (check 5), and the backlog `isNull(...sprintId)` predicate confined to `backlog.ts` (check 6). Its `ALLOWLIST` (for checks 1–3) asserts every entry's file exists — **never add yourself to it.** That allowlist is a different mechanism from `DELETE_ALLOWED_FUNCTIONS` (check 4): the latter is the SANCTIONED way to register one new, genuinely-hard-deleting function (see `people/actions.ts: removeAssignment` for precedent) — Task 13 adds one entry there, in the same commit that writes the function, with a `// why` comment, because `meeting_load_decisions` deliberately has no `deletedAt` column and `reopenLoadDecision` is a real `db.delete(...)`.
- **Migration discipline.** Number after the highest existing — `0027` per the grounding correction above (re-check `drizzle/` first). Register in `drizzle/meta/_journal.json` with a `when` **strictly greater than the newest `created_at` already in `drizzle.__drizzle_migrations`**, or `db:migrate` silently skips it. Put the drizzle `--> statement-breakpoint` marker between EVERY statement, and NEVER write that marker inside a comment — the splitter is a plain string split and truncates the file there. `npm run db:migrate` has been observed exiting silently without applying; verify against `information_schema` afterwards and apply via drizzle `sql.raw` if it no-ops.
- **neon-http has NO transactions** — `db.batch` only.
- Server Actions return `ActionResult` (`src/lib/action-result.ts`: `{ok:true,data}` / `{ok:false,error}`); errors are plain human sentences. Reads live in `queries.ts`/`admin-queries.ts`; mutations end in the existing revalidate helpers, including `revalidateAdmin()` (`src/lib/revalidate-admin.ts`) where an admin surface changes.
- Pure logic in its own module with a sibling `.test.ts`; no DB access inside a pure module. House precedent for the mocked-action test idiom: `src/features/admin/set-user-title.test.ts` (`vi.mock('@/lib/auth', ...)`, a `writeSpy`, asserting the guard AND that nothing was written).
- Known pre-existing failures to leave alone: 7 tsc errors (next-themes/`LayoutProps` environmental, plus 2 `selectCarriedForward` TS2554 that are the user's in-flight work on another branch), `npm run lint` baseline 12 problems, the `smoke.spec.ts` drag test.
- **NEVER `git stash`** — the stash is shared across worktrees and an agent already destroyed a colleague's work that way.
- Read `node_modules/next/dist/docs/` before touching Server Actions, routing or revalidation (AGENTS.md) — this Next.js is not the one your training data knows.

### Design constraints carried from the spec (non-negotiable — do not soften)

- **"Invited hours," never "attendee-hours," never framed as attendance.** `.ics` invites go out with `RSVP=TRUE` (verified: `src/features/meetings/ics.ts:216-218`, "PARTSTAT=NEEDS-ACTION" / "RSVP=TRUE" on every attendee line) and external replies never write back, so `meeting_attendees.response` mostly stays `'pending'` forever — it measures widget adoption, not confirmation. Every surface that shows the headline number carries this or an equivalent honest sentence; the drill-down (`/meetings/load`) carries it verbatim in its header.
- **The RSVP "waste" metric is cut**, full stop. It survives only as a neutral in-app adoption nudge (Task 16) and is a banned input to every rule in `suggest.ts` — this is asserted with a structural test on the rule input type (Task 9), not just by review.
- **The cancel rule (R1) has a participation veto.** A series with zero AI-derived outputs but real discussion (median mapped speakers > 2, or median voice turns >= 10, across analyzed occurrences) must NEVER be proposed for cancellation. Zero-artifact does not mean zero-value; a talkative, unrecorded-of-decisions design crit is exactly the case this exists to protect.
- **Outputs are AI-derived vs manual, and every rule reads AI-derived only.** A single junk manual follow-up must never both immunise a series against R1 AND inflate A1's E1 evidence pool — the split is what makes that gaming path visible and excluded.
- **No per-organizer output cut, at any visibility level, ever** — not even admin. It is a people-ranking dossier wearing a meetings hat; leave the door structurally closed, don't just decline to build a UI for it (`admin-queries.ts` must have no function that groups outputs by organizer).
- **Accept is advisory only.** It writes one `meeting_load_decisions` row (decision + an evidence jsonb snapshot of the numbers on screen) and returns a deep link into a flow the organizer already owns (the meeting's own page for cancel/reschedule, the invite editor for trim). It NEVER touches `meetings`, `endsAt`, or `meeting_attendees` — no exceptions, no "just this once" one-click apply.
- **Suggestions are organizer-private + admin.** The org at large sees exactly one aggregate line on the dashboard ("2 suggestions with organizers, ~6h/week potential") — never a named series, never a verdict, anywhere outside the organizer's own view of their own series or `/admin`.
- **Series identity is the shared `seriesKey`/`sameSeries` from `src/features/meetings/attendee-series.ts` (A1).** Import it; never write a second normaliser. B's own `groupIntoSeries` (Task 2) adds only the establishment window and grouping key on top — it must call `seriesKey`/`sameSeries`, not reimplement string normalisation.

---

### Task 1: Schema — `meeting_load_decisions`

**Files:**
- Create: `drizzle/0027_meeting_load_decisions.sql`
- Modify: `src/db/schema.ts`, `src/features/admin/backup.ts`, `src/features/admin/actions.ts` (`clearTestData` enumeration)

**Interfaces:**
- Produces: `meetingLoadDecisions` table — `id` (uuid PK), `kind` (text, TS union `MeetingLoadDecisionKind = 'cancel_review' | 'shorten' | 'share_slot' | 'record_or_review' | 'trim_invite'`), `targetKey` (text), `status` (reuses `suggestionStatus`, **no default** — the app always sets `'accepted'`/`'dismissed'` explicitly, `'open'` is never written), `evidence` (jsonb, not null), `decidedBy` (uuid, FK `users` ON DELETE SET NULL), `createdAt` (timestamp, defaultNow); unique index on `(kind, targetKey)`.

Read first: spec section "Schema changes" (the exact DDL is given there — this task transcribes it, it does not redesign it).

- [ ] **Step 1: Re-verify the migration number.** `ls drizzle/` in the worktree — confirm it still tops out at `0026`. If not, adjust the filename/number below accordingly and note it in your report.
- [ ] **Step 2: Write `drizzle/0027_meeting_load_decisions.sql`** with breakpoint markers between every statement, mirroring `0026`'s guarded style (`IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object THEN null; END $$` for the FK):
  ```sql
  CREATE TABLE IF NOT EXISTS "meeting_load_decisions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"kind" text NOT NULL,
  	"target_key" text NOT NULL,
  	"status" "suggestion_status" NOT NULL,
  	"evidence" jsonb NOT NULL,
  	"decided_by" uuid,
  	"created_at" timestamp DEFAULT now() NOT NULL
  );
  --> statement-breakpoint
  DO $$ BEGIN
   ALTER TABLE "meeting_load_decisions" ADD CONSTRAINT "meeting_load_decisions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;--> statement-breakpoint
  CREATE UNIQUE INDEX IF NOT EXISTS "meeting_load_decisions_kind_target_key_idx" ON "meeting_load_decisions" USING btree ("kind","target_key");
  ```
  No FK onto `meetings` or A1's tables (spec: "series are derived, not rows") — this is deliberate, do not add one.
- [ ] **Step 3: Register in `drizzle/meta/_journal.json`.** Query `SELECT MAX(created_at) FROM drizzle.__drizzle_migrations;` first; pick a `when` strictly greater than that value (epoch ms), append `{ "idx": 27, "version": "7", "when": <value>, "tag": "0027_meeting_load_decisions", "breakpoints": true }`.
- [ ] **Step 4: Mirror in `src/db/schema.ts`.** Add the `MeetingLoadDecisionKind` union export and the `meetingLoadDecisions` pgTable, matching the SQL exactly (column names, nullability, the missing default on `status`) — a schema/SQL drift here is exactly the defect the soft-delete work hit once already.
- [ ] **Step 5: Add the new table to `backup.ts`'s enumeration and to `clearTestData`'s delete list** — both enumerate tables explicitly by name and will silently skip it otherwise.
- [ ] **Step 6: Apply and verify.** Run `npm run db:migrate`, then query `information_schema.tables`/`information_schema.columns` to confirm `meeting_load_decisions` exists with the right columns. If migrate no-ops, apply via drizzle `sql.raw` and say so in your report.
- [ ] **Step 7: Verify + commit.** `npx vitest run`, `npx tsc --noEmit`, `npx vitest run src/db/live.test.ts` (must stay green — this table isn't soft-deleted, isn't a meeting child table, and check 5 won't flag it since it has no `deletedAt`). Commit: `feat: meeting_load_decisions schema (B1)`

### Task 2: `series-groups.ts` — establishment window and grouping key

**Files:** Create `src/features/meeting-load/series-groups.ts`, `src/features/meeting-load/series-groups.test.ts`

**Interfaces:**
- Consumes: `seriesKey`, `sameSeries` from `@/features/meetings/attendee-series` (import only — never reimplement).
- Produces:
  ```ts
  export const ESTABLISHMENT_WINDOW_OCCURRENCES = 6
  export const ESTABLISHMENT_WINDOW_DAYS = 180
  export const ACTIVITY_GATE_DAYS = 45

  export interface SeriesOccurrenceInput {
    meetingId: string
    title: string
    appId: string | null
    startsAt: Date
    endsAt: Date
    createdBy: string
    inviteUserIds: string[] // ALL invited, unfiltered by response — churn and R3's Jaccard both want the raw invite set
  }

  export interface SeriesGroup {
    groupKey: string        // `${seriesKey}|${appId ?? '__none__'}`
    seriesKey: string
    appId: string | null
    mergeable: boolean      // appId !== null — a NULL-app series can never be an R3 candidate
    occurrences: SeriesOccurrenceInput[] // newest-first; windowed to <=6 items each within 180 days of `now`
    established: boolean    // occurrences.length >= 2
    activeRecently: boolean // occurrences[0].startsAt within the last 45 days of `now`
    organizerId: string     // occurrences[0].createdBy
  }

  export function groupIntoSeries(all: SeriesOccurrenceInput[], now: Date): SeriesGroup[]
  ```

Read first: spec "Per-series table" and "GATES (all rules)" in the Suggestion engine section.

- [ ] **Step 1: Write the failing tests first.** Cover: two occurrences of the same title/app 179 days apart establish (2 occurrences, both inside the window); the same pair 181 days apart do NOT (only the newer one is in-window, so `occurrences.length === 1`, `established === false`) — exact boundary at 180. A 7th occurrence within 180 days: the group keeps only the most recent 6, `occurrences.length === 6`. Two meetings with `appId: null` and the same normalised title land in the SAME group (`mergeable: false`) — the JS-Map-vs-SQL-NULL trap: grouping by the string key `'__none__'` must behave like JS equality (merge), not naive SQL `NULL != NULL` semantics (split). Two meetings with the same key but *different* non-null `appId` land in different groups and never merge. A title edit that changes the normalised key (e.g. "Vela Standup" -> "Vela Retro") forks identity: the old-titled occurrences and the new-titled ones form two separate groups, each judged on its own occurrence count — document this as the intended "title edit mints a new series" behavior, not a bug. `activeRecently`: newest occurrence 46 days before `now` -> false; 44 days before -> true (boundary at 45). A meeting whose title reduces to `null` via `seriesKey` (e.g. "12/08") is excluded from every group entirely (never gets its own singleton group).
- [ ] **Step 2: Run, watch fail.** `npx vitest run src/features/meeting-load/series-groups.test.ts`
- [ ] **Step 3: Implement.** Group by `seriesKey(title)` (skip `null`) joined with `appId ?? '__none__'`; sort each group's occurrences by `startsAt` descending; window to `min(6, occurrences whose startsAt >= now - 180d)`.
- [ ] **Step 4: Tests pass. Commit:** `feat: series establishment window and grouping key (B2)`

### Task 3: `week-bucket.ts` and `trend-points.ts` — time bucketing and the 12-week chart

**Files:** Create `src/features/meeting-load/week-bucket.ts` + `.test.ts`, `src/features/meeting-load/trend-points.ts` + `.test.ts`

**Interfaces:**
- Consumes: `LK_TIMEZONE`, `toIsoDateInTimeZone` from `@/lib/lk-holidays`; `isoDayOf`, `isoDayAdd` from `@/features/people/iso-day` (the codebase's one existing Asia/Colombo day-arithmetic module — reuse its UTC-anchor discipline rather than inventing a second one).
- Produces:
  ```ts
  // week-bucket.ts — weeks start Monday, always Asia/Colombo.
  export function localWeekStartIso(date: Date): string   // yyyy-mm-dd of that instant's Monday, in LK_TIMEZONE
  export function weekStartIsoOffset(weekStartIso: string, weeksBack: number): string // walks in 7-day steps via isoDayAdd

  // trend-points.ts
  export interface WeekHours { weekStartIso: string; hours: number }
  export interface LoadTrendPoint { weekStartIso: string; hours: number }
  export interface LoadTrendData { points: LoadTrendPoint[]; yMax: number }
  export const TREND_WEEKS = 12
  export const TREND_Y_FLOOR_HOURS = 1 // avoids a degenerate 0/0 chart when every week is empty

  export function buildLoadTrend(weeklyHours: WeekHours[], now: Date): LoadTrendData
  ```

Read first: spec "Invited hours per week" (the week bucketing rule) and DASHBOARD surface (the 12-week trend). `AllocationTrend` (`src/features/people/components/allocation-trend.tsx`) is the component this trend is styled after, but `MeetingLoadTrend` (Task 14) is a NEW sibling component with its own point type — hours have no "100% line" analog, so don't literally reuse `TrendPoint`/`AllocationTrend`.

- [ ] **Step 1: `week-bucket.test.ts` first.** Sunday 18:30 UTC -> Monday 00:00 Colombo exactly (UTC+5:30) -> lands in that Monday's week, not the prior Sunday's. Monday 05:29 Colombo local time (i.e., an instant that is still Sunday in UTC) still buckets to that same Monday, not the week before — the exact bug class `isoDayOf`'s own doc comment warns about (SQL bucketing in one zone, JS fill loop in another). `weekStartIsoOffset(iso, 1)` steps back exactly 7 days; `weekStartIsoOffset(iso, 0)` is a no-op.
- [ ] **Step 2: Implement `week-bucket.ts`**, then run — pass.
- [ ] **Step 3: `trend-points.test.ts`.** Mirror `src/features/people/allocation-history.test.ts`'s shape: empty weeks in the middle of the 12-week range fill as `{hours: 0}`, never dropped; `yMax` is `Math.max(peak, TREND_Y_FLOOR_HOURS)`; a single populated week still produces 12 points (11 zero-filled); the 12 weeks always end at `localWeekStartIso(now)`.
- [ ] **Step 4: Implement `trend-points.ts`.** Tests pass. Commit: `feat: Asia/Colombo week bucketing and 12-week trend points (B3)`

### Task 4: `load-math.ts` — invited hours and RSVP adoption

**Files:** Create `src/features/meeting-load/load-math.ts` + `.test.ts`

**Interfaces:**
```ts
export const DURATION_CLAMP_HOURS = 8

export interface OccurrenceHoursInput {
  meetingId: string
  startsAt: Date
  endsAt: Date
  attendeeResponses: Array<'pending' | 'going' | 'maybe' | 'declined'>
}
export interface OccurrenceHoursResult {
  meetingId: string
  hours: number      // LEAST(duration, 8h) * count(response != 'declined'); 0 when duration is invalid
  clamped: boolean    // true when raw duration exceeded 8h
  flagged: boolean    // true when endsAt <= startsAt (reversed or zero-duration)
}
export function invitedHoursFor(input: OccurrenceHoursInput): OccurrenceHoursResult

export interface RsvpAdoptionRow { userId: string; response: 'pending' | 'going' | 'maybe' | 'declined' }
export interface RsvpAdoptionInput { meetingId: string; createdBy: string; attendees: RsvpAdoptionRow[] }
export interface RsvpAdoptionResult { pending: number; total: number; rate: number } // rate = pending/total, 0 when total===0
export function rsvpAdoption(inputs: RsvpAdoptionInput[]): RsvpAdoptionResult
```

Read first: spec "Invited hours per week" (the exact formula: `SUM(LEAST(EXTRACT(EPOCH FROM ends_at - starts_at)/3600, 8) * count of non-declined attendee rows)`) and "In-app RSVP adoption."

- [ ] **Step 1: Write the failing tests first.** A 2h meeting with 5 non-declined attendee rows (1 declined excluded) -> 10 hours, `clamped: false`. A 10h meeting with 3 non-declined attendees -> `8 * 3 = 24` hours, `clamped: true`. `endsAt === startsAt` -> `0` hours, `flagged: true`. `endsAt` before `startsAt` (reversed) -> `0` hours, `flagged: true`. `rsvpAdoption`: an attendee row with `response: 'pending'` and `userId !== createdBy` counts; the organizer's own row, even if `'pending'`, is excluded (mirrors `rsvp-actions.ts`'s `RESPONSES = ['going','maybe','declined']` — `'pending'` is genuinely unsettable through the UI, verified at `src/features/meetings/rsvp-actions.ts:14-15`); `total` counts every attendee row regardless of response; `rate` is `pending/total`, `0` when there are zero attendees.
- [ ] **Step 2: Run, watch fail. Implement.** `npx vitest run src/features/meeting-load/load-math.test.ts`
- [ ] **Step 3: Tests pass. Commit:** `feat: invited-hours and RSVP-adoption math (B4)`

### Task 5: `participation.ts` — the cancel-rule veto

**Files:** Create `src/features/meeting-load/participation.ts` + `.test.ts`

**Interfaces:**
```ts
export interface VoiceSegment { meetingId: string; speakerId: string | null }
export interface OccurrenceParticipation { meetingId: string; turns: number; mappedSpeakers: number }
export function participationFor(meetingId: string, voiceSegments: VoiceSegment[]): OccurrenceParticipation

export interface ParticipationMedians { medianMappedSpeakers: number; medianVoiceTurns: number }
export function seriesParticipationMedians(occurrences: OccurrenceParticipation[]): ParticipationMedians

export const PARTICIPATION_VETO_MAX_SPEAKERS = 2  // "<= 2"
export const PARTICIPATION_VETO_MAX_TURNS = 10    // "< 10"
export function isLowParticipation(medians: ParticipationMedians): boolean
```

Read first: spec "Participation per analyzed occurrence (NEW — the CANCEL veto)" — read this one twice, it is the single most spec-emphasized correction in the document.

- [ ] **Step 1: Write the failing tests first.** `participationFor`: `turns` is `COUNT(*)` over segments where `source === 'voice'` for that `meetingId` (the caller pre-filters to voice — assert the function trusts its input rather than re-filtering, and document that choice); `mappedSpeakers` is the count of DISTINCT non-null `speakerId` values; a segment with `speakerId: null` is excluded from the distinct count but still counts toward `turns`. `seriesParticipationMedians`: correct median on an even count of occurrences (average the two middle values) and an odd count (middle value exactly); an empty occurrence list returns `{medianMappedSpeakers: 0, medianVoiceTurns: 0}`. `isLowParticipation`: `{medianMappedSpeakers: 2, medianVoiceTurns: 9}` -> `true` (both at the vetoing edge); `{medianMappedSpeakers: 3, medianVoiceTurns: 9}` -> `false` (speaker count over the line); `{medianMappedSpeakers: 2, medianVoiceTurns: 10}` -> `false` (turns at 10, not under 10) — a 40-turn, 6-speaker design crit with zero artifacts must read as `isLowParticipation(...) === false`, i.e. R1 (Task 9) is vetoed for it; an 8-turn, 2-speaker series reads `true`.
- [ ] **Step 2: Run, watch fail. Implement.** `npx vitest run src/features/meeting-load/participation.test.ts`
- [ ] **Step 3: Tests pass. Commit:** `feat: participation metric and the cancel-rule veto (B5)`

### Task 6: `density.ts` — AI-derived vs manual outputs, coverage, model partitioning

**Files:** Create `src/features/meeting-load/density.ts` + `.test.ts`

**Interfaces:**
```ts
export interface OutputFacts {
  meetingId: string
  model: string
  aiDerivedFollowups: number   // meeting_followups WHERE sourceMeetingId=m.id AND createdBy IS NULL
  manualFollowups: number      // createdBy NOT NULL
  acceptedTaskSuggestions: number // meeting_task_suggestions WHERE status='accepted' (never createdTaskId)
  deadlinesJson: unknown        // meeting_ai_notes.deadlines, raw and possibly null/absent
}
export interface OutputCounts { meetingId: string; model: string; aiDerived: number; manual: number }

export function deadlinesCount(deadlinesJson: unknown): number
export function splitOutputs(facts: OutputFacts): OutputCounts
export function coverageOf(analyzedCount: number, totalCount: number): number // 0 when totalCount===0

export interface ModelSegment { model: string; occurrences: OutputCounts[] }
export function partitionByModel(occurrencesNewestFirst: OutputCounts[]): ModelSegment[] // preserves order; a run boundary starts a new segment
```

Read first: spec "Outputs per analyzed occurrence, split AI-derived vs manual, plus analysis coverage."

- [ ] **Step 1: Write the failing tests first.** `deadlinesCount`: `null` -> 0, `undefined` -> 0, `[]` -> 0, a 3-item array -> 3, a non-array JSON value -> 0 (guarded, never throws). `splitOutputs`: `aiDerived = aiDerivedFollowups + acceptedTaskSuggestions + deadlinesCount(deadlinesJson)`; `manual = manualFollowups` — assert these two never mix (a manual-only occurrence has `aiDerived === 0` regardless of how many manual follow-ups exist, which is the gaming-vector fix). `coverageOf(2, 4)` -> `0.5`; `coverageOf(0, 0)` -> `0`. `partitionByModel`: `['gemini-2.0','gemini-2.0','gemini-2.5','gemini-2.5']` (newest-first, so the run is contiguous) -> two segments of 2; a single occurrence -> one segment of 1; the function never compares counts *across* returned segments — assert this by checking the returned shape has no cross-segment field, only per-segment arrays.
- [ ] **Step 2: Run, watch fail. Implement.** `npx vitest run src/features/meeting-load/density.test.ts`
- [ ] **Step 3: Tests pass. Commit:** `feat: AI-derived/manual output split with model-boundary partitioning (B6)`

### Task 7: `collisions.ts` — overlapping-invitation hours

**Files:** Create `src/features/meeting-load/collisions.ts` + `.test.ts`

**Interfaces:**
```ts
export const BACK_TO_BACK_GAP_MS = 10 * 60 * 1000 // "<10 min gap"

export interface WeekMeetingInterval {
  meetingId: string
  startsAt: Date
  endsAt: Date
  nonDeclinedUserIds: string[]
}
export interface CollisionResult {
  teamOverlapHours: number
  teamBackToBackCount: number
  perUserOverlapHours: Record<string, number> // for self-view only — caller reads only session.user.id's own key
}
export function computeCollisions(weekMeetings: WeekMeetingInterval[]): CollisionResult
```

Read first: spec "Overlapping-invitation hours (team total only)."

- [ ] **Step 1: Write the failing tests first, per the spec's own bullet list verbatim.** `a.endsAt === b.startsAt` is NOT an overlap (back-to-back with a 0 gap, tracked separately, never adds to `teamOverlapHours`). Back-to-back gap of exactly `0` counts as back-to-back; `9m59s` counts as back-to-back; `10m` does NOT (boundary at the constant above). Pair dedupe: for the same user, meeting A and meeting B are only ever compared once (`a.id < b.id`), never twice and never against themselves. Identical intervals (same start/end) for the same user count as a full-duration overlap. A `declined` attendee is excluded from `nonDeclinedUserIds` by the caller — assert the module trusts the filtered list rather than re-filtering on a `response` field it was never given. Degenerate intervals (`endsAt <= startsAt`) are ignored entirely (contribute to neither overlap nor back-to-back). Two different users' overlapping meetings never cross-contaminate each other's `perUserOverlapHours` entry.
- [ ] **Step 2: Run, watch fail. Implement.** Pairwise per user: `a.startsAt < b.endsAt && b.startsAt < a.endsAt` for true overlap (adds `min(a.endsAt,b.endsAt) - max(a.startsAt,b.startsAt)` hours to both the team total and both users' `perUserOverlapHours`); a non-overlapping pair whose gap is `< BACK_TO_BACK_GAP_MS` increments `teamBackToBackCount` instead. `npx vitest run src/features/meeting-load/collisions.test.ts`
- [ ] **Step 3: Tests pass. Commit:** `feat: overlapping-invitation hours (team total + self-view) (B7)`

### Task 8: `churn.ts` — invite churn

**Files:** Create `src/features/meeting-load/churn.ts` + `.test.ts`

**Interfaces:**
```ts
export interface OccurrenceInvites { meetingId: string; inviteUserIds: string[] }
export function inviteChurnBetween(older: OccurrenceInvites, newer: OccurrenceInvites): number // |symmetric difference|
export function seriesChurnCount(occurrencesNewestFirst: OccurrenceInvites[]): number // sum over each consecutive pair
```

Read first: spec "Per-series table" ("Churn = symmetric difference of invite sets between consecutive occurrences, as a COUNT").

- [ ] **Step 1: Write the failing tests first.** Two occurrences with invite sets `{a,b,c}` and `{a,b,d}` -> churn `2` (c leaves, d joins). Identical invite sets -> `0`. A single-occurrence series -> `seriesChurnCount` is `0` (no consecutive pair exists — a one-element array must not throw on `occurrences[1]`). A three-occurrence chain where the middle occurrence's invite list is missing entirely (simulating a deleted middle row filtered out upstream) — pass only the two remaining occurrences and confirm the chain shortens to one pair without crashing (the caller's job is to hand this module a clean newest-first array; this module never indexes past its input).
- [ ] **Step 2: Run, watch fail. Implement.** `npx vitest run src/features/meeting-load/churn.test.ts`
- [ ] **Step 3: Tests pass. Commit:** `feat: invite churn between consecutive occurrences (B8)`

### Task 9: `suggest.ts` — the engine (R1–R5)

**Files:** Create `src/features/meeting-load/suggest.ts` + `.test.ts`

**Interfaces:**
```ts
export type SuggestionKind = 'cancel_review' | 'shorten' | 'share_slot' | 'record_or_review' | 'trim_invite'

export interface AnalyzedOccurrence {
  meetingId: string
  model: string
  aiDerivedOutputs: number   // from density.ts's splitOutputs — manual is NEVER read below
  mappedSpeakers: number
  voiceTurns: number
  isoWeek: string             // e.g. "2026-W07", for R3's same-week check
  hardEvidencePool: number    // sum of hardEvidenceCount across all A1 candidates for this occurrence; 0 pre-A1-data
  /** R5 only. `undefined` means "the caller structurally withheld names" — R5 MUST NOT fire when this is
   *  undefined on ANY analyzed occurrence in the window. This is how the org-facing build (queries.ts) makes
   *  R5 impossible without a redaction step anyone could forget: it simply never populates this field. */
  zeroEvidenceInviteeIds?: string[]
}

export interface SeriesMetrics {
  groupKey: string
  seriesKey: string
  appId: string | null
  mergeable: boolean
  established: boolean
  activeRecently: boolean
  organizerId: string
  occurrenceCountInWindow: number
  medianDurationMinutes: number
  invitedHoursPerWeek: number
  consideredCountLast4: number      // min(4, occurrenceCountInWindow)
  last4Analyzed: AnalyzedOccurrence[] // only the ANALYZED ones among the last 4, newest first
  last3InviteSets: string[][]        // full invite sets of the most recent 3 occurrences, newest first (R3)
}

export interface Suggestion {
  kind: SuggestionKind
  targetKey: string     // `${kind}:${groupKey}`, or for share_slot the SORTED pair joined with '+'
  groupKeys: string[]   // length 1, except share_slot (length 2)
  organizerIds: string[] // length 1, except share_slot (length 2)
  copy: string
  evidence: Record<string, unknown> // the exact numbers shown — this becomes the decision's jsonb snapshot verbatim
}

export function suggest(seriesTable: SeriesMetrics[], decidedKeys: ReadonlySet<string>): Suggestion[]
export function aggregateSuggestions(suggestions: Suggestion[]): { count: number; potentialHoursPerWeek: number }
```

Read first: spec "Suggestion engine" section in FULL (GATES, R1–R5, DELETED RULES, VISIBILITY, IDENTITY & LIFECYCLE) — this is the biggest, most load-bearing file in the plan.

- [ ] **Step 1: Structural test first — no RSVP/declined input reaches any rule.** Assert this on the `AnalyzedOccurrence`/`SeriesMetrics` TYPES themselves (e.g. a `keyof` check or an explicit list of allowed keys), not just by inspection — the spec demands the waste metric be structurally unreachable, and a type-level test is the only kind that can't silently rot.
- [ ] **Step 2: GATES tests.** No suggestion of any kind fires for a series with `established: false`. No suggestion fires for a series with `activeRecently: false` even if otherwise established (ages out title-edit-forked strays — a series whose newest occurrence is 46 days old renders nothing).
- [ ] **Step 3: R1 CANCEL-REVIEW tests, every threshold both sides.** Fires only when: `occurrenceCountInWindow >= 3`; `consideredCountLast4 >= 2 -> analyzedCount/consideredCount >= 0.5` (coverage >= 50%, i.e. at least 2 of the last 4 analyzed); every occurrence in `last4Analyzed` has `aiDerivedOutputs === 0`; AND `isLowParticipation` (Task 5) is true across `last4Analyzed`'s medians. A 40-turn, 6-speaker series with zero AI-derived outputs NEVER fires (participation veto blocks it) — this is the single most important negative test in the whole suite. An 8-turn, 2-speaker series with one MANUAL-only follow-up (so `aiDerivedOutputs === 0` even though a human clearly did something) still fires — the gaming-resistance case the manual/AI split exists for. Coverage at exactly 49% (1 of 4, or fewer than half) suppresses it; 50% (2 of 4) fires it, all else equal. The copy is **exactly**: `"Review: 3 recorded occurrences, no tracked outputs, little discussion — cancel or move async? (Unrecorded series are not evaluated.)"` — assert `suggestion.copy` equals this string verbatim (the "3" is the series' actual `occurrenceCountInWindow`; write the assertion against a fixture where that number is 3, and separately assert the string is a template that reflects a fixture where it's 5).
- [ ] **Step 4: R2 SHORTEN tests.** Fires when `medianDurationMinutes >= 45`; `consideredCountLast4 >= 2` occurrences in `last4Analyzed` share the SAME `model` (a model change mid-window suppresses it — test a fixture with 2 analyzed occurrences on different models and confirm no fire); median `aiDerivedOutputs <= 1` AND median `voiceTurns < 20` across the same-model analyzed set. The proposed next duration steps down by 15 minutes (60->45, 45->30) — assert this value lands in `evidence`, not in `copy` (the spec gives no exact copy string for R2 — see "Open questions" below; do not invent one and hardcode it as if it were spec-given, put the numeric proposal in `evidence` and use a plain descriptive placeholder-free sentence built from the actual numbers, e.g. constructed entirely from template values, and flag the wording for human sign-off in your task report).
- [ ] **Step 5: R3 SHARE-A-SLOT tests.** Requires two established, `mergeable: true` series (both `appId !== null`, and the SAME `appId` — two `null`-appId series never match, even against each other). Invite Jaccard over `last3InviteSets`: `0.79` does not fire, `0.80` does (compute Jaccard as `|intersection|/|union|` over the union of each series' last-3 invite sets — spec says "over each series' last 3 occurrences," implement as the Jaccard of the two series' combined last-3 invite-user-id sets). Both series' `medianDurationMinutes <= 30`. Same ISO week (`isoWeek` field) in `>= 3` of the last 4 analyzed occurrences on EACH side. Purpose-token veto: build the token list `['standup','retro','planning','crit','review','demo','sync','1:1','postmortem']` plus Sinhala equivalents (see "Open questions" — the Sinhala words are not given anywhere in the spec, unlike `attendee-series.ts`'s weekday list which spells them out; stub the Sinhala half of the list with a `// TODO(human): verify these translations` comment and flag it loudly in your report rather than shipping unreviewed translations silently) — "standup" + "retro" normalise to different purpose tokens and the rule NEVER fires even if every other gate passes; "sync" + "sync" (same token) fires. `targetKey` for a firing pair is `share_slot:${[groupKeyA, groupKeyB].sort().join('+')}` — assert this is identical regardless of which series is passed first (sorted-pair determinism). Copy is **exactly**: `"Same people, same week — could these share one slot?"`
- [ ] **Step 6: R4 RECORD-OR-REVIEW tests.** Fires when `invitedHoursPerWeek >= 4` AND coverage over the last 4 occurrences `< 0.25`. Exact boundary: coverage `0.24` (e.g. 0 of 4, or a fractional case just under a quarter) at `4.0` hours/week fires; coverage exactly `0.25` does not; `3.9` hours/week at `0.24` coverage does not (both conditions are independently required — test each threshold in isolation, holding the other fixed at a firing value). Copy template mirrors the spec's example: `"6h/week with no record — worth recording, or worth reviewing?"` — the "6h" is the series' actual `invitedHoursPerWeek` rounded to one decimal, interpolated into the template; assert against a fixture where the number really is 6 AND a second fixture where it's a different value, confirming the template substitutes correctly rather than hardcoding "6h".
- [ ] **Step 7: R5 TRIM-INVITE tests.** Requires `>= 2` of the last 3 occurrences analyzed AND the series' evidence pool non-trivial (`sum(hardEvidencePool) > 0` across `last4Analyzed`) AND `>= 2` invitees present in `zeroEvidenceInviteeIds` on EACH of the last 3 analyzed occurrences (intersection across occurrences, not union — someone with zero evidence on only one of three occurrences does not count). **When `zeroEvidenceInviteeIds` is `undefined` on ANY occurrence in scope, R5 never fires for that series, full stop** — this is the structural redaction guard; test it explicitly with a fixture that would otherwise satisfy every numeric threshold. Copy template: `"No recorded evidence for 2 invitees (3 of 3 occurrences analyzed) — make them optional?"` with both numbers interpolated from the real fixture values (mirror the R4 interpolation test pattern). `aggregateSuggestions` NEVER counts a `trim_invite` suggestion toward `count`/`potentialHoursPerWeek` — test this directly (a suggestion list containing only `trim_invite` entries yields `{count: 0, potentialHoursPerWeek: 0}`), because "the count never appears on any org surface in any form" applies to the dashboard aggregate too, not only to the per-series card.
- [ ] **Step 8: `decidedKeys` filtering tests.** A `targetKey` present in `decidedKeys` (whether the underlying decision was `accepted` or `dismissed` — the caller passes the set of ALL decided keys regardless of status) suppresses that suggestion from ever appearing again. A title edit that forks a `seriesKey` (Task 2) produces a NEW `groupKey` and therefore a fresh, undecided `targetKey` — a dismissed old series does not suppress its forked successor.
- [ ] **Step 9: All tests pass, `npx vitest run src/features/meeting-load/suggest.test.ts`. Commit:** `feat: the suggestion engine — R1-R5, live-computed, no storage (B9)`

### Task 10: `observed-change.ts`

**Files:** Create `src/features/meeting-load/observed-change.ts` + `.test.ts`

**Interfaces:**
```ts
export interface ObservedChangeInput {
  decidedAt: Date
  beforeWeeklyHours: WeekHours[] // the 4 Colombo-weeks strictly before decidedAt's week
  afterWeeklyHours: WeekHours[]  // the 4 Colombo-weeks strictly after decidedAt's week
}
export type ObservedChange =
  | { status: 'measured'; beforeAvgHours: number; afterAvgHours: number; deltaHours: number }
  | { status: 'no-data-yet' }

export function observedChangeFor(input: ObservedChangeInput): ObservedChange
```
(imports `WeekHours` from `./trend-points`)

Read first: spec "Observed change since decision (REPLACES 'hours saved to date')."

- [ ] **Step 1: Write the failing tests first.** 4 populated weeks before and after -> `{status:'measured', beforeAvgHours, afterAvgHours, deltaHours: after-before}` (average, not sum — the spec's "hours saved to date" rejection was specifically about summing a rate into a total). Zero populated weeks after `decidedAt` (series has had no post-decision occurrences yet) -> `{status:'no-data-yet'}`, never a fabricated `0`. A negative `deltaHours` (load went UP after the decision) is reported as-is, not clamped to zero — this is deliberately the point: "Observed change can be zero or negative... the ledger holds the feature accountable."
- [ ] **Step 2: Run, watch fail. Implement.** `npx vitest run src/features/meeting-load/observed-change.test.ts`
- [ ] **Step 3: Tests pass. Commit:** `feat: observed change since decision, 4-week before/after windows (B10)`

### Task 11: `queries.ts` — org-facing reads (no userIds, structurally)

**Files:** Create `src/features/meeting-load/queries.ts`

**Interfaces:**
- Consumes: `liveMeetings`, `liveNoteSegments` from `@/db/live`; `meetingAttendees`, `meetingFollowups`, `meetingTaskSuggestions`, `meetingAiNotes`, `meetingAttendeeRecommendations`, `apps` from `@/db/schema`; every pure module from Tasks 2–10.
- Produces (every return type below is checked for the absence of a `userId`/`user_id`-shaped field as part of Step 4):
  ```ts
  export async function getInvitedHoursTrend(now: Date): Promise<LoadTrendData>
  export async function getWeeklyLoadTable(now: Date): Promise<{
    weekStartIso: string; invitedHours: number; meetingCount: number; coverage: number
    noAgendaCount: number; noAppCount: number; overlapHours: number; rsvpAdoption: RsvpAdoptionResult
  }[]>
  export async function getPerAppLoad(now: Date): Promise<{ appId: string | null; appName: string; invitedHours: number }[]>
  export async function getSeriesTable(now: Date): Promise<{
    groupKey: string; seriesKey: string; appId: string | null; occurrenceCount: number
    invitedHoursPerOccurrence: number; medianDurationMinutes: number; churnCount: number
    aiDerivedOutputs: number; manualOutputs: number; medianMappedSpeakers: number; medianVoiceTurns: number
    coverage: number
  }[]> // no organizerId, no attendee names anywhere in this row — churn is a COUNT only
  export async function getSuggestionsAggregate(now: Date, decidedKeys: ReadonlySet<string>): Promise<{ count: number; potentialHoursPerWeek: number }>
  export async function getMyPendingInvites(userId: string): Promise<{ meetingId: string; title: string; startsAt: Date }[]>
  export async function getMyOverlapHours(userId: string, now: Date): Promise<number>
  ```

Read first: spec "Surfaces" 1–3 (dashboard, /meetings, /meetings/load) and "VISIBILITY ENFORCEMENT."

- [ ] **Step 1: Build the SQL gather.** One query batches all live meetings + non-declined attendee rows for the trailing window needed (12 weeks for the trend/table, plus whatever `series-groups.ts`'s 180-day window needs for `getSeriesTable`) — join `liveMeetings`, and for `meetingNoteSegments`/`meetingFollowups`/`meetingTaskSuggestions`/`meetingAiNotes` reads, explicitly `.innerJoin(liveMeetings, eq(child.meetingId, liveMeetings.id))` even where the automated check wouldn't force it (see "Grounding corrections" above re: `meeting_attendee_recommendations` not yet being in the enforcement list). Group in JS via the Task 2–10 pure modules; never write a second ad-hoc `date_trunc`/hours formula here — every number this file returns is a direct, undecorated call into a tested pure function.
- [ ] **Step 2: R5's data path here must never SELECT a `user_id`.** The SQL powering `getSuggestionsAggregate`'s R5 evaluation aggregates server-side to a boolean/count (e.g. `HAVING COUNT(...) >= 2` or an equivalent `EXISTS`), and the JS objects built from it never populate `AnalyzedOccurrence.zeroEvidenceInviteeIds` at all (leave it `undefined`) — this is what makes the type-level redaction real rather than a discipline you have to remember, per the spec's "VISIBILITY ENFORCEMENT (type-level, not a remember-to-call function)" requirement.
- [ ] **Step 3: Implement each exported function**, composing the Task 2–10 pure modules over the gathered facts. `getSuggestionsAggregate` calls `suggest()` (Task 9) with the redacted `SeriesMetrics[]` and `decidedKeys` (passed in by the caller, sourced from `admin-queries.ts` — see Task 12), then `aggregateSuggestions()`.
- [ ] **Step 4: Write a type-boundary test**, per the spec's own test-plan bullet — `src/features/meeting-load/redaction-boundary.test.ts`: for every exported function above, assert via `Object.keys()` on a real returned row (from a mocked/fixture DB, house idiom) that no key named `userId`/`user_id`/`organizerId`/`decidedBy` is present. This is a comment-level enforcement point per the spec ("enforced by tsc, noted in a comment test rather than a runtime assertion") — write BOTH a `// @ts-expect-error` style compile-time assertion on the type AND the runtime `Object.keys` check, matching A1's `toRedactedView` test precedent (`Object.keys(...)`, not `toBeUndefined()`).
- [ ] **Step 5: Verify + commit.** `npx vitest run`, `npx tsc --noEmit`, `npx vitest run src/db/live.test.ts`. Commit: `feat: org-facing meeting-load queries, no userIds structurally (B11)`

### Task 12: `admin-queries.ts` — named reads, gated call sites only

**Files:** Create `src/features/meeting-load/admin-queries.ts`

**Interfaces:**
```ts
export async function getAllDecidedKeys(): Promise<Set<string>>
export async function getAllSuggestionsForAdmin(now: Date): Promise<Suggestion[]> // full, incl. trim_invite with names
export async function getSuggestionsForOrganizer(userId: string, now: Date): Promise<Suggestion[]> // pre-filtered to series this user organizes
export async function getDismissedDecisions(): Promise<{ id: string; kind: string; targetKey: string; evidence: unknown; decidedAt: Date }[]>
export async function getChurnDetail(groupKey: string): Promise<{ occurrencePairIso: [string, string]; joined: { userId: string; name: string }[]; left: { userId: string; name: string }[] }[]>
export async function getObservedChangesForAdmin(now: Date): Promise<{ decisionId: string; kind: string; targetKey: string; change: ObservedChange }[]>
export async function getAcceptanceByKind(): Promise<{ kind: string; accepted: number; dismissed: number; rate: number }[]>
```

Read first: spec "VISIBILITY OF SUGGESTIONS," "VISIBILITY ENFORCEMENT," and surface 4 (/admin).

- [ ] **Step 1: `getSuggestionsForOrganizer` eligibility check FIRST, before any evidence read** — mirror A1 Task 8's `getSeriesDrift` pattern exactly: resolve the series' most recent occurrence's `createdBy` with one cheap query, and if `userId` doesn't match it AND the caller isn't admin, return `[]` before touching `meeting_attendee_recommendations` or any other evidence table — the data must never enter a non-eligible viewer's payload, not just get filtered out of the render.
- [ ] **Step 2: R5's named path lives ONLY here.** This is the one place `AnalyzedOccurrence.zeroEvidenceInviteeIds` is ever populated from a real `SELECT user_id`. Both `getAllSuggestionsForAdmin` and (post-eligibility-check) `getSuggestionsForOrganizer` build the full `SeriesMetrics[]` including this field before calling `suggest()`.
- [ ] **Step 3: `getChurnDetail` resolves names for one series' consecutive-occurrence pairs** — joined/left user ids from `churn.ts`'s symmetric-difference computation, resolved to `{userId, name}` here (never in a module Tasks 2–10 built, which stay name-free).
- [ ] **Step 4: `getAcceptanceByKind`** groups `meeting_load_decisions` by `kind`, `accepted/(accepted+dismissed)`. Leave a clearly marked stub/TODO for A1's half (recommendation acceptance rate grouped by surface/tier, window "last 180 days", `'open'` excluded and stated) — that data only exists once A1's Task 6+ actions are writing real rows; note in a code comment that this half activates automatically once A1 lands, requiring no B code change.
- [ ] **Step 5: There is NO function anywhere in this file that groups by organizer.** Add a comment at the top of the file stating this is deliberate (spec: no per-organizer cut at any visibility level) so a future contributor doesn't "helpfully" add one.
- [ ] **Step 6: Verify + commit.** `npx vitest run`, `npx tsc --noEmit`, `npx vitest run src/db/live.test.ts`. Commit: `feat: named meeting-load queries behind gated call sites (B12)`

### Task 13: Server actions — accept, dismiss, reopen

**Files:** Create `src/features/meeting-load/actions.ts`, `src/features/meeting-load/actions.test.ts`; modify `src/db/live.test.ts` (`DELETE_ALLOWED_FUNCTIONS`)

**Interfaces:**
```ts
export async function acceptLoadSuggestion(kind: SuggestionKind, targetKey: string, evidence: Record<string, unknown>): Promise<ActionResult<{ deepLink: string }>>
export async function dismissLoadSuggestion(kind: SuggestionKind, targetKey: string, evidence: Record<string, unknown>): Promise<ActionResult<void>>
export async function reopenLoadDecision(id: string): Promise<ActionResult<void>>
```

Read first: spec "Server actions" section (exact guard, exact error strings, exact revalidate paths).

- [ ] **Step 1: Write the mocked-action tests FIRST**, idiom per `src/features/admin/set-user-title.test.ts` (`vi.mock('@/lib/auth', ...)`, a `writeSpy`, `vi.mock('next/cache', ...)`). Cover: a signed-out caller gets `err`, `writeSpy` untouched. A member who is neither admin nor the target series' most recent occurrence's `createdBy` gets `err('...')`, `writeSpy` untouched (Task 12's "open question" caveat below applies here specifically for `share_slot`). The series' actual organizer gets `ok`. An admin who is not the organizer still gets `ok`. A second `acceptLoadSuggestion`/`dismissLoadSuggestion` call on an already-decided `(kind, targetKey)` hits the unique index and returns `err('Already decided')` (assert via a `writeSpy` that throws a unique-violation-shaped error on the second call, mirroring `isUniqueViolation` in `src/features/people/actions.ts:42-51` — walks `.cause` for Postgres code `23505`). `reopenLoadDecision` rejects a non-admin caller with `writeSpy` untouched; an admin caller triggers exactly one `db.delete(meetingLoadDecisions)` call scoped to the given `id`.
- [ ] **Step 2: Implement the guard** as a 4-line private helper copying `admin/actions.ts:25-29`'s `requireAdmin` shape, extended with the "OR is the organizer" branch (one extra query to resolve the target series' latest `createdBy` — for `share_slot`, whose `targetKey` encodes a SORTED PAIR of two `groupKey`s, see "Open questions" below for which organizer(s) may act; implement your best-effort read of the spec and flag the choice explicitly in your report).
- [ ] **Step 3: Implement `acceptLoadSuggestion`/`dismissLoadSuggestion`.** Zod-validate `kind` against the known 5-member list and `targetKey`'s shape (non-empty string containing the `kind` prefix). `INSERT` with `status` set explicitly (never relying on a default — there is none), `evidence` as the passed-in snapshot verbatim, `decidedBy: session.user.id`. Catch the unique-violation and return `err('Already decided')`. `acceptLoadSuggestion`'s `ok` payload includes a `deepLink` computed from `kind` (cancel_review/record_or_review -> the series' most recent occurrence's own page; share_slot -> the same; trim_invite -> the invite editor context) — NEVER a write to `meetings`/`endsAt`/`meetingAttendees`, assert this with a `writeSpy` that fails the test if any table other than `meetingLoadDecisions` is touched.
- [ ] **Step 4: Implement `reopenLoadDecision`** as a genuine `db.delete(meetingLoadDecisions).where(eq(meetingLoadDecisions.id, id))`, admin-only.
- [ ] **Step 5: Register the hard-delete in `src/db/live.test.ts`.** Add `'src/features/meeting-load/actions.ts': 'reopenLoadDecision'` to `DELETE_ALLOWED_FUNCTIONS` with a `// why` comment: `meeting_load_decisions` has no `deletedAt` column (it is not one of the five soft-deleted tables) and a genuinely-open suggestion is simply the absence of a row, so "reopen" is a real delete, not a soft-delete miss. This is check 4's sanctioned registration path, distinct from — and NOT the same list as — the `ALLOWLIST` used by checks 1–3.
- [ ] **Step 6: Revalidate.** `revalidatePath('/')`, `'/meetings'`, `'/meetings/load'`, `'/admin'` at the end of every action that writes; `revalidateAdmin()` too (it currently just re-hits `/admin`, but calling it keeps this file consistent with the rest of the codebase's convention of never hand-rolling that path).
- [ ] **Step 7: Verify + commit.** `npx vitest run`, `npx tsc --noEmit`, `npx vitest run src/db/live.test.ts` (must be green with the new `DELETE_ALLOWED_FUNCTIONS` entry). Commit: `feat: accept/dismiss/reopen actions for meeting-load suggestions (B13)`

### Task 14: Dashboard surface

**Files:** Create `src/features/meeting-load/components/meeting-load-card.tsx`, `src/features/meeting-load/components/meeting-load-trend.tsx`; modify `src/app/(app)/page.tsx` (`Promise.all` at lines 69-95, Team zone grid at lines 170-173)

Read first: spec surface 1 (DASHBOARD) — and re-read "Grounding corrections" #3 above before touching `page.tsx`.

- [ ] **Step 1: `MeetingLoadTrend`** — a new server-safe SVG component styled after `AllocationTrend` (`viewBox`, `vector-effect="non-scaling-stroke"`, `role="img"` + a full-sentence `aria-label`, theme-token strokes, NO chart library) but built on `LoadTrendPoint`/`LoadTrendData` (Task 3), not `AllocationTrend`'s own `TrendPoint` type — there is no "100% reference line" here, just the step/line and a floor.
- [ ] **Step 2: `MeetingLoadCard`** — a shadcn `Card` (matching the family already imported in `admin/page.tsx`: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`) showing: this-week invited hours with delta vs the trailing-4-week MEDIAN (not mean — compute the median in the component's data-prep step or push it into `getInvitedHoursTrend`'s caller), the 12-week `MeetingLoadTrend`, analysis coverage, and the aggregate suggestions line, e.g. built from `getSuggestionsAggregate`'s `{count, potentialHoursPerWeek}` as `"${count} suggestion${count===1?'':'s'} with organizers, ~${potentialHoursPerWeek}h/week potential"` (only rendered when `count > 0`). `CardAction` links to `/meetings/load`. No names, no per-series verdicts — the component's props must be exactly `{count, potentialHoursPerWeek}` plus the trend/coverage numbers, nothing shaped like a `Suggestion`.
- [ ] **Step 3: Wire into `page.tsx`.** Add `getInvitedHoursTrend(now)` and `getSuggestionsAggregate(now, decidedKeys)` to the existing `Promise.all` (lines 69-95) — `decidedKeys` needs `admin-queries.ts`'s `getAllDecidedKeys()` added alongside, gated the same way `pendingUsers`/`assignableApps` already are for admin-only reads is NOT needed here (decided-keys are needed by every visitor to compute the org-wide aggregate correctly, not just admins — fetch unconditionally). Mount `<MeetingLoadCard/>` in the **Team** zone's grid (lines 170-173), alongside `CapacityHeat` and `ActiveSprints` — per the grounding correction, this is a team-wide number, not a personal one, despite the spec's original "under UpcomingMeetings" placement (which no longer exists in this codebase).
- [ ] **Step 4: Verify + commit.** `npx vitest run`, `npx tsc --noEmit`, `npx next build --webpack` (dashboard renders). Commit: `feat: dashboard meeting-load card (B14)`

### Task 15: /meetings surface

**Files:** Create `src/features/meeting-load/components/your-series-card.tsx`, `src/features/meeting-load/components/suggestion-decision-buttons.tsx` (`'use client'`); modify `src/app/(app)/meetings/page.tsx` (lines 12-19 `Promise.all`, the at-a-glance `StatTile` row at lines 57-68)

Read first: spec surface 2 (/meetings).

- [ ] **Step 1: Invited-hours `StatTile`.** Add `getInvitedHoursTrend`/current-week value to `meetings/page.tsx`'s existing `Promise.all`, compute the trailing-4-week median server-side beside `summarizeMeetings` (above the client `MeetingsViews` boundary, per the spec), and render a new `<StatTile value={invitedHours} label="Invited hours" tone={invitedHours > 1.25 * trailingMedian ? 'warning' : 'neutral'} />` in the existing tile row (median, not mean, chosen so one workshop week doesn't trip the warning tone for a month).
- [ ] **Step 2: `YourSeriesCard`.** Rendered only when `currentUserId` (already computed at line 26) organizes `>= 1` established series with an open suggestion (via `getSuggestionsForOrganizer`, Task 12) or an accepted-decision observed-change note (via `getObservedChangesForAdmin`... no — organizer-scoped, so add a parallel `getObservedChangesForOrganizer(userId)` to `admin-queries.ts` in this task, same eligibility-first pattern as Task 12 Step 1). Each suggestion row shows its evidence line and the two-button client island (`suggestion-decision-buttons.tsx`) calling `acceptLoadSuggestion`/`dismissLoadSuggestion`. This is the ONLY client-interactive piece on this surface — everything else stays server-rendered.
- [ ] **Step 3: "Your pending invites" + your own overlap count.** `getMyPendingInvites(currentUserId)` and `getMyOverlapHours(currentUserId, now)` (Task 11) rendered as a small self-view block — copy: `"X invites without an in-app reply — replies may live in Google Calendar; a tap here helps planning"` with `X` interpolated, linking into the existing per-meeting RSVP control (no new expansion UI for this metric, per spec — "No meeting-level expansion for this metric on the drill-down" applies to /meetings/load, but this self-view block on /meetings should likewise stay a flat count + link, not a per-meeting breakdown, to avoid duplicating that surface's restraint).
- [ ] **Step 4: Verify + commit.** `npx vitest run`, `npx tsc --noEmit`, `npx next build --webpack`. Commit: `feat: /meetings invited-hours tile, organizer-private suggestions card, self-view nudges (B15)`

### Task 16: /meetings/load — the new audit route

**Files:** Create `src/app/(app)/meetings/load/page.tsx`, `src/app/(app)/meetings/load/loading.tsx`, `src/features/meeting-load/components/weekly-load-table.tsx`, `src/features/meeting-load/components/series-load-table.tsx`, `src/features/meeting-load/components/per-app-load.tsx`

Read first: spec surface 3 (/meetings/load) in full — this is the largest single surface.

- [ ] **Step 1: Route shell.** `page.tsx` inherits auth via the `(app)` layout redirect (no separate gate needed — it's org-visible, not admin-only). `loading.tsx` mirrors `meetings/loading.tsx`'s precedent: skeleton shaped like the real page (header, table rows), not two flat grey blocks.
- [ ] **Step 2: Header carries the definition sentence verbatim**, per spec: something equivalent to "hours on calendars, not hours in rooms — we cannot see attendance" placed directly under the page title — quote this exact clause, do not paraphrase it away.
- [ ] **Step 3: `WeeklyLoadTable`.** 12-week table from `getWeeklyLoadTable` — invited hours, meeting count, coverage, agenda/app field usage, overlap total, RSVP adoption. Each week row expands via native `<details>/<summary>` to its constituent meetings, for EVERY column EXCEPT RSVP adoption — that column's row has no expansion control at all (the "whodunit fix": the aggregate never hands out a per-meeting hunt list for who hasn't RSVP'd).
- [ ] **Step 4: `PerAppLoad`.** `getPerAppLoad` results with an explicit "No app" bucket for `appId: null`, and the caveat sentence printed on the surface: app deletion moves history into "No app" (`ON DELETE SET NULL`, `schema.ts:189` in the current tree — re-verify the line number when you write this, `meetings.appId`'s FK).
- [ ] **Step 5: `SeriesLoadTable`.** `getSeriesTable` rows — occurrences, invited hours/occurrence, median duration, churn count (number only, no names — churn names load lazily via a client fetch to a thin wrapper around `getChurnDetail`, itself re-checking organizer-or-admin before returning anything, gated exactly like `getSuggestionsForOrganizer`), outputs AI/manual split with the model annotation shown beside them, participation medians, coverage. Agenda-rate columns exclude established series with `medianDurationMinutes <= 20` from that specific rate (per spec) — implement as a display-time exclusion, not a query-time one, so the row itself still renders with the other columns intact.
- [ ] **Step 6: Clamped-outlier list.** Meetings whose raw duration exceeded 8h (`OccurrenceHoursResult.clamped`), named as outliers on this page (not hidden — spec: "listed as named outliers on the drill-down").
- [ ] **Step 7: No person is named negatively anywhere on this page** — the one universal rule spanning every table above; if a review pass finds a name attached to a number that reads as criticism, that's a bug in this task, not a style nit.
- [ ] **Step 8: Verify + commit.** `npx vitest run`, `npx tsc --noEmit`, `npx next build --webpack`, manually confirm the route renders with an empty-data fixture (0 established series) without crashing. Commit: `feat: /meetings/load audit surface (B16)`

### Task 17: /admin surface

**Files:** Create `src/features/meeting-load/components/meeting-load-admin-card.tsx`; modify `src/app/(app)/admin/page.tsx` (card stack, after `TrashCard` at line 82, before the danger zone)

Read first: spec surface 4 (/admin).

- [ ] **Step 1: `MeetingLoadAdminCard`.** Full suggestion queue across all series via `getAllSuggestionsForAdmin` (Task 12), including R5 trim-invite WITH names and coverage fractions — this is the one place that data is allowed to render. Dismissed list (`getDismissedDecisions`) with a `Reopen` control wired to `reopenLoadDecision`. Per-decision observed-change lines (`getObservedChangesForAdmin`). Acceptance-by-kind telemetry (`getAcceptanceByKind`) — labelled as tuning telemetry, not a scoreboard, per spec's own framing ("With 2-3 organizers, an org-visible acceptance rate is attributable to individuals").
- [ ] **Step 2: Structural check.** Confirm (and assert with a quick component-props test if the codebase has precedent for one, otherwise a code comment is acceptable per house style for untested components) that no prop or render path groups anything by organizer, and that no OTHER admin card anywhere lists pending responders, per-person collisions, or per-organizer density — those three are dropped from v1 per spec and this card must not quietly reintroduce any of them.
- [ ] **Step 3: Mount in `admin/page.tsx`** behind the existing `notFound()` gate (line 25), as its own `Card` in the stack.
- [ ] **Step 4: Verify + commit.** `npx vitest run`, `npx tsc --noEmit`, `npx next build --webpack`. Commit: `feat: /admin meeting-load suggestion queue and telemetry (B17)`

### Task 18: E2E and the full gate

**Files:** Create `e2e/meeting-load.spec.ts` following the existing harness (workers:1, port 3400, `E2E_TEST_MODE=1`, storageState from the single dev-login admin, RUN_ID-tagged rows cleaned in `afterAll` via the direct `{ db }` import)

- [ ] **Step 1: E2E.** (1) Seed a series of 3+ meetings on the same app/title pattern with zero AI-derived outputs and low participation fixtures; load `/meetings/load` and assert the series row renders with the participation medians and coverage shown, no names. (2) As the series' organizer, load `/meetings` and assert the "Your series" card shows the R1 cancel-review suggestion with its exact copy string; click Dismiss; reload and assert it no longer appears, and that a direct DB read of `meeting_load_decisions` shows one row with `status='dismissed'` and a non-null `evidence` jsonb. (3) As admin, load `/admin`, find the same dismissed decision, click Reopen; assert the row is gone from the DB and the suggestion reappears on `/meetings`. (4) Assert the dashboard's aggregate line renders a plain count/hours sentence with no series name anywhere in the DOM. (5) Assert `acceptLoadSuggestion` never results in a changed `meetings.endsAt` or a changed `meeting_attendees` row for the target meeting (direct DB comparison before/after accept).
- [ ] **Step 2: Full gate.** `npx vitest run`, `npx vitest run src/db/live.test.ts` (six checks, including the new `DELETE_ALLOWED_FUNCTIONS` entry), `npx tsc --noEmit` (no NEW errors beyond the documented pre-existing ones), `npm run lint` (no new problems beyond the baseline 12), `npx next build --webpack`, `npx playwright test`. Report each honestly; do not weaken an assertion to make one green.
- [ ] **Step 3: Commit:** `test: meeting-load e2e coverage and full verification gate (B18)`

---

## Open questions for the human

1. **R2 SHORTEN has no exact copy string in the spec**, unlike R1/R3/R4/R5, which all give quoted sentences. Task 9 Step 4 builds a numbers-only template as a placeholder-free stand-in and flags it for sign-off rather than inventing wording that would read as spec-authoritative.
2. **R3's Sinhala purpose-token vocabulary is never enumerated.** The spec explicitly requires "Sinhala equivalents in the same tested list" for standup/retro/planning/crit/review/demo/sync/1:1/postmortem, but — unlike `attendee-series.ts`'s weekday list, which spells every Sinhala word out — gives none of them. Shipping guessed translations risks the veto silently failing to protect Sinhala-titled meetings exactly where it matters most; Task 9 Step 5 stubs this with a loud TODO rather than guessing.
3. **The accept/dismiss guard for `share_slot` is ambiguous with two organizers.** The spec's guard text ("`session.user.id === createdBy` of the target series' most recent occurrence") is written for a single-series `targetKey`, but `share_slot` targets a sorted PAIR of series that may have two different organizers. Must either organizer be able to accept/dismiss on behalf of both, must both consent, or is this action admin-only for `share_slot` specifically? Task 13 implements a best-effort reading and flags the choice for review rather than silently picking one interpretation as if the spec said so.
