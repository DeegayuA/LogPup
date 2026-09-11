# Node Description Batch 43 of 166

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

- "admin_change_request_appliers_buildtaskdeadlineset": "buildTaskDeadlineSet()" | kind=code-symbol | source=src/features/admin/change-request-appliers.ts:L82 | neighbors=[change-request-appliers.ts, buildApplyStatement(), asIsoDate(), change-request-appliers.test.ts]
- "admin_change_request_queries_getmyrequests": "getMyRequests()" | kind=code-symbol | source=src/features/admin/change-request-queries.ts:L67 | neighbors=[change-request-queries.ts, select, toInbox(), page.tsx]
- "admin_change_request_routing_mayreview": "mayReview()" | kind=code-symbol | source=src/features/admin/change-request-routing.ts:L31 | neighbors=[change-request-actions.ts, change-request-queries.ts, change-request-routing.ts, change-request-routing.test.ts]
- "admin_danger_actions_emptytrash": "emptyTrash()" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L427 | neighbors=[danger-actions.ts, revalidateDangerPaths(), runPurgeBatch(), danger-trash-empty-card.tsx]
- "admin_danger_actions_resetapp": "resetApp()" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L239 | neighbors=[danger-actions.ts, revalidateDangerPaths(), runPurgeBatch(), danger-app-reset-card.tsx]
- "admin_danger_actions_runpurgebatch": "runPurgeBatch()" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L81 | neighbors=[danger-actions.ts, emptyTrash(), resetApp(), wipeMeetingRecordings()]
- "admin_danger_actions_wipemeetingrecordings": "wipeMeetingRecordings()" | kind=code-symbol | source=src/features/admin/danger-actions.ts:L347 | neighbors=[danger-actions.ts, revalidateDangerPaths(), runPurgeBatch(), danger-recordings-card.tsx]
- "admin_danger_logic_deletemeetingphrase": "deleteMeetingPhrase()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L78 | neighbors=[danger-actions.ts, danger-logic.ts, danger-logic.test.ts, danger-meeting-delete-card.tsx]
- "admin_danger_logic_emptytrashsummary": "emptyTrashSummary()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L153 | neighbors=[danger-logic.ts, plural(), danger-logic.test.ts, danger-trash-empty-card.tsx]
- "admin_danger_logic_resetappphrase": "resetAppPhrase()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L69 | neighbors=[danger-actions.ts, danger-logic.ts, danger-logic.test.ts, danger-app-reset-card.tsx]
- "admin_danger_logic_resetappsummary": "resetAppSummary()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L121 | neighbors=[danger-logic.ts, plural(), danger-logic.test.ts, danger-app-reset-card.tsx]
- "admin_danger_logic_wiperecordingssummary": "wipeRecordingsSummary()" | kind=code-symbol | source=src/features/admin/danger-logic.ts:L139 | neighbors=[danger-logic.ts, danger-logic.test.ts, plural(), danger-recordings-card.tsx]
- "admin_permissions": "permissions.ts" | kind=code-symbol | source=src/features/admin/permissions.ts:L1 | neighbors=[actions.ts, canEditUser(), wouldLeaveNoSuperadmins(), permissions.test.ts]
- "admin_queries_listpendingusers": "listPendingUsers" | kind=code-symbol | source=src/features/admin/queries.ts:L97 | neighbors=[approval-queries.ts, queries.ts, page.tsx, dashboard-zones.tsx]
- "admin_trash_actions_appnamebyid": "appNameById()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L49 | neighbors=[trash-actions.ts, purgeMeeting(), restoreAssignment(), restoreMeeting()]
- "admin_trash_actions_restorebug": "restoreBug()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L186 | neighbors=[trash-actions.ts, revalidateAppEntityTrashPaths(), slugForApp(), trash-row-actions.tsx]
- "admin_trash_actions_restoremeeting": "restoreMeeting()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L214 | neighbors=[trash-actions.ts, appNameById(), revalidateMeetingTrashPaths(), trash-row-actions.tsx]
- "admin_trash_actions_restoreperson": "restorePerson()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L530 | neighbors=[trash-actions.ts, nameForUser(), revalidatePersonTrashPaths(), trash-row-actions.tsx]
- "admin_trash_actions_restoresprint": "restoreSprint()" | kind=code-symbol | source=src/features/admin/trash-actions.ts:L274 | neighbors=[trash-actions.ts, revalidateTrashPaths(), slugForApp(), trash-row-actions.tsx]
- "admin_trash_queries_gettrash": "getTrash()" | kind=code-symbol | source=src/features/admin/trash-queries.ts:L50 | neighbors=[danger-actions.ts, page.tsx, trash-queries.ts, page.tsx]
- "app_apple_icon": "apple-icon.tsx" | kind=code-symbol | source=src/app/apple-icon.tsx:L1 | neighbors=[AppleIcon(), size, brand.ts, pawSvg()]
- "apps_actions_deleteapp": "deleteApp()" | kind=code-symbol | source=src/features/apps/actions.ts:L542 | neighbors=[bulk-actions.ts, actions.ts, apps-table.tsx, delete-app-card.tsx]
- "apps_activity_appactivityitem": "AppActivityItem" | kind=code-symbol | source=src/features/apps/activity.ts:L19 | neighbors=[activity.ts, activity-queries.ts, activity.test.ts, app-activity.tsx]
- "apps_app_aliases_apppromptline": "appPromptLine()" | kind=code-symbol | source=src/features/apps/app-aliases.ts:L276 | neighbors=[app-aliases.ts, deriveAcronyms(), app-aliases.test.ts, catch-up-parse.ts]
- "apps_app_health_dayssince": "daysSince()" | kind=code-symbol | source=src/features/apps/app-health.ts:L92 | neighbors=[app-health.ts, AppHealth, dayDiff(), app-health.test.ts]
- "apps_app_health_health_label": "HEALTH_LABEL" | kind=code-symbol | source=src/features/apps/app-health.ts:L226 | neighbors=[app-health.ts, app-card.tsx, health-dot.tsx, planner.ts]
- "apps_app_health_inclusivedaycount": "inclusiveDayCount()" | kind=code-symbol | source=src/features/apps/app-health.ts:L83 | neighbors=[app-health.ts, dayDiff(), sprintDayProgress(), app-health.test.ts]
- "apps_app_health_pickcurrentsprint": "pickCurrentSprint()" | kind=code-symbol | source=src/features/apps/app-health.ts:L152 | neighbors=[app-health.ts, app-health.test.ts, queries.ts, page.tsx]
- "apps_app_health_picknextsprint": "pickNextSprint()" | kind=code-symbol | source=src/features/apps/app-health.ts:L165 | neighbors=[app-health.ts, app-health.test.ts, queries.ts, page.tsx]
- "apps_app_health_summarizeportfolio": "summarizePortfolio()" | kind=code-symbol | source=src/features/apps/app-health.ts:L356 | neighbors=[app-health.ts, app-health.test.ts, page.tsx, dashboard-zones.tsx]
- "apps_create_input": "create-input.ts" | kind=code-symbol | source=src/features/apps/create-input.ts:L1 | neighbors=[actions.ts, appCreateInput, create-input.test.ts, 9f936b5 Add app aliases and auto-scored…]
- "apps_project_manager_managesanyapp": "managesAnyApp()" | kind=code-symbol | source=src/features/apps/project-manager.ts:L57 | neighbors=[project-manager.ts, actions.ts, ai-actions.ts, load-actions.ts]
- "apps_repo_metadata_repofetcherror": "RepoFetchError" | kind=code-symbol | source=src/features/apps/repo-metadata.ts:L31 | neighbors=[actions.ts, repo-metadata.ts, fetchRepoContext(), .constructor()]
- "apps_role_history_buildroletimeline": "buildRoleTimeline()" | kind=code-symbol | source=src/features/apps/role-history.ts:L75 | neighbors=[queries.ts, role-history.ts, role-history.test.ts, queries.ts]
- "apps_tabs_apptabid": "AppTabId" | kind=code-symbol | source=src/features/apps/tabs.ts:L32 | neighbors=[tabs.ts, tabs.test.ts, app-tab-nav.tsx, page.tsx]
- "apps_update_input_test": "update-input.test.ts" | kind=code-symbol | source=src/features/apps/update-input.test.ts:L1 | neighbors=[update-input.ts, AppBeforeState, buildAppUpdate(), summarizeAppChanges()]
- "auth_capabilities_capfor": "capFor()" | kind=code-symbol | source=src/features/auth/capabilities.ts:L319 | neighbors=[capabilities.ts, has(), effectiveGrant(), capabilities.test.ts]
- "auth_capabilities_scopesourcefor": "scopeSourceFor()" | kind=code-symbol | source=src/features/auth/capabilities.ts:L391 | neighbors=[actor.ts, actor.test.ts, capabilities.ts, notify.ts]
- "auth_queries_getowntitle": "getOwnTitle()" | kind=code-symbol | source=src/features/auth/queries.ts:L42 | neighbors=[layout.tsx, queries.ts, page.tsx, page.tsx]
- "auth_title_schema": "title-schema.ts" | kind=code-symbol | source=src/features/auth/title-schema.ts:L1 | neighbors=[actions.ts, jobRoleInput, job-roles.ts, title-schema.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-042.json

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
