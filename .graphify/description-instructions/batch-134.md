# Node Description Batch 135 of 166

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

- "db_schema_allocationchange": "allocationChange" | kind=code-symbol | source=src/db/schema.ts:L123 | neighbors=[schema.ts]
- "db_schema_approlekind": "appRoleKind" | kind=code-symbol | source=src/db/schema.ts:L94 | neighbors=[schema.ts]
- "db_schema_appstatus": "appStatus" | kind=code-symbol | source=src/db/schema.ts:L32 | neighbors=[schema.ts]
- "db_schema_attendancechange": "attendanceChange" | kind=code-symbol | source=src/db/schema.ts:L128 | neighbors=[schema.ts]
- "db_schema_attendeeresponse": "attendeeResponse" | kind=code-symbol | source=src/db/schema.ts:L118 | neighbors=[schema.ts]
- "db_schema_changerequestop": "changeRequestOp" | kind=code-symbol | source=src/db/schema.ts:L38 | neighbors=[schema.ts]
- "db_schema_changerequeststatus": "changeRequestStatus" | kind=code-symbol | source=src/db/schema.ts:L37 | neighbors=[schema.ts]
- "db_schema_duekind": "dueKind" | kind=code-symbol | source=src/db/schema.ts:L110 | neighbors=[schema.ts]
- "db_schema_employmenttype": "employmentType" | kind=code-symbol | source=src/db/schema.ts:L74 | neighbors=[schema.ts]
- "db_schema_followupkind": "followupKind" | kind=code-symbol | source=src/db/schema.ts:L119 | neighbors=[schema.ts]
- "db_schema_followupstatus": "followupStatus" | kind=code-symbol | source=src/db/schema.ts:L120 | neighbors=[schema.ts]
- "db_schema_loggingexpectation": "loggingExpectation" | kind=code-symbol | source=src/db/schema.ts:L80 | neighbors=[schema.ts]
- "db_schema_meetingattendeerecommendationsurface": "MeetingAttendeeRecommendationSurface" | kind=code-symbol | source=src/db/schema.ts:L783 | neighbors=[schema.ts]
- "db_schema_meetingattendeerecommendationtier": "MeetingAttendeeRecommendationTier" | kind=code-symbol | source=src/db/schema.ts:L786 | neighbors=[schema.ts]
- "db_schema_meetingseriesattendees": "meetingSeriesAttendees" | kind=code-symbol | source=src/db/schema.ts:L637 | neighbors=[schema.ts]
- "db_schema_notesource": "noteSource" | kind=code-symbol | source=src/db/schema.ts:L121 | neighbors=[schema.ts]
- "db_schema_notificationtype": "notificationType" | kind=code-symbol | source=src/db/schema.ts:L117 | neighbors=[schema.ts]
- "db_schema_sprintstatus": "sprintStatus" | kind=code-symbol | source=src/db/schema.ts:L95 | neighbors=[schema.ts]
- "db_schema_suggestionstatus": "suggestionStatus" | kind=code-symbol | source=src/db/schema.ts:L122 | neighbors=[schema.ts]
- "db_schema_taskstatus": "taskStatus" | kind=code-symbol | source=src/db/schema.ts:L111 | neighbors=[schema.ts]
- "db_schema_userstatus": "userStatus" | kind=code-symbol | source=src/db/schema.ts:L31 | neighbors=[schema.ts]
- "db_schema_worklogentrycategory": "worklogEntryCategory" | kind=code-symbol | source=src/db/schema.ts:L85 | neighbors=[schema.ts]
- "db_schema_worklogentrysource": "worklogEntrySource" | kind=code-symbol | source=src/db/schema.ts:L89 | neighbors=[schema.ts]
- "db_schema_worklogscoresource": "worklogScoreSource" | kind=code-symbol | source=src/db/schema.ts:L68 | neighbors=[schema.ts]
- "db_write_gate_freeze_exempt_tables": "FREEZE_EXEMPT_TABLES" | kind=code-symbol | source=src/db/write-gate.ts:L46 | neighbors=[write-gate.ts]
- "db_write_gate_gated": "gated" | kind=code-symbol | source=src/db/write-gate.ts:L55 | neighbors=[write-gate.ts]
- "db_write_gate_test_assertwritable": "assertWritable" | kind=code-symbol | source=src/db/write-gate.test.ts:L17 | neighbors=[write-gate.test.ts]
- "db_write_gate_test_fakebuilder": "fakeBuilder()" | kind=code-symbol | source=src/db/write-gate.test.ts:L23 | neighbors=[write-gate.test.ts]
- "deactivated_page_deactivatedpage": "DeactivatedPage()" | kind=code-symbol | source=src/app/deactivated/page.tsx:L30 | neighbors=[page.tsx]
- "deactivated_page_metadata": "metadata" | kind=code-symbol | source=src/app/deactivated/page.tsx:L9 | neighbors=[page.tsx]
- "deadlines_deadline_csv_buildheaderindex": "buildHeaderIndex()" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L273 | neighbors=[deadline-csv.ts]
- "deadlines_deadline_csv_deadline_csv_columns": "DEADLINE_CSV_COLUMNS" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L60 | neighbors=[deadline-csv.ts]
- "deadlines_deadline_csv_deadlinecsvcolumn": "DeadlineCsvColumn" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L43 | neighbors=[deadline-csv.ts]
- "deadlines_deadline_csv_deadlinecsvcolumnspec": "DeadlineCsvColumnSpec" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L45 | neighbors=[deadline-csv.ts]
- "deadlines_deadline_csv_deadlinecsvparse": "DeadlineCsvParse" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L185 | neighbors=[deadline-csv.ts]
- "deadlines_deadline_csv_example_by_column": "EXAMPLE_BY_COLUMN" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L135 | neighbors=[deadline-csv.ts]
- "deadlines_deadline_csv_header_index": "HEADER_INDEX" | kind=code-symbol | source=src/features/deadlines/deadline-csv.ts:L282 | neighbors=[deadline-csv.ts]
- "deadlines_deadline_csv_test_header": "HEADER" | kind=code-symbol | source=src/features/deadlines/deadline-csv.test.ts:L23 | neighbors=[deadline-csv.test.ts]
- "deadlines_import_actions_deadlinecsvinput": "deadlineCsvInput" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L52 | neighbors=[import-actions.ts]
- "deadlines_import_actions_deadlineimportpreview": "DeadlineImportPreview" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L68 | neighbors=[import-actions.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-134.json

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
