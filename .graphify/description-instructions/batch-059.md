# Node Description Batch 60 of 166

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
For an entity node (any other kind — e.g. a person, place, event, object),
describe what the entity is and its role, grounded in its type, its
relations (neighbors) and the provided citations/evidence — e.g.
"Lady Carfax, a wealthy heiress who disappears en route to Lausanne.".
Ground entity descriptions in the citations/evidence when present; do not
speculate beyond the context, so a node with no supporting context may be
left out of the reply.
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "auth_webauthn_actions_setchallengecookie": "setChallengeCookie()" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L58 | neighbors=[webauthn-actions.ts, beginPasskeyLogin(), beginPasskeyRegistration()]
- "auth_webauthn_actions_takechallengecookie": "takeChallengeCookie()" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L70 | neighbors=[webauthn-actions.ts, completePasskeyLogin(), completePasskeyRegistration()]
- "bugs_actions_loadmoretriagebugs": "loadMoreTriageBugs()" | kind=code-symbol | source=src/features/bugs/actions.ts:L209 | neighbors=[actions.ts, unexpected(), triage-queue-pager.tsx]
- "bugs_bug_csv_bug_csv_columns": "BUG_CSV_COLUMNS" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L92 | neighbors=[bug-csv.ts, bug-csv.test.ts, bug-csv-import-dialog.tsx]
- "bugs_bug_csv_bug_csv_example_row": "BUG_CSV_EXAMPLE_ROW" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L182 | neighbors=[bug-csv.ts, bug-csv.test.ts, bug-csv-import-dialog.tsx]
- "bugs_bug_csv_bug_csv_headers": "BUG_CSV_HEADERS" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L137 | neighbors=[bug-csv.ts, bug-csv.test.ts, bug-csv-import-dialog.tsx]
- "bugs_bug_csv_describebugimport": "describeBugImport()" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L586 | neighbors=[bug-csv.ts, bug-csv.test.ts, import-actions.ts]
- "bugs_bug_csv_istemplateexamplerow": "isTemplateExampleRow()" | kind=code-symbol | source=src/features/bugs/bug-csv.ts:L235 | neighbors=[bug-csv.ts, parseBugCsv(), bug-csv.test.ts]
- "bugs_bug_csv_test_reasonsfor": "reasonsFor()" | kind=code-symbol | source=src/features/bugs/bug-csv.test.ts:L366 | neighbors=[bug-csv.test.ts, file(), parseOk()]
- "bugs_bug_display_isopenbugstatus": "isOpenBugStatus()" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L46 | neighbors=[bug-display.ts, isSettledBugStatus(), bug-display.test.ts]
- "bugs_import_actions_resolveimport": "resolveImport()" | kind=code-symbol | source=src/features/bugs/import-actions.ts:L124 | neighbors=[import-actions.ts, importBugCsvRows(), previewBugCsvImport()]
- "bugs_import_actions_unexpected": "unexpected()" | kind=code-symbol | source=src/features/bugs/import-actions.ts:L102 | neighbors=[import-actions.ts, importBugCsvRows(), previewBugCsvImport()]
- "bugs_queries_bugqueuerow": "BugQueueRow" | kind=code-symbol | source=src/features/bugs/queries.ts:L61 | neighbors=[queries.ts, bug-list.tsx, triage-queue-pager.tsx]
- "bugs_queries_getopenbugcounts": "getOpenBugCounts()" | kind=code-symbol | source=src/features/bugs/queries.ts:L175 | neighbors=[page.tsx, queries.ts, progress-queries.ts]
- "bugs_queries_listtriagequeue": "listTriageQueue()" | kind=code-symbol | source=src/features/bugs/queries.ts:L205 | neighbors=[actions.ts, page.tsx, queries.ts]
- "bugs_queue_page_triagequeueconditions": "triageQueueConditions()" | kind=code-symbol | source=src/features/bugs/queue-page.ts:L42 | neighbors=[queries.ts, queue-page.ts, queue-page.test.ts]
- "bugs_report_input_bugfilterhref": "bugFilterHref()" | kind=code-symbol | source=src/features/bugs/report-input.ts:L256 | neighbors=[report-input.ts, report-input.test.ts, page.tsx]
- "bugs_report_input_bugtriageinput": "bugTriageInput" | kind=code-symbol | source=src/features/bugs/report-input.ts:L183 | neighbors=[actions.ts, report-input.ts, report-input.test.ts]
- "bugs_report_input_stripissuetemplate": "stripIssueTemplate()" | kind=code-symbol | source=src/features/bugs/report-input.ts:L72 | neighbors=[bug-csv.ts, report-input.ts, report-input.test.ts]
- "calendar_google_calendar_buildconferencedatarequest": "buildConferenceDataRequest()" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L19 | neighbors=[google-calendar.ts, createCalendarEvent(), google-calendar.test.ts]
- "calendar_google_calendar_deletecalendarevent": "deleteCalendarEvent()" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L302 | neighbors=[google-calendar.ts, client(), actions.ts]
- "calendar_google_calendar_extractmeetlink": "extractMeetLink()" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L36 | neighbors=[google-calendar.ts, createCalendarEvent(), google-calendar.test.ts]
- "calendar_google_calendar_sentencefor": "sentenceFor()" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L290 | neighbors=[google-calendar.ts, describeCalendarError(), google-calendar.test.ts]
- "calendar_google_calendar_updatecalendarevent": "updateCalendarEvent()" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L136 | neighbors=[google-calendar.ts, google-calendar.test.ts, client()]
- "calendar_google_calendar_updatecalendareventtime": "updateCalendarEventTime()" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L90 | neighbors=[google-calendar.ts, client(), actions.ts]
- "commit:repo:github.com/DeegayuA/LogPup@3893a7b5d4a9087f648c47c446f65dd186a32429": "3893a7b style(theme): holiday moves from amber to purple, in both themes" | kind=Commit | source=git | neighbors=[main, 6e7c05f fix(intel): stop printing a per…, d78a3e1 fix(intel): the briefing links …]
- "commit:repo:github.com/DeegayuA/LogPup@456f0e24b9d35471c949ae2b5338e109b6c70a35": "456f0e2 docs(meeting-load): record what B shipped as, and what stays quiet" | kind=Commit | source=git | neighbors=[main, 2b9e5c5 feat(meetings): rebuild the rec…, 8249431 test(meeting-load): end-to-end …]
- "commit:repo:github.com/DeegayuA/LogPup@4e4cf9fad0e51c2d8ea81d05349702794a49c544": "4e4cf9f Ask LogPup: knowledge index, graph and grounded answers — design spec" | kind=Commit | source=git | neighbors=[3ac9d68 ., main, a3168f0 Ask LogPup spec: meeting-family…]
- "commit:repo:github.com/DeegayuA/LogPup@5e11dbf1a5d287e7e6d3ceba2588dffa510bec58": "5e11dbf docs(plan): WS0 terminal-status seam, and correct the spec's SQL claim" | kind=Commit | source=git | neighbors=[main, f823a54 feat(meetings): correct a mishe…, 6e082d3 docs(spec): measure the seam's …]
- "commit:repo:github.com/DeegayuA/LogPup@6e082d327c81f87eff16e78aeea4b00570e9c34f": "6e082d3 docs(spec): measure the seam's real risk instead of asserting it" | kind=Commit | source=git | neighbors=[main, 5e11dbf docs(plan): WS0 terminal-status…, 7323466 docs(spec): record confirmed mi…]
- "commit:repo:github.com/DeegayuA/LogPup@7323466fd77940544785dce71902581f0099362e": "7323466 docs(spec): record confirmed migration slots, shell overlap, Gemini sta…" | kind=Commit | source=git | neighbors=[main, 6e082d3 docs(spec): measure the seam's …, aefdc36 docs(spec): multi-discipline pr…]
- "commit:repo:github.com/DeegayuA/LogPup@7479d4a1403c5ac2693cb09a2fc7660d96039c37": "7479d4a docs(specs): measure the work, not the worker" | kind=Commit | source=git | neighbors=[main, 13be4b6 ., afba1c3 feat(worklog): the hours form c…]
- "commit:repo:github.com/DeegayuA/LogPup@752ea90ebfed86e815d24cdb312d5e8f7f80edcd": "752ea90 style(theme): the ember token follows holiday to purple" | kind=Commit | source=git | neighbors=[main, 8cfbffd fix(worklog): the hours selects…, b1ef1b9 feat(worklog): log where the da…]
- "commit:repo:github.com/DeegayuA/LogPup@7b6d19cacfe6ffc21c3ccb8beb17d83c336d9779": "7b6d19c docs: cost spec — gate aggregate reads, not just the rate field" | kind=Commit | source=git | neighbors=[029ff45 feat(search): worklog and activ…, main, c6cff98 feat(auth): gate money behind o…]
- "commit:repo:github.com/DeegayuA/LogPup@92857d07e6cccf5d532ae8e6f53f15789b425197": "92857d0 docs: cost spec — finance.view is the gate, with its three deliberate p…" | kind=Commit | source=git | neighbors=[0ef5105 fix(intel): a briefing priority…, main, cbd4a9c feat(search): gemini joins the …]
- "commit:repo:github.com/DeegayuA/LogPup@994627c590e971111340d7c3bcd689f721e04037": "994627c style(theme): warning joins the purple family — the last amber goes" | kind=Commit | source=git | neighbors=[main, 232b7ef ., a448866 style(theme): use #7f00ff for h…]
- "commit:repo:github.com/DeegayuA/LogPup@a3168f0b4b1c01aebb45c43d5b2679c351b144da": "a3168f0 Ask LogPup spec: meeting-family reach mirrors the live gates; reconcile…" | kind=Commit | source=git | neighbors=[4e4cf9f Ask LogPup: knowledge index, gr…, main, a8c5100 .]
- "commit:repo:github.com/DeegayuA/LogPup@a44886671eb8e5e4be4a1119f2fdc1b2406521d9": "a448866 style(theme): use #7f00ff for holiday and the ember highlight" | kind=Commit | source=git | neighbors=[8cfbffd fix(worklog): the hours selects…, main, 994627c style(theme): warning joins the…]
- "commit:repo:github.com/DeegayuA/LogPup@aefdc3668a7338a7b28982fe9c1d7e3c44bb4421": "aefdc36 docs(spec): multi-discipline projects — EPC, hardware, networking" | kind=Commit | source=git | neighbors=[00ce430 feat(fonts): bundle Noto Sans S…, main, 7323466 docs(spec): record confirmed mi…]
- "commit:repo:github.com/DeegayuA/LogPup@c8914a7b82b42071c8cd77c4626c818eae5a19fa": "c8914a7 feat(intel): an error boundary that names the page that failed" | kind=Commit | source=git | neighbors=[6909ea3 feat(worklog): AI drafts the da…, main, c2dbc08 fix(admin): stop approved chang…]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-059.json

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
