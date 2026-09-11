# Node Description Batch 142 of 166

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

- "lib_agenda_topics_test_generic_keyword_denylist": "GENERIC_KEYWORD_DENYLIST" | kind=code-symbol | source=src/lib/agenda-topics.test.ts:L389 | neighbors=[agenda-topics.test.ts]
- "lib_agenda_topics_topicbucket": "TopicBucket" | kind=code-symbol | source=src/lib/agenda-topics.ts:L29 | neighbors=[agenda-topics.ts]
- "lib_app_match_test_apps": "APPS" | kind=code-symbol | source=src/lib/app-match.test.ts:L4 | neighbors=[app-match.test.ts]
- "lib_auth_handlers_auth_signin_signout": "{ handlers, auth, signIn, signOut }" | kind=code-symbol | source=src/lib/auth.ts:L119 | neighbors=[auth.ts]
- "lib_dedupe_deduper": "Deduper" | kind=code-symbol | source=src/lib/dedupe.ts:L30 | neighbors=[dedupe.ts]
- "lib_dedupe_deduperoptions": "DeduperOptions" | kind=code-symbol | source=src/lib/dedupe.ts:L44 | neighbors=[dedupe.ts]
- "lib_dedupe_entry": "Entry" | kind=code-symbol | source=src/lib/dedupe.ts:L24 | neighbors=[dedupe.ts]
- "lib_dedupe_test_deferred": "deferred()" | kind=code-symbol | source=src/lib/dedupe.test.ts:L9 | neighbors=[dedupe.test.ts]
- "lib_escalation_done_statuses": "DONE_STATUSES" | kind=code-symbol | source=src/lib/escalation.ts:L109 | neighbors=[escalation.ts]
- "lib_escalation_escalationinput": "EscalationInput" | kind=code-symbol | source=src/lib/escalation.ts:L96 | neighbors=[escalation.ts]
- "lib_escalation_test_step": "step()" | kind=code-symbol | source=src/lib/escalation.test.ts:L18 | neighbors=[escalation.test.ts]
- "lib_event_identity_identification": "Identification" | kind=code-symbol | source=src/lib/event-identity.ts:L49 | neighbors=[event-identity.ts]
- "lib_event_identity_identityverdict": "IdentityVerdict" | kind=code-symbol | source=src/lib/event-identity.ts:L27 | neighbors=[event-identity.ts]
- "lib_event_identity_knownlinks": "KnownLinks" | kind=code-symbol | source=src/lib/event-identity.ts:L82 | neighbors=[event-identity.ts]
- "lib_event_identity_test_at": "AT" | kind=code-symbol | source=src/lib/event-identity.test.ts:L15 | neighbors=[event-identity.test.ts]
- "lib_event_identity_test_event": "event()" | kind=code-symbol | source=src/lib/event-identity.test.ts:L26 | neighbors=[event-identity.test.ts]
- "lib_event_identity_test_meeting": "meeting()" | kind=code-symbol | source=src/lib/event-identity.test.ts:L18 | neighbors=[event-identity.test.ts]
- "lib_field_reconcile_attendeemerge": "AttendeeMerge" | kind=code-symbol | source=src/lib/field-reconcile.ts:L79 | neighbors=[field-reconcile.ts]
- "lib_field_reconcile_fielddecision": "FieldDecision" | kind=code-symbol | source=src/lib/field-reconcile.ts:L41 | neighbors=[field-reconcile.ts]
- "lib_field_reconcile_fieldverdict": "FieldVerdict" | kind=code-symbol | source=src/lib/field-reconcile.ts:L26 | neighbors=[field-reconcile.ts]
- "lib_field_reconcile_reconciliation": "Reconciliation" | kind=code-symbol | source=src/lib/field-reconcile.ts:L169 | neighbors=[field-reconcile.ts]
- "lib_field_reconcile_test_at": "AT" | kind=code-symbol | source=src/lib/field-reconcile.test.ts:L12 | neighbors=[field-reconcile.test.ts]
- "lib_field_reconcile_test_snap": "snap()" | kind=code-symbol | source=src/lib/field-reconcile.test.ts:L15 | neighbors=[field-reconcile.test.ts]
- "lib_lk_holidays_isodateformatters": "isoDateFormatters" | kind=code-symbol | source=src/lib/lk-holidays.ts:L140 | neighbors=[lk-holidays.ts]
- "lib_lk_holidays_public": "PUBLIC" | kind=code-symbol | source=src/lib/lk-holidays.ts:L70 | neighbors=[lk-holidays.ts]
- "lib_lk_holidays_public_poya": "PUBLIC_POYA" | kind=code-symbol | source=src/lib/lk-holidays.ts:L72 | neighbors=[lk-holidays.ts]
- "lib_lk_holidays_weekdayformatters": "weekdayFormatters" | kind=code-symbol | source=src/lib/lk-holidays.ts:L141 | neighbors=[lk-holidays.ts]
- "lib_meeting_intent_adddays": "addDays()" | kind=code-symbol | source=src/lib/meeting-intent.ts:L46 | neighbors=[meeting-intent.ts]
- "lib_meeting_intent_meetingperson": "MeetingPerson" | kind=code-symbol | source=src/lib/meeting-intent.ts:L14 | neighbors=[meeting-intent.ts]
- "lib_meeting_intent_test_aug": "aug()" | kind=code-symbol | source=src/lib/meeting-intent.test.ts:L15 | neighbors=[meeting-intent.test.ts]
- "lib_meeting_intent_test_now": "NOW" | kind=code-symbol | source=src/lib/meeting-intent.test.ts:L12 | neighbors=[meeting-intent.test.ts]
- "lib_meeting_intent_test_people": "PEOPLE" | kind=code-symbol | source=src/lib/meeting-intent.test.ts:L4 | neighbors=[meeting-intent.test.ts]
- "lib_meeting_intent_timeresult": "TimeResult" | kind=code-symbol | source=src/lib/meeting-intent.ts:L147 | neighbors=[meeting-intent.ts]
- "lib_meeting_intent_weekdays": "WEEKDAYS" | kind=code-symbol | source=src/lib/meeting-intent.ts:L36 | neighbors=[meeting-intent.ts]
- "lib_mention_match_compare": "compare()" | kind=code-symbol | source=src/lib/mention-match.ts:L152 | neighbors=[mention-match.ts]
- "lib_mention_match_mention_query_re": "MENTION_QUERY_RE" | kind=code-symbol | source=src/lib/mention-match.ts:L78 | neighbors=[mention-match.ts]
- "lib_mention_match_mentioncandidate": "MentionCandidate" | kind=code-symbol | source=src/lib/mention-match.ts:L18 | neighbors=[mention-match.ts]
- "lib_mention_match_mentionmatchkind": "MentionMatchKind" | kind=code-symbol | source=src/lib/mention-match.ts:L21 | neighbors=[mention-match.ts]
- "lib_mention_match_mentionsuggestion": "MentionSuggestion" | kind=code-symbol | source=src/lib/mention-match.ts:L30 | neighbors=[mention-match.ts]
- "lib_mention_match_name_word": "NAME_WORD" | kind=code-symbol | source=src/lib/mention-match.ts:L67 | neighbors=[mention-match.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-141.json

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
