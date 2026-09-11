# Node Description Batch 86 of 166

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

- "components_audit_skeleton_auditcontrolsskeleton": "AuditControlsSkeleton()" | kind=code-symbol | source=src/features/admin/components/audit-skeleton.tsx:L25 | neighbors=[page.tsx, audit-skeleton.tsx]
- "components_audit_skeleton_audittrailskeleton": "AuditTrailSkeleton()" | kind=code-symbol | source=src/features/admin/components/audit-skeleton.tsx:L74 | neighbors=[page.tsx, audit-skeleton.tsx]
- "components_audit_trail_audittrail": "AuditTrail()" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L458 | neighbors=[page.tsx, audit-trail.tsx]
- "components_avatar_upload_avatarupload": "AvatarUpload()" | kind=code-symbol | source=src/features/auth/components/avatar-upload.tsx:L46 | neighbors=[avatar-upload.tsx, page.tsx]
- "components_board_board": "Board()" | kind=code-symbol | source=src/features/sprints/components/board.tsx:L104 | neighbors=[board.tsx, page.tsx]
- "components_board_bulk_bar_bulkpatch": "BulkPatch" | kind=code-symbol | source=src/features/sprints/components/board-bulk-bar.tsx:L18 | neighbors=[board.tsx, board-bulk-bar.tsx]
- "components_board_bulk_bar_shortdate": "shortDate()" | kind=code-symbol | source=src/features/sprints/components/board-bulk-bar.tsx:L30 | neighbors=[board-bulk-bar.tsx, BoardBulkBar()]
- "components_board_column_columndroppableid": "columnDroppableId()" | kind=code-symbol | source=src/features/sprints/components/board-column.tsx:L24 | neighbors=[board-column.tsx, BoardColumn()]
- "components_board_column_groupidfromdroppable": "groupIdFromDroppable()" | kind=code-symbol | source=src/features/sprints/components/board-column.tsx:L25 | neighbors=[board.tsx, board-column.tsx]
- "components_board_toolbar_boardtoolbar": "BoardToolbar()" | kind=code-symbol | source=src/features/sprints/components/board-toolbar.tsx:L80 | neighbors=[board.tsx, board-toolbar.tsx]
- "components_bug_content_editor_bugcontenteditor": "BugContentEditor()" | kind=code-symbol | source=src/features/bugs/components/bug-content-editor.tsx:L29 | neighbors=[bug-content-editor.tsx, bug-list.tsx]
- "components_bug_csv_import_dialog_bugcsvimportdialog": "BugCsvImportDialog()" | kind=code-symbol | source=src/features/bugs/components/bug-csv-import-dialog.tsx:L72 | neighbors=[bug-csv-import-dialog.tsx, page.tsx]
- "components_bug_description_bugdescription": "BugDescription()" | kind=code-symbol | source=src/features/bugs/components/bug-description.tsx:L18 | neighbors=[bug-description.tsx, bug-list.tsx]
- "components_bug_list_buglistskeleton": "BugListSkeleton()" | kind=code-symbol | source=src/features/bugs/components/bug-list.tsx:L317 | neighbors=[page.tsx, bug-list.tsx]
- "components_bug_triage_controls_bugtriagecontrols": "BugTriageControls()" | kind=code-symbol | source=src/features/bugs/components/bug-triage-controls.tsx:L57 | neighbors=[bug-list.tsx, bug-triage-controls.tsx]
- "components_capacity_bar_test": "capacity-bar.test.ts" | kind=code-symbol | source=src/features/people/components/capacity-bar.test.ts:L1 | neighbors=[capacity-bar.tsx, CapacityBand]
- "components_capacity_heat_capacityheat": "CapacityHeat()" | kind=code-symbol | source=src/features/dashboard/components/capacity-heat.tsx:L25 | neighbors=[capacity-heat.tsx, dashboard-zones.tsx]
- "components_capacity_heat_editable_capacityheateditable": "CapacityHeatEditable()" | kind=code-symbol | source=src/features/dashboard/components/capacity-heat-editable.tsx:L124 | neighbors=[capacity-heat.tsx, capacity-heat-editable.tsx]
- "components_cohort_nav_cohortnav": "CohortNav()" | kind=code-symbol | source=src/features/people/components/cohort-nav.tsx:L23 | neighbors=[cohort-nav.tsx, page.tsx]
- "components_cohort_views_cohortdataskeleton": "CohortDataSkeleton()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L869 | neighbors=[cohort-views.tsx, page.tsx]
- "components_cohort_views_directorydataskeleton": "DirectoryDataSkeleton()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L914 | neighbors=[cohort-views.tsx, page.tsx]
- "components_cohort_views_projectcohortlist": "ProjectCohortList()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L333 | neighbors=[cohort-views.tsx, page.tsx]
- "components_cohort_views_projectoverlapview": "ProjectOverlapView()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L691 | neighbors=[cohort-views.tsx, page.tsx]
- "components_cohort_views_sharedpeoplelist": "SharedPeopleList()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L488 | neighbors=[cohort-views.tsx, page.tsx]
- "components_command_center_commandcenterprovider": "CommandCenterProvider()" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L177 | neighbors=[layout.tsx, command-center.tsx]
- "components_command_center_usecommandcenter": "useCommandCenter()" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L73 | neighbors=[command-center.tsx, CommandCenterTrigger()]
- "components_coverage_figure_coveragefigure": "CoverageFigure()" | kind=code-symbol | source=src/features/admin/components/coverage-figure.tsx:L12 | neighbors=[coverage-figure.tsx, dashboard-zones.tsx]
- "components_danger_app_reset_card_dangerappresetcard": "DangerAppResetCard()" | kind=code-symbol | source=src/features/admin/components/danger-app-reset-card.tsx:L31 | neighbors=[danger-app-reset-card.tsx, page.tsx]
- "components_danger_backup_card_dangerbackupcard": "DangerBackupCard()" | kind=code-symbol | source=src/features/admin/components/danger-backup-card.tsx:L24 | neighbors=[danger-backup-card.tsx, page.tsx]
- "components_danger_confirm_control_blastradiuslists": "BlastRadiusLists()" | kind=code-symbol | source=src/features/admin/components/danger-confirm-control.tsx:L166 | neighbors=[danger-backup-card.tsx, danger-confirm-control.tsx]
- "components_danger_meeting_delete_card_dangermeetingdeletecard": "DangerMeetingDeleteCard()" | kind=code-symbol | source=src/features/admin/components/danger-meeting-delete-card.tsx:L22 | neighbors=[danger-meeting-delete-card.tsx, page.tsx]
- "components_danger_recordings_card_dangerrecordingscard": "DangerRecordingsCard()" | kind=code-symbol | source=src/features/admin/components/danger-recordings-card.tsx:L23 | neighbors=[danger-recordings-card.tsx, page.tsx]
- "components_danger_trash_empty_card_dangertrashemptycard": "DangerTrashEmptyCard()" | kind=code-symbol | source=src/features/admin/components/danger-trash-empty-card.tsx:L18 | neighbors=[danger-trash-empty-card.tsx, page.tsx]
- "components_dashboard_zones_aizone": "AiZone()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L1193 | neighbors=[dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_approvalszone": "ApprovalsZone()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L1019 | neighbors=[dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_approvalszoneskeleton": "ApprovalsZoneSkeleton()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L1087 | neighbors=[dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_coveragezoneskeleton": "CoverageZoneSkeleton()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L847 | neighbors=[dashboard-zones.tsx, pairedCards()]
- "components_dashboard_zones_formatowed": "formatOwed()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L680 | neighbors=[dashboard-zones.tsx, CoverageZone()]
- "components_dashboard_zones_grouptasksbyapp": "groupTasksByApp()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L441 | neighbors=[dashboard-zones.tsx, MyWorkZone()]
- "components_dashboard_zones_mydayzone": "MyDayZone()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L279 | neighbors=[dashboard-zones.tsx, pairedCards()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-085.json

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
