# Node Description Batch 76 of 166

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

- "people_removal_queries_openremovals": "openRemovals()" | kind=code-symbol | source=src/features/people/removal-queries.ts:L89 | neighbors=[queries.ts, removal-queries.ts, toRemovalMap()]
- "people_summary_buildpersonsummaryprompt": "buildPersonSummaryPrompt()" | kind=code-symbol | source=src/features/people/summary.ts:L132 | neighbors=[summary.ts, summary-actions.ts, summary.test.ts]
- "people_summary_factsfrompersonviews": "factsFromPersonViews()" | kind=code-symbol | source=src/features/people/summary.ts:L48 | neighbors=[page.tsx, summary.ts, summary-actions.ts]
- "people_summary_personsummary": "PersonSummary" | kind=code-symbol | source=src/features/people/summary.ts:L33 | neighbors=[person-summary-card.tsx, summary.ts, summary-actions.ts]
- "people_summary_personsummaryfacts": "PersonSummaryFacts" | kind=code-symbol | source=src/features/people/summary.ts:L15 | neighbors=[summary.ts, summary-actions.ts, summary.test.ts]
- "people_team_csv_team_csv_headers": "TEAM_CSV_HEADERS" | kind=code-symbol | source=src/features/people/team-csv.ts:L59 | neighbors=[team-panel.tsx, team-csv.ts, team-csv.test.ts]
- "people_team_csv_teamcsvprefix": "teamCsvPrefix()" | kind=code-symbol | source=src/features/people/team-csv.ts:L118 | neighbors=[team-panel.tsx, team-csv.ts, team-csv.test.ts]
- "people_team_csv_teamcsvrows": "teamCsvRows()" | kind=code-symbol | source=src/features/people/team-csv.ts:L101 | neighbors=[team-panel.tsx, team-csv.ts, team-csv.test.ts]
- "profile_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/profile/error.tsx:L1 | neighbors=[ProfileError(), button.tsx, Button()]
- "progress_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/progress/error.tsx:L1 | neighbors=[ProgressError(), button.tsx, Button()]
- "public_prose_legal_prose": "LEGAL_PROSE" | kind=code-symbol | source=src/app/(public)/prose.ts:L10 | neighbors=[page.tsx, prose.ts, page.tsx]
- "public_sw": "sw.js" | kind=code-symbol | source=public/sw.js:L1 | neighbors=[isCacheableAsset(), isStorable(), offlineDocument()]
- "public_table_of_contents_tableofcontents": "TableOfContents()" | kind=code-symbol | source=src/app/(public)/table-of-contents.tsx:L12 | neighbors=[page.tsx, table-of-contents.tsx, page.tsx]
- "pwa_icon_route": "route.tsx" | kind=code-symbol | source=src/app/pwa-icon/route.tsx:L1 | neighbors=[brand.ts, pawSvg(), GET()]
- "pwa_sw_test": "sw.test.ts" | kind=code-symbol | source=src/features/pwa/sw.test.ts:L1 | neighbors=[{ isCacheableAsset, isStorable, CACHE }, loadServiceWorker(), url()]
- "registry_types_commandapi": "CommandApi" | kind=code-symbol | source=src/features/search/registry/types.ts:L67 | neighbors=[command-center.tsx, commands.ts, types.ts]
- "registry_types_paletterecent": "PaletteRecent" | kind=code-symbol | source=src/features/search/registry/types.ts:L56 | neighbors=[command-center.tsx, kinds.ts, types.ts]
- "roles_member_memberscorecard": "MemberScorecard" | kind=code-symbol | source=src/features/signals/roles/member.ts:L44 | neighbors=[member.ts, roles.test.ts, queries.ts]
- "scripts_check_migrations": "check-migrations.mjs" | kind=code-symbol | source=scripts/check-migrations.mjs:L1 | neighbors=[expectedTables(), main(), root]
- "search_actions_assignableusers": "assignableUsers()" | kind=code-symbol | source=src/features/search/actions.ts:L76 | neighbors=[actions.ts, previewTaskIntent(), quickAssignTask()]
- "search_actions_likepattern": "likePattern()" | kind=code-symbol | source=src/features/search/actions.ts:L68 | neighbors=[actions.ts, previewTaskIntent(), quickAssignTask()]
- "settings_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/settings/error.tsx:L1 | neighbors=[SettingsError(), button.tsx, Button()]
- "settings_overview_describeaistatus": "describeAiStatus()" | kind=code-symbol | source=src/features/settings/overview.ts:L38 | neighbors=[overview.ts, overview.test.ts, page.tsx]
- "settings_overview_findrelease": "findRelease()" | kind=code-symbol | source=src/features/settings/overview.ts:L20 | neighbors=[overview.ts, overview.test.ts, page.tsx]
- "shared_job_role_select_jobroleselect": "JobRoleSelect()" | kind=code-symbol | source=src/components/shared/job-role-select.tsx:L29 | neighbors=[add-user-dialog.tsx, user-table.tsx, job-role-select.tsx]
- "shared_lazy_disclosure_lazydisclosure": "LazyDisclosure()" | kind=code-symbol | source=src/components/shared/lazy-disclosure.tsx:L21 | neighbors=[page.tsx, lazy-disclosure.tsx, page.tsx]
- "shell_account_menu_accountmenu": "AccountMenu()" | kind=code-symbol | source=src/components/shell/account-menu.tsx:L34 | neighbors=[layout.tsx, account-menu.tsx, header.tsx]
- "shell_nav_items_activitynavitem": "activityNavItem" | kind=code-symbol | source=src/components/shell/nav-items.ts:L67 | neighbors=[command-center.tsx, commands.ts, nav-items.ts]
- "shell_nav_items_admin_section_icons": "ADMIN_SECTION_ICONS" | kind=code-symbol | source=src/components/shell/nav-items.ts:L120 | neighbors=[page.tsx, nav-items.ts, sidebar.tsx]
- "shell_sidebar_model_resolvesidebarstate": "resolveSidebarState()" | kind=code-symbol | source=src/components/shell/sidebar-model.ts:L61 | neighbors=[sidebar-model.ts, sidebar-model.test.ts, sidebar-store.ts]
- "shell_sidebar_model_sidebarcommandlabel": "sidebarCommandLabel()" | kind=code-symbol | source=src/components/shell/sidebar-model.ts:L83 | neighbors=[commands.ts, sidebar-model.ts, sidebar-model.test.ts]
- "shell_sidebar_model_sidebartogglelabel": "sidebarToggleLabel()" | kind=code-symbol | source=src/components/shell/sidebar-model.ts:L78 | neighbors=[sidebar.tsx, sidebar-model.ts, sidebar-model.test.ts]
- "shell_sidebar_store_getsnapshot": "getSnapshot()" | kind=code-symbol | source=src/components/shell/sidebar-store.ts:L78 | neighbors=[sidebar-store.ts, readStored(), toggleSidebar()]
- "shell_sidebar_store_setsidebarstate": "setSidebarState()" | kind=code-symbol | source=src/components/shell/sidebar-store.ts:L96 | neighbors=[command-center.tsx, sidebar-store.ts, toggleSidebar()]
- "shell_sidebar_store_usesidebarstate": "useSidebarState()" | kind=code-symbol | source=src/components/shell/sidebar-store.ts:L87 | neighbors=[command-center.tsx, sidebar.tsx, sidebar-store.ts]
- "shell_theme_provider_accents": "ACCENTS" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L31 | neighbors=[appearance-card.tsx, commands.ts, theme-provider.tsx]
- "signals_corroborate_corroboraterange": "corroborateRange()" | kind=code-symbol | source=src/features/signals/corroborate.ts:L147 | neighbors=[corroborate.ts, corroborate.test.ts, queries.ts]
- "signals_corroborate_dayinput": "DayInput" | kind=code-symbol | source=src/features/signals/corroborate.ts:L40 | neighbors=[corroborate.ts, corroborate.test.ts, queries.ts]
- "signals_corroborate_findquietruns": "findQuietRuns()" | kind=code-symbol | source=src/features/signals/corroborate.ts:L188 | neighbors=[corroborate.ts, corroborate.test.ts, queries.ts]
- "signals_corroborate_findunclaimeddays": "findUnclaimedDays()" | kind=code-symbol | source=src/features/signals/corroborate.ts:L249 | neighbors=[corroborate.ts, corroborate.test.ts, queries.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-075.json

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
