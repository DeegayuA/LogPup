# Meeting coverage — R6 COVER-TOGETHER

**Date:** 2026-08-21
**Status:** SHIPPED 2026-08-21 — all six steps of §9. See §11.
**Host:** rule six of the suggestion engine in
`docs/superpowers/specs/2026-08-12-meeting-load-reduction-design.md`

## The problem, stated exactly

Several things need deciding. Each needs certain people in the room. Today each
one drifts into its own meeting, so the same five people sit in three half-hour
calls that could have been one.

Given open asks `{a₁…aₙ}` where ask `aᵢ` requires a set of people `Pᵢ`, propose
groups `G₁…G_k` such that every ask lands in one group whose attendee set covers
its `Pᵢ`, minimising `k` — subject to the guards in §5, because the unguarded
minimum of `k` is always 1: one meeting, everybody, forever.

> **Same five people, four open items — one thirty-minute slot instead of four?**

## 1. This is a sixth rule, not a sixth page

Sub-project B already designs a suggestion engine at `/meetings/load` with an
identity and lifecycle contract, an accept/dismiss table, and four surfaces.
Its five rules (`…meeting-load-reduction-design.md:100-104`) all **reduce
meetings that already exist**: cancel a dead series, shorten a long one, share
a slot between two, record-or-review a dark one, trim an invite list.

None of them prevents a meeting that has not been scheduled yet. That is the
gap this fills, and it is a rule in that engine rather than a route of its own.

**R6 COVER-TOGETHER** — two or more open asks whose required-people sets union
to at most eight; total person-minutes strictly lower as one meeting than as
separate ones; purpose-token veto passes. Copy is a question, never a value
claim, per the engine's stated rule for R1 and R3:

> "Same people, same week — could these share one slot?" (R3, `:102`)
> "Same five people, four open items — one slot instead of four?" (R6)

### R6 should be the rule that ships the engine

R1–R5 all need the recording pipeline: analysed occurrences, AI-derived output
counts, participation medians, per-model comparison, `hardEvidenceCount` pools.
That is why B is 83 tasks with none ticked.

R6 needs none of it. It reads open follow-ups and committed deadlines — rows
that exist today, on every workspace, recorded or not. So R6 can land
`/meetings/load`, the `meeting_load_decisions` table, the suggestion card and
the `targetKey` lifecycle, and R1–R5 then slot in with no new plumbing.

## 2. What this reuses instead of building

| Existing | Where | What it gives R6 |
|---|---|---|
| **Ask derivation** | `src/features/meetings/planner.ts:246` `assembleMeetingPlan` | `ASK_KINDS = ['followup','checkin','overdue','health','stalled','unassigned']` and `PlannerAsk` — already the exact unit of work R6 groups. Today it runs for ONE meeting; R6 runs the same derivation workspace-wide. |
| **Group-size cap** | `attendee-score.ts:1261` `tierAll` | `requiredOverflow: requiredCount > 8` already encodes "this room is too big". Reuse the constant; a second number would drift from it. |
| **Purpose veto** | `…load-reduction-design.md:102` | An approved token list — standup, retro, planning, crit, review, demo, sync, 1:1, postmortem, Sinhala equivalents — that must never be merged across. |
| **Identity + never-re-show** | `…load-reduction-design.md:110` | `targetKey`, the unique index on `(kind, target_key)`, the evidence jsonb snapshot, admin-only Reopen. R6 inherits all of it. |

`planner.ts`'s doctrine carries over unchanged and is not up for revisiting:

- **Derivation, never a stored list.** "A stale ask-list is worse than none."
  Open suggestions are computed live; only *decisions* are stored.
- **Suggestions, never invites.** Accepting must not write `meeting_attendees`.
  It opens a prefilled form and a human presses save. The engine says the same
  thing at `:110`: *"Accept is ADVISORY ONLY."*

## 3. The unit of work, and who each one requires

`Pᵢ` is the whole design. Get it wrong and the cover is arithmetic over
nonsense. Required sets are per ask kind, never generic:

