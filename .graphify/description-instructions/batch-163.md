# Node Description Batch 164 of 166

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

- "worklog_entry_ai_actions_silent": "SILENT" | kind=code-symbol | source=src/features/worklog/entry-ai-actions.ts:L218 | neighbors=[entry-ai-actions.ts]
- "worklog_entry_ai_actions_worklogentriescheck": "WorklogEntriesCheck" | kind=code-symbol | source=src/features/worklog/entry-ai-actions.ts:L203 | neighbors=[entry-ai-actions.ts]
- "worklog_entry_ai_actions_worklogentriesdraft": "WorklogEntriesDraft" | kind=code-symbol | source=src/features/worklog/entry-ai-actions.ts:L79 | neighbors=[entry-ai-actions.ts]
- "worklog_entry_check_attendedmeeting": "AttendedMeeting" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L78 | neighbors=[entry-check.ts]
- "worklog_entry_check_observationseverity": "ObservationSeverity" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L61 | neighbors=[entry-check.ts]
- "worklog_entry_check_prompt_phrasedline": "PhrasedLine" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.ts:L42 | neighbors=[entry-check-prompt.ts]
- "worklog_entry_check_prompt_promptline": "promptLine()" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.ts:L108 | neighbors=[entry-check-prompt.ts]
- "worklog_entry_check_prompt_test_meeting": "meeting" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.test.ts:L24 | neighbors=[entry-check-prompt.test.ts]
- "worklog_entry_check_prompt_test_reply": "reply()" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.test.ts:L36 | neighbors=[entry-check-prompt.test.ts]
- "worklog_entry_check_prompt_test_short": "short" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.test.ts:L17 | neighbors=[entry-check-prompt.test.ts]
- "worklog_entry_check_test_evidence": "evidence()" | kind=code-symbol | source=src/features/worklog/entry-check.test.ts:L19 | neighbors=[entry-check.test.ts]
- "worklog_entry_check_test_find": "find()" | kind=code-symbol | source=src/features/worklog/entry-check.test.ts:L36 | neighbors=[entry-check.test.ts]
- "worklog_entry_check_test_kinds": "kinds()" | kind=code-symbol | source=src/features/worklog/entry-check.test.ts:L35 | neighbors=[entry-check.test.ts]
- "worklog_entry_check_test_meeting": "meeting()" | kind=code-symbol | source=src/features/worklog/entry-check.test.ts:L29 | neighbors=[entry-check.test.ts]
- "worklog_entry_draft_prompt_draftperson": "DraftPerson" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L120 | neighbors=[entry-draft-prompt.ts]
- "worklog_entry_draft_prompt_draftrecentday": "DraftRecentDay" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L130 | neighbors=[entry-draft-prompt.ts]
- "worklog_entry_draft_prompt_meetingline": "meetingLine()" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L97 | neighbors=[entry-draft-prompt.ts]
- "worklog_entry_draft_prompt_test_activity": "activity" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.test.ts:L26 | neighbors=[entry-draft-prompt.test.ts]
- "worklog_entry_draft_prompt_test_meetings": "meetings" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.test.ts:L21 | neighbors=[entry-draft-prompt.test.ts]
- "worklog_entry_draft_prompt_test_prompt": "prompt()" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.test.ts:L31 | neighbors=[entry-draft-prompt.test.ts]
- "worklog_entry_draft_prompt_test_reply": "reply()" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.test.ts:L45 | neighbors=[entry-draft-prompt.test.ts]
- "worklog_entry_draft_prompt_test_tasks": "tasks" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.test.ts:L16 | neighbors=[entry-draft-prompt.test.ts]
- "worklog_entry_evidence_clock": "clock" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L102 | neighbors=[entry-evidence.ts]
- "worklog_entry_evidence_dayentryrow": "DayEntryRow" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L57 | neighbors=[entry-evidence.ts]
- "worklog_entry_evidence_draftercontext": "DrafterContext" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L361 | neighbors=[entry-evidence.ts]
- "worklog_entry_evidence_evidencemeeting": "EvidenceMeeting" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L70 | neighbors=[entry-evidence.ts]
- "worklog_entry_evidence_formatminutes": "formatMinutes()" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L466 | neighbors=[entry-evidence.ts]
- "worklog_entry_evidence_worklogdayevidence": "WorklogDayEvidence" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L72 | neighbors=[entry-evidence.ts]
- "worklog_entry_form_test_fields": "fields()" | kind=code-symbol | source=src/features/worklog/entry-form.test.ts:L10 | neighbors=[entry-form.test.ts]
- "worklog_entry_language_duration_patterns": "DURATION_PATTERNS" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L122 | neighbors=[entry-language.ts]
- "worklog_entry_language_linesuggestion": "LineSuggestion" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L365 | neighbors=[entry-language.ts]
- "worklog_entry_language_namedref": "NamedRef" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L114 | neighbors=[entry-language.ts]
- "worklog_entry_language_parsedentryline": "ParsedEntryLine" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L97 | neighbors=[entry-language.ts]
- "worklog_entry_language_test_apps": "APPS" | kind=code-symbol | source=src/features/worklog/entry-language.test.ts:L13 | neighbors=[entry-language.test.ts]
- "worklog_entry_language_test_parse": "parse()" | kind=code-symbol | source=src/features/worklog/entry-language.test.ts:L21 | neighbors=[entry-language.test.ts]
- "worklog_entry_language_test_tasks": "TASKS" | kind=code-symbol | source=src/features/worklog/entry-language.test.ts:L19 | neighbors=[entry-language.test.ts]
- "worklog_entry_queries_dayapp": "DayApp" | kind=code-symbol | source=src/features/worklog/entry-queries.ts:L216 | neighbors=[entry-queries.ts]
- "worklog_entry_suggestions_entrysuggestion": "EntrySuggestion" | kind=code-symbol | source=src/features/worklog/entry-suggestions.ts:L32 | neighbors=[entry-suggestions.ts]
- "worklog_entry_suggestions_leadsratherthanbuilds": "leadsRatherThanBuilds()" | kind=code-symbol | source=src/features/worklog/entry-suggestions.ts:L52 | neighbors=[entry-suggestions.ts]
- "worklog_entry_suggestions_suggestionsource": "SuggestionSource" | kind=code-symbol | source=src/features/worklog/entry-suggestions.ts:L22 | neighbors=[entry-suggestions.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-163.json

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
