# Node Description Batch 20 of 166

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

- "commit:repo:github.com/DeegayuA/LogPup@e594a5272c29e76e23d82f83b861c87a1c4aee6d": "e594a52 feat(apps): each app carries its own colour, and says which ones are yo…" | kind=Commit | source=git | neighbors=[de4cd09 feat(ui): a select you can type…, browse.ts, browse.test.ts, mine.ts, mine.test.ts, page.tsx]
- "components_app_sprint_band": "app-sprint-band.tsx" | kind=code-symbol | source=src/features/apps/components/app-sprint-band.tsx:L1 | neighbors=[app-health.ts, AppSprintSnapshot, AppTaskCounts, completionPct(), parseCalendarDate(), sprintDayProgress()]
- "components_bug_content_editor": "bug-content-editor.tsx" | kind=code-symbol | source=src/features/bugs/components/bug-content-editor.tsx:L1 | neighbors=[actions.ts, updateBugContent(), BugContentEditor(), button.tsx, Button(), input.tsx]
- "components_csv_download": "csv-download.ts" | kind=code-symbol | source=src/features/admin/components/csv-download.ts:L1 | neighbors=[apps-table.tsx, audit-csv-button.tsx, bug-csv-import-dialog.tsx, bulk-logic.ts, csvFilename(), CsvValue]
- "components_danger_recordings_card": "danger-recordings-card.tsx" | kind=code-symbol | source=src/features/admin/components/danger-recordings-card.tsx:L1 | neighbors=[danger-actions.ts, wipeMeetingRecordings(), danger-logic.ts, purgeProgressMessage(), wipeRecordingsPhrase(), wipeRecordingsSummary()]
- "components_danger_trash_empty_card": "danger-trash-empty-card.tsx" | kind=code-symbol | source=src/features/admin/components/danger-trash-empty-card.tsx:L1 | neighbors=[danger-actions.ts, emptyTrash(), danger-logic.ts, emptyTrashPhrase(), emptyTrashSummary(), purgeProgressMessage()]
- "components_entry_grammar_help": "entry-grammar-help.tsx" | kind=code-symbol | source=src/features/worklog/components/entry-grammar-help.tsx:L1 | neighbors=[056203d fix(worklog): stop printing the…, day-hours-card.tsx, day-one-line.tsx, CATEGORY_LABEL, EntryGrammarHelp(), entries.ts]
- "components_meeting_chips_skeletonblock": "SkeletonBlock()" | kind=code-symbol | source=src/features/meetings/components/meeting-chips.tsx:L202 | neighbors=[meeting-chips.tsx, meeting-intel.tsx, meeting-list.tsx, meeting-notes-dialog.tsx, meeting-planner.tsx, meeting-prep.tsx]
- "components_meeting_notes_model_meetingglance": "MeetingGlance" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L485 | neighbors=[meeting-intel.tsx, meeting-intel-sheet.tsx, meeting-list.tsx, meeting-notes-model.ts, use-glance-map.tsx, glance-actions.ts]
- "components_onboarding_form": "onboarding-form.tsx" | kind=code-symbol | source=src/features/onboarding/components/onboarding-form.tsx:L1 | neighbors=[OnboardingForm(), actions.ts, submitOnboarding(), button.tsx, Button(), input.tsx]
- "components_org_tags_field": "org-tags-field.tsx" | kind=code-symbol | source=src/features/admin/components/org-tags-field.tsx:L1 | neighbors=[add-user-dialog.tsx, OrgTagsField(), utils.ts, cn(), badge.tsx, Badge()]
- "components_screen_filmstrip": "screen-filmstrip.tsx" | kind=code-symbol | source=src/features/meetings/components/screen-filmstrip.tsx:L1 | neighbors=[meeting-intel.tsx, ScreenFilmstrip(), utils.ts, cn(), ai-actions.ts, MeetingScreenshotView]
- "components_section_empty_sectionempty": "SectionEmpty()" | kind=code-symbol | source=src/features/people/components/section-empty.tsx:L40 | neighbors=[allocation-history-card.tsx, app-role-history-card.tsx, assignments-card.tsx, cohort-views.tsx, history-views.tsx, person-activity-card.tsx]
- "components_sign_in_methods": "sign-in-methods.tsx" | kind=code-symbol | source=src/features/auth/components/sign-in-methods.tsx:L1 | neighbors=[isMethod(), LastUsedTag(), METHODS, readLastMethod(), rememberSignInMethod(), SignInMethod]
- "components_trash_card_logic_test": "trash-card-logic.test.ts" | kind=code-symbol | source=src/features/admin/components/trash-card-logic.test.ts:L1 | neighbors=[trash-grouping.ts, TrashGroup, trash-card-logic.ts, matchesPurgeConfirm(), orderGroupsForDisplay(), restoreDisabledReason()]
- "components_use_dictation": "use-dictation.ts" | kind=code-symbol | source=src/features/speech/components/use-dictation.ts:L1 | neighbors=[d5b6409 ., dictate-button.tsx, ai-meter-provider.tsx, meterOrigin(), MeterOriginSource, useAiMeter()]
- "dashboard_my_day_stats": "my-day-stats.ts" | kind=code-symbol | source=src/features/dashboard/my-day-stats.ts:L1 | neighbors=[dashboard-zones.tsx, buildMyDayStats(), MyDayInput, plural(), followup-split.ts, person-stats.ts]
- "db_schema_approlehistory": "appRoleHistory" | kind=code-symbol | source=src/db/schema.ts:L332 | neighbors=[actions.ts, queries.ts, actor.ts, schema.ts, planner-actions.ts, notify.ts]
- "db_schema_dailyworklogs": "dailyWorklogs" | kind=code-symbol | source=src/db/schema.ts:L1578 | neighbors=[actions.ts, change-request-appliers.ts, clear-test-data.test.ts, schema.ts, queries.ts, actions.ts]
- "db_schema_meetingnotesegments": "meetingNoteSegments" | kind=code-symbol | source=src/db/schema.ts:L1279 | neighbors=[trash-actions.ts, trash-actions.test.ts, trash-queries.ts, trash-queries.test.ts, live.ts, schema.ts]
- "gemini_meter_pace_test": "meter-pace.test.ts" | kind=code-symbol | source=src/features/gemini/meter-pace.test.ts:L1 | neighbors=[f8a9b00 feat(gemini): the meter learns …, meter-pace.ts, DurationHistory, durationStorage, PACE_EXEMPT, paceKey()]
- "gemini_model_catalog_test": "model-catalog.test.ts" | kind=code-symbol | source=src/features/gemini/model-catalog.test.ts:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, model-catalog.ts, buildModelCatalog(), classifyModel(), labelFor(), modelIdFrom()]
- "gemini_usage_summary_test": "usage-summary.test.ts" | kind=code-symbol | source=src/features/gemini/usage-summary.test.ts:L1 | neighbors=[ai-features.ts, usage-summary.ts, AdoptionAggRow, summarizeAdoption(), summarizeUsage(), agg()]
- "github_commits": "commits.ts" | kind=code-symbol | source=src/features/github/commits.ts:L1 | neighbors=[de4812e feat(github): commits become wo…, app-client.ts, CommitEvidence, commitPromptLines(), GithubCommitRow, toCommitEvidence()]
- "id_print_masthead_edit": "print-masthead-edit.tsx" | kind=code-symbol | source=src/app/print/meetings/[id]/print-masthead-edit.tsx:L1 | neighbors=[page.tsx, EditableAgenda(), EditableAttendees(), EditableTitle(), EditorButtons(), MeetingEditBase]
- "intel_chat_history": "chat-history.ts" | kind=code-symbol | source=src/features/intel/chat-history.ts:L1 | neighbors=[d269096 feat(intel): keep the Ask LogPu…, ask-panel.tsx, appendTurn(), capBytes(), ChatCitation, ChatTurn]
- "lib_field_reconcile_test": "field-reconcile.test.ts" | kind=code-symbol | source=src/lib/field-reconcile.test.ts:L1 | neighbors=[050a921 feat(calendar): classify a two-…, field-reconcile.ts, FIELD_REASON_SENTENCE, FieldReason, reconcileAttendees(), reconcileMeeting()]
- "lib_org_from_domain": "org-from-domain.ts" | kind=code-symbol | source=src/lib/org-from-domain.ts:L1 | neighbors=[actions.ts, add-user-dialog.tsx, user-table.tsx, auth.ts, DOMAIN_TO_ORG, orgForEmail()]
- "lib_task_intent_parsetaskintent": "parseTaskIntent()" | kind=code-symbol | source=src/lib/task-intent.ts:L317 | neighbors=[task-intent.ts, task-intent-multi.test.ts, extractApp(), extractDue(), extractPriority(), findPeople()]
- "maintenance_window_formatwindowrange": "formatWindowRange()" | kind=code-symbol | source=src/features/maintenance/window.ts:L322 | neighbors=[maintenance-details-dialog.tsx, actions.ts, lifecycle.ts, window.ts, autoMessage(), formatClock()]
- "maintenance_window_maintenancewindow": "MaintenanceWindow" | kind=code-symbol | source=src/features/maintenance/window.ts:L43 | neighbors=[maintenance-banner.tsx, maintenance-controls.tsx, maintenance-details-dialog.tsx, maintenance-gate.tsx, maintenance-overlay.tsx, actions.ts]
- "meeting_load_observed_change": "observed-change.ts" | kind=code-symbol | source=src/features/meeting-load/observed-change.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, meeting-load-admin-card.tsx, admin-queries.ts, average(), ObservedChange, observedChangeFor()]
- "meetings_actions_deletemeeting": "deleteMeeting()" | kind=code-symbol | source=src/features/meetings/actions.ts:L1183 | neighbors=[danger-actions.ts, meeting-detail-dialog.tsx, meeting-intel-sheet.tsx, meeting-list.tsx, meetings-time-grid.tsx, actions.ts]
- "meetings_actions_requiresession": "requireSession()" | kind=code-symbol | source=src/features/meetings/actions.ts:L124 | neighbors=[actions.ts, createMeeting(), deleteMeeting(), duplicateMeeting(), rescheduleMeeting(), retryCalendarInvite()]
- "meetings_actions_reschedulemeeting": "rescheduleMeeting()" | kind=code-symbol | source=src/features/meetings/actions.ts:L588 | neighbors=[meeting-detail-dialog.tsx, meetings-month-calendar.tsx, meetings-time-grid.tsx, actions.ts, appNameById(), canManageMeeting()]
- "meetings_actions_setmeetingapps": "setMeetingApps()" | kind=code-symbol | source=src/features/meetings/actions.ts:L1050 | neighbors=[meeting-project-select.tsx, actions.ts, appNameById(), appNamesByIds(), canManageMeeting(), isForeignKeyViolation()]
- "meetings_ai_actions_persistmeetinganalysis": "persistMeetingAnalysis()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1248 | neighbors=[ai-actions.ts, analyzeMeetingAudio(), finalizeMeetingRecordingInner(), asActionItems(), asArray(), asSpeakerSegments()]
- "meetings_attendance_history_test": "attendance-history.test.ts" | kind=code-symbol | source=src/features/meetings/attendance-history.test.ts:L1 | neighbors=[attendance-history.ts, AttendanceAsOf, AttendanceHistoryRow, buildAttendanceEntry(), FEB, JAN]
- "meetings_attendee_score_renderreason": "renderReason()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L579 | neighbors=[attendee-score.ts, interpolate(), scoreAttendance(), scoreCandidate(), scoreDiscussion(), scoreFollowups()]
- "meetings_screen_keyframes": "screen-keyframes.ts" | kind=code-symbol | source=src/features/meetings/screen-keyframes.ts:L1 | neighbors=[trash-actions.ts, screen-filmstrip.tsx, use-screen-keyframes.ts, ai-actions.ts, computeDHash(), computeDownscaledDimensions()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-019.json

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
