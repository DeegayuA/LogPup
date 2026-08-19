# KPI inventory — who already owns each number

**Status:** inventory only. No code was changed to produce this. Every claim below was read
out of the tree on `main` at the time of writing; line numbers are from that read and will
drift. Anything I could not confirm in code is marked `[unverified]`.

Three other sessions were editing this tree throughout. `capabilities.ts` and several pages
changed under me mid-read; §4 was re-verified against the moved tree and carries its own
staleness warning. Everything in §1–§3 was read after those landings except where noted.

**Why this exists.** The ask is system-wide progress tracking across four families — delivery,
people load & coverage, meeting follow-through, and a project-health rollup. The risk is not
that the maths is hard. It is that LogPup has already computed most of this, each in one
deliberate place, and the repo has already been bitten by a second definition of the same
word. Section 2 is the important part of this document: it lists the pairs that already
disagree. Those are defects the KPI work will amplify, not gaps it will fill.

**Coverage note.** `src/features/worklog/coverage.ts` (`computeCoverage`, line 83) is on disk
and is treated here as **the** owner of every per-(person, day) coverage answer and of every
fractional expected/logged/missing total. Nothing in this document proposes a second coverage
calculation. Its fetching layer (`coverage-queries.ts`, named in its own header comment) does
**not** exist yet, and no screen calls it.

---

## 1. Every figure the four families need, and who produces it

`(file:line)` is the single place that decides the number today. "Does not exist yet" means I
found no function producing it — not that it is impossible.

### 1a. Delivery

| Figure | Owner |
|---|---|
| Task status counts per app (todo / in_progress / done / total) | `src/features/apps/queries.ts:109` `listApps` (conditional aggregate); per-app header `src/features/apps/queries.ts:410` `getAppCounts` — deliberately identical SQL |
| Overdue task count per app | same two, `countWhere(status != done AND due_date < today)`; `today` is Colombo via `toIsoDateInTimeZone` |
| Overdue / due-soon / oldest-overdue per **person** | `src/features/people/task-workload.ts:128` `summarizeOpenTasks`, on top of `dueState` (line 60) |
| "Due soon" horizon for tasks | `src/features/people/task-workload.ts:47` `DUE_SOON_DAYS = 7` — **see finding 2.2** |
| Share of tasks done (%) | `src/features/apps/app-health.ts:137` `completionPct` |
| Share of sprint tasks done (fraction 0–1) | `src/features/dashboard/sprint-progress.ts:8` `sprintProgress` — **duplicate, see finding 2.3** |
| Sprint elapsed time / phase / % of days gone | `src/features/apps/app-health.ts:111` `sprintDayProgress` |
| Days left on a sprint | `sprintDayProgress().remainingDays` (`app-health.ts:120`) **and** `src/features/dashboard/sprint-progress.ts:20` `daysRemaining` — **two answers, see finding 2.4** |
| Time-vs-work gap threshold | `src/features/apps/app-health.ts:219` `BURN_GAP_THRESHOLD = 25` (the only one; `plan-read.ts` imports it) |
| One sprint's verdict (not-started / on-track / behind / overdue / complete) + its sentence | `src/features/sprints/plan-read.ts:107` `readSprint`; word map at `plan-read.ts:78` `HEALTH_WORD` |
| Unowned / undated open work in a sprint | `src/features/sprints/plan-read.ts:201` `planGaps` |
| Which sprint is "the one we're in" / "the next one" | `src/features/apps/app-health.ts:152` `pickCurrentSprint` / `:165` `pickNextSprint`, both over `src/features/sprints/sprint-date-range.ts:163` `isSprintRunningNow` |
| Board progress a person's tasks imply | `src/features/sprints/checkins.ts:34` `computeTaskProgress` |
| Self-report vs board gap | `src/features/sprints/checkins.ts:77` `checkinGap`; threshold `:59` `CHECKIN_GAP_THRESHOLD = 15` |
| Sprint task counts for every bar on one app's roadmap | `src/features/sprints/queries.ts:198` `getSprintTaskCounts` |
| Cross-app running sprints + their counts | `src/features/sprints/queries.ts:89` `getActiveSprints` |
| **Tasks completed per week / throughput** | **Does not exist yet.** `tasks` has no `completed_at`/`updated_at` column (`src/db/schema.ts:279`), stated in `task-workload.ts`'s header. Only derivable from `activity_log` — see §3. |
| **Cycle time / lead time** | **Does not exist yet**, and not derivable: no per-status timestamps anywhere. |
| **Delivery figures rolled to org level** | **Does not exist yet** except as `summarizePortfolio` (`app-health.ts:356`), which sums per-app counts for the /apps header strip. |

### 1b. People load & coverage

