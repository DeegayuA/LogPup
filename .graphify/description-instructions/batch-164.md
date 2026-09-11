# Node Description Batch 165 of 166

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

- "worklog_entry_suggestions_test_empty": "EMPTY" | kind=code-symbol | source=src/features/worklog/entry-suggestions.test.ts:L7 | neighbors=[entry-suggestions.test.ts]
- "worklog_entry_suggestions_test_roles": "roles()" | kind=code-symbol | source=src/features/worklog/entry-suggestions.test.ts:L5 | neighbors=[entry-suggestions.test.ts]
- "worklog_entry_suggestions_withtag": "withTag()" | kind=code-symbol | source=src/features/worklog/entry-suggestions.ts:L101 | neighbors=[entry-suggestions.ts]
- "worklog_error_worklogerror": "WorklogError()" | kind=code-symbol | source=src/app/(app)/worklog/error.tsx:L15 | neighbors=[error.tsx]
- "worklog_guest_projects_test_guests": "guests" | kind=code-symbol | source=src/features/worklog/guest-projects.test.ts:L5 | neighbors=[guest-projects.test.ts]
- "worklog_holiday_listing_holidaysource": "HolidaySource" | kind=code-symbol | source=src/features/worklog/holiday-listing.ts:L35 | neighbors=[holiday-listing.ts]
- "worklog_holiday_listing_test_gazette": "gazette" | kind=code-symbol | source=src/features/worklog/holiday-listing.test.ts:L6 | neighbors=[holiday-listing.test.ts]
- "worklog_holiday_listing_test_orgrow": "orgRow()" | kind=code-symbol | source=src/features/worklog/holiday-listing.test.ts:L11 | neighbors=[holiday-listing.test.ts]
- "worklog_loading_worklogloading": "WorklogLoading()" | kind=code-symbol | source=src/app/(app)/worklog/loading.tsx:L9 | neighbors=[loading.tsx]
- "worklog_note_app_tags_normalise": "normalise()" | kind=code-symbol | source=src/features/worklog/note-app-tags.ts:L53 | neighbors=[note-app-tags.ts]
- "worklog_note_app_tags_noteapptag": "NoteAppTag" | kind=code-symbol | source=src/features/worklog/note-app-tags.ts:L21 | neighbors=[note-app-tags.ts]
- "worklog_note_app_tags_taggednote": "TaggedNote" | kind=code-symbol | source=src/features/worklog/note-app-tags.ts:L23 | neighbors=[note-app-tags.ts]
- "worklog_note_app_tags_test_apps": "APPS" | kind=code-symbol | source=src/features/worklog/note-app-tags.test.ts:L9 | neighbors=[note-app-tags.test.ts]
- "worklog_nudge_test_person": "person()" | kind=code-symbol | source=src/features/worklog/nudge.test.ts:L10 | neighbors=[nudge.test.ts]
- "worklog_nudge_worklognudge": "WorklogNudge" | kind=code-symbol | source=src/features/worklog/nudge.ts:L55 | neighbors=[nudge.ts]
- "worklog_org_holiday_actions_addinput": "addInput" | kind=code-symbol | source=src/features/worklog/org-holiday-actions.ts:L13 | neighbors=[org-holiday-actions.ts]
- "worklog_org_holidays_orgholidayrow": "OrgHolidayRow" | kind=code-symbol | source=src/features/worklog/org-holidays.ts:L7 | neighbors=[org-holidays.ts]
- "worklog_page_calendarskeleton": "CalendarSkeleton()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L1482 | neighbors=[page.tsx]
- "worklog_page_closedstudiodays": "closedStudioDays()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L277 | neighbors=[page.tsx]
- "worklog_page_logskeleton": "LogSkeleton()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L1505 | neighbors=[page.tsx]
- "worklog_page_metadata": "metadata" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L69 | neighbors=[page.tsx]
- "worklog_page_notewithapptags": "NoteWithAppTags()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L1404 | neighbors=[page.tsx]
- "worklog_page_summaryskeleton": "SummarySkeleton()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L1469 | neighbors=[page.tsx]
- "worklog_page_teamskeleton": "TeamSkeleton()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L1521 | neighbors=[page.tsx]
- "worklog_page_teamzone": "TeamZone()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L1113 | neighbors=[page.tsx]
- "worklog_page_workedapps": "WorkedApps()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L1387 | neighbors=[page.tsx]
- "worklog_page_zoneerror": "ZoneError()" | kind=code-symbol | source=src/app/(app)/worklog/page.tsx:L1449 | neighbors=[page.tsx]
- "worklog_progress_params_progressrange": "ProgressRange" | kind=code-symbol | source=src/features/worklog/progress-params.ts:L19 | neighbors=[progress-params.ts]
- "worklog_progress_queries_logginginforce": "loggingInForce()" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L88 | neighbors=[progress-queries.ts]
- "worklog_progress_queries_progresspersonrow": "ProgressPersonRow" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L38 | neighbors=[progress-queries.ts]
- "worklog_progress_queries_schedulewindowrow": "ScheduleWindowRow" | kind=code-symbol | source=src/features/worklog/progress-queries.ts:L75 | neighbors=[progress-queries.ts]
- "worklog_queries_absencecolumns": "absenceColumns" | kind=code-symbol | source=src/features/worklog/queries.ts:L247 | neighbors=[queries.ts]
- "worklog_queries_getmyworklogdays": "getMyWorklogDays()" | kind=code-symbol | source=src/features/worklog/queries.ts:L202 | neighbors=[queries.ts]
- "worklog_queries_getmyworklogs": "getMyWorklogs()" | kind=code-symbol | source=src/features/worklog/queries.ts:L70 | neighbors=[queries.ts]
- "worklog_queries_mydecidedabsence": "MyDecidedAbsence" | kind=code-symbol | source=src/features/worklog/queries.ts:L240 | neighbors=[queries.ts]
- "worklog_queries_teamabsencerange": "TeamAbsenceRange" | kind=code-symbol | source=src/features/worklog/queries.ts:L329 | neighbors=[queries.ts]
- "worklog_queries_teammember": "TeamMember" | kind=code-symbol | source=src/features/worklog/queries.ts:L492 | neighbors=[queries.ts]
- "worklog_queries_teamworklogrow": "TeamWorklogRow" | kind=code-symbol | source=src/features/worklog/queries.ts:L32 | neighbors=[queries.ts]
- "worklog_queries_test_rows": "rows" | kind=code-symbol | source=src/features/worklog/queries.test.ts:L7 | neighbors=[queries.test.ts]
- "worklog_queries_test_selected": "selected" | kind=code-symbol | source=src/features/worklog/queries.test.ts:L8 | neighbors=[queries.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-164.json

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
