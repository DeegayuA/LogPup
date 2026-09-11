# Node Description Batch 95 of 166

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

- "drizzle_0041_employment_and_logging": "0041_employment_and_logging.sql" | kind=code-symbol | source=drizzle/0041_employment_and_logging.sql:L1 | neighbors=[public.users, users]
- "drizzle_0041_employment_and_logging_public_users": "public.users" | kind=code-symbol | source=drizzle/0041_employment_and_logging.sql:L27 | neighbors=[0041_employment_and_logging.sql, users]
- "drizzle_0041_employment_and_logging_users": "users" | kind=code-symbol | source=drizzle/0041_employment_and_logging.sql:L27 | neighbors=[0041_employment_and_logging.sql, public.users]
- "drizzle_0042_org_holiday_revoke": "0042_org_holiday_revoke.sql" | kind=code-symbol | source=drizzle/0042_org_holiday_revoke.sql:L1 | neighbors=[org_holidays, public.users]
- "drizzle_0042_org_holiday_revoke_org_holidays": "org_holidays" | kind=code-symbol | source=drizzle/0042_org_holiday_revoke.sql:L16 | neighbors=[0042_org_holiday_revoke.sql, public.users]
- "drizzle_0042_org_holiday_revoke_public_users": "public.users" | kind=code-symbol | source=drizzle/0042_org_holiday_revoke.sql:L16 | neighbors=[0042_org_holiday_revoke.sql, org_holidays]
- "drizzle_0043_app_soft_delete": "0043_app_soft_delete.sql" | kind=code-symbol | source=drizzle/0043_app_soft_delete.sql:L1 | neighbors=[apps, public.users]
- "drizzle_0043_app_soft_delete_apps": "apps" | kind=code-symbol | source=drizzle/0043_app_soft_delete.sql:L20 | neighbors=[0043_app_soft_delete.sql, public.users]
- "drizzle_0043_app_soft_delete_public_users": "public.users" | kind=code-symbol | source=drizzle/0043_app_soft_delete.sql:L20 | neighbors=[0043_app_soft_delete.sql, apps]
- "drizzle_0045_bug_reports_public_apps": "public.apps" | kind=code-symbol | source=drizzle/0045_bug_reports.sql:L42 | neighbors=[0045_bug_reports.sql, bug_reports]
- "drizzle_0045_bug_reports_public_tasks": "public.tasks" | kind=code-symbol | source=drizzle/0045_bug_reports.sql:L54 | neighbors=[0045_bug_reports.sql, bug_reports]
- "drizzle_0045_bug_reports_public_users": "public.users" | kind=code-symbol | source=drizzle/0045_bug_reports.sql:L46 | neighbors=[0045_bug_reports.sql, bug_reports]
- "drizzle_0046_user_deletions": "0046_user_deletions.sql" | kind=code-symbol | source=drizzle/0046_user_deletions.sql:L1 | neighbors=[public.users, user_deletions]
- "drizzle_0046_user_deletions_public_users": "public.users" | kind=code-symbol | source=drizzle/0046_user_deletions.sql:L32 | neighbors=[0046_user_deletions.sql, user_deletions]
- "drizzle_0046_user_deletions_user_deletions": "user_deletions" | kind=code-symbol | source=drizzle/0046_user_deletions.sql:L21 | neighbors=[0046_user_deletions.sql, public.users]
- "drizzle_0047_worklog_entries_public_tasks": "public.tasks" | kind=code-symbol | source=drizzle/0047_worklog_entries.sql:L61 | neighbors=[0047_worklog_entries.sql, worklog_entries]
- "drizzle_0047_worklog_entries_public_users": "public.users" | kind=code-symbol | source=drizzle/0047_worklog_entries.sql:L54 | neighbors=[0047_worklog_entries.sql, worklog_entries]
- "drizzle_0048_project_finance_person_rates": "person_rates" | kind=code-symbol | source=drizzle/0048_project_finance.sql:L51 | neighbors=[0048_project_finance.sql, public.users]
- "drizzle_0048_project_finance_public_apps": "public.apps" | kind=code-symbol | source=drizzle/0048_project_finance.sql:L106 | neighbors=[0048_project_finance.sql, project_value]
- "drizzle_0048_project_finance_rate_cards": "rate_cards" | kind=code-symbol | source=drizzle/0048_project_finance.sql:L31 | neighbors=[0048_project_finance.sql, public.users]
- "drizzle_0050_worklog_entry_app_public_apps": "public.apps" | kind=code-symbol | source=drizzle/0050_worklog_entry_app.sql:L21 | neighbors=[0050_worklog_entry_app.sql, worklog_entries]
- "drizzle_0050_worklog_entry_app_worklog_entries": "worklog_entries" | kind=code-symbol | source=drizzle/0050_worklog_entry_app.sql:L21 | neighbors=[0050_worklog_entry_app.sql, public.apps]
- "drizzle_0052_maintenance_window_maintenance_window": "maintenance_window" | kind=code-symbol | source=drizzle/0052_maintenance_window.sql:L19 | neighbors=[0052_maintenance_window.sql, public.users]
- "drizzle_0052_maintenance_window_public_users": "public.users" | kind=code-symbol | source=drizzle/0052_maintenance_window.sql:L35 | neighbors=[0052_maintenance_window.sql, maintenance_window]
- "drizzle_0054_meeting_load_decisions_meeting_load_decisions": "meeting_load_decisions" | kind=code-symbol | source=drizzle/0054_meeting_load_decisions.sql:L36 | neighbors=[0054_meeting_load_decisions.sql, public.users]
- "drizzle_0054_meeting_load_decisions_public_users": "public.users" | kind=code-symbol | source=drizzle/0054_meeting_load_decisions.sql:L47 | neighbors=[0054_meeting_load_decisions.sql, meeting_load_decisions]
- "drizzle_0056_recurring_meetings_meetings": "meetings" | kind=code-symbol | source=drizzle/0056_recurring_meetings.sql:L69 | neighbors=[0056_recurring_meetings.sql, public.meeting_series]
- "drizzle_0056_recurring_meetings_public_apps": "public.apps" | kind=code-symbol | source=drizzle/0056_recurring_meetings.sql:L46 | neighbors=[0056_recurring_meetings.sql, meeting_series]
- "drizzle_0058_worklog_reviews_users": "users" | kind=code-symbol | source=drizzle/0058_worklog_reviews.sql:L21 | neighbors=[0058_worklog_reviews.sql, worklog_reviews]
- "drizzle_0058_worklog_reviews_worklog_reviews": "worklog_reviews" | kind=code-symbol | source=drizzle/0058_worklog_reviews.sql:L19 | neighbors=[0058_worklog_reviews.sql, users]
- "drizzle_0060_meeting_recordings_meetings": "meetings" | kind=code-symbol | source=drizzle/0060_meeting_recordings.sql:L20 | neighbors=[0060_meeting_recordings.sql, meeting_recordings]
- "drizzle_0060_meeting_recordings_users": "users" | kind=code-symbol | source=drizzle/0060_meeting_recordings.sql:L25 | neighbors=[0060_meeting_recordings.sql, meeting_recordings]
- "drizzle_0061_mentions_mentions": "mentions" | kind=code-symbol | source=drizzle/0061_mentions.sql:L7 | neighbors=[0061_mentions.sql, public.users]
- "drizzle_0061_mentions_public_users": "public.users" | kind=code-symbol | source=drizzle/0061_mentions.sql:L40 | neighbors=[0061_mentions.sql, mentions]
- "drizzle_0064_task_assignees_public_tasks": "public.tasks" | kind=code-symbol | source=drizzle/0064_task_assignees.sql:L25 | neighbors=[0064_task_assignees.sql, task_assignees]
- "drizzle_0064_task_assignees_public_users": "public.users" | kind=code-symbol | source=drizzle/0064_task_assignees.sql:L29 | neighbors=[0064_task_assignees.sql, task_assignees]
- "e2e_soft_delete_spec_deletemeetingvialist": "deleteMeetingViaList()" | kind=code-symbol | source=e2e/soft-delete.spec.ts:L104 | neighbors=[soft-delete.spec.ts, expandPastMeetingsIfCollapsed()]
- "e2e_soft_delete_spec_fillmeetingdatetime": "fillMeetingDateTime()" | kind=code-symbol | source=e2e/soft-delete.spec.ts:L52 | neighbors=[soft-delete.spec.ts, createMeeting()]
- "e2e_soft_delete_spec_todayisodate": "todayISODate()" | kind=code-symbol | source=e2e/soft-delete.spec.ts:L33 | neighbors=[soft-delete.spec.ts, todayAt()]
- "finance_cost_isleapyear": "isLeapYear()" | kind=code-symbol | source=src/features/finance/cost.ts:L354 | neighbors=[cost.ts, daysInMonth()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-094.json

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
