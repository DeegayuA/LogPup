# Node Description Batch 157 of 166

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

- "roles_member_membercompletion": "MemberCompletion" | kind=code-symbol | source=src/features/signals/roles/member.ts:L21 | neighbors=[member.ts]
- "roles_pm_committedtask": "CommittedTask" | kind=code-symbol | source=src/features/signals/roles/pm.ts:L23 | neighbors=[pm.ts]
- "roles_pm_isoof": "isoOf()" | kind=code-symbol | source=src/features/signals/roles/pm.ts:L239 | neighbors=[pm.ts]
- "roles_pm_pmblockedtask": "PmBlockedTask" | kind=code-symbol | source=src/features/signals/roles/pm.ts:L45 | neighbors=[pm.ts]
- "roles_pm_pmcheckin": "PmCheckin" | kind=code-symbol | source=src/features/signals/roles/pm.ts:L39 | neighbors=[pm.ts]
- "roles_pm_pmfollowup": "PmFollowup" | kind=code-symbol | source=src/features/signals/roles/pm.ts:L32 | neighbors=[pm.ts]
- "roles_roles_test_architectinput": "architectInput()" | kind=code-symbol | source=src/features/signals/roles/roles.test.ts:L42 | neighbors=[roles.test.ts]
- "roles_roles_test_as_of": "AS_OF" | kind=code-symbol | source=src/features/signals/roles/roles.test.ts:L10 | neighbors=[roles.test.ts]
- "roles_roles_test_find": "find()" | kind=code-symbol | source=src/features/signals/roles/roles.test.ts:L12 | neighbors=[roles.test.ts]
- "roles_roles_test_leadinput": "leadInput()" | kind=code-symbol | source=src/features/signals/roles/roles.test.ts:L30 | neighbors=[roles.test.ts]
- "roles_roles_test_memberinput": "memberInput()" | kind=code-symbol | source=src/features/signals/roles/roles.test.ts:L55 | neighbors=[roles.test.ts]
- "roles_roles_test_pminput": "pmInput()" | kind=code-symbol | source=src/features/signals/roles/roles.test.ts:L18 | neighbors=[roles.test.ts]
- "roles_roles_test_window": "WINDOW" | kind=code-symbol | source=src/features/signals/roles/roles.test.ts:L9 | neighbors=[roles.test.ts]
- "scripts_check_migrations_root": "root" | kind=code-symbol | source=scripts/check-migrations.mjs:L22 | neighbors=[check-migrations.mjs]
- "scripts_check_schema_drift_drift": "Drift" | kind=code-symbol | source=scripts/check-schema-drift.ts:L31 | neighbors=[check-schema-drift.ts]
- "scripts_generate_changelog_data": "data" | kind=code-symbol | source=scripts/generate-changelog.mjs:L63 | neighbors=[generate-changelog.mjs]
- "scripts_generate_changelog_kinds": "KINDS" | kind=code-symbol | source=scripts/generate-changelog.mjs:L39 | neighbors=[generate-changelog.mjs]
- "scripts_generate_changelog_out": "out" | kind=code-symbol | source=scripts/generate-changelog.mjs:L21 | neighbors=[generate-changelog.mjs]
- "scripts_generate_changelog_root": "root" | kind=code-symbol | source=scripts/generate-changelog.mjs:L20 | neighbors=[generate-changelog.mjs]
- "scripts_generate_changelog_splitsubject": "splitSubject()" | kind=code-symbol | source=scripts/generate-changelog.mjs:L41 | neighbors=[generate-changelog.mjs]
- "scripts_generate_changelog_versions": "versions" | kind=code-symbol | source=scripts/generate-changelog.mjs:L47 | neighbors=[generate-changelog.mjs]
- "scripts_verify_head_dir": "dir" | kind=code-symbol | source=scripts/verify-head.mjs:L46 | neighbors=[verify-head.mjs]
- "scripts_verify_head_repo": "repo" | kind=code-symbol | source=scripts/verify-head.mjs:L32 | neighbors=[verify-head.mjs]
- "scripts_verify_head_sha": "sha" | kind=code-symbol | source=scripts/verify-head.mjs:L33 | neighbors=[verify-head.mjs]
- "search_actions_quickassigndata": "QuickAssignData" | kind=code-symbol | source=src/features/search/actions.ts:L53 | neighbors=[actions.ts]
- "search_actions_quickassigntitle": "quickAssignTitle" | kind=code-symbol | source=src/features/search/actions.ts:L61 | neighbors=[actions.ts]
- "search_actions_signoutfrompalette": "signOutFromPalette()" | kind=code-symbol | source=src/features/search/actions.ts:L49 | neighbors=[actions.ts]
- "settings_commands_accentlabel": "accentLabel()" | kind=code-symbol | source=src/features/settings/commands.ts:L27 | neighbors=[commands.ts]
- "settings_commands_themes": "THEMES" | kind=code-symbol | source=src/features/settings/commands.ts:L16 | neighbors=[commands.ts]
- "settings_error_settingserror": "SettingsError()" | kind=code-symbol | source=src/app/(app)/settings/error.tsx:L19 | neighbors=[error.tsx]
- "settings_loading_settingsloading": "SettingsLoading()" | kind=code-symbol | source=src/app/(app)/settings/loading.tsx:L13 | neighbors=[loading.tsx]
- "settings_overview_aistatus": "AiStatus" | kind=code-symbol | source=src/features/settings/overview.ts:L33 | neighbors=[overview.ts]
- "settings_overview_test_history": "history" | kind=code-symbol | source=src/features/settings/overview.test.ts:L6 | neighbors=[overview.test.ts]
- "settings_page_aifeaturescardskeleton": "AiFeaturesCardSkeleton()" | kind=code-symbol | source=src/app/(app)/settings/page.tsx:L371 | neighbors=[page.tsx]
- "settings_page_metadata": "metadata" | kind=code-symbol | source=src/app/(app)/settings/page.tsx:L36 | neighbors=[page.tsx]
- "shared_holiday_icon_holiday_icon_meta": "HOLIDAY_ICON_META" | kind=code-symbol | source=src/components/shared/holiday-icon.tsx:L14 | neighbors=[holiday-icon.tsx]
- "shared_holiday_icon_holiday_icon_order": "HOLIDAY_ICON_ORDER" | kind=code-symbol | source=src/components/shared/holiday-icon.tsx:L35 | neighbors=[holiday-icon.tsx]
- "shared_holiday_icon_holidayicon": "HolidayIcon()" | kind=code-symbol | source=src/components/shared/holiday-icon.tsx:L62 | neighbors=[holiday-icon.tsx]
- "shell_shortcuts_overlay_shortcutrow": "ShortcutRow()" | kind=code-symbol | source=src/components/shell/shortcuts-overlay.tsx:L27 | neighbors=[shortcuts-overlay.tsx]
- "shell_sidebar_commandhint": "CommandHint()" | kind=code-symbol | source=src/components/shell/sidebar.tsx:L153 | neighbors=[sidebar.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-156.json

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
