# Node Description Batch 63 of 166

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

- "components_note_timeline_model_deadlinehintsource": "DeadlineHintSource" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L124 | neighbors=[action-item-board.tsx, note-timeline.tsx, note-timeline-model.ts]
- "components_note_timeline_model_resolveactionitemedittarget": "resolveActionItemEditTarget()" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L38 | neighbors=[action-item-board.tsx, note-timeline-model.ts, note-timeline-model.test.ts]
- "components_org_tags_field_orgtagsfield": "OrgTagsField()" | kind=code-symbol | source=src/features/admin/components/org-tags-field.tsx:L16 | neighbors=[add-user-dialog.tsx, org-tags-field.tsx, user-table.tsx]
- "components_pending_approvals_card_pendingapprovalscard": "PendingApprovalsCard()" | kind=code-symbol | source=src/features/admin/components/pending-approvals-card.tsx:L186 | neighbors=[page.tsx, dashboard-zones.tsx, pending-approvals-card.tsx]
- "components_person_activity_card_personactivitycard": "PersonActivityCard()" | kind=code-symbol | source=src/features/people/components/person-activity-card.tsx:L93 | neighbors=[person-activity-card.tsx, formatDay(), page.tsx]
- "components_person_meetings_card_personmeetingscard": "PersonMeetingsCard()" | kind=code-symbol | source=src/features/people/components/person-meetings-card.tsx:L47 | neighbors=[dashboard-zones.tsx, person-meetings-card.tsx, page.tsx]
- "components_person_stat_row_personstatrow": "PersonStatRow()" | kind=code-symbol | source=src/features/people/components/person-stat-row.tsx:L38 | neighbors=[person-stat-row.tsx, page.tsx, page.tsx]
- "components_person_tasks_card_persontaskscard": "PersonTasksCard()" | kind=code-symbol | source=src/features/people/components/person-tasks-card.tsx:L90 | neighbors=[dashboard-zones.tsx, person-tasks-card.tsx, page.tsx]
- "components_person_tasks_card_taskrow": "TaskRow()" | kind=code-symbol | source=src/features/people/components/person-tasks-card.tsx:L196 | neighbors=[person-tasks-card.tsx, dueSuffix(), formatDueDate()]
- "components_portfolio_summary_portfoliosummarystrip": "PortfolioSummaryStrip()" | kind=code-symbol | source=src/features/apps/components/portfolio-summary.tsx:L35 | neighbors=[page.tsx, dashboard-zones.tsx, portfolio-summary.tsx]
- "components_progress_apps_lane_progressappslaneskeleton": "ProgressAppsLaneSkeleton()" | kind=code-symbol | source=src/features/worklog/components/progress-apps-lane.tsx:L180 | neighbors=[progress-apps-lane.tsx, loading.tsx, page.tsx]
- "components_progress_matrix_progressmatrix": "ProgressMatrix()" | kind=code-symbol | source=src/features/worklog/components/progress-matrix.tsx:L65 | neighbors=[progress-matrix.tsx, noon(), page.tsx]
- "components_progress_matrix_progressmatrixskeleton": "ProgressMatrixSkeleton()" | kind=code-symbol | source=src/features/worklog/components/progress-matrix.tsx:L362 | neighbors=[progress-matrix.tsx, loading.tsx, page.tsx]
- "components_project_finance_card_costfigure": "CostFigure()" | kind=code-symbol | source=src/features/finance/components/project-finance-card.tsx:L72 | neighbors=[project-finance-card.tsx, hours(), money()]
- "components_project_finance_card_money": "money()" | kind=code-symbol | source=src/features/finance/components/project-finance-card.tsx:L41 | neighbors=[project-finance-card.tsx, CostFigure(), ProjectFinanceCard()]
- "components_roadmap_timeline_dragid": "dragId()" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L161 | neighbors=[roadmap-timeline.tsx, BarBody(), ResizeHandle()]
- "components_roadmap_timeline_resizehandle": "ResizeHandle()" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L1348 | neighbors=[roadmap-timeline.tsx, dragId(), parseIso()]
- "components_roadmap_timeline_sprintbar": "SprintBar()" | kind=code-symbol | source=src/features/sprints/components/roadmap-timeline.tsx:L1047 | neighbors=[roadmap-timeline.tsx, formatRange(), parseIso()]
- "components_signals_view_figurecell": "FigureCell()" | kind=code-symbol | source=src/features/signals/components/signals-view.tsx:L171 | neighbors=[signals-view.tsx, formatFigure(), unitSuffix()]
- "components_speak_button_speakbutton": "SpeakButton()" | kind=code-symbol | source=src/features/speech/components/speak-button.tsx:L19 | neighbors=[meeting-assistant.tsx, meeting-notes.tsx, speak-button.tsx]
- "components_sprint_checkin_editor_gaphint": "GapHint()" | kind=code-symbol | source=src/features/sprints/components/sprint-checkin-editor.tsx:L24 | neighbors=[meeting-prep.tsx, sprint-checkin-editor.tsx, sprint-checkins.tsx]
- "components_sprint_checkin_editor_sprintcheckineditor": "SprintCheckinEditor()" | kind=code-symbol | source=src/features/sprints/components/sprint-checkin-editor.tsx:L61 | neighbors=[sprint-checkin-editor.tsx, parsePercent(), sprint-checkins.tsx]
- "components_sprint_edit_dialog_sprinteditdialog": "SprintEditDialog()" | kind=code-symbol | source=src/features/sprints/components/sprint-edit-dialog.tsx:L87 | neighbors=[roadmap-timeline.tsx, sprint-edit-dialog.tsx, toFormState()]
- "components_suggestion_decision_buttons_suggestiondecisionbuttons": "SuggestionDecisionButtons()" | kind=code-symbol | source=src/features/meeting-load/components/suggestion-decision-buttons.tsx:L17 | neighbors=[meeting-load-admin-card.tsx, suggestion-decision-buttons.tsx, your-series-card.tsx]
- "components_task_card_cardlabel": "cardLabel()" | kind=code-symbol | source=src/features/sprints/components/task-card.tsx:L140 | neighbors=[task-card.tsx, formatDueDate(), TaskCard()]
- "components_task_dialog_taskdialog": "TaskDialog()" | kind=code-symbol | source=src/features/sprints/components/task-dialog.tsx:L87 | neighbors=[board.tsx, task-dialog.tsx, toFormState()]
- "components_task_split_bar_tasksplitbar": "TaskSplitBar()" | kind=code-symbol | source=src/features/apps/components/task-split-bar.tsx:L35 | neighbors=[app-card.tsx, task-split-bar.tsx, page.tsx]
- "components_trash_card_logic_ordergroupsfordisplay": "orderGroupsForDisplay()" | kind=code-symbol | source=src/features/admin/components/trash-card-logic.ts:L51 | neighbors=[trash-card.tsx, trash-card-logic.ts, trash-card-logic.test.ts]
- "components_trash_card_logic_trash_group_titles": "TRASH_GROUP_TITLES" | kind=code-symbol | source=src/features/admin/components/trash-card-logic.ts:L31 | neighbors=[trash-card.tsx, trash-card-logic.ts, trash-card-logic.test.ts]
- "components_trash_card_logic_trashcountfootnote": "trashCountFootnote()" | kind=code-symbol | source=src/features/admin/components/trash-card-logic.ts:L62 | neighbors=[trash-card.tsx, trash-card-logic.ts, trash-card-logic.test.ts]
- "components_use_glance_map_nextlistboundary": "nextListBoundary()" | kind=code-symbol | source=src/features/meetings/components/use-glance-map.tsx:L226 | neighbors=[use-glance-map.tsx, use-glance-map.test.ts, useListNow()]
- "components_use_glance_map_uselistnow": "useListNow()" | kind=code-symbol | source=src/features/meetings/components/use-glance-map.tsx:L266 | neighbors=[meetings-views.tsx, use-glance-map.tsx, nextListBoundary()]
- "components_worklog_calendar_shiftmonth": "shiftMonth()" | kind=code-symbol | source=src/features/worklog/components/worklog-calendar.tsx:L40 | neighbors=[worklog-calendar.tsx, WorklogCalendar(), page.tsx]
- "contribution_graph_index_contributiongraphblock": "ContributionGraphBlock()" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L341 | neighbors=[activity-graph.tsx, index.tsx, useContributionGraph()]
- "contribution_graph_index_contributiongraphcalendar": "ContributionGraphCalendar()" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L394 | neighbors=[activity-graph.tsx, index.tsx, useContributionGraph()]
- "dashboard_ai_engine_buildaienginerows": "buildAiEngineRows()" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L112 | neighbors=[dashboard-zones.tsx, ai-engine.ts, ai-engine.test.ts]
- "dashboard_ai_engine_sortaienginerows": "sortAiEngineRows()" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L193 | neighbors=[dashboard-zones.tsx, ai-engine.ts, ai-engine.test.ts]
- "dashboard_sprint_progress_daysremaining": "daysRemaining()" | kind=code-symbol | source=src/features/dashboard/sprint-progress.ts:L20 | neighbors=[active-sprints.tsx, sprint-progress.ts, sprint-progress.test.ts]
- "dashboard_sprint_progress_test": "sprint-progress.test.ts" | kind=code-symbol | source=src/features/dashboard/sprint-progress.test.ts:L1 | neighbors=[sprint-progress.ts, daysRemaining(), sprintProgress()]
- "dashboard_zones_zoneid": "ZoneId" | kind=code-symbol | source=src/features/dashboard/zones.ts:L40 | neighbors=[dashboard-zones.tsx, zones.ts, zones.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-062.json

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
