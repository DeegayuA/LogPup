# Node Description Batch 52 of 166

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

- "notion_export_test": "export.test.ts" | kind=code-symbol | source=src/features/notion/export.test.ts:L1 | neighbors=[export.ts, buildBlocks(), SprintExportData, data]
- "notion_parent_page_test": "parent-page.test.ts" | kind=code-symbol | source=src/features/notion/parent-page.test.ts:L1 | neighbors=[parent-page.ts, NotionPageCandidate, pickParentPage(), page()]
- "people_actions_closeopeninterval": "closeOpenInterval()" | kind=code-symbol | source=src/features/people/actions.ts:L131 | neighbors=[actions.ts, historyStatements(), removeAssignment(), updateAssignment()]
- "people_actions_nameforuser": "nameForUser()" | kind=code-symbol | source=src/features/people/actions.ts:L62 | neighbors=[actions.ts, assignUser(), removeAssignment(), updateAssignment()]
- "people_actions_revalidateassignmentpaths": "revalidateAssignmentPaths()" | kind=code-symbol | source=src/features/people/actions.ts:L79 | neighbors=[actions.ts, assignUser(), removeAssignment(), updateAssignment()]
- "people_actions_slugforapp": "slugForApp()" | kind=code-symbol | source=src/features/people/actions.ts:L54 | neighbors=[actions.ts, assignUser(), removeAssignment(), updateAssignment()]
- "people_allocation_history_buildhistoryentry": "buildHistoryEntry()" | kind=code-symbol | source=src/features/people/allocation-history.ts:L129 | neighbors=[ai-actions.ts, actions.ts, allocation-history.ts, allocation-history.test.ts]
- "people_allocation_history_capacityasof": "CapacityAsOf" | kind=code-symbol | source=src/features/people/allocation-history.ts:L22 | neighbors=[allocation-history.ts, selectRowsAsOf(), allocation-history.test.ts, queries.ts]
- "people_allocation_history_describeallocationchange": "describeAllocationChange()" | kind=code-symbol | source=src/features/people/allocation-history.ts:L193 | neighbors=[allocation-history-card.tsx, history-views.tsx, allocation-history.ts, allocation-history.test.ts]
- "people_as_of_date_isodaysago": "isoDaysAgo()" | kind=code-symbol | source=src/features/people/as-of-date.ts:L68 | neighbors=[as-of-picker.tsx, as-of-date.ts, as-of-date.test.ts, history-params.ts]
- "people_as_of_date_resolveasof": "resolveAsOf()" | kind=code-symbol | source=src/features/people/as-of-date.ts:L45 | neighbors=[as-of-date.ts, isoDay(), as-of-date.test.ts, history-params.ts]
- "people_capacity_compare_churncounts": "ChurnCounts" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L202 | neighbors=[capacity-compare.ts, capacity-compare.test.ts, history-stats.ts, queries.ts]
- "people_capacity_compare_overloadstretch": "OverloadStretch" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L220 | neighbors=[history-views.tsx, capacity-compare.ts, history-stats.ts, queries.ts]
- "people_capacity_compare_teamloadstats": "TeamLoadStats" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L86 | neighbors=[capacity-compare.ts, capacity-compare.test.ts, history-stats.ts, queries.ts]
- "people_capacity_hours_allocatedhours": "allocatedHours()" | kind=code-symbol | source=src/features/people/capacity-hours.ts:L68 | neighbors=[capacity-hours.ts, round1(), weeklyCapacityHours(), capacity-hours.test.ts]
- "people_capacity_hours_hoursload": "HoursLoad" | kind=code-symbol | source=src/features/people/capacity-hours.ts:L75 | neighbors=[capacity-hours.ts, round1(), weeklyCapacityHours(), capacity-hours.test.ts]
- "people_cohort_params_cohortparams": "CohortParams" | kind=code-symbol | source=src/features/people/cohort-params.ts:L45 | neighbors=[cohort-nav.tsx, cohort-views.tsx, cohort-params.ts, page.tsx]
- "people_format_instant_formatbusinessdate": "formatBusinessDate()" | kind=code-symbol | source=src/features/people/format-instant.ts:L100 | neighbors=[app-role-history-card.tsx, format-instant.ts, partsOf(), formatBusinessDateTime()]
- "people_format_instant_formatbusinessdatetime": "formatBusinessDateTime()" | kind=code-symbol | source=src/features/people/format-instant.ts:L115 | neighbors=[allocation-history-card.tsx, format-instant.ts, formatBusinessDate(), formatBusinessTime()]
- "people_format_instant_formatbusinessdaymonthtime": "formatBusinessDayMonthTime()" | kind=code-symbol | source=src/features/people/format-instant.ts:L120 | neighbors=[history-views.tsx, format-instant.ts, formatBusinessTime(), partsOf()]
- "people_format_instant_formatbusinessmonthyear": "formatBusinessMonthYear()" | kind=code-symbol | source=src/features/people/format-instant.ts:L126 | neighbors=[person-header.tsx, format-instant.ts, partsOf(), format-instant.test.ts]
- "people_handover_inventory_test": "handover-inventory.test.ts" | kind=code-symbol | source=src/features/people/handover-inventory.test.ts:L1 | neighbors=[handover-inventory.ts, NON_TRANSFERABLE, splitAllocation(), TRANSFERABLE_GROUPS]
- "people_now_actionsentence": "actionSentence()" | kind=code-symbol | source=src/features/people/now.ts:L150 | neighbors=[directory.tsx, now.ts, capitalise(), now.test.ts]
- "people_now_nowheadline": "nowHeadline()" | kind=code-symbol | source=src/features/people/now.ts:L102 | neighbors=[directory.tsx, now.ts, sortNowTasks(), now.test.ts]
- "people_queries_getpersonmeetings": "getPersonMeetings" | kind=code-symbol | source=src/features/people/queries.ts:L962 | neighbors=[dashboard-zones.tsx, page.tsx, queries.ts, summary-actions.ts]
- "people_queries_getteamforapp": "getTeamForApp()" | kind=code-symbol | source=src/features/people/queries.ts:L164 | neighbors=[dashboard-zones.tsx, actions.ts, queries.ts, page.tsx]
- "people_queries_getusercapacities": "getUserCapacities" | kind=code-symbol | source=src/features/people/queries.ts:L183 | neighbors=[dashboard-zones.tsx, context-pack.ts, page.tsx, queries.ts]
- "people_queries_listassignableapps": "listAssignableApps" | kind=code-symbol | source=src/features/people/queries.ts:L624 | neighbors=[dashboard-zones.tsx, page.tsx, queries.ts, page.tsx]
- "people_queries_test": "queries.test.ts" | kind=code-symbol | source=src/features/people/queries.test.ts:L1 | neighbors=[17ab9cc refactor(tasks): route sql-temp…, 4ba83e6 test(people): guard the open/do…, personWorkloadBody(), SOURCE]
- "people_removal_queries_notremoved": "notRemoved()" | kind=code-symbol | source=src/features/people/removal-queries.ts:L55 | neighbors=[queries.ts, removal-queries.ts, canHoldWork(), openRemovalOf()]
- "people_task_workload_bucketopentasks": "bucketOpenTasks()" | kind=code-symbol | source=src/features/people/task-workload.ts:L104 | neighbors=[person-tasks-card.tsx, context-pack.ts, task-workload.ts, task-workload.test.ts]
- "people_task_workload_summarizeopentasks": "summarizeOpenTasks()" | kind=code-symbol | source=src/features/people/task-workload.ts:L129 | neighbors=[dashboard-zones.tsx, queries.ts, task-workload.ts, task-workload.test.ts]
- "public_prose": "prose.ts" | kind=code-symbol | source=src/app/(public)/prose.ts:L1 | neighbors=[d0da911 test(gemini): a public page may…, page.tsx, LEGAL_PROSE, page.tsx]
- "pwa_pwa_installbutton": "InstallButton()" | kind=code-symbol | source=src/features/pwa/pwa.tsx:L89 | neighbors=[pwa.tsx, useInstallPrompt(), header.tsx, sidebar.tsx]
- "registry_commands_palettecommands": "paletteCommands()" | kind=code-symbol | source=src/features/search/registry/commands.ts:L128 | neighbors=[command-center.tsx, commands.ts, navCommands(), registry.test.ts]
- "registry_types_searchgroup": "SearchGroup" | kind=code-symbol | source=src/features/search/registry/types.ts:L144 | neighbors=[command-center.tsx, providers.ts, types.ts, actions.ts]
- "roles_shared_daysbetween": "daysBetween()" | kind=code-symbol | source=src/features/signals/roles/shared.ts:L51 | neighbors=[lead.ts, member.ts, pm.ts, shared.ts]
- "roles_shared_perworkingday": "perWorkingDay()" | kind=code-symbol | source=src/features/signals/roles/shared.ts:L63 | neighbors=[lead.ts, member.ts, roles.test.ts, shared.ts]
- "scripts_check_schema_drift": "check-schema-drift.ts" | kind=code-symbol | source=scripts/check-schema-drift.ts:L1 | neighbors=[schema.ts, declaredTables(), Drift, main()]
- "scripts_verify_head": "verify-head.mjs" | kind=code-symbol | source=scripts/verify-head.mjs:L1 | neighbors=[227e958 build: npm run verify:head — ty…, dir, repo, sha]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-051.json

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