| Figure | Owner |
|---|---|
| Whether a day is worked, and how much of one (1 / 0.5 / 0) | `src/lib/working-days.ts:41` `workingDayFraction` — **the** definition; `isWorkingDay` :55, `isHalfWorkingDay` :63 |
| The studio's default week as a pattern | `src/features/worklog/schedules.ts:15` `STUDIO_DEFAULT_PATTERN` (mirrors the above; a test asserts parity) |
| The schedule in force on a given day | `src/features/worklog/schedules.ts:38` `patternForDay` |
| Per-(person, day) status: logged / off / exempt / not-yet-due / missing | `src/features/worklog/coverage.ts:83` `computeCoverage` |
| Fractional expected / logged / missing / exempt totals | same, `CoverageSummary` (`coverage.ts:47`) |
| The only sanctioned way a coverage figure reaches a screen | `src/features/worklog/coverage.ts:161` `formatCoverage` (deliberately cannot emit a bare percentage) |
| Which days a person still owes a log for (the backfill prompt) | `src/features/worklog/missing-days.ts:52` `missingWorkDays` — **overlaps coverage, see finding 2.1** |
| Backfill cap | `src/features/worklog/missing-days.ts:29` `MAX_BACKFILL_DAYS = 10` |
| The day a person joined (floor for everything above) | `src/features/worklog/queries.ts:34` `getUserJoinDay` (`users.createdAt`, Colombo) |
| Days logged + average % over the days logged | `src/features/worklog/worklog-day.ts:59` `summarizeWorklogs` (denominator = logged days, **not** owed days) |
| Colombo work day for an instant; window of recent days | `src/features/worklog/worklog-day.ts:20` `resolveWorkDay`, `:44` `worklogDaysBack` |
| Team's worklog rows over a range | `src/features/worklog/queries.ts:78` `getTeamWorklogs` |
| A person's live allocation total | `src/features/people/allocation.ts:4` `summarizeAllocations`, consumed by `src/features/people/queries.ts:162` `getUserCapacities` |
| Over / near / normal capacity band | `src/features/people/components/capacity-bar.tsx:14` `capacityBand`; `NEAR_CAPACITY_PCT = 80` at `:4` |
| Team load stats (headcount, over, near, idle, avg, headroom) | `src/features/people/capacity-compare.ts:107` `teamLoadStats` |
| Allocation **as of** a past instant | `src/features/people/allocation-history.ts:63` `capacityAsOf` over `:43` `selectRowsAsOf`; query `src/features/people/queries.ts:254` `getTeamCapacityAsOf` |
| Per-person movement between two dates | `src/features/people/capacity-compare.ts:45` `compareCapacities` |
| Load pivoted by app | `src/features/people/capacity-compare.ts:140` `appLoadRows` |
| Continuous stretches over 100% | `src/features/people/capacity-compare.ts:230` `overloadStretches` |
| Allocation churn (assigned / updated / removed) | `src/features/people/capacity-compare.ts:205` `churnCounts` |
| Team-wide allocation total at every instant it changed | `src/features/people/allocation-history.ts:240` `allocationTotalSeries` |
| Everything the capacity-history page needs, from ONE history read | `src/features/people/queries.ts:345` `getCapacityHistoryOverview` |
| The capacity-history stat strip and its delta wording | `src/features/people/history-stats.ts:30` `buildCapacityHistoryStats`; `:24` `formatDelta` |
| The person page's stat row | `src/features/people/person-stats.ts:64` `buildPersonStats` |
| The dashboard's four personal tiles | `src/features/dashboard/my-day-stats.ts:28` `buildMyDayStats` |
| Task-arrival contribution graph (tasks **created** with this assignee) | `src/features/people/activity-levels.ts:67` `buildActivitySeries` (+ `activityLevel` :50, `activityTotal` :80, `activityPeak` :85); query `src/features/people/queries.ts:645` `getPersonActivity` |
| Meetings a person did not decline, 30d | `src/features/people/meeting-window.ts:74` `splitPersonMeetings` (`attendedRecently`) |
| Who was on a meeting **as of** a past instant | `src/features/meetings/attendance-history.ts:85` `attendanceAsOf` |
| Absence overlap check | `src/features/worklog/schedules.ts:59` `overlaps` |
| **Coverage query layer (fetch logged days, approved absences, schedules, merged holidays)** | **Does not exist yet** — `coverage-queries.ts` is named in `coverage.ts`'s header but is not on disk. |
| **Any coverage figure on a screen** | **Does not exist yet.** No component imports `computeCoverage`. |
| **Observed meeting hours / invited hours per person or series** | **Does not exist yet.** Planned in `docs/superpowers/plans/2026-08-12-meeting-load-reduction.md`; nothing landed (no `series-groups.ts`, no `meeting_load_decisions`). |
| **Merged per-person work-history ledger** | **Does not exist yet.** Planned in `docs/superpowers/plans/2026-08-12-people-kpis.md`; nothing landed. |

### 1c. Meeting follow-through

