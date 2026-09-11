# Node Description Batch 16 of 166

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

- "admin_sections": "sections.ts" | kind=code-symbol | source=src/features/admin/sections.ts:L1 | neighbors=[layout.tsx, page.tsx, ADMIN_SECTIONS, AdminSection, visibleSections(), capabilities.ts]
- "admin_trash_actions_revalidatetrashpaths": "revalidateTrashPaths()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L93 | neighbors=[trash-actions.ts, purgeApp(), purgeKeyframe(), purgeSegment(), purgeSprint(), restoreApp()]
- "admin_trash_grouping_test": "trash-grouping.test.ts" | kind=code-symbol | source=src/features/admin/trash-grouping.test.ts:L1 | neighbors=[trash-grouping.ts, buildAssignmentTrashRow(), buildKeyframeTrashRow(), buildMeetingTrashRow(), buildPersonTrashRow(), buildSegmentTrashRow()]
- "auth_queries": "queries.ts" | kind=code-symbol | source=src/features/auth/queries.ts:L1 | neighbors=[layout.tsx, getOwnAvatarUrl(), getOwnGithubLogin(), getOwnPhone(), getOwnTitle(), index.ts]
- "commit:repo:github.com/DeegayuA/LogPup@3ba31df8c631df6eb5f6ff711333f3b1ee39492f": "3ba31df feat(shell): every admin section in the sidebar, and a count on Approva…" | kind=Commit | source=git | neighbors=[approval-badge.ts, approval-badge.test.ts, approval-queries.ts, layout.tsx, layout.tsx, main]
- "commit:repo:github.com/DeegayuA/LogPup@9cd44c8ccfa743488fe491f953ef24c9a2f2a342": "9cd44c8 ." | kind=Commit | source=git | neighbors=[671c254 ., main, a4b271b Improve leave types and worklog…, ai-meter-dock.tsx, ai-meter-provider.tsx, meter-retry.test.ts]
- "components_activity_trail_pager": "activity-trail-pager.tsx" | kind=code-symbol | source=src/features/activity/components/activity-trail-pager.tsx:L1 | neighbors=[page.tsx, actions.ts, loadOlderActivity(), filters.ts, activityParams(), ActivityParamState]
- "components_approval_actions": "approval-actions.tsx" | kind=code-symbol | source=src/features/admin/components/approval-actions.tsx:L1 | neighbors=[page.tsx, page.tsx, change-request-actions.ts, approveChangeRequest(), rejectChangeRequest(), ApprovalActions()]
- "components_bulk_bar": "bulk-bar.tsx" | kind=code-symbol | source=src/features/admin/components/bulk-bar.tsx:L1 | neighbors=[apps-table.tsx, bulk-logic.ts, BulkNouns, BulkReport, bulkResultTone(), describeBulkResult()]
- "components_danger_meeting_delete_card": "danger-meeting-delete-card.tsx" | kind=code-symbol | source=src/features/admin/components/danger-meeting-delete-card.tsx:L1 | neighbors=[b33670d feat(ui): make the three select…, danger-actions.ts, deleteMeetingFromDanger(), danger-logic.ts, deleteMeetingPhrase(), deleteMeetingSummary()]
- "components_dictate_button": "dictate-button.tsx" | kind=code-symbol | source=src/features/speech/components/dictate-button.tsx:L1 | neighbors=[d5b6409 ., activity-filter-bar.tsx, DictateButton(), use-dictation.ts, useDictation(), utils.ts]
- "components_health_dot": "health-dot.tsx" | kind=code-symbol | source=src/features/apps/components/health-dot.tsx:L1 | neighbors=[app-card.tsx, app-header.tsx, cohort-views.tsx, dashboard-zones.tsx, app-health.ts, AppHealth]
- "components_jump_to_date": "jump-to-date.tsx" | kind=code-symbol | source=src/features/meetings/components/jump-to-date.tsx:L1 | neighbors=[671c254 ., JumpToDate(), calendar-view.ts, isoToDisplayDate(), button.tsx, Button()]
- "components_live_transcription_status": "live-transcription-status.tsx" | kind=code-symbol | source=src/features/transcription/components/live-transcription-status.tsx:L1 | neighbors=[LiveTranscriptionCostNotice(), LiveTranscriptionStatus(), STATUS_COPY, StatusIcon(), live-client.ts, LiveStatus]
- "components_maintenance_mount": "maintenance-mount.tsx" | kind=code-symbol | source=src/features/maintenance/components/maintenance-mount.tsx:L1 | neighbors=[layout.tsx, 8bacbca ., capabilities.ts, UserRole, maintenance-gate.tsx, MaintenanceGate()]
- "components_meeting_form_meetingform": "MeetingForm()" | kind=code-symbol | source=src/features/meetings/components/meeting-form.tsx:L261 | neighbors=[load-board.tsx, meeting-detail-dialog.tsx, meeting-form.tsx, describeQuickAdd(), quickAddProblems(), meeting-header-actions.tsx]
- "components_meeting_glance_test": "meeting-glance.test.ts" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.test.ts:L1 | neighbors=[671c254 ., meeting-glance.ts, AttendeeResponse, durationLabel(), isAwaitingViewerRsvp(), MeetingTiming]
- "components_sprint_switcher": "sprint-switcher.tsx" | kind=code-symbol | source=src/features/sprints/components/sprint-switcher.tsx:L1 | neighbors=[shortRange(), SprintSwitcher(), STATUS_DOT, STATUS_LABEL, SwitcherSprint, utils.ts]
- "components_use_screen_keyframes": "use-screen-keyframes.ts" | kind=code-symbol | source=src/features/meetings/components/use-screen-keyframes.ts:L1 | neighbors=[meeting-intel.tsx, encodeFrame(), hashOfFrame(), ScreenKeyframesHandle, useScreenKeyframes(), ai-actions.ts]
- "db_schema_meetingapps": "meetingApps" | kind=code-symbol | source=src/db/schema.ts:L1935 | neighbors=[backup.ts, activity-queries.ts, queries.ts, schema.ts, gather.ts, actions.ts]
- "db_write_gate": "write-gate.ts" | kind=code-symbol | source=src/db/write-gate.ts:L1 | neighbors=[8bacbca ., index.ts, assertWritable(), FREEZE_EXEMPT_TABLES, gateBatch(), gated]
- "deactivated_page": "page.tsx" | kind=code-symbol | source=src/app/deactivated/page.tsx:L1 | neighbors=[DeactivatedPage(), metadata, auth.ts, session.ts, getSession, brand-mark.tsx]
- "gemini_ai_features_aifeatureid": "AiFeatureId" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L331 | neighbors=[ai-feature-toggle.tsx, ai-meter-provider.tsx, ai-model-select.tsx, ai-engine.ts, ai-engine.test.ts, actions.ts]
- "gemini_ai_features_test": "ai-features.test.ts" | kind=code-symbol | source=src/features/gemini/ai-features.test.ts:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, ai-features.ts, AiFeatureEstimate, estimatePerUseCostUsd(), FALLBACK_MODEL_CHOICES, featureForSlug()]
- "gemini_budget": "budget.ts" | kind=code-symbol | source=src/features/gemini/budget.ts:L1 | neighbors=[59873cc feat(gemini): a monthly AI budg…, Budget, BudgetInput, budgetLadderStep(), budgetMonth(), BudgetState]
- "gemini_usage": "usage.ts" | kind=code-symbol | source=src/features/gemini/usage.ts:L1 | neighbors=[59873cc feat(gemini): a monthly AI budg…, d5b6409 ., client.ts, index.ts, Db, schema.ts]
- "github_app_client": "app-client.ts" | kind=code-symbol | source=src/features/github/app-client.ts:L1 | neighbors=[de4812e feat(github): commits become wo…, appJwt(), b64url(), commitsByAuthor(), gh(), installationToken()]
- "lib_escalation": "escalation.ts" | kind=code-symbol | source=src/lib/escalation.ts:L1 | neighbors=[e432241 feat(deadlines): the escalation…, DONE_STATUSES, EscalationInput, EscalationStep, nextDay(), notificationKindFor()]
- "lib_field_reconcile": "field-reconcile.ts" | kind=code-symbol | source=src/lib/field-reconcile.ts:L1 | neighbors=[050a921 feat(calendar): classify a two-…, asSet(), AttendeeMerge, FIELD_REASON_SENTENCE, FieldDecision, FieldReason]
- "meeting_load_load_math": "load-math.ts" | kind=code-symbol | source=src/features/meeting-load/load-math.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, admin-queries.ts, gather.ts, AttendeeResponse, invitedHoursFor(), OccurrenceHoursInput]
- "meetings_ai_actions_getmeetingintel": "getMeetingIntel()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2000 | neighbors=[meeting-intel.tsx, meeting-notes-dialog.tsx, page.tsx, ai-actions.ts, asArray(), canReadMeetingIntel()]
- "meetings_recurrence_expand": "expand()" | kind=code-symbol | source=src/features/meetings/recurrence.ts:L153 | neighbors=[recurrence.ts, dayNumber(), daysInMonth(), isoFromDayNumber(), isoOf(), monthIndex()]
- "meetings_visibility": "visibility.ts" | kind=code-symbol | source=src/features/meetings/visibility.ts:L1 | neighbors=[514d33b feat(meetings): a meeting can b…, route.ts, glance-actions.ts, queries.ts, search-providers.ts, index.ts]
- "notifications_notify_createnotifications": "createNotifications()" | kind=code-symbol | source=src/features/notifications/notify.ts:L89 | neighbors=[comment-actions.ts, budget-notify.ts, lifecycle.ts, actions.ts, ai-actions.ts, notify.ts]
- "notifications_notify_rules_test": "notify-rules.test.ts" | kind=code-symbol | source=src/features/notifications/notify-rules.test.ts:L1 | neighbors=[8d28f33 feat(notifications): dedupe, a …, capabilities.ts, Actor, UserRole, notify-rules.ts, applyDailyCap()]
- "notifications_retention": "retention.ts" | kind=code-symbol | source=src/features/notifications/retention.ts:L1 | neighbors=[c93474b feat(notifications): a schedule…, assertUsable(), DEFAULT_RETENTION_POLICY, planRetention(), PruneReason, RetentionCandidate]
- "path_route": "route.ts" | kind=code-symbol | source=src/app/api/meeting-keyframes/[...path]/route.ts:L1 | neighbors=[capabilities.ts, isAdminRole(), index.ts, Db, schema.ts, meetings]
- "people_capacity_compare_test": "capacity-compare.test.ts" | kind=code-symbol | source=src/features/people/capacity-compare.test.ts:L1 | neighbors=[allocation-history.ts, HistoryRow, capacity-compare.ts, appLoadRows(), CapacitySnapshotEntry, ChurnCounts]
- "people_summary": "summary.ts" | kind=code-symbol | source=src/features/people/summary.ts:L1 | neighbors=[13be4b6 ., 41d5428 feat(people): the short read on…, a4b271b Improve leave types and worklog…, person-summary-card.tsx, page.tsx, buildPersonSummaryPrompt()]
- "people_team_csv_test": "team-csv.test.ts" | kind=code-symbol | source=src/features/people/team-csv.test.ts:L1 | neighbors=[1eedff1 feat(people): a project's team …, bulk-logic.ts, toCsv(), team-csv.ts, employmentLabel(), projectPosition()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-015.json

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
