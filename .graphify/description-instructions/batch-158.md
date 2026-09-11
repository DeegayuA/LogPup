# Node Description Batch 159 of 166

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

- "slug_page_tabs_needing_users": "TABS_NEEDING_USERS" | kind=code-symbol | source=src/app/(app)/apps/[slug]/page.tsx:L94 | neighbors=[page.tsx]
- "speech_actions_dictationresult": "DictationResult" | kind=code-symbol | source=src/features/speech/actions.ts:L45 | neighbors=[actions.ts]
- "speech_actions_speakinput": "speakInput" | kind=code-symbol | source=src/features/speech/actions.ts:L81 | neighbors=[actions.ts]
- "speech_actions_spokenaudio": "SpokenAudio" | kind=code-symbol | source=src/features/speech/actions.ts:L86 | neighbors=[actions.ts]
- "sprints_actions_sprint_statuses": "SPRINT_STATUSES" | kind=code-symbol | source=src/features/sprints/actions.ts:L49 | neighbors=[actions.ts]
- "sprints_actions_sprintdatesinput": "sprintDatesInput" | kind=code-symbol | source=src/features/sprints/actions.ts:L52 | neighbors=[actions.ts]
- "sprints_actions_sprintinput": "sprintInput" | kind=code-symbol | source=src/features/sprints/actions.ts:L17 | neighbors=[actions.ts]
- "sprints_actions_sprintstatus": "SprintStatus" | kind=code-symbol | source=src/features/sprints/actions.ts:L50 | neighbors=[actions.ts]
- "sprints_actions_sprintupdateinput": "sprintUpdateInput" | kind=code-symbol | source=src/features/sprints/actions.ts:L40 | neighbors=[actions.ts]
- "sprints_actions_test_asadmin": "asAdmin()" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L89 | neighbors=[actions.test.ts]
- "sprints_actions_test_asmember": "asMember()" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L90 | neighbors=[actions.test.ts]
- "sprints_actions_test_authmock_writespy_deletespy_logactivitymock": "{ authMock, writeSpy, deleteSpy, logActivityMock }" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L11 | neighbors=[actions.test.ts]
- "sprints_actions_test_demotewhereconditions": "demoteWhereConditions" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L32 | neighbors=[actions.test.ts]
- "sprints_actions_test_demotewheresql": "demoteWhereSql()" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L180 | neighbors=[actions.test.ts]
- "sprints_actions_test_sprintinsertreturningqueue": "sprintInsertReturningQueue" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L25 | neighbors=[actions.test.ts]
- "sprints_actions_test_sprintqueue": "sprintQueue" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L22 | neighbors=[actions.test.ts]
- "sprints_actions_test_sprintreturningqueue": "sprintReturningQueue" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L24 | neighbors=[actions.test.ts]
- "sprints_actions_test_taskcountqueue": "taskCountQueue" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L23 | neighbors=[actions.test.ts]
- "sprints_actions_test_then": "then()" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L73 | neighbors=[actions.test.ts]
- "sprints_actions_test_updatewhereresult": "updateWhereResult()" | kind=code-symbol | source=src/features/sprints/actions.test.ts:L38 | neighbors=[actions.test.ts]
- "sprints_assignment_notice_assignmentinput": "AssignmentInput" | kind=code-symbol | source=src/features/sprints/assignment-notice.ts:L20 | neighbors=[assignment-notice.ts]
- "sprints_assignment_notice_assignmentnotice": "AssignmentNotice" | kind=code-symbol | source=src/features/sprints/assignment-notice.ts:L14 | neighbors=[assignment-notice.ts]
- "sprints_assignment_notice_test_base": "base" | kind=code-symbol | source=src/features/sprints/assignment-notice.test.ts:L4 | neighbors=[assignment-notice.test.ts]
- "sprints_backlog_backlogcondition": "backlogCondition" | kind=code-symbol | source=src/features/sprints/backlog.ts:L53 | neighbors=[backlog.ts]
- "sprints_backlog_qb": "qb" | kind=code-symbol | source=src/features/sprints/backlog.ts:L7 | neighbors=[backlog.ts]
- "sprints_board_view_groupcontext": "GroupContext" | kind=code-symbol | source=src/features/sprints/board-view.ts:L249 | neighbors=[board-view.ts]
- "sprints_board_view_readableparams": "ReadableParams" | kind=code-symbol | source=src/features/sprints/board-view.ts:L136 | neighbors=[board-view.ts]
- "sprints_board_view_terminal": "TERMINAL" | kind=code-symbol | source=src/features/sprints/board-view.ts:L55 | neighbors=[board-view.ts]
- "sprints_board_view_test_person": "person()" | kind=code-symbol | source=src/features/sprints/board-view.test.ts:L38 | neighbors=[board-view.test.ts]
- "sprints_board_view_test_task": "task()" | kind=code-symbol | source=src/features/sprints/board-view.test.ts:L25 | neighbors=[board-view.test.ts]
- "sprints_checkin_actions_checkininput": "checkinInput" | kind=code-symbol | source=src/features/sprints/checkin-actions.ts:L14 | neighbors=[checkin-actions.ts]
- "sprints_checkin_queries_checkinselection": "checkinSelection" | kind=code-symbol | source=src/features/sprints/checkin-queries.ts:L17 | neighbors=[checkin-queries.ts]
- "sprints_checkins_computedprogress": "ComputedProgress" | kind=code-symbol | source=src/features/sprints/checkins.ts:L12 | neighbors=[checkins.ts]
- "sprints_checkins_test_task": "task()" | kind=code-symbol | source=src/features/sprints/checkins.test.ts:L12 | neighbors=[checkins.test.ts]
- "sprints_composer_plan_composerplan": "ComposerPlan" | kind=code-symbol | source=src/features/sprints/composer-plan.ts:L4 | neighbors=[composer-plan.ts]
- "sprints_composer_plan_test_people": "PEOPLE" | kind=code-symbol | source=src/features/sprints/composer-plan.test.ts:L4 | neighbors=[composer-plan.test.ts]
- "sprints_composer_plan_test_today": "TODAY" | kind=code-symbol | source=src/features/sprints/composer-plan.test.ts:L13 | neighbors=[composer-plan.test.ts]
- "sprints_due_date_duechange": "DueChange" | kind=code-symbol | source=src/features/sprints/due-date.ts:L59 | neighbors=[due-date.ts]
- "sprints_due_date_duepatch": "DuePatch" | kind=code-symbol | source=src/features/sprints/due-date.ts:L65 | neighbors=[due-date.ts]
- "sprints_due_date_test_dated": "dated()" | kind=code-symbol | source=src/features/sprints/due-date.test.ts:L12 | neighbors=[due-date.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-158.json

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
