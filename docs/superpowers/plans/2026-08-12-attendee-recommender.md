# Meeting Attendee Recommender (A1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recommend who is required / optional / can skip for a meeting, pre-fill the invite list while scheduling, and make `optional` a real invite property that reaches Google Calendar and `.ics`.

**Architecture:** A deterministic 100-point evidence ledger computed by pure modules with sibling `.test.ts`, a thin orchestrator that gathers DB facts, and an optional Gemini pass that can add at most 10 points and promote at most two people one tier upward with cited evidence. Four surfaces read the same engine.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle + Neon Postgres (NO transactions — `db.batch` only), Tailwind v4 + shadcn (Base UI), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-12-meeting-attendee-recommender-design.md`. It is long and authoritative — each task below names the spec sections to read before coding. Where this plan and the spec disagree, the spec wins; say so in your report.

**Scope split:** The skipper recap (stage/hold/release, `notification_type` + `'recap'`, `users.recapOptOut`, the cron release, the recap dialog) is **A2, a separate plan**. Do not build it here. This plan ends with a working recommender.

**Branch:** `feat/attendee-recommender`, worktree `/Users/deeghayuadhikari/Documents/GitHub/LogPup-sdd-a`, stacked on `feat/soft-deletes`.

## Global Constraints

- **Soft deletes are live.** Every read of `meetings`/`tasks`/`sprints`/`meeting_note_segments`/`meeting_screenshots` MUST go through the `live*` subqueries in `src/db/live.ts`. `src/db/live.test.ts` enforces this with six checks and WILL fail the build otherwise. Meeting child tables are live-iff-meeting-live — join `liveMeetings`. Never add yourself to its ALLOWLIST.
- **Migration numbering:** the last applied is `0025_soft_delete`. Use `0026_...`. Register it in `drizzle/meta/_journal.json` with a `when` **strictly greater than the newest `created_at` already in `drizzle.__drizzle_migrations`** or `db:migrate` silently skips it. Separate every statement with the drizzle breakpoint marker, and never write that marker inside a comment — the splitter is a plain string split. `db:migrate` has been observed exiting silently without applying; verify against the DB after running, and apply directly via drizzle `sql.raw` if it no-ops.
- **No transactions** (neon-http). Multi-row writes use `db.batch`.
- Writes are Server Actions returning `ActionResult` (`src/lib/action-result.ts`); error strings are plain human sentences. Reads live in `queries.ts`. Mutations end in the existing revalidate helpers — and `revalidateAdmin()` where a surface an admin sees is affected.
- **Visibility rule (user-confirmed, non-negotiable):** the numeric score, the full reason ledger, the not-recommended list, AI-override detail and ALL retrospective output are visible only to `meeting.createdBy` and admins. Everyone else — including the person themselves — sees tier and positive reasons, **no number**. Redaction happens in the action's return **shape** (keys structurally absent), never in CSS.
- **No negative terms exist anywhere in the ledger.** No signal may subtract. Absent evidence contributes 0 with a caveat line, never a penalty. There is no demotion path and no negative per-person reason template.
- Pure logic goes in its own module with a sibling `.test.ts` (house style). DB access never enters a pure module.
- Read `node_modules/next/dist/docs/` before touching Server Actions or revalidation (AGENTS.md).
- Known pre-existing failures to leave alone: `ai-actions.ts:909` and `:1525` TS2554 (`selectCarriedForward`, the user's in-flight work); `npm run lint` baseline 12 problems; `smoke.spec.ts` drag test.

---

### Task 1: Schema, migration, and `optional` plumbing

**Files:**
- Create: `drizzle/0026_attendee_recommendations.sql`
- Modify: `src/db/schema.ts`, `src/features/meetings/ics.ts` (~:213), `src/features/calendar/google-calendar.ts` (~:28), `src/features/meetings/queries.ts` (attachAttendees), `src/app/api/meetings/[id]/ics/route.ts`, `src/features/admin/backup.ts`, `src/features/admin/actions.ts` (clearTestData enumeration)

**Interfaces:**
- Produces: `meetingAttendees.optional` (boolean, NOT NULL, default false) and the `meetingAttendeeRecommendations` table with columns `meetingId`, `userId`, `surface`, `score`, `scoreDet`, `tier`, `hardEvidenceCount`, `reasons` (jsonb), `aiOverride` (jsonb), `aiOverrideRejected` (jsonb), `status` (reuses the existing `suggestionStatus` enum, default `'open'`), `createdAt`, `updatedAt`; unique index on `(meetingId, userId)`.

Read first: spec section "Section 1 — Data model & modules".

- [ ] **Step 1: Write the migration** with breakpoint markers between every statement. `ALTER TABLE "meeting_attendees" ADD COLUMN IF NOT EXISTS "optional" boolean NOT NULL DEFAULT false;` then `CREATE TABLE IF NOT EXISTS "meeting_attendee_recommendations" (...)` with the columns above, `meeting_id` and `user_id` FKs (`ON DELETE cascade` for meeting), and `CREATE UNIQUE INDEX IF NOT EXISTS "meeting_attendee_recs_meeting_user_idx" ON "meeting_attendee_recommendations" ("meeting_id","user_id");`. Add an index on `("meeting_id","surface")`. Also `CREATE INDEX IF NOT EXISTS "meeting_note_segments_meeting_idx" ON "meeting_note_segments" ("meeting_id");` — the table has none and E5 scans it — and `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aliases" text[];`.
- [ ] **Step 2: Mirror all of it in `src/db/schema.ts`**, including the indexes (a declaration that drifts from the SQL lets a future `drizzle-kit generate` propose undoing it — this exact defect was caught in the soft-delete work). `surface` is a `text` column with a TS union type `'schedule' | 'pre' | 'retro' | 'series'`, not a new pg enum (adding enum values is a separate migration and Postgres forbids using a new value in the transaction that added it).
- [ ] **Step 3: Plumb `optional` outward.** `ics.ts` currently hardcodes `ROLE=REQ-PARTICIPANT`; make it emit `ROLE=OPT-PARTICIPANT` when the attendee is optional (extend `IcsPerson` with `optional?: boolean`). `google-calendar.ts` maps `attendeeEmails.map(email => ({ email }))` — carry `{ email, optional }`. `attachAttendees` in `queries.ts` must select and return the flag. Update the ICS route accordingly.
- [ ] **Step 4: Extend `ics.test.ts`** — an optional attendee renders `ROLE=OPT-PARTICIPANT`, a required one still renders `ROLE=REQ-PARTICIPANT`, and folding/CRLF invariants still hold. The module is pure and clock-free; keep it that way.
- [ ] **Step 5: Add the new table to `backup.ts`'s enumeration and to `clearTestData`'s delete list.** Both enumerate tables explicitly and will silently miss it otherwise.
- [ ] **Step 6: Apply and verify.** Run `npm run db:migrate`, then query `information_schema.columns` to confirm `meeting_attendees.optional` and the new table exist. If migrate no-ops, apply via drizzle `sql.raw` (see Global Constraints) and say so in your report.
- [ ] **Step 7: Verify + commit.** `npx vitest run`, `npx tsc --noEmit`, `npx vitest run src/db/live.test.ts`. Commit: `feat: attendee recommendation schema and optional-attendee plumbing (A1-1)`