| Ask kind | Source | Required `Pᵢ` | Why |
|---|---|---|---|
| `followup` open | `meeting_followups` `status='open'` (schema.ts:813) | owner (`userId` :811, or `personName` :812 resolved by `followups.ts:32` `matchPersonToAttendee`) **+ `createdBy`** (:823) | A follow-up is one person owing an answer to another. Without both it is a status update, not a decision. |
| `followup` **pinned** | same, `targetMeetingId is not null` (:824) | same, and the ask is **forced into a group** | The strongest "needs a conversation" flag in the schema — somebody already said out loud this belongs in a meeting. `attendee-score.ts:298` already treats it as a hard override. |
| `overdue` committed | `tasks.dueKind='committed'` past `dueDate` (:412, :419) | `assigneeId` (:390) + the app's `pmId` (**NOT NULL**, :206) | A slipping *commitment* is a conversation with whoever it was promised to. |
| `stalled` / `checkin` | `checkinGap === 'unknown'` (`sprints/checkins.ts`, used at `planner.ts:31`) | `assigneeId` + `pmId` | The gap is literally "nobody knows". |

`leadId` (:199, nullable) joins as **optional** — present on the proposal, never
a reason to enlarge the group. `src/lib/project-roles.ts` already sets the rule:
*a manager runs the project and its meetings; a lead or architect is a busy
reviewer.* Reviewers are optional attendees.

### Excluded from v1, each with its reason

- **`change_requests` pending** — needs a signature, not a room. `mayReview`
  (`change-request-routing.ts:31`) hands over an exact required set, which is
  what makes it tempting; approving in a meeting is strictly slower than
  approving in the inbox at `/admin/approvals`.
- **`tasks.dueKind='target'`** — a target that slips is information. Only a
  `committed` deadline is a promise somebody made to somebody.
- **`bug_reports`** — triage is a queue, and `/admin/bugs` already pages it.
- **`app_grants`** — a grant is visibility, never responsibility. It must never
  put somebody in a room.

## 4. The algorithm

Greedy weighted set cover, seeded from the asks themselves. No subset
enumeration: the candidate attendee sets are exactly the ones some ask demands.

```
uncovered ← all asks
groups    ← []

while uncovered is non-empty:
    best ← null
    for each seed ask s in uncovered:                      # O(n) seeds
        A ← Pₛ ; covered ← { s }
        for each other ask t in uncovered, in ask order:   # O(n) absorption
            if |A ∪ Pₜ| ≤ CAP and not vetoed(covered, t):
                A ← A ∪ Pₜ ; covered ← covered ∪ { t }
        score ← |covered| / cost(A, |covered|)
        best  ← better of (best, (A, covered, score))
    if |best.covered| < 2: break                           # §5 singleton guard
    groups ← groups + best ; uncovered ← uncovered − best.covered
```

`cost(A, m) = |A| × duration(m)` — person-minutes, the thing actually being
spent. Dividing coverage by it is what stops the greedy choosing "everyone, one
meeting": adding a sixth person to clear a fifth item has to pay for itself.

`duration(m) = min(60, ceil15(15 + 10 × (m − 1)))` — one item is a fifteen
minute conversation, each further item adds ten, rounded to the quarter hour the
grid already snaps to (`meeting-form.tsx:99` `roundUpToStep`), capped at an hour
because a proposal longer than that is not a saving.

**Determinism is required, not preferred.** Ties break on: more items covered,
then fewer attendees, then lowest seed ask id. Like `planner.ts` and
`intel/signals.ts`, the module takes `now` as an input and never calls
`new Date()`. Same inputs, same plan, every run — which is also what makes
`targetKey` stable enough to dismiss.

`O(n²)` per round, n in the tens. Not worth a smarter algorithm.

**`targetKey`** follows the engine's shape (`:110`), using the sorted ask ids so
a group keeps its identity across runs and a dismissal sticks:
`cover:<sha256 of sorted ask ids>|<appId ?? '__none__'>`. Adding a sixth ask
legitimately mints a new suggestion, exactly as a title edit forks a
`seriesKey`.

## 5. Guards — the reason it does not degenerate

Each is a test in `coverage.test.ts`, not a comment.

1. **Attendee cap of 8**, reusing `attendee-score.ts`'s existing overflow
   threshold rather than a second number.
2. **No singleton groups.** A group of one ask is not a meeting, it is the ask.
3. **Purpose veto** — R3's list, shared. This wants the
   `src/features/meetings/series-key.ts` the R3 spec asks for at `:146`; today
   the normaliser is stranded at `attendee-series.ts:154`. Move it, never copy.
4. **Only people who can hold work.** `getTeamForApp` (`people/queries.ts:154`)
   does **not** filter deactivated or removed users — documented at
   `…attendee-recommender-design.md:115`. Use `listActiveUsers()` / `canHoldWork()`.
