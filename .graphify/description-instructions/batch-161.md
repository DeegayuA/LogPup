# Node Description Batch 162 of 166

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

- "ui_input_group_inputgrouptext": "InputGroupText()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L107 | neighbors=[input-group.tsx]
- "ui_input_group_inputgrouptextarea": "InputGroupTextarea()" | kind=code-symbol | source=src/components/ui/input-group.tsx:L135 | neighbors=[input-group.tsx]
- "ui_native_button_test_link": "Link()" | kind=code-symbol | source=src/components/ui/native-button.test.ts:L5 | neighbors=[native-button.test.ts]
- "ui_search_select_searchselectoption": "SearchSelectOption" | kind=code-symbol | source=src/components/ui/search-select.tsx:L33 | neighbors=[search-select.tsx]
- "ui_select_selectscrolldownbutton": "SelectScrollDownButton()" | kind=code-symbol | source=src/components/ui/select.tsx:L184 | neighbors=[select.tsx]
- "ui_select_selectscrollupbutton": "SelectScrollUpButton()" | kind=code-symbol | source=src/components/ui/select.tsx:L165 | neighbors=[select.tsx]
- "ui_stat_tile_stattone": "StatTone" | kind=code-symbol | source=src/components/ui/stat-tile.tsx:L16 | neighbors=[stat-tile.tsx]
- "ui_stat_tile_tone_bg": "TONE_BG" | kind=code-symbol | source=src/components/ui/stat-tile.tsx:L25 | neighbors=[stat-tile.tsx]
- "ui_stat_tile_tone_text": "TONE_TEXT" | kind=code-symbol | source=src/components/ui/stat-tile.tsx:L18 | neighbors=[stat-tile.tsx]
- "ui_table_tablecaption": "TableCaption()" | kind=code-symbol | source=src/components/ui/table.tsx:L94 | neighbors=[table.tsx]
- "ui_table_tablefooter": "TableFooter()" | kind=code-symbol | source=src/components/ui/table.tsx:L42 | neighbors=[table.tsx]
- "ui_tabs_tabs": "Tabs()" | kind=code-symbol | source=src/components/ui/tabs.tsx:L8 | neighbors=[tabs.tsx]
- "ui_tabs_tabscontent": "TabsContent()" | kind=code-symbol | source=src/components/ui/tabs.tsx:L72 | neighbors=[tabs.tsx]
- "ui_tabs_tabstrigger": "TabsTrigger()" | kind=code-symbol | source=src/components/ui/tabs.tsx:L56 | neighbors=[tabs.tsx]
- "worklog_absence_actions_createinput": "createInput" | kind=code-symbol | source=src/features/worklog/absence-actions.ts:L35 | neighbors=[absence-actions.ts]
- "worklog_absence_actions_reviewinput": "reviewInput" | kind=code-symbol | source=src/features/worklog/absence-actions.ts:L108 | neighbors=[absence-actions.ts]
- "worklog_absence_actions_self_declarable": "SELF_DECLARABLE" | kind=code-symbol | source=src/features/worklog/absence-actions.ts:L33 | neighbors=[absence-actions.ts]
- "worklog_absence_actions_test_authmock_logactivitymock_wherespy_setspy": "{ authMock, logActivityMock, whereSpy, setSpy }" | kind=code-symbol | source=src/features/worklog/absence-actions.test.ts:L15 | neighbors=[absence-actions.test.ts]
- "worklog_absence_actions_test_selectqueue": "selectQueue" | kind=code-symbol | source=src/features/worklog/absence-actions.test.ts:L27 | neighbors=[absence-actions.test.ts]
- "worklog_absence_actions_test_updatereturning": "updateReturning" | kind=code-symbol | source=src/features/worklog/absence-actions.test.ts:L28 | neighbors=[absence-actions.test.ts]
- "worklog_absence_days_test_range": "range()" | kind=code-symbol | source=src/features/worklog/absence-days.test.ts:L5 | neighbors=[absence-days.test.ts]
- "worklog_absence_kinds_absence_groups": "ABSENCE_GROUPS" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L27 | neighbors=[absence-kinds.ts]
- "worklog_absence_kinds_absencegroup": "AbsenceGroup" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L33 | neighbors=[absence-kinds.ts]
- "worklog_absence_kinds_absencekinddefinition": "AbsenceKindDefinition" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L35 | neighbors=[absence-kinds.ts]
- "worklog_absence_kinds_whole_day": "WHOLE_DAY" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L218 | neighbors=[absence-kinds.ts]
- "worklog_absence_queries_absencerow": "AbsenceRow" | kind=code-symbol | source=src/features/worklog/absence-queries.ts:L6 | neighbors=[absence-queries.ts]
- "worklog_actions_noteinput": "noteInput" | kind=code-symbol | source=src/features/worklog/actions.ts:L103 | neighbors=[actions.ts]
- "worklog_actions_workloginput": "worklogInput" | kind=code-symbol | source=src/features/worklog/actions.ts:L14 | neighbors=[actions.ts]
- "worklog_catch_up_actions_catchupresult": "CatchUpResult" | kind=code-symbol | source=src/features/worklog/catch-up-actions.ts:L75 | neighbors=[catch-up-actions.ts]
- "worklog_catch_up_offline_marker": "Marker" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L71 | neighbors=[catch-up-offline.ts]
- "worklog_catch_up_offline_markergroup": "MarkerGroup" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L159 | neighbors=[catch-up-offline.ts]
- "worklog_catch_up_offline_months": "MONTHS" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L53 | neighbors=[catch-up-offline.ts]
- "worklog_catch_up_offline_test_apps": "APPS" | kind=code-symbol | source=src/features/worklog/catch-up-offline.test.ts:L6 | neighbors=[catch-up-offline.test.ts]
- "worklog_catch_up_offline_test_days": "DAYS" | kind=code-symbol | source=src/features/worklog/catch-up-offline.test.ts:L13 | neighbors=[catch-up-offline.test.ts]
- "worklog_catch_up_offline_test_read": "read()" | kind=code-symbol | source=src/features/worklog/catch-up-offline.test.ts:L24 | neighbors=[catch-up-offline.test.ts]
- "worklog_catch_up_offline_weekdayof": "weekdayOf()" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L74 | neighbors=[catch-up-offline.ts]
- "worklog_catch_up_offline_weekdays": "WEEKDAYS" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L58 | neighbors=[catch-up-offline.ts]
- "worklog_catch_up_parse_catchupabsence": "CatchUpAbsence" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L100 | neighbors=[catch-up-parse.ts]
- "worklog_catch_up_parse_catchupapp": "CatchUpApp" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L65 | neighbors=[catch-up-parse.ts]
- "worklog_catch_up_parse_dayline": "dayLine()" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L161 | neighbors=[catch-up-parse.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-161.json

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