| Figure | Owner |
|---|---|
| A person's open follow-ups, split owed vs awaiting, oldest first | `src/features/people/followup-split.ts:93` `splitPersonFollowups`; query `src/features/people/queries.ts:834` `getPersonFollowups` |
| Age of an open follow-up (person surfaces) | `followup-split.ts:82` `withAge` — Colombo days from the **source meeting** |
| "Stale" threshold (person + dashboard) | `src/features/people/followup-split.ts:80` `FOLLOWUP_STALE_DAYS = 14` — **see finding 2.5** |
| Age of an open follow-up (meeting panel) | `src/features/meetings/components/meeting-notes-model.ts:314` `followupAge` |
| "Stale" / "aging" thresholds (meeting panel) | `meeting-notes-model.ts:299` `FOLLOWUP_STALE_DAYS = 21`, `:298` `FOLLOWUP_AGING_DAYS = 7` |
| "Stale" threshold (carry-forward selection) | `src/features/meetings/followups.ts:163` `CARRY_STALE_DAYS = 21` |
| What carries into the next meeting, grouped per person, capped | `src/features/meetings/followups.ts:180` `selectCarriedForward`; cap `:154` `MAX_CARRIED_PER_PERSON = 5` |
| Items the AI could not attribute to anyone | `src/features/meetings/followups.ts:235` `selectUnattributed` |
| One meeting's glance: actions, overdue actions, open + stale follow-ups, questions | `src/features/meetings/components/meeting-notes-model.ts:356` `glanceFromIntel` |
| Merged commitment list from AI notes | `meeting-notes-model.ts:153` `buildActionList` |
| Whether a spoken due date is overdue / today / soon | `meeting-notes-model.ts:73` `dueStatus` + `:36` `parseSpokenDueDate`; `DUE_SOON_DAYS = 3` at `:28` — **see finding 2.2** |
| Follow-up ↔ task link decision | `src/features/meetings/followups.ts:336` `findMatchingFollowup`; threshold `:320` `FOLLOWUP_TASK_MATCH_THRESHOLD = 0.5` |
| Auto-resolve / auto-reopen on task status change | `src/features/meetings/followups.ts:367` `decideFollowupResolutionOnTaskStatusChange`; writer `src/features/sprints/task-actions.ts:187` `syncLinkedFollowups` |
| **Follow-through rate (resolved ÷ raised), per meeting / person / project / org** | **Does not exist yet.** Also explicitly rejected once — see §5. |
| **Median / mean time-to-resolve** | **Does not exist yet.** Partly derivable (`resolvedAt`) but lossy — see §3. |
| **Any org-wide follow-up count** | **Does not exist yet.** Every read is scoped to one person (`getPersonFollowups`) or one meeting (`glanceFromIntel`). |

### 1d. Project health rollup

| Figure | Owner |
|---|---|
| Per-app verdict (at-risk / watch / on-track / dormant), score, plain-language reasons | `src/features/apps/app-health.ts:233` `appHealth`; labels `:226` `HEALTH_LABEL` |
| The weights and thresholds behind it | `app-health.ts:209–223` (`SPRINT_OVERRUN_POINTS`…`WATCH_SCORE`), `:219` `BURN_GAP_THRESHOLD = 25`, `:221` `STALE_ACTIVITY_DAYS = 21` |
| Workspace roll-up (apps, live, open, overdue, active sprints, meetings this week, at-risk, unassigned) | `src/features/apps/app-health.ts:356` `summarizePortfolio` — consumed by `/apps` (`src/app/(app)/apps/page.tsx:39`) and the dashboard Portfolio zone (`src/features/dashboard/components/dashboard-zones.tsx:200`) |
| "Last activity" feeding the staleness rule | `src/features/apps/queries.ts:109` `listApps` / `:410` `getAppCounts` — `max(created_at)` over tasks, meetings, app_comments — **see finding 2.6** |
| Risk sort and risk filter on /apps | `src/features/apps/browse.ts` (`sortApps`, `riskMatches`) |
| PM / lead history per app | `src/features/apps/queries.ts:353` `getAppRoleHistory` over `app_role_history` |
| The change trail | `src/features/activity/queries.ts:13` `listActivity`, `:105` `listRecentActivity`, filter lists `:74` / `:84` |
| **Any health figure over time** | **Does not exist yet**, and not derivable — see §3. |
| **A per-project rollup that includes people load or coverage** | **Does not exist yet.** `summarizePortfolio` counts `members.length` only; it never reads allocation percentages. |

---

## 2. The real findings — pairs that already disagree

These are ordered by how likely they are to put two different numbers for the same word on
two screens.

### 2.1 "Missing work day" has two definitions, and they answer differently today

- `src/features/worklog/missing-days.ts:52` `missingWorkDays` — the backfill prompt on `/worklog`.
- `src/features/worklog/coverage.ts:83` `computeCoverage` — status `'missing'`.

Three substantive differences, all live:

1. **Absences.** `missingWorkDays` has no absence input at all. `computeCoverage` takes
   `exemptDays` (approved absences only, `coverage.ts:29`). A person with approved leave is
   still asked to backfill those days by `/worklog`, while coverage would call them `exempt`.
2. **Schedules.** `missingWorkDays` delegates to `isWorkingDay` (`missing-days.ts:41`), which
   is the studio-wide week. `computeCoverage` takes `patternFor` and honours a
   `work_schedules` row. A part-time person is asked for every weekday by the backfill list
   and owed only their pattern by coverage.
3. **Org holidays.** `missingWorkDays`' `isHoliday` parameter is optional and defaults to
   gazetted-only (`src/lib/working-days.ts:26`). The one caller,
   `src/app/(app)/worklog/page.tsx:101`, passes **nothing**. A company shutdown day recorded
   in `org_holidays` therefore still appears as owed in the backfill list, while coverage —
   whose caller is required to merge `org_holidays` into `isHoliday` (`coverage.ts:33`) —
   calls it `off`.

