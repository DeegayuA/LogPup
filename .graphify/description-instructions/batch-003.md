# Node Description Batch 4 of 166

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

- "ui_badge_badge": "Badge()" | kind=code-symbol | source=src/components/ui/badge.tsx:L30 | neighbors=[active-sprints.tsx, activity-feed.tsx, ai-adoption-card.tsx, ai-engine-card.tsx, allocation-history-card.tsx, app-header.tsx]
- "ui_dialog": "dialog.tsx" | kind=code-symbol | source=src/components/ui/dialog.tsx:L1 | neighbors=[action-item-board.tsx, add-user-dialog.tsx, app-form-dialog.tsx, ask-bubble.tsx, assign-dialog.tsx, bug-csv-import-dialog.tsx]
- "worklog_auto_score_sync": "auto-score-sync.ts" | kind=code-symbol | source=src/features/worklog/auto-score-sync.ts:L1 | neighbors=[3ac9d68 ., 9f936b5 Add app aliases and auto-scored…, route.ts, actions.ts, index.ts, Db]
- "commit:repo:github.com/DeegayuA/LogPup@d5b64098f84c57a8da3d281b284a180e6117b538": "d5b6409 ." | kind=Commit | source=git | neighbors=[main, 3e134d4 fix(finance): project cost coun…, ai-meter-dock.tsx, ai-meter-provider.tsx, app-form-dialog.tsx, ask-panel.tsx]
- "components_activity_feed": "activity-feed.tsx" | kind=code-symbol | source=src/features/activity/components/activity-feed.tsx:L1 | neighbors=[d70c02b fix(ui): bilingual live text su…, describe.ts, activityFilterHref(), filters.ts, ActivityParamState, format.ts]
- "components_assignments_card": "assignments-card.tsx" | kind=code-symbol | source=src/features/people/components/assignments-card.tsx:L1 | neighbors=[047a7e7 feat(people): change someone's …, assign-dialog.tsx, AssignDialog(), APP_STATUS_LABEL, AssignmentsCard(), capacity-bar.tsx]
- "components_audit_trail": "audit-trail.tsx" | kind=code-symbol | source=src/features/admin/components/audit-trail.tsx:L1 | neighbors=[page.tsx, format.ts, activityPhraseParts(), audit-filters.ts, AUDIT_SORT_KEYS, AUDIT_SORT_LABELS]
- "gemini_ai_features": "ai-features.ts" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, 13be4b6 ., 419d875 Unify worklog logging with AI c…, 6909ea3 feat(worklog): AI drafts the da…, ai-adoption-card.tsx, ai-feature-toggle.tsx]
- "shell_sidebar": "sidebar.tsx" | kind=code-symbol | source=src/components/shell/sidebar.tsx:L1 | neighbors=[layout.tsx, 13be4b6 ., 232b7ef ., 3ba31df feat(shell): every admin sectio…, 3dcd417 feat(shell): collapse the sideb…, 473168b docs: restore the reasoning the…]
- "auth_capabilities_userrole": "UserRole" | kind=code-symbol | source=src/features/auth/capabilities.ts:L27 | neighbors=[actions.ts, bulk-actions.ts, change-request-routing.test.ts, queries.ts, sections.test.ts, actor.ts]
- "commit:repo:github.com/DeegayuA/LogPup@671c2549b42ea8b0c024427acb8221928bc2e614": "671c254 ." | kind=Commit | source=git | neighbors=[3c0bc01 ., layout.tsx, project-manager.ts, main, 9cd44c8 ., jump-to-date.tsx]
- "components_bug_list": "bug-list.tsx" | kind=code-symbol | source=src/features/bugs/components/bug-list.tsx:L1 | neighbors=[page.tsx, bug-display.ts, BUG_STATUSES, BugSeverity, bugSeverityBadgeVariant(), bugSeverityLabel()]
- "history_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/people/history/page.tsx:L1 | neighbors=[allocation-trend.tsx, AllocationTrend(), as-of-picker.tsx, AsOfPicker(), history-filters.tsx, HistoryFilters()]
- "home_hero_showcase": "hero-showcase.tsx" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L1 | neighbors=[264e022 fix(home): align three read sit…, 3d461b5 fix(home): derive advertised Ge…, 5d6c459 fix(home): resolve model rates …, 82d20fd docs(home): the KNOWN LIMIT par…, d0da911 test(gemini): a public page may…, capacity-bar.tsx]
- "people_actions": "actions.ts" | kind=code-symbol | source=src/features/people/actions.ts:L1 | neighbors=[assign-dialog.tsx, assignments-card.tsx, capacity-heat-editable.tsx, team-panel.tsx, log.ts, logActivity()]
- "people_iso_day": "iso-day.ts" | kind=code-symbol | source=src/features/people/iso-day.ts:L1 | neighbors=[format.ts, audit-filters.ts, activity-filter-bar.tsx, allocation-trend.tsx, as-of-picker.tsx, board-bulk-bar.tsx]
- "progress_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/progress/page.tsx:L1 | neighbors=[0ef5142 fix(ui): correctness, responsiv…, 232b7ef ., actor.ts, loadActor, capabilities.ts, effectiveGrant()]
- "components_meeting_notes_dialog": "meeting-notes-dialog.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-dialog.tsx:L1 | neighbors=[markdown-lite.tsx, MarkdownLite(), meeting-chips.tsx, ChipTone, MetaChip(), SectionHeading()]
- "lib_lk_holidays_toisodateintimezone": "toIsoDateInTimeZone()" | kind=code-symbol | source=src/lib/lk-holidays.ts:L125 | neighbors=[audit-nl-actions.ts, page.tsx, queries.ts, app-activity.tsx, board.tsx, meeting-list.tsx]
- "meetings_followups": "followups.ts" | kind=code-symbol | source=src/features/meetings/followups.ts:L1 | neighbors=[3c0bc01 ., 8d1b390 fix(i18n): Sinhala survives eve…, c2bc5fd refactor(tasks): route in-memor…, action-item-board.tsx, meeting-intel.tsx, meeting-notes.tsx]
- "ui_select": "select.tsx" | kind=code-symbol | source=src/components/ui/select.tsx:L1 | neighbors=[de4cd09 feat(ui): a select you can type…, action-item-board.tsx, activity-filter-bar.tsx, add-user-dialog.tsx, ai-model-select.tsx, app-form-dialog.tsx]
- "worklog_catch_up_parse": "catch-up-parse.ts" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L1 | neighbors=[3ac9d68 ., 419d875 Unify worklog logging with AI c…, 9f936b5 Add app aliases and auto-scored…, log-box.tsx, catch-up-actions.ts, catch-up-offline.ts]
- "admin_bulk_logic": "bulk-logic.ts" | kind=code-symbol | source=src/features/admin/bulk-logic.ts:L1 | neighbors=[bulk-actions.ts, BulkNouns, BulkOutcome, BulkReport, bulkResultTone(), BulkSkip]
- "bugs_queries": "queries.ts" | kind=code-symbol | source=src/features/bugs/queries.ts:L1 | neighbors=[actions.ts, page.tsx, bug-display.ts, BugSeverity, BugStatus, OPEN_BUG_STATUSES]
- "commit:repo:github.com/DeegayuA/LogPup@9f936b5a5ed41bd523fea9cf6290a4aa85c70ce5": "9f936b5 Add app aliases and auto-scored worklog flow" | kind=Commit | source=git | neighbors=[419d875 Unify worklog logging with AI c…, page.tsx, page.tsx, app-aliases.ts, app-aliases.test.ts, create-input.ts]
- "components_ai_meter_dock": "ai-meter-dock.tsx" | kind=code-symbol | source=src/features/gemini/components/ai-meter-dock.tsx:L1 | neighbors=[007c37f ., 13be4b6 ., 9cd44c8 ., a4b271b Improve leave types and worklog…, c5251d4 fix(gemini): six holes an adver…, d5b6409 .]
- "components_meeting_people_picker": "meeting-people-picker.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker.tsx:L1 | neighbors=[f823a54 feat(meetings): correct a mishe…, action-item-board.tsx, attribution-inline.tsx, meeting-intel.tsx, MeetingPeopleMultiPicker(), MeetingPeoplePicker()]
- "deadlines_import_actions": "import-actions.ts" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L1 | neighbors=[7d54694 feat(db): the work substrate, a…, cdc541d feat(deadlines): let a PM uploa…, log.ts, logActivity(), actor.ts, requireCapability()]
- "intel_signals": "signals.ts" | kind=code-symbol | source=src/features/intel/signals.ts:L1 | neighbors=[a1e0845 ., intel-view.tsx, signal-board.tsx, actions.ts, briefing-fallback.ts, briefing-fallback.test.ts]
- "meetings_text_replace_actions": "text-replace-actions.ts" | kind=code-symbol | source=src/features/meetings/text-replace-actions.ts:L1 | neighbors=[f823a54 feat(meetings): correct a mishe…, correct-selection.tsx, meeting-notes.tsx, note-timeline.tsx, replace-review-dialog.tsx, log.ts]
- "profile_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/profile/page.tsx:L1 | neighbors=[de4812e feat(github): commits become wo…, capabilities.ts, isAdminRole(), roleLabel(), queries.ts, getOwnAvatarUrl()]
- "search_actions": "actions.ts" | kind=code-symbol | source=src/features/search/actions.ts:L1 | neighbors=[commands.ts, 2865231 feat(deadlines): route all thre…, command-center.tsx, index.ts, Db, live.ts]
- "ui_avatar": "avatar.tsx" | kind=code-symbol | source=src/components/ui/avatar.tsx:L1 | neighbors=[activity-feed.tsx, app-activity.tsx, app-card.tsx, app-comments.tsx, app-contributions.tsx, avatar-upload.tsx]
- "ui_skeleton": "skeleton.tsx" | kind=code-symbol | source=src/components/ui/skeleton.tsx:L1 | neighbors=[loading.tsx, loading.tsx, page.tsx, loading.tsx, activity-skeleton.tsx, ask-panel.tsx]
- "worklog_absence_actions": "absence-actions.ts" | kind=code-symbol | source=src/features/worklog/absence-actions.ts:L1 | neighbors=[24fb822 fix(worklog): two absence write…, 419d875 Unify worklog logging with AI c…, a4b271b Improve leave types and worklog…, c9a2906 Centralize absence kinds and ad…, approval-actions.tsx, declare-absence-dialog.tsx]
- "activity_log": "log.ts" | kind=code-symbol | source=src/features/activity/log.ts:L1 | neighbors=[logActivity(), types.ts, ActivityInput, index.ts, Db, schema.ts]
- "admin_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/admin/page.tsx:L1 | neighbors=[approval-badge.ts, approvalTotal(), approval-queries.ts, countPendingApprovals, AdminOverviewPage(), AdoptionSkeleton()]
- "admin_trash_grouping": "trash-grouping.ts" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L1 | neighbors=[danger-actions.ts, danger-actions.test.ts, danger-logic.ts, danger-logic.test.ts, buildAppTrashRow(), buildAssignmentTrashRow()]
- "components_ai_features_card": "ai-features-card.tsx" | kind=code-symbol | source=src/features/gemini/components/ai-features-card.tsx:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, ai-feature-toggle.tsx, AiFeatureToggle(), AiFeaturesCard(), describeUsage(), suggestModelFor()]
- "components_bug_csv_import_dialog": "bug-csv-import-dialog.tsx" | kind=code-symbol | source=src/features/bugs/components/bug-csv-import-dialog.tsx:L1 | neighbors=[b0692bd fix(bugs): the template is not …, bug-csv.ts, BUG_CSV_COLUMNS, BUG_CSV_EXAMPLE_ROW, BUG_CSV_HEADERS, bug-display.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-003.json

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