### Task 2: `seriesKey` — pure series inference

**Files:** Create `src/features/meetings/attendee-series.ts`, `src/features/meetings/attendee-series.test.ts`

**Interfaces:**
- Produces: `seriesKey(title: string): string | null`, and `sameSeries(a: {title, appId}, b: {title, appId}): boolean`.

Read first: spec section "Series rule". It specifies the normalisation steps in order and the exact tolerance rules.

- [ ] **Step 1: Write the failing tests first.** Cover, at minimum: `'Vela Weekly'`, `'Vela weekly (Tue)'` and `'Weekly Vela sync — 12/08'` collapse appropriately; weekday names including the Sinhala සඳුදා-family are stripped; month names, ordinals (`1st`), date-like tokens, clock times, and `#12`/`w4`/`sprint 3` are stripped; cadence words (daily/weekly/biweekly/fortnightly/monthly) are stripped but content words (`sync`, `standup`) are NOT; a title reducing to under 3 characters or zero non-stopword tokens returns `null`; `sameSeries` requires equal key AND equal `appId` (both null counts as equal).
- [ ] **Step 2: Run them, watch them fail.** `npx vitest run src/features/meetings/attendee-series.test.ts`
- [ ] **Step 3: Implement** exactly the ordered steps from the spec: NFKC normalise, lowercase, strip a trailing parenthetical, delete the token classes above, delete cadence words only, collapse non-alphanumeric runs to single spaces, trim.
- [ ] **Step 4: Tests pass. Commit:** `feat: pure seriesKey normaliser for inferred meeting series (A1-2)`

