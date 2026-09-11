# Node Description Batch 123 of 166

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

- "components_board_skeleton_boardskeleton": "BoardSkeleton()" | kind=code-symbol | source=src/features/sprints/components/board-skeleton.tsx:L31 | neighbors=[board-skeleton.tsx]
- "components_board_skeleton_column_card_counts": "COLUMN_CARD_COUNTS" | kind=code-symbol | source=src/features/sprints/components/board-skeleton.tsx:L22 | neighbors=[board-skeleton.tsx]
- "components_board_toolbar_stat": "Stat()" | kind=code-symbol | source=src/features/sprints/components/board-toolbar.tsx:L41 | neighbors=[board-toolbar.tsx]
- "components_briefing_card_briefingbodypending": "BriefingBodyPending()" | kind=code-symbol | source=src/features/intel/components/briefing-card.tsx:L308 | neighbors=[briefing-card.tsx]
- "components_briefing_card_tomarkdown": "toMarkdown()" | kind=code-symbol | source=src/features/intel/components/briefing-card.tsx:L343 | neighbors=[briefing-card.tsx]
- "components_bug_csv_import_dialog_importpreview": "ImportPreview()" | kind=code-symbol | source=src/features/bugs/components/bug-csv-import-dialog.tsx:L318 | neighbors=[bug-csv-import-dialog.tsx]
- "components_bug_csv_import_dialog_templatesection": "TemplateSection()" | kind=code-symbol | source=src/features/bugs/components/bug-csv-import-dialog.tsx:L283 | neighbors=[bug-csv-import-dialog.tsx]
- "components_bug_list_bugfilterbar": "BugFilterBar()" | kind=code-symbol | source=src/features/bugs/components/bug-list.tsx:L228 | neighbors=[bug-list.tsx]
- "components_bug_list_buglistrow": "BugListRow" | kind=code-symbol | source=src/features/bugs/components/bug-list.tsx:L49 | neighbors=[bug-list.tsx]
- "components_bug_list_filterchip": "FilterChip()" | kind=code-symbol | source=src/features/bugs/components/bug-list.tsx:L282 | neighbors=[bug-list.tsx]
- "components_bug_list_filterrow": "FilterRow()" | kind=code-symbol | source=src/features/bugs/components/bug-list.tsx:L271 | neighbors=[bug-list.tsx]
- "components_bug_triage_controls_triagestate": "TriageState" | kind=code-symbol | source=src/features/bugs/components/bug-triage-controls.tsx:L51 | neighbors=[bug-triage-controls.tsx]
- "components_capacity_bar_band_suffix": "BAND_SUFFIX" | kind=code-symbol | source=src/features/people/components/capacity-bar.tsx:L27 | neighbors=[capacity-bar.tsx]
- "components_capacity_bar_fill": "FILL" | kind=code-symbol | source=src/features/people/components/capacity-bar.tsx:L20 | neighbors=[capacity-bar.tsx]
- "components_capacity_heat_editable_assignpopover": "AssignPopover()" | kind=code-symbol | source=src/features/dashboard/components/capacity-heat-editable.tsx:L562 | neighbors=[capacity-heat-editable.tsx]
- "components_capacity_heat_editable_chipeditor": "ChipEditor()" | kind=code-symbol | source=src/features/dashboard/components/capacity-heat-editable.tsx:L348 | neighbors=[capacity-heat-editable.tsx]
- "components_capacity_heat_editable_mapperson": "mapPerson()" | kind=code-symbol | source=src/features/dashboard/components/capacity-heat-editable.tsx:L105 | neighbors=[capacity-heat-editable.tsx]
- "components_capacity_heat_editable_parsepct": "parsePct()" | kind=code-symbol | source=src/features/dashboard/components/capacity-heat-editable.tsx:L81 | neighbors=[capacity-heat-editable.tsx]
- "components_capacity_heat_editable_personrow": "PersonRow()" | kind=code-symbol | source=src/features/dashboard/components/capacity-heat-editable.tsx:L292 | neighbors=[capacity-heat-editable.tsx]
- "components_capacity_heat_editable_warningof": "warningOf()" | kind=code-symbol | source=src/features/dashboard/components/capacity-heat-editable.tsx:L116 | neighbors=[capacity-heat-editable.tsx]
- "components_capacity_heat_editable_withbreakdown": "withBreakdown()" | kind=code-symbol | source=src/features/dashboard/components/capacity-heat-editable.tsx:L93 | neighbors=[capacity-heat-editable.tsx]
- "components_catch_up_panel_catchupgap": "CatchUpGap" | kind=code-symbol | source=src/features/worklog/components/catch-up-panel.tsx:L27 | neighbors=[catch-up-panel.tsx]
- "components_catch_up_panel_catchuppanel": "CatchUpPanel()" | kind=code-symbol | source=src/features/worklog/components/catch-up-panel.tsx:L47 | neighbors=[catch-up-panel.tsx]
- "components_cohort_views_cleared": "CLEARED" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L189 | neighbors=[cohort-views.tsx]
- "components_cohort_views_filtergroup": "FilterGroup()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L290 | neighbors=[cohort-views.tsx]
- "components_cohort_views_memberrow": "MemberRow()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L113 | neighbors=[cohort-views.tsx]
- "components_cohort_views_overlapanchorid": "overlapAnchorId()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L583 | neighbors=[cohort-views.tsx]
- "components_cohort_views_overlappicker": "OverlapPicker()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L663 | neighbors=[cohort-views.tsx]
- "components_cohort_views_overlapsummary": "OverlapSummary()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L602 | neighbors=[cohort-views.tsx]
- "components_cohort_views_personlink": "PersonLink()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L76 | neighbors=[cohort-views.tsx]
- "components_cohort_views_projectdot": "ProjectDot()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L64 | neighbors=[cohort-views.tsx]
- "components_cohort_views_projectfilterbar": "ProjectFilterBar()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L203 | neighbors=[cohort-views.tsx]
- "components_cohort_views_sprintline": "SprintLine()" | kind=code-symbol | source=src/features/people/components/cohort-views.tsx:L147 | neighbors=[cohort-views.tsx]
- "components_command_center_commandcentercontext": "CommandCenterContext" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L71 | neighbors=[command-center.tsx]
- "components_command_center_empty_results": "EMPTY_RESULTS" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L47 | neighbors=[command-center.tsx]
- "components_command_center_go_keys": "GO_KEYS" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L95 | neighbors=[command-center.tsx]
- "components_command_center_go_targets": "GO_TARGETS" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L89 | neighbors=[command-center.tsx]
- "components_command_center_goshortcutsenabled": "goShortcutsEnabled()" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L104 | neighbors=[command-center.tsx]
- "components_command_center_intentdeduper": "intentDeduper" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L69 | neighbors=[command-center.tsx]
- "components_command_center_istypingtarget": "isTypingTarget()" | kind=code-symbol | source=src/features/search/components/command-center.tsx:L114 | neighbors=[command-center.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-122.json

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
