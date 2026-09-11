# Node Description Batch 132 of 166

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

- "components_sprint_switcher_shortrange": "shortRange()" | kind=code-symbol | source=src/features/sprints/components/sprint-switcher.tsx:L51 | neighbors=[sprint-switcher.tsx]
- "components_sprint_switcher_status_dot": "STATUS_DOT" | kind=code-symbol | source=src/features/sprints/components/sprint-switcher.tsx:L37 | neighbors=[sprint-switcher.tsx]
- "components_sprint_switcher_status_label": "STATUS_LABEL" | kind=code-symbol | source=src/features/sprints/components/sprint-switcher.tsx:L43 | neighbors=[sprint-switcher.tsx]
- "components_sprint_switcher_switchersprint": "SwitcherSprint" | kind=code-symbol | source=src/features/sprints/components/sprint-switcher.tsx:L14 | neighbors=[sprint-switcher.tsx]
- "components_task_card_priority_bar": "PRIORITY_BAR" | kind=code-symbol | source=src/features/sprints/components/task-card.tsx:L32 | neighbors=[task-card.tsx]
- "components_task_composer_pasterow": "PasteRow" | kind=code-symbol | source=src/features/sprints/components/task-composer.tsx:L36 | neighbors=[task-composer.tsx]
- "components_task_composer_pastestate": "PasteState" | kind=code-symbol | source=src/features/sprints/components/task-composer.tsx:L38 | neighbors=[task-composer.tsx]
- "components_task_composer_shortdue": "shortDue()" | kind=code-symbol | source=src/features/sprints/components/task-composer.tsx:L54 | neighbors=[task-composer.tsx]
- "components_task_composer_torows": "toRows()" | kind=code-symbol | source=src/features/sprints/components/task-composer.tsx:L49 | neighbors=[task-composer.tsx]
- "components_task_dialog_emptyform": "emptyForm()" | kind=code-symbol | source=src/features/sprints/components/task-dialog.tsx:L75 | neighbors=[task-dialog.tsx]
- "components_task_dialog_formstate": "FormState" | kind=code-symbol | source=src/features/sprints/components/task-dialog.tsx:L52 | neighbors=[task-dialog.tsx]
- "components_task_dialog_priority_options": "PRIORITY_OPTIONS" | kind=code-symbol | source=src/features/sprints/components/task-dialog.tsx:L45 | neighbors=[task-dialog.tsx]
- "components_trash_card_items": "ITEMS" | kind=code-symbol | source=src/features/admin/components/trash-card.tsx:L44 | neighbors=[trash-card.tsx]
- "components_trash_card_logic_test_group": "group()" | kind=code-symbol | source=src/features/admin/components/trash-card-logic.test.ts:L62 | neighbors=[trash-card-logic.test.ts]
- "components_trash_card_rowkey": "rowKey()" | kind=code-symbol | source=src/features/admin/components/trash-card.tsx:L47 | neighbors=[trash-card.tsx]
- "components_trash_card_trashgroupsection": "TrashGroupSection()" | kind=code-symbol | source=src/features/admin/components/trash-card.tsx:L106 | neighbors=[trash-card.tsx]
- "components_trash_card_trashrowitem": "TrashRowItem()" | kind=code-symbol | source=src/features/admin/components/trash-card.tsx:L57 | neighbors=[trash-card.tsx]
- "components_trash_row_actions_warningfromresult": "warningFromResult()" | kind=code-symbol | source=src/features/admin/components/trash-row-actions.tsx:L106 | neighbors=[trash-row-actions.tsx]
- "components_triage_rail_glance_tiles": "GLANCE_TILES" | kind=code-symbol | source=src/features/meetings/components/triage-rail.tsx:L27 | neighbors=[triage-rail.tsx]
- "components_triage_rail_tilelink": "TileLink()" | kind=code-symbol | source=src/features/meetings/components/triage-rail.tsx:L252 | neighbors=[triage-rail.tsx]
- "components_use_dictation_dictationhandle": "DictationHandle" | kind=code-symbol | source=src/features/speech/components/use-dictation.ts:L24 | neighbors=[use-dictation.ts]
- "components_use_glance_map_glancemapcontext": "GlanceMapContext" | kind=code-symbol | source=src/features/meetings/components/use-glance-map.tsx:L76 | neighbors=[use-glance-map.tsx]
- "components_use_glance_map_glancemapcontextvalue": "GlanceMapContextValue" | kind=code-symbol | source=src/features/meetings/components/use-glance-map.tsx:L40 | neighbors=[use-glance-map.tsx]
- "components_use_glance_map_glancemapstatus": "GlanceMapStatus" | kind=code-symbol | source=src/features/meetings/components/use-glance-map.tsx:L34 | neighbors=[use-glance-map.tsx]
- "components_use_glance_map_test_meeting": "meeting()" | kind=code-symbol | source=src/features/meetings/components/use-glance-map.test.ts:L13 | neighbors=[use-glance-map.test.ts]
- "components_use_glance_map_test_now": "now" | kind=code-symbol | source=src/features/meetings/components/use-glance-map.test.ts:L10 | neighbors=[use-glance-map.test.ts]
- "components_use_live_transcription_livetranscriptionhandle": "LiveTranscriptionHandle" | kind=code-symbol | source=src/features/transcription/components/use-live-transcription.ts:L10 | neighbors=[use-live-transcription.ts]
- "components_use_screen_keyframes_encodeframe": "encodeFrame()" | kind=code-symbol | source=src/features/meetings/components/use-screen-keyframes.ts:L285 | neighbors=[use-screen-keyframes.ts]
- "components_use_screen_keyframes_hashofframe": "hashOfFrame()" | kind=code-symbol | source=src/features/meetings/components/use-screen-keyframes.ts:L264 | neighbors=[use-screen-keyframes.ts]
- "components_use_screen_keyframes_screenkeyframeshandle": "ScreenKeyframesHandle" | kind=code-symbol | source=src/features/meetings/components/use-screen-keyframes.ts:L34 | neighbors=[use-screen-keyframes.ts]
- "components_user_table_activecell": "ActiveCell()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L406 | neighbors=[user-table.tsx]
- "components_user_table_csv_headers": "CSV_HEADERS" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L448 | neighbors=[user-table.tsx]
- "components_user_table_employmentcell": "EmploymentCell()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L354 | neighbors=[user-table.tsx]
- "components_user_table_field": "Field()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L1235 | neighbors=[user-table.tsx]
- "components_user_table_jobrolecell": "JobRoleCell()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L100 | neighbors=[user-table.tsx]
- "components_user_table_matchesquery": "matchesQuery()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L471 | neighbors=[user-table.tsx]
- "components_user_table_orgtagscell": "OrgTagsCell()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L231 | neighbors=[user-table.tsx]
- "components_user_table_people": "PEOPLE" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L94 | neighbors=[user-table.tsx]
- "components_user_table_personalemailcell": "PersonalEmailCell()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L184 | neighbors=[user-table.tsx]
- "components_user_table_phonecell": "PhoneCell()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L131 | neighbors=[user-table.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-131.json

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
