# Node Description Batch 160 of 166

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

- "sprints_due_date_test_fresh": "fresh" | kind=code-symbol | source=src/features/sprints/due-date.test.ts:L5 | neighbors=[due-date.test.ts]
- "sprints_goal_lines_sprintgoal": "SprintGoal" | kind=code-symbol | source=src/features/sprints/goal-lines.ts:L19 | neighbors=[goal-lines.ts]
- "sprints_paste_actions_draftschema": "draftSchema" | kind=code-symbol | source=src/features/sprints/paste-actions.ts:L32 | neighbors=[paste-actions.ts]
- "sprints_paste_actions_inputschema": "inputSchema" | kind=code-symbol | source=src/features/sprints/paste-actions.ts:L21 | neighbors=[paste-actions.ts]
- "sprints_paste_actions_responseschema": "responseSchema" | kind=code-symbol | source=src/features/sprints/paste-actions.ts:L42 | neighbors=[paste-actions.ts]
- "sprints_paste_plan_striplistmarker": "stripListMarker()" | kind=code-symbol | source=src/features/sprints/paste-plan.ts:L55 | neighbors=[paste-plan.ts]
- "sprints_paste_plan_test_people": "people" | kind=code-symbol | source=src/features/sprints/paste-plan.test.ts:L10 | neighbors=[paste-plan.test.ts]
- "sprints_paste_plan_test_today": "today" | kind=code-symbol | source=src/features/sprints/paste-plan.test.ts:L17 | neighbors=[paste-plan.test.ts]
- "sprints_promises_gradedpromise": "GradedPromise" | kind=code-symbol | source=src/features/sprints/promises.ts:L28 | neighbors=[promises.ts]
- "sprints_promises_months": "MONTHS" | kind=code-symbol | source=src/features/sprints/promises.ts:L43 | neighbors=[promises.ts]
- "sprints_promises_step_rank": "STEP_RANK" | kind=code-symbol | source=src/features/sprints/promises.ts:L35 | neighbors=[promises.ts]
- "sprints_promises_test_noholidays": "noHolidays()" | kind=code-symbol | source=src/features/sprints/promises.test.ts:L7 | neighbors=[promises.test.ts]
- "sprints_promises_test_row": "row()" | kind=code-symbol | source=src/features/sprints/promises.test.ts:L9 | neighbors=[promises.test.ts]
- "sprints_roadmap_layout_test_span": "span()" | kind=code-symbol | source=src/features/sprints/roadmap-layout.test.ts:L14 | neighbors=[roadmap-layout.test.ts]
- "sprints_search_providers_appreach": "appReach()" | kind=code-symbol | source=src/features/sprints/search-providers.ts:L39 | neighbors=[search-providers.ts]
- "sprints_suggest_actions_sprintsuggestion": "SprintSuggestion" | kind=code-symbol | source=src/features/sprints/suggest-actions.ts:L15 | neighbors=[suggest-actions.ts]
- "sprints_suggest_actions_suggestionschema": "suggestionSchema" | kind=code-symbol | source=src/features/sprints/suggest-actions.ts:L23 | neighbors=[suggest-actions.ts]
- "sprints_task_actions_boardmoveinput": "boardMoveInput" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L90 | neighbors=[task-actions.ts]
- "sprints_task_actions_bulkupdateinput": "bulkUpdateInput" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L119 | neighbors=[task-actions.ts]
- "sprints_task_actions_rank": "rank" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L43 | neighbors=[task-actions.ts]
- "sprints_task_actions_task_statuses": "TASK_STATUSES" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L33 | neighbors=[task-actions.ts]
- "sprints_task_actions_taskinput": "taskInput" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L45 | neighbors=[task-actions.ts]
- "sprints_task_actions_taskstatus": "TaskStatus" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L34 | neighbors=[task-actions.ts]
- "sprints_task_actions_taskupdateinput": "taskUpdateInput" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L66 | neighbors=[task-actions.ts]
- "sprints_task_actions_test_asadmin": "asAdmin()" | kind=code-symbol | source=src/features/sprints/task-actions.test.ts:L50 | neighbors=[task-actions.test.ts]
- "sprints_task_actions_test_asmember": "asMember()" | kind=code-symbol | source=src/features/sprints/task-actions.test.ts:L51 | neighbors=[task-actions.test.ts]
- "sprints_task_actions_test_authmock_writespy_deletespy_logactivitymock": "{ authMock, writeSpy, deleteSpy, logActivityMock }" | kind=code-symbol | source=src/features/sprints/task-actions.test.ts:L8 | neighbors=[task-actions.test.ts]
- "sprints_task_actions_test_basetask": "baseTask()" | kind=code-symbol | source=src/features/sprints/task-actions.test.ts:L53 | neighbors=[task-actions.test.ts]
- "sprints_task_actions_test_taskqueue": "taskQueue" | kind=code-symbol | source=src/features/sprints/task-actions.test.ts:L19 | neighbors=[task-actions.test.ts]
- "sprints_task_actions_test_updatereturningqueue": "updateReturningQueue" | kind=code-symbol | source=src/features/sprints/task-actions.test.ts:L20 | neighbors=[task-actions.test.ts]
- "sprints_task_assignees_assigneechange": "AssigneeChange" | kind=code-symbol | source=src/features/sprints/task-assignees.ts:L127 | neighbors=[task-assignees.ts]
- "sprints_task_assignees_assigneeorderrow": "AssigneeOrderRow" | kind=code-symbol | source=src/features/sprints/task-assignees.ts:L101 | neighbors=[task-assignees.ts]
- "sprints_task_assignees_taskassignee": "TaskAssignee" | kind=code-symbol | source=src/features/sprints/task-assignees.ts:L39 | neighbors=[task-assignees.ts]
- "sprints_task_assignees_test_dbstub": "{ dbStub }" | kind=code-symbol | source=src/features/sprints/task-assignees.test.ts:L16 | neighbors=[task-assignees.test.ts]
- "sprints_task_rank_insertplan": "InsertPlan" | kind=code-symbol | source=src/features/sprints/task-rank.ts:L115 | neighbors=[task-rank.ts]
- "sprints_task_rank_test_list": "list()" | kind=code-symbol | source=src/features/sprints/task-rank.test.ts:L14 | neighbors=[task-rank.test.ts]
- "sprints_task_status_taskstatuspatch": "TaskStatusPatch" | kind=code-symbol | source=src/features/sprints/task-status.ts:L57 | neighbors=[task-status.ts]
- "sprints_task_status_test_now": "NOW" | kind=code-symbol | source=src/features/sprints/task-status.test.ts:L9 | neighbors=[task-status.test.ts]
- "src_proxy_config": "config" | kind=code-symbol | source=src/proxy.ts:L67 | neighbors=[proxy.ts]
- "terms_page_metadata": "metadata" | kind=code-symbol | source=src/app/(public)/terms/page.tsx:L19 | neighbors=[page.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-159.json

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
