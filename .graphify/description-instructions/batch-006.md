# Node Description Batch 7 of 166

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

- "deadlines_deadline_csv": "deadline-csv.ts" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L1 | neighbors=[cdc541d feat(deadlines): let a PM uploa…, bulk-logic.ts, csvFilename(), normalizeHeader(), splitCsvRows(), toCsv()]
- "meeting_load_actions": "actions.ts" | kind=code-symbol | source=src/features/meeting-load/actions.ts:L1 | neighbors=[d933927 feat(meeting-load): reads that …, suggestion-decision-buttons.tsx, capabilities.ts, can(), UserRole, index.ts]
- "meeting_load_admin_queries": "admin-queries.ts" | kind=code-symbol | source=src/features/meeting-load/admin-queries.ts:L1 | neighbors=[page.tsx, d933927 feat(meeting-load): reads that …, dashboard-zones.tsx, index.ts, Db, schema.ts]
- "meetings_calendar_grid": "calendar-grid.ts" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L1 | neighbors=[4d94451 feat(meetings): a recurrence ru…, meetings-calendar.tsx, meetings-time-grid.tsx, meter-actions.ts, lk-holidays.ts, toIsoDateInTimeZone()]
- "mini_calendar_index": "index.tsx" | kind=code-symbol | source=src/components/kibo-ui/mini-calendar/index.tsx:L1 | neighbors=[upcoming-filter.tsx, lk-holidays.ts, getLkHoliday(), isLkSunday(), toIsoDateInTimeZone(), utils.ts]
- "people_allocation_history": "allocation-history.ts" | kind=code-symbol | source=src/features/people/allocation-history.ts:L1 | neighbors=[allocation-history-card.tsx, allocation-trend.tsx, history-views.tsx, ai-actions.ts, attendance-history.ts, attendance-history.test.ts]
- "ui_avatar_avatarimage": "AvatarImage()" | kind=code-symbol | source=src/components/ui/avatar.tsx:L28 | neighbors=[activity-feed.tsx, app-activity.tsx, app-card.tsx, app-comments.tsx, app-contributions.tsx, avatar-upload.tsx]
- "ui_dialog_dialog": "Dialog()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L10 | neighbors=[action-item-board.tsx, add-user-dialog.tsx, app-form-dialog.tsx, ask-bubble.tsx, assign-dialog.tsx, bug-csv-import-dialog.tsx]
- "ui_dialog_dialogtitle": "DialogTitle()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L127 | neighbors=[action-item-board.tsx, add-user-dialog.tsx, app-form-dialog.tsx, ask-bubble.tsx, assign-dialog.tsx, bug-csv-import-dialog.tsx]
- "worklog_catch_up_offline": "catch-up-offline.ts" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L1 | neighbors=[3ac9d68 ., log-box.tsx, app-aliases.ts, AliasedApp, absence-kinds.ts, ABSENCE_KIND_PHRASES]
- "admin_audit_nl_actions": "audit-nl-actions.ts" | kind=code-symbol | source=src/features/admin/audit-nl-actions.ts:L1 | neighbors=[audit-filters.ts, AuditParamState, auditQueryString(), parseAuditParams(), audit-nl.ts, askAuditFilters()]
- "app_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/page.tsx:L1 | neighbors=[DashboardPage(), greetingFor(), actor.ts, loadActor, dashboard-zones.tsx, UnreadMentionsPill()]
- "auth_webauthn_actions": "webauthn-actions.ts" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L1 | neighbors=[beginPasskeyLogin(), beginPasskeyRegistration(), completePasskeyLogin(), completePasskeyRegistration(), deletePasskey(), listPasskeys()]
- "commit:repo:github.com/DeegayuA/LogPup@a4b271bc55e885b2d4186330e27ff6698d33bf55": "a4b271b Improve leave types and worklog UX flows" | kind=Commit | source=git | neighbors=[9cd44c8 ., actions.ts, actions.ts, main, c9a2906 Centralize absence kinds and ad…, ai-meter-dock.tsx]
- "components_person_meetings_card": "person-meetings-card.tsx" | kind=code-symbol | source=src/features/people/components/person-meetings-card.tsx:L1 | neighbors=[dashboard-zones.tsx, MeetingList(), PersonMeetingsCard(), RESPONSE_CLASS, RESPONSE_LABEL, section-empty.tsx]
- "components_upcoming_filter": "upcoming-filter.tsx" | kind=code-symbol | source=src/features/meetings/components/upcoming-filter.tsx:L1 | neighbors=[671c254 ., meetings-views.tsx, jump-to-date.tsx, JumpToDate(), meeting-list.tsx, MeetingList()]
- "contribution_graph_index": "index.tsx" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L1 | neighbors=[activity-graph.tsx, Activity, ContributionGraph(), ContributionGraphBlock(), ContributionGraphBlockProps, ContributionGraphCalendar()]
- "lib_session": "session.ts" | kind=code-symbol | source=src/lib/session.ts:L1 | neighbors=[page.tsx, layout.tsx, page.tsx, page.tsx, actor.ts, maintenance-mount.tsx]
- "lib_task_intent": "task-intent.ts" | kind=code-symbol | source=src/lib/task-intent.ts:L1 | neighbors=[8d1b390 fix(i18n): Sinhala survives eve…, task-composer.tsx, fuzzy.ts, fuzzyMatches(), addDays(), AT_ANYWHERE]
- "maintenance_lifecycle": "lifecycle.ts" | kind=code-symbol | source=src/features/maintenance/lifecycle.ts:L1 | neighbors=[8bacbca ., maintenance-mount.tsx, actions.ts, index.ts, Db, schema.ts]
- "speech_actions": "actions.ts" | kind=code-symbol | source=src/features/speech/actions.ts:L1 | neighbors=[9cd44c8 ., use-dictation.ts, use-speech.ts, client.ts, callGeminiSpeech(), callGeminiWithAudio()]
- "sprints_suggest_actions": "suggest-actions.ts" | kind=code-symbol | source=src/features/sprints/suggest-actions.ts:L1 | neighbors=[e8e9934 refactor(tasks): query open wor…, sprint-form-dialog.tsx, index.ts, Db, live.ts, liveMeetings]
- "transcription_live_client": "live-client.ts" | kind=code-symbol | source=src/features/transcription/live-client.ts:L1 | neighbors=[563cc1c fix(live): stop blaming the use…, 5a95470 fix(meetings): transcripts stop…, e73a38e fix(live): mint tokens with the…, live-transcription-status.tsx, use-live-transcription.ts, retry.ts]
- "ui_label_label": "Label()" | kind=code-symbol | source=src/components/ui/label.tsx:L7 | neighbors=[action-item-board.tsx, add-user-dialog.tsx, app-form-dialog.tsx, as-of-picker.tsx, assign-dialog.tsx, bug-csv-import-dialog.tsx]
- "worklog_absence_kinds": "absence-kinds.ts" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L1 | neighbors=[page.tsx, page.tsx, c9a2906 Centralize absence kinds and ad…, declare-absence-dialog.tsx, log-box.tsx, pending-absence-list.tsx]
- "admin_danger_logic_test": "danger-logic.test.ts" | kind=code-symbol | source=src/features/admin/danger-logic.test.ts:L1 | neighbors=[danger-logic.ts, backupFilename(), backupSummary(), backupTooLarge(), deleteMeetingPhrase(), deleteMeetingSummary()]
- "components_ai_engine_card": "ai-engine-card.tsx" | kind=code-symbol | source=src/features/dashboard/components/ai-engine-card.tsx:L1 | neighbors=[AiEngineCard(), READINESS_TONE, STABILITY_HINT, STABILITY_NOTE, usageLine(), ai-engine.ts]
- "components_app_role_history_card": "app-role-history-card.tsx" | kind=code-symbol | source=src/features/people/components/app-role-history-card.tsx:L1 | neighbors=[queries.ts, AppRoleHistoryEntry, role-history.ts, AppRoleKind, AppRoleHistoryCard(), PersonAppRoleHistoryCard()]
- "components_correct_selection": "correct-selection.tsx" | kind=code-symbol | source=src/features/meetings/components/correct-selection.tsx:L1 | neighbors=[f823a54 feat(meetings): correct a mishe…, CorrectionPrompt(), Offer, readOffer(), SelectionCorrector(), meeting-chips.tsx]
- "components_meeting_people_picker_model": "meeting-people-picker-model.ts" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L1 | neighbors=[f823a54 feat(meetings): correct a mishe…, action-item-board.tsx, meeting-people-picker.tsx, buildPeopleOptions(), BuildPeopleOptionsInput, buildPeoplePool()]
- "components_meeting_project_select": "meeting-project-select.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-project-select.tsx:L1 | neighbors=[meeting-detail-dialog.tsx, MeetingAppOption, MeetingProjectSelect(), utils.ts, cn(), actions.ts]
- "components_roadmap_spine": "roadmap-spine.tsx" | kind=code-symbol | source=src/features/sprints/components/roadmap-spine.tsx:L1 | neighbors=[HEALTH_FILL, remainingLabel(), RoadmapSpine(), SpineSprint, spine-scroller.tsx, SpineScroller()]
- "gemini_model_discovery": "model-discovery.ts" | kind=code-symbol | source=src/features/gemini/model-discovery.ts:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, ai-features-card.tsx, actions.ts, actions.test.ts, index.ts, Db]
- "gemini_queries": "queries.ts" | kind=code-symbol | source=src/features/gemini/queries.ts:L1 | neighbors=[624466e feat(gemini): the ownership que…, ai-adoption-card.tsx, ai-features-card.tsx, dashboard-zones.tsx, gemini-keys-card.tsx, actions.ts]
- "meetings_ai_actions_canmanagemeeting": "canManageMeeting()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L627 | neighbors=[ai-actions.ts, acceptTaskSuggestion(), addTypedNoteSegment(), analyzeMeetingAudio(), assignSpeaker(), attributeFollowup()]
- "meetings_glance_core": "glance-core.ts" | kind=code-symbol | source=src/features/meetings/glance-core.ts:L1 | neighbors=[671c254 ., meetings-views.tsx, glance-actions.ts, glance-actions.test.ts, glance-batch.ts, glance-batch.test.ts]
- "notifications_notify_rules": "notify-rules.ts" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L1 | neighbors=[8d28f33 feat(notifications): dedupe, a …, notify.ts, capabilities.ts, Action, Actor, can()]
- "roles_roles_test": "roles.test.ts" | kind=code-symbol | source=src/features/signals/roles/roles.test.ts:L1 | neighbors=[d5b6409 ., architect.ts, ArchitectScorecard, ArchitectScorecardInput, lead.ts, LeadScorecard]
- "signals_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/signals/page.tsx:L1 | neighbors=[d5b6409 ., actor.ts, loadActor, signals-view.tsx, SignalsHelp(), SignalsView()]
- "ui_command": "command.tsx" | kind=code-symbol | source=src/components/ui/command.tsx:L1 | neighbors=[command-center.tsx, meeting-form.tsx, meeting-people-picker.tsx, meeting-project-select.tsx, utils.ts, cn()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-006.json

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
