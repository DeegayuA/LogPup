# Node Description Batch 61 of 166

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

- "commit:repo:github.com/DeegayuA/LogPup@f114f1e8e9570600cdba2d9f6173e2a59ebc10d6": "f114f1e docs(meetings): record what R6 shipped as, and where it left the plan" | kind=Commit | source=git | neighbors=[de48f5b feat(meetings): a page that say…, main, fc6d16a feat(worklog): one panel for th…]
- "components_action_item_board_useactionitemactions": "useActionItemActions()" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L511 | neighbors=[action-item-board.tsx, meeting-notes.tsx, note-timeline.tsx]
- "components_activity_skeleton_activitycontrolsskeleton": "ActivityControlsSkeleton()" | kind=code-symbol | source=src/features/activity/components/activity-skeleton.tsx:L24 | neighbors=[loading.tsx, page.tsx, activity-skeleton.tsx]
- "components_activity_skeleton_activitytrailskeleton": "ActivityTrailSkeleton()" | kind=code-symbol | source=src/features/activity/components/activity-skeleton.tsx:L79 | neighbors=[loading.tsx, page.tsx, activity-skeleton.tsx]
- "components_add_to_calendar_addtocalendarmenu": "AddToCalendarMenu()" | kind=code-symbol | source=src/features/meetings/components/add-to-calendar.tsx:L43 | neighbors=[add-to-calendar.tsx, meeting-detail-dialog.tsx, meeting-intel-sheet.tsx]
- "components_add_to_calendar_icshref": "icsHref()" | kind=code-symbol | source=src/features/meetings/components/add-to-calendar.tsx:L27 | neighbors=[add-to-calendar.tsx, meeting-form.tsx, meeting-list.tsx]
- "components_ai_meter_dock_aimeterdock": "AiMeterDock()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L81 | neighbors=[ai-meter-dock.tsx, announcement(), ai-meter-provider.tsx]
- "components_allocation_trend_allocationtrend": "AllocationTrend()" | kind=code-symbol | source=src/features/people/components/allocation-trend.tsx:L21 | neighbors=[allocation-history-card.tsx, allocation-trend.tsx, page.tsx]
- "components_app_form_dialog_appformdialog": "AppFormDialog()" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L166 | neighbors=[page.tsx, app-form-dialog.tsx, page.tsx]
- "components_approval_actions_approvalactions": "ApprovalActions()" | kind=code-symbol | source=src/features/admin/components/approval-actions.tsx:L20 | neighbors=[page.tsx, page.tsx, approval-actions.tsx]
- "components_apps_browser_appsbrowser": "AppsBrowser()" | kind=code-symbol | source=src/features/apps/components/apps-browser.tsx:L58 | neighbors=[page.tsx, apps-browser.tsx, emptyHint()]
- "components_ask_panel_pushturn": "pushTurn()" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L87 | neighbors=[ask-panel.tsx, readChat(), writeChat()]
- "components_assign_dialog_assigndialog": "AssignDialog()" | kind=code-symbol | source=src/features/people/components/assign-dialog.tsx:L41 | neighbors=[assign-dialog.tsx, assignments-card.tsx, team-panel.tsx]
- "components_attribution_inline_attributioncontext": "AttributionContext" | kind=code-symbol | source=src/features/meetings/components/attribution-inline.tsx:L33 | neighbors=[attribution-inline.tsx, meeting-intel.tsx, meeting-notes.tsx]
- "components_board_bulk_bar_boardbulkbar": "BoardBulkBar()" | kind=code-symbol | source=src/features/sprints/components/board-bulk-bar.tsx:L43 | neighbors=[board.tsx, board-bulk-bar.tsx, shortDate()]
- "components_board_column_boardcolumn": "BoardColumn()" | kind=code-symbol | source=src/features/sprints/components/board-column.tsx:L28 | neighbors=[board.tsx, board-column.tsx, columnDroppableId()]
- "components_briefing_card_briefingcard": "BriefingCard()" | kind=code-symbol | source=src/features/intel/components/briefing-card.tsx:L30 | neighbors=[briefing-card.tsx, dashboard-zones.tsx, intel-view.tsx]
- "components_capacity_card_capacitycard": "CapacityCard()" | kind=code-symbol | source=src/features/dashboard/components/capacity-card.tsx:L28 | neighbors=[capacity-card.tsx, capacity-heat.tsx, capacity-heat-editable.tsx]
- "components_capacity_card_capacityempty": "CapacityEmpty()" | kind=code-symbol | source=src/features/dashboard/components/capacity-card.tsx:L89 | neighbors=[capacity-card.tsx, capacity-heat.tsx, capacity-heat-editable.tsx]
- "components_capacity_card_personavatar": "PersonAvatar()" | kind=code-symbol | source=src/features/dashboard/components/capacity-card.tsx:L122 | neighbors=[capacity-card.tsx, capacity-heat.tsx, capacity-heat-editable.tsx]
- "components_capacity_card_personheading": "PersonHeading()" | kind=code-symbol | source=src/features/dashboard/components/capacity-card.tsx:L102 | neighbors=[capacity-card.tsx, capacity-heat.tsx, capacity-heat-editable.tsx]
- "components_command_center_commandcentertrigger": "CommandCenterTrigger()" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L884 | neighbors=[command-center.tsx, useCommandCenter(), header.tsx]
- "components_correct_selection_selectioncorrector": "SelectionCorrector()" | kind=code-symbol | source=src/features/meetings/components/correct-selection.tsx:L84 | neighbors=[correct-selection.tsx, meeting-notes.tsx, note-timeline.tsx]
- "components_dashboard_zones_aizoneskeleton": "AiZoneSkeleton()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L1276 | neighbors=[loading.tsx, dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_mydayzoneskeleton": "MyDayZoneSkeleton()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L381 | neighbors=[loading.tsx, dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_myworkzone": "MyWorkZone()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L467 | neighbors=[dashboard-zones.tsx, groupTasksByApp(), pairedCards()]
- "components_dashboard_zones_portfoliozoneskeleton": "PortfolioZoneSkeleton()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L986 | neighbors=[loading.tsx, dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_teamzoneskeleton": "TeamZoneSkeleton()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L662 | neighbors=[loading.tsx, dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_zonelabel": "ZoneLabel()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L109 | neighbors=[loading.tsx, page.tsx, dashboard-zones.tsx]
- "components_declare_absence_dialog_formatabsencerange": "formatAbsenceRange()" | kind=code-symbol | source=src/features/worklog/components/declare-absence-dialog.tsx:L70 | neighbors=[declare-absence-dialog.tsx, DeclareAbsenceDialog(), pending-absence-list.tsx]
- "components_directory_peopledirectory": "PeopleDirectory()" | kind=code-symbol | source=src/features/people/components/directory.tsx:L153 | neighbors=[directory.tsx, parseSort(), page.tsx]
- "components_history_skeleton_historydataskeleton": "HistoryDataSkeleton()" | kind=code-symbol | source=src/features/people/components/history-skeleton.tsx:L15 | neighbors=[history-skeleton.tsx, loading.tsx, page.tsx]
- "components_maintenance_gate_maintenancegate": "MaintenanceGate()" | kind=code-symbol | source=src/features/maintenance/components/maintenance-gate.tsx:L112 | neighbors=[maintenance-gate.tsx, canManageMaintenance(), maintenance-mount.tsx]
- "components_meeting_chips_chiptone": "ChipTone" | kind=code-symbol | source=src/features/meetings/components/meeting-chips.tsx:L24 | neighbors=[meeting-chips.tsx, meeting-notes-dialog.tsx, meeting-planner.tsx]
- "components_meeting_detail_dialog_meetingdetaildialog": "MeetingDetailDialog()" | kind=code-symbol | source=src/features/meetings/components/meeting-detail-dialog.tsx:L107 | neighbors=[meeting-detail-dialog.tsx, meetings-calendar.tsx, meetings-month-calendar.tsx]
- "components_meeting_form_describequickadd": "describeQuickAdd()" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L191 | neighbors=[meeting-form.tsx, hostOf(), MeetingForm()]
- "components_meeting_form_meetingprefill": "MeetingPrefill" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L106 | neighbors=[meeting-form.tsx, meeting-intel.tsx, next-meeting-card.tsx]
- "components_meeting_glance_summarizemeetings": "summarizeMeetings()" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L162 | neighbors=[meeting-glance.ts, isAwaitingViewerRsvp(), meeting-glance.test.ts]
- "components_meeting_list_groupmeetings": "groupMeetings()" | kind=code-symbol | source=src/features/meetings/components/meeting-list.tsx:L312 | neighbors=[meeting-list.tsx, groupLabel(), MeetingList()]
- "components_meeting_notes_meetingainotes": "MeetingAiNotes()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes.tsx:L97 | neighbors=[meeting-intel.tsx, meeting-notes.tsx, resolveSummaryBlocks()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-060.json

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
