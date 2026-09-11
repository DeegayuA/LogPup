# Node Description Batch 21 of 166

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

- "meetings_time_drag": "time-drag.ts" | kind=code-symbol | source=src/features/meetings/time-drag.ts:L1 | neighbors=[meetings-time-grid.tsx, calendar-grid.ts, dragCreateRange(), draggedMinutes(), isRealMove(), isRealResize()] | lang=en
- "motion_transitions_test": "transitions.test.ts" | kind=code-symbol | source=src/components/motion/transitions.test.ts:L1 | neighbors=[007c37f ., transitions.ts, DURATION, EASE, css, cssCubic()] | lang=en
- "people_actions_removeassignment": "removeAssignment()" | kind=code-symbol | source=src/features/people/actions.ts:L323 | neighbors=[assignments-card.tsx, capacity-heat-editable.tsx, team-panel.tsx, actions.ts, assignmentStillExists(), closeOpenInterval()] | lang=en
- "people_actions_updateassignment": "updateAssignment()" | kind=code-symbol | source=src/features/people/actions.ts:L247 | neighbors=[assign-dialog.tsx, capacity-heat-editable.tsx, actions.ts, assignmentStillExists(), closeOpenInterval(), nameForUser()] | lang=en
- "people_capacity_hours_test": "capacity-hours.test.ts" | kind=code-symbol | source=src/features/people/capacity-hours.test.ts:L1 | neighbors=[f180d72 feat(people): capacity in hours…, capacity-hours.ts, allocatedHours(), hoursForFraction(), HoursLoad, NO_WEEK] | lang=en
- "people_commands": "commands.ts" | kind=code-symbol | source=src/features/people/commands.ts:L1 | neighbors=[59aa7b9 feat(search): people's cohort v…, cohort-params.ts, COHORT_VIEW_HINT, COHORT_VIEW_LABEL, COHORT_VIEWS, COHORT_COMMANDS] | lang=en
- "people_format_instant_formatbusinessweekdaydaymonth": "formatBusinessWeekdayDayMonth()" | kind=code-symbol | source=src/features/people/format-instant.ts:L67 | neighbors=[briefing-card.tsx, meeting-detail-dialog.tsx, meeting-header-actions.tsx, meetings-time-grid.tsx, actions.ts, share.ts] | lang=en
- "people_history_stats": "history-stats.ts" | kind=code-symbol | source=src/features/people/history-stats.ts:L1 | neighbors=[page.tsx, capacity-compare.ts, ChurnCounts, OverloadStretch, TeamLoadStats, buildCapacityHistoryStats()] | lang=en
- "people_queries_listactiveusers": "listActiveUsers()" | kind=code-symbol | source=src/features/people/queries.ts:L711 | neighbors=[page.tsx, page.tsx, page.tsx, page.tsx, page.tsx, lifecycle.ts] | lang=en
- "privacy_page": "page.tsx" | kind=code-symbol | source=src/app/(public)/privacy/page.tsx:L1 | neighbors=[671c254 ., c1235a2 docs(public): restore the four …, d0da911 test(gemini): a public page may…, metadata, PrivacyPolicyPage(), SECTIONS] | lang=en
- "public_layout": "layout.tsx" | kind=code-symbol | source=src/app/(public)/layout.tsx:L1 | neighbors=[671c254 ., c1235a2 docs(public): restore the four …, d0da911 test(gemini): a public page may…, alta-vision-logo.tsx, AltaVisionLogo(), PublicLayout()] | lang=en
- "signals_figure_test": "figure.test.ts" | kind=code-symbol | source=src/features/signals/figure.test.ts:L1 | neighbors=[d5b6409 ., figure.ts, cannotSay(), inferred(), isSuppressed(), measured()] | lang=en
- "signals_observe_test": "observe.test.ts" | kind=code-symbol | source=src/features/signals/observe.test.ts:L1 | neighbors=[d5b6409 ., observe.ts, ActivityRow, classifyActivity(), groupByUserDay(), isOutcome()] | lang=en
- "sprints_task_actions_createtask": "createTask()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L306 | neighbors=[task-composer.tsx, ai-actions.ts, task-actions.ts, isForeignKeyViolation(), nextRankFor(), notifyAssignmentIfAny()] | lang=en
- "sprints_task_rank_test": "task-rank.test.ts" | kind=code-symbol | source=src/features/sprints/task-rank.test.ts:L1 | neighbors=[task-rank.ts, compareRanked(), needsRebalance(), neighboursAt(), planInsert(), rankBetween()] | lang=en
- "terms_page": "page.tsx" | kind=code-symbol | source=src/app/(public)/terms/page.tsx:L1 | neighbors=[671c254 ., c1235a2 docs(public): restore the four …, d0da911 test(gemini): a public page may…, prose.ts, LEGAL_PROSE, table-of-contents.tsx] | lang=en
- "transcription_transcript_buffer": "transcript-buffer.ts" | kind=code-symbol | source=src/features/transcription/transcript-buffer.ts:L1 | neighbors=[5a95470 fix(meetings): transcripts stop…, use-live-transcription.ts, live-client.ts, appendFragment(), commitTurn(), EMPTY_TRANSCRIPT] | lang=en
- "ui_calendar": "calendar.tsx" | kind=code-symbol | source=src/components/ui/calendar.tsx:L1 | neighbors=[jump-to-date.tsx, meetings-day-rail.tsx, utils.ts, cn(), button.tsx, Button()] | lang=en
- "worklog_absence_days": "absence-days.ts" | kind=code-symbol | source=src/features/worklog/absence-days.ts:L1 | neighbors=[d0da911 test(gemini): a public page may…, context-pack.ts, iso-day.ts, isoDayAdd(), absenceDays(), absence-days.test.ts] | lang=en
- "worklog_catch_up_offline_test": "catch-up-offline.test.ts" | kind=code-symbol | source=src/features/worklog/catch-up-offline.test.ts:L1 | neighbors=[3ac9d68 ., app-aliases.ts, AliasedApp, catch-up-offline.ts, readCatchUpTextOffline(), APPS] | lang=en
- "worklog_day_summary": "day-summary.ts" | kind=code-symbol | source=src/features/worklog/day-summary.ts:L1 | neighbors=[3c0bc01 ., day-panel.tsx, prompt-truncate.ts, truncateAtWordBoundary(), DayGlance, firstMeaningfulLine()] | lang=en
- "worklog_entries_test": "entries.test.ts" | kind=code-symbol | source=src/features/worklog/entries.test.ts:L1 | neighbors=[3c30bf4 worklog: per-task hours substra…, 53ae2f3 feat(worklog): attribute hours …, entries.ts, accountedFraction(), ENTRY_CATEGORIES, EntryInput] | lang=en
- "worklog_entry_check_prompt_test": "entry-check-prompt.test.ts" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.test.ts:L1 | neighbors=[6909ea3 feat(worklog): AI drafts the da…, entry-check.ts, Observation, entry-check-prompt.ts, applyPhrasing(), buildEntryCheckPrompt()] | lang=en
- "worklog_holiday_listing_test": "holiday-listing.test.ts" | kind=code-symbol | source=src/features/worklog/holiday-listing.test.ts:L1 | neighbors=[lk-holidays.ts, LK_HOLIDAYS, holiday-listing.ts, buildHolidayCalendar(), closesTheStudio(), splitByDay()] | lang=en
- "activity_format_test": "format.test.ts" | kind=code-symbol | source=src/features/activity/format.test.ts:L1 | neighbors=[format.ts, activityDaySummary(), activityPhrase(), activityPhraseParts(), groupActivityBursts(), groupActivityByDay()] | lang=en
- "activity_search_test": "search.test.ts" | kind=code-symbol | source=src/features/activity/search.test.ts:L1 | neighbors=[search.ts, activityRowSearchText(), fuzzyActivityFallback(), rankActivityMatches(), Row, text()] | lang=en
- "admin_audit_filters_auditquerystring": "auditQueryString()" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L169 | neighbors=[audit-filters.ts, auditHref(), defaultAuditDir(), clearAuditFiltersHref(), audit-filters.test.ts, audit-nl-actions.ts] | lang=en
- "apps_app_aliases_test": "app-aliases.test.ts" | kind=code-symbol | source=src/features/apps/app-aliases.test.ts:L1 | neighbors=[app-aliases.ts, AliasedApp, appPromptLine(), appVocabulary(), deriveAcronyms(), matchApp()] | lang=en
- "apps_app_health_apptaskcounts": "AppTaskCounts" | kind=code-symbol | source=src/features/apps/app-health.ts:L35 | neighbors=[app-health.ts, app-health.test.ts, browse.ts, browse.test.ts, queries.ts, app-header.tsx] | lang=en
- "apps_app_health_sprintdayprogress": "sprintDayProgress()" | kind=code-symbol | source=src/features/apps/app-health.ts:L111 | neighbors=[app-health.ts, AppHealth, dayDiff(), inclusiveDayCount(), app-health.test.ts, app-card.tsx] | lang=en
- "apps_comment_queries": "comment-queries.ts" | kind=code-symbol | source=src/features/apps/comment-queries.ts:L1 | neighbors=[AppComment, listAppComments(), index.ts, Db, schema.ts, appComments] | lang=en
- "apps_queries_listapps": "listApps" | kind=code-symbol | source=src/features/apps/queries.ts:L110 | neighbors=[page.tsx, queries.ts, dashboard-zones.tsx, context-pack.ts, page.tsx, page.tsx] | lang=en
- "auth_deactivated_test": "deactivated.test.ts" | kind=code-symbol | source=src/features/auth/deactivated.test.ts:L1 | neighbors=[actor.ts, capabilities.ts, Action, UserRole, chain(), getSessionMock] | lang=en
- "bugs_queue_page_test": "queue-page.test.ts" | kind=code-symbol | source=src/features/bugs/queue-page.test.ts:L1 | neighbors=[queue-page.ts, CURSOR, render(), triageQueueConditions(), live.ts, liveBugReports] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@0ef5105d2f2f828262d9763367524d922eef758c": "0ef5105 fix(intel): a briefing priority may only link inside the product, and a…" | kind=Commit | source=git | neighbors=[main, 92857d0 docs: cost spec — finance.view …, ask-panel.tsx, briefing-card.tsx, actions.ts, context-pack.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@364f1af1958232926ba51965b3c9e2535efbb0a7": "364f1af fix(search): ⌘K was handing every seat rows it had no grant on" | kind=Commit | source=git | neighbors=[search-providers.ts, main, search-providers.ts, 11575db fix(worklog): project chips can…, search-providers.ts, registry.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@473168be637503d82990408f4b61a011307827a1": "473168b docs: restore the reasoning the sweep deleted, and record one rule it b…" | kind=Commit | source=git | neighbors=[main, 55c832b fix(worklog): stop the catch-up…, command-center.tsx, worklog-form.tsx, page.tsx, help-note.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@53ae2f395f4cd99792f65eeefd3e165e1fbd2478": "53ae2f3 feat(worklog): attribute hours to a project, not only to a task" | kind=Commit | source=git | neighbors=[04583d8 feat(sprints): the words a task…, main, 2b1ac4a feat(calendar): the organiser i…, schema.ts, 0050_worklog_entry_app.sql, entries.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@743b1f2eef1a2b9a77ccb1951f41f6a8523f2e0f": "743b1f2 fix(ui): a false-positive tag match, a dead branch, and two restored do…" | kind=Commit | source=git | neighbors=[0ef5142 fix(ui): correctness, responsiv…, main, 137eacc docs(intel): write down which a…, cohort-views.tsx, worklog-form.tsx, cohorts.ts] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@afba1c32eb1b9a43e9d100f3807fb5bd2557b32f": "afba1c3 feat(worklog): the hours form can name a task, which is what it always …" | kind=Commit | source=git | neighbors=[main, 7479d4a docs(specs): measure the work, …, day-hours-card.tsx, day-panel.tsx, entry-form.ts, entry-form.test.ts] | lang=en

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-020.json

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
