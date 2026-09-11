# Node Description Batch 10 of 166

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
Write every description in Portuguese (pt). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "apps_activity_queries": "activity-queries.ts" | kind=code-symbol | source=src/features/apps/activity-queries.ts:L1 | neighbors=[activity.ts, AppActivityItem, assignmentActivityTitle(), mergeActivity(), firstLine(), getAppActivity()]
- "apps_comment_actions": "comment-actions.ts" | kind=code-symbol | source=src/features/apps/comment-actions.ts:L1 | neighbors=[log.ts, logActivity(), commentInput, postAppComment(), index.ts, Db]
- "components_app_header": "app-header.tsx" | kind=code-symbol | source=src/features/apps/components/app-header.tsx:L1 | neighbors=[app-health.ts, AppHealth, AppStatus, AppTaskCounts, completionPct(), tabs.ts]
- "components_board_bulk_bar": "board-bulk-bar.tsx" | kind=code-symbol | source=src/features/sprints/components/board-bulk-bar.tsx:L1 | neighbors=[board.tsx, BoardBulkBar(), BulkPatch, shortDate(), iso-day.ts, isoDayAdd()]
- "components_maintenance_details_dialog": "maintenance-details-dialog.tsx" | kind=code-symbol | source=src/features/maintenance/components/maintenance-details-dialog.tsx:L1 | neighbors=[8bacbca ., maintenance-chrome.ts, KIND_ICONS, MaintenanceDetailsDialog(), lk-holidays.ts, window.ts]
- "components_notification_bell_client": "notification-bell-client.tsx" | kind=code-symbol | source=src/features/notifications/components/notification-bell-client.tsx:L1 | neighbors=[8bacbca ., notification-bell.tsx, iconFor(), NOTIFICATION_ICONS, NotificationBellClient(), sameSnapshot()]
- "db_schema_meetingattendees": "meetingAttendees" | kind=code-symbol | source=src/db/schema.ts:L762 | neighbors=[actions.ts, backup.ts, clear-test-data.test.ts, schema.ts, meeting-load.spec.ts, route.ts]
- "gemini_pricing": "pricing.ts" | kind=code-symbol | source=src/features/gemini/pricing.ts:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, ai-engine-card.tsx, ai-features-card.tsx, ai-meter-dock.tsx, ai-model-select.tsx, dashboard-zones.tsx]
- "maintenance_window_test": "window.test.ts" | kind=code-symbol | source=src/features/maintenance/window.test.ts:L1 | neighbors=[8bacbca ., window.ts, autoMessage(), backOnlineMessage(), defaultWindow(), EXTEND_STEPS]
- "meetings_calendar_view_test": "calendar-view.test.ts" | kind=code-symbol | source=src/features/meetings/calendar-view.test.ts:L1 | neighbors=[929997a feat(meetings): /meetings opens…, lk-holidays.ts, getLkHoliday(), isLkSunday(), toIsoDateInTimeZone(), calendar-view.ts]
- "meetings_text_replace": "text-replace.ts" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L1 | neighbors=[f823a54 feat(meetings): correct a mishe…, correct-selection.tsx, note-timeline.tsx, replace-review-dialog.tsx, applyReplacements(), diffSingleWord()]
- "people_cohort_params": "cohort-params.ts" | kind=code-symbol | source=src/features/people/cohort-params.ts:L1 | neighbors=[8dd587b feat(people): filter and sort t…, cohort-nav.tsx, cohort-views.tsx, cohort-filter.ts, PROJECT_SORTS, ProjectSort]
- "people_handover_actions": "handover-actions.ts" | kind=code-symbol | source=src/features/people/handover-actions.ts:L1 | neighbors=[handover-form.tsx, actor.ts, requireCapability(), index.ts, Db, schema.ts]
- "people_iso_day_isodayadd": "isoDayAdd()" | kind=code-symbol | source=src/features/people/iso-day.ts:L48 | neighbors=[activity-filter-bar.tsx, as-of-picker.tsx, board-bulk-bar.tsx, dashboard-zones.tsx, roadmap-spine.tsx, task-card.tsx]
- "shell_theme_provider": "theme-provider.tsx" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L1 | neighbors=[layout.tsx, 007c37f ., appearance-card.tsx, command-center.tsx, types.ts, commands.ts]
- "sprints_board_view_test": "board-view.test.ts" | kind=code-symbol | source=src/features/sprints/board-view.test.ts:L1 | neighbors=[a9d31f4 refactor(tasks): add isTerminal…, board-view.ts, activeFilterCount(), BoardSummary, BoardTask, boardViewPatch()]
- "transcription_actions": "actions.ts" | kind=code-symbol | source=src/features/transcription/actions.ts:L1 | neighbors=[9cd44c8 ., e73a38e fix(live): mint tokens with the…, use-live-transcription.ts, client.ts, GeminiError, model-choice.ts]
- "ui_dialog_dialogfooter": "DialogFooter()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L100 | neighbors=[action-item-board.tsx, add-user-dialog.tsx, app-form-dialog.tsx, assign-dialog.tsx, bug-csv-import-dialog.tsx, correct-selection.tsx]
- "ui_page_header": "page-header.tsx" | kind=code-symbol | source=src/components/ui/page-header.tsx:L1 | neighbors=[layout.tsx, page.tsx, page.tsx, page.tsx, page.tsx, loading.tsx]
- "worklog_entry_actions_test": "entry-actions.test.ts" | kind=code-symbol | source=src/features/worklog/entry-actions.test.ts:L1 | neighbors=[364f1af fix(search): ⌘K was handing eve…, 3ac9d68 ., 77dfc15 fix(worklog): no task entry cou…, 9f936b5 Add app aliases and auto-scored…, live.ts, liveTasks]
- "worklog_entry_check": "entry-check.ts" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L1 | neighbors=[3c30bf4 worklog: per-task hours substra…, day-hours-card.tsx, entry-ai-actions.ts, entries.ts, EntryCategory, totalMinutes()]
- "worklog_progress_params": "progress-params.ts" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L1 | neighbors=[progress-filters.tsx, page.tsx, addDaysIso(), eachDayInclusive(), first(), firstOfMonth()]
- "worklog_worklog_day": "worklog-day.ts" | kind=code-symbol | source=src/features/worklog/worklog-day.ts:L1 | neighbors=[page.tsx, page.tsx, actions.ts, auto-score.ts, auto-score-sync.ts, auto-score.test.ts]
- "activity_filters": "filters.ts" | kind=code-symbol | source=src/features/activity/filters.ts:L1 | neighbors=[actions.ts, commands.ts, describe.ts, describe.test.ts, activityConditions(), activityParams()]
- "admin_audit_filters_test": "audit-filters.test.ts" | kind=code-symbol | source=src/features/admin/audit-filters.test.ts:L1 | neighbors=[audit-filters.ts, auditDepthNotice(), auditEmptyKind(), auditHref(), auditPageCount(), AuditParamState]
- "admin_backup": "backup.ts" | kind=code-symbol | source=src/features/admin/backup.ts:L1 | neighbors=[backupUserColumns, buildSnapshot(), encryptionKey(), encryptSnapshot(), index.ts, Db]
- "apps_app_aliases": "app-aliases.ts" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L1 | neighbors=[AliasedApp, AppMatch, AppMatchHow, appPromptLine(), appVocabulary(), containsWord()]
- "apps_browse_test": "browse.test.ts" | kind=code-symbol | source=src/features/apps/browse.test.ts:L1 | neighbors=[app-health.ts, AppHealth, AppTaskCounts, browse.ts, BrowsableApp, browseHref()]
- "commit:repo:github.com/DeegayuA/LogPup@514d33b6dcccb047bcc77f46103a7c6efe695801": "514d33b feat(meetings): a meeting can belong to its attendees alone, and quick …" | kind=Commit | source=git | neighbors=[main, 8d1b390 fix(i18n): Sinhala survives eve…, dashboard-zones.tsx, meeting-detail-dialog.tsx, meeting-form.tsx, meeting-header-actions.tsx]
- "commit:repo:github.com/DeegayuA/LogPup@d0da911c182aa618f9e30ffe97e5b4152fb7c259": "d0da911 test(gemini): a public page may only name a model the app can price" | kind=Commit | source=git | neighbors=[main, f180d72 feat(people): capacity in hours…, sign-in-backdrop.tsx, advertised-models.test.ts, bento-features.tsx, capabilities-grid.tsx]
- "components_ai_model_select": "ai-model-select.tsx" | kind=code-symbol | source=src/features/gemini/components/ai-model-select.tsx:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, 89dee50 fix(ui): craft regressions the …, ai-features-card.tsx, AiModelSelect(), ModelSuggestion, priceLabel()]
- "components_app_activity": "app-activity.tsx" | kind=code-symbol | source=src/features/apps/components/app-activity.tsx:L1 | neighbors=[activity.ts, AppActivityItem, AppActivityKind, groupActivityByDay(), relativeDayLabel(), app-health.ts]
- "components_board_column": "board-column.tsx" | kind=code-symbol | source=src/features/sprints/components/board-column.tsx:L1 | neighbors=[board.tsx, capabilities.ts, isAdminRole(), UserRole, BoardColumn(), columnDroppableId()]
- "components_maintenance_overlay": "maintenance-overlay.tsx" | kind=code-symbol | source=src/features/maintenance/components/maintenance-overlay.tsx:L1 | neighbors=[8bacbca ., maintenance-gate.tsx, maintenance-chrome.ts, KIND_ICONS, MaintenanceAuthNotice(), MaintenanceOverlay()]
- "components_meeting_share_dialog": "meeting-share-dialog.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-share-dialog.tsx:L1 | neighbors=[meeting-form.tsx, MeetingShareDialog(), ShareContent(), phone.ts, waHref(), share.ts]
- "components_person_hover_card": "person-hover-card.tsx" | kind=code-symbol | source=src/features/people/components/person-hover-card.tsx:L1 | neighbors=[8bacbca ., meeting-planner.tsx, PersonCardBody(), PersonHoverCard(), phone.ts, telHref()]
- "components_project_finance_card": "project-finance-card.tsx" | kind=code-symbol | source=src/features/finance/components/project-finance-card.tsx:L1 | neighbors=[d33e084 feat(finance): give the cost mo…, CostFigure(), Figure(), hours(), money(), ProjectFinanceCard()]
- "components_use_speech": "use-speech.ts" | kind=code-symbol | source=src/features/speech/components/use-speech.ts:L1 | neighbors=[2607f59 fix(speech): read-aloud budgets…, d5b6409 ., meeting-assistant.tsx, speak-button.tsx, ai-meter-provider.tsx, meterOrigin()]
- "e2e_soft_delete_spec": "soft-delete.spec.ts" | kind=code-symbol | source=e2e/soft-delete.spec.ts:L1 | neighbors=[671c254 ., index.ts, Db, schema.ts, apps, meetings]
- "ics_route": "route.ts" | kind=code-symbol | source=src/app/api/meetings/[id]/ics/route.ts:L1 | neighbors=[514d33b feat(meetings): a meeting can b…, index.ts, Db, live.ts, liveMeetings, schema.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-009.json

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
