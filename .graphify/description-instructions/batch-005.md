# Node Description Batch 6 of 166

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

- "components_assign_dialog": "assign-dialog.tsx" | kind=code-symbol | source=src/features/people/components/assign-dialog.tsx:L1 | neighbors=[047a7e7 feat(people): change someone's …, b33670d feat(ui): make the three select…, AssignDialog(), AssignSubject, job-roles.ts, JOB_ROLES]
- "components_meeting_panels_model": "meeting-panels-model.ts" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L1 | neighbors=[meeting-intel.tsx, meeting-notes.tsx, meeting-notes-dialog.tsx, meeting-panels.tsx, ActiveFilters, clearFilters()]
- "components_progress_apps_lane": "progress-apps-lane.tsx" | kind=code-symbol | source=src/features/worklog/components/progress-apps-lane.tsx:L1 | neighbors=[tabs.ts, appTabHref(), initials(), noon(), ProgressAppsLane(), ProgressAppsLaneSkeleton()]
- "components_speaker_assignment": "speaker-assignment.tsx" | kind=code-symbol | source=src/features/meetings/components/speaker-assignment.tsx:L1 | neighbors=[PendingAssignment, SpeakerAssignment(), SpeakerAssignmentPanel(), SpeakerLabelChip(), job-roles.ts, JOB_ROLES]
- "dashboard_ai_engine": "ai-engine.ts" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, ai-engine-card.tsx, dashboard-zones.tsx, AiEngineRow, AiEngineTotals, buildAiEngineRows()]
- "gemini_model_choice": "model-choice.ts" | kind=code-symbol | source=src/features/gemini/model-choice.ts:L1 | neighbors=[audit-nl-actions.ts, actions.ts, 13be4b6 ., 419d875 Unify worklog logging with AI c…, 6909ea3 feat(worklog): AI drafts the da…, de4812e feat(github): commits become wo…]
- "admin_change_request_appliers": "change-request-appliers.ts" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L1 | neighbors=[change-request-actions.ts, asIsoDate(), asTaskStatus(), buildApplyStatement(), buildTaskDeadlineSet(), buildTaskStatusSet()]
- "admin_trash_queries": "trash-queries.ts" | kind=code-symbol | source=src/features/admin/trash-queries.ts:L1 | neighbors=[danger-actions.ts, page.tsx, trash-grouping.ts, buildAppTrashRow(), buildAssignmentTrashRow(), buildBugTrashRow()]
- "auth_capabilities_isadminrole": "isAdminRole()" | kind=code-symbol | source=src/features/auth/capabilities.ts:L442 | neighbors=[layout.tsx, actions.ts, commands.ts, page.tsx, capabilities.ts, capabilities.test.ts]
- "bugs_bug_display": "bug-display.ts" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L1 | neighbors=[actions.ts, bug-csv.ts, bug-csv.test.ts, BUG_SEVERITIES, BUG_STATUSES, BugBadgeVariant]
- "components_apps_browser": "apps-browser.tsx" | kind=code-symbol | source=src/features/apps/components/apps-browser.tsx:L1 | neighbors=[page.tsx, e594a52 feat(apps): each app carries it…, browse.ts, APP_SORTS, APP_STATUS_FILTERS, browseHref()]
- "gemini_meter_actions": "meter-actions.ts" | kind=code-symbol | source=src/features/gemini/meter-actions.ts:L1 | neighbors=[13be4b6 ., d5b6409 ., ai-meter-dock.tsx, ai-meter-provider.tsx, index.ts, Db]
- "home_plates": "plates.tsx" | kind=code-symbol | source=src/app/(public)/home/plates.tsx:L1 | neighbors=[d0da911 test(gemini): a public page may…, page.tsx, capacity-bar.tsx, CapacityBand, CapacityBar(), meeting-chips.tsx]
- "meetings_coverage": "coverage.ts" | kind=code-symbol | source=src/features/meetings/coverage.ts:L1 | neighbors=[c2f2819 feat(meetings): work out which …, working-days.ts, WorkingDayFraction, attendee-score.ts, better(), Candidate]
- "people_handover_queries": "handover-queries.ts" | kind=code-symbol | source=src/features/people/handover-queries.ts:L1 | neighbors=[actions.ts, e8e9934 refactor(tasks): query open wor…, handover-form.tsx, page.tsx, capabilities.ts, Actor]
- "ui_avatar_avatar": "Avatar()" | kind=code-symbol | source=src/components/ui/avatar.tsx:L8 | neighbors=[activity-feed.tsx, app-activity.tsx, app-card.tsx, app-comments.tsx, app-contributions.tsx, avatar-upload.tsx]
- "ui_avatar_avatarfallback": "AvatarFallback()" | kind=code-symbol | source=src/components/ui/avatar.tsx:L48 | neighbors=[activity-feed.tsx, app-activity.tsx, app-card.tsx, app-comments.tsx, app-contributions.tsx, avatar-upload.tsx]
- "worklog_entry_language": "entry-language.ts" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L1 | neighbors=[8e5308d feat(worklog): one grammar for …, 8fa8f26 feat(worklog): the whole day in…, 9f936b5 Add app aliases and auto-scored…, day-hours-card.tsx, day-one-line.tsx, entry-grammar-help.tsx]
- "activity_log_logactivity": "logActivity()" | kind=code-symbol | source=src/features/activity/log.ts:L16 | neighbors=[log.ts, actions.ts, app-grant-actions.ts, danger-actions.ts, trash-actions.ts, actions.ts]
- "auth_actor_loadactor": "loadActor" | kind=code-symbol | source=src/features/auth/actor.ts:L42 | neighbors=[page.tsx, change-request-actions.ts, layout.tsx, page.tsx, layout.tsx, page.tsx]
- "components_briefing_card": "briefing-card.tsx" | kind=code-symbol | source=src/features/intel/components/briefing-card.tsx:L1 | neighbors=[0ef5105 fix(intel): a briefing priority…, 966d695 feat(intel): the briefing uses …, d78a3e1 fix(intel): the briefing links …, ai-meter-provider.tsx, useAiMeter(), BriefingBodyPending()]
- "components_capacity_card": "capacity-card.tsx" | kind=code-symbol | source=src/features/dashboard/components/capacity-card.tsx:L1 | neighbors=[stat-number.tsx, StatNumber(), capacity-bar.tsx, CapacityBand, CapacityCard(), CapacityEmpty()]
- "components_handover_form": "handover-form.tsx" | kind=code-symbol | source=src/features/people/components/handover-form.tsx:L1 | neighbors=[ACTION_MOVES, HandoverForm(), MANUAL_NOTE, utils.ts, cn(), as-of-date.ts]
- "components_meeting_prep": "meeting-prep.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-prep.tsx:L1 | neighbors=[meeting-intel.tsx, meeting-chips.tsx, MetaChip(), SectionHeading(), SkeletonBlock(), CheckinLine()]
- "components_person_tasks_card": "person-tasks-card.tsx" | kind=code-symbol | source=src/features/people/components/person-tasks-card.tsx:L1 | neighbors=[dashboard-zones.tsx, DUE_DOT, DUE_TONE, dueSuffix(), formatDueDate(), PersonTasksCard()]
- "components_replace_review_dialog": "replace-review-dialog.tsx" | kind=code-symbol | source=src/features/meetings/components/replace-review-dialog.tsx:L1 | neighbors=[f823a54 feat(meetings): correct a mishe…, meeting-notes.tsx, note-timeline.tsx, defaultSelection(), keyOf(), KIND_WORD]
- "components_worklog_calendar": "worklog-calendar.tsx" | kind=code-symbol | source=src/features/worklog/components/worklog-calendar.tsx:L1 | neighbors=[0ef5142 fix(ui): correctness, responsiv…, 58b4984 fix(worklog): the team grid sto…, 89dee50 fix(ui): craft regressions the …, e8b2ac2 feat(worklog): hours you logged…, CalendarDayFacts, LEGEND_LABEL]
- "db_live_livetasks": "liveTasks" | kind=code-symbol | source=src/db/live.ts:L47 | neighbors=[danger-actions.ts, danger-actions.test.ts, activity-queries.ts, contribution-queries.ts, queries.ts, live.ts]
- "meetings_followup_move_actions": "followup-move-actions.ts" | kind=code-symbol | source=src/features/meetings/followup-move-actions.ts:L1 | neighbors=[meeting-intel.tsx, meeting-notes.tsx, log.ts, logActivity(), capabilities.ts, isAdminRole()]
- "meetings_glance_actions": "glance-actions.ts" | kind=code-symbol | source=src/features/meetings/glance-actions.ts:L1 | neighbors=[671c254 ., capabilities.ts, isAdminRole(), UserRole, meeting-notes-model.ts, MeetingGlance]
- "people_removal_queries": "removal-queries.ts" | kind=code-symbol | source=src/features/people/removal-queries.ts:L1 | neighbors=[actions.ts, queries.ts, actions.ts, webauthn-actions.ts, import-actions.ts, auth.ts]
- "people_summary_actions": "summary-actions.ts" | kind=code-symbol | source=src/features/people/summary-actions.ts:L1 | neighbors=[41d5428 feat(people): the short read on…, 514d33b feat(meetings): a meeting can b…, person-summary-card.tsx, actor.ts, loadActor, client.ts]
- "ui_label": "label.tsx" | kind=code-symbol | source=src/components/ui/label.tsx:L1 | neighbors=[action-item-board.tsx, add-user-dialog.tsx, app-form-dialog.tsx, as-of-picker.tsx, assign-dialog.tsx, bug-csv-import-dialog.tsx]
- "worklog_entry_queries": "entry-queries.ts" | kind=code-symbol | source=src/features/worklog/entry-queries.ts:L1 | neighbors=[3ac9d68 ., 51008f1 feat(worklog): one click fills …, 9f936b5 Add app aliases and auto-scored…, afba1c3 feat(worklog): the hours form c…, b1ef1b9 feat(worklog): log where the da…, b35d96b fix(worklog): two hours reads c…]
- "admin_danger_actions_test": "danger-actions.test.ts" | kind=code-symbol | source=src/features/admin/danger-actions.test.ts:L1 | neighbors=[danger-actions.ts, asMember(), asSuperadmin(), {
  authMock,
  logActivityMock,
  g…, purgeOrder(), seedBoard()]
- "approvals_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/admin/approvals/page.tsx:L1 | neighbors=[change-request-queries.ts, getApprovalsInbox(), getMyRequests(), queries.ts, listPendingUsers, AdminApprovalsPage()]
- "auth_capabilities_actor": "Actor" | kind=code-symbol | source=src/features/auth/capabilities.ts:L35 | neighbors=[approval-queries.ts, audit-queries.ts, audit-queries.test.ts, change-request-queries.ts, change-request-routing.ts, change-request-routing.test.ts]
- "components_active_sprints": "active-sprints.tsx" | kind=code-symbol | source=src/features/dashboard/components/active-sprints.tsx:L1 | neighbors=[stat-number.tsx, StatNumber(), ActiveSprints(), daysRemainingLabel(), formatSprintDate(), formatUpcomingDate()]
- "components_day_one_line": "day-one-line.tsx" | kind=code-symbol | source=src/features/worklog/components/day-one-line.tsx:L1 | neighbors=[056203d fix(worklog): stop printing the…, 8fa8f26 feat(worklog): the whole day in…, a4b271b Improve leave types and worklog…, DayOneLine(), TOKEN_CLASS, entry-grammar-help.tsx]
- "components_passkeys_card": "passkeys-card.tsx" | kind=code-symbol | source=src/features/auth/components/passkeys-card.tsx:L1 | neighbors=[webauthn-actions.ts, beginPasskeyRegistration(), completePasskeyRegistration(), deletePasskey(), listPasskeys(), PasskeySummary]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-005.json

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