Also a unit mismatch: `missingWorkDays` returns whole days (a Saturday counts as one entry);
`computeCoverage` counts a Saturday as 0.5 on both sides of the ratio.

This is the sharpest one. If a coverage KPI ships beside the existing backfill prompt, the
same person will be told they owe N days in one place and N−k in the other, on the same day.
**Decision needed:** either `missingWorkDays` becomes a thin selector over `computeCoverage`'s
`days` (filter `status === 'missing'`, take the last `MAX_BACKFILL_DAYS`), or the product
accepts and *states* that the prompt is deliberately looser. It cannot silently be both.

### 2.2 `DUE_SOON_DAYS` is declared twice with different values

- `src/features/people/task-workload.ts:47` → **7**, labelled "Due this week"
  (`DUE_STATE_LABEL`, `:49`).
- `src/features/meetings/components/meeting-notes-model.ts:28` → **3**, labelled "soon".

Both feed a bucket a reader sees. A commitment due in 5 days is "due this week" on the person
page and merely "scheduled" in the meeting panel. Neither imports the other.

### 2.3 Sprint completion is computed in two places, in two shapes

- `src/features/apps/app-health.ts:137` `completionPct` → rounded whole percent over
  `AppTaskCounts.total`.
- `src/features/dashboard/sprint-progress.ts:8` `sprintProgress` → fraction 0–1 over
  `todo + in_progress + done`.

They agree numerically today (`plan-read.ts:37` `toTaskCounts` builds `total` the same way),
so this is a latent rather than an active disagreement — but they are two call paths for one
word: the dashboard's Active-sprints card uses `sprintProgress`
(`src/features/dashboard/components/active-sprints.tsx:93`), while `/apps`, the app page and
both roadmap surfaces go through `readSprint` → `completionPct`. Any change to what counts as
"done work" has to be made twice or it will diverge.

### 2.4 "Days left on this sprint" already disagrees across the timezone boundary

- `src/features/apps/app-health.ts:120` — `remainingDays = dayDiff(today, endDate)`, where
  `today` is a caller-supplied **Asia/Colombo** ISO day (`listApps` uses
  `toIsoDateInTimeZone`, `apps/queries.ts:110`).
- `src/features/dashboard/sprint-progress.ts:20` — `differenceInCalendarDays(new Date(endDate + 'T12:00:00'), now)`,
  where `now` defaults to `new Date()` and the parse is **machine-local**.

On Vercel (UTC) at 20:00 UTC, Colombo is already the next day. `sprintDayProgress` says
"ends today"; `daysRemaining` says "1 day left". Both render, on the same request, on
`/` and `/apps`. `daysRemaining` is additionally reused against a *start* date
(`active-sprints.tsx:78`), so the same drift shows in "Starts in N days".

### 2.5 "Stale follow-up" has two values: 14 and 21

- `src/features/people/followup-split.ts:80` `FOLLOWUP_STALE_DAYS = **14**` — drives the "Owes"
  tile's alert tone on the person page (`person-stats.ts:147`), the same tone on the dashboard
  (`my-day-stats.ts:55`, `:61`), and the red row in
  `src/features/people/components/person-followups-card.tsx:139`.
- `src/features/meetings/components/meeting-notes-model.ts:299` `FOLLOWUP_STALE_DAYS = **21**`
  — drives the meeting panel's `'stale'` tone and `glanceFromIntel`'s `staleFollowups`.
- `src/features/meetings/followups.ts:163` `CARRY_STALE_DAYS = **21**` — drives
  `selectCarriedForward`'s `stale` flag and the one-click close in `ai-actions.ts:2356`.

The same exported **name** with two values in two modules. The comment at `followups.ts:158`
claims "Same value as `FOLLOWUP_STALE_DAYS` in `meeting-notes-model.ts` — one definition of
'stale' for the carry-forward system", which is true *within* the meeting lane and is exactly
what hides the split from the person lane. An item raised 17 days ago is a red alert on the
person page and calm on the meeting it came from.

`followup-split.ts:71–79` documents that this constant was extracted precisely because "two
definitions of urgent on one screen" was a bug. There are now two definitions on two screens.

### 2.6 "Last activity" means two different things

`appHealth`'s staleness rule ("Nothing has happened for N days", `app-health.ts:296`) reads
`lastActivityOn`, which `listApps` computes as `max(created_at)` over `tasks`, `meetings`
and `app_comments` (`apps/queries.ts` task/meeting/comment aggregates; `getAppCounts:410`
repeats it and its own comment says the two must not diverge).

That is **creation** time only. Moving every card on a board, closing a sprint, editing a
meeting, resolving follow-ups — none of it moves the number. Meanwhile `/activity` and the
dashboard feed read `activity_log` (`activity/queries.ts:13`, `:105`), which records all of
it. An app in daily use whose last *created* row is 22 days old reads "Nothing has happened
for 22 days" on its card while its own activity feed is full. Any health-rollup trend has to
pick one of these and say which.

### 2.7 Follow-up age is measured in two timezones