### Task 3: Agenda topic buckets and app matching

**Files:** Create `src/lib/agenda-topics.ts` + `.test.ts`; create `src/lib/app-match.ts` + `.test.ts` (extract `matchApp` from `src/features/meetings/components/meeting-form.tsx` ~:86 and have the form import it)

**Interfaces:**
- Produces: `TOPIC_BUCKETS` (array of `{ keywords: string[], primaryRoles: string[], adjacentRoles: string[] }`), `matchAgendaTopic(text: string, roleTokens: string[]): { hit: 'primary' | 'adjacent' | 'tech' | 'none', bucket?: string, quote?: string }`, and `matchApp(text, apps)`.

Read first: spec signal **E3**.

- [ ] **Step 1: Write the lint test FIRST — it is the point of this task.** Assert that **every** value in `JOB_ROLES` (`src/lib/job-roles.ts`) appears in at least one bucket's `primaryRoles` or `adjacentRoles`. An 8-bucket table over a ~70-role vocabulary silently zeroes Support, Finance, HR, Marketing and every generalist engineer, and a structural 0 is indistinguishable in the UI from "we checked". Also test: whole-word matching only (`'design'` must not match `'redesigned'`), case-insensitivity, and that a role matching no bucket yields `'none'` (treated as UNKNOWN by the scorer, never a subtraction).
- [ ] **Step 2: Run, watch fail. Implement** the bucket table until the lint passes. Roles must be quoted verbatim from `JOB_ROLE_GROUPS`.
- [ ] **Step 3: Extract `matchApp`** into `src/lib/app-match.ts` with tests covering `users.aliases` and transliterated names; update `meeting-form.tsx` to import it.
- [ ] **Step 4: Commit:** `feat: agenda topic buckets with full role coverage lint (A1-3)`

### Task 4: The scorer — `attendee-score.ts`

**Files:** Create `src/features/meetings/attendee-score.ts` + `.test.ts`

**Interfaces:**
- Consumes: `CandidateFacts` (see below) — a plain data shape, no DB types.
- Produces: `scoreCandidate(facts: CandidateFacts, ctx: ScoreContext): ScoredCandidate` and `tierAll(scored: ScoredCandidate[], ctx: ScoreContext): RecommendationRun`.
- `ScoredCandidate = { userId, scoreDet, scoreTotal, hardEvidenceCount, tier, reasons: Reason[], caveats: Caveat[] }`; `Reason = { code, points, evidence: { ids: string[] }, en: string, si: string }`.

Read first: spec sections "Signals", "Tiering", "Reason text", "Degradation". **This is the heart of the feature — read all four before writing a line.**

