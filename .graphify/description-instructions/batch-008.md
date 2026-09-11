# Node Description Batch 9 of 166

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
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "people_task_workload": "task-workload.ts" | kind=code-symbol | source=src/features/people/task-workload.ts:L1 | neighbors=[c2bc5fd refactor(tasks): route in-memor…, dashboard-zones.tsx, person-tasks-card.tsx, my-day-stats.ts, my-day-stats.test.ts, context-pack.ts]
- "shell_mobile_nav": "mobile-nav.tsx" | kind=code-symbol | source=src/components/shell/mobile-nav.tsx:L1 | neighbors=[0ef5142 fix(ui): correctness, responsiv…, header.tsx, alta-vision-logo.tsx, AltaVisionLogo(), nav.ts, settingsNavItem]
- "sign_in_page": "page.tsx" | kind=code-symbol | source=src/app/sign-in/page.tsx:L1 | neighbors=[alta-vision-logo.tsx, AltaVisionLogo(), google-one-tap.tsx, GoogleOneTap(), passkey-login-button.tsx, PasskeyLoginButton()]
- "sprints_checkin_actions": "checkin-actions.ts" | kind=code-symbol | source=src/features/sprints/checkin-actions.ts:L1 | neighbors=[meeting-prep.tsx, sprint-checkin-editor.tsx, log.ts, logActivity(), capabilities.ts, isAdminRole()]
- "sprints_paste_actions": "paste-actions.ts" | kind=code-symbol | source=src/features/sprints/paste-actions.ts:L1 | neighbors=[task-composer.tsx, client.ts, callGemini(), model-choice.ts, resolveChain(), prefs.ts]
- "worklog_coverage": "coverage.ts" | kind=code-symbol | source=src/features/worklog/coverage.ts:L1 | neighbors=[coverage-figure.tsx, progress-matrix.tsx, auto-score-sync.ts, catch-up-actions.ts, computeCoverage(), CoverageDay]
- "activity_actions": "actions.ts" | kind=code-symbol | source=src/features/activity/actions.ts:L1 | neighbors=[colomboDayEnd(), colomboDayStart(), loadOlderActivity(), loadOlderInput, LoadOlderResult, filters.ts]
- "activity_types": "types.ts" | kind=code-symbol | source=src/features/activity/types.ts:L1 | neighbors=[actions.ts, filters.ts, format.ts, format.test.ts, log.ts, page.tsx]
- "admin_trash_actions_test": "trash-actions.test.ts" | kind=code-symbol | source=src/features/admin/trash-actions.test.ts:L1 | neighbors=[trash-actions.ts, asAdmin(), asMember(), { authMock, writeSpy, insertSpy, delete…, resetTableState(), stateFor()]
- "auth_actor_requirecapability": "requireCapability()" | kind=code-symbol | source=src/features/auth/actor.ts:L103 | neighbors=[actions.ts, app-grant-actions.ts, audit-nl-actions.ts, bulk-actions.ts, danger-actions.ts, trash-actions.ts]
- "bugs_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/admin/bugs/page.tsx:L1 | neighbors=[actor.ts, loadActor, capabilities.ts, Actor, can(), bug-display.ts]
- "commit:repo:github.com/DeegayuA/LogPup@5deded74f19465a2a0b62e002f6852e84080d553": "5deded7 feat(meeting-load): the metrics and the engine behind R1-R5" | kind=Commit | source=git | neighbors=[main, d933927 feat(meeting-load): reads that …, churn.ts, churn.test.ts, collisions.ts, collisions.test.ts]
- "components_activity_filter_bar": "activity-filter-bar.tsx" | kind=code-symbol | source=src/features/activity/components/activity-filter-bar.tsx:L1 | neighbors=[page.tsx, filters.ts, activityParams(), types.ts, ACTIVITY_ENTITY_TYPES, ActivityFilterBar()]
- "components_add_to_calendar": "add-to-calendar.tsx" | kind=code-symbol | source=src/features/meetings/components/add-to-calendar.tsx:L1 | neighbors=[AddToCalendarMenu(), icsHref(), actions.ts, retryCalendarInvite(), ics.ts, googleCalendarUrl()]
- "components_ask_bubble": "ask-bubble.tsx" | kind=code-symbol | source=src/features/intel/components/ask-bubble.tsx:L1 | neighbors=[layout.tsx, 8a3fe20 feat(intel): Ask LogPup on ever…, bee388b feat(intel): fold the page into…, AskBubble(), ask-panel.tsx, AskPanel()]
- "components_audit_filter_bar": "audit-filter-bar.tsx" | kind=code-symbol | source=src/features/admin/components/audit-filter-bar.tsx:L1 | neighbors=[page.tsx, 0ef5142 fix(ui): correctness, responsiv…, audit-filters.ts, AuditParamState, auditQueryString(), clearedAuditState()]
- "components_meeting_assistant": "meeting-assistant.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-assistant.tsx:L1 | neighbors=[d5b6409 ., ai-meter-provider.tsx, meterOrigin(), useAiMeter(), dictate-button.tsx, DictateButton()]
- "components_meetings_day_rail": "meetings-day-rail.tsx" | kind=code-symbol | source=src/features/meetings/components/meetings-day-rail.tsx:L1 | neighbors=[meetings-calendar.tsx, meeting-glance.ts, durationLabel(), MeetingTiming, tallyRsvps(), MeetingsDayRail()]
- "components_person_header": "person-header.tsx" | kind=code-symbol | source=src/features/people/components/person-header.tsx:L1 | neighbors=[capabilities.ts, isAdminRole(), PersonHeader(), phone.ts, telHref(), waHref()]
- "db_schema_tasks": "tasks" | kind=code-symbol | source=src/db/schema.ts:L448 | neighbors=[actions.ts, backup.ts, change-request-appliers.ts, clear-test-data.test.ts, danger-actions.ts, danger-actions.test.ts]
- "meetings_ai_actions_test": "ai-actions.test.ts" | kind=code-symbol | source=src/features/meetings/ai-actions.test.ts:L1 | neighbors=[live.ts, liveMeetings, liveNoteSegments, liveScreenshots, liveTasks, schema.ts]
- "sprints_plan_read": "plan-read.ts" | kind=code-symbol | source=src/features/sprints/plan-read.ts:L1 | neighbors=[c2bc5fd refactor(tasks): route in-memor…, plan-read-strip.tsx, roadmap.tsx, roadmap-spine.tsx, roadmap-timeline.tsx, page.tsx]
- "ui_search_select": "search-select.tsx" | kind=code-symbol | source=src/components/ui/search-select.tsx:L1 | neighbors=[de4cd09 feat(ui): a select you can type…, assign-dialog.tsx, capacity-heat-editable.tsx, danger-app-reset-card.tsx, danger-meeting-delete-card.tsx, day-hours-card.tsx]
- "admin_audit_queries_test": "audit-queries.test.ts" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L1 | neighbors=[audit-filters.ts, AuditParamState, audit-queries.ts, ADMIN, AUDITOR, BASE]
- "bugs_bug_csv_test": "bug-csv.test.ts" | kind=code-symbol | source=src/features/bugs/bug-csv.test.ts:L1 | neighbors=[bulk-logic.ts, normalizeHeader(), splitCsvRows(), bug-csv.ts, BUG_CSV_COLUMNS, BUG_CSV_EXAMPLE_ROW]
- "components_capacity_heat": "capacity-heat.tsx" | kind=code-symbol | source=src/features/dashboard/components/capacity-heat.tsx:L1 | neighbors=[capacity-bar.tsx, CapacityBar(), capacity-card.tsx, CapacityCard(), CapacityEmpty(), PersonAvatar()]
- "components_pending_absence_list": "pending-absence-list.tsx" | kind=code-symbol | source=src/features/worklog/components/pending-absence-list.tsx:L1 | neighbors=[007c37f ., 419d875 Unify worklog logging with AI c…, declare-absence-dialog.tsx, formatAbsenceRange(), meeting-chips.tsx, PendingAbsenceList()]
- "components_person_activity_card": "person-activity-card.tsx" | kind=code-symbol | source=src/features/people/components/person-activity-card.tsx:L1 | neighbors=[activity-graph.tsx, ActivityGraph(), CELL_CLASSES, formatDay(), PersonActivityCard(), SWATCH]
- "components_report_bug_dialog": "report-bug-dialog.tsx" | kind=code-symbol | source=src/features/bugs/components/report-bug-dialog.tsx:L1 | neighbors=[actions.ts, reportBug(), dictate-button.tsx, DictateButton(), ReportBugDialog(), button.tsx]
- "components_triage_rail": "triage-rail.tsx" | kind=code-symbol | source=src/features/meetings/components/triage-rail.tsx:L1 | neighbors=[671c254 ., meeting-chips.tsx, SkeletonBlock(), meeting-glance.ts, isAwaitingViewerRsvp(), GLANCE_TILES]
- "gemini_prefs_getaiprefs": "getAiPrefs()" | kind=code-symbol | source=src/features/gemini/prefs.ts:L33 | neighbors=[audit-nl-actions.ts, actions.ts, page.tsx, ai-features-card.tsx, dashboard-zones.tsx, meter-actions.ts]
- "maintenance_freeze": "freeze.ts" | kind=code-symbol | source=src/features/maintenance/freeze.ts:L1 | neighbors=[actor.ts, 8bacbca ., maintenance-mount.tsx, actions.ts, index.ts, Db]
- "meetings_recurrence": "recurrence.ts" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L1 | neighbors=[4d94451 feat(meetings): a recurrence ru…, calendar-grid.ts, zoneOffsetMs(), dayNumber(), daysInMonth(), expand()]
- "people_card_actions": "card-actions.ts" | kind=code-symbol | source=src/features/people/card-actions.ts:L1 | neighbors=[8bacbca ., person-hover-card.tsx, index.ts, Db, live.ts, liveApps]
- "signals_corroborate": "corroborate.ts" | kind=code-symbol | source=src/features/signals/corroborate.ts:L1 | neighbors=[d5b6409 ., working-days.ts, WorkingDayFraction, CHECKED_CHANNELS, corroborateDay(), corroborateRange()]
- "sprints_task_assignees": "task-assignees.ts" | kind=code-symbol | source=src/features/sprints/task-assignees.ts:L1 | neighbors=[53262eb feat(tasks): several people can…, ai-actions.ts, task-actions.ts, index.ts, Db, live.ts]
- "worklog_absence_queries": "absence-queries.ts" | kind=code-symbol | source=src/features/worklog/absence-queries.ts:L1 | neighbors=[page.tsx, approval-queries.ts, page.tsx, 272f9a7 feat(meetings): store the decis…, load-actions.ts, queries.ts]
- "worklog_holiday_listing": "holiday-listing.ts" | kind=code-symbol | source=src/features/worklog/holiday-listing.ts:L1 | neighbors=[org-holidays-card.tsx, auto-score-sync.ts, catch-up-actions.ts, lk-holidays.ts, excusesWork(), HolidayCategory]
- "absences_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/admin/absences/page.tsx:L1 | neighbors=[AdminAbsencesPage(), actor.ts, loadActor, capabilities.ts, can(), approval-actions.tsx]
- "admin_queries": "queries.ts" | kind=code-symbol | source=src/features/admin/queries.ts:L1 | neighbors=[approval-queries.ts, page.tsx, AdminUser, listAllUsers(), listPendingUsers, PendingUser]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-008.json

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