- `src/features/people/followup-split.ts:85` — `isoDayDiff(todayIso, isoDayOf(meetingStartsAt))`,
  both Asia/Colombo (`iso-day.ts:73`).
- `src/features/meetings/followups.ts:197` — `differenceInCalendarDays(now, sourceMeetingStartsAt)`,
  machine-local.
- `src/features/meetings/components/meeting-notes-model.ts:315` — same, machine-local.

Same quantity ("days since the meeting this came out of"), two day boundaries, ±1 day apart
for 5.5 hours out of every 24 on a UTC server. Combined with 2.5, the person page and the
meeting panel can differ by both a threshold and a day.

### 2.8 "Overdue" is three unrelated things

1. **Task overdue** — `dueDate < todayIso` in Colombo (`task-workload.ts:60`, and the SQL
   `countWhere` in `apps/queries.ts`).
2. **Sprint overdue** — `readSprint` health `'overdue'`: past `endDate`, not closed, work left
   (`plan-read.ts:137`).
3. **Commitment overdue** — `dueStatus` over a *spoken* date the model wrote, parsed by
   `parseSpokenDueDate`, compared with local-zone `differenceInCalendarDays`
   (`meeting-notes-model.ts:73`). Feeds `glanceFromIntel`'s `overdueActions`.

Each is defensible alone. A single "overdue" KPI that sums or compares them would be wrong,
and a shared label would be a lie. If the delivery family wants one "late work" number, it
must name which of the three it is.

### 2.9 `inclusiveDayCount` is declared twice

`src/features/apps/app-health.ts:83` and `src/features/sprints/sprint-date-range.ts:52`. Same
semantics, two implementations (`dayDiff` vs `dayDelta`). No behavioural difference found;
it is a name collision that will be edited once and not twice.

### 2.10 `NEAR_CAPACITY_PCT` is honoured in one place and re-typed in another

`capacity-bar.tsx:4` defines 80, and `teamLoadStats` (`capacity-compare.ts:113`) imports it.
`history-stats.ts:47` writes `stats.avgPct >= 80` as a literal instead. Same number today; the
constant exists to keep it that way.

### 2.11 "Over capacity" is decided in three places

`allocation.ts:4` (`overallocated: totalPct > 100`), `capacity-bar.tsx:14` (`capacityBand`),
`capacity-compare.ts:113` (`overCount`). All agree on `> 100`. Three sites, one rule, no
shared constant.

### 2.12 Live allocation and historical allocation come from different tables

`getUserCapacities` (`people/queries.ts:162`) sums live `assignments`. `getTeamCapacityAsOf`
(`:253`) and `getCapacityHistoryOverview` (`:344`) sum `assignment_history` via `capacityAsOf`.
I checked every writer of `assignments` — `people/actions.ts` (assignUser / updateAssignment / removeAssignment),
`meetings/ai-actions.ts` (assignSpeaker), `admin/trash-actions.ts` (restoreAssignment) — and each appends the matching
history rows in the same `db.batch`; the only other deleter is `clearTestData`
(`admin/actions.ts:74`), which drops `apps`/`users` too and so cascades the history away.
So the two agree **today**. It is worth naming because "as of today" via the history path and
"now" via the live path are two code paths that must be kept in step, and a KPI that plots a
trend ending at "now" will be mixing them.

### 2.13 `FollowupKind` is declared twice

`src/features/people/followup-split.ts:33` and `src/features/meetings/followups.ts:15`, plus
the `followupKind` pgEnum. Cosmetic, but it is the same symptom as 2.5: the person lane and
the meeting lane have grown parallel copies of the follow-up domain.

---

## 3. Which figures need a trend, and whether the data exists

"Trend" here means *which way is this moving*, not a second snapshot rendered next to the
first. The capacity-history page already does the honest version of the latter
(`buildCapacityHistoryStats` states its own comparison in every tile's `meta`,
`history-stats.ts:11–14`).

### Genuinely needs a trend, and the data already exists

| Figure | Source | Caveats to state on screen |
|---|---|---|
| Team average load, over/near counts, headroom | `assignment_history` — `allocationTotalSeries` (`allocation-history.ts:240`) and `getCapacityHistoryOverview` (`people/queries.ts:345`) already produce it | Roster is **today's** roster (`getTeamCapacityAsOf`'s own comment, `people/queries.ts:240–246`): someone since deactivated is absent from past snapshots. Migration-0015 backfilled rows carry an *inferred* `effectiveFrom`. |
| Time spent over 100%, per person | `overloadStretches` (`capacity-compare.ts:230`) already computes stretches, not just points | None beyond the above. |
| Allocation churn | `churnCounts` (`capacity-compare.ts:205`) over `assignment_history` rows in the window | Counts admin actions, not the person's behaviour. |
| Who has been PM/lead of a project, when | `app_role_history` (`getAppRoleHistory`, `apps/queries.ts:353`) | Backfilled rows carry the `BACKFILLED_APP_ROLE_NOTE` sentinel — distinguishable from observed ones by design (`schema.ts:155`). |
| Meeting roster / RSVP over time | `meeting_attendee_history` via `attendanceAsOf` (`attendance-history.ts:85`) | RSVP is mostly `'pending'` forever; never label it attendance (`meeting-window.ts:12–16`). |
| Task **arrival** per day, per person | `getPersonActivity` (`people/queries.ts:645`) → `buildActivitySeries` | It is work arriving, not work finishing — the module says so at `activity-levels.ts:22–25`. Do not relabel it "delivery". |
| Worklog percentage per person per day | `daily_worklogs` (one row per person per day, `schema.ts:942`) | The average is over **logged** days only (`worklog-day.ts:54–58`). It is a self-score of "what I planned", never comparable across people. |

