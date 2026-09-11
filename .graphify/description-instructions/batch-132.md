# Node Description Batch 133 of 166

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

- "components_user_table_removepersonbutton": "RemovePersonButton()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L1157 | neighbors=[user-table.tsx]
- "components_user_table_resetpasswordbutton": "ResetPasswordButton()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L1110 | neighbors=[user-table.tsx]
- "components_user_table_seatcell": "SeatCell()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L315 | neighbors=[user-table.tsx]
- "components_user_table_status_items": "STATUS_ITEMS" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L462 | neighbors=[user-table.tsx]
- "components_user_table_statusfilter": "StatusFilter" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L460 | neighbors=[user-table.tsx]
- "components_worklog_calendar_legend_label": "LEGEND_LABEL" | kind=code-symbol | source=src/features/worklog/components/worklog-calendar.tsx:L88 | neighbors=[worklog-calendar.tsx]
- "components_worklog_calendar_legend_states": "LEGEND_STATES" | kind=code-symbol | source=src/features/worklog/components/worklog-calendar.tsx:L65 | neighbors=[worklog-calendar.tsx]
- "components_worklog_calendar_legendswatchclass": "legendSwatchClass()" | kind=code-symbol | source=src/features/worklog/components/worklog-calendar.tsx:L95 | neighbors=[worklog-calendar.tsx]
- "components_worklog_calendar_weekdays": "WEEKDAYS" | kind=code-symbol | source=src/features/worklog/components/worklog-calendar.tsx:L55 | neighbors=[worklog-calendar.tsx]
- "components_worklog_form_percentsuggestion": "PercentSuggestion" | kind=code-symbol | source=src/features/worklog/components/worklog-form.tsx:L33 | neighbors=[worklog-form.tsx]
- "components_worklog_form_score_presets": "SCORE_PRESETS" | kind=code-symbol | source=src/features/worklog/components/worklog-form.tsx:L35 | neighbors=[worklog-form.tsx]
- "components_your_series_card_evidenceline": "evidenceLine()" | kind=code-symbol | source=src/features/meeting-load/components/your-series-card.tsx:L54 | neighbors=[your-series-card.tsx]
- "contribution_graph_index_activity": "Activity" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L26 | neighbors=[index.tsx]
- "contribution_graph_index_contributiongraphblockprops": "ContributionGraphBlockProps" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L335 | neighbors=[index.tsx]
- "contribution_graph_index_contributiongraphcalendarprops": "ContributionGraphCalendarProps" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L381 | neighbors=[index.tsx]
- "contribution_graph_index_contributiongraphcontext": "ContributionGraphContext" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L91 | neighbors=[index.tsx]
- "contribution_graph_index_contributiongraphcontexttype": "ContributionGraphContextType" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L74 | neighbors=[index.tsx]
- "contribution_graph_index_contributiongraphfooter": "ContributionGraphFooter()" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L453 | neighbors=[index.tsx]
- "contribution_graph_index_contributiongraphfooterprops": "ContributionGraphFooterProps" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L451 | neighbors=[index.tsx]
- "contribution_graph_index_contributiongraphlegendprops": "ContributionGraphLegendProps" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L495 | neighbors=[index.tsx]
- "contribution_graph_index_contributiongraphprops": "ContributionGraphProps" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L254 | neighbors=[index.tsx]
- "contribution_graph_index_contributiongraphtotalcountprops": "ContributionGraphTotalCountProps" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L466 | neighbors=[index.tsx]
- "contribution_graph_index_default_labels": "DEFAULT_LABELS" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L64 | neighbors=[index.tsx]
- "contribution_graph_index_default_month_labels": "DEFAULT_MONTH_LABELS" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L49 | neighbors=[index.tsx]
- "contribution_graph_index_getmonthlabels": "getMonthLabels()" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L184 | neighbors=[index.tsx]
- "contribution_graph_index_labels": "Labels" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L34 | neighbors=[index.tsx]
- "contribution_graph_index_monthlabel": "MonthLabel" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L44 | neighbors=[index.tsx]
- "contribution_graph_index_week": "Week" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L32 | neighbors=[index.tsx]
- "danger_page_admindangerpage": "AdminDangerPage()" | kind=code-symbol | source=src/app/(app)/admin/danger/page.tsx:L41 | neighbors=[page.tsx]
- "danger_page_danger_page_actions": "DANGER_PAGE_ACTIONS" | kind=code-symbol | source=src/app/(app)/admin/danger/page.tsx:L32 | neighbors=[page.tsx]
- "danger_page_dangercontrols": "DangerControls()" | kind=code-symbol | source=src/app/(app)/admin/danger/page.tsx:L111 | neighbors=[page.tsx]
- "danger_page_dangerskeleton": "DangerSkeleton()" | kind=code-symbol | source=src/app/(app)/admin/danger/page.tsx:L165 | neighbors=[page.tsx]
- "dashboard_ai_engine_model_facts": "MODEL_FACTS" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L40 | neighbors=[ai-engine.ts]
- "dashboard_ai_engine_modelfacts": "ModelFacts" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L34 | neighbors=[ai-engine.ts]
- "dashboard_ai_engine_test_prefswith": "prefsWith()" | kind=code-symbol | source=src/features/dashboard/ai-engine.test.ts:L42 | neighbors=[ai-engine.test.ts]
- "dashboard_ai_engine_test_usage": "usage()" | kind=code-symbol | source=src/features/dashboard/ai-engine.test.ts:L48 | neighbors=[ai-engine.test.ts]
- "dashboard_ai_engine_unrouted": "UNROUTED" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L70 | neighbors=[ai-engine.ts]
- "dashboard_my_day_stats_mydayinput": "MyDayInput" | kind=code-symbol | source=src/features/dashboard/my-day-stats.ts:L16 | neighbors=[my-day-stats.ts]
- "dashboard_my_day_stats_test_quiet": "QUIET" | kind=code-symbol | source=src/features/dashboard/my-day-stats.test.ts:L8 | neighbors=[my-day-stats.test.ts]
- "dashboard_my_day_stats_test_quiet_tasks": "QUIET_TASKS" | kind=code-symbol | source=src/features/dashboard/my-day-stats.test.ts:L6 | neighbors=[my-day-stats.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-132.json

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
