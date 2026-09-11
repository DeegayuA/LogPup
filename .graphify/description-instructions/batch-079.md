# Node Description Batch 80 of 166

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

- "worklog_entry_actions_resolveentryappid": "resolveEntryAppId()" | kind=code-symbol | source=src/features/worklog/entry-actions.ts:L104 | neighbors=[entry-actions.ts, createWorklogEntry(), updateWorklogEntry()]
- "worklog_entry_ai_actions_checkworklogentries": "checkWorklogEntries()" | kind=code-symbol | source=src/features/worklog/entry-ai-actions.ts:L249 | neighbors=[day-hours-card.tsx, entry-ai-actions.ts, writer()]
- "worklog_entry_ai_actions_draftedentry": "DraftedEntry" | kind=code-symbol | source=src/features/worklog/entry-ai-actions.ts:L77 | neighbors=[day-hours-card.tsx, day-panel.tsx, entry-ai-actions.ts]
- "worklog_entry_ai_actions_writer": "writer()" | kind=code-symbol | source=src/features/worklog/entry-ai-actions.ts:L61 | neighbors=[entry-ai-actions.ts, checkWorklogEntries(), draftWorklogEntries()]
- "worklog_entry_check_checkentry": "CheckEntry" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L109 | neighbors=[entry-check.ts, entry-check.test.ts, entry-evidence.ts]
- "worklog_entry_check_dayevidence": "DayEvidence" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L86 | neighbors=[entry-check.ts, entry-check.test.ts, entry-evidence.ts]
- "worklog_entry_check_hoursphrase": "hoursPhrase()" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L153 | neighbors=[entry-check.ts, findDiscrepancies(), hrs()]
- "worklog_entry_check_observationkind": "ObservationKind" | kind=code-symbol | source=src/features/worklog/entry-check.ts:L32 | neighbors=[entry-check.ts, entry-check-prompt.ts, entry-check.test.ts]
- "worklog_entry_check_prompt_buildentrycheckprompt": "buildEntryCheckPrompt()" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.ts:L130 | neighbors=[entry-ai-actions.ts, entry-check-prompt.ts, entry-check-prompt.test.ts]
- "worklog_entry_check_prompt_issafephrasing": "isSafePhrasing()" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.ts:L95 | neighbors=[entry-check-prompt.ts, allowedNumbers(), entry-check-prompt.test.ts]
- "worklog_entry_draft_prompt_draftmeeting": "DraftMeeting" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L50 | neighbors=[entry-draft-prompt.ts, entry-draft-prompt.test.ts, entry-evidence.ts]
- "worklog_entry_draft_prompt_drafttask": "DraftTask" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L67 | neighbors=[entry-draft-prompt.ts, entry-draft-prompt.test.ts, entry-evidence.ts]
- "worklog_entry_evidence_daywindow": "dayWindow()" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L114 | neighbors=[entry-evidence.ts, loadDayEvidence(), meetingsAttended()]
- "worklog_entry_evidence_loaddraftercontext": "loadDrafterContext()" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L393 | neighbors=[entry-ai-actions.ts, entry-evidence.ts, summariseRecentDays()]
- "worklog_entry_evidence_meetingsattended": "meetingsAttended()" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L176 | neighbors=[entry-evidence.ts, loadDayEvidence(), dayWindow()]
- "worklog_entry_evidence_summariserecentdays": "summariseRecentDays()" | kind=code-symbol | source=src/features/worklog/entry-evidence.ts:L439 | neighbors=[entry-evidence.ts, loadDrafterContext(), entry-evidence.test.ts]
- "worklog_entry_evidence_test": "entry-evidence.test.ts" | kind=code-symbol | source=src/features/worklog/entry-evidence.test.ts:L1 | neighbors=[5e32b09 fix(worklog): Fill my day ignor…, entry-evidence.ts, summariseRecentDays()]
- "worklog_entry_form_entryformfields": "EntryFormFields" | kind=code-symbol | source=src/features/worklog/entry-form.ts:L23 | neighbors=[day-hours-card.tsx, entry-form.ts, entry-form.test.ts]
- "worklog_entry_language_linetoken": "LineToken" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L326 | neighbors=[day-one-line.tsx, log-box.tsx, entry-language.ts]
- "worklog_entry_language_parseduration": "parseDuration()" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L297 | neighbors=[day-hours-card.tsx, entry-language.ts, entry-language.test.ts]
- "worklog_entry_queries_getmyentrytotalsinrange": "getMyEntryTotalsInRange()" | kind=code-symbol | source=src/features/worklog/entry-queries.ts:L182 | neighbors=[catch-up-actions.ts, entry-queries.ts, page.tsx]
- "worklog_entry_queries_worklogentryrow": "WorklogEntryRow" | kind=code-symbol | source=src/features/worklog/entry-queries.ts:L30 | neighbors=[day-hours-card.tsx, day-panel.tsx, entry-queries.ts]
- "worklog_entry_suggestions_buildentrysuggestions": "buildEntrySuggestions()" | kind=code-symbol | source=src/features/worklog/entry-suggestions.ts:L56 | neighbors=[entry-suggestions.ts, dedupe(), entry-suggestions.test.ts]
- "worklog_error": "error.tsx" | kind=code-symbol | source=src/app/(app)/worklog/error.tsx:L1 | neighbors=[button.tsx, Button(), WorklogError()]
- "worklog_guest_projects_partitionguestapps": "partitionGuestApps()" | kind=code-symbol | source=src/features/worklog/guest-projects.ts:L23 | neighbors=[worklog-form.tsx, guest-projects.ts, guest-projects.test.ts]
- "worklog_holiday_listing_splitbyday": "splitByDay()" | kind=code-symbol | source=src/features/worklog/holiday-listing.ts:L103 | neighbors=[org-holidays-card.tsx, holiday-listing.ts, holiday-listing.test.ts]
- "worklog_missing_days_test": "missing-days.test.ts" | kind=code-symbol | source=src/features/worklog/missing-days.test.ts:L1 | neighbors=[missing-days.ts, isRequiredWorkDay(), missingWorkDays()]
- "worklog_note_app_tags_appref": "AppRef" | kind=code-symbol | source=src/features/worklog/note-app-tags.ts:L18 | neighbors=[note-app-tags.ts, note-app-tags.test.ts, page.tsx]
- "worklog_nudge_nudgebody": "nudgeBody()" | kind=code-symbol | source=src/features/worklog/nudge.ts:L122 | neighbors=[route.ts, nudge.ts, nudge.test.ts]
- "worklog_nudge_nudgeinput": "NudgeInput" | kind=code-symbol | source=src/features/worklog/nudge.ts:L38 | neighbors=[nudge.ts, nudge-queries.ts, nudge.test.ts]
- "worklog_nudge_planworklognudges": "planWorklogNudges()" | kind=code-symbol | source=src/features/worklog/nudge.ts:L83 | neighbors=[route.ts, nudge.ts, nudge.test.ts]
- "worklog_org_holidays_isorgholidayinforce": "isOrgHolidayInForce()" | kind=code-symbol | source=src/features/worklog/org-holidays.ts:L25 | neighbors=[holiday-listing.ts, org-holidays.ts, orgHolidaySet()]
- "worklog_page_maxiso": "maxIso()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L288 | neighbors=[page.tsx, CalendarZone(), SummaryZone()]
- "worklog_page_miniso": "minIso()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L287 | neighbors=[page.tsx, CalendarZone(), SummaryZone()]
- "worklog_page_worklogpage": "WorklogPage()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L108 | neighbors=[page.tsx, firstParam(), isRealDay()]
- "worklog_progress_params_progressparams": "ProgressParams" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L26 | neighbors=[progress-filters.tsx, page.tsx, progress-params.ts]
- "worklog_progress_queries_getprogressmatrix": "getProgressMatrix()" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L108 | neighbors=[page.tsx, page.tsx, progress-queries.ts]
- "worklog_queries_countmyworklogdays": "countMyWorklogDays()" | kind=code-symbol | source=src/features/worklog/queries.ts:L61 | neighbors=[first-log-nudge.tsx, page.tsx, queries.ts]
- "worklog_queries_getmypendingabsences": "getMyPendingAbsences()" | kind=code-symbol | source=src/features/worklog/queries.ts:L264 | neighbors=[context-pack.ts, page.tsx, queries.ts]
- "worklog_queries_getmyworklogsinrange": "getMyWorklogsInRange()" | kind=code-symbol | source=src/features/worklog/queries.ts:L91 | neighbors=[catch-up-actions.ts, page.tsx, queries.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-079.json

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