### Needs a trend, derivable only with real caveats

**Tasks completed per week.** `tasks` has no completion timestamp. The only source is
`activity_log`: `updateTask` and `moveTaskOnBoard` write `verb: 'completed'` / `'reopened'`
with `metadata.status.{from,to}` and an `appId` (`task-actions.ts:402`, `:525`). Three holes,
all verified:

1. `logActivity` **never throws** and swallows every failure (`activity/log.ts:9–15`). It is
   best-effort bookkeeping, not a ledger. A week with a database blip under-reports silently.
2. `bulkUpdateTasks` writes **one** `verb: 'updated'` row for the whole batch, with
   `metadata: { patch, taskIds }` and `appId: null` when the batch spans apps. Marking eight
   tasks done from the board produces **zero** `'completed'` rows. The task ids and the patch
   are recoverable from metadata; the per-task prior status and assignee are not.
3. `'reopened'` must be netted out or a mis-click inflates the following week.

A completions trend is buildable. It must be labelled as *recorded* completions, and holes 1
and 2 must be stated or fixed before it is presented as throughput.

**Time-to-resolve a follow-up.** `meeting_followups` has `resolvedAt` (`schema.ts:626`). But
`syncLinkedFollowups`' reopen path sets `resolvedAt: null` (`task-actions.ts:208`), destroying
the original close time. And follow-ups are **hard-deleted** by
`src/features/meetings/followup-move-actions.ts:186` (a sanctioned delete — the table has no
`deletedAt`). So both halves of a resolution *rate* are unstable: the numerator loses reopened
items' history, and the denominator shrinks retroactively when someone tidies up. Derivable as
"currently-resolved items, closed N days after their meeting"; **not** derivable as a rate that
holds still.

### Needs a trend, and the data does **not** exist

**Project health over time ("is this project getting better or worse?").** `appHealth` is
computed live from current counts every render. There is no history of task status counts, no
history of `sprints.status`, no history of `apps.status`, and `activity_log` records verbs
rather than the aggregate. `app_role_history` only covers PM/lead. Reconstructing "what was
this app's at-risk score on 3 June" would mean replaying every task event — which hits all
three `activity_log` holes above.

**This is the one place a snapshot table is genuinely required**, and I am saying so plainly
rather than inventing a derivation. A daily row per app carrying the inputs `appHealth`
already takes (`AppHealthInput`, `app-health.ts:192`) plus the resulting score would do it.
That is new storage and a migration, and **migrations are forbidden in this wave** — so the
honest options for now are (a) ship health as a snapshot with no trend and say so, or (b)
scope a snapshot table as a separate, later piece of work.

