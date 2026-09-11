# Node Description Batch 107 of 166

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

- "people_handover_actions_applyhandover": "applyHandover()" | kind=code-symbol | source=src/features/people/handover-actions.ts:L54 | neighbors=[handover-form.tsx, handover-actions.ts]
- "people_handover_inventory_share": "Share" | kind=code-symbol | source=src/features/people/handover-inventory.ts:L57 | neighbors=[handover-actions.ts, handover-inventory.ts]
- "people_handover_inventory_transferable_groups": "TRANSFERABLE_GROUPS" | kind=code-symbol | source=src/features/people/handover-inventory.ts:L10 | neighbors=[handover-inventory.ts, handover-inventory.test.ts]
- "people_handover_queries_counttransferablework": "countTransferableWork()" | kind=code-symbol | source=src/features/people/handover-queries.ts:L168 | neighbors=[actions.ts, handover-queries.ts]
- "people_handover_queries_gethandoverinventory": "getHandoverInventory()" | kind=code-symbol | source=src/features/people/handover-queries.ts:L54 | neighbors=[page.tsx, handover-queries.ts]
- "people_handover_queries_handovergroup": "HandoverGroup" | kind=code-symbol | source=src/features/people/handover-queries.ts:L34 | neighbors=[handover-form.tsx, handover-queries.ts]
- "people_history_params_compare_windows": "COMPARE_WINDOWS" | kind=code-symbol | source=src/features/people/history-params.ts:L22 | neighbors=[history-filters.tsx, history-params.ts]
- "people_history_params_history_view_label": "HISTORY_VIEW_LABEL" | kind=code-symbol | source=src/features/people/history-params.ts:L15 | neighbors=[history-filters.tsx, history-params.ts]
- "people_history_params_history_views": "HISTORY_VIEWS" | kind=code-symbol | source=src/features/people/history-params.ts:L12 | neighbors=[history-filters.tsx, history-params.ts]
- "people_history_params_rawhistoryparams": "RawHistoryParams" | kind=code-symbol | source=src/features/people/history-params.ts:L38 | neighbors=[page.tsx, history-params.ts]
- "people_history_stats_formatdelta": "formatDelta()" | kind=code-symbol | source=src/features/people/history-stats.ts:L24 | neighbors=[history-stats.ts, buildCapacityHistoryStats()]
- "people_meeting_window_attendeeresponse": "AttendeeResponse" | kind=code-symbol | source=src/features/people/meeting-window.ts:L26 | neighbors=[person-meetings-card.tsx, meeting-window.ts]
- "people_meeting_window_personmeetingentry": "PersonMeetingEntry" | kind=code-symbol | source=src/features/people/meeting-window.ts:L39 | neighbors=[person-meetings-card.tsx, meeting-window.ts]
- "people_meeting_window_personmeetingrow": "PersonMeetingRow" | kind=code-symbol | source=src/features/people/meeting-window.ts:L28 | neighbors=[meeting-window.ts, meeting-window.test.ts]
- "people_meeting_window_personmeetings": "PersonMeetings" | kind=code-symbol | source=src/features/people/meeting-window.ts:L44 | neighbors=[meeting-window.ts, queries.ts]
- "people_now_capitalise": "capitalise()" | kind=code-symbol | source=src/features/people/now.ts:L156 | neighbors=[now.ts, actionSentence()]
- "people_now_empty_now": "EMPTY_NOW" | kind=code-symbol | source=src/features/people/now.ts:L50 | neighbors=[now.ts, queries.ts]
- "people_now_isoverdue": "isOverdue()" | kind=code-symbol | source=src/features/people/now.ts:L91 | neighbors=[now.ts, now.test.ts]
- "people_now_nowtask": "NowTask" | kind=code-symbol | source=src/features/people/now.ts:L22 | neighbors=[now.ts, now.test.ts]
- "people_now_recentaction": "RecentAction" | kind=code-symbol | source=src/features/people/now.ts:L34 | neighbors=[now.ts, now.test.ts]
- "people_person_stats_allocationmeta": "allocationMeta()" | kind=code-symbol | source=src/features/people/person-stats.ts:L56 | neighbors=[person-stats.ts, buildPersonStats()]
- "people_person_stats_followuptone": "followupTone()" | kind=code-symbol | source=src/features/people/person-stats.ts:L145 | neighbors=[person-stats.ts, buildPersonStats()]
- "people_person_stats_personstatsinput": "PersonStatsInput" | kind=code-symbol | source=src/features/people/person-stats.ts:L38 | neighbors=[person-stats.ts, person-stats.test.ts]
- "people_queries_getcapacityhistoryoverview": "getCapacityHistoryOverview()" | kind=code-symbol | source=src/features/people/queries.ts:L373 | neighbors=[page.tsx, queries.ts]
- "people_queries_getpeoplenow": "getPeopleNow" | kind=code-symbol | source=src/features/people/queries.ts:L1019 | neighbors=[page.tsx, queries.ts]
- "people_queries_getpersonactivity": "getPersonActivity()" | kind=code-symbol | source=src/features/people/queries.ts:L677 | neighbors=[page.tsx, queries.ts]
- "people_queries_getpersonallocationhistory": "getPersonAllocationHistory()" | kind=code-symbol | source=src/features/people/queries.ts:L539 | neighbors=[page.tsx, queries.ts]
- "people_queries_getpersonapprolehistory": "getPersonAppRoleHistory()" | kind=code-symbol | source=src/features/people/queries.ts:L596 | neighbors=[page.tsx, queries.ts]
- "people_queries_personactivity": "PersonActivity" | kind=code-symbol | source=src/features/people/queries.ts:L632 | neighbors=[person-activity-card.tsx, queries.ts]
- "people_queries_personapproleentry": "PersonAppRoleEntry" | kind=code-symbol | source=src/features/people/queries.ts:L571 | neighbors=[app-role-history-card.tsx, queries.ts]
- "people_queries_personassignment": "PersonAssignment" | kind=code-symbol | source=src/features/people/queries.ts:L125 | neighbors=[assignments-card.tsx, queries.ts]
- "people_queries_personmeetingsview": "PersonMeetingsView" | kind=code-symbol | source=src/features/people/queries.ts:L949 | neighbors=[person-meetings-card.tsx, queries.ts]
- "people_queries_personoverview": "PersonOverview" | kind=code-symbol | source=src/features/people/queries.ts:L157 | neighbors=[person-header.tsx, queries.ts]
- "people_removal_queries_openremovalof": "openRemovalOf()" | kind=code-symbol | source=src/features/people/removal-queries.ts:L39 | neighbors=[removal-queries.ts, notRemoved()]
- "people_removal_queries_toremovalmap": "toRemovalMap()" | kind=code-symbol | source=src/features/people/removal-queries.ts:L72 | neighbors=[removal-queries.ts, openRemovals()]
- "people_search_providers_searchproviders": "searchProviders" | kind=code-symbol | source=src/features/people/search-providers.ts:L31 | neighbors=[search-providers.ts, providers.ts]
- "people_summary_actions_getpersonsummary": "getPersonSummary()" | kind=code-symbol | source=src/features/people/summary-actions.ts:L37 | neighbors=[person-summary-card.tsx, summary-actions.ts]
- "people_summary_plural": "plural()" | kind=code-symbol | source=src/features/people/summary.ts:L73 | neighbors=[summary.ts, derivePersonSummary()]
- "people_task_workload_compareopentasks": "compareOpenTasks()" | kind=code-symbol | source=src/features/people/task-workload.ts:L79 | neighbors=[task-workload.ts, task-workload.test.ts]
- "people_task_workload_due_state_label": "DUE_STATE_LABEL" | kind=code-symbol | source=src/features/people/task-workload.ts:L50 | neighbors=[context-pack.ts, task-workload.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-106.json

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
