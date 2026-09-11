# Node Description Batch 114 of 166

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

- "activity_search_bestwordsimilarity": "bestWordSimilarity()" | kind=code-symbol | source=src/features/activity/search.ts:L37 | neighbors=[search.ts]
- "activity_search_test_row": "Row" | kind=code-symbol | source=src/features/activity/search.test.ts:L5 | neighbors=[search.test.ts]
- "activity_search_test_text": "text()" | kind=code-symbol | source=src/features/activity/search.test.ts:L6 | neighbors=[search.test.ts]
- "activity_search_words": "words()" | kind=code-symbol | source=src/features/activity/search.ts:L32 | neighbors=[search.ts]
- "activity_types_activityentitytype": "ActivityEntityType" | kind=code-symbol | source=src/features/activity/types.ts:L47 | neighbors=[types.ts]
- "activity_types_activityverb": "ActivityVerb" | kind=code-symbol | source=src/features/activity/types.ts:L74 | neighbors=[types.ts]
- "admin_actions_approveuserinput": "approveUserInput" | kind=code-symbol | source=src/features/admin/actions.ts:L749 | neighbors=[actions.ts]
- "admin_actions_createuserinput": "createUserInput" | kind=code-symbol | source=src/features/admin/actions.ts:L473 | neighbors=[actions.ts]
- "admin_actions_employmentinput": "employmentInput" | kind=code-symbol | source=src/features/admin/actions.ts:L816 | neighbors=[actions.ts]
- "admin_actions_orgtagsinput": "orgTagsInput" | kind=code-symbol | source=src/features/admin/actions.ts:L435 | neighbors=[actions.ts]
- "admin_actions_removalreasoninput": "removalReasonInput" | kind=code-symbol | source=src/features/admin/actions.ts:L163 | neighbors=[actions.ts]
- "admin_actions_roleinput": "roleInput" | kind=code-symbol | source=src/features/admin/actions.ts:L96 | neighbors=[actions.ts]
- "admin_app_grant_actions_grantappaccess": "grantAppAccess()" | kind=code-symbol | source=src/features/admin/app-grant-actions.ts:L18 | neighbors=[app-grant-actions.ts]
- "admin_app_grant_actions_grantinput": "grantInput" | kind=code-symbol | source=src/features/admin/app-grant-actions.ts:L12 | neighbors=[app-grant-actions.ts]
- "admin_app_grant_actions_revokeappgrant": "revokeAppGrant()" | kind=code-symbol | source=src/features/admin/app-grant-actions.ts:L52 | neighbors=[app-grant-actions.ts]
- "admin_approval_badge_test_counts": "counts()" | kind=code-symbol | source=src/features/admin/approval-badge.test.ts:L12 | neighbors=[approval-badge.test.ts]
- "admin_audit_filters_audit_sort_directions": "AUDIT_SORT_DIRECTIONS" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L30 | neighbors=[audit-filters.ts]
- "admin_audit_filters_auditdaygroup": "AuditDayGroup" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L303 | neighbors=[audit-filters.ts]
- "admin_audit_filters_auditparamsschema": "auditParamsSchema" | kind=code-symbol | source=src/features/admin/audit-filters.ts:L103 | neighbors=[audit-filters.ts]
- "admin_audit_filters_test_base": "BASE" | kind=code-symbol | source=src/features/admin/audit-filters.test.ts:L30 | neighbors=[audit-filters.test.ts]
- "admin_audit_nl_actions_askinput": "askInput" | kind=code-symbol | source=src/features/admin/audit-nl-actions.ts:L39 | neighbors=[audit-nl-actions.ts]
- "admin_audit_nl_actions_auditaskresult": "AuditAskResult" | kind=code-symbol | source=src/features/admin/audit-nl-actions.ts:L45 | neighbors=[audit-nl-actions.ts]
- "admin_audit_nl_auditnlpatch": "AuditNlPatch" | kind=code-symbol | source=src/features/admin/audit-nl.ts:L56 | neighbors=[audit-nl.ts]
- "admin_audit_nl_test_current": "current" | kind=code-symbol | source=src/features/admin/audit-nl.test.ts:L10 | neighbors=[audit-nl.test.ts]
- "admin_audit_nl_verb_values": "VERB_VALUES" | kind=code-symbol | source=src/features/admin/audit-nl.ts:L30 | neighbors=[audit-nl.ts]
- "admin_audit_queries_auditrowshape": "AuditRowShape" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L215 | neighbors=[audit-queries.ts]
- "admin_audit_queries_empty_page": "EMPTY_PAGE" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L69 | neighbors=[audit-queries.ts]
- "admin_audit_queries_test_admin": "ADMIN" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L81 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_test_auditor": "AUDITOR" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L82 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_test_base": "BASE" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L76 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_test_countqueue": "countQueue" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L28 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_test_distinctqueue": "distinctQueue" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L29 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_test_hostile_tail": "HOSTILE_TAIL" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L89 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_test_manager": "MANAGER" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L84 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_test_member": "MEMBER" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L83 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_test_render": "render()" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L92 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_test_row": "row()" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L307 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_test_rowqueue": "rowQueue" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L27 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_test_thenfrom": "thenFrom()" | kind=code-symbol | source=src/features/admin/audit-queries.test.ts:L32 | neighbors=[audit-queries.test.ts]
- "admin_audit_queries_toauditentry": "toAuditEntry()" | kind=code-symbol | source=src/features/admin/audit-queries.ts:L217 | neighbors=[audit-queries.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-113.json

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
