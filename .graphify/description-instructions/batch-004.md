# Node Description Batch 5 of 166

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

- "components_sprint_form_dialog": "sprint-form-dialog.tsx" | kind=code-symbol | source=src/features/sprints/components/sprint-form-dialog.tsx:L1 | neighbors=[d5b6409 ., ai-meter-provider.tsx, meterOrigin(), MeterOriginSource, useAiMeter(), FieldErrors]
- "admin_audit_queries": "audit-queries.ts" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L1 | neighbors=[audit-filters.ts, AuditParamState, AuditSortDir, AuditSortKey, colomboDayEnd(), colomboDayStart()]
- "apps_browse": "browse.ts" | kind=code-symbol | source=src/features/apps/browse.ts:L1 | neighbors=[app-health.ts, AppHealth, AppStatus, AppTaskCounts, completionPct(), activityMs()]
- "bugs_import_actions": "import-actions.ts" | kind=code-symbol | source=src/features/bugs/import-actions.ts:L1 | neighbors=[log.ts, logActivity(), actor.ts, requireCapability(), bug-csv.ts, describeBugImport()]
- "components_add_user_dialog": "add-user-dialog.tsx" | kind=code-symbol | source=src/features/admin/components/add-user-dialog.tsx:L1 | neighbors=[actions.ts, createUser(), capabilities.ts, UserRole, personal-email-schema.ts, AddUserDialog()]
- "components_meeting_planner": "meeting-planner.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-planner.tsx:L1 | neighbors=[ce0f1f5 feat(people): a person card beh…, meeting-intel.tsx, meeting-chips.tsx, ChipTone, MetaChip(), SectionHeading()]
- "components_meetings_calendar": "meetings-calendar.tsx" | kind=code-symbol | source=src/features/meetings/components/meetings-calendar.tsx:L1 | neighbors=[meeting-detail-dialog.tsx, MeetingDetailDialog(), meeting-notes-dialog.tsx, MeetingNotesDialog(), meetings-agenda.tsx, MeetingsAgenda()]
- "db_live_test": "live.test.ts" | kind=code-symbol | source=src/db/live.test.ts:L1 | neighbors=[272f9a7 feat(meetings): store the decis…, 3c30bf4 worklog: per-task hours substra…, 53262eb feat(tasks): several people can…, 702dd68 feat(db): takes become a thing …, 7d54694 feat(db): the work substrate, a…, 817bf89 .]
- "meeting_load_suggest": "suggest.ts" | kind=code-symbol | source=src/features/meeting-load/suggest.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, meeting-load-admin-card.tsx, suggestion-decision-buttons.tsx, your-series-card.tsx, actions.ts, admin-queries.ts]
- "ui_skeleton_skeleton": "Skeleton()" | kind=code-symbol | source=src/components/ui/skeleton.tsx:L16 | neighbors=[loading.tsx, loading.tsx, page.tsx, loading.tsx, activity-skeleton.tsx, ask-panel.tsx]
- "admin_danger_logic": "danger-logic.ts" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L1 | neighbors=[danger-actions.ts, danger-actions.test.ts, backupFilename(), backupSummary(), backupTooLarge(), BlastRadius]
- "commit:repo:github.com/DeegayuA/LogPup@007c37fefa2b88f2714007315e1bbf3ddec681aa": "007c37f ." | kind=Commit | source=git | neighbors=[loading.tsx, layout.tsx, page.tsx, loading.tsx, main, 8c996d9 feat(notifications): a mention …]
- "components_meeting_chips": "meeting-chips.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-chips.tsx:L1 | neighbors=[671c254 ., action-item-board.tsx, correct-selection.tsx, logged-days-list.tsx, meeting-assistant.tsx, capChips()]
- "components_team_panel": "team-panel.tsx" | kind=code-symbol | source=src/features/people/components/team-panel.tsx:L1 | neighbors=[2bd871d feat(apps): download the team, …, assign-dialog.tsx, AssignDialog(), contact-buttons.tsx, ContactButtons(), csv-download.ts]
- "finance_cost": "cost.ts" | kind=code-symbol | source=src/features/finance/cost.ts:L1 | neighbors=[35d16f8 feat(finance): server layer for…, 85c3961 feat(finance): cost and worth d…, project-finance-card.tsx, addMonthsIso(), CostableAttributedEntry, CostableEntry]
- "finance_rate_actions": "rate-actions.ts" | kind=code-symbol | source=src/features/finance/rate-actions.ts:L1 | neighbors=[35d16f8 feat(finance): server layer for…, log.ts, logActivity(), actor.ts, requireCapability(), index.ts]
- "registry_registry_test": "registry.test.ts" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L1 | neighbors=[007c37f ., 029ff45 feat(search): worklog and activ…, 325eb16 fix(search): one finance entry …, 364f1af fix(search): ⌘K was handing eve…, 3dcd417 feat(shell): collapse the sideb…, 5c7efa5 feat(meeting-load): four surfac…]
- "ui_empty_state": "empty-state.tsx" | kind=code-symbol | source=src/components/ui/empty-state.tsx:L1 | neighbors=[page.tsx, page.tsx, page.tsx, page.tsx, active-sprints.tsx, app-activity.tsx]
- "worklog_nudge_queries": "nudge-queries.ts" | kind=code-symbol | source=src/features/worklog/nudge-queries.ts:L1 | neighbors=[9f936b5 Add app aliases and auto-scored…, route.ts, index.ts, Db, schema.ts, dailyWorklogs]
- "components_app_card": "app-card.tsx" | kind=code-symbol | source=src/features/apps/components/app-card.tsx:L1 | neighbors=[d8e49ed fix(apps): ownership is a word,…, e594a52 feat(apps): each app carries it…, app-health.ts, AppStatus, completionPct(), HEALTH_LABEL]
- "components_board_toolbar": "board-toolbar.tsx" | kind=code-symbol | source=src/features/sprints/components/board-toolbar.tsx:L1 | neighbors=[board.tsx, stat-number.tsx, StatNumber(), BoardToolbar(), Stat(), utils.ts]
- "components_maintenance_gate": "maintenance-gate.tsx" | kind=code-symbol | source=src/features/maintenance/components/maintenance-gate.tsx:L1 | neighbors=[8bacbca ., capabilities.ts, UserRole, maintenance-banner.tsx, MaintenanceBanner(), maintenance-controls.tsx]
- "components_task_card": "task-card.tsx" | kind=code-symbol | source=src/features/sprints/components/task-card.tsx:L1 | neighbors=[board.tsx, board-column.tsx, CardFace(), cardLabel(), formatDueDate(), PRIORITY_BAR]
- "db_live_livemeetings": "liveMeetings" | kind=code-symbol | source=src/db/live.ts:L46 | neighbors=[danger-actions.ts, danger-actions.test.ts, activity-queries.ts, queries.ts, live.ts, live.test.ts]
- "maintenance_actions": "actions.ts" | kind=code-symbol | source=src/features/maintenance/actions.ts:L1 | neighbors=[8bacbca ., maintenance-controls.tsx, maintenance-gate.tsx, log.ts, logActivity(), actor.ts]
- "ui_card_carddescription": "CardDescription()" | kind=code-symbol | source=src/components/ui/card.tsx:L61 | neighbors=[page.tsx, page.tsx, page.tsx, page.tsx, page.tsx, ai-adoption-card.tsx]
- "worklog_draft_actions": "draft-actions.ts" | kind=code-symbol | source=src/features/worklog/draft-actions.ts:L1 | neighbors=[9cd44c8 ., dda9cf6 feat(worklog): the AI draft kno…, catch-up-panel.tsx, worklog-form.tsx, index.ts, Db]
- "worklog_entries": "entries.ts" | kind=code-symbol | source=src/features/worklog/entries.ts:L1 | neighbors=[3c30bf4 worklog: per-task hours substra…, 53ae2f3 feat(worklog): attribute hours …, day-hours-card.tsx, entry-grammar-help.tsx, logged-days-list.tsx, auto-score-sync.ts]
- "components_task_composer": "task-composer.tsx" | kind=code-symbol | source=src/features/sprints/components/task-composer.tsx:L1 | neighbors=[d5b6409 ., board-column.tsx, ai-meter-provider.tsx, meterOrigin(), MeterOriginSource, useAiMeter()]
- "danger_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/admin/danger/page.tsx:L1 | neighbors=[danger-actions.ts, loadDangerTargets(), actor.ts, loadActor, capabilities.ts, Action]
- "gemini_meter_tasks": "meter-tasks.ts" | kind=code-symbol | source=src/features/gemini/meter-tasks.ts:L1 | neighbors=[13be4b6 ., 9cd44c8 ., c5251d4 fix(gemini): six holes an adver…, d5b6409 ., f8a9b00 feat(gemini): the meter learns …, ai-meter-dock.tsx]
- "gemini_prefs": "prefs.ts" | kind=code-symbol | source=src/features/gemini/prefs.ts:L1 | neighbors=[audit-nl-actions.ts, actions.ts, page.tsx, ai-features-card.tsx, dashboard-zones.tsx, ai-engine.ts]
- "load_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/meetings/load/page.tsx:L1 | neighbors=[5c7efa5 feat(meeting-load): four surfac…, a1e0845 ., queries.ts, listApps, load-board.tsx, LoadBoard()]
- "meetings_assistant_actions": "assistant-actions.ts" | kind=code-symbol | source=src/features/meetings/assistant-actions.ts:L1 | neighbors=[meeting-assistant.tsx, index.ts, Db, live.ts, liveMeetings, liveNoteSegments]
- "meetings_rsvp_actions": "rsvp-actions.ts" | kind=code-symbol | source=src/features/meetings/rsvp-actions.ts:L1 | neighbors=[meeting-list.tsx, meeting-rsvp.tsx, log.ts, logActivity(), capabilities.ts, isAdminRole()]
- "people_format_instant": "format-instant.ts" | kind=code-symbol | source=src/features/people/format-instant.ts:L1 | neighbors=[page.tsx, activity-feed.tsx, allocation-history-card.tsx, app-role-history-card.tsx, audit-trail.tsx, briefing-card.tsx]
- "ui_alert_dialog": "alert-dialog.tsx" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L1 | neighbors=[apps-table.tsx, assignments-card.tsx, gemini-keys-card.tsx, meeting-detail-dialog.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx]
- "ui_empty_state_emptystate": "EmptyState()" | kind=code-symbol | source=src/components/ui/empty-state.tsx:L13 | neighbors=[page.tsx, page.tsx, page.tsx, page.tsx, active-sprints.tsx, app-activity.tsx]
- "admin_change_request_actions": "change-request-actions.ts" | kind=code-symbol | source=src/features/admin/change-request-actions.ts:L1 | neighbors=[approveChangeRequest(), createChangeRequest(), createInput, currentRowFor(), rejectChangeRequest(), reviewInput]
- "audit_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/admin/audit/page.tsx:L1 | neighbors=[audit-filters.ts, AuditParamState, auditQueryString(), hasAuditFilters(), parseAuditParams(), RawSearchParams]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-004.json

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
