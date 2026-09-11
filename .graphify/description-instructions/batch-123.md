# Node Description Batch 124 of 166

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

- "components_command_center_readrecents": "readRecents()" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L124 | neighbors=[command-center.tsx]
- "components_command_center_recent": "Recent" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L41 | neighbors=[command-center.tsx]
- "components_command_center_searchdeduper": "searchDeduper" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L68 | neighbors=[command-center.tsx]
- "components_command_center_status_dot": "STATUS_DOT" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L144 | neighbors=[command-center.tsx]
- "components_command_center_statusdot": "StatusDot()" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L154 | neighbors=[command-center.tsx]
- "components_command_center_statusshape": "StatusShape" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L143 | neighbors=[command-center.tsx]
- "components_correct_selection_correctionprompt": "CorrectionPrompt()" | kind=code-symbol | source=src/features/meetings/components/correct-selection.tsx:L250 | neighbors=[correct-selection.tsx]
- "components_correct_selection_offer": "Offer" | kind=code-symbol | source=src/features/meetings/components/correct-selection.tsx:L46 | neighbors=[correct-selection.tsx]
- "components_correct_selection_readoffer": "readOffer()" | kind=code-symbol | source=src/features/meetings/components/correct-selection.tsx:L55 | neighbors=[correct-selection.tsx]
- "components_danger_app_reset_card_dangerappoption": "DangerAppOption" | kind=code-symbol | source=src/features/admin/components/danger-app-reset-card.tsx:L15 | neighbors=[danger-app-reset-card.tsx]
- "components_danger_meeting_delete_card_dangermeetingoption": "DangerMeetingOption" | kind=code-symbol | source=src/features/admin/components/danger-meeting-delete-card.tsx:L12 | neighbors=[danger-meeting-delete-card.tsx]
- "components_dashboard_zones_apphealthcard": "AppHealthCard()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L925 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_apptaskgroup": "AppTaskGroup" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L433 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_cardskeleton": "CardSkeleton()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L1303 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_changerequestscard": "ChangeRequestsCard()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L1041 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_formatday": "formatDay()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L230 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_mydaystattiles": "MyDayStatTiles()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L259 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_risk_rank": "RISK_RANK" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L875 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_stat_hrefs": "STAT_HREFS" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L243 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_stat_tones": "STAT_TONES" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L251 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_task_tiles": "TASK_TILES" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L277 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_zonecomponent": "ZoneComponent" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L191 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_zoneprops": "ZoneProps" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L184 | neighbors=[dashboard-zones.tsx]
- "components_dashboard_zones_zoneview": "ZoneView" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L193 | neighbors=[dashboard-zones.tsx]
- "components_day_hours_card_editableduration": "editableDuration()" | kind=code-symbol | source=src/features/worklog/components/day-hours-card.tsx:L118 | neighbors=[day-hours-card.tsx]
- "components_day_hours_card_editdraft": "EditDraft" | kind=code-symbol | source=src/features/worklog/components/day-hours-card.tsx:L138 | neighbors=[day-hours-card.tsx]
- "components_day_hours_card_empty_hidden": "EMPTY_HIDDEN" | kind=code-symbol | source=src/features/worklog/components/day-hours-card.tsx:L86 | neighbors=[day-hours-card.tsx]
- "components_day_hours_card_observationkey": "observationKey()" | kind=code-symbol | source=src/features/worklog/components/day-hours-card.tsx:L98 | neighbors=[day-hours-card.tsx]
- "components_day_hours_card_rowfields": "rowFields()" | kind=code-symbol | source=src/features/worklog/components/day-hours-card.tsx:L159 | neighbors=[day-hours-card.tsx]
- "components_day_one_line_dayoneline": "DayOneLine()" | kind=code-symbol | source=src/features/worklog/components/day-one-line.tsx:L56 | neighbors=[day-one-line.tsx]
- "components_day_one_line_token_class": "TOKEN_CLASS" | kind=code-symbol | source=src/features/worklog/components/day-one-line.tsx:L46 | neighbors=[day-one-line.tsx]
- "components_day_panel_daynoteeditor": "DayNoteEditor()" | kind=code-symbol | source=src/features/worklog/components/day-panel.tsx:L345 | neighbors=[day-panel.tsx]
- "components_day_panel_dayscoreeditor": "DayScoreEditor()" | kind=code-symbol | source=src/features/worklog/components/day-panel.tsx:L407 | neighbors=[day-panel.tsx]
- "components_day_panel_score_presets": "SCORE_PRESETS" | kind=code-symbol | source=src/features/worklog/components/day-panel.tsx:L392 | neighbors=[day-panel.tsx]
- "components_db_clear_button_confirmbutton": "ConfirmButton()" | kind=code-symbol | source=src/features/admin/components/db-clear-button.tsx:L11 | neighbors=[db-clear-button.tsx]
- "components_declare_absence_dialog_refusal": "Refusal" | kind=code-symbol | source=src/features/worklog/components/declare-absence-dialog.tsx:L79 | neighbors=[declare-absence-dialog.tsx]
- "components_declare_absence_dialog_selfdeclarablekind": "SelfDeclarableKind" | kind=code-symbol | source=src/features/worklog/components/declare-absence-dialog.tsx:L56 | neighbors=[declare-absence-dialog.tsx]
- "components_directory_personnowlines": "PersonNowLines()" | kind=code-symbol | source=src/features/people/components/directory.tsx:L102 | neighbors=[directory.tsx]
- "components_directory_sort_label": "SORT_LABEL" | kind=code-symbol | source=src/features/people/components/directory.tsx:L47 | neighbors=[directory.tsx]
- "components_directory_sortkey": "SortKey" | kind=code-symbol | source=src/features/people/components/directory.tsx:L45 | neighbors=[directory.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-123.json

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
