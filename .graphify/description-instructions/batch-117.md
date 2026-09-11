# Node Description Batch 118 of 166

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

- "apps_queries_appstats": "AppStats" | kind=code-symbol | source=src/features/apps/queries.ts:L28 | neighbors=[queries.ts]
- "apps_repo_metadata_repocontext": "RepoContext" | kind=code-symbol | source=src/features/apps/repo-metadata.ts:L21 | neighbors=[repo-metadata.ts]
- "apps_repo_metadata_repofetcherror_constructor": ".constructor()" | kind=code-symbol | source=src/features/apps/repo-metadata.ts:L41 | neighbors=[RepoFetchError]
- "apps_role_history_approleentry": "AppRoleEntry" | kind=code-symbol | source=src/features/apps/role-history.ts:L92 | neighbors=[role-history.ts]
- "apps_role_history_approleentryinput": "AppRoleEntryInput" | kind=code-symbol | source=src/features/apps/role-history.ts:L83 | neighbors=[role-history.ts]
- "apps_role_history_test_feb": "FEB" | kind=code-symbol | source=src/features/apps/role-history.test.ts:L13 | neighbors=[role-history.test.ts]
- "apps_role_history_test_jan": "JAN" | kind=code-symbol | source=src/features/apps/role-history.test.ts:L12 | neighbors=[role-history.test.ts]
- "apps_role_history_test_mar": "MAR" | kind=code-symbol | source=src/features/apps/role-history.test.ts:L14 | neighbors=[role-history.test.ts]
- "apps_role_history_test_row": "Row" | kind=code-symbol | source=src/features/apps/role-history.test.ts:L16 | neighbors=[role-history.test.ts]
- "apps_tabs_legacy_tab_aliases": "LEGACY_TAB_ALIASES" | kind=code-symbol | source=src/features/apps/tabs.ts:L56 | neighbors=[tabs.ts]
- "apps_tabs_test_member": "MEMBER" | kind=code-symbol | source=src/features/apps/tabs.test.ts:L11 | neighbors=[tabs.test.ts]
- "apps_update_input_appchangenames": "AppChangeNames" | kind=code-symbol | source=src/features/apps/update-input.ts:L61 | neighbors=[update-input.ts]
- "apps_update_input_appchangesummary": "AppChangeSummary" | kind=code-symbol | source=src/features/apps/update-input.ts:L71 | neighbors=[update-input.ts]
- "apps_update_input_appupdateinput": "appUpdateInput" | kind=code-symbol | source=src/features/apps/update-input.ts:L7 | neighbors=[update-input.ts]
- "apps_update_input_appupdateresult": "AppUpdateResult" | kind=code-symbol | source=src/features/apps/update-input.ts:L25 | neighbors=[update-input.ts]
- "audit_page_adminauditpage": "AdminAuditPage()" | kind=code-symbol | source=src/app/(app)/admin/audit/page.tsx:L42 | neighbors=[page.tsx]
- "audit_page_auditcontrols": "AuditControls()" | kind=code-symbol | source=src/app/(app)/admin/audit/page.tsx:L88 | neighbors=[page.tsx]
- "audit_page_audittrailsection": "AuditTrailSection()" | kind=code-symbol | source=src/app/(app)/admin/audit/page.tsx:L93 | neighbors=[page.tsx]
- "auth_actions_loginwithpassword": "loginWithPassword()" | kind=code-symbol | source=src/features/auth/actions.ts:L21 | neighbors=[actions.ts]
- "auth_actions_setownpassword": "setOwnPassword()" | kind=code-symbol | source=src/features/auth/actions.ts:L128 | neighbors=[actions.ts]
- "auth_actions_setpasswordinput": "setPasswordInput" | kind=code-symbol | source=src/features/auth/actions.ts:L45 | neighbors=[actions.ts]
- "auth_actor_empty_scope": "EMPTY_SCOPE" | kind=code-symbol | source=src/features/auth/actor.ts:L22 | neighbors=[actor.ts]
- "auth_avatar_actions_allowed_types": "ALLOWED_TYPES" | kind=code-symbol | source=src/features/auth/avatar-actions.ts:L16 | neighbors=[avatar-actions.ts]
- "auth_capabilities_approval_actions": "APPROVAL_ACTIONS" | kind=code-symbol | source=src/features/auth/capabilities.ts:L261 | neighbors=[capabilities.ts]
- "auth_capabilities_irreversible_actions": "IRREVERSIBLE_ACTIONS" | kind=code-symbol | source=src/features/auth/capabilities.ts:L291 | neighbors=[capabilities.ts]
- "auth_capabilities_rank": "RANK" | kind=code-symbol | source=src/features/auth/capabilities.ts:L363 | neighbors=[capabilities.ts]
- "auth_capabilities_row": "Row" | kind=code-symbol | source=src/features/auth/capabilities.ts:L69 | neighbors=[capabilities.ts]
- "auth_capabilities_test_actor": "actor()" | kind=code-symbol | source=src/features/auth/capabilities.test.ts:L17 | neighbors=[capabilities.test.ts]
- "auth_deactivated_test_chain": "chain()" | kind=code-symbol | source=src/features/auth/deactivated.test.ts:L20 | neighbors=[deactivated.test.ts]
- "auth_deactivated_test_getsessionmock": "getSessionMock" | kind=code-symbol | source=src/features/auth/deactivated.test.ts:L15 | neighbors=[deactivated.test.ts]
- "auth_deactivated_test_sample": "SAMPLE" | kind=code-symbol | source=src/features/auth/deactivated.test.ts:L59 | neighbors=[deactivated.test.ts]
- "auth_deactivated_test_selectspy": "selectSpy" | kind=code-symbol | source=src/features/auth/deactivated.test.ts:L16 | neighbors=[deactivated.test.ts]
- "auth_deactivated_test_session": "session()" | kind=code-symbol | source=src/features/auth/deactivated.test.ts:L41 | neighbors=[deactivated.test.ts]
- "auth_enforcement_test_as": "as()" | kind=code-symbol | source=src/features/auth/enforcement.test.ts:L60 | neighbors=[enforcement.test.ts]
- "auth_enforcement_test_authmock": "authMock" | kind=code-symbol | source=src/features/auth/enforcement.test.ts:L13 | neighbors=[enforcement.test.ts]
- "auth_enforcement_test_chain": "chain()" | kind=code-symbol | source=src/features/auth/enforcement.test.ts:L23 | neighbors=[enforcement.test.ts]
- "auth_enforcement_test_deletespy": "deleteSpy" | kind=code-symbol | source=src/features/auth/enforcement.test.ts:L15 | neighbors=[enforcement.test.ts]
- "auth_enforcement_test_insertspy": "insertSpy" | kind=code-symbol | source=src/features/auth/enforcement.test.ts:L16 | neighbors=[enforcement.test.ts]
- "auth_enforcement_test_updatespy": "updateSpy" | kind=code-symbol | source=src/features/auth/enforcement.test.ts:L14 | neighbors=[enforcement.test.ts]
- "auth_error_page_autherrorpage": "AuthErrorPage()" | kind=code-symbol | source=src/app/auth-error/page.tsx:L61 | neighbors=[page.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-117.json

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
