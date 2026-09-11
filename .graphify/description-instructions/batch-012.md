# Node Description Batch 13 of 166

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

- "shell_nav_items": "nav-items.ts" | kind=code-symbol | source=src/components/shell/nav-items.ts:L1 | neighbors=[page.tsx, 3ba31df feat(shell): every admin sectio…, bee388b feat(intel): fold the page into…, command-center.tsx, commands.ts, nav.ts]
- "signals_observe": "observe.ts" | kind=code-symbol | source=src/features/signals/observe.ts:L1 | neighbors=[d5b6409 ., corroborate.ts, corroborate.test.ts, ActivityRow, classifyActivity(), ExternalWitness]
- "sprints_checkins": "checkins.ts" | kind=code-symbol | source=src/features/sprints/checkins.ts:L1 | neighbors=[c2bc5fd refactor(tasks): route in-memor…, meeting-prep.tsx, plan-read-strip.tsx, sprint-checkin-editor.tsx, sprint-checkins.tsx, ask-derivation.ts]
- "ui_alert_dialog_alertdialog": "AlertDialog()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L9 | neighbors=[apps-table.tsx, assignments-card.tsx, gemini-keys-card.tsx, meeting-detail-dialog.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx]
- "ui_alert_dialog_alertdialogaction": "AlertDialogAction()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L144 | neighbors=[apps-table.tsx, assignments-card.tsx, gemini-keys-card.tsx, meeting-detail-dialog.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx]
- "ui_alert_dialog_alertdialogcancel": "AlertDialogCancel()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L157 | neighbors=[apps-table.tsx, assignments-card.tsx, gemini-keys-card.tsx, meeting-detail-dialog.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx]
- "ui_alert_dialog_alertdialogcontent": "AlertDialogContent()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L41 | neighbors=[apps-table.tsx, assignments-card.tsx, gemini-keys-card.tsx, meeting-detail-dialog.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx]
- "ui_alert_dialog_alertdialogdescription": "AlertDialogDescription()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L128 | neighbors=[apps-table.tsx, assignments-card.tsx, gemini-keys-card.tsx, meeting-detail-dialog.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx]
- "ui_alert_dialog_alertdialogfooter": "AlertDialogFooter()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L80 | neighbors=[apps-table.tsx, assignments-card.tsx, gemini-keys-card.tsx, meeting-detail-dialog.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx]
- "ui_alert_dialog_alertdialogheader": "AlertDialogHeader()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L64 | neighbors=[apps-table.tsx, assignments-card.tsx, gemini-keys-card.tsx, meeting-detail-dialog.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx]
- "ui_alert_dialog_alertdialogtitle": "AlertDialogTitle()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L112 | neighbors=[apps-table.tsx, assignments-card.tsx, gemini-keys-card.tsx, meeting-detail-dialog.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx]
- "ui_card_cardaction": "CardAction()" | kind=code-symbol | source=src/components/ui/card.tsx:L71 | neighbors=[active-sprints.tsx, allocation-history-card.tsx, app-role-history-card.tsx, assignments-card.tsx, capacity-card.tsx, cohort-views.tsx]
- "activity_format": "format.ts" | kind=code-symbol | source=src/features/activity/format.ts:L1 | neighbors=[ActivityDayGroup, activityDaySummary(), ActivityEntry, activityPhrase(), activityPhraseParts(), groupActivityBursts()]
- "admin_approval_queries": "approval-queries.ts" | kind=code-symbol | source=src/features/admin/approval-queries.ts:L1 | neighbors=[approval-badge.ts, ApprovalCounts, NO_APPROVALS, countPendingApprovals, change-request-queries.ts, getApprovalsInbox()]
- "admin_bulk_logic_test": "bulk-logic.test.ts" | kind=code-symbol | source=src/features/admin/bulk-logic.test.ts:L1 | neighbors=[bulk-logic.ts, BulkOutcome, bulkResultTone(), csvCell(), csvFilename(), describeBulkResult()]
- "admin_clear_test_data_test": "clear-test-data.test.ts" | kind=code-symbol | source=src/features/admin/clear-test-data.test.ts:L1 | neighbors=[actions.ts, asSuperadmin(), { authMock, deleteSpy }, confirmForm(), deletedTables(), schema.ts]
- "auth_avatar_actions": "avatar-actions.ts" | kind=code-symbol | source=src/features/auth/avatar-actions.ts:L1 | neighbors=[log.ts, logActivity(), ALLOWED_TYPES, deleteUploadedAvatar(), removeOwnAvatar(), uploadOwnAvatar()]
- "commit:repo:github.com/DeegayuA/LogPup@13be4b61b2f5979448d1eb03f148ef23db01e19c": "13be4b6 ." | kind=Commit | source=git | neighbors=[main, bug-csv.ts, b0692bd fix(bugs): the template is not …, ai-meter-dock.tsx, ai-meter-provider.tsx, ai-features.ts]
- "commit:repo:github.com/DeegayuA/LogPup@a1e0845be568842cdedb88da00ca4125bcba2552": "a1e0845 ." | kind=Commit | source=git | neighbors=[main, de48f5b feat(meetings): a page that say…, load-board.tsx, meeting-form.tsx, meeting-load-link.tsx, briefing-fallback.ts]
- "commit:repo:github.com/DeegayuA/LogPup@f823a54001024ff03c9d109802cd5a0c2e663909": "f823a54 feat(meetings): correct a misheard word everywhere by selecting it" | kind=Commit | source=git | neighbors=[5e11dbf docs(plan): WS0 terminal-status…, main, a9d31f4 refactor(tasks): add isTerminal…, action-item-board.tsx, correct-selection.tsx, meeting-intel.tsx]
- "components_ai_meter_provider_meterorigin": "meterOrigin()" | kind=code-symbol | source=src/features/gemini/components/ai-meter-provider.tsx:L135 | neighbors=[ai-meter-provider.tsx, originPoint(), app-form-dialog.tsx, ask-panel.tsx, audit-ask.tsx, catch-up-panel.tsx]
- "components_audit_ask": "audit-ask.tsx" | kind=code-symbol | source=src/features/admin/components/audit-ask.tsx:L1 | neighbors=[d5b6409 ., audit-filters.ts, AuditParamState, auditQueryString(), audit-nl-actions.ts, askAuditFilters()]
- "components_danger_confirm_control": "danger-confirm-control.tsx" | kind=code-symbol | source=src/features/admin/components/danger-confirm-control.tsx:L1 | neighbors=[danger-app-reset-card.tsx, danger-backup-card.tsx, danger-logic.ts, BlastRadius, matchesConfirm(), BlastRadiusLists()]
- "components_logged_days_list": "logged-days-list.tsx" | kind=code-symbol | source=src/features/worklog/components/logged-days-list.tsx:L1 | neighbors=[3ac9d68 ., 9f936b5 Add app aliases and auto-scored…, LoggedDay, LoggedDaysList(), meeting-chips.tsx, utils.ts]
- "components_meeting_load_card": "meeting-load-card.tsx" | kind=code-symbol | source=src/features/meeting-load/components/meeting-load-card.tsx:L1 | neighbors=[5c7efa5 feat(meeting-load): four surfac…, dashboard-zones.tsx, MeetingLoadCard(), meeting-load-trend.tsx, MeetingLoadTrend(), trend-points.ts]
- "components_meeting_people_picker_model_test": "meeting-people-picker-model.test.ts" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.test.ts:L1 | neighbors=[f823a54 feat(meetings): correct a mishe…, meeting-people-picker-model.ts, buildPeopleOptions(), buildPeoplePool(), fromPickerValue(), groupPeopleOptions()]
- "components_notifications_card": "notifications-card.tsx" | kind=code-symbol | source=src/features/dashboard/components/notifications-card.tsx:L1 | neighbors=[8bacbca ., dashboard-zones.tsx, ICONS, NotificationsCard(), RowBody(), utils.ts]
- "components_phone_field": "phone-field.tsx" | kind=code-symbol | source=src/features/auth/components/phone-field.tsx:L1 | neighbors=[actions.ts, setOwnPhone(), PhoneField(), button.tsx, Button(), card.tsx]
- "components_recent_activity_card": "recent-activity-card.tsx" | kind=code-symbol | source=src/features/dashboard/components/recent-activity-card.tsx:L1 | neighbors=[dashboard-zones.tsx, types.ts, ActivityRow, activity-feed.tsx, ActivityFeed(), RecentActivityCard()]
- "components_trash_card_logic": "trash-card-logic.ts" | kind=code-symbol | source=src/features/admin/components/trash-card-logic.ts:L1 | neighbors=[danger-actions.ts, trash-actions.ts, trash-actions.test.ts, trash-card.tsx, trash-grouping.ts, TrashGroup]
- "dashboard_zones_test": "zones.test.ts" | kind=code-symbol | source=src/features/dashboard/zones.test.ts:L1 | neighbors=[104afee feat(dashboard): the dashboard …, capabilities.ts, Actor, EmploymentType, USER_ROLES, UserRole]
- "db_schema_sprints": "sprints" | kind=code-symbol | source=src/db/schema.ts:L429 | neighbors=[actions.ts, backup.ts, change-request-appliers.ts, clear-test-data.test.ts, danger-actions.ts, danger-actions.test.ts]
- "gemini_client_callgemini": "callGemini()" | kind=code-symbol | source=src/features/gemini/client.ts:L288 | neighbors=[audit-nl-actions.ts, actions.ts, client.ts, callGeminiCore(), resolveModelChain(), callGeminiWithAudio()]
- "gemini_meter_pace": "meter-pace.ts" | kind=code-symbol | source=src/features/gemini/meter-pace.ts:L1 | neighbors=[f8a9b00 feat(gemini): the meter learns …, ai-meter-provider.tsx, ai-meter.ts, ai-features.ts, AiFeatureId, DurationHistory]
- "intel_prompt": "prompt.ts" | kind=code-symbol | source=src/features/intel/prompt.ts:L1 | neighbors=[0ef5105 fix(intel): a briefing priority…, briefing-card.tsx, actions.ts, answer-links.ts, context-pack.ts, AskPromptInput]
- "intel_signals_test": "signals.test.ts" | kind=code-symbol | source=src/features/intel/signals.test.ts:L1 | neighbors=[a1e0845 ., signals.ts, buildSignals(), capacitySignals(), mergeableMeetingSignal(), overdueTaskSignal()]
- "lib_recurrence": "recurrence.ts" | kind=code-symbol | source=src/lib/recurrence.ts:L1 | neighbors=[924eca4 feat(calendar): expand a daily …, addDays(), at(), describeRecurrence(), ExpandOptions, expandRecurrence()]
- "lib_working_days": "working-days.ts" | kind=code-symbol | source=src/lib/working-days.ts:L1 | neighbors=[fortnight.tsx, signals.ts, escalation.ts, recurrence.ts, lk-holidays.ts, isMercantileHoliday()]
- "meetings_attendee_score_scorecandidate": "scoreCandidate()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L1041 | neighbors=[attendee-score.ts, daysBetween(), fmtDayMonth(), maxTier(), meaningfulTokenCount(), renderCaveat()]
- "meetings_glance_actions_test": "glance-actions.test.ts" | kind=code-symbol | source=src/features/meetings/glance-actions.test.ts:L1 | neighbors=[671c254 ., meeting-notes-model.ts, glanceFromIntel(), analyzedAt, followup(), meeting()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-012.json

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
