# Node Description Batch 44 of 166

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
LANGUAGE: each entry has a `lang=` marker giving the language of its source.
Write that entry's description in EXACTLY that language. Do not translate to
a single common language — match each node's source language individually.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "auth_webauthn_actions_beginpasskeylogin": "beginPasskeyLogin()" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L194 | neighbors=[webauthn-actions.ts, relyingParty(), setChallengeCookie(), passkey-login-button.tsx] | lang=en
- "auth_webauthn_actions_beginpasskeyregistration": "beginPasskeyRegistration()" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L83 | neighbors=[webauthn-actions.ts, relyingParty(), setChallengeCookie(), passkeys-card.tsx] | lang=en
- "auth_webauthn_actions_completepasskeyregistration": "completePasskeyRegistration()" | kind=code-symbol | source=src/features/auth/webauthn-actions.ts:L137 | neighbors=[webauthn-actions.ts, relyingParty(), takeChallengeCookie(), passkeys-card.tsx] | lang=en
- "bugs_actions_deletebug": "deleteBug()" | kind=code-symbol | source=src/features/bugs/actions.ts:L307 | neighbors=[actions.ts, revalidateBug(), unexpected(), delete-bug-button.tsx] | lang=en
- "bugs_actions_reportbug": "reportBug()" | kind=code-symbol | source=src/features/bugs/actions.ts:L74 | neighbors=[actions.ts, revalidateBug(), unexpected(), report-bug-dialog.tsx] | lang=en
- "bugs_actions_triagebug": "triageBug()" | kind=code-symbol | source=src/features/bugs/actions.ts:L128 | neighbors=[actions.ts, revalidateBug(), unexpected(), bug-triage-controls.tsx] | lang=en
- "bugs_actions_updatebugcontent": "updateBugContent()" | kind=code-symbol | source=src/features/bugs/actions.ts:L246 | neighbors=[actions.ts, revalidateBug(), unexpected(), bug-content-editor.tsx] | lang=en
- "bugs_bug_display_bugseveritybadgevariant": "bugSeverityBadgeVariant()" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L119 | neighbors=[bug-display.ts, bug-display.test.ts, bug-csv-import-dialog.tsx, bug-list.tsx] | lang=en
- "bugs_bug_display_bugstatusbadgevariant": "bugStatusBadgeVariant()" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L123 | neighbors=[bug-display.ts, bug-display.test.ts, bug-csv-import-dialog.tsx, bug-list.tsx] | lang=en
- "bugs_bug_display_issettledbugstatus": "isSettledBugStatus()" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L58 | neighbors=[actions.ts, bug-display.ts, isOpenBugStatus(), bug-display.test.ts] | lang=en
- "bugs_bug_display_severities_worst_first": "SEVERITIES_WORST_FIRST" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L35 | neighbors=[bug-display.ts, bug-display.test.ts, bug-list.tsx, bug-triage-controls.tsx] | lang=en
- "bugs_import_actions_previewbugcsvimport": "previewBugCsvImport()" | kind=code-symbol | source=src/features/bugs/import-actions.ts:L214 | neighbors=[import-actions.ts, resolveImport(), unexpected(), bug-csv-import-dialog.tsx] | lang=en
- "bugs_report_input_bugreportinput": "bugReportInput" | kind=code-symbol | source=src/features/bugs/report-input.ts:L133 | neighbors=[actions.ts, bug-csv.ts, report-input.ts, report-input.test.ts] | lang=en
- "bugs_report_input_parsebugfilters": "parseBugFilters()" | kind=code-symbol | source=src/features/bugs/report-input.ts:L234 | neighbors=[page.tsx, report-input.ts, report-input.test.ts, page.tsx] | lang=en
- "calendar_google_calendar_classifycalendarerror": "classifyCalendarError()" | kind=code-symbol | source=src/features/calendar/google-calendar.ts:L218 | neighbors=[google-calendar.ts, describeCalendarError(), google-calendar.test.ts, actions.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@00ce430599a73d792ae1f21245456cdc811282fd": "00ce430 feat(fonts): bundle Noto Sans Sinhala so printed Sinhala looks the same…" | kind=Commit | source=git | neighbors=[layout.tsx, main, aefdc36 docs(spec): multi-discipline pr…, 817bf89 .] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@137eacc32284a5c512cb2e8068efd3abf7d10c22": "137eacc docs(intel): write down which absence set the gap filter means, since n…" | kind=Commit | source=git | neighbors=[main, 1eb625d docs(intel): name the gap-list …, context-pack.ts, 743b1f2 fix(ui): a false-positive tag m…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@1c2fee5e2181d3a7bc24fc8207136b0d0bf8fef6": "1c2fee5 fix(worklog): a trashed task must not accept hours" | kind=Commit | source=git | neighbors=[main, 050a921 feat(calendar): classify a two-…, entry-actions.ts, 924eca4 feat(calendar): expand a daily …] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@1eb625d718e41c40ea5683391d62ba00f03d29d4": "1eb625d docs(intel): name the gap-list / denominator asymmetry before it reads …" | kind=Commit | source=git | neighbors=[137eacc docs(intel): write down which a…, main, 3c30bf4 worklog: per-task hours substra…, context-pack.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@227e958274df0c77f863bf7c28fcbc4cace5ead8": "227e958 build: npm run verify:head — typecheck the commit, not the working tree" | kind=Commit | source=git | neighbors=[main, 3d461b5 fix(home): derive advertised Ge…, verify-head.mjs, c6cff98 feat(auth): gate money behind o…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@264e022913611c2089da1c9c16740e497ea0a0ac": "264e022 fix(home): align three read sites with MeetingIntelItem's field names" | kind=Commit | source=git | neighbors=[main, 89dee50 fix(ui): craft regressions the …, hero-showcase.tsx, 3e3e1f7 fix(sign-in): restore the ring …] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@325eb16145c4cf3439893d452b89f54c672ee15b": "325eb16 fix(search): one finance entry per allowlist, not two" | kind=Commit | source=git | neighbors=[main, 2865231 feat(deadlines): route all thre…, registry.test.ts, ba3e95b test(auth): stop a red that dep…] | lang=it
- "commit:repo:github.com/DeegayuA/LogPup@3e134d44d54b7c3023e18bf14b8cd3359b0bcc9a": "3e134d4 fix(finance): project cost counted only task hours, so almost none of it" | kind=Commit | source=git | neighbors=[main, 3ba31df feat(shell): every admin sectio…, queries.ts, d5b6409 .] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@3e3e1f760379d7c04c83c77aa934b3bdbde9c60e": "3e3e1f7 fix(sign-in): restore the ring pulse, and stop the comment contradictin…" | kind=Commit | source=git | neighbors=[main, 264e022 fix(home): align three read sit…, sign-in-backdrop.tsx, 55c832b fix(worklog): stop the catch-up…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@3ed16a6c9bcc566c8dc70f655d5e5b9d561c2a8e": "3ed16a6 feat(worklog): fix an entry's kind and project without deleting it" | kind=Commit | source=git | neighbors=[main, 95b092e feat(meetings): quick note and …, day-hours-card.tsx, c5251d4 fix(gemini): six holes an adver…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@44b1c489c0cf08dbbd8bb4c23f17eb7d1654effb": "44b1c48 feat(auth): Continue with GitHub, in the Notion shape rather than the G…" | kind=Commit | source=git | neighbors=[main, b35d96b fix(worklog): two hours reads c…, auth.ts, 7228d54 refactor(meetings): one derivat…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@49350d61cf3640263770a1584ed2b778b4679ffe": "49350d6 feat(meetings): \"Copy here\" — the keyboard route to the alt-drag copy" | kind=Commit | source=git | neighbors=[main, 24fb822 fix(worklog): two absence write…, meeting-detail-dialog.tsx, e8b2ac2 feat(worklog): hours you logged…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@4ba83e648d3ef94f9194e127a4725c2cdcbab4f7": "4ba83e6 test(people): guard the open/done pair in getPersonWorkload" | kind=Commit | source=git | neighbors=[main, 001694a refactor(tasks): express the co…, queries.test.ts, 94c35aa fix(tasks): un-rot the terminal…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@55c832b82b9690f6b4417cb97e0f83fd90d7ed99": "55c832b fix(worklog): stop the catch-up run claiming days it did not draft" | kind=Commit | source=git | neighbors=[473168b docs: restore the reasoning the…, main, 3e3e1f7 fix(sign-in): restore the ring …, catch-up-panel.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@5718264307005131ae1b11974835ddc054817563": "5718264 feat(admin): overview answers \"what needs me\", then \"where is everythin…" | kind=Commit | source=git | neighbors=[3ba31df feat(shell): every admin sectio…, page.tsx, main, f8a9b00 feat(gemini): the meter learns …] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@59aa7b94a6cf130f548b6c28388e894e99afbb54": "59aa7b9 feat(search): people's cohort views join the palette, derived not listed" | kind=Commit | source=git | neighbors=[35d16f8 feat(finance): server layer for…, main, e432241 feat(deadlines): the escalation…, commands.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@624466e9762a0a064c2102fca015dcca2228a727": "624466e feat(gemini): the ownership query behind the key census" | kind=Commit | source=git | neighbors=[main, 51008f1 feat(worklog): one click fills …, queries.ts, c2f2819 feat(meetings): work out which …] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@644d391b260bf8a2dd99a267649c70f0821a551c": "644d391 feat(meetings): ask before closing a tab that still holds unsent audio" | kind=Commit | source=git | neighbors=[2b9e5c5 feat(meetings): rebuild the rec…, main, 72b853c feat(meetings): segment upload …, meeting-intel.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@6c9beed5556fc0b14b881688ddc9386ccf82d69c": "6c9beed test(search): the github feature is evidence plumbing, not a palette row" | kind=Commit | source=git | neighbors=[main, 047a7e7 feat(people): change someone's …, registry.test.ts, 8fa8f26 feat(worklog): the whole day in…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@8249431f52260f4cc0671dd17636f26679ea8db5": "8249431 test(meeting-load): end-to-end cover for the claim that matters" | kind=Commit | source=git | neighbors=[5c7efa5 feat(meeting-load): four surfac…, main, 456f0e2 docs(meeting-load): record what…, meeting-load.spec.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@82d20fd56ee2016be38fad831e719d691095dae1": "82d20fd docs(home): the KNOWN LIMIT paragraph named a constant I had deleted" | kind=Commit | source=git | neighbors=[main, e282043 feat(deadlines): grade the date…, hero-showcase.tsx, 85c3961 feat(finance): cost and worth d…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@8cfbffdc9379cfbd4a5eb2bca93ef3f1191ad018": "8cfbffd fix(worklog): the hours selects showed raw values, not labels" | kind=Commit | source=git | neighbors=[752ea90 style(theme): the ember token f…, main, a448866 style(theme): use #7f00ff for h…, day-hours-card.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@94c35aa3bb6c6b7de95f99392e5ebe9666954773": "94c35aa fix(tasks): un-rot the terminal-status seam comment's call-site claim" | kind=Commit | source=git | neighbors=[main, 4ba83e6 test(people): guard the open/do…, board-view.ts, a9d31f4 refactor(tasks): add isTerminal…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@9ac37055bed4c71a4e41144b05676eae3386065c": "9ac3705 feat(worklog): run the cross-check that was written and never called" | kind=Commit | source=git | neighbors=[966d695 feat(intel): the briefing uses …, main, 72473a0 feat(meetings): alt-drag a bloc…, day-hours-card.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@a1e227e7e5aec56c731b60dbd77c66c044f8e9f3": "a1e227e feat(search): a zero-hit search becomes a question, not a dead end" | kind=Commit | source=git | neighbors=[main, 029ff45 feat(search): worklog and activ…, command-center.tsx, dd6f2fd feat(worklog): define how long …] | lang=pt

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-043.json

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
