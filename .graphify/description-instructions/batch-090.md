# Node Description Batch 91 of 166

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

- "components_roadmap_timeline_buildticks": "buildTicks()" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L192 | neighbors=[roadmap-timeline.tsx, parseIso()]
- "components_roadmap_timeline_roadmaptimeline": "RoadmapTimeline()" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L226 | neighbors=[roadmap.tsx, roadmap-timeline.tsx]
- "components_roadmap_timeline_sprintindexrow": "SprintIndexRow()" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L1416 | neighbors=[roadmap-timeline.tsx, formatRange()]
- "components_screen_filmstrip_screenfilmstrip": "ScreenFilmstrip()" | kind=code-symbol | source=src/features/meetings/components/screen-filmstrip.tsx:L20 | neighbors=[meeting-intel.tsx, screen-filmstrip.tsx]
- "components_seat_select_seatselect": "SeatSelect()" | kind=code-symbol | source=src/features/admin/components/seat-select.tsx:L52 | neighbors=[seat-select.tsx, user-table.tsx]
- "components_series_load_table_seriesloadtable": "SeriesLoadTable()" | kind=code-symbol | source=src/features/meeting-load/components/series-load-table.tsx:L20 | neighbors=[series-load-table.tsx, page.tsx]
- "components_sign_in_backdrop_signinbackdrop": "SignInBackdrop()" | kind=code-symbol | source=src/features/auth/components/sign-in-backdrop.tsx:L25 | neighbors=[sign-in-backdrop.tsx, page.tsx]
- "components_sign_in_methods_ismethod": "isMethod()" | kind=code-symbol | source=src/features/auth/components/sign-in-methods.tsx:L34 | neighbors=[sign-in-methods.tsx, readLastMethod()]
- "components_sign_in_methods_readlastmethod": "readLastMethod()" | kind=code-symbol | source=src/features/auth/components/sign-in-methods.tsx:L60 | neighbors=[sign-in-methods.tsx, isMethod()]
- "components_sign_in_methods_signinmethods": "SignInMethods()" | kind=code-symbol | source=src/features/auth/components/sign-in-methods.tsx:L78 | neighbors=[sign-in-methods.tsx, page.tsx]
- "components_signal_board_signalboard": "SignalBoard()" | kind=code-symbol | source=src/features/intel/components/signal-board.tsx:L60 | neighbors=[intel-view.tsx, signal-board.tsx]
- "components_signals_view_formatfigure": "formatFigure()" | kind=code-symbol | source=src/features/signals/components/signals-view.tsx:L208 | neighbors=[signals-view.tsx, FigureCell()]
- "components_signals_view_signalshelp": "SignalsHelp()" | kind=code-symbol | source=src/features/signals/components/signals-view.tsx:L227 | neighbors=[signals-view.tsx, page.tsx]
- "components_signals_view_signalsview": "SignalsView()" | kind=code-symbol | source=src/features/signals/components/signals-view.tsx:L33 | neighbors=[signals-view.tsx, page.tsx]
- "components_signals_view_unitsuffix": "unitSuffix()" | kind=code-symbol | source=src/features/signals/components/signals-view.tsx:L214 | neighbors=[signals-view.tsx, FigureCell()]
- "components_spine_scroller": "spine-scroller.tsx" | kind=code-symbol | source=src/features/sprints/components/spine-scroller.tsx:L1 | neighbors=[roadmap-spine.tsx, SpineScroller()]
- "components_spine_scroller_spinescroller": "SpineScroller()" | kind=code-symbol | source=src/features/sprints/components/spine-scroller.tsx:L19 | neighbors=[roadmap-spine.tsx, spine-scroller.tsx]
- "components_sprint_checkin_editor_parsepercent": "parsePercent()" | kind=code-symbol | source=src/features/sprints/components/sprint-checkin-editor.tsx:L40 | neighbors=[sprint-checkin-editor.tsx, SprintCheckinEditor()]
- "components_sprint_checkins_sprintcheckins": "SprintCheckins()" | kind=code-symbol | source=src/features/sprints/components/sprint-checkins.tsx:L27 | neighbors=[sprint-checkins.tsx, page.tsx]
- "components_sprint_edit_dialog_toformstate": "toFormState()" | kind=code-symbol | source=src/features/sprints/components/sprint-edit-dialog.tsx:L54 | neighbors=[sprint-edit-dialog.tsx, SprintEditDialog()]
- "components_sprint_form_dialog_initialformstate": "initialFormState()" | kind=code-symbol | source=src/features/sprints/components/sprint-form-dialog.tsx:L52 | neighbors=[sprint-form-dialog.tsx, todayIsoDate()]
- "components_sprint_form_dialog_sprintformdialog": "SprintFormDialog()" | kind=code-symbol | source=src/features/sprints/components/sprint-form-dialog.tsx:L65 | neighbors=[sprint-form-dialog.tsx, page.tsx]
- "components_sprint_form_dialog_todayisodate": "todayIsoDate()" | kind=code-symbol | source=src/features/sprints/components/sprint-form-dialog.tsx:L44 | neighbors=[sprint-form-dialog.tsx, initialFormState()]
- "components_sprint_status_select_sprintstatusselect": "SprintStatusSelect()" | kind=code-symbol | source=src/features/sprints/components/sprint-status-select.tsx:L22 | neighbors=[sprint-status-select.tsx, page.tsx]
- "components_sprint_switcher_sprintswitcher": "SprintSwitcher()" | kind=code-symbol | source=src/features/sprints/components/sprint-switcher.tsx:L57 | neighbors=[sprint-switcher.tsx, page.tsx]
- "components_task_card_cardface": "CardFace()" | kind=code-symbol | source=src/features/sprints/components/task-card.tsx:L69 | neighbors=[task-card.tsx, formatDueDate()]
- "components_task_card_prioritymenulabel": "priorityMenuLabel()" | kind=code-symbol | source=src/features/sprints/components/task-card.tsx:L51 | neighbors=[task-card.tsx, TaskCard()]
- "components_task_card_taskcardface": "TaskCardFace()" | kind=code-symbol | source=src/features/sprints/components/task-card.tsx:L153 | neighbors=[board.tsx, task-card.tsx]
- "components_task_composer_taskcomposer": "TaskComposer()" | kind=code-symbol | source=src/features/sprints/components/task-composer.tsx:L66 | neighbors=[board-column.tsx, task-composer.tsx]
- "components_task_dialog_toformstate": "toFormState()" | kind=code-symbol | source=src/features/sprints/components/task-dialog.tsx:L63 | neighbors=[task-dialog.tsx, TaskDialog()]
- "components_team_panel_teampanel": "TeamPanel()" | kind=code-symbol | source=src/features/people/components/team-panel.tsx:L27 | neighbors=[team-panel.tsx, page.tsx]
- "components_tech_tags_input_techtagsinput": "TechTagsInput()" | kind=code-symbol | source=src/features/apps/components/tech-tags-input.tsx:L35 | neighbors=[app-form-dialog.tsx, tech-tags-input.tsx]
- "components_trash_card_logic_trash_group_order": "TRASH_GROUP_ORDER" | kind=code-symbol | source=src/features/admin/components/trash-card-logic.ts:L17 | neighbors=[trash-card-logic.ts, trash-card-logic.test.ts]
- "components_trash_card_trashcard": "TrashCard()" | kind=code-symbol | source=src/features/admin/components/trash-card.tsx:L159 | neighbors=[trash-card.tsx, page.tsx]
- "components_trash_row_actions_callrestore": "callRestore()" | kind=code-symbol | source=src/features/admin/components/trash-row-actions.tsx:L55 | neighbors=[trash-card.tsx, trash-row-actions.tsx]
- "components_trash_row_actions_purge_by_kind": "PURGE_BY_KIND" | kind=code-symbol | source=src/features/admin/components/trash-row-actions.tsx:L96 | neighbors=[trash-card.tsx, trash-row-actions.tsx]
- "components_trash_row_actions_trashrowactions": "TrashRowActions()" | kind=code-symbol | source=src/features/admin/components/trash-row-actions.tsx:L114 | neighbors=[trash-card.tsx, trash-row-actions.tsx]
- "components_triage_queue_pager_triagequeuepager": "TriageQueuePager()" | kind=code-symbol | source=src/features/bugs/components/triage-queue-pager.tsx:L27 | neighbors=[page.tsx, triage-queue-pager.tsx]
- "components_triage_rail_triagerail": "TriageRail()" | kind=code-symbol | source=src/features/meetings/components/triage-rail.tsx:L37 | neighbors=[triage-rail.tsx, page.tsx]
- "components_upcoming_filter_upcomingmeetingsfiltered": "UpcomingMeetingsFiltered()" | kind=code-symbol | source=src/features/meetings/components/upcoming-filter.tsx:L36 | neighbors=[meetings-views.tsx, upcoming-filter.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-090.json

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
