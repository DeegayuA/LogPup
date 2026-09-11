# Node Description Batch 99 of 166

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

- "lib_event_identity_candidateevent": "CandidateEvent" | kind=code-symbol | source=src/lib/event-identity.ts:L64 | neighbors=[event-identity.ts, event-identity.test.ts]
- "lib_event_identity_candidatemeeting": "CandidateMeeting" | kind=code-symbol | source=src/lib/event-identity.ts:L54 | neighbors=[event-identity.ts, event-identity.test.ts]
- "lib_event_identity_identityreason": "IdentityReason" | kind=code-symbol | source=src/lib/event-identity.ts:L29 | neighbors=[event-identity.ts, event-identity.test.ts]
- "lib_event_identity_reason_sentence": "REASON_SENTENCE" | kind=code-symbol | source=src/lib/event-identity.ts:L220 | neighbors=[event-identity.ts, event-identity.test.ts]
- "lib_field_reconcile_asset": "asSet()" | kind=code-symbol | source=src/lib/field-reconcile.ts:L87 | neighbors=[field-reconcile.ts, reconcileAttendees()]
- "lib_field_reconcile_field_reason_sentence": "FIELD_REASON_SENTENCE" | kind=code-symbol | source=src/lib/field-reconcile.ts:L206 | neighbors=[field-reconcile.ts, field-reconcile.test.ts]
- "lib_field_reconcile_fieldreason": "FieldReason" | kind=code-symbol | source=src/lib/field-reconcile.ts:L28 | neighbors=[field-reconcile.ts, field-reconcile.test.ts]
- "lib_field_reconcile_syncsnapshot": "SyncSnapshot" | kind=code-symbol | source=src/lib/field-reconcile.ts:L161 | neighbors=[field-reconcile.ts, field-reconcile.test.ts]
- "lib_fuzzy_levenshtein": "levenshtein()" | kind=code-symbol | source=src/lib/fuzzy.ts:L9 | neighbors=[fuzzy.ts, similarity()]
- "lib_keyset_cursor_keysetcursor": "KeysetCursor" | kind=code-symbol | source=src/lib/keyset-cursor.ts:L24 | neighbors=[queue-page.ts, keyset-cursor.ts]
- "lib_lk_holidays_getholidayiconkinds": "getHolidayIconKinds()" | kind=code-symbol | source=src/lib/lk-holidays.ts:L260 | neighbors=[lk-holidays.ts, holiday-icon.tsx]
- "lib_lk_holidays_holidayiconkind": "HolidayIconKind" | kind=code-symbol | source=src/lib/lk-holidays.ts:L231 | neighbors=[lk-holidays.ts, holiday-icon.tsx]
- "lib_lk_holidays_isodateformatter": "isoDateFormatter()" | kind=code-symbol | source=src/lib/lk-holidays.ts:L143 | neighbors=[lk-holidays.ts, toIsoDateInTimeZone()]
- "lib_lk_holidays_lkholiday": "LkHoliday" | kind=code-symbol | source=src/lib/lk-holidays.ts:L36 | neighbors=[lk-holidays.ts, holiday-listing.ts]
- "lib_lk_holidays_weekdayformatter": "weekdayFormatter()" | kind=code-symbol | source=src/lib/lk-holidays.ts:L156 | neighbors=[lk-holidays.ts, isLkSunday()]
- "lib_meeting_intent_extractapp": "extractApp()" | kind=code-symbol | source=src/lib/meeting-intent.ts:L186 | neighbors=[meeting-intent.ts, parseMeetingIntent()]
- "lib_meeting_intent_meetingintent": "MeetingIntent" | kind=code-symbol | source=src/lib/meeting-intent.ts:L16 | neighbors=[meeting-form.tsx, meeting-intent.ts]
- "lib_meeting_intent_resolvepeople": "resolvePeople()" | kind=code-symbol | source=src/lib/meeting-intent.ts:L60 | neighbors=[meeting-intent.ts, parseMeetingIntent()]
- "lib_meeting_intent_toclock": "toClock()" | kind=code-symbol | source=src/lib/meeting-intent.ts:L139 | neighbors=[meeting-intent.ts, extractTime()]
- "lib_mention_match_activemention": "ActiveMention" | kind=code-symbol | source=src/lib/mention-match.ts:L36 | neighbors=[mention-textarea.tsx, mention-match.ts]
- "lib_mention_match_tokenscoverwords": "tokensCoverWords()" | kind=code-symbol | source=src/lib/mention-match.ts:L111 | neighbors=[mention-match.ts, classify()]
- "lib_mention_match_wordsof": "wordsOf()" | kind=code-symbol | source=src/lib/mention-match.ts:L100 | neighbors=[mention-match.ts, classify()]
- "lib_org_from_domain_test": "org-from-domain.test.ts" | kind=code-symbol | source=src/lib/org-from-domain.test.ts:L1 | neighbors=[org-from-domain.ts, orgForEmail()]
- "lib_poll_schedule_pollschedule": "PollSchedule" | kind=code-symbol | source=src/lib/poll-schedule.ts:L22 | neighbors=[use-smart-poll.ts, poll-schedule.ts]
- "lib_rate_limit_createratelimiter": "createRateLimiter()" | kind=code-symbol | source=src/lib/rate-limit.ts:L34 | neighbors=[rate-limit.ts, rate-limit.test.ts]
- "lib_rate_limit_loginratelimiter": "loginRateLimiter" | kind=code-symbol | source=src/lib/rate-limit.ts:L65 | neighbors=[auth.ts, rate-limit.ts]
- "lib_rate_limit_test": "rate-limit.test.ts" | kind=code-symbol | source=src/lib/rate-limit.test.ts:L1 | neighbors=[rate-limit.ts, createRateLimiter()]
- "lib_recurrence_recurrencerule": "RecurrenceRule" | kind=code-symbol | source=src/lib/recurrence.ts:L31 | neighbors=[recurrence.ts, recurrence.test.ts]
- "lib_slug_test": "slug.test.ts" | kind=code-symbol | source=src/lib/slug.test.ts:L1 | neighbors=[slug.ts, slugify()]
- "lib_sort_order_sortordered": "SortOrdered" | kind=code-symbol | source=src/lib/sort-order.ts:L24 | neighbors=[sort-order.ts, sort-order.test.ts]
- "lib_task_intent_extractapp": "extractApp()" | kind=code-symbol | source=src/lib/task-intent.ts:L126 | neighbors=[task-intent.ts, parseTaskIntent()]
- "lib_task_intent_extractpriority": "extractPriority()" | kind=code-symbol | source=src/lib/task-intent.ts:L184 | neighbors=[task-intent.ts, parseTaskIntent()]
- "lib_task_intent_toiso": "toIso()" | kind=code-symbol | source=src/lib/task-intent.ts:L57 | neighbors=[task-intent.ts, extractDue()]
- "lib_working_days_ishalfworkingday": "isHalfWorkingDay()" | kind=code-symbol | source=src/lib/working-days.ts:L65 | neighbors=[working-days.ts, working-days.test.ts]
- "maintenance_actions_armmaintenance": "armMaintenance()" | kind=code-symbol | source=src/features/maintenance/actions.ts:L50 | neighbors=[maintenance-controls.tsx, actions.ts]
- "maintenance_actions_cancelmaintenance": "cancelMaintenance()" | kind=code-symbol | source=src/features/maintenance/actions.ts:L123 | neighbors=[maintenance-controls.tsx, actions.ts]
- "maintenance_actions_endmaintenancenow": "endMaintenanceNow()" | kind=code-symbol | source=src/features/maintenance/actions.ts:L159 | neighbors=[maintenance-gate.tsx, actions.ts]
- "maintenance_actions_fetchmaintenancewindow": "fetchMaintenanceWindow()" | kind=code-symbol | source=src/features/maintenance/actions.ts:L198 | neighbors=[maintenance-gate.tsx, actions.ts]
- "maintenance_commands_commands": "commands" | kind=code-symbol | source=src/features/maintenance/commands.ts:L19 | neighbors=[commands.ts, commands.ts]
- "maintenance_freeze_readmaintenancephase": "readMaintenancePhase()" | kind=code-symbol | source=src/features/maintenance/freeze.ts:L81 | neighbors=[freeze.ts, readMaintenanceWindow()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-098.json

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
