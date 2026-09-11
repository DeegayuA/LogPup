# Node Description Batch 113 of 166

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

- "worklog_progress_params_progress_range_label": "PROGRESS_RANGE_LABEL" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L21 | neighbors=[progress-filters.tsx, progress-params.ts]
- "worklog_progress_params_progress_ranges": "PROGRESS_RANGES" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L18 | neighbors=[progress-filters.tsx, progress-params.ts]
- "worklog_progress_params_progresswindow": "ProgressWindow" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L126 | neighbors=[progress-filters.tsx, progress-params.ts]
- "worklog_progress_params_rawprogressparams": "RawProgressParams" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L42 | neighbors=[page.tsx, progress-params.ts]
- "worklog_progress_params_shiftmonthfirst": "shiftMonthFirst()" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L119 | neighbors=[progress-params.ts, resolveProgressWindow()]
- "worklog_progress_queries_getprogressapps": "getProgressApps()" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L400 | neighbors=[page.tsx, progress-queries.ts]
- "worklog_progress_queries_listprogressappoptions": "listProgressAppOptions()" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L351 | neighbors=[page.tsx, progress-queries.ts]
- "worklog_progress_queries_progressappoption": "ProgressAppOption" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L344 | neighbors=[progress-filters.tsx, progress-queries.ts]
- "worklog_progress_queries_progressapprow": "ProgressAppRow" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L378 | neighbors=[progress-apps-lane.tsx, progress-queries.ts]
- "worklog_progress_queries_progressmatrixdata": "ProgressMatrixData" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L58 | neighbors=[progress-matrix.tsx, progress-queries.ts]
- "worklog_progress_queries_progressscope": "ProgressScope" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L32 | neighbors=[page.tsx, progress-queries.ts]
- "worklog_progress_queries_progresssprint": "ProgressSprint" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L365 | neighbors=[progress-apps-lane.tsx, progress-queries.ts]
- "worklog_queries_getmydecidedabsences": "getMyDecidedAbsences()" | kind=code-symbol | source=src/features/worklog/queries.ts:L280 | neighbors=[page.tsx, queries.ts]
- "worklog_queries_getorgholidaydays": "getOrgHolidayDays()" | kind=code-symbol | source=src/features/worklog/queries.ts:L414 | neighbors=[entry-evidence.ts, queries.ts]
- "worklog_queries_listapptagtargets": "listAppTagTargets()" | kind=code-symbol | source=src/features/worklog/queries.ts:L126 | neighbors=[page.tsx, queries.ts]
- "worklog_review_rules_canreviewworklogday": "canReviewWorklogDay()" | kind=code-symbol | source=src/features/worklog/review-rules.ts:L66 | neighbors=[review-rules.ts, review-rules.test.ts]
- "worklog_review_rules_worklogdayappids": "worklogDayAppIds()" | kind=code-symbol | source=src/features/worklog/review-rules.ts:L40 | neighbors=[review-rules.ts, review-rules.test.ts]
- "worklog_worklog_day_summarizeworklogs": "summarizeWorklogs()" | kind=code-symbol | source=src/features/worklog/worklog-day.ts:L59 | neighbors=[worklog-day.ts, worklog-day.test.ts]
- "absences_page_adminabsencespage": "AdminAbsencesPage()" | kind=code-symbol | source=src/app/(app)/admin/absences/page.tsx:L11 | neighbors=[page.tsx]
- "activity_actions_loadolderinput": "loadOlderInput" | kind=code-symbol | source=src/features/activity/actions.ts:L35 | neighbors=[actions.ts]
- "activity_actions_loadolderresult": "LoadOlderResult" | kind=code-symbol | source=src/features/activity/actions.ts:L61 | neighbors=[actions.ts]
- "activity_commands_range": "range()" | kind=code-symbol | source=src/features/activity/commands.ts:L30 | neighbors=[commands.ts]
- "activity_commands_shiftdays": "shiftDays()" | kind=code-symbol | source=src/features/activity/commands.ts:L34 | neighbors=[commands.ts]
- "activity_commands_today": "today()" | kind=code-symbol | source=src/features/activity/commands.ts:L21 | neighbors=[commands.ts]
- "activity_describe_months": "MONTHS" | kind=code-symbol | source=src/features/activity/describe.ts:L13 | neighbors=[describe.ts]
- "activity_describe_test_empty": "EMPTY" | kind=code-symbol | source=src/features/activity/describe.test.ts:L5 | neighbors=[describe.test.ts]
- "activity_error_activityerror": "ActivityError()" | kind=code-symbol | source=src/app/(app)/activity/error.tsx:L18 | neighbors=[error.tsx]
- "activity_filters_test_dialect": "dialect" | kind=code-symbol | source=src/features/activity/filters.test.ts:L20 | neighbors=[filters.test.ts]
- "activity_format_activitydaygroup": "ActivityDayGroup" | kind=code-symbol | source=src/features/activity/format.ts:L54 | neighbors=[format.ts]
- "activity_format_activityentry": "ActivityEntry" | kind=code-symbol | source=src/features/activity/format.ts:L96 | neighbors=[format.ts]
- "activity_format_test_row": "row()" | kind=code-symbol | source=src/features/activity/format.test.ts:L11 | neighbors=[format.test.ts]
- "activity_format_verb_phrases": "VERB_PHRASES" | kind=code-symbol | source=src/features/activity/format.ts:L10 | neighbors=[format.ts]
- "activity_loading_loadingactivity": "LoadingActivity()" | kind=code-symbol | source=src/app/(app)/activity/loading.tsx:L22 | neighbors=[loading.tsx]
- "activity_log_test_input": "INPUT" | kind=code-symbol | source=src/features/activity/log.test.ts:L24 | neighbors=[log.test.ts]
- "activity_log_test_insertspy_valuesspy": "{ insertSpy, valuesSpy }" | kind=code-symbol | source=src/features/activity/log.test.ts:L8 | neighbors=[log.test.ts]
- "activity_page_activitycontrols": "ActivityControls()" | kind=code-symbol | source=src/app/(app)/activity/page.tsx:L217 | neighbors=[page.tsx]
- "activity_page_activitydescription": "ActivityDescription()" | kind=code-symbol | source=src/app/(app)/activity/page.tsx:L178 | neighbors=[page.tsx]
- "activity_page_activitypageparams": "ActivityPageParams" | kind=code-symbol | source=src/app/(app)/activity/page.tsx:L83 | neighbors=[page.tsx]
- "activity_page_metadata": "metadata" | kind=code-symbol | source=src/app/(app)/activity/page.tsx:L31 | neighbors=[page.tsx]
- "activity_page_paramsschema": "paramsSchema" | kind=code-symbol | source=src/app/(app)/activity/page.tsx:L71 | neighbors=[page.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-112.json

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