- [ ] **Step 1: Write the failing tests first, one named case per family.** E1 follow-ups (human-added scores 12, AI-derived 6, `kind:'action'` +2, recency multipliers, cap 30); E2 tasks (4/open cap 12, +2 in-progress cap 4, flat +4 sprint bonus, cap 20, zero tasks contributes exactly 0); E3 role/topic (primary 14, adjacent 7, tech-tag-only 3); E4 discussion points (2 per point, max 3 per meeting, recency, cap 10); E5 voice (**turn count, never characters** — a Sinhala-heavy fixture must not score lower than an English one for the same number of turns; unresolved speakers are UNAVAILABLE, never 0-as-judgement); E6 lead + allocation (cap 12); E7 attendance (cap 6); A1 (cap 10).
- [ ] **Step 2: Write the tiering tests.** `required` at `scoreDet >= 30` AND `hardEvidence >= 1`; `optional` at `scoreTotal >= 12`; else `skip`. Threshold edges exactly: 29+hard evidence → optional, 30 → required, 11 → skip, 12 → optional. Every floor: any allocation on the app, `apps.leadId`, `hardEvidence >= 1`, under-21-days-new, an existing human-created attendee row, an attendee of the previous occurrence, self opt-in. Hard overrides: organizer always required; a follow-up pinned via `targetMeetingId` always required. The E3 **required floor**: a primary role/topic hit on someone assigned to the app ⇒ required.
- [ ] **Step 3: Write the property test that guards the core invariant:** removing any single evidence item from a candidate's facts must never *raise* their tier. There are no negative terms; this test is what keeps it true.
- [ ] **Step 4: Write the abstain-mode tests.** Fewer than 2 distinct candidates carrying hard evidence ⇒ no tiers computed, no negative statement about anyone, organizer required, everyone eligible and assigned to the app pre-filled optional. On today's data this is the modal output — treat it as a first-class path, not an edge case.
- [ ] **Step 5: Write the degradation tests.** No `appId` (E2/E3/E6 unavailable, ceiling applies: nobody required except organizer, pinned-followup holder, or a series regular ≥0.75 over ≥3 occurrences); no transcripts (E4/E5 unavailable with caveats); tiny pool (≤4 ⇒ `skip` disabled entirely); no agenda (E3 falls back to title tokens, A1 not called).
- [ ] **Step 6: Run everything, watch it fail, then implement** `attendee-score.ts` as a pure function over injected facts and an injected `today`/`meetingDay` (never `new Date()` inside).
- [ ] **Step 7: Implement the reason templates** as a table of `{ code, en, si }` with a **lint test**: every template contains a NUMBER, a PROPER NOUN, or a DATE. Ban outright, asserted by test: "seems relevant", "often contributes", "likely needed", "key stakeholder", "high engagement", "usually attends" and every confidence adjective. Sinhala strings sit in the same table and are tested the same way.
- [ ] **Step 8: All tests pass. Commit:** `feat: deterministic attendee scoring ledger (A1-4)`

### Task 5: Validator, redaction projector, and reasons merge

**Files:** Create `src/features/meetings/gemini-validator.ts` + `.test.ts`, `src/features/meetings/recommendation-view.ts` + `.test.ts`, `src/features/meetings/reasons-merge.ts` + `.test.ts`

**Interfaces:**
- Produces: `validateRelevance(raw: unknown, ctx: { agenda: string, candidates: Map<string, CandidatePacket> }): ValidatedRelevance[]`; `validateOverride(...)`; `toFullView(rows)` / `toRedactedView(rows)`; `mergeReasons(existing, fresh)`.

Read first: spec sections "AI component (A1)", "AI override bounds", and the visibility rule in "Tiering".

- [ ] **Step 1: Validator tests first.** Five validations, each with a failing fixture: id must be in the issued opaque set (`c1..cN`); score clamped to integer 0..2; `agendaQuote` must be a verbatim ≥12-character case-insensitive substring of **the submitted agenda** (a quote matching past notes but not the agenda is REJECTED); `evidenceQuote` must be a verbatim substring of that candidate's own packet; `evidenceId` in the issued set or null. Any failure zeroes the entry — no partial credit, no retry. Also test: a fenced ```json block is stripped before parse, and a malformed payload yields `[]` rather than throwing.
- [ ] **Step 2: Override tests.** Upward only, exactly one step; at most 2 per run (extras discarded by lowest validated score, and logged); `optional→required` additionally requires `scoreDet >= 18`, `skip→optional` requires `>= 6`; demotion is structurally unavailable (discarded, never clamped); never overrides the organizer, a pinned-followup required, any floor, or anyone already deterministically required; **never runs on the retro surface**. Assert a candidate whose only points are a perfect A1 totals 10 and therefore cannot reach the 12-point optional line by AI alone.
- [ ] **Step 3: Redaction projector tests.** `toRedactedView` output must have `score`, `scoreDet`, `detail`, `notRecommended`, `aiOverride` and any retro rows **structurally absent** — assert with `Object.keys(...)`, not `toBeUndefined()`. Include a fixture whose reason `detail` carries sensitive source text and assert that string does not appear anywhere in the serialized redacted payload.
- [ ] **Step 4: Reasons-merge tests.** An upsert must preserve the reserved `selfOptIn` and `decision` keys and any non-`'open'` status against fresh scorer output — a recompute must never resurrect a dismissed card or erase a decision.
- [ ] **Step 5: Implement all three, tests pass. Commit:** `feat: bounded Gemini validation, redaction projector, reasons merge (A1-5)`

### Task 6: Fact gathering, orchestrator, and server actions

**Files:** Create `src/features/meetings/attendee-facts.ts`, `src/features/meetings/attendee-recommend.ts`, `src/features/meetings/attendee-ai.ts`, `src/features/meetings/attendee-actions.ts` (+ `attendee-actions.test.ts`); modify `src/features/meetings/actions.ts` (createMeeting), delete the `teamForApp` wrapper (~:481-487)