5. **Absences and non-working days.** Drop anyone with an approved absence over
   the window (`absence-queries.ts:67`, **both bounds inclusive**) and never
   propose a day `working-days.ts:43` scores 0. Saturday is 0.5 and still counts.
6. **Soft deletes.** Every read goes through `src/db/live.ts`'s `live*`
   subqueries or `live.test.ts` fails the build.
7. **No pending or declined input reaches the rule** — asserted structurally on
   the rule's input type, the same way B tests R1–R5 (`:153`).

## 6. Which page, which button

**The page is `/meetings/load`** — B's route (`:120` lists its surfaces), not a
new one. R6 renders as another card in the same suggestion queue.

**Entry, three ways, one primary:**

| Where | Anchor | What |
|---|---|---|
| **Primary** | `src/app/(app)/meetings/page.tsx:74-79`, beside "New meeting" | A secondary `Button` → `/meetings/load`. The label states the finding, not the feature: **"4 meetings could be 2"** when the sweep finds something, **"Meeting load"** when it does not. A button that reports its own answer gets pressed; one called "Coverage optimiser" does not. |
| Palette | `src/features/meetings/commands.ts`, beside `meetings.new` (`:14-20`) | `meetings.load`. Keywords: fewer meetings, merge, combine, load, coverage. |
| Ambient | `src/features/intel/signals.ts:27` | One new `SignalKind`, `'meeting.mergeable'`. The board already renders `{title, detail, href, count, severity}`, so this costs a union member, a detector and a test. This is how somebody finds it without knowing it exists. |

**The button that matters is on the card.** Each group renders as the people,
the asks it clears, and the duration, with one primary action:

> **Schedule this** → opens the existing `MeetingForm`
> (`components/meeting-form.tsx`) with `defaultOpen`, `attendeeIds` set to the
> group, `appIds` from the asks, and `agenda` pre-written one line per ask.

No new form, no new write path, no new validation. The proposal ends where the
create flow begins — which is what "suggestions, never invites" means in
practice. **Dismiss** writes a `meeting_load_decisions` row with the evidence
snapshot, so it never comes back; admin-only Reopen is the escape hatch, per
`:110`.

## 7. What v1 does NOT do, and what it would take

**It does not propose a time.** There is no free/busy anywhere:
`src/features/calendar/google-calendar.ts` is write-only — grep for `freebusy`
across `src/` returns zero hits — and `calendar-overlap.ts` is pixel lane-packing
for drawing, not scheduling. So R6 proposes **who, what, and how long**, and the
human picks the slot on the time grid that already exists.

Proposing a time means building a busy-map from `meetings ⋈ meeting_attendees`
(dropping `response='declined'`, through `liveMeetings`) intersected with
`work_schedules` (`schedules.ts:68` `patternForDay`), approved absences and
`working-days.ts`. That is the whole of v2. It must not be smuggled into v1,
where it would be the only part that can be wrong in a way nobody notices.

## 8. Files

```
src/features/meetings/
  coverage.ts            NEW  pure. CoverageInput → CoveragePlan. No @/db, no new Date()
  coverage.test.ts       NEW  the whole of §3 and §5, by value
  series-key.ts          NEW  moved from attendee-series.ts:154, shared with R3 (spec :146)
  planner.ts             EDIT extract per-project ask derivation so the single-meeting planner
                              and the workspace sweep call one function. "Plan the meeting"
                              must come out byte-for-byte unchanged
  load-actions.ts        NEW  'use server'. getMeetingLoadSuggestions() / dismissSuggestion()
  components/
    load-board.tsx       NEW  'use client'. The queue; R6 cards today, R1–R5 later
  commands.ts            EDIT one ⌘K row

src/app/(app)/meetings/load/
  page.tsx  loading.tsx  error.tsx   NEW  Suspense-split: controls render before data

src/features/intel/signals.ts        EDIT one SignalKind: 'meeting.mergeable'

drizzle/0054_meeting_load_decisions.sql   NEW  B's one table. Hand-written + journal entry;
                                               drizzle-kit generate is forbidden in this repo
```

## 9. Order of work

1. `coverage.ts` + `coverage.test.ts` — the cover, against hand-written asks.
   Nothing else can be judged until the algorithm is right.
