# Node Description Batch 117 of 166

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

- "app_layout_cabinet": "cabinet" | kind=code-symbol | source=src/app/layout.tsx:L26 | neighbors=[layout.tsx]
- "app_layout_geistmono": "geistMono" | kind=code-symbol | source=src/app/layout.tsx:L53 | neighbors=[layout.tsx]
- "app_layout_metadata": "metadata" | kind=code-symbol | source=src/app/layout.tsx:L58 | neighbors=[layout.tsx]
- "app_layout_notosinhala": "notoSinhala" | kind=code-symbol | source=src/app/layout.tsx:L42 | neighbors=[layout.tsx]
- "app_layout_rootlayout": "RootLayout()" | kind=code-symbol | source=src/app/layout.tsx:L72 | neighbors=[layout.tsx]
- "app_layout_satoshi": "satoshi" | kind=code-symbol | source=src/app/layout.tsx:L15 | neighbors=[layout.tsx]
- "app_layout_viewport": "viewport" | kind=code-symbol | source=src/app/layout.tsx:L65 | neighbors=[layout.tsx]
- "app_loading_dashboardloading": "DashboardLoading()" | kind=code-symbol | source=src/app/(app)/loading.tsx:L29 | neighbors=[loading.tsx]
- "app_manifest_manifest": "manifest()" | kind=code-symbol | source=src/app/manifest.ts:L4 | neighbors=[manifest.ts]
- "app_robots": "robots.ts" | kind=code-symbol | source=src/app/robots.ts:L1 | neighbors=[robots()]
- "app_robots_robots": "robots()" | kind=code-symbol | source=src/app/robots.ts:L14 | neighbors=[robots.ts]
- "approvals_page_adminapprovalspage": "AdminApprovalsPage()" | kind=code-symbol | source=src/app/(app)/admin/approvals/page.tsx:L21 | neighbors=[page.tsx]
- "apps_actions_generatedapp": "GeneratedApp" | kind=code-symbol | source=src/features/apps/actions.ts:L67 | neighbors=[actions.ts]
- "apps_actions_generateoutcome": "GenerateOutcome" | kind=code-symbol | source=src/features/apps/actions.ts:L79 | neighbors=[actions.ts]
- "apps_activity_activitydaygroup": "ActivityDayGroup" | kind=code-symbol | source=src/features/apps/activity.ts:L54 | neighbors=[activity.ts]
- "apps_activity_queries_firstline": "firstLine()" | kind=code-symbol | source=src/features/apps/activity-queries.ts:L26 | neighbors=[activity-queries.ts]
- "apps_activity_test_item": "item()" | kind=code-symbol | source=src/features/apps/activity.test.ts:L10 | neighbors=[activity.test.ts]
- "apps_app_aliases_appmatch": "AppMatch" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L45 | neighbors=[app-aliases.ts]
- "apps_app_aliases_appmatchhow": "AppMatchHow" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L43 | neighbors=[app-aliases.ts]
- "apps_app_aliases_noise": "NOISE" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L56 | neighbors=[app-aliases.ts]
- "apps_app_aliases_test_apps": "APPS" | kind=code-symbol | source=src/features/apps/app-aliases.test.ts:L13 | neighbors=[app-aliases.test.ts]
- "apps_app_aliases_test_id": "id()" | kind=code-symbol | source=src/features/apps/app-aliases.test.ts:L22 | neighbors=[app-aliases.test.ts]
- "apps_app_aliases_withineditdistance": "withinEditDistance()" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L245 | neighbors=[app-aliases.ts]
- "apps_app_health_sprintphase": "SprintPhase" | kind=code-symbol | source=src/features/apps/app-health.ts:L52 | neighbors=[app-health.ts]
- "apps_browse_activityms": "activityMs()" | kind=code-symbol | source=src/features/apps/browse.ts:L248 | neighbors=[browse.ts]
- "apps_browse_app_risk_filters": "APP_RISK_FILTERS" | kind=code-symbol | source=src/features/apps/browse.ts:L59 | neighbors=[browse.ts]
- "apps_browse_appriskfilter": "AppRiskFilter" | kind=code-symbol | source=src/features/apps/browse.ts:L60 | neighbors=[browse.ts]
- "apps_browse_appsort": "AppSort" | kind=code-symbol | source=src/features/apps/browse.ts:L24 | neighbors=[browse.ts]
- "apps_browse_appstatusfilter": "AppStatusFilter" | kind=code-symbol | source=src/features/apps/browse.ts:L41 | neighbors=[browse.ts]
- "apps_browse_tagmatches": "tagMatches()" | kind=code-symbol | source=src/features/apps/browse.ts:L207 | neighbors=[browse.ts]
- "apps_comment_actions_commentinput": "commentInput" | kind=code-symbol | source=src/features/apps/comment-actions.ts:L30 | neighbors=[comment-actions.ts]
- "apps_contribution_queries_test_person": "person()" | kind=code-symbol | source=src/features/apps/contribution-queries.test.ts:L4 | neighbors=[contribution-queries.test.ts]
- "apps_error_appserror": "AppsError()" | kind=code-symbol | source=src/app/(app)/apps/error.tsx:L18 | neighbors=[error.tsx]
- "apps_loading_appsloading": "AppsLoading()" | kind=code-symbol | source=src/app/(app)/apps/loading.tsx:L26 | neighbors=[loading.tsx]
- "apps_loading_shimmer": "Shimmer()" | kind=code-symbol | source=src/app/(app)/apps/loading.tsx:L1 | neighbors=[loading.tsx]
- "apps_mine_test_app": "app()" | kind=code-symbol | source=src/features/apps/mine.test.ts:L8 | neighbors=[mine.test.ts]
- "apps_page_adminappspage": "AdminAppsPage()" | kind=code-symbol | source=src/app/(app)/admin/apps/page.tsx:L9 | neighbors=[page.tsx]
- "apps_page_appspage": "AppsPage()" | kind=code-symbol | source=src/app/(app)/apps/page.tsx:L18 | neighbors=[page.tsx]
- "apps_page_metadata": "metadata" | kind=code-symbol | source=src/app/(app)/apps/page.tsx:L16 | neighbors=[page.tsx]
- "apps_queries_appcounts": "AppCounts" | kind=code-symbol | source=src/features/apps/queries.ts:L386 | neighbors=[queries.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-116.json

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
