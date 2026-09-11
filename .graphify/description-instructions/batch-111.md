# Node Description Batch 112 of 166

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

- "worklog_day_state_dayinput": "DayInput" | kind=code-symbol | source=src/features/worklog/day-state.ts:L30 | neighbors=[progress-matrix.tsx, day-state.ts]
- "worklog_day_summary_firstmeaningfulline": "firstMeaningfulLine()" | kind=code-symbol | source=src/features/worklog/day-summary.ts:L50 | neighbors=[day-summary.ts, glanceAtDay()]
- "worklog_draft_actions_snappercent": "snapPercent()" | kind=code-symbol | source=src/features/worklog/draft-actions.ts:L32 | neighbors=[draft-actions.ts, draftWorklogNote()]
- "worklog_draft_prompt_draftactivity": "DraftActivity" | kind=code-symbol | source=src/features/worklog/draft-prompt.ts:L11 | neighbors=[draft-actions.ts, draft-prompt.ts]
- "worklog_entries_entry_sources": "ENTRY_SOURCES" | kind=code-symbol | source=src/features/worklog/entries.ts:L23 | neighbors=[entries.ts, entry-actions.ts]
- "worklog_entry_check_check_thresholds": "CHECK_THRESHOLDS" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L126 | neighbors=[entry-check.ts, entry-check.test.ts]
- "worklog_entry_check_hrs": "hrs()" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L140 | neighbors=[entry-check.ts, hoursPhrase()]
- "worklog_entry_check_mergedmeetingminutes": "mergedMeetingMinutes()" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L167 | neighbors=[entry-check.ts, findDiscrepancies()]
- "worklog_entry_check_prompt_allowednumbers": "allowedNumbers()" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.ts:L64 | neighbors=[entry-check-prompt.ts, isSafePhrasing()]
- "worklog_entry_check_prompt_readlines": "readLines()" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.ts:L163 | neighbors=[entry-check-prompt.ts, applyPhrasing()]
- "worklog_entry_draft_prompt_draftactivityrow": "DraftActivityRow" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L60 | neighbors=[entry-draft-prompt.ts, entry-evidence.ts]
- "worklog_entry_draft_prompt_hrs": "hrs()" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L95 | neighbors=[entry-draft-prompt.ts, buildEntryDraftPrompt()]
- "worklog_entry_draft_prompt_proposedentry": "ProposedEntry" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L81 | neighbors=[entry-ai-actions.ts, entry-draft-prompt.ts]
- "worklog_entry_draft_prompt_readrow": "readRow()" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L273 | neighbors=[entry-draft-prompt.ts, parseDraftedEntries()]
- "worklog_entry_evidence_getmydayentries": "getMyDayEntries()" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L336 | neighbors=[entry-ai-actions.ts, entry-evidence.ts]
- "worklog_entry_evidence_scheduledminutesfor": "scheduledMinutesFor()" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L136 | neighbors=[entry-evidence.ts, loadDayEvidence()]
- "worklog_entry_evidence_tocheckevidence": "toCheckEvidence()" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L316 | neighbors=[entry-ai-actions.ts, entry-evidence.ts]
- "worklog_entry_language_category_words": "CATEGORY_WORDS" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L41 | neighbors=[entry-language.ts, entry-language.test.ts]
- "worklog_entry_language_escape": "escape()" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L134 | neighbors=[entry-language.ts, parseEntryLine()]
- "worklog_entry_language_matchlongest": "matchLongest()" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L149 | neighbors=[entry-language.ts, parseEntryLine()]
- "worklog_entry_queries_getentryappsinrange": "getEntryAppsInRange()" | kind=code-symbol | source=src/features/worklog/entry-queries.ts:L232 | neighbors=[entry-queries.ts, page.tsx]
- "worklog_entry_queries_getmyentrydaysinrange": "getMyEntryDaysInRange()" | kind=code-symbol | source=src/features/worklog/entry-queries.ts:L153 | neighbors=[entry-queries.ts, page.tsx]
- "worklog_entry_queries_listdayentriesfordisplay": "listDayEntriesForDisplay()" | kind=code-symbol | source=src/features/worklog/entry-queries.ts:L44 | neighbors=[entry-queries.ts, page.tsx]
- "worklog_entry_queries_listloggabletasks": "listLoggableTasks()" | kind=code-symbol | source=src/features/worklog/entry-queries.ts:L116 | neighbors=[entry-queries.ts, page.tsx]
- "worklog_entry_suggestions_dedupe": "dedupe()" | kind=code-symbol | source=src/features/worklog/entry-suggestions.ts:L111 | neighbors=[entry-suggestions.ts, buildEntrySuggestions()]
- "worklog_entry_suggestions_suggestioninput": "SuggestionInput" | kind=code-symbol | source=src/features/worklog/entry-suggestions.ts:L24 | neighbors=[entry-suggestions.ts, entry-suggestions.test.ts]
- "worklog_holiday_listing_holiday_category_label": "HOLIDAY_CATEGORY_LABEL" | kind=code-symbol | source=src/features/worklog/holiday-listing.ts:L133 | neighbors=[org-holidays-card.tsx, holiday-listing.ts]
- "worklog_holiday_listing_holidaycalendarrow": "HolidayCalendarRow" | kind=code-symbol | source=src/features/worklog/holiday-listing.ts:L37 | neighbors=[org-holidays-card.tsx, holiday-listing.ts]
- "worklog_missing_days_isrequiredworkday": "isRequiredWorkDay()" | kind=code-symbol | source=src/features/worklog/missing-days.ts:L43 | neighbors=[missing-days.ts, missing-days.test.ts]
- "worklog_missing_days_missingworkdays": "missingWorkDays()" | kind=code-symbol | source=src/features/worklog/missing-days.ts:L54 | neighbors=[missing-days.ts, missing-days.test.ts]
- "worklog_nudge_queries_collectworklognudgeinputs": "collectWorklogNudgeInputs()" | kind=code-symbol | source=src/features/worklog/nudge-queries.ts:L42 | neighbors=[route.ts, nudge-queries.ts]
- "worklog_org_holiday_actions_addorgholiday": "addOrgHoliday()" | kind=code-symbol | source=src/features/worklog/org-holiday-actions.ts:L20 | neighbors=[org-holidays-card.tsx, org-holiday-actions.ts]
- "worklog_org_holiday_actions_revokeorgholiday": "revokeOrgHoliday()" | kind=code-symbol | source=src/features/worklog/org-holiday-actions.ts:L58 | neighbors=[org-holidays-card.tsx, org-holiday-actions.ts]
- "worklog_org_holidays_test": "org-holidays.test.ts" | kind=code-symbol | source=src/features/worklog/org-holidays.test.ts:L1 | neighbors=[org-holidays.ts, orgHolidaySet()]
- "worklog_page_firstparam": "firstParam()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L246 | neighbors=[page.tsx, WorklogPage()]
- "worklog_page_isrealday": "isRealDay()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L252 | neighbors=[page.tsx, WorklogPage()]
- "worklog_page_logzone": "LogZone()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L813 | neighbors=[page.tsx, shiftDay()]
- "worklog_progress_params_first": "first()" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L51 | neighbors=[progress-params.ts, parseProgressParams()]
- "worklog_progress_params_firstofmonth": "firstOfMonth()" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L114 | neighbors=[progress-params.ts, resolveProgressWindow()]
- "worklog_progress_params_isvalidisoday": "isValidIsoDay()" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L60 | neighbors=[progress-params.ts, parseProgressParams()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-111.json

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
