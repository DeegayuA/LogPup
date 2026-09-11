# Node Description Batch 2 of 166

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

- "lib_action_result": "action-result.ts" | kind=code-symbol | source=src/lib/action-result.ts:L1 | neighbors=[actions.ts, actions.ts, app-grant-actions.ts, audit-nl-actions.ts, bulk-actions.ts, change-request-actions.ts]
- "lib_auth": "auth.ts" | kind=code-symbol | source=src/lib/auth.ts:L1 | neighbors=[actions.ts, comment-actions.ts, actions.ts, avatar-actions.ts, webauthn-actions.ts, 44b1c48 feat(auth): Continue with GitHu…]
- "ui_card": "card.tsx" | kind=code-symbol | source=src/components/ui/card.tsx:L1 | neighbors=[page.tsx, page.tsx, page.tsx, page.tsx, page.tsx, active-sprints.tsx]
- "components_meeting_intel_sheet": "meeting-intel-sheet.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-intel-sheet.tsx:L1 | neighbors=[671c254 ., add-to-calendar.tsx, AddToCalendarMenu(), meeting-chips.tsx, MetaChip(), meeting-form.tsx]
- "sprints_board_view": "board-view.ts" | kind=code-symbol | source=src/features/sprints/board-view.ts:L1 | neighbors=[change-request-appliers.ts, contribution-queries.ts, queries.ts, 94c35aa fix(tasks): un-rot the terminal…, a9d31f4 refactor(tasks): add isTerminal…, c2bc5fd refactor(tasks): route in-memor…]
- "apps_actions": "actions.ts" | kind=code-symbol | source=src/features/apps/actions.ts:L1 | neighbors=[bulk-actions.ts, log.ts, logActivity(), archiveApp(), closeOpenAppRoleInterval(), createApp()]
- "components_ai_meter_provider": "ai-meter-provider.tsx" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L1 | neighbors=[layout.tsx, 13be4b6 ., 9cd44c8 ., c5251d4 fix(gemini): six holes an adver…, d5b6409 ., f8a9b00 feat(gemini): the meter learns …]
- "lib_action_result_actionresult": "ActionResult" | kind=code-symbol | source=src/lib/action-result.ts:L1 | neighbors=[actions.ts, actions.ts, app-grant-actions.ts, audit-nl-actions.ts, bulk-actions.ts, change-request-actions.ts]
- "worklog_entry_evidence": "entry-evidence.ts" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L1 | neighbors=[5e32b09 fix(worklog): Fill my day ignor…, 6909ea3 feat(worklog): AI drafts the da…, de4812e feat(github): commits become wo…, entry-ai-actions.ts, index.ts, Db]
- "components_trash_card": "trash-card.tsx" | kind=code-symbol | source=src/features/admin/components/trash-card.tsx:L1 | neighbors=[bulk-logic.ts, BulkOutcome, headerSelectionState(), pruneSelection(), selectRange(), summarizeOutcomes()]
- "worklog_progress_queries": "progress-queries.ts" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L1 | neighbors=[a628b27 feat(worklog): the progress gri…, b35d96b fix(worklog): two hours reads c…, progress-apps-lane.tsx, progress-filters.tsx, progress-matrix.tsx, page.tsx]
- "admin_trash_actions": "trash-actions.ts" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L1 | neighbors=[danger-actions.ts, log.ts, logActivity(), appNameById(), checkConfirm(), isUniqueViolation()]
- "components_meeting_detail_dialog": "meeting-detail-dialog.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-detail-dialog.tsx:L1 | neighbors=[49350d6 feat(meetings): "Copy here" — t…, 514d33b feat(meetings): a meeting can b…, add-to-calendar.tsx, AddToCalendarMenu(), meeting-chips.tsx, MetaChip()]
- "signals_queries": "queries.ts" | kind=code-symbol | source=src/features/signals/queries.ts:L1 | neighbors=[007c37f ., d5b6409 ., signals-view.tsx, page.tsx, capabilities.ts, Actor]
- "apps_queries": "queries.ts" | kind=code-symbol | source=src/features/apps/queries.ts:L1 | neighbors=[page.tsx, app-health.ts, AppHealth, AppSprintSnapshot, AppTaskCounts, pickCurrentSprint()]
- "components_meeting_panels": "meeting-panels.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L1 | neighbors=[3c0bc01 ., meeting-intel.tsx, meeting-notes.tsx, broadcastPanelPrefs(), DensityToggle(), EMPTY_OPEN_MAP]
- "people_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/people/page.tsx:L1 | neighbors=[743b1f2 fix(ui): a false-positive tag m…, 8dd587b feat(people): filter and sort t…, queries.ts, listAllUsers(), queries.ts, AppPortfolioEntry]
- "worklog_catch_up_actions": "catch-up-actions.ts" | kind=code-symbol | source=src/features/worklog/catch-up-actions.ts:L1 | neighbors=[3ac9d68 ., 419d875 Unify worklog logging with AI c…, 9f936b5 Add app aliases and auto-scored…, log-box.tsx, actor.ts, loadActor]
- "intel_context_pack": "context-pack.ts" | kind=code-symbol | source=src/features/intel/context-pack.ts:L1 | neighbors=[0ef5105 fix(intel): a briefing priority…, 137eacc docs(intel): write down which a…, 1eb625d docs(intel): name the gap-list …, a1e0845 ., bddbb00 fix(intel): a day you already a…, actions.ts]
- "lib_action_result_err": "err()" | kind=code-symbol | source=src/lib/action-result.ts:L26 | neighbors=[actions.ts, actions.ts, app-grant-actions.ts, audit-nl-actions.ts, bulk-actions.ts, change-request-actions.ts]
- "lib_action_result_ok": "ok()" | kind=code-symbol | source=src/lib/action-result.ts:L20 | neighbors=[actions.ts, actions.ts, app-grant-actions.ts, audit-nl-actions.ts, bulk-actions.ts, change-request-actions.ts]
- "meetings_load_actions": "load-actions.ts" | kind=code-symbol | source=src/features/meetings/load-actions.ts:L1 | neighbors=[272f9a7 feat(meetings): store the decis…, e8e9934 refactor(tasks): query open wor…, load-board.tsx, meeting-load-link.tsx, context-pack.ts, page.tsx]
- "app_layout": "layout.tsx" | kind=code-symbol | source=src/app/layout.tsx:L1 | neighbors=[approval-queries.ts, countPendingApprovals, sections.ts, visibleSections(), AppLayout(), cabinet]
- "meetings_attendee_score": "attendee-score.ts" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L1 | neighbors=[232b7ef ., agenda-topics.ts, matchAgendaTopic(), AiRelevanceEvidence, AttendanceEvidence, CandidateFacts]
- "worklog_entry_ai_actions": "entry-ai-actions.ts" | kind=code-symbol | source=src/features/worklog/entry-ai-actions.ts:L1 | neighbors=[5e32b09 fix(worklog): Fill my day ignor…, 6909ea3 feat(worklog): AI drafts the da…, 9cd44c8 ., de4812e feat(github): commits become wo…, day-hours-card.tsx, day-panel.tsx]
- "components_app_form_dialog": "app-form-dialog.tsx" | kind=code-symbol | source=src/features/apps/components/app-form-dialog.tsx:L1 | neighbors=[page.tsx, 9f936b5 Add app aliases and auto-scored…, a4b271b Improve leave types and worklog…, d5b6409 ., actions.ts, createApp()]
- "components_capacity_heat_editable": "capacity-heat-editable.tsx" | kind=code-symbol | source=src/features/dashboard/components/capacity-heat-editable.tsx:L1 | neighbors=[de4cd09 feat(ui): a select you can type…, capacity-heat.tsx, capacity-bar.tsx, CapacityBar(), capacity-card.tsx, CapacityCard()]
- "components_org_holidays_card": "org-holidays-card.tsx" | kind=code-symbol | source=src/features/worklog/components/org-holidays-card.tsx:L1 | neighbors=[OrgHolidaysCard(), lk-holidays.ts, excusesWork(), LK_HOLIDAYS, toIsoDateInTimeZone(), utils.ts]
- "meeting_load_queries": "queries.ts" | kind=code-symbol | source=src/features/meeting-load/queries.ts:L1 | neighbors=[d933927 feat(meeting-load): reads that …, dashboard-zones.tsx, per-app-load.tsx, series-load-table.tsx, weekly-load-table.tsx, page.tsx]
- "meetings_notes": "notes.ts" | kind=code-symbol | source=src/features/meetings/notes.ts:L1 | neighbors=[3c0bc01 ., c2bc5fd refactor(tasks): route in-memor…, meeting-prep.tsx, note-timeline.tsx, page.tsx, ai-actions.ts]
- "meetings_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/meetings/page.tsx:L1 | neighbors=[232b7ef ., 473168b docs: restore the reasoning the…, 514d33b feat(meetings): a meeting can b…, 5c7efa5 feat(meeting-load): four surfac…, 671c254 ., 95b092e feat(meetings): quick note and …]
- "ui_card_card": "Card()" | kind=code-symbol | source=src/components/ui/card.tsx:L5 | neighbors=[page.tsx, page.tsx, page.tsx, page.tsx, page.tsx, active-sprints.tsx]
- "ui_card_cardcontent": "CardContent()" | kind=code-symbol | source=src/components/ui/card.tsx:L84 | neighbors=[page.tsx, page.tsx, page.tsx, page.tsx, page.tsx, active-sprints.tsx]
- "finance_queries": "queries.ts" | kind=code-symbol | source=src/features/finance/queries.ts:L1 | neighbors=[35d16f8 feat(finance): server layer for…, 3e134d4 fix(finance): project cost coun…, d5b6409 ., project-finance-card.tsx, actor.ts, requireCapability()]
- "ui_input": "input.tsx" | kind=code-symbol | source=src/components/ui/input.tsx:L1 | neighbors=[action-item-board.tsx, activity-filter-bar.tsx, add-user-dialog.tsx, app-form-dialog.tsx, approval-actions.tsx, apps-browser.tsx]
- "components_directory": "directory.tsx" | kind=code-symbol | source=src/features/people/components/directory.tsx:L1 | neighbors=[007c37f ., stat-number.tsx, StatNumber(), capabilities.ts, isAdminRole(), capacity-bar.tsx]
- "registry_commands": "commands.ts" | kind=code-symbol | source=src/features/search/registry/commands.ts:L1 | neighbors=[029ff45 feat(search): worklog and activ…, 3ba31df feat(shell): every admin sectio…, 8bacbca ., cbd4a9c feat(search): gemini joins the …, d5b6409 ., command-center.tsx]
- "settings_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/settings/page.tsx:L1 | neighbors=[232b7ef ., d407ccc fix(settings): give the AI sect…, capabilities.ts, isAdminRole(), roleLabel(), queries.ts]
- "components_history_views": "history-views.tsx" | kind=code-symbol | source=src/features/people/components/history-views.tsx:L1 | neighbors=[capacity-bar.tsx, CapacityBand, CapacityBar(), BAND_WORD, ClearFilterButton(), DeltaBadge()]
- "maintenance_window": "window.ts" | kind=code-symbol | source=src/features/maintenance/window.ts:L1 | neighbors=[8bacbca ., maintenance-banner.tsx, maintenance-chrome.ts, maintenance-controls.tsx, maintenance-details-dialog.tsx, maintenance-gate.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-001.json

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
