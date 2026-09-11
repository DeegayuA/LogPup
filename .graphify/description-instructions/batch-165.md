# Node Description Batch 166 of 166

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

- "worklog_queries_worklogrow": "WorklogRow" | kind=code-symbol | source=src/features/worklog/queries.ts:L19 | neighbors=[queries.ts]
- "worklog_review_rules_reviewableapp": "ReviewableApp" | kind=code-symbol | source=src/features/worklog/review-rules.ts:L38 | neighbors=[review-rules.ts]
- "worklog_review_rules_reviewsubject": "ReviewSubject" | kind=code-symbol | source=src/features/worklog/review-rules.ts:L59 | neighbors=[review-rules.ts]
- "worklog_review_rules_test_actor": "actor()" | kind=code-symbol | source=src/features/worklog/review-rules.test.ts:L12 | neighbors=[review-rules.test.ts]
- "worklog_review_rules_test_apps": "APPS" | kind=code-symbol | source=src/features/worklog/review-rules.test.ts:L7 | neighbors=[review-rules.test.ts]
- "worklog_schedule_actions_fraction": "fraction" | kind=code-symbol | source=src/features/worklog/schedule-actions.ts:L12 | neighbors=[schedule-actions.ts]
- "worklog_schedule_actions_patterninput": "patternInput" | kind=code-symbol | source=src/features/worklog/schedule-actions.ts:L13 | neighbors=[schedule-actions.ts]
- "worklog_schedule_actions_setinput": "setInput" | kind=code-symbol | source=src/features/worklog/schedule-actions.ts:L18 | neighbors=[schedule-actions.ts]
- "worklog_schedule_actions_setworkschedule": "setWorkSchedule()" | kind=code-symbol | source=src/features/worklog/schedule-actions.ts:L32 | neighbors=[schedule-actions.ts]
- "worklog_schedules_daterange": "DateRange" | kind=code-symbol | source=src/features/worklog/schedules.ts:L77 | neighbors=[schedules.ts]
- "worklog_schedules_test_row": "row()" | kind=code-symbol | source=src/features/worklog/schedules.test.ts:L4 | neighbors=[schedules.test.ts]
- "drizzle_0003_user_invites": "0003_user-invites.sql" | kind=code-symbol | source=drizzle/0003_user-invites.sql:L1
- "drizzle_0004_user_phone": "0004_user-phone.sql" | kind=code-symbol | source=drizzle/0004_user-phone.sql:L1
- "drizzle_0006_user_status": "0006_user-status.sql" | kind=code-symbol | source=drizzle/0006_user-status.sql:L1
- "drizzle_0008_task_due_date": "0008_task-due-date.sql" | kind=code-symbol | source=drizzle/0008_task-due-date.sql:L1
- "drizzle_0010_followup_resolution_note": "0010_followup-resolution-note.sql" | kind=code-symbol | source=drizzle/0010_followup-resolution-note.sql:L1
- "drizzle_0012_meeting_link_rsvp": "0012_meeting_link_rsvp.sql" | kind=code-symbol | source=drizzle/0012_meeting_link_rsvp.sql:L1
- "drizzle_0016_assignment_history_one_open": "0016_assignment_history_one_open.sql" | kind=code-symbol | source=drizzle/0016_assignment_history_one_open.sql:L1
- "drizzle_0019_user_personal_email": "0019_user-personal-email.sql" | kind=code-symbol | source=drizzle/0019_user-personal-email.sql:L1
- "drizzle_0020_task_rank": "0020_task_rank.sql" | kind=code-symbol | source=drizzle/0020_task_rank.sql:L1
- "drizzle_0026_meeting_speaker_display_name": "0026_meeting_speaker_display_name.sql" | kind=code-symbol | source=drizzle/0026_meeting_speaker_display_name.sql:L1
- "drizzle_0027_soft_delete": "0027_soft_delete.sql" | kind=code-symbol | source=drizzle/0027_soft_delete.sql:L1
- "drizzle_0030_sprint_sort_order": "0030_sprint_sort_order.sql" | kind=code-symbol | source=drizzle/0030_sprint_sort_order.sql:L1
- "drizzle_0037_user_role_expand": "0037_user_role_expand.sql" | kind=code-symbol | source=drizzle/0037_user_role_expand.sql:L1
- "drizzle_0039_admin_to_superadmin": "0039_admin_to_superadmin.sql" | kind=code-symbol | source=drizzle/0039_admin_to_superadmin.sql:L1
- "drizzle_0044_ai_pref_model": "0044_ai_pref_model.sql" | kind=code-symbol | source=drizzle/0044_ai_pref_model.sql:L1
- "drizzle_config": "drizzle.config.ts" | kind=code-symbol | source=drizzle.config.ts:L1
- "vitest_config": "vitest.config.ts" | kind=code-symbol | source=vitest.config.ts:L1

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-165.json

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
