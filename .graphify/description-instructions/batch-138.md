# Node Description Batch 139 of 166

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

- "gemini_usage_aiusageeventinput": "AiUsageEventInput" | kind=code-symbol | source=src/features/gemini/usage.ts:L7 | neighbors=[usage.ts]
- "gemini_usage_summary_featureadoption": "FeatureAdoption" | kind=code-symbol | source=src/features/gemini/usage-summary.ts:L129 | neighbors=[usage-summary.ts]
- "gemini_usage_summary_slug_to_feature": "SLUG_TO_FEATURE" | kind=code-symbol | source=src/features/gemini/usage-summary.ts:L57 | neighbors=[usage-summary.ts]
- "gemini_usage_summary_test_agg": "agg()" | kind=code-symbol | source=src/features/gemini/usage-summary.test.ts:L132 | neighbors=[usage-summary.test.ts]
- "gemini_usage_summary_test_at": "AT" | kind=code-symbol | source=src/features/gemini/usage-summary.test.ts:L11 | neighbors=[usage-summary.test.ts]
- "gemini_usage_summary_test_row": "row()" | kind=code-symbol | source=src/features/gemini/usage-summary.test.ts:L14 | neighbors=[usage-summary.test.ts]
- "github_commits_test_row": "row()" | kind=code-symbol | source=src/features/github/commits.test.ts:L5 | neighbors=[commits.test.ts]
- "handover_page_handoverpage": "HandoverPage()" | kind=code-symbol | source=src/app/(app)/admin/people/[id]/handover/page.tsx:L15 | neighbors=[page.tsx]
- "history_error_capacityhistoryerror": "CapacityHistoryError()" | kind=code-symbol | source=src/app/(app)/people/history/error.tsx:L17 | neighbors=[error.tsx]
- "history_loading_loadingcapacityhistory": "LoadingCapacityHistory()" | kind=code-symbol | source=src/app/(app)/people/history/loading.tsx:L20 | neighbors=[loading.tsx]
- "history_page_historydata": "HistoryData()" | kind=code-symbol | source=src/app/(app)/people/history/page.tsx:L118 | neighbors=[page.tsx]
- "history_page_metadata": "metadata" | kind=code-symbol | source=src/app/(app)/people/history/page.tsx:L29 | neighbors=[page.tsx]
- "history_page_teamcapacityhistorypage": "TeamCapacityHistoryPage()" | kind=code-symbol | source=src/app/(app)/people/history/page.tsx:L53 | neighbors=[page.tsx]
- "holidays_page_adminholidayspage": "AdminHolidaysPage()" | kind=code-symbol | source=src/app/(app)/admin/holidays/page.tsx:L15 | neighbors=[page.tsx]
- "home_capabilities_grid_capabilities": "CAPABILITIES" | kind=code-symbol | source=src/app/(public)/home/capabilities-grid.tsx:L17 | neighbors=[capabilities-grid.tsx]
- "home_fortnight_getdeterministiclog": "getDeterministicLog()" | kind=code-symbol | source=src/app/(public)/home/fortnight.tsx:L77 | neighbors=[fortnight.tsx]
- "home_fortnight_samplelog": "SampleLog" | kind=code-symbol | source=src/app/(public)/home/fortnight.tsx:L40 | neighbors=[fortnight.tsx]
- "home_fortnight_saturday_tasks_pool": "SATURDAY_TASKS_POOL" | kind=code-symbol | source=src/app/(public)/home/fortnight.tsx:L70 | neighbors=[fortnight.tsx]
- "home_fortnight_studio_tasks_pool": "STUDIO_TASKS_POOL" | kind=code-symbol | source=src/app/(public)/home/fortnight.tsx:L47 | neighbors=[fortnight.tsx]
- "home_fortnight_viewmode": "ViewMode" | kind=code-symbol | source=src/app/(public)/home/fortnight.tsx:L38 | neighbors=[fortnight.tsx]
- "home_fortnight_weekdays": "WEEKDAYS" | kind=code-symbol | source=src/app/(public)/home/fortnight.tsx:L109 | neighbors=[fortnight.tsx]
- "home_hero_showcase_activity_rows": "ACTIVITY_ROWS" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L411 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_briefing_compile": "BRIEFING_COMPILE" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L388 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_briefing_stats": "BRIEFING_STATS" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L334 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_briefingdetailrow": "BriefingDetailRow" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L316 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_briefingstat": "BriefingStat" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L323 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_columnid": "ColumnId" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L34 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_detailtone": "DetailTone" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L314 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_engineercapacity": "EngineerCapacity" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L44 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_geminimodels": "geminiModels()" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L189 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_initial_people": "INITIAL_PEOPLE" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L223 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_initial_tasks": "INITIAL_TASKS" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L307 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_kanbantask": "KanbanTask" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L36 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_meetingintelitem": "MeetingIntelItem" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L53 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_meetings_data": "MEETINGS_DATA" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L268 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_model_specs": "MODEL_SPECS" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L120 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_resolvespec": "resolveSpec()" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L199 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_roadmap_lanes": "ROADMAP_LANES" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L405 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_tabkey": "TabKey" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L33 | neighbors=[hero-showcase.tsx]
- "home_hero_showcase_tabs": "TABS" | kind=code-symbol | source=src/app/(public)/home/hero-showcase.tsx:L213 | neighbors=[hero-showcase.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-138.json

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
