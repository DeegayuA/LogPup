# Node Description Batch 109 of 166

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

- "shell_mobile_nav_mobilenav": "MobileNav()" | kind=code-symbol | source=src/components/shell/mobile-nav.tsx:L38 | neighbors=[header.tsx, mobile-nav.tsx]
- "shell_nav_items_getvisiblenavitems": "getVisibleNavItems()" | kind=code-symbol | source=src/components/shell/nav-items.ts:L136 | neighbors=[nav-items.ts, nav-items.test.ts]
- "shell_nav_items_navitem": "NavItem" | kind=code-symbol | source=src/components/shell/nav-items.ts:L18 | neighbors=[nav.ts, nav-items.ts]
- "shell_shortcuts_overlay_shortcutsoverlay": "ShortcutsOverlay()" | kind=code-symbol | source=src/components/shell/shortcuts-overlay.tsx:L36 | neighbors=[command-center.tsx, shortcuts-overlay.tsx]
- "shell_sidebar_navlink": "NavLink()" | kind=code-symbol | source=src/components/shell/sidebar.tsx:L33 | neighbors=[mobile-nav.tsx, sidebar.tsx]
- "shell_sidebar_sidebar": "Sidebar()" | kind=code-symbol | source=src/components/shell/sidebar.tsx:L203 | neighbors=[layout.tsx, sidebar.tsx]
- "shell_sidebar_store_readstored": "readStored()" | kind=code-symbol | source=src/components/shell/sidebar-store.ts:L58 | neighbors=[sidebar-store.ts, getSnapshot()]
- "shell_theme_provider_themeprovider": "ThemeProvider()" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L195 | neighbors=[layout.tsx, theme-provider.tsx]
- "shell_version_badge_daylabel": "dayLabel()" | kind=code-symbol | source=src/components/shell/version-badge.tsx:L78 | neighbors=[version-badge.tsx, VersionBadge()]
- "shell_version_badge_groupbyday": "groupByDay()" | kind=code-symbol | source=src/components/shell/version-badge.tsx:L64 | neighbors=[version-badge.tsx, VersionBadge()]
- "signals_commands_commands": "commands" | kind=code-symbol | source=src/features/signals/commands.ts:L14 | neighbors=[commands.ts, commands.ts]
- "signals_corroborate_checked_channels": "CHECKED_CHANNELS" | kind=code-symbol | source=src/features/signals/corroborate.ts:L80 | neighbors=[corroborate.ts, corroborate.test.ts]
- "signals_corroborate_corroborateday": "corroborateDay()" | kind=code-symbol | source=src/features/signals/corroborate.ts:L110 | neighbors=[corroborate.ts, corroborate.test.ts]
- "signals_corroborate_corroborationsummary": "CorroborationSummary" | kind=code-symbol | source=src/features/signals/corroborate.ts:L263 | neighbors=[corroborate.ts, queries.ts]
- "signals_corroborate_daycorroboration": "DayCorroboration" | kind=code-symbol | source=src/features/signals/corroborate.ts:L59 | neighbors=[corroborate.ts, queries.ts]
- "signals_corroborate_quietrun": "QuietRun" | kind=code-symbol | source=src/features/signals/corroborate.ts:L163 | neighbors=[corroborate.ts, queries.ts]
- "signals_corroborate_unclaimedday": "UnclaimedDay" | kind=code-symbol | source=src/features/signals/corroborate.ts:L230 | neighbors=[corroborate.ts, queries.ts]
- "signals_figure_issuppressed": "isSuppressed()" | kind=code-symbol | source=src/features/signals/figure.ts:L124 | neighbors=[figure.ts, figure.test.ts]
- "signals_figure_suppressifsmall": "suppressIfSmall()" | kind=code-symbol | source=src/features/signals/figure.ts:L107 | neighbors=[figure.ts, figure.test.ts]
- "signals_observe_groupbyuserday": "groupByUserDay()" | kind=code-symbol | source=src/features/signals/observe.ts:L216 | neighbors=[observe.ts, observe.test.ts]
- "signals_observe_userdaykey": "userDayKey()" | kind=code-symbol | source=src/features/signals/observe.ts:L229 | neighbors=[corroborate.ts, observe.ts]
- "signals_queries_daysinrange": "daysInRange()" | kind=code-symbol | source=src/features/signals/queries.ts:L67 | neighbors=[queries.ts, getPersonSignals()]
- "signals_queries_heldroles": "heldRoles()" | kind=code-symbol | source=src/features/signals/queries.ts:L248 | neighbors=[page.tsx, queries.ts]
- "signals_queries_mayread": "mayRead()" | kind=code-symbol | source=src/features/signals/queries.ts:L86 | neighbors=[queries.ts, getPersonSignals()]
- "signals_queries_personsignals": "PersonSignals" | kind=code-symbol | source=src/features/signals/queries.ts:L56 | neighbors=[signals-view.tsx, queries.ts]
- "speech_actions_synthesizespeech": "synthesizeSpeech()" | kind=code-symbol | source=src/features/speech/actions.ts:L113 | neighbors=[use-speech.ts, actions.ts]
- "speech_actions_transcribedictation": "transcribeDictation()" | kind=code-symbol | source=src/features/speech/actions.ts:L52 | neighbors=[use-dictation.ts, actions.ts]
- "speech_chunk_speech_cutat": "cutAt()" | kind=code-symbol | source=src/features/speech/chunk-speech.ts:L89 | neighbors=[chunk-speech.ts, chunkForSpeech()]
- "speech_wav_writeascii": "writeAscii()" | kind=code-symbol | source=src/features/speech/wav.ts:L81 | neighbors=[wav.ts, pcmToWav()]
- "sprints_actions_listsprintoptions": "listSprintOptions()" | kind=code-symbol | source=src/features/sprints/actions.ts:L306 | neighbors=[board.tsx, actions.ts]
- "sprints_actions_renamesprint": "renameSprint()" | kind=code-symbol | source=src/features/sprints/actions.ts:L471 | neighbors=[actions.ts, slugForApp()]
- "sprints_actions_updatesprintdates": "updateSprintDates()" | kind=code-symbol | source=src/features/sprints/actions.ts:L390 | neighbors=[actions.ts, slugForApp()]
- "sprints_assignment_notice_clip": "clip()" | kind=code-symbol | source=src/features/sprints/assignment-notice.ts:L35 | neighbors=[assignment-notice.ts, buildAssignmentNotice()]
- "sprints_assignment_notice_shouldnotifyassignee": "shouldNotifyAssignee()" | kind=code-symbol | source=src/features/sprints/assignment-notice.ts:L83 | neighbors=[assignment-notice.ts, assignment-notice.test.ts]
- "sprints_backlog_backlogtasksquery": "backlogTasksQuery()" | kind=code-symbol | source=src/features/sprints/backlog.ts:L74 | neighbors=[backlog.ts, backlog.test.ts]
- "sprints_backlog_isbacklogrow": "isBacklogRow()" | kind=code-symbol | source=src/features/sprints/backlog.ts:L21 | neighbors=[backlog.ts, backlog.test.ts]
- "sprints_board_view_boardfilters": "BoardFilters" | kind=code-symbol | source=src/features/sprints/board-view.ts:L114 | neighbors=[board-toolbar.tsx, board-view.ts]
- "sprints_board_view_boardgroup": "BoardGroup" | kind=code-symbol | source=src/features/sprints/board-view.ts:L241 | neighbors=[board-column.tsx, board-view.ts]
- "sprints_board_view_boardtask": "BoardTask" | kind=code-symbol | source=src/features/sprints/board-view.ts:L94 | neighbors=[board-view.ts, board-view.test.ts]
- "sprints_board_view_group_by_label": "GROUP_BY_LABEL" | kind=code-symbol | source=src/features/sprints/board-view.ts:L108 | neighbors=[board-toolbar.tsx, board-view.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-108.json

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
