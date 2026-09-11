# Node Description Batch 156 of 166

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

- "progress_page_matrixsection": "MatrixSection()" | kind=code-symbol | source=src/app/(app)/progress/page.tsx:L163 | neighbors=[page.tsx]
- "progress_page_metadata": "metadata" | kind=code-symbol | source=src/app/(app)/progress/page.tsx:L35 | neighbors=[page.tsx]
- "progress_page_progresspage": "ProgressPage()" | kind=code-symbol | source=src/app/(app)/progress/page.tsx:L37 | neighbors=[page.tsx]
- "public_layout_publiclayout": "PublicLayout()" | kind=code-symbol | source=src/app/(public)/layout.tsx:L18 | neighbors=[layout.tsx]
- "public_sw_iscacheableasset": "isCacheableAsset()" | kind=code-symbol | source=public/sw.js:L60 | neighbors=[sw.js]
- "public_sw_isstorable": "isStorable()" | kind=code-symbol | source=public/sw.js:L77 | neighbors=[sw.js]
- "public_sw_offlinedocument": "offlineDocument()" | kind=code-symbol | source=public/sw.js:L50 | neighbors=[sw.js]
- "public_table_of_contents_tocsection": "TocSection" | kind=code-symbol | source=src/app/(public)/table-of-contents.tsx:L7 | neighbors=[table-of-contents.tsx]
- "pwa_icon_route_get": "GET()" | kind=code-symbol | source=src/app/pwa-icon/route.tsx:L13 | neighbors=[route.tsx]
- "pwa_pwa_installpromptevent": "InstallPromptEvent" | kind=code-symbol | source=src/features/pwa/pwa.tsx:L34 | neighbors=[pwa.tsx]
- "pwa_sw_test_iscacheableasset_isstorable_cache": "{ isCacheableAsset, isStorable, CACHE }" | kind=code-symbol | source=src/features/pwa/sw.test.ts:L46 | neighbors=[sw.test.ts]
- "pwa_sw_test_loadserviceworker": "loadServiceWorker()" | kind=code-symbol | source=src/features/pwa/sw.test.ts:L15 | neighbors=[sw.test.ts]
- "pwa_sw_test_url": "url()" | kind=code-symbol | source=src/features/pwa/sw.test.ts:L48 | neighbors=[sw.test.ts]
- "registry_commands_feature_commands": "FEATURE_COMMANDS" | kind=code-symbol | source=src/features/search/registry/commands.ts:L43 | neighbors=[commands.ts]
- "registry_commands_group_order": "GROUP_ORDER" | kind=code-symbol | source=src/features/search/registry/commands.ts:L71 | neighbors=[commands.ts]
- "registry_kinds_kindmeta": "KindMeta" | kind=code-symbol | source=src/features/search/registry/kinds.ts:L14 | neighbors=[kinds.ts]
- "registry_registry_test_client_forbidden": "CLIENT_FORBIDDEN" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L323 | neighbors=[registry.test.ts]
- "registry_registry_test_commandsregistrysource": "commandsRegistrySource" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L131 | neighbors=[registry.test.ts]
- "registry_registry_test_ctx": "ctx()" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L135 | neighbors=[registry.test.ts]
- "registry_registry_test_features": "FEATURES" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L34 | neighbors=[registry.test.ts]
- "registry_registry_test_features_dir": "FEATURES_DIR" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L30 | neighbors=[registry.test.ts]
- "registry_registry_test_gate_pending": "GATE_PENDING" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L278 | neighbors=[registry.test.ts]
- "registry_registry_test_no_commands": "NO_COMMANDS" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L44 | neighbors=[registry.test.ts]
- "registry_registry_test_no_search": "NO_SEARCH" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L82 | neighbors=[registry.test.ts]
- "registry_registry_test_paletterole": "PaletteRole" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L499 | neighbors=[registry.test.ts]
- "registry_registry_test_providersregistrysource": "providersRegistrySource" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L132 | neighbors=[registry.test.ts]
- "registry_registry_test_read": "read()" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L127 | neighbors=[registry.test.ts]
- "registry_registry_test_repo_root": "REPO_ROOT" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L31 | neighbors=[registry.test.ts]
- "registry_registry_test_rolestheregistrywaswrittenfor": "RolesTheRegistryWasWrittenFor" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L500 | neighbors=[registry.test.ts]
- "registry_registry_test_roleunionunchanged": "RoleUnionUnchanged" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L508 | neighbors=[registry.test.ts]
- "registry_registry_test_walk": "walk()" | kind=code-symbol | source=src/features/search/registry/registry.test.ts:L372 | neighbors=[registry.test.ts]
- "registry_types_commandbase": "CommandBase" | kind=code-symbol | source=src/features/search/registry/types.ts:L85 | neighbors=[types.ts]
- "registry_types_commandgroupid": "CommandGroupId" | kind=code-symbol | source=src/features/search/registry/types.ts:L47 | neighbors=[types.ts]
- "registry_types_hrefcommand": "HrefCommand" | kind=code-symbol | source=src/features/search/registry/types.ts:L118 | neighbors=[types.ts]
- "registry_types_runcommand": "RunCommand" | kind=code-symbol | source=src/features/search/registry/types.ts:L124 | neighbors=[types.ts]
- "registry_types_searchhit": "SearchHit" | kind=code-symbol | source=src/features/search/registry/types.ts:L132 | neighbors=[types.ts]
- "roles_architect_architectmeeting": "ArchitectMeeting" | kind=code-symbol | source=src/features/signals/roles/architect.ts:L28 | neighbors=[architect.ts]
- "roles_lead_leadassignment": "LeadAssignment" | kind=code-symbol | source=src/features/signals/roles/lead.ts:L31 | neighbors=[lead.ts]
- "roles_lead_leadcompletion": "LeadCompletion" | kind=code-symbol | source=src/features/signals/roles/lead.ts:L23 | neighbors=[lead.ts]
- "roles_lead_leadreview": "LeadReview" | kind=code-symbol | source=src/features/signals/roles/lead.ts:L21 | neighbors=[lead.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-155.json

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
