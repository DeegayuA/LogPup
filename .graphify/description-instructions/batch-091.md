# Node Description Batch 92 of 166

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

- "components_use_dictation_usedictation": "useDictation()" | kind=code-symbol | source=src/features/speech/components/use-dictation.ts:L39 | neighbors=[dictate-button.tsx, use-dictation.ts]
- "components_use_glance_map_meetingglanceprovider": "MeetingGlanceProvider()" | kind=code-symbol | source=src/features/meetings/components/use-glance-map.tsx:L78 | neighbors=[use-glance-map.tsx, page.tsx]
- "components_use_live_transcription_uselivetranscription": "useLiveTranscription()" | kind=code-symbol | source=src/features/transcription/components/use-live-transcription.ts:L47 | neighbors=[meeting-intel.tsx, use-live-transcription.ts]
- "components_use_screen_keyframes_usescreenkeyframes": "useScreenKeyframes()" | kind=code-symbol | source=src/features/meetings/components/use-screen-keyframes.ts:L51 | neighbors=[meeting-intel.tsx, use-screen-keyframes.ts]
- "components_use_speech_speechhandle": "SpeechHandle" | kind=code-symbol | source=src/features/speech/components/use-speech.ts:L27 | neighbors=[speak-button.tsx, use-speech.ts]
- "components_user_table_usertable": "UserTable()" | kind=code-symbol | source=src/features/admin/components/user-table.tsx:L480 | neighbors=[user-table.tsx, page.tsx]
- "components_weekly_load_table_weeklyloadtable": "WeeklyLoadTable()" | kind=code-symbol | source=src/features/meeting-load/components/weekly-load-table.tsx:L12 | neighbors=[weekly-load-table.tsx, page.tsx]
- "components_worklog_calendar_calendardayfacts": "CalendarDayFacts" | kind=code-symbol | source=src/features/worklog/components/worklog-calendar.tsx:L17 | neighbors=[worklog-calendar.tsx, page.tsx]
- "components_worklog_calendar_mondaycolumn": "mondayColumn()" | kind=code-symbol | source=src/features/worklog/components/worklog-calendar.tsx:L46 | neighbors=[worklog-calendar.tsx, WorklogCalendar()]
- "components_worklog_calendar_monthshape": "monthShape()" | kind=code-symbol | source=src/features/worklog/components/worklog-calendar.tsx:L34 | neighbors=[worklog-calendar.tsx, WorklogCalendar()]
- "components_worklog_form_worklogform": "WorklogForm()" | kind=code-symbol | source=src/features/worklog/components/worklog-form.tsx:L51 | neighbors=[catch-up-panel.tsx, worklog-form.tsx]
- "components_your_series_card_yourseriescard": "YourSeriesCard()" | kind=code-symbol | source=src/features/meeting-load/components/your-series-card.tsx:L19 | neighbors=[your-series-card.tsx, page.tsx]
- "contribution_graph_index_contributiongraph": "ContributionGraph()" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L269 | neighbors=[activity-graph.tsx, index.tsx]
- "contribution_graph_index_contributiongraphlegend": "ContributionGraphLegend()" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L502 | neighbors=[index.tsx, useContributionGraph()]
- "contribution_graph_index_contributiongraphtotalcount": "ContributionGraphTotalCount()" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L473 | neighbors=[index.tsx, useContributionGraph()]
- "contribution_graph_index_fillholes": "fillHoles()" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L106 | neighbors=[index.tsx, groupByWeeks()]
- "contribution_graph_index_groupbyweeks": "groupByWeeks()" | kind=code-symbol | source=src/components/kibo-ui/contribution-graph/index.tsx:L145 | neighbors=[index.tsx, fillHoles()]
- "dashboard_ai_engine_aienginerow": "AiEngineRow" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L72 | neighbors=[ai-engine-card.tsx, ai-engine.ts]
- "dashboard_ai_engine_chainfor": "chainFor()" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L174 | neighbors=[ai-engine.ts, defaultLeadFor()]
- "dashboard_ai_engine_defaultleadfor": "defaultLeadFor()" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L183 | neighbors=[ai-engine.ts, chainFor()]
- "dashboard_ai_engine_modelfactsfor": "modelFactsFor()" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L47 | neighbors=[ai-engine.ts, ai-engine.test.ts]
- "dashboard_ai_engine_modelstability": "ModelStability" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L32 | neighbors=[ai-engine-card.tsx, ai-engine.ts]
- "dashboard_ai_engine_trimrate": "trimRate()" | kind=code-symbol | source=src/features/dashboard/ai-engine.ts:L261 | neighbors=[ai-engine.ts, formatRate()]
- "dashboard_my_day_stats_plural": "plural()" | kind=code-symbol | source=src/features/dashboard/my-day-stats.ts:L24 | neighbors=[my-day-stats.ts, buildMyDayStats()]
- "dashboard_sort_capacities_test": "sort-capacities.test.ts" | kind=code-symbol | source=src/features/dashboard/sort-capacities.test.ts:L1 | neighbors=[sort-capacities.ts, sortCapacities()]
- "dashboard_zones_admittinggrant": "AdmittingGrant" | kind=code-symbol | source=src/features/dashboard/zones.ts:L43 | neighbors=[dashboard-zones.tsx, zones.ts]
- "dashboard_zones_dashboard_zones": "DASHBOARD_ZONES" | kind=code-symbol | source=src/features/dashboard/zones.ts:L76 | neighbors=[zones.ts, zones.test.ts]
- "dashboard_zones_grantforzone": "grantForZone()" | kind=code-symbol | source=src/features/dashboard/zones.ts:L196 | neighbors=[zones.ts, composeDashboard()]
- "dashboard_zones_isknownrole": "isKnownRole()" | kind=code-symbol | source=src/features/dashboard/zones.ts:L178 | neighbors=[zones.ts, composeDashboard()]
- "dashboard_zones_zone_ids": "ZONE_IDS" | kind=code-symbol | source=src/features/dashboard/zones.ts:L29 | neighbors=[zones.ts, zones.test.ts]
- "dashboard_zones_zone_order": "ZONE_ORDER" | kind=code-symbol | source=src/features/dashboard/zones.ts:L149 | neighbors=[zones.ts, zones.test.ts]
- "db_live_liveappcolumns": "liveAppColumns" | kind=code-symbol | source=src/db/live.ts:L70 | neighbors=[queries.ts, live.ts]
- "db_live_liveappsas": "liveAppsAs()" | kind=code-symbol | source=src/db/live.ts:L21 | neighbors=[live.ts, ai-actions.ts]
- "db_live_livemeetingsas": "liveMeetingsAs()" | kind=code-symbol | source=src/db/live.ts:L25 | neighbors=[live.ts, live.test.ts]
- "db_live_livetasksas": "liveTasksAs()" | kind=code-symbol | source=src/db/live.ts:L27 | neighbors=[live.ts, ai-actions.ts]
- "db_live_meeting_child_tables": "MEETING_CHILD_TABLES" | kind=code-symbol | source=src/db/live.ts:L143 | neighbors=[live.ts, live.test.ts]
- "db_live_soft_tables": "SOFT_TABLES" | kind=code-symbol | source=src/db/live.ts:L93 | neighbors=[live.ts, live.test.ts]
- "db_live_test_bodybraceindex": "bodyBraceIndex()" | kind=code-symbol | source=src/db/live.test.ts:L482 | neighbors=[live.test.ts, functionSpan()]
- "db_live_test_functionspan": "functionSpan()" | kind=code-symbol | source=src/db/live.test.ts:L510 | neighbors=[live.test.ts, bodyBraceIndex()]
- "db_schema_absencekind": "absenceKind" | kind=code-symbol | source=src/db/schema.ts:L64 | neighbors=[schema.ts, absence-kinds.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-091.json

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
