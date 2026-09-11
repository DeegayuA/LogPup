# Node Description Batch 41 of 166

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
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "signals_commands": "commands.ts" | kind=code-symbol | source=src/features/signals/commands.ts:L1 | neighbors=[d5b6409 ., commands.ts, types.ts, CommandDescriptor, commands]
- "signals_queries_getpersonsignals": "getPersonSignals()" | kind=code-symbol | source=src/features/signals/queries.ts:L91 | neighbors=[page.tsx, queries.ts, getMemberScorecard(), daysInRange(), mayRead()]
- "sprints_actions_unexpected": "unexpected()" | kind=code-symbol | source=src/features/sprints/actions.ts:L71 | neighbors=[actions.ts, createSprint(), deleteSprint(), updateSprint(), updateSprintStatus()]
- "sprints_actions_updatesprint": "updateSprint()" | kind=code-symbol | source=src/features/sprints/actions.ts:L159 | neighbors=[roadmap-timeline.tsx, sprint-edit-dialog.tsx, actions.ts, slugForApp(), unexpected()]
- "sprints_actions_updatesprintstatus": "updateSprintStatus()" | kind=code-symbol | source=src/features/sprints/actions.ts:L326 | neighbors=[sprint-edit-dialog.tsx, sprint-status-select.tsx, actions.ts, slugForApp(), unexpected()]
- "sprints_assignment_notice_test": "assignment-notice.test.ts" | kind=code-symbol | source=src/features/sprints/assignment-notice.test.ts:L1 | neighbors=[04583d8 feat(sprints): the words a task…, assignment-notice.ts, buildAssignmentNotice(), shouldNotifyAssignee(), base]
- "sprints_board_view_priority_label": "PRIORITY_LABEL" | kind=code-symbol | source=src/features/sprints/board-view.ts:L83 | neighbors=[board-bulk-bar.tsx, board-toolbar.tsx, task-card.tsx, task-composer.tsx, board-view.ts]
- "sprints_board_view_status_label": "STATUS_LABEL" | kind=code-symbol | source=src/features/sprints/board-view.ts:L77 | neighbors=[board-bulk-bar.tsx, day-hours-card.tsx, task-card.tsx, task-dialog.tsx, board-view.ts]
- "sprints_board_view_task_statuses": "TASK_STATUSES" | kind=code-symbol | source=src/features/sprints/board-view.ts:L30 | neighbors=[board-bulk-bar.tsx, task-card.tsx, task-dialog.tsx, board-view.ts, board-view.test.ts]
- "sprints_checkin_actions_upsertsprintcheckin": "upsertSprintCheckin()" | kind=code-symbol | source=src/features/sprints/checkin-actions.ts:L58 | neighbors=[meeting-prep.tsx, sprint-checkin-editor.tsx, checkin-actions.ts, nameOf(), unexpected()]
- "sprints_checkins_test": "checkins.test.ts" | kind=code-symbol | source=src/features/sprints/checkins.test.ts:L1 | neighbors=[checkins.ts, CheckinGap, computeTaskProgress(), TaskForProgress, task()]
- "sprints_goal_lines": "goal-lines.ts" | kind=code-symbol | source=src/features/sprints/goal-lines.ts:L1 | neighbors=[a4b271b Improve leave types and worklog…, page.tsx, parseSprintGoal(), SprintGoal, goal-lines.test.ts]
- "sprints_plan_read_sprintread": "SprintRead" | kind=code-symbol | source=src/features/sprints/plan-read.ts:L54 | neighbors=[plan-read-strip.tsx, roadmap-spine.tsx, roadmap-timeline.tsx, plan-read.ts, plan-read.test.ts]
- "sprints_roadmap_geometry_test": "roadmap-geometry.test.ts" | kind=code-symbol | source=src/features/sprints/roadmap-geometry.test.ts:L1 | neighbors=[roadmap-geometry.ts, daysFromOffset(), resizeEnd(), resizeStart(), shiftRange()]
- "sprints_sprint_date_range_issprintrunningnow": "isSprintRunningNow()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L163 | neighbors=[app-health.ts, planner-actions.ts, sprint-date-range.ts, initialSprintStatus(), sprint-date-range.test.ts]
- "sprints_sprint_date_range_sprintdurationlabel": "sprintDurationLabel()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L76 | neighbors=[sprint-edit-dialog.tsx, sprint-form-dialog.tsx, sprint-date-range.ts, inclusiveDayCount(), sprint-date-range.test.ts]
- "sprints_task_actions_isforeignkeyviolation": "isForeignKeyViolation()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L170 | neighbors=[task-actions.ts, bulkUpdateTasks(), createTask(), moveTaskOnBoard(), updateTask()]
- "sprints_task_actions_requiresession": "requireSession()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L138 | neighbors=[task-actions.ts, bulkUpdateTasks(), createTask(), moveTaskOnBoard(), updateTask()]
- "sprints_task_assignees_normalizeassigneeids": "normalizeAssigneeIds()" | kind=code-symbol | source=src/features/sprints/task-assignees.ts:L57 | neighbors=[task-assignees.ts, diffAssignees(), getTaskAssignees(), primaryAssigneeId(), withPrimaryAssignee()]
- "transcription_flag_islivetranscriptionenabled": "isLiveTranscriptionEnabled()" | kind=code-symbol | source=src/features/transcription/flag.ts:L31 | neighbors=[meeting-intel.tsx, page.tsx, actions.ts, flag.ts, parseLiveTranscriptionFlag()]
- "transcription_live_client_livetranscriptionsession_schedulereconnect": ".scheduleReconnect()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L294 | neighbors=[LiveTranscriptionSession, .handleConnectionFailure(), .handleEvent(), .fail(), .setStatus()]
- "transcription_live_client_livetranscriptionsession_setstatus": ".setStatus()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L475 | neighbors=[LiveTranscriptionSession, .connect(), .handleEvent(), .scheduleReconnect(), .stop()]
- "transcription_live_client_test_fakesocket": "FakeSocket" | kind=code-symbol | source=src/features/transcription/live-client.test.ts:L14 | neighbors=[live-client.test.ts, .close(), .constructor(), .deliver(), .send()]
- "ui_ambient_backdrop": "ambient-backdrop.tsx" | kind=code-symbol | source=src/components/ui/ambient-backdrop.tsx:L1 | neighbors=[utils.ts, cn(), AmbientBackdrop(), AmbientVariant, ORBS]
- "ui_avatar_avatargroupcount": "AvatarGroupCount()" | kind=code-symbol | source=src/components/ui/avatar.tsx:L93 | neighbors=[app-card.tsx, meeting-intel-sheet.tsx, meeting-list.tsx, progress-apps-lane.tsx, avatar.tsx]
- "ui_datetime_wheel_datetimewheelfield": "DateTimeWheelField()" | kind=code-symbol | source=src/components/ui/datetime-wheel.tsx:L233 | neighbors=[action-item-board.tsx, meeting-detail-dialog.tsx, meeting-form.tsx, next-meeting-card.tsx, datetime-wheel.tsx]
- "ui_input_group_inputgroup": "InputGroup()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L11 | neighbors=[directory.tsx, history-filters.tsx, progress-filters.tsx, command.tsx, input-group.tsx]
- "ui_sonner": "sonner.tsx" | kind=code-symbol | source=src/components/ui/sonner.tsx:L1 | neighbors=[layout.tsx, 10e7430 fix(ui): a clipped seat descrip…, theme-provider.tsx, useTheme(), Toaster()]
- "ui_switch_switch": "Switch()" | kind=code-symbol | source=src/components/ui/switch.tsx:L7 | neighbors=[ai-feature-toggle.tsx, maintenance-controls.tsx, meeting-intel.tsx, user-table.tsx, switch.tsx]
- "ui_table_table": "Table()" | kind=code-symbol | source=src/components/ui/table.tsx:L7 | neighbors=[apps-table.tsx, history-views.tsx, org-holidays-card.tsx, user-table.tsx, table.tsx]
- "ui_table_tablebody": "TableBody()" | kind=code-symbol | source=src/components/ui/table.tsx:L32 | neighbors=[apps-table.tsx, history-views.tsx, org-holidays-card.tsx, user-table.tsx, table.tsx]
- "ui_table_tablecell": "TableCell()" | kind=code-symbol | source=src/components/ui/table.tsx:L81 | neighbors=[apps-table.tsx, history-views.tsx, org-holidays-card.tsx, user-table.tsx, table.tsx]
- "ui_table_tablehead": "TableHead()" | kind=code-symbol | source=src/components/ui/table.tsx:L68 | neighbors=[apps-table.tsx, history-views.tsx, org-holidays-card.tsx, user-table.tsx, table.tsx]
- "ui_table_tableheader": "TableHeader()" | kind=code-symbol | source=src/components/ui/table.tsx:L22 | neighbors=[apps-table.tsx, history-views.tsx, org-holidays-card.tsx, user-table.tsx, table.tsx]
- "ui_table_tablerow": "TableRow()" | kind=code-symbol | source=src/components/ui/table.tsx:L55 | neighbors=[apps-table.tsx, history-views.tsx, org-holidays-card.tsx, user-table.tsx, table.tsx]
- "worklog_absence_kinds_absencekind": "AbsenceKind" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L182 | neighbors=[declare-absence-dialog.tsx, absence-actions.ts, absence-kinds.ts, catch-up-offline.ts, catch-up-parse.ts]
- "worklog_absence_queries_approvedabsencedays": "approvedAbsenceDays()" | kind=code-symbol | source=src/features/worklog/absence-queries.ts:L67 | neighbors=[queries.ts, absence-queries.ts, select, coverage-queries.ts, entry-evidence.ts]
- "worklog_absence_queries_select": "select" | kind=code-symbol | source=src/features/worklog/absence-queries.ts:L17 | neighbors=[absence-queries.ts, approvedAbsenceDays(), approvedAbsenceUserIds(), listPendingAbsences(), listRecentAbsences()]
- "worklog_actions_upsertdailyworklog": "upsertDailyWorklog()" | kind=code-symbol | source=src/features/worklog/actions.ts:L39 | neighbors=[day-one-line.tsx, day-panel.tsx, log-box.tsx, worklog-form.tsx, actions.ts]
- "worklog_commands": "commands.ts" | kind=code-symbol | source=src/features/worklog/commands.ts:L1 | neighbors=[029ff45 feat(search): worklog and activ…, commands.ts, types.ts, CommandDescriptor, commands]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-040.json

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
