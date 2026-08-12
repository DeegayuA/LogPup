# Meeting Load Reduction — Design Spec (sub-project B)

Date: 2026-08-12
Status: designed under "do all tasks" mandate; delegated decisions listed under Assumptions — veto by editing this file.
Suite: D soft deletes → A attendee recommender → **B (this spec)** → C people KPIs. B reads A's tables (`meeting_attendee_recommendations`, `meeting_attendees.optional`, shared `seriesKey`).

## Goal

Reduce total meeting load org-wide: honest invited-hours metrics, per-series drift and output analysis, and an advisory suggestion engine (merge / shorten / cancel-review / trim) a human applies.

## Metrics

### Invited hours per week (headline — renamed from attendee-hours)

**Computation.** SUM(LEAST(EXTRACT(EPOCH FROM ends_at - starts_at)/3600, 8) * count of non-declined attendee rows) grouped by date_trunc('week', starts_at AT TIME ZONE 'Asia/Colombo'). Joins meetings (schema.ts:187-200) x meeting_attendees (202-207). Reversed/zero-duration intervals contribute 0 and are flagged; 8h-clamped meetings listed as named outliers on the drill-down. Post-A: one added FILTER (WHERE optional) clause gives the required/optional split.

**Shown to.** Everyone. Dashboard card headline + 12-week hand-rolled SVG trend (AllocationTrend clone), one StatTile on /meetings, weekly table on /meetings/load.

**Why.** The org's cost line — but honestly named. Fixes the 'measures invited-hours, not load' major: every surface says 'invited hours', and the drill-down header carries the one-sentence definition 'hours on calendars, not hours in rooms — we cannot see attendance'. It is still the right headline because invitation cost is real and fully derivable; it just never claims to be attendance.

### Per-app invited hours

**Computation.** Same weekly query grouped by meetings.app_id with an explicit 'No app' bucket for NULL, joined to apps for names.

**Shown to.** Everyone, on /meetings/load.

**Why.** Answers 'where is the load going'. Caveat printed on the surface: app deletion moves history into 'No app' (ON DELETE SET NULL, schema.ts:189).

### Per-series table: occurrences, invited hours/occurrence, median duration, invite-churn count, outputs, participation, coverage

**Computation.** Series = A's seriesKey(title) + appId via ONE shared pure module at src/features/meetings/series-key.ts (A imports the identical normaliser). Established only: >=2 occurrences in the 6-occurrence/180-day window. JS grouping key `${key}|${appId ?? '__none__'}`; NULL-app series grouped but marked unmergeable. Churn = symmetric difference of invite sets between consecutive occurrences, as a COUNT. Computed in memory over all meetings (trivial at 9 people).

**Shown to.** Everyone sees the numbers as counts on /meetings/load. The names behind churn are organizer+admin only, resolved by a separate gated query — the org-facing query's row type structurally contains no userIds.

**Why.** Series is where behavior change happens, and this table is the sole input to the suggestion engine, so every suggestion is visibly derived from numbers the reader already saw.

### Participation per analyzed occurrence (NEW — the CANCEL veto)

**Computation.** Per occurrence with analysis: COUNT(meeting_note_segments rows WHERE meetingId=m.id AND source='voice') as turns, COUNT(DISTINCT speakerId) FILTER (WHERE speakerId IS NOT NULL) as mapped speakers (schema.ts:361-386). Series-level: medians over analyzed occurrences. Waits for A's meetingId index before shipping (no index today — grounding trap).

**Shown to.** Everyone at series level ('median 34 turns across 5 speakers').

**Why.** Fixes the blocker where zero-artifact rules cannibalize alive meetings: a design crit with 40 turns across 6 speakers is demonstrably alive even with zero extracted artifacts, and this metric vetoes cancel-review on it. Also gives recorded meetings a visible upside, countering the don't-record incentive.

### Outputs per analyzed occurrence, split AI-derived vs manual, plus analysis coverage

