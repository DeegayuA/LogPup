# Node Description Batch 93 of 166

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

- "db_schema_bugseverity": "bugSeverity" | kind=code-symbol | source=src/db/schema.ts:L100 | neighbors=[bug-display.test.ts, schema.ts]
- "db_schema_bugstatus": "bugStatus" | kind=code-symbol | source=src/db/schema.ts:L104 | neighbors=[bug-display.test.ts, schema.ts]
- "db_schema_meetingseries": "meetingSeries" | kind=code-symbol | source=src/db/schema.ts:L585 | neighbors=[live.ts, schema.ts]
- "db_schema_mentions": "mentions" | kind=code-symbol | source=src/db/schema.ts:L1197 | neighbors=[schema.ts, notify.ts]
- "db_schema_taskassignees": "taskAssignees" | kind=code-symbol | source=src/db/schema.ts:L555 | neighbors=[schema.ts, task-assignees.ts]
- "db_schema_userrole": "userRole" | kind=code-symbol | source=src/db/schema.ts:L16 | neighbors=[capabilities.test.ts, schema.ts]
- "db_write_gate_assertwritable": "assertWritable()" | kind=code-symbol | source=src/db/write-gate.ts:L73 | neighbors=[write-gate.ts, gateBatch()]
- "db_write_gate_isexempttable": "isExemptTable()" | kind=code-symbol | source=src/db/write-gate.ts:L57 | neighbors=[write-gate.ts, gateWrite()]
- "db_write_gate_wrap": "wrap()" | kind=code-symbol | source=src/db/write-gate.ts:L89 | neighbors=[write-gate.ts, gateWrite()]
- "deadlines_deadline_csv_deadline_csv_example_row": "DEADLINE_CSV_EXAMPLE_ROW" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L116 | neighbors=[deadline-csv.ts, deadline-csv.test.ts]
- "deadlines_deadline_csv_deadline_csv_headers": "DEADLINE_CSV_HEADERS" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L93 | neighbors=[deadline-csv.ts, deadline-csv.test.ts]
- "deadlines_deadline_csv_deadlinecsvtemplate": "deadlineCsvTemplate()" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L126 | neighbors=[deadline-csv.ts, deadline-csv.test.ts]
- "deadlines_deadline_csv_deadlinecsvtemplatefilename": "deadlineCsvTemplateFilename()" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L130 | neighbors=[deadline-csv.ts, deadline-csv.test.ts]
- "deadlines_deadline_csv_invaliddeadlinecsvrow": "InvalidDeadlineCsvRow" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L178 | neighbors=[deadline-csv.ts, import-actions.ts]
- "deadlines_deadline_csv_test_file": "file()" | kind=code-symbol | source=src/features/deadlines/deadline-csv.test.ts:L25 | neighbors=[deadline-csv.test.ts, reasonsFor()]
- "deadlines_deadline_csv_test_parseok": "parseOk()" | kind=code-symbol | source=src/features/deadlines/deadline-csv.test.ts:L29 | neighbors=[deadline-csv.test.ts, reasonsFor()]
- "deadlines_deadline_csv_validdeadlinecsvrow": "ValidDeadlineCsvRow" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L166 | neighbors=[deadline-csv.ts, import-actions.ts]
- "deadlines_import_actions_resolvetask": "resolveTask()" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L139 | neighbors=[import-actions.ts, planImport()]
- "drizzle_0000_complete_adam_warlock_apps": "apps" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L5 | neighbors=[0000_complete_adam_warlock.sql, public.users]
- "drizzle_0000_complete_adam_warlock_public_meetings": "public.meetings" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L85 | neighbors=[0000_complete_adam_warlock.sql, meeting_attendees]
- "drizzle_0000_complete_adam_warlock_public_sprints": "public.sprints" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L91 | neighbors=[0000_complete_adam_warlock.sql, tasks]
- "drizzle_0000_complete_adam_warlock_sprints": "sprints" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L45 | neighbors=[0000_complete_adam_warlock.sql, public.apps]
- "drizzle_0002_gemini_meeting_ai_gemini_keys": "gemini_keys" | kind=code-symbol | source=drizzle/0002_gemini-meeting-ai.sql:L1 | neighbors=[0002_gemini-meeting-ai.sql, public.users]
- "drizzle_0002_gemini_meeting_ai_public_meetings": "public.meetings" | kind=code-symbol | source=drizzle/0002_gemini-meeting-ai.sql:L30 | neighbors=[0002_gemini-meeting-ai.sql, meeting_ai_notes]
- "drizzle_0005_notifications_public_meetings": "public.meetings" | kind=code-symbol | source=drizzle/0005_notifications.sql:L17 | neighbors=[0005_notifications.sql, notifications]
- "drizzle_0005_notifications_public_users": "public.users" | kind=code-symbol | source=drizzle/0005_notifications.sql:L15 | neighbors=[0005_notifications.sql, notifications]
- "drizzle_0007_early_greymalkin_public_meetings": "public.meetings" | kind=code-symbol | source=drizzle/0007_early_greymalkin.sql:L16 | neighbors=[0007_early_greymalkin.sql, meeting_followups]
- "drizzle_0007_early_greymalkin_public_users": "public.users" | kind=code-symbol | source=drizzle/0007_early_greymalkin.sql:L17 | neighbors=[0007_early_greymalkin.sql, meeting_followups]
- "drizzle_0009_app_comments_public_apps": "public.apps" | kind=code-symbol | source=drizzle/0009_app_comments.sql:L9 | neighbors=[0009_app_comments.sql, app_comments]
- "drizzle_0009_app_comments_public_users": "public.users" | kind=code-symbol | source=drizzle/0009_app_comments.sql:L10 | neighbors=[0009_app_comments.sql, app_comments]
- "drizzle_0013_followup_response_note_public_meetings": "public.meetings" | kind=code-symbol | source=drizzle/0013_followup-response-note.sql:L6 | neighbors=[0013_followup-response-note.sql, meeting_followups]
- "drizzle_0013_followup_response_note_public_users": "public.users" | kind=code-symbol | source=drizzle/0013_followup-response-note.sql:L1 | neighbors=[0013_followup-response-note.sql, meeting_followups]
- "drizzle_0014_meeting_note_timeline_public_meeting_note_segments": "public.meeting_note_segments" | kind=code-symbol | source=drizzle/0014_meeting_note_timeline.sql:L74 | neighbors=[0014_meeting_note_timeline.sql, meeting_task_suggestions]
- "drizzle_0014_meeting_note_timeline_public_tasks": "public.tasks" | kind=code-symbol | source=drizzle/0014_meeting_note_timeline.sql:L84 | neighbors=[0014_meeting_note_timeline.sql, meeting_task_suggestions]
- "drizzle_0015_assignment_history_public_apps": "public.apps" | kind=code-symbol | source=drizzle/0015_assignment_history.sql:L17 | neighbors=[0015_assignment_history.sql, assignment_history]
- "drizzle_0015_assignment_history_public_users": "public.users" | kind=code-symbol | source=drizzle/0015_assignment_history.sql:L16 | neighbors=[0015_assignment_history.sql, assignment_history]
- "drizzle_0017_meeting_recording_segments_public_meetings": "public.meetings" | kind=code-symbol | source=drizzle/0017_meeting_recording_segments.sql:L11 | neighbors=[0017_meeting_recording_segments.sql, meeting_recording_segments]
- "drizzle_0017_meeting_recording_segments_public_users": "public.users" | kind=code-symbol | source=drizzle/0017_meeting_recording_segments.sql:L12 | neighbors=[0017_meeting_recording_segments.sql, meeting_recording_segments]
- "drizzle_0018_meeting_screenshots_public_meetings": "public.meetings" | kind=code-symbol | source=drizzle/0018_meeting_screenshots.sql:L14 | neighbors=[0018_meeting_screenshots.sql, meeting_screenshots]
- "drizzle_0018_meeting_screenshots_public_users": "public.users" | kind=code-symbol | source=drizzle/0018_meeting_screenshots.sql:L15 | neighbors=[0018_meeting_screenshots.sql, meeting_screenshots]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-092.json

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
