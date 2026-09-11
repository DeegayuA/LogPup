# Node Description Batch 18 of 166

Graphify is running in assistant/skill mode (no API key). You are the host
assistant (Claude Code / Codex / Gemini CLI). Read the prompt below and write
your JSON answer to the answer file.

## Prompt

You are documenting nodes in a knowledge graph.
For each entry below, write ONE concise factual plain-language sentence
describing what it is or does. Use only the provided context.
For a code symbol (kind=code-symbol — a function, class, or constant),
describe what the function/symbol does based on its name, source location
and neighbors — e.g. "Resolves the configured ontology profile from graphify.yaml.".
For an entity node (any other kind — e.g. a person, place, event, object),
describe what the entity is and its role, grounded in its type, its
relations (neighbors) and the provided citations/evidence — e.g.
"Lady Carfax, a wealthy heiress who disappears en route to Lausanne.".
Ground entity descriptions in the citations/evidence when present; do not
speculate beyond the context, so a node with no supporting context may be
left out of the reply.
LANGUAGE: each entry has a `lang=` marker giving the language of its source.
Write that entry's description in EXACTLY that language. Do not translate to
a single common language — match each node's source language individually.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "people_activity_levels": "activity-levels.ts" | kind=code-symbol | source=src/features/people/activity-levels.ts:L1 | neighbors=[activity-graph.tsx, person-activity-card.tsx, ACTIVITY_THRESHOLDS, ActivityDay, ActivityLevel, activityPeak()] | lang=en
- "people_meeting_window": "meeting-window.ts" | kind=code-symbol | source=src/features/people/meeting-window.ts:L1 | neighbors=[person-meetings-card.tsx, iso-day.ts, isoDayOf(), AttendeeResponse, DEFAULTS, PersonMeetingEntry] | lang=en
- "people_team_csv": "team-csv.ts" | kind=code-symbol | source=src/features/people/team-csv.ts:L1 | neighbors=[1eedff1 feat(people): a project's team …, team-panel.tsx, bulk-logic.ts, CsvValue, employmentLabel(), projectPosition()] | lang=en
- "sprints_backlog": "backlog.ts" | kind=code-symbol | source=src/features/sprints/backlog.ts:L1 | neighbors=[live.ts, liveSprints, liveTasks, backlogCondition, backlogJoinCondition, backlogTasksQuery()] | lang=en
- "sprints_promises": "promises.ts" | kind=code-symbol | source=src/features/sprints/promises.ts:L1 | neighbors=[03e2c3f feat(deadlines): grade and orde…, escalation.ts, EscalationStep, GradedPromise, gradePromises(), MONTHS] | lang=en
- "sprints_sprint_date_range_addcalendardays": "addCalendarDays()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L35 | neighbors=[meeting-list.tsx, calendar-view.ts, roadmap-layout.ts, sprint-date-range.ts, parseIsoDate(), toIsoDate()] | lang=en
- "sprints_sprint_date_range_test": "sprint-date-range.test.ts" | kind=code-symbol | source=src/features/sprints/sprint-date-range.test.ts:L1 | neighbors=[sprint-date-range.ts, addCalendarDays(), dayDelta(), defaultSprintRange(), inclusiveDayCount(), initialSprintStatus()] | lang=en
- "sprints_task_rank": "task-rank.ts" | kind=code-symbol | source=src/features/sprints/task-rank.ts:L1 | neighbors=[board.tsx, task-actions.ts, compareRanked(), InsertPlan, needsRebalance(), neighboursAt()] | lang=en
- "ui_stat_tile": "stat-tile.tsx" | kind=code-symbol | source=src/components/ui/stat-tile.tsx:L1 | neighbors=[page.tsx, 743b1f2 fix(ui): a false-positive tag m…, app-header.tsx, dashboard-zones.tsx, directory.tsx, triage-rail.tsx] | lang=en
- "worklog_absence_kinds_test": "absence-kinds.test.ts" | kind=code-symbol | source=src/features/worklog/absence-kinds.test.ts:L1 | neighbors=[c9a2906 Centralize absence kinds and ad…, schema.ts, absenceKind, absence-kinds.ts, ABSENCE_KIND_DEFINITIONS, ABSENCE_KIND_LABELS] | lang=en
- "worklog_coverage_computecoverage": "computeCoverage()" | kind=code-symbol | source=src/features/worklog/coverage.ts:L108 | neighbors=[auto-score-sync.ts, catch-up-actions.ts, coverage.ts, eachDay(), weekdayKey(), coverage-queries.ts] | lang=en
- "worklog_entry_form": "entry-form.ts" | kind=code-symbol | source=src/features/worklog/entry-form.ts:L1 | neighbors=[afba1c3 feat(worklog): the hours form c…, day-hours-card.tsx, day-one-line.tsx, log-box.tsx, entries.ts, EntryCategory] | lang=en
- "worklog_missing_days": "missing-days.ts" | kind=code-symbol | source=src/features/worklog/missing-days.ts:L1 | neighbors=[working-days.ts, isWorkingDay(), coverage.ts, computeCoverage(), isRequiredWorkDay(), missingWorkDays()] | lang=en
- "worklog_review_rules": "review-rules.ts" | kind=code-symbol | source=src/features/worklog/review-rules.ts:L1 | neighbors=[0caca2e feat(worklog): who may review s…, a34ddfb fix(worklog): the review rule r…, capabilities.ts, Actor, can(), note-app-tags.ts] | lang=en
- "admin_approval_badge": "approval-badge.ts" | kind=code-symbol | source=src/features/admin/approval-badge.ts:L1 | neighbors=[approvalBadgeLabel(), approvalBadgeText(), ApprovalCounts, approvalTotal(), NO_APPROVALS, showApprovals()] | lang=en
- "admin_trash_queries_test": "trash-queries.test.ts" | kind=code-symbol | source=src/features/admin/trash-queries.test.ts:L1 | neighbors=[trash-queries.ts, qFor(), TableQueues, schema.ts, assignmentHistory, meetingNoteSegments] | lang=en
- "animate_ui_stat_number": "stat-number.tsx" | kind=code-symbol | source=src/components/animate-ui/stat-number.tsx:L1 | neighbors=[StatNumber(), statTransition, subscribeToReducedMotion(), useStaticNumber(), counting-number.tsx, CountingNumber()] | lang=en
- "apps_app_health_apphealth": "AppHealth" | kind=code-symbol | source=src/features/apps/app-health.ts:L184 | neighbors=[app-health.ts, completionPct(), daysSince(), sprintDayProgress(), app-health.test.ts, browse.ts] | lang=en
- "apps_role_history_test": "role-history.test.ts" | kind=code-symbol | source=src/features/apps/role-history.test.ts:L1 | neighbors=[role-history.ts, appRoleAsOf(), AppRoleInterval, AppRoleKind, buildAppRoleEntry(), buildRoleTimeline()] | lang=en
- "bugs_actions_test": "actions.test.ts" | kind=code-symbol | source=src/features/bugs/actions.test.ts:L1 | neighbors=[actions.ts, as(), { authMock, getBugScopeMock, insertSpy,…, builder(), inserted(), report()] | lang=en
- "bugs_queue_page": "queue-page.ts" | kind=code-symbol | source=src/features/bugs/queue-page.ts:L1 | neighbors=[queries.ts, bug-display.ts, OPEN_BUG_STATUSES, triageQueueConditions(), report-input.ts, BugFilters] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@59873cc5a76a77b80a33de0122b198a34d0e516e": "59873cc feat(gemini): a monthly AI budget — warn at 90%, refuse at 100%" | kind=Commit | source=git | neighbors=[main, 514d33b feat(meetings): a meeting can b…, schema.ts, 0063_ai_budget.sql, budget.ts, budget-notify.ts] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@5a95470609c0ba112796b79e5bc03892b1e5812a": "5a95470 fix(meetings): transcripts stop eating repeated words, and Sinhala meet…" | kind=Commit | source=git | neighbors=[2607f59 fix(speech): read-aloud budgets…, main, d70c02b fix(ui): bilingual live text su…, prompt-truncate.ts, prompt-truncate.test.ts, ai-actions.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@6909ea32e4bbeb19a85b42b68352090e934481c7": "6909ea3 feat(worklog): AI drafts the day's hours, and phrases what the check fo…" | kind=Commit | source=git | neighbors=[2865231 feat(deadlines): route all thre…, main, c8914a7 feat(intel): an error boundary …, ai-features.ts, model-choice.ts, entry-ai-actions.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@8d1b39041ada00d64c6d28b5940b33979541f66d": "8d1b390 fix(i18n): Sinhala survives every ASCII-shaped matcher" | kind=Commit | source=git | neighbors=[514d33b feat(meetings): a meeting can b…, search.ts, search.test.ts, main, 2607f59 fix(speech): read-aloud budgets…, mention-match.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@c2bc5fd155119b3eb5716a7f999cc72efd0e4c07": "c2bc5fd refactor(tasks): route in-memory status predicates through isTerminal" | kind=Commit | source=git | neighbors=[main, e8e9934 refactor(tasks): query open wor…, ask-derivation.ts, followups.ts, notes.ts, planner.ts] | lang=en
- "components_allocation_trend": "allocation-trend.tsx" | kind=code-symbol | source=src/features/people/components/allocation-trend.tsx:L1 | neighbors=[allocation-history-card.tsx, AllocationTrend(), utils.ts, cn(), allocation-history.ts, TrendPoint] | lang=en
- "components_danger_backup_card": "danger-backup-card.tsx" | kind=code-symbol | source=src/features/admin/components/danger-backup-card.tsx:L1 | neighbors=[danger-actions.ts, exportWorkspaceBackup(), danger-logic.ts, backupSummary(), formatBytes(), DangerBackupCard()] | lang=en
- "components_db_clear_button": "db-clear-button.tsx" | kind=code-symbol | source=src/features/admin/components/db-clear-button.tsx:L1 | neighbors=[actions.ts, clearTestData(), ConfirmButton(), DbClearButton(), action-result.ts, ActionResult] | lang=en
- "components_meeting_chips_metachip": "MetaChip()" | kind=code-symbol | source=src/features/meetings/components/meeting-chips.tsx:L66 | neighbors=[action-item-board.tsx, meeting-chips.tsx, meeting-detail-dialog.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx, meeting-list.tsx] | lang=en
- "components_speak_button": "speak-button.tsx" | kind=code-symbol | source=src/features/speech/components/speak-button.tsx:L1 | neighbors=[d5b6409 ., meeting-assistant.tsx, meeting-notes.tsx, SpeakButton(), use-speech.ts, SpeechHandle] | lang=en
- "components_sprint_status_select": "sprint-status-select.tsx" | kind=code-symbol | source=src/features/sprints/components/sprint-status-select.tsx:L1 | neighbors=[SprintStatusSelect(), Status, STATUS_OPTIONS, actions.ts, updateSprintStatus(), select.tsx] | lang=en
- "components_suggestion_decision_buttons": "suggestion-decision-buttons.tsx" | kind=code-symbol | source=src/features/meeting-load/components/suggestion-decision-buttons.tsx:L1 | neighbors=[5c7efa5 feat(meeting-load): four surfac…, meeting-load-admin-card.tsx, SuggestionDecisionButtons(), actions.ts, acceptLoadSuggestion(), dismissLoadSuggestion()] | lang=en
- "db_schema_meetingscreenshots": "meetingScreenshots" | kind=code-symbol | source=src/db/schema.ts:L1468 | neighbors=[danger-actions.ts, danger-actions.test.ts, trash-actions.ts, trash-actions.test.ts, trash-queries.ts, trash-queries.test.ts] | lang=en
- "drizzle_0000_complete_adam_warlock": "0000_complete_adam_warlock.sql" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L1 | neighbors=[apps, assignments, meeting_attendees, meetings, public.apps, public.meetings] | lang=en
- "e2e_seed_user": "seed-user.ts" | kind=code-symbol | source=e2e/seed-user.ts:L1 | neighbors=[auth.setup.ts, seed.ts, capabilities.ts, UserRole, index.ts, Db] | lang=en
- "finance_cost_test": "cost.test.ts" | kind=code-symbol | source=src/features/finance/cost.test.ts:L1 | neighbors=[85c3961 feat(finance): cost and worth d…, cost.ts, costForEntries(), EffortMix, margin(), PersonRate] | lang=en
- "lib_job_roles": "job-roles.ts" | kind=code-symbol | source=src/lib/job-roles.ts:L1 | neighbors=[set-user-title.test.ts, title-schema.ts, title-schema.test.ts, assign-dialog.tsx, capacity-heat-editable.tsx, speaker-assignment.tsx] | lang=en
- "meeting_load_density": "density.ts" | kind=code-symbol | source=src/features/meeting-load/density.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, coverageOf(), deadlinesCount(), ModelSegment, OutputCounts, OutputFacts] | lang=en
- "meeting_load_redaction_boundary_test": "redaction-boundary.test.ts" | kind=code-symbol | source=src/features/meeting-load/redaction-boundary.test.ts:L1 | neighbors=[d933927 feat(meeting-load): reads that …, queries.ts, PerAppLoadRow, SeriesTableRow, WeeklyLoadRow, expectNoNames()] | lang=en

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-017.json

Keep each description factual and concise (one sentence). No markdown, no prose
outside the JSON object. It is acceptable to omit a node if context is
insufficient — but include every node you can ground confidently.

Example answer format:
```json
{
  "node_id_1": "Resolves the configured ontology profile from graphify.yaml.",
  "node_id_2": "Colonel James Barclay, an antagonist in The Crooked Man."
}
```
