# Node Description Batch 54 of 166

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

- "sprints_plan_read_plangaps": "PlanGaps" | kind=code-symbol | source=src/features/sprints/plan-read.ts:L190 | neighbors=[plan-read-strip.tsx, page.tsx, plan-read.ts, plan-read.test.ts]
- "sprints_queries_getactivesprints": "getActiveSprints" | kind=code-symbol | source=src/features/sprints/queries.ts:L89 | neighbors=[dashboard-zones.tsx, context-pack.ts, queries.ts, progress-queries.ts]
- "sprints_queries_getboard": "getBoard()" | kind=code-symbol | source=src/features/sprints/queries.ts:L223 | neighbors=[sprint-checkins.tsx, actions.ts, page.tsx, queries.ts]
- "sprints_queries_sprint": "Sprint" | kind=code-symbol | source=src/features/sprints/queries.ts:L13 | neighbors=[roadmap.tsx, roadmap-timeline.tsx, sprint-edit-dialog.tsx, queries.ts]
- "sprints_roadmap_layout_bargeometry": "BarGeometry" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L133 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, roadmap-layout.ts, roadmap-layout.test.ts]
- "sprints_roadmap_layout_offsetofdate": "offsetOfDate()" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L160 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, roadmap-layout.ts, roadmap-layout.test.ts]
- "sprints_roadmap_layout_packrows": "packRows()" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L60 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, roadmap-layout.ts, roadmap-layout.test.ts]
- "sprints_roadmap_layout_parsezoom": "parseZoom()" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L42 | neighbors=[roadmap-timeline.tsx, page.tsx, roadmap-layout.ts, roadmap-layout.test.ts]
- "sprints_roadmap_layout_px_per_day": "PX_PER_DAY" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L34 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, roadmap-layout.ts, roadmap-layout.test.ts]
- "sprints_roadmap_layout_rowcount": "rowCount()" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L98 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, roadmap-layout.ts, roadmap-layout.test.ts]
- "sprints_roadmap_layout_timelinewindow": "TimelineWindow" | kind=code-symbol | source=src/features/sprints/roadmap-layout.ts:L104 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, roadmap-layout.ts, roadmap-layout.test.ts]
- "sprints_sprint_date_range_defaultsprintrange": "defaultSprintRange()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L59 | neighbors=[sprint-form-dialog.tsx, sprint-date-range.ts, addCalendarDays(), sprint-date-range.test.ts]
- "sprints_sprint_date_range_initialsprintstatus": "initialSprintStatus()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L146 | neighbors=[actions.ts, sprint-date-range.ts, isSprintRunningNow(), sprint-date-range.test.ts]
- "sprints_sprint_date_range_movesprintrange": "moveSprintRange()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L91 | neighbors=[roadmap-timeline.tsx, sprint-date-range.ts, addCalendarDays(), sprint-date-range.test.ts]
- "sprints_sprint_date_range_resizesprintend": "resizeSprintEnd()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L122 | neighbors=[roadmap-timeline.tsx, sprint-date-range.ts, addCalendarDays(), sprint-date-range.test.ts]
- "sprints_sprint_date_range_resizesprintstart": "resizeSprintStart()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L111 | neighbors=[roadmap-timeline.tsx, sprint-date-range.ts, addCalendarDays(), sprint-date-range.test.ts]
- "sprints_task_actions_taskbyid": "taskById()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L183 | neighbors=[task-actions.ts, deleteTask(), moveTaskOnBoard(), updateTask()]
- "sprints_task_assignees_gettaskassignees": "getTaskAssignees()" | kind=code-symbol | source=src/features/sprints/task-assignees.ts:L269 | neighbors=[task-actions.ts, task-assignees.ts, normalizeAssigneeIds(), orderAssignees()]
- "sprints_task_assignees_primaryassigneeid": "primaryAssigneeId()" | kind=code-symbol | source=src/features/sprints/task-assignees.ts:L95 | neighbors=[ai-actions.ts, task-actions.ts, task-assignees.ts, normalizeAssigneeIds()]
- "sprints_task_assignees_settaskassignees": "setTaskAssignees()" | kind=code-symbol | source=src/features/sprints/task-assignees.ts:L193 | neighbors=[task-actions.ts, task-assignees.ts, diffAssignees(), orderAssignees()]
- "sprints_task_status_transitiontaskstatus": "transitionTaskStatus()" | kind=code-symbol | source=src/features/sprints/task-status.ts:L74 | neighbors=[change-request-appliers.ts, task-actions.ts, task-status.ts, task-status.test.ts]
- "src_proxy": "proxy.ts" | kind=code-symbol | source=src/proxy.ts:L1 | neighbors=[access-gate.ts, canAccessApp(), auth.ts, config]
- "transcription_live_client_livetranscriptionsession_handleconnectionfailure": ".handleConnectionFailure()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L328 | neighbors=[LiveTranscriptionSession, .connect(), .fail(), .scheduleReconnect()]
- "transcription_live_client_livetranscriptionsession_startaudio": ".startAudio()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L372 | neighbors=[LiveTranscriptionSession, .handleEvent(), .connect(), .fail()]
- "transcription_live_protocol_buildsetupmessage": "buildSetupMessage()" | kind=code-symbol | source=src/features/transcription/live-protocol.ts:L121 | neighbors=[live-client.ts, live-protocol.ts, buildAuthTokenRequest(), live-protocol.test.ts]
- "transcription_live_protocol_parseserverevent": "parseServerEvent()" | kind=code-symbol | source=src/features/transcription/live-protocol.ts:L219 | neighbors=[live-client.ts, live-protocol.ts, parseDurationMs(), live-protocol.test.ts]
- "transcription_session_budget_autostopreason": "AutoStopReason" | kind=code-symbol | source=src/features/transcription/session-budget.ts:L37 | neighbors=[use-live-transcription.ts, live-client.ts, session-budget.ts, session-budget.test.ts]
- "transcription_session_budget_estimateaudiotokens": "estimateAudioTokens()" | kind=code-symbol | source=src/features/transcription/session-budget.ts:L70 | neighbors=[meeting-intel.tsx, session-budget.ts, estimateCostUsd(), session-budget.test.ts]
- "transcription_session_budget_estimatecostusd": "estimateCostUsd()" | kind=code-symbol | source=src/features/transcription/session-budget.ts:L76 | neighbors=[live-transcription-status.tsx, session-budget.ts, estimateAudioTokens(), session-budget.test.ts]
- "transcription_transcript_buffer_appendfragment": "appendFragment()" | kind=code-symbol | source=src/features/transcription/transcript-buffer.ts:L38 | neighbors=[live-client.ts, transcript-buffer.ts, longestSuffixPrefixOverlap(), transcript-buffer.test.ts]
- "transcription_transcript_buffer_empty_transcript": "EMPTY_TRANSCRIPT" | kind=code-symbol | source=src/features/transcription/transcript-buffer.ts:L13 | neighbors=[use-live-transcription.ts, live-client.ts, transcript-buffer.ts, transcript-buffer.test.ts]
- "types_next_auth_d": "next-auth.d.ts" | kind=code-symbol | source=src/types/next-auth.d.ts:L1 | neighbors=[capabilities.ts, UserRole, JWT, Session]
- "ui_calendar_calendar": "Calendar()" | kind=code-symbol | source=src/components/ui/calendar.tsx:L15 | neighbors=[jump-to-date.tsx, meetings-day-rail.tsx, calendar.tsx, datetime-wheel.tsx]
- "ui_datetime_wheel_rounduptostep": "roundUpToStep()" | kind=code-symbol | source=src/components/ui/datetime-wheel.tsx:L54 | neighbors=[action-item-board.tsx, meeting-form.tsx, next-meeting-card.tsx, datetime-wheel.tsx]
- "ui_dropdown_menu_dropdownmenulabel": "DropdownMenuLabel()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L56 | neighbors=[add-to-calendar.tsx, board-bulk-bar.tsx, board-toolbar.tsx, dropdown-menu.tsx]
- "ui_input_group_inputgroupinput": "InputGroupInput()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L119 | neighbors=[directory.tsx, history-filters.tsx, progress-filters.tsx, input-group.tsx]
- "ui_native_button": "native-button.ts" | kind=code-symbol | source=src/components/ui/native-button.ts:L1 | neighbors=[9f936b5 Add app aliases and auto-scored…, button.tsx, inferNativeButton(), native-button.test.ts]
- "ui_native_button_test": "native-button.test.ts" | kind=code-symbol | source=src/components/ui/native-button.test.ts:L1 | neighbors=[9f936b5 Add app aliases and auto-scored…, native-button.ts, inferNativeButton(), Link()]
- "ui_popover_popoverdescription": "PopoverDescription()" | kind=code-symbol | source=src/components/ui/popover.tsx:L72 | neighbors=[apps-table.tsx, capacity-heat-editable.tsx, user-table.tsx, popover.tsx]
- "ui_popover_popoverheader": "PopoverHeader()" | kind=code-symbol | source=src/components/ui/popover.tsx:L52 | neighbors=[apps-table.tsx, capacity-heat-editable.tsx, user-table.tsx, popover.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-053.json

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
