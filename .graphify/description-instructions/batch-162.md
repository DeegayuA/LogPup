# Node Description Batch 163 of 166

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

- "worklog_catch_up_parse_self_declarable": "SELF_DECLARABLE" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L236 | neighbors=[catch-up-parse.ts]
- "worklog_catch_up_parse_test_days": "DAYS" | kind=code-symbol | source=src/features/worklog/catch-up-parse.test.ts:L18 | neighbors=[catch-up-parse.test.ts]
- "worklog_catch_up_parse_test_fences": "fences" | kind=code-symbol | source=src/features/worklog/catch-up-parse.test.ts:L25 | neighbors=[catch-up-parse.test.ts]
- "worklog_catch_up_parse_test_reply": "reply()" | kind=code-symbol | source=src/features/worklog/catch-up-parse.test.ts:L30 | neighbors=[catch-up-parse.test.ts]
- "worklog_coverage_coverageday": "CoverageDay" | kind=code-symbol | source=src/features/worklog/coverage.ts:L63 | neighbors=[coverage.ts]
- "worklog_coverage_coveragestatus": "CoverageStatus" | kind=code-symbol | source=src/features/worklog/coverage.ts:L20 | neighbors=[coverage.ts]
- "worklog_coverage_round": "round()" | kind=code-symbol | source=src/features/worklog/coverage.ts:L106 | neighbors=[coverage.ts]
- "worklog_coverage_test_holidays": "HOLIDAYS" | kind=code-symbol | source=src/features/worklog/coverage.test.ts:L8 | neighbors=[coverage.test.ts]
- "worklog_coverage_test_input": "input()" | kind=code-symbol | source=src/features/worklog/coverage.test.ts:L10 | neighbors=[coverage.test.ts]
- "worklog_coverage_test_part_time": "PART_TIME" | kind=code-symbol | source=src/features/worklog/coverage.test.ts:L5 | neighbors=[coverage.test.ts]
- "worklog_coverage_test_statusof": "statusOf()" | kind=code-symbol | source=src/features/worklog/coverage.test.ts:L22 | neighbors=[coverage.test.ts]
- "worklog_coverage_weekday_keys": "WEEKDAY_KEYS" | kind=code-symbol | source=src/features/worklog/coverage.ts:L87 | neighbors=[coverage.ts]
- "worklog_day_app_mix_test_entry": "entry()" | kind=code-symbol | source=src/features/worklog/day-app-mix.test.ts:L4 | neighbors=[day-app-mix.test.ts]
- "worklog_day_form_dayformfields": "DayFormFields" | kind=code-symbol | source=src/features/worklog/day-form.ts:L16 | neighbors=[day-form.ts]
- "worklog_day_summary_dayglance": "DayGlance" | kind=code-symbol | source=src/features/worklog/day-summary.ts:L24 | neighbors=[day-summary.ts]
- "worklog_day_summary_test_glance": "glance()" | kind=code-symbol | source=src/features/worklog/day-summary.test.ts:L4 | neighbors=[day-summary.test.ts]
- "worklog_draft_actions_draftschema": "draftSchema" | kind=code-symbol | source=src/features/worklog/draft-actions.ts:L26 | neighbors=[draft-actions.ts]
- "worklog_draft_prompt_draftprojectrole": "DraftProjectRole" | kind=code-symbol | source=src/features/worklog/draft-prompt.ts:L8 | neighbors=[draft-prompt.ts]
- "worklog_draft_prompt_role_phrase": "ROLE_PHRASE" | kind=code-symbol | source=src/features/worklog/draft-prompt.ts:L103 | neighbors=[draft-prompt.ts]
- "worklog_draft_prompt_test_activity": "activity" | kind=code-symbol | source=src/features/worklog/draft-prompt.test.ts:L4 | neighbors=[draft-prompt.test.ts]
- "worklog_entries_entryminutes": "EntryMinutes" | kind=code-symbol | source=src/features/worklog/entries.ts:L38 | neighbors=[entries.ts]
- "worklog_entries_entryproblem": "EntryProblem" | kind=code-symbol | source=src/features/worklog/entries.ts:L129 | neighbors=[entries.ts]
- "worklog_entries_entrysource": "EntrySource" | kind=code-symbol | source=src/features/worklog/entries.ts:L24 | neighbors=[entries.ts]
- "worklog_entries_entryvalidation": "EntryValidation" | kind=code-symbol | source=src/features/worklog/entries.ts:L139 | neighbors=[entries.ts]
- "worklog_entries_test_entry": "entry()" | kind=code-symbol | source=src/features/worklog/entries.test.ts:L13 | neighbors=[entries.test.ts]
- "worklog_entries_validateentryoptions": "ValidateEntryOptions" | kind=code-symbol | source=src/features/worklog/entries.ts:L159 | neighbors=[entries.ts]
- "worklog_entry_actions_createinput": "createInput" | kind=code-symbol | source=src/features/worklog/entry-actions.ts:L80 | neighbors=[entry-actions.ts]
- "worklog_entry_actions_deleteinput": "deleteInput" | kind=code-symbol | source=src/features/worklog/entry-actions.ts:L354 | neighbors=[entry-actions.ts]
- "worklog_entry_actions_entryfields": "entryFields" | kind=code-symbol | source=src/features/worklog/entry-actions.ts:L61 | neighbors=[entry-actions.ts]
- "worklog_entry_actions_test_actormock_canmock_logactivitymock_callgeminimock_getaiprefsmock_aidisabledmock_resolvechainmock_sessionusermock_approvedabsencedaysmock_workschedulemock_orgholidaydaysmock_joindaymock_commitevidencemock": "{\r\n  actorMock,\r\n  canMock,\r\n  logActivityMock,\r\n  callGeminiMock,\r\n  getAiPref…" | kind=code-symbol | source=src/features/worklog/entry-actions.test.ts:L33 | neighbors=[entry-actions.test.ts]
- "worklog_entry_actions_test_insertcalls": "insertCalls" | kind=code-symbol | source=src/features/worklog/entry-actions.test.ts:L100 | neighbors=[entry-actions.test.ts]
- "worklog_entry_actions_test_onehourofadmin": "oneHourOfAdmin()" | kind=code-symbol | source=src/features/worklog/entry-actions.test.ts:L550 | neighbors=[entry-actions.test.ts]
- "worklog_entry_actions_test_readwheresql": "readWhereSql()" | kind=code-symbol | source=src/features/worklog/entry-actions.test.ts:L187 | neighbors=[entry-actions.test.ts]
- "worklog_entry_actions_test_row": "Row" | kind=code-symbol | source=src/features/worklog/entry-actions.test.ts:L93 | neighbors=[entry-actions.test.ts]
- "worklog_entry_actions_test_rowsbytable": "rowsByTable" | kind=code-symbol | source=src/features/worklog/entry-actions.test.ts:L96 | neighbors=[entry-actions.test.ts]
- "worklog_entry_actions_test_selectcalls": "selectCalls" | kind=code-symbol | source=src/features/worklog/entry-actions.test.ts:L98 | neighbors=[entry-actions.test.ts]
- "worklog_entry_actions_test_selectnode": "SelectNode" | kind=code-symbol | source=src/features/worklog/entry-actions.test.ts:L111 | neighbors=[entry-actions.test.ts]
- "worklog_entry_actions_test_updatecalls": "updateCalls" | kind=code-symbol | source=src/features/worklog/entry-actions.test.ts:L99 | neighbors=[entry-actions.test.ts]
- "worklog_entry_actions_test_writewheresql": "writeWhereSql()" | kind=code-symbol | source=src/features/worklog/entry-actions.test.ts:L192 | neighbors=[entry-actions.test.ts]
- "worklog_entry_actions_updateinput": "updateInput" | kind=code-symbol | source=src/features/worklog/entry-actions.ts:L267 | neighbors=[entry-actions.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-162.json

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
