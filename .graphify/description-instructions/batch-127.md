# Node Description Batch 128 of 166

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

- "components_meeting_panels_filterchip": "FilterChip()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L504 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_getdensityserversnapshot": "getDensityServerSnapshot()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L195 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_getopenmapserversnapshot": "getOpenMapServerSnapshot()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L225 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_getopenmapsnapshot": "getOpenMapSnapshot()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L212 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_getsummarylanguageserversnapshot": "getSummaryLanguageServerSnapshot()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L232 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_memoryfallback": "memoryFallback" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L163 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_model_person_scoped_kinds": "PERSON_SCOPED_KINDS" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L18 | neighbors=[meeting-panels-model.ts]
- "components_meeting_panels_model_sinhala_char": "SINHALA_CHAR" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L189 | neighbors=[meeting-panels-model.ts]
- "components_meeting_panels_model_test_item": "item()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.test.ts:L26 | neighbors=[meeting-panels-model.test.ts]
- "components_meeting_panels_model_test_people": "PEOPLE" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.test.ts:L21 | neighbors=[meeting-panels-model.test.ts]
- "components_meeting_panels_panel_ids": "PANEL_IDS" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L84 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_panelscontext": "PanelsContext" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L253 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_panelscontextvalue": "PanelsContextValue" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L238 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_subscribetopanelprefs": "subscribeToPanelPrefs()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L151 | neighbors=[meeting-panels.tsx]
- "components_meeting_panels_writestored": "writeStored()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L179 | neighbors=[meeting-panels.tsx]
- "components_meeting_people_picker_meetingpeoplemultipicker": "MeetingPeopleMultiPicker()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker.tsx:L286 | neighbors=[meeting-people-picker.tsx]
- "components_meeting_people_picker_model_buildpeopleoptionsinput": "BuildPeopleOptionsInput" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L132 | neighbors=[meeting-people-picker-model.ts]
- "components_meeting_people_picker_model_chiplabel": "ChipLabel" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L256 | neighbors=[meeting-people-picker-model.ts]
- "components_meeting_people_picker_model_peopleoption": "PeopleOption" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L72 | neighbors=[meeting-people-picker-model.ts]
- "components_meeting_people_picker_model_peopleoptiongroup": "PeopleOptionGroup" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L83 | neighbors=[meeting-people-picker-model.ts]
- "components_meeting_people_picker_model_persongroup": "PersonGroup" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L40 | neighbors=[meeting-people-picker-model.ts]
- "components_meeting_people_picker_model_pickerliststate": "PickerListState" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L293 | neighbors=[meeting-people-picker-model.ts]
- "components_meeting_people_picker_model_resolvelabeloptions": "ResolveLabelOptions" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L222 | neighbors=[meeting-people-picker-model.ts]
- "components_meeting_people_picker_model_test_gobiraj": "GOBIRAJ" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.test.ts:L21 | neighbors=[meeting-people-picker-model.test.ts]
- "components_meeting_people_picker_model_test_hasith": "HASITH" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.test.ts:L20 | neighbors=[meeting-people-picker-model.test.ts]
- "components_meeting_people_picker_model_test_rahumat": "RAHUMAT" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.test.ts:L23 | neighbors=[meeting-people-picker-model.test.ts]
- "components_meeting_people_picker_peoplelist": "PeopleList()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker.tsx:L82 | neighbors=[meeting-people-picker.tsx]
- "components_meeting_people_picker_personavatar": "PersonAvatar()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker.tsx:L68 | neighbors=[meeting-people-picker.tsx]
- "components_meeting_people_picker_sharedprops": "SharedProps" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker.tsx:L51 | neighbors=[meeting-people-picker.tsx]
- "components_meeting_pip_adoptstyles": "adoptStyles()" | kind=code-symbol | source=src/features/meetings/components/meeting-pip.tsx:L76 | neighbors=[meeting-pip.tsx]
- "components_meeting_pip_documentpiphost": "DocumentPipHost" | kind=code-symbol | source=src/features/meetings/components/meeting-pip.tsx:L44 | neighbors=[meeting-pip.tsx]
- "components_meeting_pip_readautopref": "readAutoPref()" | kind=code-symbol | source=src/features/meetings/components/meeting-pip.tsx:L58 | neighbors=[meeting-pip.tsx]
- "components_meeting_pip_writeautopref": "writeAutoPref()" | kind=code-symbol | source=src/features/meetings/components/meeting-pip.tsx:L66 | neighbors=[meeting-pip.tsx]
- "components_meeting_planner_agenda": "Agenda()" | kind=code-symbol | source=src/features/meetings/components/meeting-planner.tsx:L473 | neighbors=[meeting-planner.tsx]
- "components_meeting_planner_ask_label": "ASK_LABEL" | kind=code-symbol | source=src/features/meetings/components/meeting-planner.tsx:L59 | neighbors=[meeting-planner.tsx]
- "components_meeting_planner_ask_tone": "ASK_TONE" | kind=code-symbol | source=src/features/meetings/components/meeting-planner.tsx:L50 | neighbors=[meeting-planner.tsx]
- "components_meeting_planner_askrow": "AskRow()" | kind=code-symbol | source=src/features/meetings/components/meeting-planner.tsx:L546 | neighbors=[meeting-planner.tsx]
- "components_meeting_planner_candidaterow": "CandidateRow()" | kind=code-symbol | source=src/features/meetings/components/meeting-planner.tsx:L406 | neighbors=[meeting-planner.tsx]
- "components_meeting_planner_plannerskeleton": "PlannerSkeleton()" | kind=code-symbol | source=src/features/meetings/components/meeting-planner.tsx:L613 | neighbors=[meeting-planner.tsx]
- "components_meeting_planner_projectstrip": "ProjectStrip()" | kind=code-symbol | source=src/features/meetings/components/meeting-planner.tsx:L347 | neighbors=[meeting-planner.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-127.json

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
