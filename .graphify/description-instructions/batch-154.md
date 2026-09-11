# Node Description Batch 155 of 166

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

- "people_queries_capacityhistoryoverview": "CapacityHistoryOverview" | kind=code-symbol | source=src/features/people/queries.ts:L353 | neighbors=[queries.ts]
- "people_queries_getteamcapacityasof": "getTeamCapacityAsOf()" | kind=code-symbol | source=src/features/people/queries.ts:L278 | neighbors=[queries.ts]
- "people_queries_lk_tz_sql": "LK_TZ_SQL" | kind=code-symbol | source=src/features/people/queries.ts:L655 | neighbors=[queries.ts]
- "people_queries_personallocationhistory": "PersonAllocationHistory" | kind=code-symbol | source=src/features/people/queries.ts:L531 | neighbors=[queries.ts]
- "people_queries_personfollowupsview": "PersonFollowupsView" | kind=code-symbol | source=src/features/people/queries.ts:L872 | neighbors=[queries.ts]
- "people_queries_personprofile": "PersonProfile" | kind=code-symbol | source=src/features/people/queries.ts:L142 | neighbors=[queries.ts]
- "people_queries_personworkload": "PersonWorkload" | kind=code-symbol | source=src/features/people/queries.ts:L802 | neighbors=[queries.ts]
- "people_queries_test_personworkloadbody": "personWorkloadBody()" | kind=code-symbol | source=src/features/people/queries.test.ts:L26 | neighbors=[queries.test.ts]
- "people_queries_test_source": "SOURCE" | kind=code-symbol | source=src/features/people/queries.test.ts:L23 | neighbors=[queries.test.ts]
- "people_removal_queries_openremoval": "OpenRemoval" | kind=code-symbol | source=src/features/people/removal-queries.ts:L59 | neighbors=[removal-queries.ts]
- "people_removal_queries_openremovalrow": "OpenRemovalRow" | kind=code-symbol | source=src/features/people/removal-queries.ts:L66 | neighbors=[removal-queries.ts]
- "people_removal_queries_qb": "qb" | kind=code-symbol | source=src/features/people/removal-queries.ts:L29 | neighbors=[removal-queries.ts]
- "people_removal_queries_test_dialect": "dialect" | kind=code-symbol | source=src/features/people/removal-queries.test.ts:L12 | neighbors=[removal-queries.test.ts]
- "people_removal_queries_test_sqlof": "sqlOf()" | kind=code-symbol | source=src/features/people/removal-queries.test.ts:L13 | neighbors=[removal-queries.test.ts]
- "people_summary_test_facts": "facts()" | kind=code-symbol | source=src/features/people/summary.test.ts:L9 | neighbors=[summary.test.ts]
- "people_task_workload_due_state_order": "DUE_STATE_ORDER" | kind=code-symbol | source=src/features/people/task-workload.ts:L59 | neighbors=[task-workload.ts]
- "people_task_workload_persontaskstatus": "PersonTaskStatus" | kind=code-symbol | source=src/features/people/task-workload.ts:L29 | neighbors=[task-workload.ts]
- "people_task_workload_taskbucket": "TaskBucket" | kind=code-symbol | source=src/features/people/task-workload.ts:L91 | neighbors=[task-workload.ts]
- "people_task_workload_test_task": "task()" | kind=code-symbol | source=src/features/people/task-workload.test.ts:L12 | neighbors=[task-workload.test.ts]
- "people_team_csv_teampositions": "TeamPositions" | kind=code-symbol | source=src/features/people/team-csv.ts:L54 | neighbors=[team-csv.ts]
- "people_team_csv_test_ama": "AMA" | kind=code-symbol | source=src/features/people/team-csv.test.ts:L15 | neighbors=[team-csv.test.ts]
- "people_team_csv_test_nobody": "NOBODY" | kind=code-symbol | source=src/features/people/team-csv.test.ts:L13 | neighbors=[team-csv.test.ts]
- "people_team_csv_test_nuwan": "NUWAN" | kind=code-symbol | source=src/features/people/team-csv.test.ts:L24 | neighbors=[team-csv.test.ts]
- "playwright_config": "playwright.config.ts" | kind=code-symbol | source=playwright.config.ts:L1 | neighbors=[authFile]
- "playwright_config_authfile": "authFile" | kind=code-symbol | source=playwright.config.ts:L8 | neighbors=[playwright.config.ts]
- "postcss_config": "postcss.config.mjs" | kind=code-symbol | source=postcss.config.mjs:L1 | neighbors=[config]
- "postcss_config_config": "config" | kind=code-symbol | source=postcss.config.mjs:L1 | neighbors=[postcss.config.mjs]
- "privacy_page_metadata": "metadata" | kind=code-symbol | source=src/app/(public)/privacy/page.tsx:L19 | neighbors=[page.tsx]
- "privacy_page_privacypolicypage": "PrivacyPolicyPage()" | kind=code-symbol | source=src/app/(public)/privacy/page.tsx:L41 | neighbors=[page.tsx]
- "privacy_page_sections": "SECTIONS" | kind=code-symbol | source=src/app/(public)/privacy/page.tsx:L27 | neighbors=[page.tsx]
- "probe_probe_lead": "lead" | kind=code-symbol | source=.probe/probe.ts:L7 | neighbors=[probe.ts]
- "probe_probe_q": "q" | kind=code-symbol | source=.probe/probe.ts:L10 | neighbors=[probe.ts]
- "probe_probe_qb": "qb" | kind=code-symbol | source=.probe/probe.ts:L6 | neighbors=[probe.ts]
- "profile_error_profileerror": "ProfileError()" | kind=code-symbol | source=src/app/(app)/profile/error.tsx:L18 | neighbors=[error.tsx]
- "profile_loading_profileloading": "ProfileLoading()" | kind=code-symbol | source=src/app/(app)/profile/loading.tsx:L13 | neighbors=[loading.tsx]
- "profile_page_metadata": "metadata" | kind=code-symbol | source=src/app/(app)/profile/page.tsx:L26 | neighbors=[page.tsx]
- "profile_page_profilepage": "ProfilePage()" | kind=code-symbol | source=src/app/(app)/profile/page.tsx:L38 | neighbors=[page.tsx]
- "progress_error_progresserror": "ProgressError()" | kind=code-symbol | source=src/app/(app)/progress/error.tsx:L13 | neighbors=[error.tsx]
- "progress_loading_progressloading": "ProgressLoading()" | kind=code-symbol | source=src/app/(app)/progress/loading.tsx:L10 | neighbors=[loading.tsx]
- "progress_page_appssection": "AppsSection()" | kind=code-symbol | source=src/app/(app)/progress/page.tsx:L215 | neighbors=[page.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-154.json

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
