# Node Description Batch 77 of 166

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

- "signals_corroborate_summarize": "summarize()" | kind=code-symbol | source=src/features/signals/corroborate.ts:L272 | neighbors=[corroborate.ts, corroborate.test.ts, queries.ts]
- "signals_figure_inferred": "inferred()" | kind=code-symbol | source=src/features/signals/figure.ts:L67 | neighbors=[architect.ts, figure.ts, figure.test.ts]
- "signals_observe_activityrow": "ActivityRow" | kind=code-symbol | source=src/features/signals/observe.ts:L86 | neighbors=[observe.ts, observe.test.ts, queries.ts]
- "signals_observe_classifyactivity": "classifyActivity()" | kind=code-symbol | source=src/features/signals/observe.ts:L105 | neighbors=[observe.ts, observationsFromActivity(), observe.test.ts]
- "signals_observe_isoutcome": "isOutcome()" | kind=code-symbol | source=src/features/signals/observe.ts:L64 | neighbors=[corroborate.ts, observe.ts, observe.test.ts]
- "signals_observe_observationkind": "ObservationKind" | kind=code-symbol | source=src/features/signals/observe.ts:L25 | neighbors=[corroborate.ts, corroborate.test.ts, observe.ts]
- "signals_observe_observationsfromselfscores": "observationsFromSelfScores()" | kind=code-symbol | source=src/features/signals/observe.ts:L201 | neighbors=[observe.ts, observe.test.ts, queries.ts]
- "signals_observe_observationsfromwitnesses": "observationsFromWitnesses()" | kind=code-symbol | source=src/features/signals/observe.ts:L181 | neighbors=[observe.ts, observe.test.ts, queries.ts]
- "signals_queries_getmemberscorecard": "getMemberScorecard()" | kind=code-symbol | source=src/features/signals/queries.ts:L285 | neighbors=[page.tsx, queries.ts, getPersonSignals()]
- "slug_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/apps/[slug]/error.tsx:L1 | neighbors=[AppDetailError(), button.tsx, Button()]
- "speech_chunk_speech_rawlimitfor": "rawLimitFor()" | kind=code-symbol | source=src/features/speech/chunk-speech.ts:L65 | neighbors=[chunk-speech.ts, chunkForSpeech(), spoken-text.ts]
- "speech_spoken_text_sinhalafraction": "sinhalaFraction()" | kind=code-symbol | source=src/features/speech/spoken-text.ts:L67 | neighbors=[use-speech.ts, spoken-text.ts, spoken-text.test.ts]
- "speech_spoken_text_tospokentext": "toSpokenText()" | kind=code-symbol | source=src/features/speech/spoken-text.ts:L16 | neighbors=[use-speech.ts, spoken-text.ts, spoken-text.test.ts]
- "speech_spoken_text_truncateforspeech": "truncateForSpeech()" | kind=code-symbol | source=src/features/speech/spoken-text.ts:L89 | neighbors=[actions.ts, spoken-text.ts, spoken-text.test.ts]
- "speech_wav_base64tobytes": "base64ToBytes()" | kind=code-symbol | source=src/features/speech/wav.ts:L71 | neighbors=[use-speech.ts, wav.ts, wav.test.ts]
- "speech_wav_parsepcmrate": "parsePcmRate()" | kind=code-symbol | source=src/features/speech/wav.ts:L22 | neighbors=[use-speech.ts, wav.ts, wav.test.ts]
- "sprints_actions_reordersprint": "reorderSprint()" | kind=code-symbol | source=src/features/sprints/actions.ts:L418 | neighbors=[roadmap-timeline.tsx, actions.ts, slugForApp()]
- "sprints_actions_resortsprintsbydate": "resortSprintsByDate()" | kind=code-symbol | source=src/features/sprints/actions.ts:L443 | neighbors=[roadmap-timeline.tsx, actions.ts, slugForApp()]
- "sprints_assignment_notice_buildassignmentnotice": "buildAssignmentNotice()" | kind=code-symbol | source=src/features/sprints/assignment-notice.ts:L58 | neighbors=[assignment-notice.ts, clip(), assignment-notice.test.ts]
- "sprints_backlog_backlogjoincondition": "backlogJoinCondition" | kind=code-symbol | source=src/features/sprints/backlog.ts:L50 | neighbors=[backlog.ts, queries.ts, task-actions.ts]
- "sprints_backlog_sprintorbacklogcondition": "sprintOrBacklogCondition()" | kind=code-symbol | source=src/features/sprints/backlog.ts:L62 | neighbors=[backlog.ts, queries.ts, task-actions.ts]
- "sprints_backlog_test": "backlog.test.ts" | kind=code-symbol | source=src/features/sprints/backlog.test.ts:L1 | neighbors=[backlog.ts, backlogTasksQuery(), isBacklogRow()]
- "sprints_board_view_boardview": "BoardView" | kind=code-symbol | source=src/features/sprints/board-view.ts:L125 | neighbors=[board.tsx, board-toolbar.tsx, board-view.ts]
- "sprints_board_view_boardviewpatch": "boardViewPatch()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L175 | neighbors=[board.tsx, board-view.ts, board-view.test.ts]
- "sprints_board_view_empty_filters": "EMPTY_FILTERS" | kind=code-symbol | source=src/features/sprints/board-view.ts:L127 | neighbors=[board-toolbar.tsx, board-view.ts, board-view.test.ts]
- "sprints_board_view_patchforgroup": "patchForGroup()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L268 | neighbors=[board.tsx, board-view.ts, board-view.test.ts]
- "sprints_board_view_terminal_statuses": "TERMINAL_STATUSES" | kind=code-symbol | source=src/features/sprints/board-view.ts:L63 | neighbors=[board-view.ts, board-view.test.ts, task-status.ts]
- "sprints_checkin_actions_deletesprintcheckin": "deleteSprintCheckin()" | kind=code-symbol | source=src/features/sprints/checkin-actions.ts:L154 | neighbors=[meeting-prep.tsx, checkin-actions.ts, nameOf()]
- "sprints_checkin_actions_nameof": "nameOf()" | kind=code-symbol | source=src/features/sprints/checkin-actions.ts:L137 | neighbors=[checkin-actions.ts, deleteSprintCheckin(), upsertSprintCheckin()]
- "sprints_checkin_queries_getcheckinsforsprints": "getCheckinsForSprints()" | kind=code-symbol | source=src/features/sprints/checkin-queries.ts:L54 | neighbors=[ai-actions.ts, planner-actions.ts, checkin-queries.ts]
- "sprints_checkin_queries_getsprintcheckins": "getSprintCheckins()" | kind=code-symbol | source=src/features/sprints/checkin-queries.ts:L34 | neighbors=[sprint-checkins.tsx, page.tsx, checkin-queries.ts]
- "sprints_goal_lines_parsesprintgoal": "parseSprintGoal()" | kind=code-symbol | source=src/features/sprints/goal-lines.ts:L46 | neighbors=[page.tsx, goal-lines.ts, goal-lines.test.ts]
- "sprints_goal_lines_test": "goal-lines.test.ts" | kind=code-symbol | source=src/features/sprints/goal-lines.test.ts:L1 | neighbors=[a4b271b Improve leave types and worklog…, goal-lines.ts, parseSprintGoal()]
- "sprints_paste_plan_nonemptylines": "nonEmptyLines()" | kind=code-symbol | source=src/features/sprints/paste-plan.ts:L46 | neighbors=[paste-plan.ts, isBulkPaste(), splitPasteLocally()]
- "sprints_paste_plan_pastedtaskdraft": "PastedTaskDraft" | kind=code-symbol | source=src/features/sprints/paste-plan.ts:L14 | neighbors=[task-composer.tsx, paste-actions.ts, paste-plan.ts]
- "sprints_paste_plan_resolveassigneename": "resolveAssigneeName()" | kind=code-symbol | source=src/features/sprints/paste-plan.ts:L104 | neighbors=[paste-actions.ts, paste-plan.ts, paste-plan.test.ts]
- "sprints_plan_read_health_word": "HEALTH_WORD" | kind=code-symbol | source=src/features/sprints/plan-read.ts:L79 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, plan-read.ts]
- "sprints_plan_read_statuscounts": "StatusCounts" | kind=code-symbol | source=src/features/sprints/plan-read.ts:L32 | neighbors=[roadmap.tsx, roadmap-timeline.tsx, plan-read.ts]
- "sprints_plan_read_totaskcounts": "toTaskCounts()" | kind=code-symbol | source=src/features/sprints/plan-read.ts:L38 | neighbors=[plan-read.ts, readSprint(), plan-read.test.ts]
- "sprints_promises_sliplinefor": "slipLineFor()" | kind=code-symbol | source=src/features/sprints/promises.ts:L65 | neighbors=[promises.ts, shortDate(), promises.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-076.json

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
