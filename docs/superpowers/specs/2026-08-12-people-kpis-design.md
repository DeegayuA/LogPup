# People Work History, Observed Load & KPIs — Design Spec (sub-project C)

Date: 2026-08-12
Status: designed under "do all tasks" mandate; user request verbatim: "people work history, hourd, kpis need to monitor". Delegated decisions under Assumptions — veto by editing this file.
Suite order: D soft deletes → A attendee recommender → B meeting load → **C (this spec)**.

## Hard product rules

- No manual timesheets. "Hours" = observed load (calendar meeting hours, task-completion events, declared allocation), always labeled as such — never presented as worked hours.
- No composite single-number rating of a person; no leaderboard; observed-hours ÷ allocationPct "efficiency" is banned.
- Every signal rule must be structurally incapable of reading leave as decline (no leave table exists).
- Longitudinal per-person charts: self + admin only. Colleagues keep exactly today's exposure level.

## KPIs

### Meeting load — scheduled hours/week ('scheduled, not declined')

**Computation.** New bounded query getPersonMeetingHours in src/features/people/queries.ts: SUM(ends_at - starts_at) over meetings JOIN meeting_attendees WHERE user_id=$person AND response != 'declined' (pending counts, per the shipped meeting-window.ts:14-20 convention). Weeks are keyed by the MONDAY'S ISO DATE on both sides — SQL: date_trunc('week', (starts_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Colombo')::date; JS dense-fill computes the same Monday key from iso-day.ts helpers — never 'YYYY-WW' strings, closing the ISO-year boundary trap (2026-W53 spans Jan 1-3 2027). Pure module src/features/people/observed-load.ts shapes rows into WeeklyHours[], fills empty weeks, marks the current week partial ('so far', hatched + worded), annotates LK_HOLIDAYS weeks (marker + the word 'holiday week'; annotation silently ends where the 2026 gazette map ends, said in the module header). Chart caption baked INTO the SVG as chart-area text so crops cannot strip it: 'As the calendar reads today — a floor. Meetings outside LogPup are invisible; overlapping invites double-count; RSVPs, reschedules and deletions rewrite past weeks; an invite is not attendance.' A 'Declined N invites (4w)' stat renders at equal prominence beside the chart so declining meetings is visibly positive, not a workload-shrinking penalty (protects sub-project B's decline-more goal). Required-vs-optional becomes a second series only after B's meeting_attendees.optional migrates (verified absent today), forward-only, never charted across the boundary.

**Window.** Trailing 12 full Colombo ISO weeks + current partial week (marked). No backfill boundary — honest wherever meetings were logged.

**Shown to.** Chart (12-week trend): self + admin only. All members see the point-in-time 'Meeting hrs this week (so far)' tile and the declined-invites stat — matching today's exposure level (colleagues already see the ±60d meeting list). The signal sentence: rendered only for self + admin viewers, on the person page only.

**Signal rule.** RISING-ONLY, leave-safe by construction of the baseline: flag when trailing-4-QUALIFYING-week mean >= 1.25x the median of qualifying weeks AND >= 10h/week absolute, sustained 2 consecutive weeks. QUALIFYING week = in-tenure (>= user.createdAt week), non-zero hours, and not containing a gazetted LK holiday — so leave weeks and holiday weeks never depress the median (fixes the return-from-Avurudu false fire) and pre-hire zeros never zero it (fixes the new-hire false fire). Suppress with a worded neutral message unless >= 8 qualifying weeks exist in the window. Dips can never flag anything. Copy is factual: 'Meeting hours have run above the 12-week norm for the last N weeks.' No color-only signaling; no dashboard digest.

**Why.** The only genuinely observable hours signal in the schema (meetings.startsAt/endsAt x membership) and the core of 'observed load' without timesheets. Rising-only + qualifying-week baseline is the one flag family that structurally cannot read leave as decline, which is the bar every signal must clear while no leave table exists.

### Task completions/week (positive-only; from activity_log events, never tasks.updatedAt)

**Computation.** Source of truth: activity_log — VERIFIED LANDED, not 'ships dark' (logActivity is wired across task-actions.ts, meetings, rsvp, apps, people, admin actions; the stale 'zero call sites' claim in both drafts is corrected). Count per Colombo ISO week (Monday-date keys, same idiom as meeting hours): (a) rows verb='completed', entityType='task'; PLUS (b) bulk rows expanded — verb='updated' AND metadata->'patch'->>'status'='done', unnesting metadata->'taskIds' to one completion per task (closes the verified hole: bulkUpdateTasks at task-actions.ts:541-549 writes ONE summary row and zero 'completed' events, exactly when most completions happen). Going forward C also changes bulkUpdateTasks to log per-task status-verb rows (adding tasks.status to its existing select to distinguish completed vs reopened) so (b) becomes legacy-row handling. ATTRIBUTION: going forward, the three status-change log sites (task-actions.ts:339-356, 451-471, and the new bulk path) snapshot assigneeId into metadata; the KPI attributes from metadata.assigneeId with fallback to current tasks.assigneeId for pre-snapshot rows, and the fallback share is captioned: 'older completions follow the task's current assignee; reassignment moves those between people.' Never grouped by actorId (actor = who clicked; the snapshot records whose task it was). 'History begins' = MIN(createdAt) of qualifying events per data, marked on the axis — never a hardcoded date. In-chart caption text: 'at least — some closures (bulk edits before <per-task logging date>, born-done tasks, unlogged writes) are not counted.' Reopens do not erase past weeks (append-only events; series is stable, a stated virtue over updatedAt).

**Window.** Trailing 12 full weeks, axis starting at MIN qualifying event; weeks before it rendered as 'no events yet', not zero.

**Shown to.** Self + admin only (longitudinal per-person output is the crop-into-review surface; colleagues keep today's views: open-task buckets, lifetime Done tile, the created-tasks contribution graph — all unchanged).

**Signal rule.** NONE, ever. No throughput target, no decline flag, and the zero-task-events flag is cut entirely (it measured board adoption and manufactured activity theater; any silence detector needs a leave table plus a role-aware notion of expected events, neither of which exists). Bulk-sweep spikes are left visible and now actually ARE visible because the bulk hole is closed.

**Why.** Closes the 'work finishing' half the activity graph explicitly disclaims, from the one source that records true closure instants and survives later edits. A's tasks.updatedAt is explicitly NOT used even after it ships — last-touch timestamps re-date closures and cannot distinguish a board move from a title fix; one authoritative source prevents two surfaces disagreeing.

### Allocation trend (shipped) + churn (real reassignment count)

**Computation.** Zero new queries: new pure function countAllocationChanges in src/features/people/allocation-history.ts consuming the getPersonAllocationHistory rows the page already fetches. Counts CHANGE EVENTS: entries whose allocationPct differs from the predecessor for the same (user, app) — role-text-only 'updated' rows excluded (bookkeeping); 'removed' tombstones included (a removal is real). Entries sharing one effectiveFrom instant collapse into ONE event (one admin rebalance across 3 apps is one act, mirroring allocationTotalSeries' instant handling). Rows whose effectiveFrom equals the migration-0015 backfill instant are EXCLUDED — they are synthetic state capture, and a fixture pins backfill => churn 0 (kills the phantom reorg spike and the every-multi-app-person-flags-for-30-days bug).

**Window.** Rolling 30-day event count, displayed alongside the existing 6-month step trend; series clipped after the 0015 backfill instant with a worded 'history begins' marker.

**Shown to.** All members (the full allocation timeline with who-changed-what is already public today; churn is derived from the same visible rows). Signal sentence: self + admin, person page only.

**Signal rule.** Flag when >= 3 change events land within 30 days: 'Declared allocation changed N times in the last 30 days.' Structurally leave-safe: churn counts ADMIN actions on the person, not the person's behavior — absence cannot fire it. It is the one signal aimed at org thrash rather than the individual.

**Why.** Nearly free on shipped substrate, and the honest allocation KPI: allocationPct is a declared share, so C monitors the declaration's stability instead of ever dividing observed hours by it (observed-hours / allocationPct 'efficiency' is banned by sentence in the spec — it is the forbidden composite score renamed).

### Open follow-up debt (adopted as-is: the shipped Owes tile, made truthful at the source; NO new followup chart)

**Computation.** No new followup KPI surface. The shipped tile (open owed count + oldest age from SOURCE MEETING startsAt, FOLLOWUP_STALE_DAYS=14 tones) remains the person-level followup KPI. C's contribution is fixing the substrate it reads: deriveAndInsertFollowups (ai-actions.ts:567-606, verified plain INSERT) gains re-analysis dedupe — before inserting, delete this meeting's AI-derived open rows (sourceMeetingId=X AND createdBy IS NULL AND status='open') and skip inserting any row whose (personName, text, kind) matches a surviving resolved row for the same meeting, so a resolved item is not resurrected as an open duplicate. This kills the verified count-inflation path (re-analysis doubles open debt) that was silently corrupting the tile and would have poisoned any chart built on it. One caption line added to the followups card: 'Items whose spoken name matched no attendee belong to no one and are not counted here' — the undercount is name-correlated (bilingual transliteration), not random, and A's users.aliases is declared the future fix.

**Window.** Point-in-time (as today).

**Shown to.** All members (unchanged shipped surface).

**Signal rule.** The tile keeps its existing FOLLOWUP_STALE_DAYS warn/alert tones (shipped behavior, untouched). C adds NO new followup signal: the debt-age flag and resolution-rate flag are cut (see rejected).

**Why.** Follow-up diligence matters, but the substrate has four independent validity holes (AI attribution bias, resolvedAt quantized to next-analysis, reopen wipes resolution history, re-analysis duplication). The honest move is to fix the worst hole at the source, keep the point-in-time fact everyone already sees, and refuse to build trends or verdicts on the rest until the substrate earns it.

## Work-history surface

One new full-width PersonWorkHistoryCard on /people/[id], mounted in its own lg:col-span-2 slot directly below the untouched AllocationHistoryCard. VISIBILITY: self + admin only — the merged longitudinal ledger is new exposure, not 'today's level' (see assumptions); other members see the page exactly as today. The card carries a permanent audience footer: 'Visible to: you and admins.' EVENTS MERGED (60-day window, all queries SQL-bounded): (1) allocation changes — reusing the already-fetched getPersonAllocationHistory rows and describeAllocationChange humanization; 'removed' tombstones render as removals, never 0%-updates; (2) meetings — from the existing ±60d read, 'Sprint planning · 1.5h · invited, did not decline' (never 'attended'); (3) task events — activity_log rows for tasks attributed to the person (created/moved/completed/reopened, including expanded legacy bulk rows), attributed via metadata.assigneeId snapshot with current-assignee fallback; when actor differs from assignee the entry says 'closed by <actor>' — a fact, not a verdict; (4) follow-ups — opened entries dated by SOURCE MEETING startsAt (followup-split.ts semantics), resolved entries dated by resolvedAt with the caption 'resolution times are recorded when the next meeting is analyzed'. MERGE: new pure module src/features/people/work-history.ts (sibling .test.ts) exporting mergeWorkHistory → WorkHistoryDay[]: naive-timestamp columns (meetings, tasks, followups) reinterpreted as UTC instants at the query edge, timestamptz (assignment_history, activity_log) passed through, the pure module sees only epoch ms; grouped by Colombo day via iso-day.ts, newest-first, deterministic ordering (timestamp, fixed type precedence, id). RENDER: server component; per-entry icon PLUS type named in words (color/icon never alone); first ~15 entries visible, remainder in native <details> (person-tasks-card precedent, zero client JS); SectionEmpty when empty. Standing caption: 'Everything LogPup recorded in the last 60 days. Work LogPup never saw — untracked meetings, off-board work, leave — is not here.' Data arrives as one new function in the page's Promise.all (page comments 'SIX READS'/'seven figures' updated); the page gains its first auth() call to compute viewerIsAdmin/viewerIsSelf server-side (dashboard pattern, src/app/(app)/page.tsx) — gated content never reaches the wire, not hidden by CSS.

## Observed-load surface

One new full-width ObservedLoadCard on /people/[id], mounted above PersonActivityCard, with the standing header sentence 'Observed load — what the calendar and board can see. Not worked hours: leave, ad-hoc calls, and off-tool work are invisible to it,' plus a permanent audience footer stating exactly what each strip's visibility is. THREE STRIPS, never combined into any composite number: (1) DECLARED SHARE — the existing CapacityBar + total allocationPct (reusing capacityBand; no second ramp), labeled 'declared share of capacity — a statement, not a measurement'; visible to all members (public today). (2) SCHEDULED MEETING HOURS — for all members: the point-in-time figures ('This week so far: 6.5h' — derived from the current week's bucket, honestly labeled, NOT a fake trailing-7d; plus 'Declined 4 invites (4w) — capacity protected' at equal prominence). For self + admin: the 12-week weekly-bars SVG (cloned from AllocationTrend conventions: 600x120 viewBox, non-scaling strokes, role=img full-sentence aria-label; no chart library), holiday weeks marked and worded, current week hatched and worded 'partial', the floor/mutability caption baked into the SVG as chart-area text. (3) TASK FLOW — for all members: the created/week context stays the existing public contribution graph (untouched). For self + admin: completions/week bars with the data-derived 'events begin <date>' axis marker and in-chart 'at least' text. The signal sentences (rising meeting load; allocation churn), when firing and viewer is self or admin, render under the relevant strip as plain factual sentences with the standing disclaimer 'LogPup has no leave records — discuss before concluding anything.' ONE new PersonStatRow tile for everyone: 'Meeting hrs · this wk' (meta: 'so far · scheduled, not declined'), neutral tone always, derived in buildPersonStats from the SAME observed-load summary the card renders (anti-drift contract); PersonStatRow goes to xl:grid-cols-8. The spec bans, by sentence: any hours÷allocation figure, any cross-person rollup of these numbers, and citing observed load as evidence in allocation decisions (the card caption repeats the last one).

## Schema changes

ZERO — no tables, no columns, no migrations (db:migrate is broken repo-wide; migrations are manual). Everything computes on read from meetings + meeting_attendees, meeting_followups, assignment_history, tasks, and activity_log (landed migration 0021, wiring verified live). Three SMALL CODE-ONLY changes to landed writers, coordinated with the parallel session (verify-and-adopt; additive, no renames): (a) bulkUpdateTasks logs per-task completed/reopened rows when patch.status changes (adds tasks.status to its existing select), keeping the summary row; (b) the three task status-change log sites snapshot assigneeId into metadata; (c) deriveAndInsertFollowups dedupes on re-analysis (delete AI-derived open rows for the meeting, skip re-inserting text matching surviving resolved rows). DECLARED DEPENDENCIES, not owned: B's meeting_attendees.optional (enables the required/optional series, forward-only), A's users.aliases (improves followup attribution for future rows). NAMED FUTURE UNLOCKS, deliberately not built: a tiny leave table (userId, from, to, no reason column) — the only honest fix for leave-vs-disengagement, and the stated CO-REQUISITE before any longitudinal per-person chart is ever opened to all members; kpi_snapshots — the fallback if computed-on-read drift (RSVP cleanups rewriting past weeks) proves noisy in practice.

## Test plan

Vitest, pure modules only, sibling .test.ts (house style; queries stay thin and untested; components presentational). observed-load.test.ts: Monday-key bucketing at Colombo boundaries (Sunday 20:30 UTC = Monday 02:00 Colombo lands in the new week); the 2026→2027 ISO-year boundary week keys identically in SQL-shaped fixtures and JS fill (no phantom zero week); declined excluded / pending included; dense-fill; partial-week marking; overlap double-count asserted as documented; holiday annotation + 2027 graceful degradation; 'this week so far' tile derives from the current bucket (label-truth test). SIGNAL fixtures (all must-not-fire cases mandatory): return-from-leave — three near-zero weeks excluded from the qualifying median, normal weeks back do NOT flag; new hire — pre-tenure weeks excluded, <8 qualifying weeks suppresses with the worded message; April-2026 holiday-cluster window — holiday weeks excluded from median, unchanged June load does not flag; falling series never flags; 2-consecutive-week persistence. task-events shaping tests: bulk 'updated' rows with metadata.patch.status='done' expand to one completion per taskIds entry (contract test pinning the real landed payload shape); attribution prefers metadata.assigneeId, falls back to current assignee (fixture: admin actor closes someone else's task → attributed to assignee); reopened does not decrement past weeks; born-done tasks absent (caption honesty); 'history begins' = MIN(event createdAt). allocation-history.test.ts additions: role-text-only updates excluded; removals counted; same-instant multi-app rows collapse to one event; backfill-instant rows → churn 0; ≥3-events-in-30d fire/suppress edges. work-history.test.ts: deterministic merge across naive-UTC and timestamptz inputs; day grouping via iso-day not toISOString; removals never render as 0%-updates; followup opened dated by source meeting; 60-day truncation; empty state. followup dedupe (in the meetings feature's test file for the changed function): re-analysis of the same meeting yields no open duplicates; resolved items are not resurrected; manual (createdBy set) rows never deleted. person-stats.test.ts additions: new tile always neutral, meta words present, derives from the shared summary. kpi-signals.test.ts: exact-copy assertions that every sentence is factual (no evaluative vocabulary) and every suppression is worded. Run: npx vitest run src/features/people src/features/meetings.

## Server actions / queries

- NO new mutating server actions — C's surfaces are read-only. The person page gains its first auth() call (viewerIsAdmin/viewerIsSelf threaded as props, dashboard pattern); gating is server-side so self+admin content never reaches other members' responses.

- REJECTED: the admin dashboard Signals digest. Computed-on-read flags have no onset timestamp (the digest's ordering was uncomputable) and a push surface the subject may never see is asymmetric surveillance. Signals render ONLY on the person page, identical sentence for admin and self — symmetric by construction, no state table needed. With 9 people, admins visiting person pages is an acceptable monitoring workflow.

- Code fix 1 (small, coordinated): per-task status-verb logging in bulkUpdateTasks + assigneeId snapshot in status-change metadata at task-actions.ts:339-356 and :451-471. Additive to the landed activity feature; nothing renamed or moved.

- Code fix 2: re-analysis dedupe in deriveAndInsertFollowups (ai-actions.ts:567-606) — fixes the shipped Owes tile, not just C.

- Implementation order: (1) pure modules + sibling tests: observed-load.ts, work-history.ts, countAllocationChanges in allocation-history.ts, buildPersonStats extension; (2) bounded queries: getPersonMeetingHours, getPersonTaskEvents (completed + expanded bulk rows), getPersonWorkHistoryInputs; (3) server components: ObservedLoadCard, PersonWorkHistoryCard, WeeklyBars SVG; (4) page mount: Promise.all additions, two lg:col-span-2 slots, comment/breakpoint updates; (5) pre-flight re-verification of activity verb constants and call-site shapes against main (parallel session active).

- Announcement: one changelog entry (src/lib/changelog.data.json) saying the person page now shows observed-load history, who sees what, and that no time tracking was added; every new card carries a permanent audience footer.

- Explicit non-actions, stated in the spec: no leaderboard or cross-person rollup; no composite score; no evaluative copy anywhere (factual sentences only, with the no-leave-records disclaimer on every signal); no thresholds on any surface other than the two leave-safe signals; no use of tasks.updatedAt ever; no voice-participation surface; no overdue trend (shipped tiles unchanged); no signal acknowledgment flow (would need a table).

## Rejected

- Per-person follow-up resolution rate (both as KPI and signal): a machine sentence 'resolves <50% of what they owe' is a negative verdict about a named person — banned outright — and the number is invalid three ways at once (right-censored: fresh items count as failures since resolvedAt can only be stamped at the next analyzed meeting; reopen wipes history retroactively; attribution is name-biased). Not fixable by thresholds; cut.

- Follow-up opened-vs-resolved chart (Ledger's version): two visually comparable series ARE the banned ratio, computed by every viewer's eye without the caveats. Cut; the point-in-time Owes tile is the followup surface.

- Follow-up debt-age signal: its only leave defense was a presence gate that standing invites defeat (pending counts as present), and it also fires when the team simply stops recording meetings (measures observation coverage, not diligence). Cut until a leave table exists.

- Zero-task-events flag: manufactures activity theater (close-and-reopen a task every third week beats it), punishes non-task-shaped roles, and its presence condition had the same standing-invite hole. Cut; if board-goes-quiet matters it is an org-level adoption question, out of C's scope.

- Presence gate as a leave-safety mechanism in general: invites are not evidence of presence. Instead of patching it, C ships only signals that are structurally leave-safe without any gate (rising-only load with leave-excluded baseline; churn, which measures admin actions).

- Admin dashboard signals digest: asymmetric (pushed to admins, seen by the subject only on visit) and its onset-ordering was uncomputable without state. Person-page-only signals instead.

- Cycle-time proxy: most gameable metric on offer (born-done tasks, batch-entered createdAt, bulk sweeps), and per-person cycle comparison is leaderboard-adjacent. Cut entirely, including the team-level variant (YAGNI).

- Voice participation trend: triple missingness (recorded+analyzed only; speakerId needs manual mapping; no durations, so turn-counts reward interruptions) and the exact reasoning that killed A's speaking-share penalty. Cut.

- Overdue-count trend: a rising line conflates due-date adoption with slippage; the shipped point-in-time tiles keep it as a fact.

- tasks.updatedAt as a task-flow source (even after A ships it): last-touch re-dating and two-sources-disagreeing risk; activity_log events are declared solely authoritative.

- 'Meeting hrs · 7d' tile: arithmetically underivable from weekly buckets; replaced by the honest 'this week so far'.

- kpi_snapshots table and leave table: not built now (zero-migration goal, broken migrate pipeline); both named in the spec as the designated fixes if their absence bites, with the leave table stated as co-requisite before longitudinal charts open to all members.

- All-members visibility for the new longitudinal surfaces: rejected despite being 'today's level' — see assumptions.

## Assumptions (delegated decisions — veto here)

- VISIBILITY (biggest call, veto-able as a props change): the task brief's 'member sees colleagues at a reduced level' is FALSE today — every member sees every colleague's full page. C deliberately does NOT extend that to the new longitudinal surfaces: the 12-week hours chart, completions/week strip, and 60-day work ledger are self + admin only, because a one-glance 26-week/60-day dossier is new exposure (screenshot-cropping, leave flatlines visible to 8 colleagues, hand-assembled leaderboards), not preservation of the baseline. Everything members see today stays public and unchanged, plus two new public point-in-time facts (meeting hrs this week, declined invites). Veto = flip the props.

- SIGNALS: only two ship (rising-only meeting load; allocation churn), both structurally leave-safe without a leave table; every decline-shaped signal is cut rather than gated. Signals are person-page-only, identical for admin and self; there is no admin digest, no notification, no persistence.

- SOURCE OF TRUTH: activity_log is solely authoritative for task flow; tasks.updatedAt will not be consumed even after A's migration. Both drafts' 'ships dark / zero call sites' framing was verified stale and is dropped — wiring is live on main; 'history begins' is derived from data.

- SCOPE INTO OTHER FEATURES: C makes three small additive code fixes to landed code owned by parallel work (per-task bulk logging + assignee snapshot in task-actions.ts; followup re-analysis dedupe in ai-actions.ts). Justified because C's numbers are wrong-but-confident without them and the dedupe fixes an already-shipped tile; done verify-and-adopt style, nothing renamed, coordinated before merge.

- FOLLOW-UP KPI is the existing tile, not a new chart — the substrate's validity holes outweigh a trend's value at 9-person scale.

- HOURS SEMANTICS: 'observed load' = scheduled-not-declined calendar hours, always labeled a floor, never 'attended' or 'worked'; pending RSVPs count (shipped convention); overlaps double-count and say so; declining is surfaced as a positive stat so C does not fight B's decline-more goal; observed load is banned by sentence as evidence in allocation decisions, and hours÷allocationPct is banned as the composite score renamed.

- ZERO MIGRATIONS is a hard constraint honored; leave table and kpi_snapshots are named, veto-able future unlocks with their trigger conditions stated.

- WINDOWS chosen without user input: 12 weeks for both trend charts (shared frame), 60 days for the ledger (matches the shipped meetings window), 30-day rolling churn, 26-week activity graph untouched.

- ANNOUNCEMENT: a changelog entry plus permanent audience footers on every new card; no consent flow (studio-internal tool, no new data collected — only new rendering of existing rows).

- LK_HOLIDAYS is 2026-only: charts touching 2027 silently lose holiday annotation until the map is extended; noted in module headers and accepted.
