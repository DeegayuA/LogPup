# Node Description Batch 74 of 166

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

- "notifications_notify_loadscopes": "loadScopes()" | kind=code-symbol | source=src/features/notifications/notify.ts:L258 | neighbors=[notify.ts, dropIneligibleRecipients(), recordMentions()]
- "notifications_notify_recordmentions": "recordMentions()" | kind=code-symbol | source=src/features/notifications/notify.ts:L678 | neighbors=[notify.ts, createNotifications(), loadScopes()]
- "notifications_notify_rules_colombodaywindow": "colomboDayWindow()" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L348 | neighbors=[notify.ts, notify-rules.ts, notify-rules.test.ts]
- "notifications_notify_rules_dailycapfor": "dailyCapFor()" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L271 | neighbors=[notify-rules.ts, applyDailyCap(), notify-rules.test.ts]
- "notifications_notify_rules_deduperowstillbinds": "dedupeRowStillBinds()" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L124 | neighbors=[notify.ts, notify-rules.ts, notify-rules.test.ts]
- "notifications_notify_rules_mergesamekey": "mergeSameKey()" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L150 | neighbors=[notify.ts, notify-rules.ts, notify-rules.test.ts]
- "notifications_notify_rules_recipientcandidate": "RecipientCandidate" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L174 | neighbors=[notify.ts, notify-rules.ts, notify-rules.test.ts]
- "notifications_notify_rules_recipientsfor": "recipientsFor()" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L206 | neighbors=[notify.ts, notify-rules.ts, notify-rules.test.ts]
- "notifications_retention_planretention": "planRetention()" | kind=code-symbol | source=src/features/notifications/retention.ts:L144 | neighbors=[retention.ts, retention.test.ts, route.ts]
- "notifications_retention_prunereason": "PruneReason" | kind=code-symbol | source=src/features/notifications/retention.ts:L58 | neighbors=[retention.ts, retention.test.ts, route.ts]
- "notifications_retention_summarizeretention": "summarizeRetention()" | kind=code-symbol | source=src/features/notifications/retention.ts:L175 | neighbors=[retention.ts, retention.test.ts, route.ts]
- "notion_actions_buildexportdata": "buildExportData()" | kind=code-symbol | source=src/features/notion/actions.ts:L21 | neighbors=[actions.ts, columnItems(), exportSprintToNotion()]
- "notion_actions_exportsprinttonotion": "exportSprintToNotion()" | kind=code-symbol | source=src/features/notion/actions.ts:L40 | neighbors=[export-button.tsx, actions.ts, buildExportData()]
- "notion_export_buildblocks": "buildBlocks()" | kind=code-symbol | source=src/features/notion/export.ts:L66 | neighbors=[export.ts, export.test.ts, upsertSprintPage()]
- "notion_export_notionparenterror": "NotionParentError" | kind=code-symbol | source=src/features/notion/export.ts:L9 | neighbors=[actions.ts, export.ts, resolveParentPageId()]
- "notion_export_resolveparentpageid": "resolveParentPageId()" | kind=code-symbol | source=src/features/notion/export.ts:L20 | neighbors=[export.ts, NotionParentError, upsertSprintPage()]
- "notion_export_sprintexportdata": "SprintExportData" | kind=code-symbol | source=src/features/notion/export.ts:L57 | neighbors=[actions.ts, export.ts, export.test.ts]
- "notion_parent_page_notionpagecandidate": "NotionPageCandidate" | kind=code-symbol | source=src/features/notion/parent-page.ts:L19 | neighbors=[export.ts, parent-page.ts, parent-page.test.ts]
- "notion_parent_page_pickparentpage": "pickParentPage()" | kind=code-symbol | source=src/features/notion/parent-page.ts:L45 | neighbors=[export.ts, parent-page.ts, parent-page.test.ts]
- "onboarding_schema_onboardinginput": "onboardingInput" | kind=code-symbol | source=src/features/onboarding/schema.ts:L8 | neighbors=[actions.ts, schema.ts, schema.test.ts]
- "pending_error": "error.tsx" | kind=code-symbol | source=src/app/pending/error.tsx:L1 | neighbors=[PendingError(), button.tsx, Button()]
- "people_actions_assignmentstillexists": "assignmentStillExists()" | kind=code-symbol | source=src/features/people/actions.ts:L148 | neighbors=[actions.ts, removeAssignment(), updateAssignment()]
- "people_actions_historystatements": "historyStatements()" | kind=code-symbol | source=src/features/people/actions.ts:L106 | neighbors=[actions.ts, assignUser(), closeOpenInterval()]
- "people_actions_openintervalfromassignment": "openIntervalFromAssignment()" | kind=code-symbol | source=src/features/people/actions.ts:L168 | neighbors=[actions.ts, removeAssignment(), updateAssignment()]
- "people_actions_warningforuser": "warningForUser()" | kind=code-symbol | source=src/features/people/actions.ts:L67 | neighbors=[actions.ts, assignUser(), updateAssignment()]
- "people_activity_levels_activity_thresholds": "ACTIVITY_THRESHOLDS" | kind=code-symbol | source=src/features/people/activity-levels.ts:L42 | neighbors=[person-activity-card.tsx, activity-levels.ts, activity-levels.test.ts]
- "people_activity_levels_activityday": "ActivityDay" | kind=code-symbol | source=src/features/people/activity-levels.ts:L30 | neighbors=[activity-graph.tsx, activity-levels.ts, queries.ts]
- "people_activity_levels_activitylevel": "ActivityLevel" | kind=code-symbol | source=src/features/people/activity-levels.ts:L28 | neighbors=[person-activity-card.tsx, activity-levels.ts, activity-levels.test.ts]
- "people_activity_levels_activitypeak": "activityPeak()" | kind=code-symbol | source=src/features/people/activity-levels.ts:L85 | neighbors=[activity-levels.ts, activity-levels.test.ts, queries.ts]
- "people_activity_levels_activitytotal": "activityTotal()" | kind=code-symbol | source=src/features/people/activity-levels.ts:L80 | neighbors=[activity-levels.ts, activity-levels.test.ts, queries.ts]
- "people_activity_levels_buildactivityseries": "buildActivitySeries()" | kind=code-symbol | source=src/features/people/activity-levels.ts:L67 | neighbors=[activity-levels.ts, activity-levels.test.ts, queries.ts]
- "people_allocation_history_allocationtotalseries": "allocationTotalSeries()" | kind=code-symbol | source=src/features/people/allocation-history.ts:L240 | neighbors=[allocation-history.ts, allocation-history.test.ts, queries.ts]
- "people_allocation_history_buildallocationtimeline": "buildAllocationTimeline()" | kind=code-symbol | source=src/features/people/allocation-history.ts:L168 | neighbors=[allocation-history.ts, allocation-history.test.ts, queries.ts]
- "people_allocation_history_personallocationhistoryview": "PersonAllocationHistoryView" | kind=code-symbol | source=src/features/people/allocation-history.ts:L235 | neighbors=[allocation-history-card.tsx, allocation-history.ts, queries.ts]
- "people_allocation_history_trendpoint": "TrendPoint" | kind=code-symbol | source=src/features/people/allocation-history.ts:L221 | neighbors=[allocation-trend.tsx, allocation-history.ts, queries.ts]
- "people_as_of_date_isoday": "isoDay()" | kind=code-symbol | source=src/features/people/as-of-date.ts:L41 | neighbors=[as-of-date.ts, resolveAsOf(), todayIso()]
- "people_capacity_compare_apploadrow": "AppLoadRow" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L123 | neighbors=[history-views.tsx, capacity-compare.ts, queries.ts]
- "people_capacity_compare_apploadrows": "appLoadRows()" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L140 | neighbors=[capacity-compare.ts, capacity-compare.test.ts, queries.ts]
- "people_capacity_compare_capacitydelta": "CapacityDelta" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L21 | neighbors=[history-views.tsx, capacity-compare.ts, queries.ts]
- "people_capacity_compare_capacitysnapshotentry": "CapacitySnapshotEntry" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L14 | neighbors=[capacity-compare.ts, capacity-compare.test.ts, queries.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-073.json

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
