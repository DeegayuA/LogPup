# Node Description Batch 111 of 166

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

- "transcription_live_protocol_live_model_fallback_order": "LIVE_MODEL_FALLBACK_ORDER" | kind=code-symbol | source=src/features/transcription/live-protocol.ts:L37 | neighbors=[models.ts, live-protocol.ts]
- "transcription_live_protocol_liveserverevent": "LiveServerEvent" | kind=code-symbol | source=src/features/transcription/live-protocol.ts:L194 | neighbors=[live-client.ts, live-protocol.ts]
- "ui_avatar_avatarbadge": "AvatarBadge()" | kind=code-symbol | source=src/components/ui/avatar.tsx:L64 | neighbors=[app-card.tsx, avatar.tsx]
- "ui_command_commanddialog": "CommandDialog()" | kind=code-symbol | source=src/components/ui/command.tsx:L36 | neighbors=[command-center.tsx, command.tsx]
- "ui_command_commandloading": "CommandLoading()" | kind=code-symbol | source=src/components/ui/command.tsx:L137 | neighbors=[command-center.tsx, command.tsx]
- "ui_command_commandseparator": "CommandSeparator()" | kind=code-symbol | source=src/components/ui/command.tsx:L143 | neighbors=[command-center.tsx, command.tsx]
- "ui_command_commandshortcut": "CommandShortcut()" | kind=code-symbol | source=src/components/ui/command.tsx:L176 | neighbors=[command-center.tsx, command.tsx]
- "ui_dropdown_menu_dropdownmenucheckboxitem": "DropdownMenuCheckboxItem()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L148 | neighbors=[board-toolbar.tsx, dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenusub": "DropdownMenuSub()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L99 | neighbors=[meeting-list.tsx, dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenusubcontent": "DropdownMenuSubContent()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L127 | neighbors=[meeting-list.tsx, dropdown-menu.tsx]
- "ui_dropdown_menu_dropdownmenusubtrigger": "DropdownMenuSubTrigger()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L103 | neighbors=[meeting-list.tsx, dropdown-menu.tsx]
- "ui_input_group_inputgroupaddonvariants": "inputGroupAddonVariants" | kind=code-symbol | source=src/components/ui/input-group.tsx:L25 | neighbors=[input-group.tsx, InputGroupAddon()]
- "ui_input_group_inputgroupbutton": "InputGroupButton()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L86 | neighbors=[input-group.tsx, inputGroupButtonVariants]
- "ui_input_group_inputgroupbuttonvariants": "inputGroupButtonVariants" | kind=code-symbol | source=src/components/ui/input-group.tsx:L68 | neighbors=[input-group.tsx, InputGroupButton()]
- "ui_select_selectseparator": "SelectSeparator()" | kind=code-symbol | source=src/components/ui/select.tsx:L152 | neighbors=[speaker-assignment.tsx, select.tsx]
- "ui_sonner_toaster": "Toaster()" | kind=code-symbol | source=src/components/ui/sonner.tsx:L7 | neighbors=[layout.tsx, sonner.tsx]
- "ui_spotlight_card_usemediaquery": "useMediaQuery()" | kind=code-symbol | source=src/components/ui/spotlight-card.tsx:L31 | neighbors=[spotlight-card.tsx, SpotlightCard()]
- "ui_tabs_tabslist": "TabsList()" | kind=code-symbol | source=src/components/ui/tabs.tsx:L41 | neighbors=[tabs.tsx, tabsListVariants]
- "ui_tabs_tabslistvariants": "tabsListVariants" | kind=code-symbol | source=src/components/ui/tabs.tsx:L26 | neighbors=[tabs.tsx, TabsList()]
- "worklog_absence_kinds_absence_kind_definitions": "ABSENCE_KIND_DEFINITIONS" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L67 | neighbors=[absence-kinds.ts, absence-kinds.test.ts]
- "worklog_actions_resetdayscoretohours": "resetDayScoreToHours()" | kind=code-symbol | source=src/features/worklog/actions.ts:L170 | neighbors=[day-panel.tsx, actions.ts]
- "worklog_auto_score_score_sources": "SCORE_SOURCES" | kind=code-symbol | source=src/features/worklog/auto-score.ts:L40 | neighbors=[auto-score.ts, auto-score.test.ts]
- "worklog_auto_score_scoresourcelabel": "scoreSourceLabel()" | kind=code-symbol | source=src/features/worklog/auto-score.ts:L97 | neighbors=[auto-score.ts, auto-score.test.ts]
- "worklog_auto_score_sync_notefromentries": "noteFromEntries()" | kind=code-symbol | source=src/features/worklog/auto-score-sync.ts:L273 | neighbors=[auto-score-sync.ts, syncAutoScore()]
- "worklog_auto_score_sync_scheduledminutesfor": "scheduledMinutesFor()" | kind=code-symbol | source=src/features/worklog/auto-score-sync.ts:L48 | neighbors=[auto-score-sync.ts, syncAutoScore()]
- "worklog_catch_up_actions_catchupdayfacts": "CatchUpDayFacts" | kind=code-symbol | source=src/features/worklog/catch-up-actions.ts:L65 | neighbors=[log-box.tsx, catch-up-actions.ts]
- "worklog_catch_up_actions_writer": "writer()" | kind=code-symbol | source=src/features/worklog/catch-up-actions.ts:L91 | neighbors=[catch-up-actions.ts, readCatchUpText()]
- "worklog_catch_up_offline_findabsence": "findAbsence()" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L208 | neighbors=[catch-up-offline.ts, readCatchUpTextOffline()]
- "worklog_catch_up_offline_groupmarkers": "groupMarkers()" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L161 | neighbors=[catch-up-offline.ts, readCatchUpTextOffline()]
- "worklog_catch_up_offline_resolvedate": "resolveDate()" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L91 | neighbors=[catch-up-offline.ts, findMarkers()]
- "worklog_catch_up_offline_splititems": "splitItems()" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L189 | neighbors=[catch-up-offline.ts, readCatchUpTextOffline()]
- "worklog_catch_up_parse_catch_up_categories": "CATCH_UP_CATEGORIES" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L157 | neighbors=[catch-up-parse.ts, catch-up-parse.test.ts]
- "worklog_catch_up_parse_catchupentry": "CatchUpEntry" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L92 | neighbors=[catch-up-offline.ts, catch-up-parse.ts]
- "worklog_catch_up_parse_snappercent": "snapPercent()" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L246 | neighbors=[catch-up-parse.ts, readCatchUpReply()]
- "worklog_commands_commands": "commands" | kind=code-symbol | source=src/features/worklog/commands.ts:L21 | neighbors=[commands.ts, commands.ts]
- "worklog_coverage_coverageinput": "CoverageInput" | kind=code-symbol | source=src/features/worklog/coverage.ts:L37 | neighbors=[coverage.ts, coverage.test.ts]
- "worklog_coverage_eachday": "eachDay()" | kind=code-symbol | source=src/features/worklog/coverage.ts:L95 | neighbors=[coverage.ts, computeCoverage()]
- "worklog_coverage_num": "num()" | kind=code-symbol | source=src/features/worklog/coverage.ts:L189 | neighbors=[coverage.ts, formatCoverage()]
- "worklog_coverage_weekdaykey": "weekdayKey()" | kind=code-symbol | source=src/features/worklog/coverage.ts:L89 | neighbors=[coverage.ts, computeCoverage()]
- "worklog_day_app_mix_mixsegment": "MixSegment" | kind=code-symbol | source=src/features/worklog/day-app-mix.ts:L26 | neighbors=[progress-matrix.tsx, day-app-mix.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-110.json

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
