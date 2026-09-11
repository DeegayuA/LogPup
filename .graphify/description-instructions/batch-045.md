# Node Description Batch 46 of 166

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

- "components_passkey_nudge_banner": "passkey-nudge-banner.tsx" | kind=code-symbol | source=src/features/auth/components/passkey-nudge-banner.tsx:L1 | neighbors=[passkey-nudge.tsx, PasskeyNudgeBanner(), button.tsx, Button()]
- "components_person_followups_card_personfollowupscard": "PersonFollowupsCard()" | kind=code-symbol | source=src/features/people/components/person-followups-card.tsx:L42 | neighbors=[dashboard-zones.tsx, person-followups-card.tsx, firstName(), page.tsx]
- "components_project_finance_card_projectfinancecard": "ProjectFinanceCard()" | kind=code-symbol | source=src/features/finance/components/project-finance-card.tsx:L100 | neighbors=[project-finance-card.tsx, money(), shiftDays(), page.tsx]
- "components_replace_review_dialog_replacereviewdialog": "ReplaceReviewDialog()" | kind=code-symbol | source=src/features/meetings/components/replace-review-dialog.tsx:L56 | neighbors=[meeting-notes.tsx, note-timeline.tsx, replace-review-dialog.tsx, defaultSelection()]
- "components_roadmap_timeline_formatrange": "formatRange()" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L177 | neighbors=[roadmap-timeline.tsx, parseIso(), SprintBar(), SprintIndexRow()]
- "components_task_card_formatduedate": "formatDueDate()" | kind=code-symbol | source=src/features/sprints/components/task-card.tsx:L60 | neighbors=[task-card.tsx, CardFace(), cardLabel(), TaskCard()]
- "components_trash_card_logic_restoredisabledreason": "restoreDisabledReason()" | kind=code-symbol | source=src/features/admin/components/trash-card-logic.ts:L75 | neighbors=[trash-card.tsx, trash-card-logic.ts, trash-card-logic.test.ts, trash-row-actions.tsx]
- "components_use_glance_map_useglancemapoptional": "useGlanceMapOptional()" | kind=code-symbol | source=src/features/meetings/components/use-glance-map.tsx:L213 | neighbors=[meeting-list.tsx, meetings-views.tsx, triage-rail.tsx, use-glance-map.tsx]
- "components_use_speech_usespeech": "useSpeech()" | kind=code-symbol | source=src/features/speech/components/use-speech.ts:L38 | neighbors=[meeting-assistant.tsx, speak-button.tsx, use-speech.ts, hero-showcase.tsx]
- "dashboard_ai_engine_aienginetotals": "AiEngineTotals" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L202 | neighbors=[ai-engine-card.tsx, dashboard-zones.tsx, ai-engine.ts, ai-engine.test.ts]
- "dashboard_ai_engine_formatrate": "formatRate()" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L256 | neighbors=[ai-engine-card.tsx, ai-engine.ts, trimRate(), ai-engine.test.ts]
- "dashboard_ai_engine_formattokencount": "formatTokenCount()" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L238 | neighbors=[ai-engine-card.tsx, dashboard-zones.tsx, ai-engine.ts, ai-engine.test.ts]
- "dashboard_my_day_stats_buildmydaystats": "buildMyDayStats()" | kind=code-symbol | source=src/features/dashboard/my-day-stats.ts:L28 | neighbors=[dashboard-zones.tsx, my-day-stats.ts, plural(), my-day-stats.test.ts]
- "dashboard_sprint_progress_sprintprogress": "sprintProgress()" | kind=code-symbol | source=src/features/dashboard/sprint-progress.ts:L8 | neighbors=[active-sprints.tsx, sprint-progress.ts, sprint-progress.test.ts, progress-queries.ts]
- "db_schema_changerequests": "changeRequests" | kind=code-symbol | source=src/db/schema.ts:L1770 | neighbors=[change-request-actions.ts, change-request-queries.ts, schema.ts, handover-queries.ts]
- "db_schema_maintenancewindow": "maintenanceWindow" | kind=code-symbol | source=src/db/schema.ts:L2204 | neighbors=[schema.ts, actions.ts, freeze.ts, lifecycle.ts]
- "db_schema_meetingattendeehistory": "meetingAttendeeHistory" | kind=code-symbol | source=src/db/schema.ts:L912 | neighbors=[schema.ts, actions.ts, ai-actions.ts, rsvp-actions.ts]
- "db_schema_meetingattendeerecommendations": "meetingAttendeeRecommendations" | kind=code-symbol | source=src/db/schema.ts:L808 | neighbors=[actions.ts, backup.ts, clear-test-data.test.ts, schema.ts]
- "db_schema_meetingrecordings": "meetingRecordings" | kind=code-symbol | source=src/db/schema.ts:L1425 | neighbors=[live.ts, schema.ts, recording-actions.ts, recording-queries.ts]
- "db_schema_useraiprefs": "userAiPrefs" | kind=code-symbol | source=src/db/schema.ts:L1006 | neighbors=[schema.ts, actions.ts, actions.test.ts, prefs.ts]
- "db_schema_worklogentries": "worklogEntries" | kind=code-symbol | source=src/db/schema.ts:L1642 | neighbors=[live.ts, schema.ts, entry-actions.ts, entry-actions.test.ts]
- "db_write_gate_gatebatch": "gateBatch()" | kind=code-symbol | source=src/db/write-gate.ts:L132 | neighbors=[index.ts, write-gate.ts, assertWritable(), write-gate.test.ts]
- "deadlines_deadline_csv_validatedeadlinecsvrow": "validateDeadlineCsvRow()" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L227 | neighbors=[deadline-csv.ts, parseDeadlineCsv(), deadline-csv.test.ts, isCalendarDay()]
- "deadlines_import_actions_importdeadlinecsvrows": "importDeadlineCsvRows()" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L254 | neighbors=[import-actions.ts, loadTasks(), planImport(), requireDeadlineImporter()]
- "deadlines_import_actions_planimport": "planImport()" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L167 | neighbors=[import-actions.ts, importDeadlineCsvRows(), resolveTask(), previewDeadlineCsvImport()]
- "deadlines_import_actions_previewdeadlinecsvimport": "previewDeadlineCsvImport()" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L223 | neighbors=[import-actions.ts, loadTasks(), planImport(), requireDeadlineImporter()]
- "drizzle_0000_complete_adam_warlock_tasks": "tasks" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L56 | neighbors=[0000_complete_adam_warlock.sql, public.apps, public.sprints, public.users]
- "drizzle_0002_gemini_meeting_ai": "0002_gemini-meeting-ai.sql" | kind=code-symbol | source=drizzle/0002_gemini-meeting-ai.sql:L1 | neighbors=[gemini_keys, meeting_ai_notes, public.meetings, public.users]
- "drizzle_0014_meeting_note_timeline_public_meetings": "public.meetings" | kind=code-symbol | source=drizzle/0014_meeting_note_timeline.sql:L44 | neighbors=[0014_meeting_note_timeline.sql, meeting_note_segments, meeting_speakers, meeting_task_suggestions]
- "drizzle_0014_meeting_note_timeline_public_users": "public.users" | kind=code-symbol | source=drizzle/0014_meeting_note_timeline.sql:L49 | neighbors=[0014_meeting_note_timeline.sql, meeting_note_segments, meeting_speakers, meeting_task_suggestions]
- "drizzle_0028_attendee_recommendations": "0028_attendee_recommendations.sql" | kind=code-symbol | source=drizzle/0028_attendee_recommendations.sql:L1 | neighbors=[meeting_attendee_recommendations, meeting_attendees, public.meetings, public.users]
- "drizzle_0045_bug_reports": "0045_bug_reports.sql" | kind=code-symbol | source=drizzle/0045_bug_reports.sql:L1 | neighbors=[bug_reports, public.apps, public.tasks, public.users]
- "drizzle_0045_bug_reports_bug_reports": "bug_reports" | kind=code-symbol | source=drizzle/0045_bug_reports.sql:L23 | neighbors=[0045_bug_reports.sql, public.apps, public.tasks, public.users]
- "drizzle_0047_worklog_entries": "0047_worklog_entries.sql" | kind=code-symbol | source=drizzle/0047_worklog_entries.sql:L1 | neighbors=[3c30bf4 worklog: per-task hours substra…, public.tasks, public.users, worklog_entries]
- "drizzle_0048_project_finance_public_users": "public.users" | kind=code-symbol | source=drizzle/0048_project_finance.sql:L94 | neighbors=[0048_project_finance.sql, person_rates, project_value, rate_cards]
- "drizzle_0060_meeting_recordings": "0060_meeting_recordings.sql" | kind=code-symbol | source=drizzle/0060_meeting_recordings.sql:L1 | neighbors=[702dd68 feat(db): takes become a thing …, meeting_recordings, meetings, users]
- "drizzle_0064_task_assignees": "0064_task_assignees.sql" | kind=code-symbol | source=drizzle/0064_task_assignees.sql:L1 | neighbors=[abcd631 feat(db): a task can have sever…, public.tasks, public.users, task_assignees]
- "e2e_soft_delete_spec_createmeeting": "createMeeting()" | kind=code-symbol | source=e2e/soft-delete.spec.ts:L72 | neighbors=[soft-delete.spec.ts, expandPastMeetingsIfCollapsed(), fillMeetingDateTime(), todayAt()]
- "finance_cost_addmonthsiso": "addMonthsIso()" | kind=code-symbol | source=src/features/finance/cost.ts:L379 | neighbors=[cost.ts, daysInMonth(), pad(), subscriptionAccrued()]
- "finance_cost_costforentries": "costForEntries()" | kind=code-symbol | source=src/features/finance/cost.ts:L215 | neighbors=[cost.ts, roundMoney(), costForProject(), cost.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-045.json

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