**Computation.** AI-derived: COUNT(meeting_followups WHERE sourceMeetingId=m.id AND createdBy IS NULL) + COUNT(meeting_task_suggestions WHERE status='accepted' — status, never createdTaskId which nulls on task delete) + jsonb deadlines length from meeting_ai_notes (null-guarded, unpacked in a pure JS module). Manual: followups with createdBy NOT NULL, displayed as a separate count. Denominator restricted to occurrences with a meeting_ai_notes row; coverage = analyzed/total always rendered beside it. Each occurrence annotated with meetingAiNotes.model; trend lines break at model boundaries and rules never compare across one.

**Shown to.** Everyone at series/app level, labelled 'tracked outputs per analyzed occurrence' — the word 'decisions' never appears (no decisions artifact exists). NO per-organizer cut exists at any visibility level.

**Why.** Fixes three majors at once: the manual/AI split makes the 30-second gaming vector (junk manual followup immunizes a series AND inflates A's E1 evidence) visible and excludes it from rules; the model annotation stops extractor upgrades from faking trend changes and prevents cross-language/cross-model threshold unfairness; dropping the per-organizer cut kills the job-description-ranking-as-people-ranking dossier.

### In-app RSVP adoption (DEMOTED — was 'pending-RSVP cost')

**Computation.** Over past meetings: attendee rows WHERE response='pending' AND userId != meetings.createdBy, as a count and rate. Reliable as a statement about the WIDGET only ('pending' is unsettable via rsvp-actions.ts:12-13).

**Shown to.** Everyone, as a neutral adoption stat with copy 'X invites without an in-app reply — replies may live in Google Calendar; a tap here helps planning', paired with a self-serve 'your pending invites' nudge on /meetings. No meeting-level expansion for this metric on the drill-down. Never an input to any suggestion rule.

**Why.** Fixes the blocker: invites go out as .ics with RSVP=TRUE (ics.ts:216, verified) and external replies never write back, so 'pending' means 'never clicked our widget', not 'never confirmed'. The waste framing, the declined-hours 'load avoided' virtue metric, and every pending-based trigger are gone; the honest residual is an adoption nudge.

### Overlapping-invitation hours (team total only)

**Computation.** One week of meetings + non-declined attendee rows into a pure module: per userId, pairwise a.startsAt < b.endsAt AND b.startsAt < a.endsAt with a.id < b.id dedupe; degenerate intervals guarded. Back-to-back (<10 min gap) counted separately, never blended.

**Shown to.** Everyone as a team total ('3 overlapping-invitation hours this week'). NO named per-person list anywhere in v1 — not even admin. Each person sees their OWN overlaps on their own /meetings view (self-view, permitted by A's rule).

**Why.** Labelled 'overlapping invitations' because with RSVP mostly unwritten, an overlap is usually already resolved out of band — the metric is invitation hygiene, not scheduling failure. Dropping the admin named cut (unknowable false-positive rate) and adding self-view resolves the admin-vs-subject asymmetry major by removal plus subject access.

### Agenda-field and app-field usage (drill-down columns only)

**Computation.** COUNT(*) FILTER (WHERE agenda IS NULL) and (WHERE app_id IS NULL) in the same weekly GROUP BY; agenda IS NULL verified trustworthy (create coerces '' to null, no update path writes agenda). Established series with median duration <= 20 min excluded from the agenda rate.

**Shown to.** Everyone, as neutral counts ('4 of 11 meetings used the agenda field') on /meetings/load only — never warning-toned, never on the dashboard, never a suggestion input.

**Why.** Kept because it is free (same query) and occasionally useful, but framed as field usage so it cannot Goodhart into one-character agendas or shame the one person who runs ad-hoc calls. Its decay to irrelevance is acceptable and stated.

### Observed change since decision (REPLACES 'hours saved to date')

**Computation.** Per accepted decision: the target series' actual invited-hours in the 4 Colombo-weeks after decidedAt vs the 4 before, from the same live queries the metrics use. The evidence jsonb snapshot shows what was on screen at decision time; the observed number shows what actually happened.

**Shown to.** Admin and the affected series' organizer, on the /admin card. Not org-visible in v1.

**Why.** Fixes the major where SUM(estimated rate) reported savings that never happened while the live cost line contradicted it on the same screen. Observed change can be zero or negative, which is precisely the point — the ledger holds the feature accountable, not just the meetings.

### Suggestion acceptance by kind + A's recommendation acceptance rate (post-A)

**Computation.** B: accepted/(accepted+dismissed) from meeting_load_decisions grouped by kind. A (once meeting_attendee_recommendations exists): same ratio grouped by surface and tier, 'open' excluded and the exclusion stated, window labelled 'last 180 days' (A's retro pruning horizon accepted).

**Shown to.** Admin only, both. Tuning telemetry, not a scoreboard.

**Why.** With 2-3 organizers, an org-visible acceptance rate is attributable to individuals and pressures them to accept AI output to avoid looking obstructive; admin-only placement (both critiques' fix) keeps it a thermostat, not a trophy.

## Suggestion engine

ENGINE: pure function suggest(seriesTables, decidedKeys) -> Suggestion[] in src/features/meeting-load/suggest.ts, computed live at render from the exact per-series numbers the metric surfaces show. No cron, no stored open rows, no on-visit generator writes (9-person scale; also sidesteps the Next-16 write-in-render question entirely). Persistence is decisions only.

GATES (all rules): established series per A (seriesKey+appId, >=2 occurrences, 6-occurrence/180-day window, imported normaliser) AND >=1 occurrence in the last 45 days (ages out title-edit-forked strays). Insufficient data renders nothing.

RULES:
R1 CANCEL-REVIEW — >=3 occurrences in window; coverage >=50% (>=2 of last 4 analyzed); every analyzed occurrence in the last 4 has zero AI-DERIVED outputs (manual followups never clear a series — the gaming fix); AND the participation veto passes: median mapped speakers <= 2 AND median voice turns < 10 across analyzed occurrences. A talkative zero-artifact crit is vetoed. Copy is a review question, not a value claim: "Review: 3 recorded occurrences, no tracked outputs, little discussion — cancel or move async? (Unrecorded series are not evaluated.)" The selection-bias caveat is on the card itself.
R2 SHORTEN — median scheduled duration >=45 min; >=2 of last 4 occurrences analyzed under the SAME meetingAiNotes.model; median AI-derived outputs <=1 AND median turns < 20. Proposes the next 15-min step (60->45, 45->30). Compares the series only against its own history, never an org-wide density threshold.
R3 SHARE-A-SLOT (merge reframed) — two established series, same NON-NULL appId (NULL never matches NULL); invite Jaccard >=0.8 over each series' last 3 occurrences; both median durations <=30 min; same ISO week in >=3 of last 4; AND a purpose-token veto: if the two normalised titles resolve to different tokens from the purpose list (standup, retro, planning, crit, review, demo, sync, 1:1, postmortem — with Sinhala equivalents in the same tested list), the rule never fires. Copy is a question: "Same people, same week — could these share one slot?" Never a redundancy claim.
R4 RECORD-OR-REVIEW (the no-analysis rule) — series costing >=4 invited-hours/week with coverage <25% over the last 4 occurrences: "6h/week with no record — worth recording, or worth reviewing?" This closes the immunity loophole where not-recording is strictly safe; silence is no longer free. Coverage decline (>=40-point drop across 4 weeks) also renders as a neutral note on the series detail row.
R5 TRIM-INVITE (post-A, activates per-series on data-present, not on migration-landed) — >=2 of the last 3 occurrences analyzed AND the series' evidence pool is non-trivial (sum of hardEvidenceCount across all candidates > 0) AND >=2 invitees with hardEvidenceCount=0 in EACH of the last 3 occurrences. Rendered ONLY to the series organizer and admin; the count never appears on any org surface in any form (at 9 people, '2 invitees with no evidence' de-anonymizes in seconds). Copy: "No recorded evidence for 2 invitees (3 of 3 occurrences analyzed) — make them optional?" with the coverage fraction beside the names.

DELETED RULES: CONFIRM-OR-DROP and every pending/declined-based trigger (RSVP data measures widget adoption, not intent — blocker).

VISIBILITY OF SUGGESTIONS (the shaming fix): suggestions are organizer-private plus admin. The organizer of a series sees its suggestions on /meetings; the admin sees all on /admin. The org at large sees only an aggregate line on the dashboard card: "2 suggestions with organizers, ~6h/week potential." A named series with a negative verdict never renders org-wide.

IDENTITY & LIFECYCLE: deterministic targetKey = `${kind}:${seriesKey}|${appId ?? '__none__'}` (R3 uses the sorted pair). Open = computed live and absent from meeting_load_decisions. Accept/Dismiss INSERT a decision row with an evidence jsonb snapshot of the numbers on screen; the unique index on (kind, target_key) plus the renderer's decided-keys filter is the never-re-show guarantee (meetingTaskSuggestions contract, schema.ts:388-394). Accept is ADVISORY ONLY: it records intent and deep-links to the existing flow (deleteMeeting confirm page, reschedule, invite editing) — it never mutates meetings, endsAt, or meeting_attendees.optional. Only the organizer applies changes to their own series through flows they already own; the one-click-apply blocker is fixed by not having apply. Reopen = admin-only deletion of the decision row from the /admin dismissed list — the escape hatch for a series that worsens after dismissal. A title edit forks the seriesKey and legitimately mints a new identity (tested, documented).

## Surfaces

1. DASHBOARD '/' (src/app/(app)/page.tsx): one query added to the existing Promise.all (lines 21-30); <MeetingLoadCard/> appended to the right-column stack under UpcomingMeetings (grid lines 50-56). Server-safe, shadcn Card family: this-week invited hours with delta vs trailing 4-week MEDIAN, 12-week hand-rolled SVG trend cloning AllocationTrend (viewBox, non-scaling-stroke, role='img' + sentence aria-label, theme-token strokes, NO chart library), analysis coverage, and the aggregate suggestions line ('2 with organizers, ~6h/week potential'). CardAction links to /meetings/load. No names, no named series with verdicts.

2. /meetings (src/app/(app)/meetings/page.tsx): (a) one StatTile in the at-a-glance row (lines 57-68): 'Invited hours: Xh', warning tone only when > 1.25x trailing 4-week median (median chosen to resist one workshop week tripping it); computed server-side beside summarizeMeetings, above the client MeetingsViews boundary. (b) 'Your series' card, rendered only when currentUserId (already computed, line 26) organizes >=1 established series with an open suggestion or an accepted-decision observed-change note: the organizer-private suggestion surface, evidence line + Accept/Dismiss (the two buttons are the only client island). (c) 'Your pending invites' nudge and your own overlapping-invitations count — self-view of the only per-person numbers that exist.

3. /meetings/load (new org-visible route, auth via the (app) layout redirect; loading.tsx sibling mirroring the header per meetings/loading.tsx precedent): the audit surface. 12-week table (invited hours, meeting count, coverage, agenda/app field usage, overlap total, RSVP adoption), per-app breakdown with 'No app' bucket, established-series table (hours, median duration, churn count, outputs AI/manual split with model annotation, participation, coverage), clamped-outlier list. Header carries the invited-hours definition sentence. Week rows expand (native details/summary) to constituent meetings for every metric EXCEPT RSVP adoption, whose expansion is suppressed (the whodunit fix — the aggregate never hands out the hunt). No person is named negatively anywhere on this page.

4. /admin (src/app/(app)/admin/page.tsx card stack behind the existing notFound() gate, lines 22-23): <MeetingLoadAdminCard/> — full suggestion queue across all series (including R5 trim-invite with names + coverage fractions), dismissed list with Reopen, per-decision observed-change lines, acceptance-by-kind telemetry. The v1 admin card contains NO named pending-responder list, NO per-person collision list, NO per-organizer density — all three dropped, which also dissolves the subject-access asymmetry.

VISIBILITY ENFORCEMENT (type-level, not a remember-to-call function): src/features/meeting-load/queries.ts exports org-facing types that structurally contain no userIds (counts only); src/features/meeting-load/admin-queries.ts returns named rows and is imported ONLY by the gated /admin page and the organizer-scoped card (which checks session.user.id against the series' latest createdBy before fetch). A forgotten redaction becomes a type error, not a dashboard leak.

5. NAV: no nav-items.ts change and no ⌘K entry in v1 — /meetings/load is reached from the dashboard card and the meetings page. nav-items.ts/mobile-nav.tsx are untracked files owned by the parallel session; not touched.

## Schema changes

Exactly ONE new table, riding A's frozen migration (schema.ts's own comment: db:migrate is broken, every avoided migration matters; drizzle/ is append-only past 0021). No FKs onto A's tables and none onto meetings (series are derived, not rows), so it CAN take its own migration if A slips badly.

meeting_load_decisions (
  id uuid PK defaultRandom,
  kind text NOT NULL,            -- 'cancel_review' | 'shorten' | 'share_slot' | 'record_or_review' | 'trim_invite'; text not pgEnum per the activityLog precedent (schema.ts:483-487) so new kinds are not migrations
  target_key text NOT NULL,      -- `${kind}:${seriesKey}|${appId ?? '__none__'}`; sorted series pair for share_slot
  status suggestion_status NOT NULL,  -- REUSES the existing enum (schema.ts:23); rows only ever hold 'accepted' | 'dismissed' ('open' = computed live, never stored)
  evidence jsonb NOT NULL,       -- snapshot of the numbers shown at decision time; for trim_invite it stores userIds — ids only, names resolved at render behind the gated admin/organizer queries
  decided_by uuid REFERENCES users ON DELETE SET NULL,
  created_at timestamp NOT NULL defaultNow
) + UNIQUE INDEX ON (kind, target_key).

Everything else B consumes (meeting_attendees.optional, meeting_attendee_recommendations, tasks.updatedAt, users.aliases, the meeting_note_segments.meetingId index — required by the participation metric) arrives in A's migration; B adds nothing to it. All Tier-1 metrics and rules R1-R4 require ZERO schema changes. Deliberately NOT added: meetings.cancelledAt (would fix the hard-delete history-rewrite but is out of B's one-table scope; every trend is labelled 'as recorded today' and the caveat printed on /meetings/load), RSVP write-back columns (deferred — see rejected).

## Test plan

House pattern exactly: all derivation math in pure modules with sibling .test.ts (sort-capacities/sprint-progress precedent); queries stay thin untested SQL; components server-safe and untested. Run: npx vitest run src/features/meeting-load src/features/meetings/series-key.test.ts.

- src/features/meetings/series-key.test.ts — the SHARED normaliser: case/whitespace/punctuation, Sinhala titles preserved (Unicode never stripped), establishment edges (>=2 occurrences, 6-occurrence/180-day window boundaries), '__none__' NULL-app grouping key, two NULL-app same-title series never merged across contexts (the JS-Map-vs-SQL-NULL trap), title-edit-forks-series documented as a test.
- week-bucket.test.ts — Asia/Colombo bucketing of naive timestamps: Sunday 18:30 UTC lands in Monday's local week; Monday 05:29 local edge.
- load-math.test.ts — 8h clamp, reversed/zero-duration -> 0 and flagged, declined rows excluded, organizer-self row excluded from the RSVP-adoption count.
- participation.test.ts — turns/distinct-mapped-speakers per occurrence, NULL speakerId excluded from the distinct count, unanalyzed occurrences absent, median math on even/odd counts.
- density.test.ts — AI-derived vs manual split (createdBy NULL boundary), followups counted by sourceMeetingId only (targetMeetingId-pinned rows never count forward), accepted task suggestions by status with createdTaskId NULL, null/absent deadlines jsonb guards, model-boundary partitioning (two models in one window -> two segments, no cross-comparison).
- collisions.test.ts — a.end==b.start is NOT overlap; back-to-back gap 0 yes / 9m59s yes / 10m no; a.id<b.id dedupe; identical intervals; declined excluded; degenerate intervals ignored.
- churn.test.ts — symmetric difference across consecutive occurrences, single occurrence -> no churn row, deleted middle occurrence shortens the chain without crashing.
- suggest.test.ts — the biggest file, every threshold both sides: R1 fires only with zero AI-derived outputs AND the participation veto passing (40-turn crit with zero artifacts NEVER fires; 8-turn 2-speaker series with one MANUAL followup still fires — the gaming case); coverage 49% suppresses R1/R2; R2 same-model requirement (model change mid-window suppresses); R3 Jaccard 0.79 vs 0.80, purpose-token veto (standup+retro same people never fires, sync+sync fires), NULL-app never in R3; R4 fires at coverage 24% + 4h/week and not at 25% or 3.9h; R5 requires evidence-pool > 0 and 2-of-3-analyzed (post-A fixture shapes); no pending/declined input reaches any rule (asserted structurally on the rule input type); decidedKeys filtering (accepted AND dismissed both suppress; forked seriesKey mints a fresh identity); targetKey determinism incl. sorted share_slot pairs.
- observed-change.test.ts — 4-weeks-before vs 4-weeks-after windows around decidedAt, series with no post-decision occurrences -> 'no data yet', negative change reported as-is.
- trend-points.test.ts — 12-week SVG points mirroring allocation-history.test.ts (empty weeks as 0, y-scale minimum, single-week input).
- Type-boundary check: the org-facing query row types have no userId field — enforced by tsc, noted in a comment test rather than a runtime assertion.

## Server actions

- acceptLoadSuggestion(kind, targetKey, evidence): ActionResult in src/features/meeting-load/actions.ts. Guard: session.user.role==='admin' OR session.user.id === createdBy of the target series' most recent occurrence (4-line private guard copying admin/actions.ts:25-29). Zod-validates kind against the known list and targetKey shape. INSERT into meeting_load_decisions status='accepted' with the evidence snapshot; onConflict(kind,target_key) -> err('Already decided'). ADVISORY ONLY: never mutates meetings, endsAt, or meeting_attendees — the response includes a deep link to the existing flow (next occurrence's page for cancel/reschedule, invite editing for trim) where the organizer applies the change through code they already own. Ends with revalidatePath('/'), '/meetings', '/meetings/load', '/admin'.

- dismissLoadSuggestion(kind, targetKey, evidence): ActionResult — identical guard and shape, status='dismissed'; the unique index makes never-re-show durable.

- reopenLoadDecision(id): ActionResult — admin-only (requireAdmin pattern); DELETEs the decision row so the live engine may re-derive the suggestion. Surfaced solely on the /admin dismissed list. The only path back.

- No other writes exist in sub-project B. All metric surfaces are read-only: new GROUP BY queries in queries.ts (org types, no userIds) and admin-queries.ts (named rows, gated call sites only) — never JS over listMeetings, which fetches everything and is wrong for aggregates.

## Rejected

- Pending-RSVP as a waste signal, CANCEL trigger, or CONFIRM-OR-DROP rule (Design 1 trigger B, Design 2 R5): .ics invites carry RSVP=TRUE (ics.ts:216) and mail-client replies never write back, so 'pending' measures widget adoption, not confirmation — it would have proposed cancelling meetings the whole team attends. Demoted to a neutral adoption stat.

- Declined-hours 'load avoided' virtue metric: reads ~0 forever for the same .ics reason, and virtue-framing RSVP contaminates the signal A depends on.

- RSVP write-back via Google Calendar responseStatus polling: the correct long-term fix but new infra + OAuth surface; out of B's scope, recorded as the prerequisite for ever re-promoting RSVP metrics.

- Optional-attendance rate (both designs already dropped it): no attendance ground truth; re-recorded here so it is not re-proposed.

- Org-visible zero-evidence invitee counts (Design 2): at 9 people a count de-anonymizes in seconds and leaks what the dropped attendance metric would have said; trim-invite is organizer+admin only, including the count.

- One-click apply that mutates meetings (Design 2's SHORTEN endsAt rewrite and TRIM_INVITE optional-flip): an admin silently changing colleagues' calendars via GCal propagation oversteps the advisory mandate; accept records intent and deep-links, the organizer applies.

- Org-wide named suggestion card on /meetings (Design 2's primary surface): a named series is its organizer at this scale — public shaming; suggestions are organizer-private + admin, org sees aggregates.

- Per-organizer density cut, named pending non-responders, and named per-person collision lists (Design 1's admin card): job-description rankings and unknowable false-positive rates presented as per-person dossiers without subject access; all three dropped from v1.

- 'Hours saved to date' scalar (Design 2): sums a per-week rate into a total and counts intent as savings; replaced by observed change since decision computed from live queries.

- Stored suggestion queue + ensureSuggestionsFresh on-visit generator (Design 2): live computation at 9-person scale is trivial, avoids staleness, avoids writes in a Next-16 render path, and shrinks the schema to decisions only.

- Merge as a redundancy claim on invite-Jaccard alone: near-zero discriminating power when everyone invites everyone; recast as the SHARE-A-SLOT question with a purpose-token veto.

- Snapshot/history table for trends: live recompute accepted with 'as recorded today' labels and printed caveats; revisit only if the team argues with a chart's left edge.

- Agenda-quality scoring, warning-toned no-agenda rate, chart library, new pgEnum for kind, nav-items.ts/⌘K changes in v1, cron/job infra: all YAGNI or Goodhart bait.

## Assumptions (delegated decisions — veto here)

- Headline metric is renamed 'invited hours' everywhere, with the definition sentence on the drill-down — it stays the headline despite measuring invitations, because invitation cost is the only honest load number available.

- Suggestions are organizer-private + admin; the org sees only an aggregate count/potential line. This is stricter than A's allowance and reverses Design 2's public card.

- v1 contains NO named negative per-person cut on ANY surface including admin (pending responders, collisions, per-organizer density all dropped) — resolving the asymmetry critique by removal rather than by building subject-access views.

- Accept never mutates meetings or attendees; the organizer applies changes through existing flows. If you wanted one-click shorten/trim, that is deliberately absent.

- Rule thresholds are my judgment calls: R1 coverage >=50%, participation veto at median <=2 speakers AND <10 turns; R2 45-min floor, <20 turns; R3 Jaccard 0.8, purpose-token list (standup/retro/planning/crit/review/demo/sync/1:1/postmortem + Sinhala equivalents); R4 >=4 invited-hours/week at <25% coverage; R5 evidence-pool >0 and 2-of-3 analyzed; 45-day series-activity gate; 1.25x median for the warning tile; 8h duration clamp; 10-min back-to-back gap; observed-change window 4 weeks each side.

- R4 RECORD-OR-REVIEW is a new rule neither design proposed, added so not-recording is never strictly safe; its copy is neutral but it does surface expensive unrecorded series to their organizer and admin.

- Suggestion kinds renamed: cancel_review, shorten, share_slot, record_or_review, trim_invite.

- Reopen = admin deletes the decision row (vs Design 2's status flip) — chosen because open suggestions are never stored; a deleted row simply lets the live engine re-derive.

- meeting_load_decisions rides A's frozen migration; participation metrics wait for A's meeting_note_segments.meetingId index before shipping.

- Trim-invite activates per-series on data-present after A lands, not automatically at migration time.

- RSVP-derived numbers are permanently demoted to an adoption stat in this design; re-promotion requires building GCal write-back first (recorded in rejected).

- Drill-down route is /meetings/load (org-visible), not under /admin; no nav or ⌘K entry in v1 — discoverability rides on the dashboard card link.

- Acceptance-rate telemetry (B's and A's) is admin-only.

- Deleted-app and hard-deleted-meeting history rewrites are inherited platform behavior, labelled on surfaces rather than fixed (no meetings.cancelledAt in B).
