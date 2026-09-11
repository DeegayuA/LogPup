# Node Description Batch 108 of 166

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

- "people_team_csv_employmentlabel": "employmentLabel()" | kind=code-symbol | source=src/features/people/team-csv.ts:L89 | neighbors=[team-csv.ts, team-csv.test.ts]
- "people_team_csv_projectposition": "projectPosition()" | kind=code-symbol | source=src/features/people/team-csv.ts:L75 | neighbors=[team-csv.ts, team-csv.test.ts]
- "people_team_csv_teamcsvmember": "TeamCsvMember" | kind=code-symbol | source=src/features/people/team-csv.ts:L33 | neighbors=[team-csv.ts, team-csv.test.ts]
- "pwa_clear_cached_shell": "clear-cached-shell.tsx" | kind=code-symbol | source=src/features/pwa/clear-cached-shell.tsx:L1 | neighbors=[ClearCachedShell(), page.tsx]
- "pwa_clear_cached_shell_clearcachedshell": "ClearCachedShell()" | kind=code-symbol | source=src/features/pwa/clear-cached-shell.tsx:L21 | neighbors=[clear-cached-shell.tsx, page.tsx]
- "pwa_pwa_pwaregister": "PwaRegister()" | kind=code-symbol | source=src/features/pwa/pwa.tsx:L17 | neighbors=[layout.tsx, pwa.tsx]
- "pwa_pwa_useinstallprompt": "useInstallPrompt()" | kind=code-symbol | source=src/features/pwa/pwa.tsx:L46 | neighbors=[pwa.tsx, InstallButton()]
- "registry_commands_labelof": "labelOf()" | kind=code-symbol | source=src/features/search/registry/commands.ts:L77 | neighbors=[commands.ts, matches()]
- "registry_commands_matches": "matches()" | kind=code-symbol | source=src/features/search/registry/commands.ts:L90 | neighbors=[commands.ts, labelOf()]
- "registry_commands_navcommands": "navCommands()" | kind=code-symbol | source=src/features/search/registry/commands.ts:L103 | neighbors=[commands.ts, paletteCommands()]
- "registry_commands_resolvedcommand": "ResolvedCommand" | kind=code-symbol | source=src/features/search/registry/commands.ts:L60 | neighbors=[command-center.tsx, commands.ts]
- "registry_kinds_kind_meta": "KIND_META" | kind=code-symbol | source=src/features/search/registry/kinds.ts:L23 | neighbors=[command-center.tsx, kinds.ts]
- "registry_providers_all_providers": "ALL_PROVIDERS" | kind=code-symbol | source=src/features/search/registry/providers.ts:L23 | neighbors=[providers.ts, registry.test.ts]
- "registry_providers_runproviders": "runProviders()" | kind=code-symbol | source=src/features/search/registry/providers.ts:L42 | neighbors=[providers.ts, actions.ts]
- "registry_types_searchcontext": "SearchContext" | kind=code-symbol | source=src/features/search/registry/types.ts:L22 | neighbors=[providers.ts, types.ts]
- "roles_architect_architectscorecard": "ArchitectScorecard" | kind=code-symbol | source=src/features/signals/roles/architect.ts:L55 | neighbors=[architect.ts, roles.test.ts]
- "roles_architect_architectscorecardinput": "ArchitectScorecardInput" | kind=code-symbol | source=src/features/signals/roles/architect.ts:L38 | neighbors=[architect.ts, roles.test.ts]
- "roles_lead_leadscorecard": "LeadScorecard" | kind=code-symbol | source=src/features/signals/roles/lead.ts:L51 | neighbors=[lead.ts, roles.test.ts]
- "roles_lead_leadscorecardinput": "LeadScorecardInput" | kind=code-symbol | source=src/features/signals/roles/lead.ts:L38 | neighbors=[lead.ts, roles.test.ts]
- "roles_member_memberscorecardinput": "MemberScorecardInput" | kind=code-symbol | source=src/features/signals/roles/member.ts:L23 | neighbors=[member.ts, roles.test.ts]
- "roles_pm_pmscorecard": "PmScorecard" | kind=code-symbol | source=src/features/signals/roles/pm.ts:L62 | neighbors=[pm.ts, roles.test.ts]
- "roles_pm_pmscorecardinput": "PmScorecardInput" | kind=code-symbol | source=src/features/signals/roles/pm.ts:L50 | neighbors=[pm.ts, roles.test.ts]
- "scripts_check_migrations_expectedtables": "expectedTables()" | kind=code-symbol | source=scripts/check-migrations.mjs:L32 | neighbors=[check-migrations.mjs, main()]
- "scripts_check_migrations_main": "main()" | kind=code-symbol | source=scripts/check-migrations.mjs:L43 | neighbors=[check-migrations.mjs, expectedTables()]
- "scripts_check_schema_drift_declaredtables": "declaredTables()" | kind=code-symbol | source=scripts/check-schema-drift.ts:L33 | neighbors=[check-schema-drift.ts, main()]
- "scripts_check_schema_drift_main": "main()" | kind=code-symbol | source=scripts/check-schema-drift.ts:L49 | neighbors=[check-schema-drift.ts, declaredTables()]
- "search_actions_taskintentpreview": "TaskIntentPreview" | kind=code-symbol | source=src/features/search/actions.ts:L84 | neighbors=[command-center.tsx, actions.ts]
- "search_actions_universalsearch": "universalSearch()" | kind=code-symbol | source=src/features/search/actions.ts:L26 | neighbors=[command-center.tsx, actions.ts]
- "settings_commands_commands": "commands" | kind=code-symbol | source=src/features/settings/commands.ts:L29 | neighbors=[commands.ts, commands.ts]
- "settings_page_formatbuildstamp": "formatBuildStamp()" | kind=code-symbol | source=src/app/(app)/settings/page.tsx:L64 | neighbors=[page.tsx, SettingsPage()]
- "settings_page_settingspage": "SettingsPage()" | kind=code-symbol | source=src/app/(app)/settings/page.tsx:L78 | neighbors=[page.tsx, formatBuildStamp()]
- "shared_card_quick_menu_cardquickmenu": "CardQuickMenu()" | kind=code-symbol | source=src/components/shared/card-quick-menu.tsx:L43 | neighbors=[task-card.tsx, card-quick-menu.tsx]
- "shared_card_quick_menu_quickmenuitem": "QuickMenuItem" | kind=code-symbol | source=src/components/shared/card-quick-menu.tsx:L15 | neighbors=[task-card.tsx, card-quick-menu.tsx]
- "shared_drag_surface_builddragannouncements": "buildDragAnnouncements()" | kind=code-symbol | source=src/components/shared/drag-surface.tsx:L72 | neighbors=[roadmap-timeline.tsx, drag-surface.tsx]
- "shared_drag_surface_usedragsensors": "useDragSensors()" | kind=code-symbol | source=src/components/shared/drag-surface.tsx:L27 | neighbors=[drag-surface.tsx, DragSurface()]
- "shared_help_note_helpdetail": "HelpDetail()" | kind=code-symbol | source=src/components/shared/help-note.tsx:L70 | neighbors=[help-note.tsx, page.tsx]
- "shared_holiday_icon_holidaylegend": "HolidayLegend()" | kind=code-symbol | source=src/components/shared/holiday-icon.tsx:L103 | neighbors=[meetings-views.tsx, holiday-icon.tsx]
- "shared_inline_rename_inlinerename": "InlineRename()" | kind=code-symbol | source=src/components/shared/inline-rename.tsx:L19 | neighbors=[task-card.tsx, inline-rename.tsx]
- "shell_account_menu_accountuser": "AccountUser" | kind=code-symbol | source=src/components/shell/account-menu.tsx:L15 | neighbors=[account-menu.tsx, header.tsx]
- "shell_header_header": "Header()" | kind=code-symbol | source=src/components/shell/header.tsx:L9 | neighbors=[layout.tsx, header.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-107.json

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
