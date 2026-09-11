# Node Description Batch 106 of 166

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

- "notify_tick_route_isauthorized": "isAuthorized()" | kind=code-symbol | source=src/app/api/cron/notify-tick/route.ts:L73 | neighbors=[route.ts, GET()]
- "notify_tick_route_nudgeunloggeddays": "nudgeUnloggedDays()" | kind=code-symbol | source=src/app/api/cron/notify-tick/route.ts:L176 | neighbors=[route.ts, GET()]
- "notify_tick_route_pruneexpirednotifications": "pruneExpiredNotifications()" | kind=code-symbol | source=src/app/api/cron/notify-tick/route.ts:L118 | neighbors=[route.ts, GET()]
- "notion_actions_columnitems": "columnItems()" | kind=code-symbol | source=src/features/notion/actions.ts:L17 | neighbors=[actions.ts, buildExportData()]
- "notion_export_notion": "notion()" | kind=code-symbol | source=src/features/notion/export.ts:L4 | neighbors=[export.ts, upsertSprintPage()]
- "onboarding_actions_submitonboarding": "submitOnboarding()" | kind=code-symbol | source=src/features/onboarding/actions.ts:L21 | neighbors=[onboarding-form.tsx, actions.ts]
- "onboarding_schema_test": "schema.test.ts" | kind=code-symbol | source=src/features/onboarding/schema.test.ts:L1 | neighbors=[schema.ts, onboardingInput]
- "people_actions_isuniqueviolation": "isUniqueViolation()" | kind=code-symbol | source=src/features/people/actions.ts:L41 | neighbors=[actions.ts, assignUser()]
- "people_allocation_history_historyinterval": "HistoryInterval" | kind=code-symbol | source=src/features/people/allocation-history.ts:L6 | neighbors=[attendance-history.ts, allocation-history.ts]
- "people_allocation_history_timelinerow": "TimelineRow" | kind=code-symbol | source=src/features/people/allocation-history.ts:L143 | neighbors=[allocation-history.ts, capacity-compare.ts]
- "people_allocation_test": "allocation.test.ts" | kind=code-symbol | source=src/features/people/allocation.test.ts:L1 | neighbors=[allocation.ts, summarizeAllocations()]
- "people_as_of_date_resolvedasof": "ResolvedAsOf" | kind=code-symbol | source=src/features/people/as-of-date.ts:L24 | neighbors=[as-of-date.ts, history-params.ts]
- "people_capacity_compare_annotateteamchanges": "annotateTeamChanges()" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L186 | neighbors=[capacity-compare.ts, queries.ts]
- "people_capacity_compare_totalsat": "totalsAt()" | kind=code-symbol | source=src/features/people/capacity-compare.ts:L294 | neighbors=[capacity-compare.ts, overloadStretches()]
- "people_card_actions_getpersoncard": "getPersonCard()" | kind=code-symbol | source=src/features/people/card-actions.ts:L48 | neighbors=[person-hover-card.tsx, card-actions.ts]
- "people_card_actions_personcard": "PersonCard" | kind=code-symbol | source=src/features/people/card-actions.ts:L34 | neighbors=[person-hover-card.tsx, card-actions.ts]
- "people_cohort_filter_filterableproject": "FilterableProject" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L16 | neighbors=[cohort-filter.ts, cohort-filter.test.ts]
- "people_cohort_filter_matchesrole": "matchesRole()" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L74 | neighbors=[cohort-filter.ts, tones()]
- "people_cohort_filter_project_sort_label": "PROJECT_SORT_LABEL" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L31 | neighbors=[cohort-views.tsx, cohort-filter.ts]
- "people_cohort_filter_projectfilters": "ProjectFilters" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L58 | neighbors=[cohort-filter.ts, cohort-filter.test.ts]
- "people_cohort_filter_projectload": "projectLoad()" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L66 | neighbors=[cohort-filter.ts, cohort-filter.test.ts]
- "people_cohort_filter_projectsort": "ProjectSort" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L29 | neighbors=[cohort-filter.ts, cohort-params.ts]
- "people_cohort_filter_role_filter_label": "ROLE_FILTER_LABEL" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L50 | neighbors=[cohort-views.tsx, cohort-filter.ts]
- "people_cohort_filter_rolefilter": "RoleFilter" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L48 | neighbors=[cohort-filter.ts, cohort-params.ts]
- "people_cohort_filter_staff_filter_label": "STAFF_FILTER_LABEL" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L41 | neighbors=[cohort-views.tsx, cohort-filter.ts]
- "people_cohort_filter_stafffilter": "StaffFilter" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L39 | neighbors=[cohort-filter.ts, cohort-params.ts]
- "people_cohort_filter_tones": "tones()" | kind=code-symbol | source=src/features/people/cohort-filter.ts:L70 | neighbors=[cohort-filter.ts, matchesRole()]
- "people_cohort_params_oneof": "oneOf()" | kind=code-symbol | source=src/features/people/cohort-params.ts:L71 | neighbors=[cohort-params.ts, parseCohortParams()]
- "people_cohort_params_rawcohortparams": "RawCohortParams" | kind=code-symbol | source=src/features/people/cohort-params.ts:L56 | neighbors=[cohort-params.ts, page.tsx]
- "people_cohorts_buildoverlapreport": "buildOverlapReport()" | kind=code-symbol | source=src/features/people/cohorts.ts:L206 | neighbors=[cohorts.ts, page.tsx]
- "people_cohorts_buildprojectcohorts": "buildProjectCohorts()" | kind=code-symbol | source=src/features/people/cohorts.ts:L60 | neighbors=[cohorts.ts, page.tsx]
- "people_cohorts_buildsharedpeople": "buildSharedPeople()" | kind=code-symbol | source=src/features/people/cohorts.ts:L133 | neighbors=[cohorts.ts, page.tsx]
- "people_cohorts_cohortmember": "CohortMember" | kind=code-symbol | source=src/features/people/cohorts.ts:L24 | neighbors=[cohort-views.tsx, cohorts.ts]
- "people_cohorts_overlapreport": "OverlapReport" | kind=code-symbol | source=src/features/people/cohorts.ts:L201 | neighbors=[cohort-views.tsx, cohorts.ts]
- "people_cohorts_projectcohort": "ProjectCohort" | kind=code-symbol | source=src/features/people/cohorts.ts:L43 | neighbors=[cohort-views.tsx, cohorts.ts]
- "people_cohorts_sharedperson": "SharedPerson" | kind=code-symbol | source=src/features/people/cohorts.ts:L93 | neighbors=[cohort-views.tsx, cohorts.ts]
- "people_commands_commands": "commands" | kind=code-symbol | source=src/features/people/commands.ts:L48 | neighbors=[commands.ts, commands.ts]
- "people_followup_split_personfollowupitem": "PersonFollowupItem" | kind=code-symbol | source=src/features/people/followup-split.ts:L64 | neighbors=[person-followups-card.tsx, followup-split.ts]
- "people_followup_split_personfollowuprow": "PersonFollowupRow" | kind=code-symbol | source=src/features/people/followup-split.ts:L35 | neighbors=[followup-split.ts, followup-split.test.ts]
- "people_format_pct_test": "format-pct.test.ts" | kind=code-symbol | source=src/features/people/format-pct.test.ts:L1 | neighbors=[format-pct.ts, formatPct()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-105.json

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
