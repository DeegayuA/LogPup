# Node Description Batch 94 of 166

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

- "drizzle_0021_activity_log": "0021_activity_log.sql" | kind=code-symbol | source=drizzle/0021_activity_log.sql:L1 | neighbors=[activity_log, public.users]
- "drizzle_0021_activity_log_activity_log": "activity_log" | kind=code-symbol | source=drizzle/0021_activity_log.sql:L4 | neighbors=[0021_activity_log.sql, public.users]
- "drizzle_0021_activity_log_public_users": "public.users" | kind=code-symbol | source=drizzle/0021_activity_log.sql:L20 | neighbors=[0021_activity_log.sql, activity_log]
- "drizzle_0022_meeting_task_auto_assign": "0022_meeting_task_auto_assign.sql" | kind=code-symbol | source=drizzle/0022_meeting_task_auto_assign.sql:L1 | neighbors=[meeting_ai_notes, public.users]
- "drizzle_0022_meeting_task_auto_assign_meeting_ai_notes": "meeting_ai_notes" | kind=code-symbol | source=drizzle/0022_meeting_task_auto_assign.sql:L6 | neighbors=[0022_meeting_task_auto_assign.sql, public.users]
- "drizzle_0022_meeting_task_auto_assign_public_users": "public.users" | kind=code-symbol | source=drizzle/0022_meeting_task_auto_assign.sql:L6 | neighbors=[0022_meeting_task_auto_assign.sql, meeting_ai_notes]
- "drizzle_0023_sprint_checkins_public_sprints": "public.sprints" | kind=code-symbol | source=drizzle/0023_sprint_checkins.sql:L16 | neighbors=[0023_sprint_checkins.sql, sprint_checkins]
- "drizzle_0023_sprint_checkins_public_users": "public.users" | kind=code-symbol | source=drizzle/0023_sprint_checkins.sql:L21 | neighbors=[0023_sprint_checkins.sql, sprint_checkins]
- "drizzle_0024_meeting_followup_task_link": "0024_meeting_followup_task_link.sql" | kind=code-symbol | source=drizzle/0024_meeting_followup_task_link.sql:L1 | neighbors=[meeting_followups, public.tasks]
- "drizzle_0024_meeting_followup_task_link_meeting_followups": "meeting_followups" | kind=code-symbol | source=drizzle/0024_meeting_followup_task_link.sql:L5 | neighbors=[0024_meeting_followup_task_link.sql, public.tasks]
- "drizzle_0024_meeting_followup_task_link_public_tasks": "public.tasks" | kind=code-symbol | source=drizzle/0024_meeting_followup_task_link.sql:L5 | neighbors=[0024_meeting_followup_task_link.sql, meeting_followups]
- "drizzle_0025_meeting_suggestion_app": "0025_meeting_suggestion_app.sql" | kind=code-symbol | source=drizzle/0025_meeting_suggestion_app.sql:L1 | neighbors=[meeting_task_suggestions, public.apps]
- "drizzle_0025_meeting_suggestion_app_meeting_task_suggestions": "meeting_task_suggestions" | kind=code-symbol | source=drizzle/0025_meeting_suggestion_app.sql:L6 | neighbors=[0025_meeting_suggestion_app.sql, public.apps]
- "drizzle_0025_meeting_suggestion_app_public_apps": "public.apps" | kind=code-symbol | source=drizzle/0025_meeting_suggestion_app.sql:L6 | neighbors=[0025_meeting_suggestion_app.sql, meeting_task_suggestions]
- "drizzle_0028_attendee_recommendations_meeting_attendee_recommendations": "meeting_attendee_recommendations" | kind=code-symbol | source=drizzle/0028_attendee_recommendations.sql:L14 | neighbors=[0028_attendee_recommendations.sql, public.users]
- "drizzle_0028_attendee_recommendations_meeting_attendees": "meeting_attendees" | kind=code-symbol | source=drizzle/0028_attendee_recommendations.sql:L13 | neighbors=[0028_attendee_recommendations.sql, public.meetings]
- "drizzle_0028_attendee_recommendations_public_meetings": "public.meetings" | kind=code-symbol | source=drizzle/0028_attendee_recommendations.sql:L13 | neighbors=[0028_attendee_recommendations.sql, meeting_attendees]
- "drizzle_0028_attendee_recommendations_public_users": "public.users" | kind=code-symbol | source=drizzle/0028_attendee_recommendations.sql:L37 | neighbors=[0028_attendee_recommendations.sql, meeting_attendee_recommendations]
- "drizzle_0029_attribution_membership_public_meetings": "public.meetings" | kind=code-symbol | source=drizzle/0029_attribution_membership.sql:L35 | neighbors=[0029_attribution_membership.sql, meeting_attendee_history]
- "drizzle_0029_attribution_membership_public_users": "public.users" | kind=code-symbol | source=drizzle/0029_attribution_membership.sql:L40 | neighbors=[0029_attribution_membership.sql, meeting_attendee_history]
- "drizzle_0031_daily_worklogs": "0031_daily_worklogs.sql" | kind=code-symbol | source=drizzle/0031_daily_worklogs.sql:L1 | neighbors=[daily_worklogs, public.users]
- "drizzle_0031_daily_worklogs_daily_worklogs": "daily_worklogs" | kind=code-symbol | source=drizzle/0031_daily_worklogs.sql:L1 | neighbors=[0031_daily_worklogs.sql, public.users]
- "drizzle_0031_daily_worklogs_public_users": "public.users" | kind=code-symbol | source=drizzle/0031_daily_worklogs.sql:L12 | neighbors=[0031_daily_worklogs.sql, daily_worklogs]
- "drizzle_0032_webauthn_webauthn_credentials": "webauthn_credentials" | kind=code-symbol | source=drizzle/0032_webauthn.sql:L4 | neighbors=[0032_webauthn.sql, public.users]
- "drizzle_0032_webauthn_webauthn_login_tokens": "webauthn_login_tokens" | kind=code-symbol | source=drizzle/0032_webauthn.sql:L21 | neighbors=[0032_webauthn.sql, public.users]
- "drizzle_0033_app_pm": "0033_app_pm.sql" | kind=code-symbol | source=drizzle/0033_app_pm.sql:L1 | neighbors=[apps, public.users]
- "drizzle_0033_app_pm_apps": "apps" | kind=code-symbol | source=drizzle/0033_app_pm.sql:L15 | neighbors=[0033_app_pm.sql, public.users]
- "drizzle_0033_app_pm_public_users": "public.users" | kind=code-symbol | source=drizzle/0033_app_pm.sql:L15 | neighbors=[0033_app_pm.sql, apps]
- "drizzle_0034_app_role_history_public_apps": "public.apps" | kind=code-symbol | source=drizzle/0034_app_role_history.sql:L36 | neighbors=[0034_app_role_history.sql, app_role_history]
- "drizzle_0034_app_role_history_public_users": "public.users" | kind=code-symbol | source=drizzle/0034_app_role_history.sql:L40 | neighbors=[0034_app_role_history.sql, app_role_history]
- "drizzle_0035_ai_usage_events_gemini_keys": "gemini_keys" | kind=code-symbol | source=drizzle/0035_ai_usage_events.sql:L4 | neighbors=[0035_ai_usage_events.sql, ai_usage_events]
- "drizzle_0035_ai_usage_events_users": "users" | kind=code-symbol | source=drizzle/0035_ai_usage_events.sql:L3 | neighbors=[0035_ai_usage_events.sql, ai_usage_events]
- "drizzle_0036_key_sharing_prefs": "0036_key_sharing_prefs.sql" | kind=code-symbol | source=drizzle/0036_key_sharing_prefs.sql:L1 | neighbors=[user_ai_prefs, users]
- "drizzle_0036_key_sharing_prefs_user_ai_prefs": "user_ai_prefs" | kind=code-symbol | source=drizzle/0036_key_sharing_prefs.sql:L5 | neighbors=[0036_key_sharing_prefs.sql, users]
- "drizzle_0036_key_sharing_prefs_users": "users" | kind=code-symbol | source=drizzle/0036_key_sharing_prefs.sql:L6 | neighbors=[0036_key_sharing_prefs.sql, user_ai_prefs]
- "drizzle_0038_rbac_tables_absences": "absences" | kind=code-symbol | source=drizzle/0038_rbac_tables.sql:L62 | neighbors=[0038_rbac_tables.sql, public.users]
- "drizzle_0038_rbac_tables_org_holidays": "org_holidays" | kind=code-symbol | source=drizzle/0038_rbac_tables.sql:L81 | neighbors=[0038_rbac_tables.sql, public.users]
- "drizzle_0038_rbac_tables_work_schedules": "work_schedules" | kind=code-symbol | source=drizzle/0038_rbac_tables.sql:L50 | neighbors=[0038_rbac_tables.sql, public.users]
- "drizzle_0040_meeting_apps_public_apps": "public.apps" | kind=code-symbol | source=drizzle/0040_meeting_apps.sql:L39 | neighbors=[0040_meeting_apps.sql, meeting_apps]
- "drizzle_0040_meeting_apps_public_meetings": "public.meetings" | kind=code-symbol | source=drizzle/0040_meeting_apps.sql:L35 | neighbors=[0040_meeting_apps.sql, meeting_apps]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-093.json

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
