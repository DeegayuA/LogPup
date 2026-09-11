# Node Description Batch 116 of 166

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

- "admin_error_adminerror": "AdminError()" | kind=code-symbol | source=src/app/(app)/admin/error.tsx:L17 | neighbors=[error.tsx]
- "admin_layout_adminlayout": "AdminLayout()" | kind=code-symbol | source=src/app/(app)/admin/layout.tsx:L19 | neighbors=[layout.tsx]
- "admin_loading_adminsectionloading": "AdminSectionLoading()" | kind=code-symbol | source=src/app/(app)/admin/loading.tsx:L17 | neighbors=[loading.tsx]
- "admin_page_adminoverviewpage": "AdminOverviewPage()" | kind=code-symbol | source=src/app/(app)/admin/page.tsx:L46 | neighbors=[page.tsx]
- "admin_page_adoptionskeleton": "AdoptionSkeleton()" | kind=code-symbol | source=src/app/(app)/admin/page.tsx:L222 | neighbors=[page.tsx]
- "admin_page_meetingload": "MeetingLoad()" | kind=code-symbol | source=src/app/(app)/admin/page.tsx:L203 | neighbors=[page.tsx]
- "admin_remove_user_test_asadmin": "asAdmin()" | kind=code-symbol | source=src/features/admin/remove-user.test.ts:L45 | neighbors=[remove-user.test.ts]
- "admin_remove_user_test_authmock_insertspy_selectqueue": "{ authMock, insertSpy, selectQueue }" | kind=code-symbol | source=src/features/admin/remove-user.test.ts:L11 | neighbors=[remove-user.test.ts]
- "admin_set_user_personal_email_test_asadmin": "asAdmin()" | kind=code-symbol | source=src/features/admin/set-user-personal-email.test.ts:L42 | neighbors=[set-user-personal-email.test.ts]
- "admin_set_user_personal_email_test_asmember": "asMember()" | kind=code-symbol | source=src/features/admin/set-user-personal-email.test.ts:L43 | neighbors=[set-user-personal-email.test.ts]
- "admin_set_user_personal_email_test_authmock_writespy": "{ authMock, writeSpy }" | kind=code-symbol | source=src/features/admin/set-user-personal-email.test.ts:L10 | neighbors=[set-user-personal-email.test.ts]
- "admin_set_user_title_test_asadmin": "asAdmin()" | kind=code-symbol | source=src/features/admin/set-user-title.test.ts:L40 | neighbors=[set-user-title.test.ts]
- "admin_set_user_title_test_asmember": "asMember()" | kind=code-symbol | source=src/features/admin/set-user-title.test.ts:L41 | neighbors=[set-user-title.test.ts]
- "admin_set_user_title_test_authmock_writespy": "{ authMock, writeSpy }" | kind=code-symbol | source=src/features/admin/set-user-title.test.ts:L8 | neighbors=[set-user-title.test.ts]
- "admin_trash_actions_test_asadmin": "asAdmin()" | kind=code-symbol | source=src/features/admin/trash-actions.test.ts:L164 | neighbors=[trash-actions.test.ts]
- "admin_trash_actions_test_asmember": "asMember()" | kind=code-symbol | source=src/features/admin/trash-actions.test.ts:L165 | neighbors=[trash-actions.test.ts]
- "admin_trash_actions_test_authmock_writespy_insertspy_deletespy_logactivitymock_blobdelmock": "{ authMock, writeSpy, insertSpy, deleteSpy, logActivityMock, blobDelMock }" | kind=code-symbol | source=src/features/admin/trash-actions.test.ts:L21 | neighbors=[trash-actions.test.ts]
- "admin_trash_actions_test_resettablestate": "resetTableState()" | kind=code-symbol | source=src/features/admin/trash-actions.test.ts:L80 | neighbors=[trash-actions.test.ts]
- "admin_trash_actions_test_statefor": "stateFor()" | kind=code-symbol | source=src/features/admin/trash-actions.test.ts:L72 | neighbors=[trash-actions.test.ts]
- "admin_trash_actions_test_tablestate": "TableState" | kind=code-symbol | source=src/features/admin/trash-actions.test.ts:L65 | neighbors=[trash-actions.test.ts]
- "admin_trash_actions_uuidinput": "uuidInput" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L133 | neighbors=[trash-actions.ts]
- "admin_trash_grouping_rawapptrashrow": "RawAppTrashRow" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L65 | neighbors=[trash-grouping.ts]
- "admin_trash_grouping_rawassignmenttrashrow": "RawAssignmentTrashRow" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L127 | neighbors=[trash-grouping.ts]
- "admin_trash_grouping_rawbugtrashrow": "RawBugTrashRow" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L77 | neighbors=[trash-grouping.ts]
- "admin_trash_grouping_rawkeyframetrashrow": "RawKeyframeTrashRow" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L125 | neighbors=[trash-grouping.ts]
- "admin_trash_grouping_rawmeetingtrashrow": "RawMeetingTrashRow" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L86 | neighbors=[trash-grouping.ts]
- "admin_trash_grouping_rawpersontrashrow": "RawPersonTrashRow" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L145 | neighbors=[trash-grouping.ts]
- "admin_trash_grouping_rawsegmenttrashrow": "RawSegmentTrashRow" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L113 | neighbors=[trash-grouping.ts]
- "admin_trash_grouping_rawsprinttrashrow": "RawSprintTrashRow" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L104 | neighbors=[trash-grouping.ts]
- "admin_trash_grouping_rawtasktrashrow": "RawTaskTrashRow" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L95 | neighbors=[trash-grouping.ts]
- "admin_trash_grouping_test_deleted_at": "DELETED_AT" | kind=code-symbol | source=src/features/admin/trash-grouping.test.ts:L14 | neighbors=[trash-grouping.test.ts]
- "admin_trash_grouping_trash_kinds": "TRASH_KINDS" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L36 | neighbors=[trash-grouping.ts]
- "admin_trash_queries_test_qfor": "qFor()" | kind=code-symbol | source=src/features/admin/trash-queries.test.ts:L21 | neighbors=[trash-queries.test.ts]
- "admin_trash_queries_test_tablequeues": "TableQueues" | kind=code-symbol | source=src/features/admin/trash-queries.test.ts:L19 | neighbors=[trash-queries.test.ts]
- "animate_ui_stat_number_stattransition": "statTransition" | kind=code-symbol | source=src/components/animate-ui/stat-number.tsx:L8 | neighbors=[stat-number.tsx]
- "animate_ui_stat_number_subscribetoreducedmotion": "subscribeToReducedMotion()" | kind=code-symbol | source=src/components/animate-ui/stat-number.tsx:L12 | neighbors=[stat-number.tsx]
- "app_apple_icon_appleicon": "AppleIcon()" | kind=code-symbol | source=src/app/apple-icon.tsx:L7 | neighbors=[apple-icon.tsx]
- "app_apple_icon_size": "size" | kind=code-symbol | source=src/app/apple-icon.tsx:L4 | neighbors=[apple-icon.tsx]
- "app_error_apperror": "AppError()" | kind=code-symbol | source=src/app/(app)/error.tsx:L21 | neighbors=[error.tsx]
- "app_layout_applayout": "AppLayout()" | kind=code-symbol | source=src/app/(app)/layout.tsx:L18 | neighbors=[layout.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-115.json

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
