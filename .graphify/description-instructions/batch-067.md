# Node Description Batch 68 of 166

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

- "lib_access_gate_mayholdsession": "mayHoldSession()" | kind=code-symbol | source=src/lib/access-gate.ts:L31 | neighbors=[access-gate.ts, access-gate.test.ts, auth.ts]
- "lib_access_gate_test": "access-gate.test.ts" | kind=code-symbol | source=src/lib/access-gate.test.ts:L1 | neighbors=[access-gate.ts, canAccessApp(), mayHoldSession()]
- "lib_agenda_topics_findearliestkeywordmatch": "findEarliestKeywordMatch()" | kind=code-symbol | source=src/lib/agenda-topics.ts:L601 | neighbors=[agenda-topics.ts, escapeRegExp(), matchAgendaTopic()]
- "lib_allowed_domains_test": "allowed-domains.test.ts" | kind=code-symbol | source=src/lib/allowed-domains.test.ts:L1 | neighbors=[allowed-domains.ts, allowedDomains(), emailAllowed()]
- "lib_app_match_matchapp": "matchApp()" | kind=code-symbol | source=src/lib/app-match.ts:L16 | neighbors=[meeting-form.tsx, app-match.ts, app-match.test.ts]
- "lib_app_match_test": "app-match.test.ts" | kind=code-symbol | source=src/lib/app-match.test.ts:L1 | neighbors=[app-match.ts, matchApp(), APPS]
- "lib_brand_pawsvg": "pawSvg()" | kind=code-symbol | source=src/lib/brand.ts:L6 | neighbors=[apple-icon.tsx, brand.ts, route.tsx]
- "lib_crypto_encryptsecret": "encryptSecret()" | kind=code-symbol | source=src/lib/crypto.ts:L29 | neighbors=[actions.ts, crypto.ts, keyFromSecret()]
- "lib_crypto_keyfromsecret": "keyFromSecret()" | kind=code-symbol | source=src/lib/crypto.ts:L23 | neighbors=[crypto.ts, decryptSecret(), encryptSecret()]
- "lib_dedupe_creatededuper": "createDeduper()" | kind=code-symbol | source=src/lib/dedupe.ts:L58 | neighbors=[command-center.tsx, dedupe.ts, dedupe.test.ts]
- "lib_dedupe_test": "dedupe.test.ts" | kind=code-symbol | source=src/lib/dedupe.test.ts:L1 | neighbors=[dedupe.ts, createDeduper(), deferred()]
- "lib_escalation_workingdaysbetween": "workingDaysBetween()" | kind=code-symbol | source=src/lib/escalation.ts:L81 | neighbors=[escalation.ts, EscalationStep, nextDay()]
- "lib_event_identity_attendeeoverlap": "attendeeOverlap()" | kind=code-symbol | source=src/lib/event-identity.ts:L136 | neighbors=[event-identity.ts, identifyEvent(), event-identity.test.ts]
- "lib_event_identity_normalisetitle": "normaliseTitle()" | kind=code-symbol | source=src/lib/event-identity.ts:L100 | neighbors=[event-identity.ts, event-identity.test.ts, titleSimilarity()]
- "lib_field_reconcile_reconcilescalar": "reconcileScalar()" | kind=code-symbol | source=src/lib/field-reconcile.ts:L51 | neighbors=[field-reconcile.ts, reconcileMeeting(), field-reconcile.test.ts]
- "lib_fuzzy_similarity": "similarity()" | kind=code-symbol | source=src/lib/fuzzy.ts:L29 | neighbors=[search.ts, fuzzy.ts, levenshtein()]
- "lib_job_roles_job_role_groups": "JOB_ROLE_GROUPS" | kind=code-symbol | source=src/lib/job-roles.ts:L15 | neighbors=[job-roles.ts, job-roles.test.ts, job-role-select.tsx]
- "lib_job_roles_test": "job-roles.test.ts" | kind=code-symbol | source=src/lib/job-roles.test.ts:L1 | neighbors=[job-roles.ts, JOB_ROLE_GROUPS, JOB_ROLES]
- "lib_keyset_cursor_decodekeysetcursor": "decodeKeysetCursor()" | kind=code-symbol | source=src/lib/keyset-cursor.ts:L30 | neighbors=[queries.ts, queue-page.test.ts, keyset-cursor.ts]
- "lib_keyset_cursor_encodekeysetcursor": "encodeKeysetCursor()" | kind=code-symbol | source=src/lib/keyset-cursor.ts:L26 | neighbors=[queries.ts, queue-page.test.ts, keyset-cursor.ts]
- "lib_lk_holidays_getholidayiconkind": "getHolidayIconKind()" | kind=code-symbol | source=src/lib/lk-holidays.ts:L244 | neighbors=[lk-holidays.ts, lk-holidays.test.ts, holiday-icon.tsx]
- "lib_lk_holidays_getlkholidayname": "getLkHolidayName()" | kind=code-symbol | source=src/lib/lk-holidays.ts:L182 | neighbors=[lk-holidays.ts, getLkHoliday(), lk-holidays.test.ts]
- "lib_lk_holidays_holidaycategory": "HolidayCategory" | kind=code-symbol | source=src/lib/lk-holidays.ts:L34 | neighbors=[lk-holidays.ts, holiday-icon.tsx, holiday-listing.ts]
- "lib_meeting_intent_extractday": "extractDay()" | kind=code-symbol | source=src/lib/meeting-intent.ts:L96 | neighbors=[meeting-intent.ts, stripMatch(), parseMeetingIntent()]
- "lib_meeting_intent_extractduration": "extractDuration()" | kind=code-symbol | source=src/lib/meeting-intent.ts:L129 | neighbors=[meeting-intent.ts, stripMatch(), parseMeetingIntent()]
- "lib_mention_match_findmentionquery": "findMentionQuery()" | kind=code-symbol | source=src/lib/mention-match.ts:L88 | neighbors=[mention-textarea.tsx, mention-match.ts, mention-match.test.ts]
- "lib_poll_schedule_nextpolldelay": "nextPollDelay()" | kind=code-symbol | source=src/lib/poll-schedule.ts:L40 | neighbors=[use-smart-poll.ts, poll-schedule.ts, poll-schedule.test.ts]
- "lib_poll_schedule_shouldpoll": "shouldPoll()" | kind=code-symbol | source=src/lib/poll-schedule.ts:L71 | neighbors=[use-smart-poll.ts, poll-schedule.ts, poll-schedule.test.ts]
- "lib_prompt_truncate_test": "prompt-truncate.test.ts" | kind=code-symbol | source=src/lib/prompt-truncate.test.ts:L1 | neighbors=[5a95470 fix(meetings): transcripts stop…, prompt-truncate.ts, truncateAtWordBoundary()]
- "lib_rate_limit_ratelimiterror": "RateLimitError" | kind=code-symbol | source=src/lib/rate-limit.ts:L16 | neighbors=[actions.ts, auth.ts, rate-limit.ts]
- "lib_recurrence_at": "at()" | kind=code-symbol | source=src/lib/recurrence.ts:L82 | neighbors=[recurrence.ts, addDays(), weekdayOf()]
- "lib_recurrence_describerecurrence": "describeRecurrence()" | kind=code-symbol | source=src/lib/recurrence.ts:L175 | neighbors=[recurrence.ts, weekdayOf(), recurrence.test.ts]
- "lib_recurrence_recurrenceerror": "RecurrenceError" | kind=code-symbol | source=src/lib/recurrence.ts:L102 | neighbors=[recurrence.ts, expandRecurrence(), recurrence.test.ts]
- "lib_sort_order_sortorderforindex": "sortOrderForIndex()" | kind=code-symbol | source=src/lib/sort-order.ts:L26 | neighbors=[roadmap-timeline.tsx, sort-order.ts, sort-order.test.ts]
- "lib_task_intent_extractdue": "extractDue()" | kind=code-symbol | source=src/lib/task-intent.ts:L75 | neighbors=[task-intent.ts, toIso(), parseTaskIntent()]
- "lib_task_intent_findpeople": "findPeople()" | kind=code-symbol | source=src/lib/task-intent.ts:L226 | neighbors=[task-intent.ts, parseTaskIntent(), takeNameRun()]
- "lib_task_intent_takenamerun": "takeNameRun()" | kind=code-symbol | source=src/lib/task-intent.ts:L266 | neighbors=[task-intent.ts, parseTaskIntent(), findPeople()]
- "lib_tech_tags_filtertagsuggestions": "filterTagSuggestions()" | kind=code-symbol | source=src/lib/tech-tags.ts:L94 | neighbors=[tech-tags-input.tsx, tech-tags.ts, tech-tags.test.ts]
- "lib_tech_tags_mergetagsources": "mergeTagSources()" | kind=code-symbol | source=src/lib/tech-tags.ts:L53 | neighbors=[app-form-dialog.tsx, tech-tags.ts, tech-tags.test.ts]
- "lib_tracked_imports_test": "tracked-imports.test.ts" | kind=code-symbol | source=src/lib/tracked-imports.test.ts:L1 | neighbors=[git(), RESOLUTIONS, resolveAlias()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-067.json

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
