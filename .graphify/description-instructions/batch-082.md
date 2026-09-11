# Node Description Batch 83 of 166

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

- "apps_browse_sort_label": "SORT_LABEL" | kind=code-symbol | source=src/features/apps/browse.ts:L26 | neighbors=[browse.ts, apps-browser.tsx]
- "apps_browse_status_filter_label": "STATUS_FILTER_LABEL" | kind=code-symbol | source=src/features/apps/browse.ts:L43 | neighbors=[browse.ts, apps-browser.tsx]
- "apps_browse_statusmatches": "statusMatches()" | kind=code-symbol | source=src/features/apps/browse.ts:L180 | neighbors=[browse.ts, browse.test.ts]
- "apps_browse_test_health": "health()" | kind=code-symbol | source=src/features/apps/browse.test.ts:L23 | neighbors=[browse.test.ts, app()]
- "apps_browse_test_tasks": "tasks()" | kind=code-symbol | source=src/features/apps/browse.test.ts:L18 | neighbors=[browse.test.ts, app()]
- "apps_commands_commands": "commands" | kind=code-symbol | source=src/features/apps/commands.ts:L13 | neighbors=[commands.ts, commands.ts]
- "apps_comment_actions_postappcomment": "postAppComment()" | kind=code-symbol | source=src/features/apps/comment-actions.ts:L35 | neighbors=[comment-actions.ts, app-comments.tsx]
- "apps_comment_queries_appcomment": "AppComment" | kind=code-symbol | source=src/features/apps/comment-queries.ts:L5 | neighbors=[comment-queries.ts, app-comments.tsx]
- "apps_comment_queries_listappcomments": "listAppComments()" | kind=code-symbol | source=src/features/apps/comment-queries.ts:L14 | neighbors=[comment-queries.ts, page.tsx]
- "apps_contribution_queries_appcontribution": "AppContribution" | kind=code-symbol | source=src/features/apps/contribution-queries.ts:L9 | neighbors=[contribution-queries.ts, app-contributions.tsx]
- "apps_contribution_queries_getappcontributions": "getAppContributions" | kind=code-symbol | source=src/features/apps/contribution-queries.ts:L50 | neighbors=[contribution-queries.ts, page.tsx]
- "apps_contribution_queries_rankcontributors": "rankContributors()" | kind=code-symbol | source=src/features/apps/contribution-queries.ts:L120 | neighbors=[contribution-queries.ts, contribution-queries.test.ts]
- "apps_create_input_test": "create-input.test.ts" | kind=code-symbol | source=src/features/apps/create-input.test.ts:L1 | neighbors=[create-input.ts, appCreateInput]
- "apps_mine_membershiprow": "MembershipRow" | kind=code-symbol | source=src/features/apps/mine.ts:L19 | neighbors=[mine.ts, mine.test.ts]
- "apps_project_manager_managedappidsfor": "managedAppIdsFor()" | kind=code-symbol | source=src/features/apps/project-manager.ts:L77 | neighbors=[project-manager.ts, page.tsx]
- "apps_project_manager_managesapp": "managesApp()" | kind=code-symbol | source=src/features/apps/project-manager.ts:L28 | neighbors=[actions.ts, project-manager.ts]
- "apps_queries_appmember": "AppMember" | kind=code-symbol | source=src/features/apps/queries.ts:L20 | neighbors=[queries.ts, progress-queries.ts]
- "apps_queries_approlehistoryentry": "AppRoleHistoryEntry" | kind=code-symbol | source=src/features/apps/queries.ts:L342 | neighbors=[queries.ts, app-role-history-card.tsx]
- "apps_queries_appwithmembers": "AppWithMembers" | kind=code-symbol | source=src/features/apps/queries.ts:L64 | neighbors=[queries.ts, apps-table.tsx]
- "apps_queries_countwhere": "countWhere()" | kind=code-symbol | source=src/features/apps/queries.ts:L78 | neighbors=[queries.ts, getAppCounts()]
- "apps_queries_emptytaskcounts": "emptyTaskCounts()" | kind=code-symbol | source=src/features/apps/queries.ts:L82 | neighbors=[queries.ts, getAppCounts()]
- "apps_queries_getappbyslug": "getAppBySlug()" | kind=code-symbol | source=src/features/apps/queries.ts:L324 | neighbors=[queries.ts, page.tsx]
- "apps_queries_getapprolehistory": "getAppRoleHistory()" | kind=code-symbol | source=src/features/apps/queries.ts:L364 | neighbors=[queries.ts, page.tsx]
- "apps_queries_latest": "latest()" | kind=code-symbol | source=src/features/apps/queries.ts:L91 | neighbors=[queries.ts, getAppCounts()]
- "apps_role_history_approleasof": "appRoleAsOf()" | kind=code-symbol | source=src/features/apps/role-history.ts:L51 | neighbors=[role-history.ts, role-history.test.ts]
- "apps_role_history_approleinterval": "AppRoleInterval" | kind=code-symbol | source=src/features/apps/role-history.ts:L15 | neighbors=[role-history.ts, role-history.test.ts]
- "apps_search_providers_searchproviders": "searchProviders" | kind=code-symbol | source=src/features/apps/search-providers.ts:L33 | neighbors=[search-providers.ts, providers.ts]
- "apps_tabs_app_tab_label": "APP_TAB_LABEL" | kind=code-symbol | source=src/features/apps/tabs.ts:L34 | neighbors=[tabs.ts, app-tab-nav.tsx]
- "apps_update_input_appbeforestate": "AppBeforeState" | kind=code-symbol | source=src/features/apps/update-input.ts:L55 | neighbors=[update-input.ts, update-input.test.ts]
- "auth_actions_setowngithublogin": "setOwnGithubLogin()" | kind=code-symbol | source=src/features/auth/actions.ts:L92 | neighbors=[actions.ts, github-login-field.tsx]
- "auth_actions_setownphone": "setOwnPhone()" | kind=code-symbol | source=src/features/auth/actions.ts:L55 | neighbors=[actions.ts, phone-field.tsx]
- "auth_actor_test": "actor.test.ts" | kind=code-symbol | source=src/features/auth/actor.test.ts:L1 | neighbors=[capabilities.ts, scopeSourceFor()]
- "auth_capabilities_hascappablepower": "hasCappablePower()" | kind=code-symbol | source=src/features/auth/capabilities.ts:L357 | neighbors=[capabilities.ts, employment-select.tsx]
- "auth_capabilities_iscappable": "isCappable()" | kind=code-symbol | source=src/features/auth/capabilities.ts:L345 | neighbors=[actor.ts, capabilities.ts]
- "auth_capabilities_scopesource": "ScopeSource" | kind=code-symbol | source=src/features/auth/capabilities.ts:L389 | neighbors=[actor.ts, capabilities.ts]
- "auth_commands_commands": "commands" | kind=code-symbol | source=src/features/auth/commands.ts:L12 | neighbors=[commands.ts, commands.ts]
- "auth_google_one_tap_verifygoogleidtoken": "verifyGoogleIdToken()" | kind=code-symbol | source=src/features/auth/google-one-tap.ts:L50 | neighbors=[google-one-tap.ts, auth.ts]
- "auth_personal_email_schema_personalemailinput": "personalEmailInput" | kind=code-symbol | source=src/features/auth/personal-email-schema.ts:L21 | neighbors=[actions.ts, personal-email-schema.ts]
- "auth_queries_getowngithublogin": "getOwnGithubLogin()" | kind=code-symbol | source=src/features/auth/queries.ts:L20 | neighbors=[queries.ts, page.tsx]
- "auth_webauthn_actions_deletepasskey": "deletePasskey()" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L308 | neighbors=[webauthn-actions.ts, passkeys-card.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-082.json

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
