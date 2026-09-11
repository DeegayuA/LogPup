# Node Description Batch 37 of 166

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

- "commit:repo:github.com/DeegayuA/LogPup@d33e084f94632b6f560509015e5c3be4690ea29c": "d33e084 feat(finance): give the cost module a surface, after shipping without o…" | kind=Commit | source=git | neighbors=[09468aa feat(worklog): the team view ca…, main, 58b4984 fix(worklog): the team grid sto…, project-finance-card.tsx, page.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@dd6f2fd5df170d022cdb6ef27a1c9c5dea93acdc": "dd6f2fd feat(worklog): define how long a full day is, in one place" | kind=Commit | source=git | neighbors=[3c30bf4 worklog: per-task hours substra…, main, a1e227e feat(search): a zero-hit search…, schedules.ts, schedules.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@e38a38596be7fc1305bed0378d107ebc75379576": "e38a385 feat(worklog): what a logged day went to, as segments a cell can carry" | kind=Commit | source=git | neighbors=[232b7ef ., main, c2f2819 feat(meetings): work out which …, day-app-mix.ts, day-app-mix.test.ts] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@e4322416fa42dc28f0b70979e2def965110baf19": "e432241 feat(deadlines): the escalation ladder, in working days" | kind=Commit | source=git | neighbors=[59aa7b9 feat(search): people's cohort v…, main, 04583d8 feat(sprints): the words a task…, escalation.ts, escalation.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@ea1622ebcd9d74e461fe4c182884398800789a7b": "ea1622e fix(intel): Ask LogPup reads as a chat, and stops rejecting short quest…" | kind=Commit | source=git | neighbors=[ae2feea feat(people): filtering and ord…, main, d78a3e1 fix(intel): the briefing links …, ask-panel.tsx, actions.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@eb38ea0fa0907537452c6aa3b2b3855fe06e9d94": "eb38ea0 fix(tasks): stamp completed_at on the done literal, not isTerminal" | kind=Commit | source=git | neighbors=[001694a refactor(tasks): express the co…, main, c2bc5fd refactor(tasks): route in-memor…, task-status.ts, task-status.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@f180d72d1c29cd49a9dc1fde14c0a7fc9260988b": "f180d72 feat(people): capacity in hours, derived from each person's own week" | kind=Commit | source=git | neighbors=[d0da911 test(gemini): a public page may…, main, 8d1c180 fix(worklog): lift absenceDays …, capacity-hours.ts, capacity-hours.test.ts] | lang=en
- "components_board_skeleton": "board-skeleton.tsx" | kind=code-symbol | source=src/features/sprints/components/board-skeleton.tsx:L1 | neighbors=[Bar(), BoardSkeleton(), COLUMN_CARD_COUNTS, skeleton.tsx, Skeleton()] | lang=en
- "components_danger_confirm_control_dangerconfirmcontrol": "DangerConfirmControl()" | kind=code-symbol | source=src/features/admin/components/danger-confirm-control.tsx:L23 | neighbors=[danger-app-reset-card.tsx, danger-confirm-control.tsx, danger-meeting-delete-card.tsx, danger-recordings-card.tsx, danger-trash-empty-card.tsx] | lang=en
- "components_google_one_tap": "google-one-tap.tsx" | kind=code-symbol | source=src/features/auth/components/google-one-tap.tsx:L1 | neighbors=[CredentialResponse, GoogleIdApi, GoogleOneTap(), Window, page.tsx] | lang=en
- "components_health_dot_healthdot": "HealthDot()" | kind=code-symbol | source=src/features/apps/components/health-dot.tsx:L36 | neighbors=[app-card.tsx, app-header.tsx, cohort-views.tsx, dashboard-zones.tsx, health-dot.tsx] | lang=en
- "components_maintenance_chrome_kind_icons": "KIND_ICONS" | kind=code-symbol | source=src/features/maintenance/components/maintenance-chrome.ts:L12 | neighbors=[maintenance-banner.tsx, maintenance-chrome.ts, maintenance-controls.tsx, maintenance-details-dialog.tsx, maintenance-overlay.tsx] | lang=en
- "components_markdown_lite_markdownlite": "MarkdownLite()" | kind=code-symbol | source=src/components/markdown-lite.tsx:L26 | neighbors=[markdown-lite.tsx, meeting-notes.tsx, meeting-notes-dialog.tsx, note-timeline.tsx, page.tsx] | lang=en
- "components_meeting_glance_norsvpyet": "noRsvpYet()" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L42 | neighbors=[meeting-detail-dialog.tsx, meeting-glance.ts, meeting-glance.test.ts, meeting-intel-sheet.tsx, meeting-list.tsx] | lang=en
- "components_meeting_load_trend": "meeting-load-trend.tsx" | kind=code-symbol | source=src/features/meeting-load/components/meeting-load-trend.tsx:L1 | neighbors=[5c7efa5 feat(meeting-load): four surfac…, meeting-load-card.tsx, MeetingLoadTrend(), trend-points.ts, LoadTrendData] | lang=en
- "components_meeting_notes_model_actionrow": "ActionRow" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L89 | neighbors=[meeting-notes.tsx, meeting-notes-dialog.tsx, meeting-notes-model.ts, page.tsx, ai-actions.ts] | lang=en
- "components_meeting_people_picker_meetingpeoplepicker": "MeetingPeoplePicker()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker.tsx:L195 | neighbors=[action-item-board.tsx, attribution-inline.tsx, meeting-intel.tsx, meeting-people-picker.tsx, note-timeline.tsx] | lang=en
- "components_meeting_people_picker_model_frompickervalue": "fromPickerValue()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L215 | neighbors=[action-item-board.tsx, meeting-people-picker-model.ts, resolveChipLabels(), resolveTriggerLabel(), meeting-people-picker-model.test.ts] | lang=en
- "components_meeting_people_picker_model_resolvechiplabels": "resolveChipLabels()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L264 | neighbors=[meeting-people-picker.tsx, meeting-people-picker-model.ts, fromPickerValue(), resolveTriggerLabel(), meeting-people-picker-model.test.ts] | lang=en
- "components_meeting_people_picker_model_resolvetriggerlabel": "resolveTriggerLabel()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L242 | neighbors=[meeting-people-picker.tsx, meeting-people-picker-model.ts, resolveChipLabels(), fromPickerValue(), meeting-people-picker-model.test.ts] | lang=en
- "components_per_app_load": "per-app-load.tsx" | kind=code-symbol | source=src/features/meeting-load/components/per-app-load.tsx:L1 | neighbors=[5c7efa5 feat(meeting-load): four surfac…, PerAppLoad(), queries.ts, PerAppLoadRow, page.tsx] | lang=en
- "components_roadmap_timeline_parseiso": "parseIso()" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L173 | neighbors=[roadmap-timeline.tsx, buildTicks(), formatRange(), ResizeHandle(), SprintBar()] | lang=en
- "components_series_load_table": "series-load-table.tsx" | kind=code-symbol | source=src/features/meeting-load/components/series-load-table.tsx:L1 | neighbors=[5c7efa5 feat(meeting-load): four surfac…, SeriesLoadTable(), queries.ts, SeriesTableRow, page.tsx] | lang=en
- "components_task_card_taskcard": "TaskCard()" | kind=code-symbol | source=src/features/sprints/components/task-card.tsx:L169 | neighbors=[board-column.tsx, task-card.tsx, cardLabel(), formatDueDate(), priorityMenuLabel()] | lang=en
- "components_trash_card_logic_matchespurgeconfirm": "matchesPurgeConfirm()" | kind=code-symbol | source=src/features/admin/components/trash-card-logic.ts:L89 | neighbors=[trash-actions.test.ts, trash-card.tsx, trash-card-logic.ts, trash-card-logic.test.ts, trash-row-actions.tsx] | lang=en
- "components_use_glance_map_test": "use-glance-map.test.ts" | kind=code-symbol | source=src/features/meetings/components/use-glance-map.test.ts:L1 | neighbors=[671c254 ., use-glance-map.tsx, nextListBoundary(), meeting(), now] | lang=en
- "components_weekly_load_table": "weekly-load-table.tsx" | kind=code-symbol | source=src/features/meeting-load/components/weekly-load-table.tsx:L1 | neighbors=[5c7efa5 feat(meeting-load): four surfac…, WeeklyLoadTable(), queries.ts, WeeklyLoadRow, page.tsx] | lang=en
- "components_worklog_calendar_worklogcalendar": "WorklogCalendar()" | kind=code-symbol | source=src/features/worklog/components/worklog-calendar.tsx:L100 | neighbors=[worklog-calendar.tsx, mondayColumn(), monthShape(), shiftMonth(), page.tsx] | lang=en
- "contribution_graph_index_usecontributiongraph": "useContributionGraph()" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L94 | neighbors=[index.tsx, ContributionGraphBlock(), ContributionGraphCalendar(), ContributionGraphLegend(), ContributionGraphTotalCount()] | lang=en
- "dashboard_sort_capacities": "sort-capacities.ts" | kind=code-symbol | source=src/features/dashboard/sort-capacities.ts:L1 | neighbors=[capacity-heat.tsx, capacity-heat-editable.tsx, sortCapacities(), sort-capacities.test.ts, context-pack.ts] | lang=en
- "dashboard_sort_capacities_sortcapacities": "sortCapacities()" | kind=code-symbol | source=src/features/dashboard/sort-capacities.ts:L7 | neighbors=[capacity-heat.tsx, capacity-heat-editable.tsx, sort-capacities.ts, sort-capacities.test.ts, context-pack.ts] | lang=en
- "dashboard_sprint_progress": "sprint-progress.ts" | kind=code-symbol | source=src/features/dashboard/sprint-progress.ts:L1 | neighbors=[active-sprints.tsx, daysRemaining(), sprintProgress(), sprint-progress.test.ts, progress-queries.ts] | lang=en
- "dashboard_zones_composedashboard": "composeDashboard()" | kind=code-symbol | source=src/features/dashboard/zones.ts:L211 | neighbors=[page.tsx, zones.ts, grantForZone(), isKnownRole(), zones.test.ts] | lang=en
- "db_schema_aiusageevents": "aiUsageEvents" | kind=code-symbol | source=src/db/schema.ts:L977 | neighbors=[schema.ts, budget-queries.ts, meter-actions.ts, queries.ts, usage.ts] | lang=en
- "db_schema_appcomments": "appComments" | kind=code-symbol | source=src/db/schema.ts:L1247 | neighbors=[activity-queries.ts, comment-actions.ts, comment-queries.ts, queries.ts, schema.ts] | lang=en
- "db_schema_appgrants": "appGrants" | kind=code-symbol | source=src/db/schema.ts:L1901 | neighbors=[app-grant-actions.ts, actor.ts, schema.ts, notify.ts, handover-queries.ts] | lang=en
- "db_schema_meetingloaddecisions": "meetingLoadDecisions" | kind=code-symbol | source=src/db/schema.ts:L862 | neighbors=[schema.ts, meeting-load.spec.ts, actions.ts, admin-queries.ts, load-actions.ts] | lang=en
- "db_schema_meetingrecordingsegments": "meetingRecordingSegments" | kind=code-symbol | source=src/db/schema.ts:L1384 | neighbors=[live.ts, schema.ts, ai-actions.ts, recording-actions.ts, recording-queries.ts] | lang=en
- "db_schema_orgholidays": "orgHolidays" | kind=code-symbol | source=src/db/schema.ts:L1869 | neighbors=[schema.ts, coverage-queries.ts, org-holiday-actions.ts, org-holiday-queries.ts, queries.ts] | lang=en
- "db_write_gate_gatewrite": "gateWrite()" | kind=code-symbol | source=src/db/write-gate.ts:L117 | neighbors=[index.ts, write-gate.ts, isExemptTable(), wrap(), write-gate.test.ts] | lang=en

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-036.json

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
