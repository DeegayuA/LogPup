# Node Description Batch 14 of 166

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

- "meetings_next_meeting": "next-meeting.ts" | kind=code-symbol | source=src/features/meetings/next-meeting.ts:L1 | neighbors=[3c0bc01 ., action-item-board.tsx, meeting-chips.tsx, meeting-intel.tsx, meeting-list.tsx, next-meeting-card.tsx]
- "roles_shared": "shared.ts" | kind=code-symbol | source=src/features/signals/roles/shared.ts:L1 | neighbors=[d5b6409 ., signals-view.tsx, architect.ts, lead.ts, member.ts, pm.ts]
- "sprints_due_date": "due-date.ts" | kind=code-symbol | source=src/features/sprints/due-date.ts:L1 | neighbors=[change-request-appliers.ts, 353c6e9 docs(deadlines): pre-0049 tasks…, e282043 feat(deadlines): grade the date…, deadline-csv.ts, import-actions.ts, actions.ts]
- "worklog_day_state": "day-state.ts" | kind=code-symbol | source=src/features/worklog/day-state.ts:L1 | neighbors=[e8b2ac2 feat(worklog): hours you logged…, logged-days-list.tsx, progress-matrix.tsx, worklog-calendar.tsx, working-days.ts, WorkingDayFraction]
- "worklog_org_holiday_queries": "org-holiday-queries.ts" | kind=code-symbol | source=src/features/worklog/org-holiday-queries.ts:L1 | neighbors=[org-holidays-card.tsx, page.tsx, auto-score-sync.ts, catch-up-actions.ts, holiday-listing.ts, holiday-listing.test.ts]
- "worklog_schedule_actions": "schedule-actions.ts" | kind=code-symbol | source=src/features/worklog/schedule-actions.ts:L1 | neighbors=[log.ts, logActivity(), actor.ts, requireCapability(), index.ts, Db]
- "admin_app_grant_actions": "app-grant-actions.ts" | kind=code-symbol | source=src/features/admin/app-grant-actions.ts:L1 | neighbors=[log.ts, logActivity(), grantAppAccess(), grantInput, revokeAppGrant(), actor.ts]
- "apps_project_manager": "project-manager.ts" | kind=code-symbol | source=src/features/apps/project-manager.ts:L1 | neighbors=[actions.ts, managedAppIdsFor(), managesAnyApp(), managesApp(), index.ts, Db]
- "apps_tabs": "tabs.ts" | kind=code-symbol | source=src/features/apps/tabs.ts:L1 | neighbors=[activity-queries.ts, APP_TAB_IDS, APP_TAB_LABEL, appTabHref(), AppTabId, boardHref()]
- "bugs_bug_display_test": "bug-display.test.ts" | kind=code-symbol | source=src/features/bugs/bug-display.test.ts:L1 | neighbors=[bug-display.ts, BUG_SEVERITIES, BUG_STATUSES, bugSeverityBadgeVariant(), bugSeverityLabel(), bugStatusBadgeVariant()]
- "calendar_google_calendar": "google-calendar.ts" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L1 | neighbors=[buildConferenceDataRequest(), CALENDAR_ERROR_SENTENCES, CalendarErrorKey, classifyCalendarError(), client(), createCalendarEvent()]
- "commit:repo:github.com/DeegayuA/LogPup@0a2e8bb81f9bf9b65730855225ed7925138ff4b5": "0a2e8bb feat(gemini): ask Google what models exist, instead of remembering to" | kind=Commit | source=git | neighbors=[main, 2bd871d feat(apps): download the team, …, ai-features-card.tsx, ai-model-select.tsx, ai-engine.ts, actions.ts]
- "components_app_comments": "app-comments.tsx" | kind=code-symbol | source=src/features/apps/components/app-comments.tsx:L1 | neighbors=[comment-actions.ts, postAppComment(), comment-queries.ts, AppComment, AppComments(), mention-textarea.tsx]
- "components_meeting_load_admin_card": "meeting-load-admin-card.tsx" | kind=code-symbol | source=src/features/meeting-load/components/meeting-load-admin-card.tsx:L1 | neighbors=[page.tsx, 5c7efa5 feat(meeting-load): four surfac…, MeetingLoadAdminCard(), suggestion-decision-buttons.tsx, SuggestionDecisionButtons(), observed-change.ts]
- "components_meeting_notes_model_test": "meeting-notes-model.test.ts" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.test.ts:L1 | neighbors=[671c254 ., e2090c6 feat(meetings): "Not tracked" r…, meeting-notes-model.ts, buildActionList(), createActionItemPromoter(), DueStatus]
- "components_meeting_rsvp": "meeting-rsvp.tsx" | kind=code-symbol | source=src/features/meetings/components/meeting-rsvp.tsx:L1 | neighbors=[671c254 ., meeting-intel-sheet.tsx, AttendeeResponse, MeetingRsvp(), OPTIONS, utils.ts]
- "db_schema_activitylog": "activityLog" | kind=code-symbol | source=src/db/schema.ts:L1503 | neighbors=[filters.ts, log.ts, queries.ts, audit-queries.ts, audit-queries.test.ts, change-request-actions.ts]
- "deadlines_deadline_csv_test": "deadline-csv.test.ts" | kind=code-symbol | source=src/features/deadlines/deadline-csv.test.ts:L1 | neighbors=[cdc541d feat(deadlines): let a PM uploa…, deadline-csv.ts, DEADLINE_CSV_EXAMPLE_ROW, DEADLINE_CSV_HEADERS, deadlineCsvTemplate(), deadlineCsvTemplateFilename()]
- "gemini_budget_queries": "budget-queries.ts" | kind=code-symbol | source=src/features/gemini/budget-queries.ts:L1 | neighbors=[59873cc feat(gemini): a monthly AI budg…, budget-notify.ts, index.ts, Db, schema.ts, aiUsageEvents]
- "gemini_model_catalog": "model-catalog.ts" | kind=code-symbol | source=src/features/gemini/model-catalog.ts:L1 | neighbors=[0a2e8bb feat(gemini): ask Google what m…, ai-features.ts, FeatureKind, ModelChoice, buildModelCatalog(), classifyModel()]
- "handover_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/admin/people/[id]/handover/page.tsx:L1 | neighbors=[actor.ts, loadActor, handover-form.tsx, HandoverForm(), HandoverPage(), handover-queries.ts]
- "intel_briefing_fallback": "briefing-fallback.ts" | kind=code-symbol | source=src/features/intel/briefing-fallback.ts:L1 | neighbors=[a1e0845 ., actions.ts, Briefing, deriveBriefing(), entityKey(), joinClauses()]
- "meetings_list_actions": "list-actions.ts" | kind=code-symbol | source=src/features/meetings/list-actions.ts:L1 | neighbors=[671c254 ., meetings-views.tsx, auth.ts, cursorInput, dayInput, fetchMeetingsForDay()]
- "meetings_list_filter": "list-filter.ts" | kind=code-symbol | source=src/features/meetings/list-filter.ts:L1 | neighbors=[671c254 ., meetings-views.tsx, triage-rail.tsx, upcoming-filter.tsx, meeting-glance.ts, AttendeeResponse]
- "meetings_queries_meetingsummary": "MeetingSummary" | kind=code-symbol | source=src/features/meetings/queries.ts:L19 | neighbors=[add-to-calendar.tsx, meeting-detail-dialog.tsx, meeting-intel-sheet.tsx, meeting-list.tsx, meetings-agenda.tsx, meetings-calendar.tsx]
- "people_format_instant_formatbusinesstime": "formatBusinessTime()" | kind=code-symbol | source=src/features/people/format-instant.ts:L51 | neighbors=[activity-feed.tsx, audit-trail.tsx, briefing-card.tsx, meeting-detail-dialog.tsx, meeting-header-actions.tsx, meetings-day-rail.tsx]
- "people_now": "now.ts" | kind=code-symbol | source=src/features/people/now.ts:L1 | neighbors=[directory.tsx, actionSentence(), capitalise(), EMPTY_NOW, isOverdue(), nowHeadline()]
- "registry_types_commanddescriptor": "CommandDescriptor" | kind=code-symbol | source=src/features/search/registry/types.ts:L129 | neighbors=[commands.ts, commands.ts, commands.ts, commands.ts, commands.ts, commands.ts]
- "roles_architect": "architect.ts" | kind=code-symbol | source=src/features/signals/roles/architect.ts:L1 | neighbors=[d5b6409 ., ArchitectMeeting, ArchitectScorecard, ArchitectScorecardInput, shared.ts, Scorecard]
- "settings_commands": "commands.ts" | kind=code-symbol | source=src/features/settings/commands.ts:L1 | neighbors=[007c37f ., 3dcd417 feat(shell): collapse the sideb…, commands.ts, types.ts, CommandDescriptor, accentLabel()]
- "shared_job_role_select": "job-role-select.tsx" | kind=code-symbol | source=src/components/shared/job-role-select.tsx:L1 | neighbors=[add-user-dialog.tsx, user-table.tsx, job-roles.ts, JOB_ROLE_GROUPS, JOB_ROLES, JobRoleSelect()]
- "transcription_live_protocol": "live-protocol.ts" | kind=code-symbol | source=src/features/transcription/live-protocol.ts:L1 | neighbors=[563cc1c fix(live): stop blaming the use…, e73a38e fix(live): mint tokens with the…, models.ts, live-client.ts, AuthTokenRequestOptions, buildAudioMessage()]
- "ui_alert_dialog_alertdialogtrigger": "AlertDialogTrigger()" | kind=code-symbol | source=src/components/ui/alert-dialog.tsx:L13 | neighbors=[apps-table.tsx, assignments-card.tsx, gemini-keys-card.tsx, meeting-detail-dialog.tsx, meeting-intel.tsx, meeting-intel-sheet.tsx]
- "activity_search": "search.ts" | kind=code-symbol | source=src/features/activity/search.ts:L1 | neighbors=[actions.ts, page.tsx, activityRowSearchText(), bestWordSimilarity(), fuzzyActivityFallback(), rankActivityMatches()]
- "apps_role_history": "role-history.ts" | kind=code-symbol | source=src/features/apps/role-history.ts:L1 | neighbors=[actions.ts, queries.ts, appRoleAsOf(), AppRoleEntry, AppRoleEntryInput, AppRoleInterval]
- "apps_search_providers": "search-providers.ts" | kind=code-symbol | source=src/features/apps/search-providers.ts:L1 | neighbors=[searchProviders, actor.ts, capabilities.ts, effectiveGrant(), index.ts, Db]
- "auth_capabilities_test": "capabilities.test.ts" | kind=code-symbol | source=src/features/auth/capabilities.test.ts:L1 | neighbors=[capabilities.ts, Action, Actor, can(), capFor(), effectiveGrant()]
- "auth_error_page": "page.tsx" | kind=code-symbol | source=src/app/auth-error/page.tsx:L1 | neighbors=[AuthErrorPage(), DEFAULT_COPY, ERROR_COPY, metadata, brand-mark.tsx, BrandMark()]
- "commit:repo:github.com/DeegayuA/LogPup@0ef51428157489294d58ce36d82541fd7570a1e5": "0ef5142 fix(ui): correctness, responsive and skeleton findings from the review" | kind=Commit | source=git | neighbors=[loading.tsx, main, 743b1f2 fix(ui): a false-positive tag m…, audit-filter-bar.tsx, pending-approvals-card.tsx, progress-matrix.tsx]
- "commit:repo:github.com/DeegayuA/LogPup@419d8753b6929c62daef66c76b00c0eedd2a1dc3": "419d875 Unify worklog logging with AI catch-up box" | kind=Commit | source=git | neighbors=[main, 9f936b5 Add app aliases and auto-scored…, day-panel.tsx, declare-absence-dialog.tsx, log-box.tsx, pending-absence-list.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-013.json

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
