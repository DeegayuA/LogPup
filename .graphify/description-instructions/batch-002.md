# Node Description Batch 3 of 166

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

- "ui_card_cardheader": "CardHeader()" | kind=code-symbol | source=src/components/ui/card.tsx:L23 | neighbors=[page.tsx, page.tsx, page.tsx, page.tsx, page.tsx, active-sprints.tsx]
- "ui_input_input": "Input()" | kind=code-symbol | source=src/components/ui/input.tsx:L6 | neighbors=[action-item-board.tsx, activity-filter-bar.tsx, add-user-dialog.tsx, app-form-dialog.tsx, approval-actions.tsx, apps-browser.tsx]
- "components_board": "board.tsx" | kind=code-symbol | source=src/features/sprints/components/board.tsx:L1 | neighbors=[capabilities.ts, isAdminRole(), UserRole, applyMove(), Board(), board-bulk-bar.tsx]
- "components_meetings_views": "meetings-views.tsx" | kind=code-symbol | source=src/features/meetings/components/meetings-views.tsx:L1 | neighbors=[671c254 ., 95b092e feat(meetings): quick note and …, capabilities.ts, UserRole, meeting-form.tsx, MeetingForm()]
- "intel_actions": "actions.ts" | kind=code-symbol | source=src/features/intel/actions.ts:L1 | neighbors=[layout.tsx, 0ef5105 fix(intel): a briefing priority…, 9cd44c8 ., ea1622e fix(intel): Ask LogPup reads as…, ask-panel.tsx, briefing-card.tsx]
- "meetings_queries": "queries.ts" | kind=code-symbol | source=src/features/meetings/queries.ts:L1 | neighbors=[514d33b feat(meetings): a meeting can b…, 671c254 ., add-to-calendar.tsx, meeting-detail-dialog.tsx, meeting-intel-sheet.tsx, meeting-list.tsx]
- "components_sprint_edit_dialog": "sprint-edit-dialog.tsx" | kind=code-symbol | source=src/features/sprints/components/sprint-edit-dialog.tsx:L1 | neighbors=[roadmap-timeline.tsx, EMPTY, FormState, SprintEditDialog(), Status, STATUS_OPTIONS]
- "components_gemini_keys_card": "gemini-keys-card.tsx" | kind=code-symbol | source=src/features/gemini/components/gemini-keys-card.tsx:L1 | neighbors=[GeminiKeyRowItem(), GeminiKeysCard(), UsedByRow, actions.ts, addGeminiKey(), deleteGeminiKey()]
- "sprints_actions": "actions.ts" | kind=code-symbol | source=src/features/sprints/actions.ts:L1 | neighbors=[board.tsx, board-bulk-bar.tsx, roadmap-timeline.tsx, sprint-edit-dialog.tsx, sprint-form-dialog.tsx, sprint-status-select.tsx]
- "auth_capabilities_can": "can()" | kind=code-symbol | source=src/features/auth/capabilities.ts:L414 | neighbors=[page.tsx, actions.ts, approval-queries.ts, audit-queries.ts, change-request-actions.ts, change-request-queries.ts]
- "components_task_dialog": "task-dialog.tsx" | kind=code-symbol | source=src/features/sprints/components/task-dialog.tsx:L1 | neighbors=[board.tsx, mention-textarea.tsx, MentionTextarea(), emptyForm(), FormState, PRIORITY_OPTIONS]
- "components_meeting_notes_model": "meeting-notes-model.ts" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L1 | neighbors=[671c254 ., e2090c6 feat(meetings): "Not tracked" r…, f823a54 feat(meetings): correct a mishe…, meeting-intel.tsx, meeting-intel-sheet.tsx, meeting-list.tsx]
- "meetings_planner": "planner.ts" | kind=code-symbol | source=src/features/meetings/planner.ts:L1 | neighbors=[7228d54 refactor(meetings): one derivat…, 8bacbca ., c2bc5fd refactor(tasks): route in-memor…, de48f5b feat(meetings): a page that say…, meeting-planner.tsx, app-health.ts]
- "ui_card_cardtitle": "CardTitle()" | kind=code-symbol | source=src/components/ui/card.tsx:L36 | neighbors=[page.tsx, page.tsx, page.tsx, page.tsx, page.tsx, active-sprints.tsx]
- "components_maintenance_controls": "maintenance-controls.tsx" | kind=code-symbol | source=src/features/maintenance/components/maintenance-controls.tsx:L1 | neighbors=[8bacbca ., maintenance-chrome.ts, KIND_ICONS, MaintenanceControls(), utils.ts, cn()]
- "meetings_planner_actions": "planner-actions.ts" | kind=code-symbol | source=src/features/meetings/planner-actions.ts:L1 | neighbors=[e8e9934 refactor(tasks): query open wor…, meeting-planner.tsx, queries.ts, listApps, role-history.ts, isBackfilled()]
- "worklog_entry_actions": "entry-actions.ts" | kind=code-symbol | source=src/features/worklog/entry-actions.ts:L1 | neighbors=[1c2fee5 fix(worklog): a trashed task mu…, 3ac9d68 ., 3c30bf4 worklog: per-task hours substra…, 53ae2f3 feat(worklog): attribute hours …, 77dfc15 fix(worklog): no task entry cou…, 9f936b5 Add app aliases and auto-scored…]
- "apps_app_health": "app-health.ts" | kind=code-symbol | source=src/features/apps/app-health.ts:L1 | neighbors=[activity.ts, AppHealth, AppHealthInput, AppSprintSnapshot, AppStatus, AppTaskCounts]
- "apps_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/apps/page.tsx:L1 | neighbors=[app-health.ts, summarizePortfolio(), browse.ts, browseHref(), parseBrowseParams(), AdminAppsPage()]
- "components_day_panel": "day-panel.tsx" | kind=code-symbol | source=src/features/worklog/components/day-panel.tsx:L1 | neighbors=[056203d fix(worklog): stop printing the…, 3ac9d68 ., 3c0bc01 ., 419d875 Unify worklog logging with AI c…, 695a047 fix(worklog): one fill button, …, 8fa8f26 feat(worklog): the whole day in…]
- "components_meetings_month_calendar": "meetings-month-calendar.tsx" | kind=code-symbol | source=src/features/meetings/components/meetings-month-calendar.tsx:L1 | neighbors=[meetings-calendar.tsx, meeting-detail-dialog.tsx, MeetingDetailDialog(), meeting-form.tsx, MeetingForm(), meeting-glance.ts]
- "activity_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/activity/page.tsx:L1 | neighbors=[describe.ts, describeActivityFilters(), filters.ts, activityParams(), ActivityParamState, decodeActivityCursor()]
- "bugs_actions": "actions.ts" | kind=code-symbol | source=src/features/bugs/actions.ts:L1 | neighbors=[log.ts, logActivity(), actor.ts, requireCapability(), deleteBug(), loadMoreTriageBugs()]
- "components_pending_approvals_card": "pending-approvals-card.tsx" | kind=code-symbol | source=src/features/admin/components/pending-approvals-card.tsx:L1 | neighbors=[page.tsx, 0ef5142 fix(ui): correctness, responsiv…, dashboard-zones.tsx, actions.ts, approveUser(), rejectUser()]
- "registry_types": "types.ts" | kind=code-symbol | source=src/features/search/registry/types.ts:L1 | neighbors=[commands.ts, commands.ts, search-providers.ts, commands.ts, commands.ts, search-providers.ts]
- "ui_badge": "badge.tsx" | kind=code-symbol | source=src/components/ui/badge.tsx:L1 | neighbors=[active-sprints.tsx, activity-feed.tsx, ai-adoption-card.tsx, ai-engine-card.tsx, allocation-history-card.tsx, app-header.tsx]
- "admin_bulk_actions": "bulk-actions.ts" | kind=code-symbol | source=src/features/admin/bulk-actions.ts:L1 | neighbors=[actions.ts, setUserActive(), setUserEmploymentType(), setUserRole(), activeInput, bulkArchiveApps()]
- "components_declare_absence_dialog": "declare-absence-dialog.tsx" | kind=code-symbol | source=src/features/worklog/components/declare-absence-dialog.tsx:L1 | neighbors=[419d875 Unify worklog logging with AI c…, a4b271b Improve leave types and worklog…, catch-up-panel.tsx, DeclareAbsenceDialog(), FiledAbsence, formatAbsenceRange()]
- "components_progress_matrix": "progress-matrix.tsx" | kind=code-symbol | source=src/features/worklog/components/progress-matrix.tsx:L1 | neighbors=[0ef5142 fix(ui): correctness, responsiv…, a628b27 feat(worklog): the progress gri…, a974c38 feat(progress): hours beside da…, compactCoverage(), formatMinutes(), initials()]
- "components_worklog_form": "worklog-form.tsx" | kind=code-symbol | source=src/features/worklog/components/worklog-form.tsx:L1 | neighbors=[11575db fix(worklog): project chips can…, 3c0bc01 ., 473168b docs: restore the reasoning the…, 695a047 fix(worklog): one fill button, …, 743b1f2 fix(ui): a false-positive tag m…, 89dee50 fix(ui): craft regressions the …]
- "admin_audit_filters": "audit-filters.ts" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L1 | neighbors=[AUDIT_SORT_DIRECTIONS, AUDIT_SORT_KEYS, AUDIT_SORT_LABELS, AuditDayGroup, auditDepthNotice(), auditEmptyKind()]
- "bugs_bug_csv": "bug-csv.ts" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L1 | neighbors=[bulk-logic.ts, csvFilename(), normalizeHeader(), splitCsvRows(), toCsv(), BUG_CSV_COLUMNS]
- "commit:repo:github.com/DeegayuA/LogPup@8bacbcaf79da2df4c6af989e7143bda91cc5c751": "8bacbca ." | kind=Commit | source=git | neighbors=[types.ts, layout.tsx, actor.ts, capabilities.ts, main, ce0f1f5 feat(people): a person card beh…]
- "components_ask_panel": "ask-panel.tsx" | kind=code-symbol | source=src/features/intel/components/ask-panel.tsx:L1 | neighbors=[0ef5105 fix(intel): a briefing priority…, d269096 feat(intel): keep the Ask LogPu…, d5b6409 ., ea1622e fix(intel): Ask LogPup reads as…, ask-bubble.tsx, ai-meter-provider.tsx]
- "components_trash_row_actions": "trash-row-actions.tsx" | kind=code-symbol | source=src/features/admin/components/trash-row-actions.tsx:L1 | neighbors=[trash-card.tsx, trash-actions.ts, purgeApp(), purgeBug(), purgeKeyframe(), purgeMeeting()]
- "db_live_liveapps": "liveApps" | kind=code-symbol | source=src/db/live.ts:L44 | neighbors=[queries.ts, audit-queries.ts, audit-queries.test.ts, danger-actions.ts, danger-actions.test.ts, actions.ts]
- "gemini_actions": "actions.ts" | kind=code-symbol | source=src/features/gemini/actions.ts:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, ai-feature-toggle.tsx, ai-model-select.tsx, gemini-keys-card.tsx, meeting-intel.tsx, index.ts]
- "meeting_load_gather": "gather.ts" | kind=code-symbol | source=src/features/meeting-load/gather.ts:L1 | neighbors=[d933927 feat(meeting-load): reads that …, actions.ts, admin-queries.ts, index.ts, Db, live.ts]
- "meetings_calendar_view": "calendar-view.ts" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L1 | neighbors=[929997a feat(meetings): /meetings opens…, jump-to-date.tsx, meeting-list.tsx, meetings-agenda.tsx, meetings-calendar.tsx, meetings-day-rail.tsx]
- "sprints_queries": "queries.ts" | kind=code-symbol | source=src/features/sprints/queries.ts:L1 | neighbors=[active-sprints.tsx, board.tsx, board-column.tsx, dashboard-zones.tsx, roadmap.tsx, roadmap-timeline.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-002.json

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
