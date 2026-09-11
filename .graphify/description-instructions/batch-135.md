# Node Description Batch 136 of 166

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

- "deadlines_import_actions_deadlineimportpreviewrow": "DeadlineImportPreviewRow" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L58 | neighbors=[import-actions.ts]
- "deadlines_import_actions_deadlineimportresult": "DeadlineImportResult" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L75 | neighbors=[import-actions.ts]
- "deadlines_import_actions_taskrow": "TaskRow" | kind=code-symbol | source=src/features/deadlines/import-actions.ts:L126 | neighbors=[import-actions.ts]
- "drizzle_0000_complete_adam_warlock_users": "users" | kind=code-symbol | source=drizzle/0000_complete_adam_warlock.sql:L69 | neighbors=[0000_complete_adam_warlock.sql]
- "drizzle_0049_deadline_grading": "0049_deadline_grading.sql" | kind=code-symbol | source=drizzle/0049_deadline_grading.sql:L1 | neighbors=[e282043 feat(deadlines): grade the date…]
- "drizzle_0051_calendar_hardening": "0051_calendar_hardening.sql" | kind=code-symbol | source=drizzle/0051_calendar_hardening.sql:L1 | neighbors=[2b1ac4a feat(calendar): the organiser i…]
- "drizzle_0053_notification_type_system": "0053_notification_type_system.sql" | kind=code-symbol | source=drizzle/0053_notification_type_system.sql:L1 | neighbors=[8bacbca .]
- "drizzle_0055_github_login": "0055_github_login.sql" | kind=code-symbol | source=drizzle/0055_github_login.sql:L1 | neighbors=[de4812e feat(github): commits become wo…]
- "drizzle_0057_work_substrate": "0057_work_substrate.sql" | kind=code-symbol | source=drizzle/0057_work_substrate.sql:L1 | neighbors=[7d54694 feat(db): the work substrate, a…]
- "drizzle_0059_usage_duration": "0059_usage_duration.sql" | kind=code-symbol | source=drizzle/0059_usage_duration.sql:L1 | neighbors=[ac3c551 fix(db): usage_duration takes s…]
- "drizzle_0062_meeting_visibility": "0062_meeting_visibility.sql" | kind=code-symbol | source=drizzle/0062_meeting_visibility.sql:L1 | neighbors=[514d33b feat(meetings): a meeting can b…]
- "drizzle_0063_ai_budget": "0063_ai_budget.sql" | kind=code-symbol | source=drizzle/0063_ai_budget.sql:L1 | neighbors=[59873cc feat(gemini): a monthly AI budg…]
- "drizzle_0066_next_meeting": "0066_next_meeting.sql" | kind=code-symbol | source=drizzle/0066_next_meeting.sql:L1 | neighbors=[abcd631 feat(db): a task can have sever…]
- "drizzle_0067_absence_casual": "0067_absence_casual.sql" | kind=code-symbol | source=drizzle/0067_absence_casual.sql:L1 | neighbors=[a4b271b Improve leave types and worklog…]
- "drizzle_0068_absence_kinds": "0068_absence_kinds.sql" | kind=code-symbol | source=drizzle/0068_absence_kinds.sql:L1 | neighbors=[c9a2906 Centralize absence kinds and ad…]
- "drizzle_0069_app_aliases": "0069_app_aliases.sql" | kind=code-symbol | source=drizzle/0069_app_aliases.sql:L1 | neighbors=[9f936b5 Add app aliases and auto-scored…]
- "drizzle_0070_worklog_score_source": "0070_worklog_score_source.sql" | kind=code-symbol | source=drizzle/0070_worklog_score_source.sql:L1 | neighbors=[9f936b5 Add app aliases and auto-scored…]
- "e2e_auth_setup_authfile": "authFile" | kind=code-symbol | source=e2e/auth.setup.ts:L11 | neighbors=[auth.setup.ts]
- "e2e_auth_setup_escapeforregexp": "escapeForRegExp()" | kind=code-symbol | source=e2e/auth.setup.ts:L14 | neighbors=[auth.setup.ts]
- "e2e_env_loadenvfile": "loadEnvFile()" | kind=code-symbol | source=e2e/env.ts:L16 | neighbors=[env.ts]
- "e2e_env_reporoot": "repoRoot" | kind=code-symbol | source=e2e/env.ts:L36 | neighbors=[env.ts]
- "e2e_meeting_load_spec_app_slug": "APP_SLUG" | kind=code-symbol | source=e2e/meeting-load.spec.ts:L30 | neighbors=[meeting-load.spec.ts]
- "e2e_meeting_load_spec_decidedkeys": "decidedKeys" | kind=code-symbol | source=e2e/meeting-load.spec.ts:L40 | neighbors=[meeting-load.spec.ts]
- "e2e_meeting_load_spec_meetingids": "meetingIds" | kind=code-symbol | source=e2e/meeting-load.spec.ts:L36 | neighbors=[meeting-load.spec.ts]
- "e2e_meeting_load_spec_run_id": "RUN_ID" | kind=code-symbol | source=e2e/meeting-load.spec.ts:L28 | neighbors=[meeting-load.spec.ts]
- "e2e_seed_user_seedresult": "SeedResult" | kind=code-symbol | source=e2e/seed-user.ts:L11 | neighbors=[seed-user.ts]
- "e2e_smoke_spec_app_slug": "APP_SLUG" | kind=code-symbol | source=e2e/smoke.spec.ts:L17 | neighbors=[smoke.spec.ts]
- "e2e_smoke_spec_dragtaskto": "dragTaskTo()" | kind=code-symbol | source=e2e/smoke.spec.ts:L33 | neighbors=[smoke.spec.ts]
- "e2e_smoke_spec_run_id": "RUN_ID" | kind=code-symbol | source=e2e/smoke.spec.ts:L15 | neighbors=[smoke.spec.ts]
- "e2e_smoke_spec_todayisodate": "todayISODate()" | kind=code-symbol | source=e2e/smoke.spec.ts:L22 | neighbors=[smoke.spec.ts]
- "e2e_soft_delete_spec_all_meeting_titles": "ALL_MEETING_TITLES" | kind=code-symbol | source=e2e/soft-delete.spec.ts:L27 | neighbors=[soft-delete.spec.ts]
- "e2e_soft_delete_spec_app_slug": "APP_SLUG" | kind=code-symbol | source=e2e/soft-delete.spec.ts:L19 | neighbors=[soft-delete.spec.ts]
- "e2e_soft_delete_spec_run_id": "RUN_ID" | kind=code-symbol | source=e2e/soft-delete.spec.ts:L17 | neighbors=[soft-delete.spec.ts]
- "e2e_soft_delete_spec_trashrow": "trashRow()" | kind=code-symbol | source=e2e/soft-delete.spec.ts:L117 | neighbors=[soft-delete.spec.ts]
- "eslint_config": "eslint.config.mjs" | kind=code-symbol | source=eslint.config.mjs:L1 | neighbors=[eslintConfig]
- "eslint_config_eslintconfig": "eslintConfig" | kind=code-symbol | source=eslint.config.mjs:L5 | neighbors=[eslint.config.mjs]
- "finance_cost_costableattributedentry": "CostableAttributedEntry" | kind=code-symbol | source=src/features/finance/cost.ts:L278 | neighbors=[cost.ts]
- "finance_cost_costableentry": "CostableEntry" | kind=code-symbol | source=src/features/finance/cost.ts:L168 | neighbors=[cost.ts]
- "finance_cost_effortshare": "EffortShare" | kind=code-symbol | source=src/features/finance/cost.ts:L474 | neighbors=[cost.ts]
- "finance_cost_month_lengths": "MONTH_LENGTHS" | kind=code-symbol | source=src/features/finance/cost.ts:L358 | neighbors=[cost.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-135.json

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