**Interfaces:**
- Produces the actions: `recommendAttendees(draft, opts)`, `getAttendeeRecommendations(meetingId)`, `runAttendeeRecommendations(meetingId, surface)`, `applyRecommendations(meetingId, decisions)`, `requestInclusion(meetingId)`.

Read first: spec "Section 5 — Server actions & hooks" (it gives each signature, its authorization, and its exact failure modes) and "Section 6 — Error handling".

- [ ] **Step 1: `attendee-facts.ts`** — batch the reads (`inArray` over candidate ids, group in JS; never loop per candidate). All meeting reads go through `liveMeetings`. Follow-ups are read with FULL visibility — never the caller-entitlement clause — or a person's public tier becomes a function of who opened the panel; the UI redacts to a bare count instead.
- [ ] **Step 2: `attendee-ai.ts`** — build the opaque packet (`c1..cN`, never a name or email; ≤8 task titles, ≤4 follow-up texts, plus role strings), call `callGemini(organizerId, parts, { responseJson: true })`, pass the result through the Task 5 validator. Agenda text is untrusted user input: pass it as delimited data, never interpolated into the instruction block, with a closed output schema.
- [ ] **Step 3: `attendee-recommend.ts`** — gather → score → optional AI pass → tier. `callGemini` throws, so it is only ever called inside a try/catch in an action, never from a Server Component. On any `GeminiError`, no key, or timeout: A1 contributes 0 for everyone, `aiSkipped` is set, and the deterministic result ships complete.
- [ ] **Step 4: Write the mocked-action tests** (idiom: `src/features/admin/set-user-title.test.ts`) BEFORE the actions: a non-organizer member gets `err` from `runAttendeeRecommendations`/`applyRecommendations` with `writeSpy` untouched; an attendee gets the RedactedView with no forbidden keys; an attendee on a PAST meeting gets `err` (retro leak); `recommendAttendees` returns `ok` with intact deterministic tiers when the Gemini stub throws; `requestInclusion` writes only rows whose `userId` equals the session user regardless of arguments; `applyRecommendations` on a row already `'accepted'` reports `alreadyHandled` and writes no attendee row.
- [ ] **Step 5: Implement the actions.** Upserts are read-merge-write through `mergeReasons`, then `onConflictDoUpdate` on the unique index, all in one `db.batch`. `applyRecommendations` commits every staged decision in ONE batch and performs ONE best-effort calendar sync — never one sync per card, which would emit N machine-timed invitation emails and become a tier side-channel. There is deliberately **no `remove`/uninvite decision**: demotion caps at optional.
- [ ] **Step 6: Extend `createMeeting`** — the zod input grows `optionalAttendeeIds` (server **filters** to a subset of `attendeeIds`, never errs) and `recommendationSnapshot` (ids filtered against known users). Snapshot rows are written with `surface: 'schedule'` inside the SAME existing `db.batch` as the meeting and attendee rows. Delete the `teamForApp` wrapper.
- [ ] **Step 7: Verify + commit.** Full suite, `tsc`, `live.test.ts` all green. Commit: `feat: attendee recommendation actions and orchestrator (A1-6)`

### Task 7: Scheduling surface

**Files:** Create `src/features/meetings/attendee-selection.ts` + `.test.ts`; modify `src/features/meetings/components/meeting-form.tsx` (attendee block ~:491-553, `handleAppChange` ~:260-269, quick-add effect ~:195-209)

**Interfaces:**
- Produces: `applyRecommendation(state, run, touchedIds)`, `setAttendees(state, next)` — one pure setter through which every mutation routes.

Read first: spec "Section 3 — Surfaces", surface 1.

