# Node Description Batch 58 of 166

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

- "admin_danger_logic_normalizeconfirm": "normalizeConfirm()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L34 | neighbors=[danger-logic.ts, matchesConfirm(), danger-logic.test.ts]
- "admin_danger_logic_planbatch": "planBatch()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L229 | neighbors=[danger-actions.ts, danger-logic.ts, danger-logic.test.ts]
- "admin_danger_logic_purgeabletrashtotal": "purgeableTrashTotal()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L193 | neighbors=[danger-actions.ts, danger-logic.ts, danger-logic.test.ts]
- "admin_danger_logic_purgequeue": "purgeQueue()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L200 | neighbors=[danger-actions.ts, danger-logic.ts, danger-logic.test.ts]
- "admin_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/admin/error.tsx:L1 | neighbors=[AdminError(), button.tsx, Button()]
- "admin_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/admin/loading.tsx:L1 | neighbors=[AdminSectionLoading(), skeleton.tsx, Skeleton()]
- "admin_permissions_canedituser": "canEditUser()" | kind=code-symbol | source=src/features/admin/permissions.ts:L1 | neighbors=[actions.ts, permissions.ts, permissions.test.ts]
- "admin_permissions_test": "permissions.test.ts" | kind=code-symbol | source=src/features/admin/permissions.test.ts:L1 | neighbors=[permissions.ts, canEditUser(), wouldLeaveNoSuperadmins()]
- "admin_permissions_wouldleavenosuperadmins": "wouldLeaveNoSuperadmins()" | kind=code-symbol | source=src/features/admin/permissions.ts:L15 | neighbors=[actions.ts, permissions.ts, permissions.test.ts]
- "admin_queries_listallusers": "listAllUsers()" | kind=code-symbol | source=src/features/admin/queries.ts:L48 | neighbors=[page.tsx, queries.ts, page.tsx]
- "admin_remove_user_test": "remove-user.test.ts" | kind=code-symbol | source=src/features/admin/remove-user.test.ts:L1 | neighbors=[actions.ts, asAdmin(), { authMock, insertSpy, selectQueue }]
- "admin_trash_actions_nameforuser": "nameForUser()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L61 | neighbors=[trash-actions.ts, restoreAssignment(), restorePerson()]
- "admin_trash_actions_restoreapp": "restoreApp()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L149 | neighbors=[trash-actions.ts, revalidateTrashPaths(), trash-row-actions.tsx]
- "admin_trash_actions_restorekeyframe": "restoreKeyframe()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L348 | neighbors=[trash-actions.ts, revalidateTrashPaths(), trash-row-actions.tsx]
- "admin_trash_actions_restoresegment": "restoreSegment()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L305 | neighbors=[trash-actions.ts, revalidateTrashPaths(), trash-row-actions.tsx]
- "admin_trash_actions_restoretask": "restoreTask()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L246 | neighbors=[trash-actions.ts, revalidateAppEntityTrashPaths(), trash-row-actions.tsx]
- "admin_trash_actions_revalidateassignmenttrashpaths": "revalidateAssignmentTrashPaths()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L125 | neighbors=[trash-actions.ts, restoreAssignment(), revalidateTrashPaths()]
- "admin_trash_actions_revalidatepersontrashpaths": "revalidatePersonTrashPaths()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L118 | neighbors=[trash-actions.ts, restorePerson(), revalidateTrashPaths()]
- "admin_trash_grouping_buildassignmenttrashrow": "buildAssignmentTrashRow()" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L269 | neighbors=[trash-grouping.ts, trash-grouping.test.ts, trash-queries.ts]
- "admin_trash_grouping_buildkeyframetrashrow": "buildKeyframeTrashRow()" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L256 | neighbors=[trash-grouping.ts, trash-grouping.test.ts, trash-queries.ts]
- "admin_trash_grouping_buildmeetingtrashrow": "buildMeetingTrashRow()" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L199 | neighbors=[trash-grouping.ts, trash-grouping.test.ts, trash-queries.ts]
- "admin_trash_grouping_buildpersontrashrow": "buildPersonTrashRow()" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L281 | neighbors=[trash-grouping.ts, trash-grouping.test.ts, trash-queries.ts]
- "admin_trash_grouping_buildsegmenttrashrow": "buildSegmentTrashRow()" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L243 | neighbors=[trash-grouping.ts, trash-grouping.test.ts, trash-queries.ts]
- "admin_trash_grouping_buildsprinttrashrow": "buildSprintTrashRow()" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L231 | neighbors=[trash-grouping.ts, trash-grouping.test.ts, trash-queries.ts]
- "admin_trash_grouping_buildtasktrashrow": "buildTaskTrashRow()" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L211 | neighbors=[trash-grouping.ts, trash-grouping.test.ts, trash-queries.ts]
- "admin_trash_grouping_totrashgroup": "toTrashGroup()" | kind=code-symbol | source=src/features/admin/trash-grouping.ts:L303 | neighbors=[trash-grouping.ts, trash-grouping.test.ts, trash-queries.ts]
- "app_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/error.tsx:L1 | neighbors=[AppError(), button.tsx, Button()]
- "apps_actions_archiveapp": "archiveApp()" | kind=code-symbol | source=src/features/apps/actions.ts:L581 | neighbors=[bulk-actions.ts, actions.ts, apps-table.tsx]
- "apps_actions_createapp": "createApp()" | kind=code-symbol | source=src/features/apps/actions.ts:L273 | neighbors=[actions.ts, nameForUser(), app-form-dialog.tsx]
- "apps_actions_generateappfromreadme": "generateAppFromReadme()" | kind=code-symbol | source=src/features/apps/actions.ts:L192 | neighbors=[actions.ts, generateFromFacts(), app-form-dialog.tsx]
- "apps_actions_generateappfromrepo": "generateAppFromRepo()" | kind=code-symbol | source=src/features/apps/actions.ts:L229 | neighbors=[actions.ts, generateFromFacts(), app-form-dialog.tsx]
- "apps_actions_generatefromfacts": "generateFromFacts()" | kind=code-symbol | source=src/features/apps/actions.ts:L92 | neighbors=[actions.ts, generateAppFromReadme(), generateAppFromRepo()]
- "apps_actions_nameforuser": "nameForUser()" | kind=code-symbol | source=src/features/apps/actions.ts:L32 | neighbors=[actions.ts, createApp(), updateApp()]
- "apps_activity_assignmentactivitytitle": "assignmentActivityTitle()" | kind=code-symbol | source=src/features/apps/activity.ts:L106 | neighbors=[activity.ts, activity-queries.ts, activity.test.ts]
- "apps_activity_groupactivitybyday": "groupActivityByDay()" | kind=code-symbol | source=src/features/apps/activity.ts:L68 | neighbors=[activity.ts, activity.test.ts, app-activity.tsx]
- "apps_activity_mergeactivity": "mergeActivity()" | kind=code-symbol | source=src/features/apps/activity.ts:L40 | neighbors=[activity.ts, activity-queries.ts, activity.test.ts]
- "apps_activity_relativedaylabel": "relativeDayLabel()" | kind=code-symbol | source=src/features/apps/activity.ts:L95 | neighbors=[activity.ts, activity.test.ts, app-activity.tsx]
- "apps_app_aliases_appvocabulary": "appVocabulary()" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L110 | neighbors=[app-aliases.ts, matchApp(), app-aliases.test.ts]
- "apps_app_aliases_containsword": "containsWord()" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L130 | neighbors=[app-aliases.ts, escape(), matchApp()]
- "apps_app_aliases_words": "words()" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L62 | neighbors=[app-aliases.ts, deriveAcronyms(), matchApp()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-057.json

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
