# Node Description Batch 59 of 166

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

- "apps_app_health_test_entry": "entry()" | kind=code-symbol | source=src/features/apps/app-health.test.ts:L290 | neighbors=[app-health.test.ts, sprint(), tasks()]
- "apps_app_health_test_healthinput": "healthInput()" | kind=code-symbol | source=src/features/apps/app-health.test.ts:L37 | neighbors=[app-health.test.ts, sprint(), tasks()]
- "apps_app_health_test_sprint": "sprint()" | kind=code-symbol | source=src/features/apps/app-health.test.ts:L26 | neighbors=[app-health.test.ts, entry(), healthInput()]
- "apps_app_health_test_tasks": "tasks()" | kind=code-symbol | source=src/features/apps/app-health.test.ts:L21 | neighbors=[app-health.test.ts, entry(), healthInput()]
- "apps_browse_default_browse_params": "DEFAULT_BROWSE_PARAMS" | kind=code-symbol | source=src/features/apps/browse.ts:L93 | neighbors=[browse.ts, browse.test.ts, apps-browser.tsx]
- "apps_browse_filterapps": "filterApps()" | kind=code-symbol | source=src/features/apps/browse.ts:L223 | neighbors=[browse.ts, browse.test.ts, apps-browser.tsx]
- "apps_browse_isdefaultbrowse": "isDefaultBrowse()" | kind=code-symbol | source=src/features/apps/browse.ts:L125 | neighbors=[browse.ts, browse.test.ts, apps-browser.tsx]
- "apps_browse_sortapps": "sortApps()" | kind=code-symbol | source=src/features/apps/browse.ts:L262 | neighbors=[browse.ts, browse.test.ts, apps-browser.tsx]
- "apps_browse_statuscounts": "statusCounts()" | kind=code-symbol | source=src/features/apps/browse.ts:L294 | neighbors=[browse.ts, browse.test.ts, apps-browser.tsx]
- "apps_browse_tagfacets": "tagFacets()" | kind=code-symbol | source=src/features/apps/browse.ts:L315 | neighbors=[browse.ts, browse.test.ts, apps-browser.tsx]
- "apps_browse_test_app": "app()" | kind=code-symbol | source=src/features/apps/browse.test.ts:L27 | neighbors=[browse.test.ts, health(), tasks()]
- "apps_contribution_queries_test": "contribution-queries.test.ts" | kind=code-symbol | source=src/features/apps/contribution-queries.test.ts:L1 | neighbors=[contribution-queries.ts, rankContributors(), person()]
- "apps_create_input_appcreateinput": "appCreateInput" | kind=code-symbol | source=src/features/apps/create-input.ts:L10 | neighbors=[actions.ts, create-input.ts, create-input.test.ts]
- "apps_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/apps/error.tsx:L1 | neighbors=[AppsError(), button.tsx, Button()]
- "apps_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/apps/loading.tsx:L1 | neighbors=[AppsLoading(), Shimmer(), 007c37f .]
- "apps_mine_ismine": "isMine()" | kind=code-symbol | source=src/features/apps/mine.ts:L39 | neighbors=[mine.ts, mine.test.ts, apps-browser.tsx]
- "apps_mine_mine_label": "MINE_LABEL" | kind=code-symbol | source=src/features/apps/mine.ts:L44 | neighbors=[mine.ts, mine.test.ts, app-card.tsx]
- "apps_mine_minekind": "MineKind" | kind=code-symbol | source=src/features/apps/mine.ts:L17 | neighbors=[mine.ts, mine.test.ts, app-card.tsx]
- "apps_queries_listdistincttechtags": "listDistinctTechTags()" | kind=code-symbol | source=src/features/apps/queries.ts:L479 | neighbors=[page.tsx, queries.ts, page.tsx]
- "apps_repo_metadata_fetchreadme": "fetchReadme()" | kind=code-symbol | source=src/features/apps/repo-metadata.ts:L140 | neighbors=[repo-metadata.ts, githubHeaders(), fetchRepoContext()]
- "apps_repo_metadata_githubheaders": "githubHeaders()" | kind=code-symbol | source=src/features/apps/repo-metadata.ts:L71 | neighbors=[repo-metadata.ts, fetchReadme(), fetchRepoContext()]
- "apps_repo_metadata_parsegithubrepo": "parseGitHubRepo()" | kind=code-symbol | source=src/features/apps/repo-metadata.ts:L52 | neighbors=[actions.ts, repo-metadata.ts, fetchRepoContext()]
- "apps_role_history_buildapproleentry": "buildAppRoleEntry()" | kind=code-symbol | source=src/features/apps/role-history.ts:L108 | neighbors=[actions.ts, role-history.ts, role-history.test.ts]
- "apps_role_history_isbackfilled": "isBackfilled()" | kind=code-symbol | source=src/features/apps/role-history.ts:L33 | neighbors=[role-history.ts, role-history.test.ts, planner-actions.ts]
- "apps_tabs_app_tab_ids": "APP_TAB_IDS" | kind=code-symbol | source=src/features/apps/tabs.ts:L22 | neighbors=[tabs.ts, tabs.test.ts, page.tsx]
- "apps_tabs_normalizeapptab": "normalizeAppTab()" | kind=code-symbol | source=src/features/apps/tabs.ts:L71 | neighbors=[tabs.ts, tabs.test.ts, page.tsx]
- "apps_update_input_buildappupdate": "buildAppUpdate()" | kind=code-symbol | source=src/features/apps/update-input.ts:L34 | neighbors=[actions.ts, update-input.ts, update-input.test.ts]
- "apps_update_input_summarizeappchanges": "summarizeAppChanges()" | kind=code-symbol | source=src/features/apps/update-input.ts:L98 | neighbors=[actions.ts, update-input.ts, update-input.test.ts]
- "auth_avatar_actions_deleteuploadedavatar": "deleteUploadedAvatar()" | kind=code-symbol | source=src/features/auth/avatar-actions.ts:L26 | neighbors=[avatar-actions.ts, removeOwnAvatar(), uploadOwnAvatar()]
- "auth_avatar_actions_removeownavatar": "removeOwnAvatar()" | kind=code-symbol | source=src/features/auth/avatar-actions.ts:L86 | neighbors=[avatar-actions.ts, deleteUploadedAvatar(), avatar-upload.tsx]
- "auth_avatar_actions_uploadownavatar": "uploadOwnAvatar()" | kind=code-symbol | source=src/features/auth/avatar-actions.ts:L36 | neighbors=[avatar-actions.ts, deleteUploadedAvatar(), avatar-upload.tsx]
- "auth_capabilities_grantlevel": "GrantLevel" | kind=code-symbol | source=src/features/auth/capabilities.ts:L30 | neighbors=[capabilities.ts, zones.ts, search-providers.ts]
- "auth_capabilities_has": "has()" | kind=code-symbol | source=src/features/auth/capabilities.ts:L299 | neighbors=[capabilities.ts, can(), capFor()]
- "auth_capabilities_resource": "Resource" | kind=code-symbol | source=src/features/auth/capabilities.ts:L58 | neighbors=[actor.ts, capabilities.ts, notify-rules.ts]
- "auth_capabilities_role_labels": "ROLE_LABELS" | kind=code-symbol | source=src/features/auth/capabilities.ts:L453 | neighbors=[capabilities.ts, seat-select.tsx, user-table.tsx]
- "auth_queries_getownavatarurl": "getOwnAvatarUrl()" | kind=code-symbol | source=src/features/auth/queries.ts:L28 | neighbors=[queries.ts, page.tsx, page.tsx]
- "auth_queries_getownphone": "getOwnPhone()" | kind=code-symbol | source=src/features/auth/queries.ts:L9 | neighbors=[queries.ts, page.tsx, page.tsx]
- "auth_title_schema_jobroleinput": "jobRoleInput" | kind=code-symbol | source=src/features/auth/title-schema.ts:L11 | neighbors=[actions.ts, title-schema.ts, title-schema.test.ts]
- "auth_title_schema_test": "title-schema.test.ts" | kind=code-symbol | source=src/features/auth/title-schema.test.ts:L1 | neighbors=[title-schema.ts, jobRoleInput, job-roles.ts]
- "auth_webauthn_actions_listpasskeys": "listPasskeys()" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L286 | neighbors=[webauthn-actions.ts, passkeys-card.tsx, page.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-058.json

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
