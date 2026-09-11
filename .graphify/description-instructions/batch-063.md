# Node Description Batch 64 of 166

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

- "dashboard_zones_zonescope": "ZoneScope" | kind=code-symbol | source=src/features/dashboard/zones.ts:L253 | neighbors=[dashboard-zones.tsx, zones.ts, zones.test.ts]
- "db_schema_meetingspeakers": "meetingSpeakers" | kind=code-symbol | source=src/db/schema.ts:L1311 | neighbors=[schema.ts, ai-actions.ts, assistant-actions.ts]
- "db_schema_personrates": "personRates" | kind=code-symbol | source=src/db/schema.ts:L2122 | neighbors=[schema.ts, queries.ts, rate-actions.ts]
- "db_schema_projectvalue": "projectValue" | kind=code-symbol | source=src/db/schema.ts:L2159 | neighbors=[schema.ts, queries.ts, rate-actions.ts]
- "db_schema_ratecards": "rateCards" | kind=code-symbol | source=src/db/schema.ts:L2079 | neighbors=[schema.ts, queries.ts, rate-actions.ts]
- "db_schema_schedulepattern": "SchedulePattern" | kind=code-symbol | source=src/db/schema.ts:L1752 | neighbors=[schema.ts, capacity-hours.ts, schedules.ts]
- "db_schema_sprintcheckins": "sprintCheckins" | kind=code-symbol | source=src/db/schema.ts:L1551 | neighbors=[schema.ts, checkin-actions.ts, checkin-queries.ts]
- "db_schema_webauthncredentials": "webauthnCredentials" | kind=code-symbol | source=src/db/schema.ts:L1717 | neighbors=[webauthn-actions.ts, passkey-nudge.tsx, schema.ts]
- "db_schema_webauthnlogintokens": "webauthnLoginTokens" | kind=code-symbol | source=src/db/schema.ts:L1740 | neighbors=[webauthn-actions.ts, schema.ts, auth.ts]
- "deadlines_deadline_csv_describedeadlineimport": "describeDeadlineImport()" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L371 | neighbors=[deadline-csv.ts, deadline-csv.test.ts, import-actions.ts]
- "deadlines_deadline_csv_iscalendarday": "isCalendarDay()" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L207 | neighbors=[deadline-csv.ts, deadline-csv.test.ts, validateDeadlineCsvRow()]
- "deadlines_deadline_csv_isdeadlineexamplerow": "isDeadlineExampleRow()" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L150 | neighbors=[deadline-csv.ts, parseDeadlineCsv(), deadline-csv.test.ts]
- "deadlines_deadline_csv_test_reasonsfor": "reasonsFor()" | kind=code-symbol | source=src/features/deadlines/deadline-csv.test.ts:L36 | neighbors=[deadline-csv.test.ts, file(), parseOk()]
- "deadlines_import_actions_loadtasks": "loadTasks()" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L112 | neighbors=[import-actions.ts, importDeadlineCsvRows(), previewDeadlineCsvImport()]
- "deadlines_import_actions_requiredeadlineimporter": "requireDeadlineImporter()" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L92 | neighbors=[import-actions.ts, importDeadlineCsvRows(), previewDeadlineCsvImport()]
- "drizzle_0000_complete_adam_warlock_assignments": "assignments" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L18 | neighbors=[0000_complete_adam_warlock.sql, public.apps, public.users]
- "drizzle_0000_complete_adam_warlock_meeting_attendees": "meeting_attendees" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L26 | neighbors=[0000_complete_adam_warlock.sql, public.meetings, public.users]
- "drizzle_0000_complete_adam_warlock_meetings": "meetings" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L32 | neighbors=[0000_complete_adam_warlock.sql, public.apps, public.users]
- "drizzle_0002_gemini_meeting_ai_meeting_ai_notes": "meeting_ai_notes" | kind=code-symbol | source=drizzle/0002_gemini-meeting-ai.sql:L13 | neighbors=[0002_gemini-meeting-ai.sql, public.meetings, public.users]
- "drizzle_0002_gemini_meeting_ai_public_users": "public.users" | kind=code-symbol | source=drizzle/0002_gemini-meeting-ai.sql:L29 | neighbors=[0002_gemini-meeting-ai.sql, gemini_keys, meeting_ai_notes]
- "drizzle_0005_notifications": "0005_notifications.sql" | kind=code-symbol | source=drizzle/0005_notifications.sql:L1 | neighbors=[notifications, public.meetings, public.users]
- "drizzle_0005_notifications_notifications": "notifications" | kind=code-symbol | source=drizzle/0005_notifications.sql:L2 | neighbors=[0005_notifications.sql, public.meetings, public.users]
- "drizzle_0007_early_greymalkin": "0007_early_greymalkin.sql" | kind=code-symbol | source=drizzle/0007_early_greymalkin.sql:L1 | neighbors=[meeting_followups, public.meetings, public.users]
- "drizzle_0007_early_greymalkin_meeting_followups": "meeting_followups" | kind=code-symbol | source=drizzle/0007_early_greymalkin.sql:L3 | neighbors=[0007_early_greymalkin.sql, public.meetings, public.users]
- "drizzle_0009_app_comments": "0009_app_comments.sql" | kind=code-symbol | source=drizzle/0009_app_comments.sql:L1 | neighbors=[app_comments, public.apps, public.users]
- "drizzle_0009_app_comments_app_comments": "app_comments" | kind=code-symbol | source=drizzle/0009_app_comments.sql:L1 | neighbors=[0009_app_comments.sql, public.apps, public.users]
- "drizzle_0013_followup_response_note": "0013_followup-response-note.sql" | kind=code-symbol | source=drizzle/0013_followup-response-note.sql:L1 | neighbors=[meeting_followups, public.meetings, public.users]
- "drizzle_0013_followup_response_note_meeting_followups": "meeting_followups" | kind=code-symbol | source=drizzle/0013_followup-response-note.sql:L1 | neighbors=[0013_followup-response-note.sql, public.meetings, public.users]
- "drizzle_0014_meeting_note_timeline_meeting_note_segments": "meeting_note_segments" | kind=code-symbol | source=drizzle/0014_meeting_note_timeline.sql:L11 | neighbors=[0014_meeting_note_timeline.sql, public.meetings, public.users]
- "drizzle_0014_meeting_note_timeline_meeting_speakers": "meeting_speakers" | kind=code-symbol | source=drizzle/0014_meeting_note_timeline.sql:L23 | neighbors=[0014_meeting_note_timeline.sql, public.meetings, public.users]
- "drizzle_0015_assignment_history": "0015_assignment_history.sql" | kind=code-symbol | source=drizzle/0015_assignment_history.sql:L1 | neighbors=[assignment_history, public.apps, public.users]
- "drizzle_0015_assignment_history_assignment_history": "assignment_history" | kind=code-symbol | source=drizzle/0015_assignment_history.sql:L2 | neighbors=[0015_assignment_history.sql, public.apps, public.users]
- "drizzle_0017_meeting_recording_segments": "0017_meeting_recording_segments.sql" | kind=code-symbol | source=drizzle/0017_meeting_recording_segments.sql:L1 | neighbors=[meeting_recording_segments, public.meetings, public.users]
- "drizzle_0017_meeting_recording_segments_meeting_recording_segments": "meeting_recording_segments" | kind=code-symbol | source=drizzle/0017_meeting_recording_segments.sql:L1 | neighbors=[0017_meeting_recording_segments.sql, public.meetings, public.users]
- "drizzle_0018_meeting_screenshots": "0018_meeting_screenshots.sql" | kind=code-symbol | source=drizzle/0018_meeting_screenshots.sql:L1 | neighbors=[meeting_screenshots, public.meetings, public.users]
- "drizzle_0018_meeting_screenshots_meeting_screenshots": "meeting_screenshots" | kind=code-symbol | source=drizzle/0018_meeting_screenshots.sql:L1 | neighbors=[0018_meeting_screenshots.sql, public.meetings, public.users]
- "drizzle_0023_sprint_checkins": "0023_sprint_checkins.sql" | kind=code-symbol | source=drizzle/0023_sprint_checkins.sql:L1 | neighbors=[public.sprints, public.users, sprint_checkins]
- "drizzle_0023_sprint_checkins_sprint_checkins": "sprint_checkins" | kind=code-symbol | source=drizzle/0023_sprint_checkins.sql:L6 | neighbors=[0023_sprint_checkins.sql, public.sprints, public.users]
- "drizzle_0029_attribution_membership": "0029_attribution_membership.sql" | kind=code-symbol | source=drizzle/0029_attribution_membership.sql:L1 | neighbors=[meeting_attendee_history, public.meetings, public.users]
- "drizzle_0029_attribution_membership_meeting_attendee_history": "meeting_attendee_history" | kind=code-symbol | source=drizzle/0029_attribution_membership.sql:L21 | neighbors=[0029_attribution_membership.sql, public.meetings, public.users]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-063.json

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
