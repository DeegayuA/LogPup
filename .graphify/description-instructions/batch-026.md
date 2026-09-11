# Node Description Batch 27 of 166

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

- "components_audit_skeleton": "audit-skeleton.tsx" | kind=code-symbol | source=src/features/admin/components/audit-skeleton.tsx:L1 | neighbors=[page.tsx, AuditControlsSkeleton(), AuditTrailSkeleton(), DaySkeleton(), ROW_WIDTHS, skeleton.tsx]
- "components_coverage_figure": "coverage-figure.tsx" | kind=code-symbol | source=src/features/admin/components/coverage-figure.tsx:L1 | neighbors=[CoverageFigure(), utils.ts, cn(), coverage.ts, CoverageSummary, formatCoverage()]
- "components_intel_skeletons": "intel-skeletons.tsx" | kind=code-symbol | source=src/features/intel/components/intel-skeletons.tsx:L1 | neighbors=[966d695 feat(intel): the briefing uses …, dashboard-zones.tsx, AskPanelSkeleton(), BriefingCardSkeleton(), SignalBoardSkeleton(), skeleton.tsx]
- "components_meeting_chips_sectionheading": "SectionHeading()" | kind=code-symbol | source=src/features/meetings/components/meeting-chips.tsx:L127 | neighbors=[action-item-board.tsx, meeting-chips.tsx, meeting-notes.tsx, meeting-notes-dialog.tsx, meeting-planner.tsx, meeting-prep.tsx]
- "components_meeting_glance_attendeeresponse": "AttendeeResponse" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L14 | neighbors=[meeting-detail-dialog.tsx, meeting-glance.ts, meeting-glance.test.ts, meeting-intel-sheet.tsx, meeting-list.tsx, list-filter.ts]
- "components_meeting_glance_durationlabel": "durationLabel()" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L122 | neighbors=[meeting-detail-dialog.tsx, meeting-glance.ts, meeting-glance.test.ts, meeting-intel-sheet.tsx, meeting-list.tsx, meetings-day-rail.tsx]
- "components_passkey_login_button": "passkey-login-button.tsx" | kind=code-symbol | source=src/features/auth/components/passkey-login-button.tsx:L1 | neighbors=[webauthn-actions.ts, beginPasskeyLogin(), completePasskeyLogin(), PasskeyLoginButton(), button.tsx, Button()]
- "components_request_change_dialog": "request-change-dialog.tsx" | kind=code-symbol | source=src/features/admin/components/request-change-dialog.tsx:L1 | neighbors=[change-request-actions.ts, createChangeRequest(), RequestChangeDialog(), button.tsx, Button(), input.tsx]
- "components_task_split_bar": "task-split-bar.tsx" | kind=code-symbol | source=src/features/apps/components/task-split-bar.tsx:L1 | neighbors=[app-card.tsx, app-health.ts, AppTaskCounts, TaskSplitBar(), utils.ts, cn()]
- "dashboard_my_day_stats_test": "my-day-stats.test.ts" | kind=code-symbol | source=src/features/dashboard/my-day-stats.test.ts:L1 | neighbors=[my-day-stats.ts, buildMyDayStats(), QUIET, QUIET_TASKS, followup-split.ts, task-workload.ts]
- "db_live_livenotesegments": "liveNoteSegments" | kind=code-symbol | source=src/db/live.ts:L49 | neighbors=[live.ts, gather.ts, ai-actions.ts, ai-actions.test.ts, assistant-actions.ts, text-replace-actions.ts]
- "db_live_livescreenshots": "liveScreenshots" | kind=code-symbol | source=src/db/live.ts:L50 | neighbors=[danger-actions.ts, danger-actions.test.ts, trash-actions.ts, trash-actions.test.ts, live.ts, ai-actions.ts]
- "db_schema_absences": "absences" | kind=code-symbol | source=src/db/schema.ts:L1843 | neighbors=[schema.ts, handover-queries.ts, absence-actions.ts, absence-actions.test.ts, absence-queries.ts, progress-queries.ts]
- "db_schema_userdeletions": "userDeletions" | kind=code-symbol | source=src/db/schema.ts:L2015 | neighbors=[actions.ts, trash-actions.ts, trash-actions.test.ts, trash-queries.ts, trash-queries.test.ts, schema.ts]
- "db_schema_workschedules": "workSchedules" | kind=code-symbol | source=src/db/schema.ts:L1804 | neighbors=[schema.ts, handover-actions.ts, coverage-queries.ts, nudge-queries.ts, progress-queries.ts, queries.ts]
- "drizzle_0014_meeting_note_timeline": "0014_meeting_note_timeline.sql" | kind=code-symbol | source=drizzle/0014_meeting_note_timeline.sql:L1 | neighbors=[meeting_note_segments, meeting_speakers, meeting_task_suggestions, public.meeting_note_segments, public.meetings, public.tasks]
- "drizzle_0038_rbac_tables": "0038_rbac_tables.sql" | kind=code-symbol | source=drizzle/0038_rbac_tables.sql:L1 | neighbors=[absences, app_grants, change_requests, org_holidays, public.apps, public.users]
- "drizzle_0056_recurring_meetings": "0056_recurring_meetings.sql" | kind=code-symbol | source=drizzle/0056_recurring_meetings.sql:L1 | neighbors=[4d94451 feat(meetings): a recurrence ru…, meeting_series, meeting_series_attendees, meetings, public.apps, public.meeting_series]
- "finance_queries_projectcost": "projectCost()" | kind=code-symbol | source=src/features/finance/queries.ts:L198 | neighbors=[project-finance-card.tsx, queries.ts, assertIsoDayRange(), costFigureFor(), loadPersonRates(), loadRoleRates()]
- "finance_queries_projectmargin": "projectMargin()" | kind=code-symbol | source=src/features/finance/queries.ts:L315 | neighbors=[project-finance-card.tsx, queries.ts, assertIsoDayRange(), costFigureFor(), loadPersonRates(), loadRoleRates()]
- "gemini_model_catalog_buildmodelcatalog": "buildModelCatalog()" | kind=code-symbol | source=src/features/gemini/model-catalog.ts:L175 | neighbors=[model-catalog.ts, classifyModel(), labelFor(), modelIdFrom(), stabilityOf(), model-catalog.test.ts]
- "gemini_pricing_estimatecostusd": "estimateCostUsd()" | kind=code-symbol | source=src/features/gemini/pricing.ts:L77 | neighbors=[ai-features.ts, ai-features.test.ts, budget-queries.ts, pricing.ts, priceForModel(), pricing.test.ts]
- "home_bento_features": "bento-features.tsx" | kind=code-symbol | source=src/app/(public)/home/bento-features.tsx:L1 | neighbors=[d0da911 test(gemini): a public page may…, BentoFeatures(), fortnight.tsx, Fortnight(), spotlight-card.tsx, SpotlightCard()]
- "intel_answer_links_splitanswerlinks": "splitAnswerLinks()" | kind=code-symbol | source=src/features/intel/answer-links.ts:L37 | neighbors=[ask-panel.tsx, briefing-card.tsx, answer-links.ts, findLabelNearEnd(), pushText(), readableLabel()]
- "intel_briefing_fallback_derivebriefing": "deriveBriefing()" | kind=code-symbol | source=src/features/intel/briefing-fallback.ts:L140 | neighbors=[actions.ts, briefing-fallback.ts, joinClauses(), ownClauses(), plural(), teamClauses()]
- "lib_escalation_test": "escalation.test.ts" | kind=code-symbol | source=src/lib/escalation.test.ts:L1 | neighbors=[e432241 feat(deadlines): the escalation…, escalation.ts, EscalationStep, notificationKindFor(), NOTIFYING_STEPS, STEP_NOTIFICATION_KIND]
- "lib_fuzzy": "fuzzy.ts" | kind=code-symbol | source=src/lib/fuzzy.ts:L1 | neighbors=[search.ts, fuzzyMatches(), levenshtein(), similarity(), meeting-intent.ts, mention-match.ts]
- "lib_job_roles_job_roles": "JOB_ROLES" | kind=code-symbol | source=src/lib/job-roles.ts:L114 | neighbors=[assign-dialog.tsx, capacity-heat-editable.tsx, speaker-assignment.tsx, agenda-topics.test.ts, job-roles.ts, job-roles.test.ts]
- "lib_lk_holidays_excuseswork": "excusesWork()" | kind=code-symbol | source=src/lib/lk-holidays.ts:L199 | neighbors=[org-holidays-card.tsx, worklog-calendar.tsx, lk-holidays.ts, isMercantileHoliday(), lk-holidays.test.ts, holiday-listing.ts]
- "lib_project_roles_rolebadgetone": "roleBadgeTone()" | kind=code-symbol | source=src/lib/project-roles.ts:L44 | neighbors=[project-roles.ts, isProjectManagerRole(), isReviewerRole(), project-roles.test.ts, card-actions.ts, cohort-filter.ts]
- "lib_revalidate_admin": "revalidate-admin.ts" | kind=code-symbol | source=src/lib/revalidate-admin.ts:L1 | neighbors=[actions.ts, import-actions.ts, revalidateAdmin(), actions.ts, ai-actions.ts, actions.ts]
- "lib_revalidate_admin_revalidateadmin": "revalidateAdmin()" | kind=code-symbol | source=src/lib/revalidate-admin.ts:L18 | neighbors=[actions.ts, import-actions.ts, revalidate-admin.ts, actions.ts, ai-actions.ts, actions.ts]
- "maintenance_freeze_readmaintenancewindow": "readMaintenanceWindow()" | kind=code-symbol | source=src/features/maintenance/freeze.ts:L71 | neighbors=[maintenance-mount.tsx, actions.ts, freeze.ts, maintenanceActiveNow(), readMaintenancePhase(), readMaintenanceRow]
- "maintenance_window_parsemaintenancewindow": "parseMaintenanceWindow()" | kind=code-symbol | source=src/features/maintenance/window.ts:L93 | neighbors=[freeze.ts, lifecycle.ts, window.ts, asMs(), asText(), has()]
- "maintenance_write_actions_test": "write-actions.test.ts" | kind=code-symbol | source=src/features/maintenance/write-actions.test.ts:L1 | neighbors=[8bacbca ., capabilities.ts, Action, write-actions.ts, actionsAllowedDuringMaintenance(), isFrozenByMaintenance()]
- "meeting_load_churn": "churn.ts" | kind=code-symbol | source=src/features/meeting-load/churn.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, inviteChurnBetween(), OccurrenceInvites, seriesChurnCount(), churn.test.ts, gather.ts]
- "meeting_load_series_groups_test": "series-groups.test.ts" | kind=code-symbol | source=src/features/meeting-load/series-groups.test.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, series-groups.ts, groupIntoSeries(), SeriesOccurrenceInput, daysBefore(), NOW]
- "meetings_actions_canmanagemeeting": "canManageMeeting()" | kind=code-symbol | source=src/features/meetings/actions.ts:L250 | neighbors=[actions.ts, duplicateMeeting(), rescheduleMeeting(), retryCalendarInvite(), setMeetingApps(), updateMeeting()]
- "meetings_actions_duplicatemeeting": "duplicateMeeting()" | kind=code-symbol | source=src/features/meetings/actions.ts:L709 | neighbors=[meeting-detail-dialog.tsx, meetings-time-grid.tsx, actions.ts, canManageMeeting(), createMeeting(), meetingById()]
- "meetings_actions_updatemeetingnotes": "updateMeetingNotes()" | kind=code-symbol | source=src/features/meetings/actions.ts:L1135 | neighbors=[actions.ts, appNameById(), canManageMeeting(), meetingById(), requireSession(), revalidateMeetingPaths()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-026.json

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
