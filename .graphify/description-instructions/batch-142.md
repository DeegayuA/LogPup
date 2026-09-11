# Node Description Batch 143 of 166

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

- "lib_mention_match_rank": "RANK" | kind=code-symbol | source=src/lib/mention-match.ts:L42 | neighbors=[mention-match.ts]
- "lib_mention_match_test_atend": "atEnd()" | kind=code-symbol | source=src/lib/mention-match.test.ts:L143 | neighbors=[mention-match.test.ts]
- "lib_mention_match_test_ids": "ids()" | kind=code-symbol | source=src/lib/mention-match.test.ts:L12 | neighbors=[mention-match.test.ts]
- "lib_mention_match_test_kinds": "kinds()" | kind=code-symbol | source=src/lib/mention-match.test.ts:L16 | neighbors=[mention-match.test.ts]
- "lib_mention_match_test_users": "USERS" | kind=code-symbol | source=src/lib/mention-match.test.ts:L4 | neighbors=[mention-match.test.ts]
- "lib_org_from_domain_domain_to_org": "DOMAIN_TO_ORG" | kind=code-symbol | source=src/lib/org-from-domain.ts:L4 | neighbors=[org-from-domain.ts]
- "lib_poll_schedule_pollconditions": "PollConditions" | kind=code-symbol | source=src/lib/poll-schedule.ts:L53 | neighbors=[poll-schedule.ts]
- "lib_poll_schedule_test_schedule": "SCHEDULE" | kind=code-symbol | source=src/lib/poll-schedule.test.ts:L4 | neighbors=[poll-schedule.test.ts]
- "lib_rate_limit_ratelimiter": "RateLimiter" | kind=code-symbol | source=src/lib/rate-limit.ts:L25 | neighbors=[rate-limit.ts]
- "lib_rate_limit_ratelimiteroptions": "RateLimiterOptions" | kind=code-symbol | source=src/lib/rate-limit.ts:L18 | neighbors=[rate-limit.ts]
- "lib_recurrence_expandoptions": "ExpandOptions" | kind=code-symbol | source=src/lib/recurrence.ts:L58 | neighbors=[recurrence.ts]
- "lib_recurrence_frequency": "Frequency" | kind=code-symbol | source=src/lib/recurrence.ts:L26 | neighbors=[recurrence.ts]
- "lib_recurrence_test_noholidays": "noHolidays()" | kind=code-symbol | source=src/lib/recurrence.test.ts:L15 | neighbors=[recurrence.test.ts]
- "lib_recurrence_test_rule": "rule()" | kind=code-symbol | source=src/lib/recurrence.test.ts:L17 | neighbors=[recurrence.test.ts]
- "lib_recurrence_weekday": "Weekday" | kind=code-symbol | source=src/lib/recurrence.ts:L29 | neighbors=[recurrence.ts]
- "lib_recurrence_weekday_names": "WEEKDAY_NAMES" | kind=code-symbol | source=src/lib/recurrence.ts:L165 | neighbors=[recurrence.ts]
- "lib_sort_order_test_items": "items()" | kind=code-symbol | source=src/lib/sort-order.test.ts:L4 | neighbors=[sort-order.test.ts]
- "lib_task_intent_adddays": "addDays()" | kind=code-symbol | source=src/lib/task-intent.ts:L64 | neighbors=[task-intent.ts]
- "lib_task_intent_at_anywhere": "AT_ANYWHERE" | kind=code-symbol | source=src/lib/task-intent.ts:L148 | neighbors=[task-intent.ts]
- "lib_task_intent_bang_priority": "BANG_PRIORITY" | kind=code-symbol | source=src/lib/task-intent.ts:L182 | neighbors=[task-intent.ts]
- "lib_task_intent_multi_test_people": "PEOPLE" | kind=code-symbol | source=src/lib/task-intent-multi.test.ts:L4 | neighbors=[task-intent-multi.test.ts]
- "lib_task_intent_multi_test_today": "TODAY" | kind=code-symbol | source=src/lib/task-intent-multi.test.ts:L10 | neighbors=[task-intent-multi.test.ts]
- "lib_task_intent_name_word": "NAME_WORD" | kind=code-symbol | source=src/lib/task-intent.ts:L139 | neighbors=[task-intent.ts]
- "lib_task_intent_priority_keys": "PRIORITY_KEYS" | kind=code-symbol | source=src/lib/task-intent.ts:L167 | neighbors=[task-intent.ts]
- "lib_task_intent_priority_words": "PRIORITY_WORDS" | kind=code-symbol | source=src/lib/task-intent.ts:L159 | neighbors=[task-intent.ts]
- "lib_task_intent_taskintent": "TaskIntent" | kind=code-symbol | source=src/lib/task-intent.ts:L18 | neighbors=[task-intent.ts]
- "lib_task_intent_test_people": "PEOPLE" | kind=code-symbol | source=src/lib/task-intent.test.ts:L4 | neighbors=[task-intent.test.ts]
- "lib_task_intent_test_today": "TODAY" | kind=code-symbol | source=src/lib/task-intent.test.ts:L12 | neighbors=[task-intent.test.ts]
- "lib_task_intent_trailing_priority": "TRAILING_PRIORITY" | kind=code-symbol | source=src/lib/task-intent.ts:L178 | neighbors=[task-intent.ts]
- "lib_task_intent_weekdays": "WEEKDAYS" | kind=code-symbol | source=src/lib/task-intent.ts:L42 | neighbors=[task-intent.ts]
- "lib_tech_tags_curated_tech_tags_raw": "CURATED_TECH_TAGS_RAW" | kind=code-symbol | source=src/lib/tech-tags.ts:L16 | neighbors=[tech-tags.ts]
- "lib_tracked_imports_test_git": "git()" | kind=code-symbol | source=src/lib/tracked-imports.test.ts:L27 | neighbors=[tracked-imports.test.ts]
- "lib_tracked_imports_test_resolutions": "RESOLUTIONS" | kind=code-symbol | source=src/lib/tracked-imports.test.ts:L31 | neighbors=[tracked-imports.test.ts]
- "lib_tracked_imports_test_resolvealias": "resolveAlias()" | kind=code-symbol | source=src/lib/tracked-imports.test.ts:L33 | neighbors=[tracked-imports.test.ts]
- "load_error_meetingloaderror": "MeetingLoadError()" | kind=code-symbol | source=src/app/(app)/meetings/load/error.tsx:L16 | neighbors=[error.tsx]
- "load_loading_meetingloadloading": "MeetingLoadLoading()" | kind=code-symbol | source=src/app/(app)/meetings/load/loading.tsx:L11 | neighbors=[loading.tsx]
- "load_page_audit": "Audit()" | kind=code-symbol | source=src/app/(app)/meetings/load/page.tsx:L127 | neighbors=[page.tsx]
- "load_page_board": "Board()" | kind=code-symbol | source=src/app/(app)/meetings/load/page.tsx:L64 | neighbors=[page.tsx]
- "load_page_boardskeleton": "BoardSkeleton()" | kind=code-symbol | source=src/app/(app)/meetings/load/page.tsx:L98 | neighbors=[page.tsx]
- "load_page_meetingloadpage": "MeetingLoadPage()" | kind=code-symbol | source=src/app/(app)/meetings/load/page.tsx:L32 | neighbors=[page.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-142.json

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
