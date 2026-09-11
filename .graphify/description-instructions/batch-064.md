# Node Description Batch 65 of 166

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

- "drizzle_0032_webauthn": "0032_webauthn.sql" | kind=code-symbol | source=drizzle/0032_webauthn.sql:L1 | neighbors=[public.users, webauthn_credentials, webauthn_login_tokens]
- "drizzle_0032_webauthn_public_users": "public.users" | kind=code-symbol | source=drizzle/0032_webauthn.sql:L16 | neighbors=[0032_webauthn.sql, webauthn_credentials, webauthn_login_tokens]
- "drizzle_0034_app_role_history": "0034_app_role_history.sql" | kind=code-symbol | source=drizzle/0034_app_role_history.sql:L1 | neighbors=[app_role_history, public.apps, public.users]
- "drizzle_0034_app_role_history_app_role_history": "app_role_history" | kind=code-symbol | source=drizzle/0034_app_role_history.sql:L23 | neighbors=[0034_app_role_history.sql, public.apps, public.users]
- "drizzle_0035_ai_usage_events": "0035_ai_usage_events.sql" | kind=code-symbol | source=drizzle/0035_ai_usage_events.sql:L1 | neighbors=[ai_usage_events, gemini_keys, users]
- "drizzle_0035_ai_usage_events_ai_usage_events": "ai_usage_events" | kind=code-symbol | source=drizzle/0035_ai_usage_events.sql:L1 | neighbors=[0035_ai_usage_events.sql, gemini_keys, users]
- "drizzle_0038_rbac_tables_app_grants": "app_grants" | kind=code-symbol | source=drizzle/0038_rbac_tables.sql:L94 | neighbors=[0038_rbac_tables.sql, public.apps, public.users]
- "drizzle_0038_rbac_tables_change_requests": "change_requests" | kind=code-symbol | source=drizzle/0038_rbac_tables.sql:L29 | neighbors=[0038_rbac_tables.sql, public.apps, public.users]
- "drizzle_0038_rbac_tables_public_apps": "public.apps" | kind=code-symbol | source=drizzle/0038_rbac_tables.sql:L112 | neighbors=[0038_rbac_tables.sql, app_grants, change_requests]
- "drizzle_0040_meeting_apps": "0040_meeting_apps.sql" | kind=code-symbol | source=drizzle/0040_meeting_apps.sql:L1 | neighbors=[meeting_apps, public.apps, public.meetings]
- "drizzle_0040_meeting_apps_meeting_apps": "meeting_apps" | kind=code-symbol | source=drizzle/0040_meeting_apps.sql:L28 | neighbors=[0040_meeting_apps.sql, public.apps, public.meetings]
- "drizzle_0047_worklog_entries_worklog_entries": "worklog_entries" | kind=code-symbol | source=drizzle/0047_worklog_entries.sql:L38 | neighbors=[0047_worklog_entries.sql, public.tasks, public.users]
- "drizzle_0048_project_finance_project_value": "project_value" | kind=code-symbol | source=drizzle/0048_project_finance.sql:L77 | neighbors=[0048_project_finance.sql, public.apps, public.users]
- "drizzle_0050_worklog_entry_app": "0050_worklog_entry_app.sql" | kind=code-symbol | source=drizzle/0050_worklog_entry_app.sql:L1 | neighbors=[53ae2f3 feat(worklog): attribute hours …, public.apps, worklog_entries]
- "drizzle_0052_maintenance_window": "0052_maintenance_window.sql" | kind=code-symbol | source=drizzle/0052_maintenance_window.sql:L1 | neighbors=[8bacbca ., maintenance_window, public.users]
- "drizzle_0054_meeting_load_decisions": "0054_meeting_load_decisions.sql" | kind=code-symbol | source=drizzle/0054_meeting_load_decisions.sql:L1 | neighbors=[272f9a7 feat(meetings): store the decis…, meeting_load_decisions, public.users]
- "drizzle_0056_recurring_meetings_meeting_series": "meeting_series" | kind=code-symbol | source=drizzle/0056_recurring_meetings.sql:L14 | neighbors=[0056_recurring_meetings.sql, public.apps, public.users]
- "drizzle_0056_recurring_meetings_meeting_series_attendees": "meeting_series_attendees" | kind=code-symbol | source=drizzle/0056_recurring_meetings.sql:L38 | neighbors=[0056_recurring_meetings.sql, public.meeting_series, public.users]
- "drizzle_0056_recurring_meetings_public_meeting_series": "public.meeting_series" | kind=code-symbol | source=drizzle/0056_recurring_meetings.sql:L62 | neighbors=[0056_recurring_meetings.sql, meeting_series_attendees, meetings]
- "drizzle_0056_recurring_meetings_public_users": "public.users" | kind=code-symbol | source=drizzle/0056_recurring_meetings.sql:L50 | neighbors=[0056_recurring_meetings.sql, meeting_series, meeting_series_attendees]
- "drizzle_0058_worklog_reviews": "0058_worklog_reviews.sql" | kind=code-symbol | source=drizzle/0058_worklog_reviews.sql:L1 | neighbors=[0caca2e feat(worklog): who may review s…, users, worklog_reviews]
- "drizzle_0060_meeting_recordings_meeting_recordings": "meeting_recordings" | kind=code-symbol | source=drizzle/0060_meeting_recordings.sql:L18 | neighbors=[0060_meeting_recordings.sql, meetings, users]
- "drizzle_0061_mentions": "0061_mentions.sql" | kind=code-symbol | source=drizzle/0061_mentions.sql:L1 | neighbors=[8c996d9 feat(notifications): a mention …, mentions, public.users]
- "drizzle_0064_task_assignees_task_assignees": "task_assignees" | kind=code-symbol | source=drizzle/0064_task_assignees.sql:L12 | neighbors=[0064_task_assignees.sql, public.tasks, public.users]
- "e2e_seed": "seed.ts" | kind=code-symbol | source=e2e/seed.ts:L1 | neighbors=[env.ts, seed-user.ts, seedDevUser()]
- "e2e_seed_user_seeddevuser": "seedDevUser()" | kind=code-symbol | source=e2e/seed-user.ts:L21 | neighbors=[auth.setup.ts, seed.ts, seed-user.ts]
- "e2e_soft_delete_spec_expandpastmeetingsifcollapsed": "expandPastMeetingsIfCollapsed()" | kind=code-symbol | source=e2e/soft-delete.spec.ts:L64 | neighbors=[soft-delete.spec.ts, createMeeting(), deleteMeetingViaList()]
- "e2e_soft_delete_spec_todayat": "todayAt()" | kind=code-symbol | source=e2e/soft-delete.spec.ts:L41 | neighbors=[soft-delete.spec.ts, createMeeting(), todayISODate()]
- "finance_cost_costbreakdown": "CostBreakdown" | kind=code-symbol | source=src/features/finance/cost.ts:L178 | neighbors=[project-finance-card.tsx, cost.ts, queries.ts]
- "finance_cost_costforproject": "costForProject()" | kind=code-symbol | source=src/features/finance/cost.ts:L314 | neighbors=[cost.ts, costForEntries(), queries.ts]
- "finance_cost_coveringrate": "coveringRate()" | kind=code-symbol | source=src/features/finance/cost.ts:L112 | neighbors=[cost.ts, toAmount(), rateForPersonOnDay()]
- "finance_cost_daysinmonth": "daysInMonth()" | kind=code-symbol | source=src/features/finance/cost.ts:L360 | neighbors=[cost.ts, addMonthsIso(), isLeapYear()]
- "finance_cost_effortmix": "EffortMix" | kind=code-symbol | source=src/features/finance/cost.ts:L481 | neighbors=[cost.ts, cost.test.ts, queries.ts]
- "finance_cost_personrate": "PersonRate" | kind=code-symbol | source=src/features/finance/cost.ts:L60 | neighbors=[cost.ts, cost.test.ts, queries.ts]
- "finance_cost_rolerate": "RoleRate" | kind=code-symbol | source=src/features/finance/cost.ts:L50 | neighbors=[cost.ts, cost.test.ts, queries.ts]
- "finance_queries_costfigurefor": "costFigureFor()" | kind=code-symbol | source=src/features/finance/queries.ts:L173 | neighbors=[queries.ts, projectCost(), projectMargin()]
- "finance_queries_loadtaskentriesforapp": "loadTaskEntriesForApp()" | kind=code-symbol | source=src/features/finance/queries.ts:L134 | neighbors=[queries.ts, projectCost(), projectMargin()]
- "gemini_ai_features_aicallslug": "AiCallSlug" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L9 | neighbors=[ai-features.ts, client.ts, usage.ts]
- "gemini_ai_features_aifeatureestimate": "AiFeatureEstimate" | kind=code-symbol | source=src/features/gemini/ai-features.ts:L53 | neighbors=[ai-features-card.tsx, ai-features.ts, ai-features.test.ts]
- "gemini_audio_strategy": "audio-strategy.ts" | kind=code-symbol | source=src/features/gemini/audio-strategy.ts:L1 | neighbors=[shouldUseInlineAudio(), audio-strategy.test.ts, client.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-064.json

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
