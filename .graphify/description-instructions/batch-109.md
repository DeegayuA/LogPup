# Node Description Batch 110 of 166

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

- "sprints_board_view_group_by_values": "GROUP_BY_VALUES" | kind=code-symbol | source=src/features/sprints/board-view.ts:L105 | neighbors=[board-toolbar.tsx, board-view.ts]
- "sprints_board_view_groupby": "GroupBy" | kind=code-symbol | source=src/features/sprints/board-view.ts:L106 | neighbors=[board-toolbar.tsx, board-view.ts]
- "sprints_board_view_splitlist": "splitList()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L138 | neighbors=[board-view.ts, parseBoardView()]
- "sprints_checkin_actions_unexpected": "unexpected()" | kind=code-symbol | source=src/features/sprints/checkin-actions.ts:L33 | neighbors=[checkin-actions.ts, upsertSprintCheckin()]
- "sprints_checkin_queries_sprintcheckinrow": "SprintCheckinRow" | kind=code-symbol | source=src/features/sprints/checkin-queries.ts:L5 | neighbors=[page.tsx, checkin-queries.ts]
- "sprints_checkins_taskforprogress": "TaskForProgress" | kind=code-symbol | source=src/features/sprints/checkins.ts:L10 | neighbors=[checkins.ts, checkins.test.ts]
- "sprints_due_date_hasslipped": "hasSlipped()" | kind=code-symbol | source=src/features/sprints/due-date.ts:L133 | neighbors=[due-date.ts, due-date.test.ts]
- "sprints_paste_actions_drafttasksfrompaste": "draftTasksFromPaste()" | kind=code-symbol | source=src/features/sprints/paste-actions.ts:L63 | neighbors=[task-composer.tsx, paste-actions.ts]
- "sprints_permissions_test": "permissions.test.ts" | kind=code-symbol | source=src/features/sprints/permissions.test.ts:L1 | neighbors=[permissions.ts, canMoveTask()]
- "sprints_plan_read_daysleftphrase": "daysLeftPhrase()" | kind=code-symbol | source=src/features/sprints/plan-read.ts:L185 | neighbors=[plan-read.ts, readSprint()]
- "sprints_plan_read_sprinthealth": "SprintHealth" | kind=code-symbol | source=src/features/sprints/plan-read.ts:L52 | neighbors=[roadmap-spine.tsx, plan-read.ts]
- "sprints_promises_gradepromises": "gradePromises()" | kind=code-symbol | source=src/features/sprints/promises.ts:L80 | neighbors=[promises.ts, promises.test.ts]
- "sprints_promises_promiserow": "PromiseRow" | kind=code-symbol | source=src/features/sprints/promises.ts:L16 | neighbors=[promises.ts, promises.test.ts]
- "sprints_promises_promisessummary": "promisesSummary()" | kind=code-symbol | source=src/features/sprints/promises.ts:L115 | neighbors=[promises.ts, promises.test.ts]
- "sprints_promises_shortdate": "shortDate()" | kind=code-symbol | source=src/features/sprints/promises.ts:L50 | neighbors=[promises.ts, slipLineFor()]
- "sprints_queries_activesprintsummary": "ActiveSprintSummary" | kind=code-symbol | source=src/features/sprints/queries.ts:L43 | neighbors=[active-sprints.tsx, queries.ts]
- "sprints_queries_getnextupcomingsprint": "getNextUpcomingSprint()" | kind=code-symbol | source=src/features/sprints/queries.ts:L166 | neighbors=[dashboard-zones.tsx, queries.ts]
- "sprints_queries_getsprintsforapp": "getSprintsForApp()" | kind=code-symbol | source=src/features/sprints/queries.ts:L67 | neighbors=[page.tsx, queries.ts]
- "sprints_queries_getsprinttaskcounts": "getSprintTaskCounts()" | kind=code-symbol | source=src/features/sprints/queries.ts:L198 | neighbors=[page.tsx, queries.ts]
- "sprints_queries_sprinttaskcounts": "SprintTaskCounts" | kind=code-symbol | source=src/features/sprints/queries.ts:L196 | neighbors=[page.tsx, queries.ts]
- "sprints_queries_upcomingsprintsummary": "UpcomingSprintSummary" | kind=code-symbol | source=src/features/sprints/queries.ts:L59 | neighbors=[active-sprints.tsx, queries.ts]
- "sprints_roadmap_geometry_daysfromoffset": "daysFromOffset()" | kind=code-symbol | source=src/features/sprints/roadmap-geometry.ts:L59 | neighbors=[roadmap-geometry.ts, roadmap-geometry.test.ts]
- "sprints_roadmap_geometry_diffdaysinclusive": "diffDaysInclusive()" | kind=code-symbol | source=src/features/sprints/roadmap-geometry.ts:L48 | neighbors=[roadmap-geometry.ts, parseIsoDate()]
- "sprints_roadmap_geometry_toisodate": "toIsoDate()" | kind=code-symbol | source=src/features/sprints/roadmap-geometry.ts:L34 | neighbors=[roadmap-geometry.ts, addDays()]
- "sprints_search_providers_searchproviders": "searchProviders" | kind=code-symbol | source=src/features/sprints/search-providers.ts:L59 | neighbors=[providers.ts, search-providers.ts]
- "sprints_sprint_date_range_sprintrange": "SprintRange" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L83 | neighbors=[roadmap-timeline.tsx, sprint-date-range.ts]
- "sprints_sprint_date_range_sprintstatus": "SprintStatus" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L131 | neighbors=[app-health.ts, sprint-date-range.ts]
- "sprints_sprint_date_range_toisodate": "toIsoDate()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L26 | neighbors=[sprint-date-range.ts, addCalendarDays()]
- "sprints_suggest_actions_suggestsprint": "suggestSprint()" | kind=code-symbol | source=src/features/sprints/suggest-actions.ts:L50 | neighbors=[sprint-form-dialog.tsx, suggest-actions.ts]
- "sprints_task_actions_nextrankfor": "nextRankFor()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L277 | neighbors=[task-actions.ts, createTask()]
- "sprints_task_rank_ranked": "Ranked" | kind=code-symbol | source=src/features/sprints/task-rank.ts:L45 | neighbors=[task-rank.ts, task-rank.test.ts]
- "texts_counting_number_countingnumber": "CountingNumber()" | kind=code-symbol | source=src/components/animate-ui/primitives/texts/counting-number.tsx:L22 | neighbors=[stat-number.tsx, counting-number.tsx]
- "transcription_actions_requestlivetoken": "requestLiveToken()" | kind=code-symbol | source=src/features/transcription/actions.ts:L33 | neighbors=[use-live-transcription.ts, actions.ts]
- "transcription_flag_test": "flag.test.ts" | kind=code-symbol | source=src/features/transcription/flag.test.ts:L1 | neighbors=[flag.ts, parseLiveTranscriptionFlag()]
- "transcription_live_client_livetranscriptionsession_cleartimers": ".clearTimers()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L464 | neighbors=[LiveTranscriptionSession, .stop()]
- "transcription_live_client_livetranscriptionsession_handlerawmessage": ".handleRawMessage()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L215 | neighbors=[LiveTranscriptionSession, .handleEvent()]
- "transcription_live_client_livetranscriptionsession_startwatchdog": ".startWatchdog()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L449 | neighbors=[LiveTranscriptionSession, .start()]
- "transcription_live_client_livetranscriptionsession_teardownaudio": ".teardownAudio()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L417 | neighbors=[LiveTranscriptionSession, .stop()]
- "transcription_live_client_test_reconnect": "reconnect()" | kind=code-symbol | source=src/features/transcription/live-client.test.ts:L59 | neighbors=[live-client.test.ts, settle()]
- "transcription_live_client_test_settle": "settle()" | kind=code-symbol | source=src/features/transcription/live-client.test.ts:L51 | neighbors=[live-client.test.ts, reconnect()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-109.json

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
