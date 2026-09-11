# Node Description Batch 82 of 166

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

- "admin_change_request_appliers_astaskstatus": "asTaskStatus()" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L158 | neighbors=[change-request-appliers.ts, buildTaskStatusSet()]
- "admin_change_request_appliers_supported_entity_types": "SUPPORTED_ENTITY_TYPES" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L20 | neighbors=[change-request-appliers.ts, change-request-appliers.test.ts]
- "admin_change_request_appliers_supportedentitytype": "SupportedEntityType" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L21 | neighbors=[change-request-actions.ts, change-request-appliers.ts]
- "admin_change_request_queries_inboxrequest": "InboxRequest" | kind=code-symbol | source=src/features/admin/change-request-queries.ts:L7 | neighbors=[change-request-queries.ts, dashboard-zones.tsx]
- "admin_danger_actions_exportworkspacebackup": "exportWorkspaceBackup()" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L126 | neighbors=[danger-actions.ts, danger-backup-card.tsx]
- "admin_danger_actions_loaddangertargets": "loadDangerTargets()" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L502 | neighbors=[danger-actions.ts, page.tsx]
- "admin_danger_logic_blastradius": "BlastRadius" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L92 | neighbors=[danger-logic.ts, danger-confirm-control.tsx]
- "admin_danger_logic_purgeable_trash_kinds": "PURGEABLE_TRASH_KINDS" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L183 | neighbors=[danger-logic.ts, danger-logic.test.ts]
- "admin_danger_logic_purgeprogress": "PurgeProgress" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L238 | neighbors=[danger-actions.ts, danger-logic.ts]
- "admin_queries_adminuser": "AdminUser" | kind=code-symbol | source=src/features/admin/queries.ts:L8 | neighbors=[queries.ts, user-table.tsx]
- "admin_queries_pendinguser": "PendingUser" | kind=code-symbol | source=src/features/admin/queries.ts:L84 | neighbors=[queries.ts, pending-approvals-card.tsx]
- "admin_sections_admin_sections": "ADMIN_SECTIONS" | kind=code-symbol | source=src/features/admin/sections.ts:L20 | neighbors=[sections.ts, sections.test.ts]
- "admin_sections_adminsection": "AdminSection" | kind=code-symbol | source=src/features/admin/sections.ts:L11 | neighbors=[sections.ts, admin-nav.tsx]
- "admin_sections_test_actor": "actor()" | kind=code-symbol | source=src/features/admin/sections.test.ts:L5 | neighbors=[sections.test.ts, hrefs()]
- "admin_sections_test_hrefs": "hrefs()" | kind=code-symbol | source=src/features/admin/sections.test.ts:L6 | neighbors=[sections.test.ts, actor()]
- "admin_trash_actions_isuniqueviolation": "isUniqueViolation()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L73 | neighbors=[trash-actions.ts, restoreAssignment()]
- "admin_trash_grouping_buildapptrashrow": "buildAppTrashRow()" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L160 | neighbors=[trash-grouping.ts, trash-queries.ts]
- "admin_trash_grouping_buildbugtrashrow": "buildBugTrashRow()" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L180 | neighbors=[trash-grouping.ts, trash-queries.ts]
- "animate_ui_stat_number_usestaticnumber": "useStaticNumber()" | kind=code-symbol | source=src/components/animate-ui/stat-number.tsx:L23 | neighbors=[stat-number.tsx, StatNumber()]
- "app_manifest": "manifest.ts" | kind=code-symbol | source=src/app/manifest.ts:L1 | neighbors=[manifest(), brand.ts]
- "app_page_dashboardpage": "DashboardPage()" | kind=code-symbol | source=src/app/(app)/page.tsx:L39 | neighbors=[page.tsx, greetingFor()]
- "app_page_greetingfor": "greetingFor()" | kind=code-symbol | source=src/app/(app)/page.tsx:L19 | neighbors=[page.tsx, DashboardPage()]
- "apps_actions_closeopenapproleinterval": "closeOpenAppRoleInterval()" | kind=code-symbol | source=src/features/apps/actions.ts:L45 | neighbors=[actions.ts, updateApp()]
- "apps_activity_appactivitykind": "AppActivityKind" | kind=code-symbol | source=src/features/apps/activity.ts:L17 | neighbors=[activity.ts, app-activity.tsx]
- "apps_activity_queries_getappactivity": "getAppActivity()" | kind=code-symbol | source=src/features/apps/activity-queries.ts:L52 | neighbors=[activity-queries.ts, page.tsx]
- "apps_app_aliases_escape": "escape()" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L125 | neighbors=[app-aliases.ts, containsWord()]
- "apps_app_aliases_typobudget": "typoBudget()" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L232 | neighbors=[app-aliases.ts, matchApp()]
- "apps_app_health_apphealthinput": "AppHealthInput" | kind=code-symbol | source=src/features/apps/app-health.ts:L192 | neighbors=[app-health.ts, app-health.test.ts]
- "apps_app_health_portfoliosummary": "PortfolioSummary" | kind=code-symbol | source=src/features/apps/app-health.ts:L335 | neighbors=[app-health.ts, portfolio-summary.tsx]
- "apps_app_health_sprintprogress": "SprintProgress" | kind=code-symbol | source=src/features/apps/app-health.ts:L54 | neighbors=[app-health.ts, plan-read.ts]
- "apps_app_health_summarizableapp": "SummarizableApp" | kind=code-symbol | source=src/features/apps/app-health.ts:L324 | neighbors=[app-health.ts, app-health.test.ts]
- "apps_app_health_utcms": "utcMs()" | kind=code-symbol | source=src/features/apps/app-health.ts:L70 | neighbors=[app-health.ts, dayDiff()]
- "apps_browse_app_sorts": "APP_SORTS" | kind=code-symbol | source=src/features/apps/browse.ts:L23 | neighbors=[browse.ts, apps-browser.tsx]
- "apps_browse_app_status_filters": "APP_STATUS_FILTERS" | kind=code-symbol | source=src/features/apps/browse.ts:L40 | neighbors=[browse.ts, apps-browser.tsx]
- "apps_browse_browsableapp": "BrowsableApp" | kind=code-symbol | source=src/features/apps/browse.ts:L164 | neighbors=[browse.ts, browse.test.ts]
- "apps_browse_browseparams": "BrowseParams" | kind=code-symbol | source=src/features/apps/browse.ts:L67 | neighbors=[browse.ts, apps-browser.tsx]
- "apps_browse_firstvalue": "firstValue()" | kind=code-symbol | source=src/features/apps/browse.ts:L103 | neighbors=[browse.ts, parseBrowseParams()]
- "apps_browse_querymatches": "queryMatches()" | kind=code-symbol | source=src/features/apps/browse.ts:L192 | neighbors=[browse.ts, browse.test.ts]
- "apps_browse_risk_filter_label": "RISK_FILTER_LABEL" | kind=code-symbol | source=src/features/apps/browse.ts:L62 | neighbors=[browse.ts, apps-browser.tsx]
- "apps_browse_riskmatches": "riskMatches()" | kind=code-symbol | source=src/features/apps/browse.ts:L217 | neighbors=[browse.ts, browse.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-081.json

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
