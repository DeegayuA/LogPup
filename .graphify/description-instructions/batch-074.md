# Node Description Batch 75 of 166

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

- "people_capacity_compare_comparecapacities": "compareCapacities()" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L45 | neighbors=[capacity-compare.ts, capacity-compare.test.ts, queries.ts]
- "people_capacity_compare_daysbetween": "daysBetween()" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L315 | neighbors=[capacity-compare.ts, overloadStretches(), capacity-compare.test.ts]
- "people_capacity_compare_hasmovement": "hasMovement()" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L82 | neighbors=[page.tsx, capacity-compare.ts, capacity-compare.test.ts]
- "people_capacity_compare_teamchangeentry": "TeamChangeEntry" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L170 | neighbors=[history-views.tsx, capacity-compare.ts, queries.ts]
- "people_capacity_hours_hoursforfraction": "hoursForFraction()" | kind=code-symbol | source=src/features/people/capacity-hours.ts:L41 | neighbors=[capacity-hours.ts, round1(), capacity-hours.test.ts]
- "people_cohort_filter_filtersortprojects": "filterSortProjects()" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L107 | neighbors=[cohort-views.tsx, cohort-filter.ts, cohort-filter.test.ts]
- "people_cohort_filter_hasactiveprojectfilters": "hasActiveProjectFilters()" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L143 | neighbors=[cohort-views.tsx, cohort-filter.ts, cohort-filter.test.ts]
- "people_cohort_filter_project_sorts": "PROJECT_SORTS" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L28 | neighbors=[cohort-views.tsx, cohort-filter.ts, cohort-params.ts]
- "people_cohort_filter_role_filters": "ROLE_FILTERS" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L47 | neighbors=[cohort-views.tsx, cohort-filter.ts, cohort-params.ts]
- "people_cohort_filter_staff_filters": "STAFF_FILTERS" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L38 | neighbors=[cohort-views.tsx, cohort-filter.ts, cohort-params.ts]
- "people_cohort_params_cohort_view_hint": "COHORT_VIEW_HINT" | kind=code-symbol | source=src/features/people/cohort-params.ts:L37 | neighbors=[cohort-params.ts, commands.ts, page.tsx]
- "people_cohort_params_cohort_view_label": "COHORT_VIEW_LABEL" | kind=code-symbol | source=src/features/people/cohort-params.ts:L26 | neighbors=[cohort-nav.tsx, cohort-params.ts, commands.ts]
- "people_cohort_params_cohort_views": "COHORT_VIEWS" | kind=code-symbol | source=src/features/people/cohort-params.ts:L20 | neighbors=[cohort-nav.tsx, cohort-params.ts, commands.ts]
- "people_cohort_params_parsecohortparams": "parseCohortParams()" | kind=code-symbol | source=src/features/people/cohort-params.ts:L82 | neighbors=[cohort-params.ts, oneOf(), page.tsx]
- "people_cohort_params_peoplehref": "peopleHref()" | kind=code-symbol | source=src/features/people/cohort-params.ts:L97 | neighbors=[cohort-nav.tsx, cohort-views.tsx, cohort-params.ts]
- "people_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/people/error.tsx:L1 | neighbors=[PeopleError(), button.tsx, Button()]
- "people_followup_split_personfollowups": "PersonFollowups" | kind=code-symbol | source=src/features/people/followup-split.ts:L69 | neighbors=[person-followups-card.tsx, followup-split.ts, queries.ts]
- "people_followup_split_splitpersonfollowups": "splitPersonFollowups()" | kind=code-symbol | source=src/features/people/followup-split.ts:L122 | neighbors=[followup-split.ts, followup-split.test.ts, queries.ts]
- "people_format_instant_businesshourof": "businessHourOf()" | kind=code-symbol | source=src/features/people/format-instant.ts:L92 | neighbors=[page.tsx, format-instant.ts, partsOf()]
- "people_format_instant_formatbusinessweekdaylong": "formatBusinessWeekdayLong()" | kind=code-symbol | source=src/features/people/format-instant.ts:L77 | neighbors=[page.tsx, format-instant.ts, partsOf()]
- "people_handover_inventory_non_transferable": "NON_TRANSFERABLE" | kind=code-symbol | source=src/features/people/handover-inventory.ts:L29 | neighbors=[handover-inventory.ts, handover-inventory.test.ts, handover-queries.ts]
- "people_handover_inventory_splitallocation": "splitAllocation()" | kind=code-symbol | source=src/features/people/handover-inventory.ts:L67 | neighbors=[handover-actions.ts, handover-inventory.ts, handover-inventory.test.ts]
- "people_handover_inventory_transferablegroup": "TransferableGroup" | kind=code-symbol | source=src/features/people/handover-inventory.ts:L21 | neighbors=[handover-form.tsx, handover-inventory.ts, handover-queries.ts]
- "people_history_params_parsehistoryparams": "parseHistoryParams()" | kind=code-symbol | source=src/features/people/history-params.ts:L48 | neighbors=[page.tsx, history-params.ts, history-params.test.ts]
- "people_history_params_resolvehistorywindow": "resolveHistoryWindow()" | kind=code-symbol | source=src/features/people/history-params.ts:L73 | neighbors=[page.tsx, history-params.ts, history-params.test.ts]
- "people_history_stats_buildcapacityhistorystats": "buildCapacityHistoryStats()" | kind=code-symbol | source=src/features/people/history-stats.ts:L30 | neighbors=[page.tsx, history-stats.ts, formatDelta()]
- "people_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/people/loading.tsx:L1 | neighbors=[PeopleLoading(), skeleton.tsx, Skeleton()]
- "people_meeting_window_splitpersonmeetings": "splitPersonMeetings()" | kind=code-symbol | source=src/features/people/meeting-window.ts:L74 | neighbors=[meeting-window.ts, meeting-window.test.ts, queries.ts]
- "people_now_overduecount": "overdueCount()" | kind=code-symbol | source=src/features/people/now.ts:L112 | neighbors=[directory.tsx, now.ts, now.test.ts]
- "people_now_personnow": "PersonNow" | kind=code-symbol | source=src/features/people/now.ts:L45 | neighbors=[directory.tsx, now.ts, queries.ts]
- "people_now_recentsummary": "recentSummary()" | kind=code-symbol | source=src/features/people/now.ts:L168 | neighbors=[directory.tsx, now.ts, now.test.ts]
- "people_now_sortnowtasks": "sortNowTasks()" | kind=code-symbol | source=src/features/people/now.ts:L74 | neighbors=[now.ts, nowHeadline(), now.test.ts]
- "people_person_stats_followupmeta": "followupMeta()" | kind=code-symbol | source=src/features/people/person-stats.ts:L155 | neighbors=[person-stats.ts, buildPersonStats(), plural()]
- "people_person_stats_plural": "plural()" | kind=code-symbol | source=src/features/people/person-stats.ts:L52 | neighbors=[person-stats.ts, buildPersonStats(), followupMeta()]
- "people_person_stats_stattone": "StatTone" | kind=code-symbol | source=src/features/people/person-stats.ts:L25 | neighbors=[dashboard-zones.tsx, person-stat-row.tsx, person-stats.ts]
- "people_queries_capacitybreakdownentry": "CapacityBreakdownEntry" | kind=code-symbol | source=src/features/people/queries.ts:L80 | neighbors=[capacity-heat-editable.tsx, cohorts.ts, queries.ts]
- "people_queries_getpersonoverview": "getPersonOverview" | kind=code-symbol | source=src/features/people/queries.ts:L749 | neighbors=[page.tsx, queries.ts, summary-actions.ts]
- "people_queries_teammember": "TeamMember" | kind=code-symbol | source=src/features/people/queries.ts:L66 | neighbors=[assign-dialog.tsx, team-panel.tsx, queries.ts]
- "people_removal_queries_accountremovederror": "AccountRemovedError" | kind=code-symbol | source=src/features/people/removal-queries.ts:L140 | neighbors=[actions.ts, auth.ts, removal-queries.ts]
- "people_removal_queries_isremoved": "isRemoved()" | kind=code-symbol | source=src/features/people/removal-queries.ts:L108 | neighbors=[webauthn-actions.ts, auth.ts, removal-queries.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-074.json

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
