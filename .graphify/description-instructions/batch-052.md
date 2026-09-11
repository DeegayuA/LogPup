# Node Description Batch 53 of 166

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

- "search_actions_previewtaskintent": "previewTaskIntent()" | kind=code-symbol | source=src/features/search/actions.ts:L99 | neighbors=[command-center.tsx, actions.ts, assignableUsers(), likePattern()]
- "search_actions_quickassigntask": "quickAssignTask()" | kind=code-symbol | source=src/features/search/actions.ts:L143 | neighbors=[command-center.tsx, actions.ts, assignableUsers(), likePattern()]
- "settings_nav_settingsnavitem": "settingsNavItem" | kind=code-symbol | source=src/features/settings/nav.ts:L17 | neighbors=[commands.ts, nav.ts, mobile-nav.tsx, sidebar.tsx]
- "shared_drag_surface_dragsurface": "DragSurface()" | kind=code-symbol | source=src/components/shared/drag-surface.tsx:L53 | neighbors=[meetings-month-calendar.tsx, roadmap-timeline.tsx, drag-surface.tsx, useDragSensors()]
- "shared_inline_rename": "inline-rename.tsx" | kind=code-symbol | source=src/components/shared/inline-rename.tsx:L1 | neighbors=[task-card.tsx, utils.ts, cn(), InlineRename()]
- "shell_nav_items_adminnavitems": "adminNavItems" | kind=code-symbol | source=src/components/shell/nav-items.ts:L108 | neighbors=[commands.ts, mobile-nav.tsx, nav-items.ts, nav-items.test.ts]
- "shell_nav_items_progressnavitem": "progressNavItem" | kind=code-symbol | source=src/components/shell/nav-items.ts:L93 | neighbors=[mobile-nav.tsx, nav-items.ts, nav-items.test.ts, sidebar.tsx]
- "shell_sidebar_model_nextsidebarstate": "nextSidebarState()" | kind=code-symbol | source=src/components/shell/sidebar-model.ts:L66 | neighbors=[commands.ts, sidebar-model.ts, sidebar-model.test.ts, sidebar-store.ts]
- "shell_sidebar_store_togglesidebar": "toggleSidebar()" | kind=code-symbol | source=src/components/shell/sidebar-store.ts:L109 | neighbors=[sidebar.tsx, sidebar-store.ts, getSnapshot(), setSidebarState()]
- "shell_theme_provider_accent": "Accent" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L24 | neighbors=[appearance-card.tsx, types.ts, commands.ts, theme-provider.tsx]
- "shell_theme_provider_theme": "Theme" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L14 | neighbors=[appearance-card.tsx, types.ts, commands.ts, theme-provider.tsx]
- "shell_theme_toggle_themetoggle": "ThemeToggle()" | kind=code-symbol | source=src/components/shell/theme-toggle.tsx:L10 | neighbors=[layout.tsx, header.tsx, theme-toggle.tsx, page.tsx]
- "signals_figure_percentile": "percentile()" | kind=code-symbol | source=src/features/signals/figure.ts:L152 | neighbors=[lead.ts, member.ts, figure.ts, figure.test.ts]
- "signals_observe_observation": "Observation" | kind=code-symbol | source=src/features/signals/observe.ts:L68 | neighbors=[corroborate.ts, corroborate.test.ts, observe.ts, queries.ts]
- "signals_observe_observationsfromactivity": "observationsFromActivity()" | kind=code-symbol | source=src/features/signals/observe.ts:L155 | neighbors=[observe.ts, classifyActivity(), observe.test.ts, queries.ts]
- "slug_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/apps/[slug]/loading.tsx:L1 | neighbors=[007c37f ., a8c5100 ., AppDetailLoading(), Shimmer()]
- "speech_chunk_speech_effectivespeechlength": "effectiveSpeechLength()" | kind=code-symbol | source=src/features/speech/chunk-speech.ts:L53 | neighbors=[chunk-speech.ts, chunkForSpeech(), chunk-speech.test.ts, spoken-text.test.ts]
- "speech_chunk_speech_test": "chunk-speech.test.ts" | kind=code-symbol | source=src/features/speech/chunk-speech.test.ts:L1 | neighbors=[2607f59 fix(speech): read-aloud budgets…, chunk-speech.ts, chunkForSpeech(), effectiveSpeechLength()]
- "speech_wav_pcmtowav": "pcmToWav()" | kind=code-symbol | source=src/features/speech/wav.ts:L33 | neighbors=[use-speech.ts, wav.ts, writeAscii(), wav.test.ts]
- "speech_wav_test": "wav.test.ts" | kind=code-symbol | source=src/features/speech/wav.test.ts:L1 | neighbors=[wav.ts, base64ToBytes(), parsePcmRate(), pcmToWav()]
- "sprints_actions_createsprint": "createSprint()" | kind=code-symbol | source=src/features/sprints/actions.ts:L84 | neighbors=[sprint-form-dialog.tsx, actions.ts, slugForApp(), unexpected()]
- "sprints_actions_deletesprint": "deleteSprint()" | kind=code-symbol | source=src/features/sprints/actions.ts:L231 | neighbors=[sprint-edit-dialog.tsx, actions.ts, slugForApp(), unexpected()]
- "sprints_actions_sprintoption": "SprintOption" | kind=code-symbol | source=src/features/sprints/actions.ts:L286 | neighbors=[board.tsx, board-bulk-bar.tsx, task-dialog.tsx, actions.ts]
- "sprints_board_view_activefiltercount": "activeFilterCount()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L188 | neighbors=[board.tsx, board-toolbar.tsx, board-view.ts, board-view.test.ts]
- "sprints_board_view_dropindexin": "dropIndexIn()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L366 | neighbors=[board.tsx, roadmap-timeline.tsx, board-view.ts, board-view.test.ts]
- "sprints_board_view_groupidfortask": "groupIdForTask()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L284 | neighbors=[board.tsx, board-view.ts, groupTasks(), board-view.test.ts]
- "sprints_board_view_grouppatch": "GroupPatch" | kind=code-symbol | source=src/features/sprints/board-view.ts:L262 | neighbors=[board.tsx, board-column.tsx, task-composer.tsx, board-view.ts]
- "sprints_board_view_grouptasks": "groupTasks()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L301 | neighbors=[board.tsx, board-view.ts, groupIdForTask(), board-view.test.ts]
- "sprints_board_view_isduetoday": "isDueToday()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L210 | neighbors=[task-card.tsx, board-view.ts, isTerminal(), board-view.test.ts]
- "sprints_board_view_matchesfilters": "matchesFilters()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L216 | neighbors=[board.tsx, board-view.ts, isOverdue(), board-view.test.ts]
- "sprints_board_view_parseboardview": "parseBoardView()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L146 | neighbors=[board.tsx, board-view.ts, splitList(), board-view.test.ts]
- "sprints_composer_plan_planfor": "planFor()" | kind=code-symbol | source=src/features/sprints/composer-plan.ts:L29 | neighbors=[task-composer.tsx, composer-plan.ts, composer-plan.test.ts, paste-plan.ts]
- "sprints_composer_plan_test": "composer-plan.test.ts" | kind=code-symbol | source=src/features/sprints/composer-plan.test.ts:L1 | neighbors=[composer-plan.ts, planFor(), PEOPLE, TODAY]
- "sprints_due_date_duedateerror": "DueDateError" | kind=code-symbol | source=src/features/sprints/due-date.ts:L73 | neighbors=[import-actions.ts, due-date.ts, applyDueDate(), due-date.test.ts]
- "sprints_due_date_duekind": "DueKind" | kind=code-symbol | source=src/features/sprints/due-date.ts:L48 | neighbors=[change-request-appliers.ts, deadline-csv.ts, assignment-notice.ts, due-date.ts]
- "sprints_due_date_duestate": "DueState" | kind=code-symbol | source=src/features/sprints/due-date.ts:L51 | neighbors=[change-request-appliers.ts, import-actions.ts, due-date.ts, due-date.test.ts]
- "sprints_paste_plan_isbulkpaste": "isBulkPaste()" | kind=code-symbol | source=src/features/sprints/paste-plan.ts:L41 | neighbors=[task-composer.tsx, paste-plan.ts, nonEmptyLines(), paste-plan.test.ts]
- "sprints_paste_plan_splitpastelocally": "splitPasteLocally()" | kind=code-symbol | source=src/features/sprints/paste-plan.ts:L70 | neighbors=[task-composer.tsx, paste-plan.ts, nonEmptyLines(), paste-plan.test.ts]
- "sprints_permissions_canmovetask": "canMoveTask()" | kind=code-symbol | source=src/features/sprints/permissions.ts:L18 | neighbors=[board-column.tsx, permissions.ts, permissions.test.ts, task-actions.ts]
- "sprints_plan_read_completioncount": "completionCount()" | kind=code-symbol | source=src/features/sprints/plan-read.ts:L95 | neighbors=[roadmap-spine.tsx, roadmap-timeline.tsx, plan-read.ts, plan-read.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-052.json

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
