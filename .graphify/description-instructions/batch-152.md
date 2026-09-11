# Node Description Batch 153 of 166

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

- "notifications_notify_rules_overflowrow": "OverflowRow" | kind=code-symbol | source=src/features/notifications/notify-rules.ts:L276 | neighbors=[notify-rules.ts]
- "notifications_notify_toinsertrow": "toInsertRow()" | kind=code-symbol | source=src/features/notifications/notify.ts:L133 | neighbors=[notify.ts]
- "notifications_queries_notificationmeetingisliveorabsent": "notificationMeetingIsLiveOrAbsent" | kind=code-symbol | source=src/features/notifications/queries.ts:L12 | neighbors=[queries.ts]
- "notifications_retention_retentioncandidate": "RetentionCandidate" | kind=code-symbol | source=src/features/notifications/retention.ts:L61 | neighbors=[retention.ts]
- "notifications_retention_retentiondecision": "RetentionDecision" | kind=code-symbol | source=src/features/notifications/retention.ts:L66 | neighbors=[retention.ts]
- "notifications_retention_retentionplan": "RetentionPlan" | kind=code-symbol | source=src/features/notifications/retention.ts:L71 | neighbors=[retention.ts]
- "notifications_retention_retentionpolicy": "RetentionPolicy" | kind=code-symbol | source=src/features/notifications/retention.ts:L23 | neighbors=[retention.ts]
- "notifications_retention_test_ago": "ago()" | kind=code-symbol | source=src/features/notifications/retention.test.ts:L17 | neighbors=[retention.test.ts]
- "notifications_retention_test_now": "NOW" | kind=code-symbol | source=src/features/notifications/retention.test.ts:L13 | neighbors=[retention.test.ts]
- "notify_tick_route_pruneresult": "PruneResult" | kind=code-symbol | source=src/app/api/cron/notify-tick/route.ts:L94 | neighbors=[route.ts]
- "notion_export_test_data": "data" | kind=code-symbol | source=src/features/notion/export.test.ts:L4 | neighbors=[export.test.ts]
- "notion_parent_page_parentpagedecision": "ParentPageDecision" | kind=code-symbol | source=src/features/notion/parent-page.ts:L27 | neighbors=[parent-page.ts]
- "notion_parent_page_test_page": "page()" | kind=code-symbol | source=src/features/notion/parent-page.test.ts:L4 | neighbors=[parent-page.test.ts]
- "path_route_get": "GET()" | kind=code-symbol | source=src/app/api/meeting-keyframes/[...path]/route.ts:L26 | neighbors=[route.ts]
- "pending_error_pendingerror": "PendingError()" | kind=code-symbol | source=src/app/pending/error.tsx:L16 | neighbors=[error.tsx]
- "pending_loading_pendingloading": "PendingLoading()" | kind=code-symbol | source=src/app/pending/loading.tsx:L11 | neighbors=[loading.tsx]
- "pending_page_metadata": "metadata" | kind=code-symbol | source=src/app/pending/page.tsx:L13 | neighbors=[page.tsx]
- "pending_page_pendingpage": "PendingPage()" | kind=code-symbol | source=src/app/pending/page.tsx:L21 | neighbors=[page.tsx]
- "people_actions_assigninput": "assignInput" | kind=code-symbol | source=src/features/people/actions.ts:L15 | neighbors=[actions.ts]
- "people_actions_assignmentupdateinput": "assignmentUpdateInput" | kind=code-symbol | source=src/features/people/actions.ts:L25 | neighbors=[actions.ts]
- "people_allocation_allocationrow": "AllocationRow" | kind=code-symbol | source=src/features/people/allocation.ts:L1 | neighbors=[allocation.ts]
- "people_allocation_capacitysummary": "CapacitySummary" | kind=code-symbol | source=src/features/people/allocation.ts:L2 | neighbors=[allocation.ts]
- "people_allocation_history_historyentry": "HistoryEntry" | kind=code-symbol | source=src/features/people/allocation-history.ts:L107 | neighbors=[allocation-history.ts]
- "people_allocation_history_historyentryinput": "HistoryEntryInput" | kind=code-symbol | source=src/features/people/allocation-history.ts:L96 | neighbors=[allocation-history.ts]
- "people_allocation_history_test_apr": "APR" | kind=code-symbol | source=src/features/people/allocation-history.test.ts:L16 | neighbors=[allocation-history.test.ts]
- "people_allocation_history_test_feb": "FEB" | kind=code-symbol | source=src/features/people/allocation-history.test.ts:L14 | neighbors=[allocation-history.test.ts]
- "people_allocation_history_test_jan": "JAN" | kind=code-symbol | source=src/features/people/allocation-history.test.ts:L13 | neighbors=[allocation-history.test.ts]
- "people_allocation_history_test_mar": "MAR" | kind=code-symbol | source=src/features/people/allocation-history.test.ts:L15 | neighbors=[allocation-history.test.ts]
- "people_allocation_history_test_row": "row()" | kind=code-symbol | source=src/features/people/allocation-history.test.ts:L18 | neighbors=[allocation-history.test.ts]
- "people_allocation_history_timelineentry": "TimelineEntry" | kind=code-symbol | source=src/features/people/allocation-history.ts:L156 | neighbors=[allocation-history.ts]
- "people_as_of_date_test_after_local_midnight": "AFTER_LOCAL_MIDNIGHT" | kind=code-symbol | source=src/features/people/as-of-date.test.ts:L7 | neighbors=[as-of-date.test.ts]
- "people_as_of_date_test_now": "NOW" | kind=code-symbol | source=src/features/people/as-of-date.test.ts:L4 | neighbors=[as-of-date.test.ts]
- "people_capacity_compare_teamchangerow": "TeamChangeRow" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L169 | neighbors=[capacity-compare.ts]
- "people_capacity_compare_test_app": "app()" | kind=code-symbol | source=src/features/people/capacity-compare.test.ts:L14 | neighbors=[capacity-compare.test.ts]
- "people_capacity_compare_test_person": "person()" | kind=code-symbol | source=src/features/people/capacity-compare.test.ts:L21 | neighbors=[capacity-compare.test.ts]
- "people_capacity_hours_test_no_week": "NO_WEEK" | kind=code-symbol | source=src/features/people/capacity-hours.test.ts:L17 | neighbors=[capacity-hours.test.ts]
- "people_capacity_hours_test_part_time": "PART_TIME" | kind=code-symbol | source=src/features/people/capacity-hours.test.ts:L12 | neighbors=[capacity-hours.test.ts]
- "people_card_actions_input": "input" | kind=code-symbol | source=src/features/people/card-actions.ts:L46 | neighbors=[card-actions.ts]
- "people_card_actions_personcardapp": "PersonCardApp" | kind=code-symbol | source=src/features/people/card-actions.ts:L26 | neighbors=[card-actions.ts]
- "people_cohort_filter_matchesquery": "matchesQuery()" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L93 | neighbors=[cohort-filter.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-152.json

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
