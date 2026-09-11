# Node Description Batch 62 of 166

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

- "components_meeting_notes_model_createactionitempromoter": "createActionItemPromoter()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L339 | neighbors=[meeting-notes.tsx, meeting-notes-model.ts, meeting-notes-model.test.ts]
- "components_meeting_notes_model_followupage": "FollowupAge" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L442 | neighbors=[meeting-intel.tsx, meeting-notes-model.ts, meeting-notes-model.test.ts]
- "components_meeting_notes_model_issamenotetext": "isSameNoteText()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L431 | neighbors=[meeting-notes-model.ts, meeting-notes-model.test.ts, note-timeline.tsx]
- "components_meeting_notes_model_reconcileactionitems": "reconcileActionItems()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L263 | neighbors=[meeting-notes-model.ts, meeting-notes-model.test.ts, ai-actions.ts]
- "components_meeting_notes_model_resolveuntrackeddue": "resolveUntrackedDue()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L400 | neighbors=[meeting-notes.tsx, meeting-notes-model.ts, meeting-notes-model.test.ts]
- "components_meeting_panels_filterbar": "FilterBar()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L602 | neighbors=[meeting-intel.tsx, meeting-panels.tsx, usePanels()]
- "components_meeting_panels_model_activefilters": "ActiveFilters" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L31 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts, meeting-panels-model.test.ts]
- "components_meeting_panels_model_clearfilters": "clearFilters()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L46 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts, meeting-panels-model.test.ts]
- "components_meeting_panels_model_contentkind": "ContentKind" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L11 | neighbors=[meeting-intel.tsx, meeting-panels.tsx, meeting-panels-model.ts]
- "components_meeting_panels_model_countbykind": "countByKind()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L136 | neighbors=[meeting-panels-model.ts, groupByKind(), meeting-panels-model.test.ts]
- "components_meeting_panels_model_filterableitem": "FilterableItem" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L20 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts, meeting-panels-model.test.ts]
- "components_meeting_panels_model_groupbykind": "groupByKind()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L124 | neighbors=[meeting-panels-model.ts, countByKind(), meeting-panels-model.test.ts]
- "components_meeting_panels_model_hasactivefilters": "hasActiveFilters()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L42 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts, meeting-panels-model.test.ts]
- "components_meeting_panels_model_no_filters": "NO_FILTERS" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L40 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts, meeting-panels-model.test.ts]
- "components_meeting_panels_model_personfilteroption": "PersonFilterOption" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L29 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts, meeting-panels-model.test.ts]
- "components_meeting_panels_model_personnamesmatch": "personNamesMatch()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L64 | neighbors=[meeting-panels-model.ts, normalizePersonName(), meeting-panels-model.test.ts]
- "components_meeting_panels_model_resolvedensity": "resolveDensity()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L153 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts, meeting-panels-model.test.ts]
- "components_meeting_panels_model_resolvepanelopen": "resolvePanelOpen()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L165 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts, meeting-panels-model.test.ts]
- "components_meeting_panels_model_resolvesummarylanguage": "resolveSummaryLanguage()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L179 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts, meeting-panels-model.test.ts]
- "components_meeting_panels_model_summarylanguage": "SummaryLanguage" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L173 | neighbors=[meeting-notes.tsx, meeting-panels.tsx, meeting-panels-model.ts]
- "components_meeting_panels_model_togglekind": "toggleKind()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L113 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts, meeting-panels-model.test.ts]
- "components_meeting_panels_panelnav": "PanelNav()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L449 | neighbors=[meeting-intel.tsx, meeting-panels.tsx, usePanels()]
- "components_meeting_panels_readstored": "readStored()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L167 | neighbors=[meeting-panels.tsx, getDensitySnapshot(), getSummaryLanguageSnapshot()]
- "components_meeting_panels_usefilteredrows": "useFilteredRows()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L329 | neighbors=[meeting-notes.tsx, meeting-panels.tsx, usePanels()]
- "components_meeting_people_picker_model_buildpeopleoptions": "buildPeopleOptions()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L153 | neighbors=[meeting-people-picker.tsx, meeting-people-picker-model.ts, meeting-people-picker-model.test.ts]
- "components_meeting_people_picker_model_grouppeopleoptions": "groupPeopleOptions()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L181 | neighbors=[meeting-people-picker.tsx, meeting-people-picker-model.ts, meeting-people-picker-model.test.ts]
- "components_meeting_people_picker_model_matchespersonquery": "matchesPersonQuery()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L198 | neighbors=[meeting-people-picker.tsx, meeting-people-picker-model.ts, meeting-people-picker-model.test.ts]
- "components_meeting_people_picker_model_personinitial": "personInitial()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L318 | neighbors=[meeting-people-picker.tsx, meeting-people-picker-model.ts, meeting-people-picker-model.test.ts]
- "components_meeting_people_picker_model_pickableperson": "PickablePerson" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L19 | neighbors=[meeting-people-picker.tsx, meeting-people-picker-model.ts, note-timeline.tsx]
- "components_meeting_people_picker_model_resolveliststate": "resolveListState()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L300 | neighbors=[meeting-people-picker.tsx, meeting-people-picker-model.ts, meeting-people-picker-model.test.ts]
- "components_meeting_people_picker_model_toggleselection": "toggleSelection()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L287 | neighbors=[meeting-people-picker.tsx, meeting-people-picker-model.ts, meeting-people-picker-model.test.ts]
- "components_meeting_people_picker_model_topickervalue": "toPickerValue()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L210 | neighbors=[action-item-board.tsx, meeting-people-picker-model.ts, meeting-people-picker-model.test.ts]
- "components_meeting_pip_meetingpip": "MeetingPip()" | kind=code-symbol | source=src/features/meetings/components/meeting-pip.tsx:L102 | neighbors=[meeting-intel.tsx, meeting-pip.tsx, pipHost()]
- "components_meetings_calendar_useiswidescreen": "useIsWideScreen()" | kind=code-symbol | source=src/features/meetings/components/meetings-calendar.tsx:L101 | neighbors=[meetings-calendar.tsx, MeetingsCalendar(), meetings-views.tsx]
- "components_meetings_month_calendar_meetingchip": "MeetingChip()" | kind=code-symbol | source=src/features/meetings/components/meetings-month-calendar.tsx:L659 | neighbors=[meetings-month-calendar.tsx, chipLabel(), chipTone()]
- "components_meetings_time_grid_timerangelabel": "timeRangeLabel()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1660 | neighbors=[meetings-time-grid.tsx, buildBlockPreview(), CreateGhost()]
- "components_month_summary_monthsummary": "MonthSummary()" | kind=code-symbol | source=src/features/worklog/components/month-summary.tsx:L13 | neighbors=[month-summary.tsx, num(), page.tsx]
- "components_note_timeline_model_actionitemeditpatch": "ActionItemEditPatch" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L52 | neighbors=[action-item-board.tsx, meeting-notes.tsx, note-timeline-model.ts]
- "components_note_timeline_model_buildtaskupdatepayload": "buildTaskUpdatePayload()" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L87 | neighbors=[action-item-board.tsx, note-timeline-model.ts, note-timeline-model.test.ts]
- "components_note_timeline_model_classifyduedateinput": "classifyDueDateInput()" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L118 | neighbors=[action-item-board.tsx, note-timeline-model.ts, note-timeline-model.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-061.json

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