- [ ] **Step 1: Write `attendee-selection.test.ts` first.** The invariant `optionalIds ⊆ attendeeIds` holds across all three mutation paths (app-change replace, quick-add merge, badge remove). A late AI result NEVER changes a row the organizer has touched since the run started (`touchedIds`), and is discarded entirely on a draft-hash or edit-counter mismatch. Manual edits always win.
- [ ] **Step 2: Implement the pure module; route every existing mutation path through it.** `FormState` gains `optionalIds: string[]`. **Delete the wholesale team prefill** — two writers to one `setState` is a visible race — and re-expose it only as an explicit, clearly-unscored "Add the whole team (N)" button used by abstain mode.
- [ ] **Step 3: Wire the UI.** On app-select and on dialog-open-with-`defaultAppId`, call `recommendAttendees` twice: `{ withAi: false }` for an instant deterministic render, then `{ withAi: true }` in the background. Submit is NEVER disabled while recommending. Render Required and Optional badge groups pre-checked, a per-badge Optional toggle, a collapsed "Not suggested (N)" disclosure, and the abstain banner when the run abstains.
- [ ] **Step 4: The per-person popover shows CATEGORY-LEVEL reasons only** on this surface — never item text, note excerpts, or source-meeting titles. No meeting row exists yet, so there is no `createdBy` to check; evidence detail is therefore structurally withheld here and arrives after creation via `getAttendeeRecommendations`. Assert this in a test on the action's return shape.
- [ ] **Step 5: Verify + commit.** Commit: `feat: attendee recommendations in the scheduling form (A1-7)`

### Task 8: Pre-meeting, retrospective, and series surfaces

**Files:** Create `src/features/meetings/components/attendee-recommendations.tsx` (one component, `surface` prop, shared by pre-meeting and retro); modify `src/features/meetings/components/meeting-intel.tsx` (open-body stack ~:1637-1676), `src/features/meetings/components/meeting-detail-dialog.tsx` (attendee section ~:291-320, the "Ask to be included" button), `src/features/meetings/queries.ts` (add `getSeriesDrift`), `src/app/(app)/apps/[slug]/page.tsx` (mount drift in the existing `Promise.all`)

Read first: spec "Section 3 — Surfaces", surfaces 2, 3 and 4.

- [ ] **Step 1: Pre-meeting.** Fetch-on-expand via `getAttendeeRecommendations` — deliberately NOT on `getMeetingIntel`, whose IntersectionObserver prefetch fires for every visible row. Decisions are **staged, not fired per click**: per-card controls accumulate into a sticky "Apply changes (N)" bar that commits in one call, with disclosure copy above it stating attendees will get one updated calendar invite.
- [ ] **Step 2: Retrospective.** Same component with `surface='retro'`, rendered when the meeting is past. Read-only: "Invited — could have been optional" and "Not invited — had evidence". Never tiers `skip` for anyone who holds an attendee row, stores no per-person negative reason, and never calls Gemini. Organizer/admin only — an attendee must receive nothing.
- [ ] **Step 3: `getSeriesDrift`** as a query (not an action), called from the app page's existing `Promise.all`. Eligibility (admin OR creator of ALL occurrences in the window) is checked FIRST with one cheap query; ineligible returns `[]` **before any evidence read**, so the data never enters another viewer's payload. Nothing on this surface ever writes.
- [ ] **Step 4: Test the gating** with mocked-action tests: attendee sees RedactedView on an upcoming meeting; attendee gets `err` on a past meeting; a non-creator non-admin gets `[]` from drift.
- [ ] **Step 5: Verify + commit.** Commit: `feat: pre-meeting, retrospective and series drift surfaces (A1-8)`

### Task 9: E2E and the full gate

**Files:** Create an `e2e/attendee-recommender.spec.ts` following the existing harness (workers:1, port 3400, `E2E_TEST_MODE=1`, storageState from the single dev-login admin, RUN_ID-tagged rows cleaned in `afterAll` via the direct `{ db }` import)

- [ ] **Step 1: E2E.** (1) Open the new-meeting form with a seeded app and assert the abstain banner appears by construction (a single user cannot produce 2 hard-evidence candidates), the organizer chip is present, no tier labels are shown, and submit stays enabled while resolving. (2) Toggle an attendee to Optional, create the meeting, reload, and assert the optional marker survives — plus a direct DB read of `meeting_attendees.optional`. (3) Assert a member viewing the meeting sees no numeric score anywhere in the DOM.
- [ ] **Step 2: Full gate.** `npx vitest run`, `npx vitest run src/db/live.test.ts` (six checks), `npx tsc --noEmit` (no NEW errors), `npm run lint` (no new problems), `npx next build --webpack`, `npx playwright test`. Report each honestly; do not weaken an assertion to make one green.
- [ ] **Step 3: Commit:** `test: attendee recommender e2e coverage (A1-9)`
