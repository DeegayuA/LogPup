# Node Description Batch 119 of 166

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

- "auth_error_page_default_copy": "DEFAULT_COPY" | kind=code-symbol | source=src/app/auth-error/page.tsx:L52 | neighbors=[page.tsx]
- "auth_error_page_error_copy": "ERROR_COPY" | kind=code-symbol | source=src/app/auth-error/page.tsx:L18 | neighbors=[page.tsx]
- "auth_error_page_metadata": "metadata" | kind=code-symbol | source=src/app/auth-error/page.tsx:L13 | neighbors=[page.tsx]
- "auth_google_one_tap_googleidentity": "GoogleIdentity" | kind=code-symbol | source=src/features/auth/google-one-tap.ts:L42 | neighbors=[google-one-tap.ts]
- "auth_google_one_tap_tokeninfo": "TokenInfo" | kind=code-symbol | source=src/features/auth/google-one-tap.ts:L31 | neighbors=[google-one-tap.ts]
- "auth_google_one_tap_valid_issuers": "VALID_ISSUERS" | kind=code-symbol | source=src/features/auth/google-one-tap.ts:L48 | neighbors=[google-one-tap.ts]
- "bugs_actions_test_as": "as()" | kind=code-symbol | source=src/features/bugs/actions.test.ts:L75 | neighbors=[actions.test.ts]
- "bugs_actions_test_authmock_getbugscopemock_insertspy_updatespy_logactivitymock_selectrows": "{ authMock, getBugScopeMock, insertSpy, updateSpy, logActivityMock, selectRows }" | kind=code-symbol | source=src/features/bugs/actions.test.ts:L16 | neighbors=[actions.test.ts]
- "bugs_actions_test_builder": "builder()" | kind=code-symbol | source=src/features/bugs/actions.test.ts:L34 | neighbors=[actions.test.ts]
- "bugs_actions_test_inserted": "inserted()" | kind=code-symbol | source=src/features/bugs/actions.test.ts:L78 | neighbors=[actions.test.ts]
- "bugs_actions_test_report": "report()" | kind=code-symbol | source=src/features/bugs/actions.test.ts:L81 | neighbors=[actions.test.ts]
- "bugs_actions_test_updated": "updated()" | kind=code-symbol | source=src/features/bugs/actions.test.ts:L79 | neighbors=[actions.test.ts]
- "bugs_bug_csv_bugcsvcolumn": "BugCsvColumn" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L63 | neighbors=[bug-csv.ts]
- "bugs_bug_csv_bugcsvcolumnspec": "BugCsvColumnSpec" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L71 | neighbors=[bug-csv.ts]
- "bugs_bug_csv_bugcsvfields": "bugCsvFields" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L361 | neighbors=[bug-csv.ts]
- "bugs_bug_csv_bugcsvparse": "BugCsvParse" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L330 | neighbors=[bug-csv.ts]
- "bugs_bug_csv_buildheaderindex": "buildHeaderIndex()" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L286 | neighbors=[bug-csv.ts]
- "bugs_bug_csv_example_by_column": "EXAMPLE_BY_COLUMN" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L199 | neighbors=[bug-csv.ts]
- "bugs_bug_csv_header_index": "HEADER_INDEX" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L295 | neighbors=[bug-csv.ts]
- "bugs_bug_csv_required_columns": "REQUIRED_COLUMNS" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L139 | neighbors=[bug-csv.ts]
- "bugs_bug_csv_test_header": "HEADER" | kind=code-symbol | source=src/features/bugs/bug-csv.test.ts:L28 | neighbors=[bug-csv.test.ts]
- "bugs_bug_display_bugbadgevariant": "BugBadgeVariant" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L91 | neighbors=[bug-display.ts]
- "bugs_bug_display_severity_labels": "SEVERITY_LABELS" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L62 | neighbors=[bug-display.ts]
- "bugs_bug_display_severity_variants": "SEVERITY_VARIANTS" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L102 | neighbors=[bug-display.ts]
- "bugs_bug_display_status_labels": "STATUS_LABELS" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L69 | neighbors=[bug-display.ts]
- "bugs_bug_display_status_variants": "STATUS_VARIANTS" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L109 | neighbors=[bug-display.ts]
- "bugs_commands_actorfor": "actorFor()" | kind=code-symbol | source=src/features/bugs/commands.ts:L41 | neighbors=[commands.ts]
- "bugs_commands_empty_scope": "EMPTY_SCOPE" | kind=code-symbol | source=src/features/bugs/commands.ts:L39 | neighbors=[commands.ts]
- "bugs_import_actions_bugcsvimportinput": "bugCsvImportInput" | kind=code-symbol | source=src/features/bugs/import-actions.ts:L60 | neighbors=[import-actions.ts]
- "bugs_import_actions_bugimportpreviewrow": "BugImportPreviewRow" | kind=code-symbol | source=src/features/bugs/import-actions.ts:L69 | neighbors=[import-actions.ts]
- "bugs_import_actions_bugimportresult": "BugImportResult" | kind=code-symbol | source=src/features/bugs/import-actions.ts:L88 | neighbors=[import-actions.ts]
- "bugs_page_adminbugspage": "AdminBugsPage()" | kind=code-symbol | source=src/app/(app)/admin/bugs/page.tsx:L37 | neighbors=[page.tsx]
- "bugs_page_queuefilterhref": "queueFilterHref()" | kind=code-symbol | source=src/app/(app)/admin/bugs/page.tsx:L72 | neighbors=[page.tsx]
- "bugs_page_triagequeue": "TriageQueue()" | kind=code-symbol | source=src/app/(app)/admin/bugs/page.tsx:L84 | neighbors=[page.tsx]
- "bugs_queries_assignee": "assignee" | kind=code-symbol | source=src/features/bugs/queries.ts:L68 | neighbors=[queries.ts]
- "bugs_queries_bugcolumns": "bugColumns" | kind=code-symbol | source=src/features/bugs/queries.ts:L75 | neighbors=[queries.ts]
- "bugs_queries_getbugbyid": "getBugById()" | kind=code-symbol | source=src/features/bugs/queries.ts:L125 | neighbors=[queries.ts]
- "bugs_queries_openbugcount": "OpenBugCount" | kind=code-symbol | source=src/features/bugs/queries.ts:L163 | neighbors=[queries.ts]
- "bugs_queries_reporter": "reporter" | kind=code-symbol | source=src/features/bugs/queries.ts:L67 | neighbors=[queries.ts]
- "bugs_queue_page_test_cursor": "CURSOR" | kind=code-symbol | source=src/features/bugs/queue-page.test.ts:L19 | neighbors=[queue-page.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-118.json

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