2. Extract ask derivation from `planner.ts`; prove "Plan the meeting" unchanged.
3. Move `seriesKey` into `series-key.ts`; share the purpose veto with R3.
4. `0054_meeting_load_decisions` + `load-actions.ts`, all reads via `live.ts`.
5. `/meetings/load` + `load-board.tsx` — skeleton, empty and error states.
6. The three entries: meetings-page button, ⌘K row, intel signal.

Steps 1–3 hold the risk. 4–6 are assembly. R1–R5 land afterwards on the same
board with no new plumbing.

## 10. Open question for the owner

R6 as specified reads only rows that exist on every workspace, so it can ship
before the recording pipeline R1–R5 depend on. The alternative is to wait and
ship B in rule order. Shipping R6 first means `/meetings/load` launches with one
rule on it and a page title promising more — worth deciding before step 5.

---

## 11. What shipped, and where it differs from this plan

All six steps of §9 are done. 3451 tests pass, `tsc` and lint are clean.

| Step | Landed as |
|---|---|
| 1 | `coverage.ts`, `coverage.test.ts` — 48 tests over §3 and §5 |
| 2 | `ask-derivation.ts`; `planner.ts` rewired, output unchanged |
| 3 | `series-key.ts` + the shared purpose veto; `attendee-series.ts` keeps `sameSeries` |
| 4 | `0054_meeting_load_decisions` + journal, `meetingLoadDecisions`, `load-actions.ts` |
| 5 | `/meetings/load` page/loading/error, `load-board.tsx` |
| 6 | meetings-page button, `meetings.load` palette row, `meeting.mergeable` signal |

### §10 answered: R6 shipped first

The plan's own argument won — R6 reads rows that exist on every workspace, so
waiting for the recording pipeline would have held the route, the table and the
lifecycle hostage to five rules that cannot run yet.

The "page title promising more" worry is handled by not promising: the page is
called **Meeting load**, not "Suggestions", and its empty state reads as a
complete answer ("Nothing worth combining right now") rather than a placeholder
for rules that have not arrived.

### Four places the implementation departs from the text

1. **The pseudocode in §4 absorbs unconditionally, and that is a defect.**
   `if |A ∪ Pₜ| ≤ CAP and not vetoed(...)` takes in any ask that fits, so one
   cheap unrelated ask drags in a sixth person, pushes the group past what the
   separate meetings cost, and the whole suggestion evaporates — a good group
   would disappear because somebody elsewhere gained a follow-up. Absorption is
   now scored (`>=`, so a free absorption still happens). This implements §4's
   own prose: *"adding a sixth person to clear a fifth item has to pay for
   itself."* Pinned in `coverage.test.ts` as "stops absorbing once an extra ask
   stops paying for itself".

2. **R6 never proposes merging fewer than four asks**, which follows from the
   §4 formula and is worth deciding on. `ceil15(15 + 10(m−1))` equals `15m`
   exactly at m=2 and m=3, so the strictly-lower guard can never fire below
   four items. The headline sentence in this plan ("four open items — one
   **thirty**-minute slot") also disagrees with the formula, which gives 45
   minutes for four. The formula was implemented, being the normative half.
   Dropping the round-up, or snapping down, would make pairs and triples
   proposable — a real product decision, not a bug fix.

3. **"Forced into a group" for a pinned follow-up** is implemented as: sorted
   first so it seeds and is absorbed first, and exempt from the person-minutes
   guard — a human already said it needs a room and the arithmetic does not get
   to overrule them. It is NOT exempt from the cap, the veto, or the singleton
   guard: "this needs a meeting" is not "this needs a meeting with anyone".

4. **The purpose veto reads the source meeting's title**, since an ask has no
   title of its own. Only follow-ups carry a purpose; task-derived asks have
   none, and a null purpose merges with anything. The veto is therefore
   permissive — it blocks the crossings it can name and is silent about the
   rest. Safe for a suggestion a human accepts, unsafe for anything that acts
   on its own, which is why nothing built on it may be wired to a write. The
   Sinhala list is deliberately three words: a wrong entry asserts a title
   means something it does not, a missing one only leaves the veto quiet.

### Still not done, deliberately

**R1–R5.** Unchanged from §1: they need analysed occurrences, AI-derived output
counts and participation medians, none of which exist yet. They now have a
board, a table, a `targetKey` lifecycle and a decided-keys filter to arrive
into, which was the point of shipping R6 first.

**Proposing a time**, per §7. Still no free/busy anywhere. Cards say who, what
and how long, plus `notBefore` — the earliest day the studio works, which is a
floor, not a slot.
