# Node Description Batch 154 of 166

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

- "people_cohort_filter_test_all": "ALL" | kind=code-symbol | source=src/features/people/cohort-filter.test.ts:L33 | neighbors=[cohort-filter.test.ts]
- "people_cohort_filter_test_apollo": "APOLLO" | kind=code-symbol | source=src/features/people/cohort-filter.test.ts:L29 | neighbors=[cohort-filter.test.ts]
- "people_cohort_filter_test_defaults": "DEFAULTS" | kind=code-symbol | source=src/features/people/cohort-filter.test.ts:L10 | neighbors=[cohort-filter.test.ts]
- "people_cohort_filter_test_f": "f()" | kind=code-symbol | source=src/features/people/cohort-filter.test.ts:L11 | neighbors=[cohort-filter.test.ts]
- "people_cohort_filter_test_kestrel": "KESTREL" | kind=code-symbol | source=src/features/people/cohort-filter.test.ts:L25 | neighbors=[cohort-filter.test.ts]
- "people_cohort_filter_test_project": "project()" | kind=code-symbol | source=src/features/people/cohort-filter.test.ts:L13 | neighbors=[cohort-filter.test.ts]
- "people_cohort_filter_test_tessera": "TESSERA" | kind=code-symbol | source=src/features/people/cohort-filter.test.ts:L32 | neighbors=[cohort-filter.test.ts]
- "people_cohort_params_cohortview": "CohortView" | kind=code-symbol | source=src/features/people/cohort-params.ts:L21 | neighbors=[cohort-params.ts]
- "people_cohorts_projectoverlap": "ProjectOverlap" | kind=code-symbol | source=src/features/people/cohorts.ts:L171 | neighbors=[cohorts.ts]
- "people_commands_cohort_commands": "COHORT_COMMANDS" | kind=code-symbol | source=src/features/people/commands.ts:L37 | neighbors=[commands.ts]
- "people_error_peopleerror": "PeopleError()" | kind=code-symbol | source=src/app/(app)/people/error.tsx:L19 | neighbors=[error.tsx]
- "people_followup_split_followupkind": "FollowupKind" | kind=code-symbol | source=src/features/people/followup-split.ts:L33 | neighbors=[followup-split.ts]
- "people_followup_split_hasbecomeatask": "hasBecomeATask()" | kind=code-symbol | source=src/features/people/followup-split.ts:L107 | neighbors=[followup-split.ts]
- "people_followup_split_oldestfirst": "oldestFirst()" | kind=code-symbol | source=src/features/people/followup-split.ts:L117 | neighbors=[followup-split.ts]
- "people_followup_split_test_followup": "followup()" | kind=code-symbol | source=src/features/people/followup-split.test.ts:L8 | neighbors=[followup-split.test.ts]
- "people_followup_split_withage": "withAge()" | kind=code-symbol | source=src/features/people/followup-split.ts:L111 | neighbors=[followup-split.ts]
- "people_format_instant_parts": "Parts" | kind=code-symbol | source=src/features/people/format-instant.ts:L38 | neighbors=[format-instant.ts]
- "people_handover_actions_applyinput": "applyInput" | kind=code-symbol | source=src/features/people/handover-actions.ts:L14 | neighbors=[handover-actions.ts]
- "people_handover_actions_shareinput": "shareInput" | kind=code-symbol | source=src/features/people/handover-actions.ts:L12 | neighbors=[handover-actions.ts]
- "people_handover_queries_handoverinventory": "HandoverInventory" | kind=code-symbol | source=src/features/people/handover-queries.ts:L40 | neighbors=[handover-queries.ts]
- "people_handover_queries_handoveritem": "HandoverItem" | kind=code-symbol | source=src/features/people/handover-queries.ts:L16 | neighbors=[handover-queries.ts]
- "people_history_params_comparewindow": "CompareWindow" | kind=code-symbol | source=src/features/people/history-params.ts:L23 | neighbors=[history-params.ts]
- "people_history_params_historyview": "HistoryView" | kind=code-symbol | source=src/features/people/history-params.ts:L13 | neighbors=[history-params.ts]
- "people_history_params_test_now": "NOW" | kind=code-symbol | source=src/features/people/history-params.test.ts:L9 | neighbors=[history-params.test.ts]
- "people_history_stats_capacityhistorystatsinput": "CapacityHistoryStatsInput" | kind=code-symbol | source=src/features/people/history-stats.ts:L16 | neighbors=[history-stats.ts]
- "people_loading_peopleloading": "PeopleLoading()" | kind=code-symbol | source=src/app/(app)/people/loading.tsx:L17 | neighbors=[loading.tsx]
- "people_meeting_window_defaults": "DEFAULTS" | kind=code-symbol | source=src/features/people/meeting-window.ts:L72 | neighbors=[meeting-window.ts]
- "people_meeting_window_splitoptions": "SplitOptions" | kind=code-symbol | source=src/features/people/meeting-window.ts:L66 | neighbors=[meeting-window.ts]
- "people_meeting_window_test_meeting": "meeting()" | kind=code-symbol | source=src/features/people/meeting-window.test.ts:L8 | neighbors=[meeting-window.test.ts]
- "people_meeting_window_test_now": "NOW" | kind=code-symbol | source=src/features/people/meeting-window.test.ts:L4 | neighbors=[meeting-window.test.ts]
- "people_now_test_action": "action()" | kind=code-symbol | source=src/features/people/now.test.ts:L26 | neighbors=[now.test.ts]
- "people_now_test_task": "task()" | kind=code-symbol | source=src/features/people/now.test.ts:L15 | neighbors=[now.test.ts]
- "people_now_verb_past": "VERB_PAST" | kind=code-symbol | source=src/features/people/now.ts:L125 | neighbors=[now.ts]
- "people_page_adminpeoplepage": "AdminPeoplePage()" | kind=code-symbol | source=src/app/(app)/admin/people/page.tsx:L9 | neighbors=[page.tsx]
- "people_page_cohortdata": "CohortData()" | kind=code-symbol | source=src/app/(app)/people/page.tsx:L172 | neighbors=[page.tsx]
- "people_page_directorydata": "DirectoryData()" | kind=code-symbol | source=src/app/(app)/people/page.tsx:L147 | neighbors=[page.tsx]
- "people_page_nobodyyet": "NobodyYet()" | kind=code-symbol | source=src/app/(app)/people/page.tsx:L86 | neighbors=[page.tsx]
- "people_page_peoplepage": "PeoplePage()" | kind=code-symbol | source=src/app/(app)/people/page.tsx:L98 | neighbors=[page.tsx]
- "people_person_stats_test_input": "input()" | kind=code-symbol | source=src/features/people/person-stats.test.ts:L4 | neighbors=[person-stats.test.ts]
- "people_person_stats_test_stat": "stat()" | kind=code-symbol | source=src/features/people/person-stats.test.ts:L20 | neighbors=[person-stats.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-153.json

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