**Coverage over time.** The inputs exist (`daily_worklogs`, `absences`, `work_schedules`,
`org_holidays`) and `computeCoverage` will happily run over a past window. But the result is
not *reproducible*: `absences` carries current status only and approval is explicitly
retroactive with no limit (`schema.ts:1085–1090` — "Coverage is truth-as-currently-known,
never a frozen snapshot"), and `org_holidays` rows are **revoked by delete**
(`schema.ts:1120–1123`). Last month's coverage number will change when someone approves late
leave or deletes a holiday. A recomputed trend is fine and honest; a coverage figure that must
match a number someone screenshotted last week would need a frozen snapshot table — again,
new storage.

**Meeting load / invited hours over time.** Nothing exists to trend. See §1b.

### Does not need a trend

Per-sprint `readSprint`, `checkinGap`, `planGaps`, `formatCoverage`'s current-window line, the
person page's "Owes" tile. These are *states to act on now*; a trend on them adds noise. The
capacity page's model — a snapshot plus one delta sentence per tile — is the right precedent
where a comparison genuinely helps.

---

## 4. Per-role visibility

Read from `src/features/auth/capabilities.ts` (`ROLE_GRANTS`, line 67; `can`, line 170).
Levels: `all` / `scoped` / `own` / `none`. `scoped` means the actor's `scopeAppIds`, resolved
once per request by `loadActor` (`src/features/auth/actor.ts:21`) from a **different source per
role** (`scopeSourceFor`, `capabilities.ts:147`): manager → open `app_role_history` rows with
role pm/lead; editor & member → `assignments`; stakeholder → `app_grants`; superadmin, admin,
auditor → `none` (they don't need one, their grants are `all`).

| Family | Governing grant(s) | superadmin | admin | manager | editor | member | stakeholder | auditor |
|---|---|---|---|---|---|---|---|---|
| Delivery — per-project figures | `app.view` (:80) | all | all | all | scoped | scoped | scoped | all |
| Delivery — per-**person** task load | `user.view.detail` (:70) | all | all | all | scoped | scoped | **none** | all |
| People load — allocation / capacity per person | `user.view.detail` (:70) | all | all | all | scoped | scoped | **none** | all |
| People load — the directory itself | `user.view.directory` (:69) | all | all | all | all | all | **none** | all |
| Coverage — per-person coverage detail | `coverage.view` (:92) | all | all | scoped | scoped | **own** | **none** | all |
| Coverage — underlying worklog entries | `worklog.view` (:88) | all | all | scoped | scoped | **own** | **none** | all |
| Coverage — absence reasons behind an `exempt` day | `absence.view` (:118) | all | all | scoped | scoped | **own** | **none** | all |
| Meeting follow-through | `meeting.intel.view` (:102) | all | all | scoped | scoped | **scoped** | **scoped** | all |
| Project health rollup | `app.view` (:80) | all | all | all | scoped | scoped | scoped | all |
| Any admin-surface placement of a rollup | `admin.view` (:127) | all | all | all | none | none | **none** | all |
| Audit trail behind a figure | `audit.view` (:126) | all | all | scoped | none | none | none | all |

**The specific answers asked for:**

- **A stakeholder seeing a project rollup but not per-person detail** is decided by the pair
  `app.view = scoped` (:80) **and** `user.view.detail = none` (:70). That combination already
  exists and needs no new grant: a stakeholder may see a delivery/health rollup for the apps
  in their `app_grants`, and must never see a figure keyed to a named person. Note
  `user.view.directory` is also `none` for stakeholder — a stakeholder cannot even enumerate
  the team, so a rollup shown to them must not carry names, avatars or headcount-by-person.
  `worklog.view`, `coverage.view` and `absence.view` are all `none` for stakeholder, so the
  people-load and coverage families are entirely closed to that seat.
- **An auditor seeing everything but changing nothing** is already the shape of the matrix:
  `auditor` is `all` on every view grant in the table above (`worklog.view`, `coverage.view`,
  `absence.view`, `meeting.intel.view`, `user.view.detail`, `app.view`, `audit.view`,
  `admin.view`) and `none` on every write. An auditor needs **no** new grant for any of the
  four families, including per-person coverage.
- **A member's own coverage** is `coverage.view = own` (:92) — the `own` level in `can`
  (`capabilities.ts:175`) requires `resource.ownerId === actor.id`, so a member gets their own
  coverage row and nothing else. Same for `worklog.view` and `absence.view`.
- **A manager's reach is narrower than it looks.** `scopeSourceFor('manager')` is
  `app_role_history` with role in (pm, lead) — deliberately **not** `managesApp()`
  (`capabilities.ts:150–157`). A team lead who is a manager by seat but has no open
  `app_role_history` row has an **empty** scope and will see nothing scoped, including
  coverage for their own team. That is a real onboarding dependency for any manager-facing
  coverage KPI, not a bug in the matrix.

**The gap that matters more than the matrix.** RBAC enforcement is mid-flight in another
session and the tree moved while this was being written, so treat this sub-section as a
dependency note with a short shelf life and re-verify before acting on it. As read:

- **Write paths are largely converted.** `requireCapability` (`auth/actor.ts:64`) now guards
  `sprints/actions.ts`, `sprints/task-actions.ts:655`, `admin/actions.ts`,
  `admin/trash-actions.ts` and others; `worklog/absence-actions.ts` (53, 116, 172) uses
  `loadActor` + `can` directly.
- **Read paths are still a two-value flag.** Pages now call `isAdminRole`
  (`capabilities.ts:198`), which is `role === 'superadmin' || role === 'admin'` — a boolean,
  not a grant. `src/app/(app)/page.tsx:60` (dashboard Team + Portfolio zones),
  `apps/page.tsx:32`, `meetings/page.tsx:39`, `apps/[slug]/page.tsx:91`, `layout.tsx:20`.
  This correctly promotes superadmin, but a **manager, editor, member, stakeholder or auditor
  gets the same "not admin" branch** — so `scoped` and `auditor: all` are not reachable on any
  of those surfaces yet.
- `src/app/(app)/worklog/page.tsx:35` still uses the literal `session.user.role === 'admin'`,
  so the team worklog view is invisible to superadmin, manager and auditor alike.
- `src/app/(app)/people/page.tsx`, `people/[id]/page.tsx`, `people/history/page.tsx` and
  `activity/page.tsx` read **no session at all** (verified: zero matches for `getSession`,
  `auth()`, `loadActor` or `isAdminRole` in any of the four). Every signed-in user currently
  sees every colleague's full allocation timeline, open tasks, follow-ups and meeting list.

So: the matrix says what *should* be true, the read surfaces do something coarser, and the two
must be reconciled **before** a per-person coverage or load figure is added to any of them.
Adding a coverage tile to `/people/[id]` as it stands today publishes every person's coverage
to the whole company. (This is `logpup-fa`'s work — a dependency note, not a proposal to
touch it.)

---

## 5. Flags for a human — judgement calls and anything that would be a "score"

1. **`appHealth`'s score is already a synthetic composite**, and it is the only one in the
   product. Its weights (`app-health.ts:209–223`) are, by its own header, "deliberately coarse
   … not a model … Anything finer-grained would be false precision". It survives honestly
   because it always ships with `reasons: string[]` rendered verbatim. **Any rollup that
   averages, ranks or trends this score across projects strips the reasons and turns a
   deliberately coarse triage aid into a number that looks measured.** If the project-health
   family wants one org number, my recommendation is to surface `summarizePortfolio`'s
   `atRisk` **count** (`app-health.ts:381`) plus the reasons, never a mean score. Human call.

2. **Do not build a follow-through *rate*, or an opened-vs-resolved chart, without revisiting
   the prior decision.** `docs/superpowers/plans/2026-08-12-people-kpis.md` records that
   "follow-up resolution rate", "opened-vs-resolved chart", "debt-age signal" and "overdue
   trend" were all explicitly rejected in the people-KPI spec's "Rejected" section. §3 above
   also shows the denominator is not stable (hard deletes) and the numerator is lossy
   (reopen nulls `resolvedAt`). Reopening that decision is a product call, not an
   implementation one.

3. **The same plan bans, by name:** any composite score about a *person*, any leaderboard, any
   ranking of people against each other, and the ratio `observed hours ÷ allocationPct`. Three
   of the four families here are one design meeting away from producing exactly those. The
   worklog page already states the principle in user-facing copy
   (`src/app/(app)/worklog/page.tsx`: "they read as a trend per person rather than a league
   table"). Any cross-person comparison in the people-load family needs an explicit human
   decision that overrides this.

4. **Coverage percentages must never appear without their denominator.** `formatCoverage`
   (`coverage.ts:161`) is built so that the bug-shape is *not expressible* — there is
   deliberately no parameter that yields a bare percent. A KPI dashboard that renders
   "Coverage: 87%" in a tile would route around that guard. If a tile is wanted, it needs a
   new formatter that still carries `logged/expected`, decided deliberately.

5. **Worklog percent is a self-score of "what I planned today"** (`schema.ts:942` note). It is
   not comparable between people and is not a measure of output. Rolling it into a
   delivery or a project-health number would present a self-report as a fact. Flagging rather
   than resolving.

6. **The "meetings" figure is "did not decline", not attendance.** `meeting-window.ts:12–16`
   and the tile's own `meta` string (`person-stats.ts:127`, "not declined, 30d") both say so,
   because `.ics` invites go out `RSVP=TRUE` and external replies never write back. Any
   meeting-follow-through KPI that says "attended" is a false claim the code has already
   refused to make twice.

7. **Which "last activity" the health family means (finding 2.6)** is a product decision, not a
   refactor. Creation-only is what makes the current staleness rule cheap (it rides on
   aggregates already being run). Switching it to `activity_log` changes which apps go red.

8. **Whether a health/coverage trend justifies a snapshot table** (§3) is the biggest call in
   this document, and it cannot be made in this wave — migrations are forbidden here and no
   schema change is in scope. It should be decided before any UI promises a direction arrow.

9. **Threshold reconciliation is a judgement call, not a mechanical merge.** Findings 2.2 and
   2.5 are two constants each with a documented rationale for its own value (a 3-day "soon" for
   a spoken deadline is arguably right; a 21-day carry threshold for a meeting item is
   arguably right). Collapsing them to one number each is a product decision about what the
   words "soon" and "stale" mean org-wide. What is *not* defensible is two exported constants
   sharing the name `FOLLOWUP_STALE_DAYS`.

---

## Appendix — modules read for this inventory

`apps/app-health.ts`, `apps/queries.ts`, `apps/browse.ts` · `sprints/plan-read.ts`,
`sprints/checkins.ts`, `sprints/sprint-date-range.ts`, `sprints/queries.ts`,
`sprints/checkin-queries.ts`, `sprints/task-actions.ts` · `dashboard/my-day-stats.ts`,
`dashboard/sprint-progress.ts`, `dashboard/components/active-sprints.tsx` ·
`people/person-stats.ts`, `people/history-stats.ts`, `people/capacity-compare.ts`,
`people/allocation.ts`, `people/allocation-history.ts`, `people/task-workload.ts`,
`people/followup-split.ts`, `people/meeting-window.ts`, `people/activity-levels.ts`,
`people/iso-day.ts`, `people/as-of-date.ts`, `people/history-params.ts`, `people/queries.ts`,
`people/components/capacity-bar.tsx` · `worklog/coverage.ts`, `worklog/schedules.ts`,
`worklog/missing-days.ts`, `worklog/worklog-day.ts`, `worklog/queries.ts` ·
`meetings/followups.ts`, `meetings/attendance-history.ts`,
`meetings/components/meeting-notes-model.ts` · `activity/queries.ts`, `activity/log.ts` ·
`auth/capabilities.ts`, `auth/actor.ts` · `lib/working-days.ts` · `db/schema.ts` ·
`db/live.test.ts` · the `/worklog`, `/`, `/apps`, `/people*`, `/meetings`, `/activity` pages ·
`docs/superpowers/plans/2026-08-12-people-kpis.md`,
`docs/superpowers/plans/2026-08-12-meeting-load-reduction.md`.
