# Node Description Batch 30 of 166

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

- "auth_capabilities_user_roles": "USER_ROLES" | kind=code-symbol | source=src/features/auth/capabilities.ts:L17 | neighbors=[actions.ts, bulk-actions.ts, capabilities.ts, capabilities.test.ts, zones.ts, zones.test.ts] | lang=en
- "brand_alta_vision_logo_altavisionlogo": "AltaVisionLogo()" | kind=code-symbol | source=src/components/brand/alta-vision-logo.tsx:L31 | neighbors=[alta-vision-logo.tsx, page.tsx, layout.tsx, mobile-nav.tsx, sidebar.tsx, page.tsx] | lang=en
- "bugs_actions_unexpected": "unexpected()" | kind=code-symbol | source=src/features/bugs/actions.ts:L54 | neighbors=[actions.ts, deleteBug(), loadMoreTriageBugs(), reportBug(), triageBug(), updateBugContent()] | lang=en
- "bugs_bug_display_bugseverity": "BugSeverity" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L24 | neighbors=[bug-csv.ts, bug-display.ts, queries.ts, report-input.ts, bug-list.tsx, bug-triage-controls.tsx] | lang=en
- "bugs_bug_display_bugstatus": "BugStatus" | kind=code-symbol | source=src/features/bugs/bug-display.ts:L28 | neighbors=[bug-csv.ts, bug-display.ts, queries.ts, report-input.ts, bug-list.tsx, bug-triage-controls.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@11575db24f3e8cd6b603dc3e4c9676925bbd9b50": "11575db fix(worklog): project chips can be clicked off again" | kind=Commit | source=git | neighbors=[main, 77dfc15 fix(worklog): no task entry cou…, worklog-form.tsx, note-app-tags.ts, note-app-tags.test.ts, 364f1af fix(search): ⌘K was handing eve…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@2bd871d449b9f73f768f0585224929a40c86c911": "2bd871d feat(apps): download the team, names and work addresses" | kind=Commit | source=git | neighbors=[0a2e8bb feat(gemini): ask Google what m…, main, cdc541d feat(deadlines): let a PM uploa…, team-panel.tsx, queries.ts, page.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@51008f19948720c04ac349b439b1764a4d717463": "51008f1 feat(worklog): one click fills the day's hours from what LogPup already…" | kind=Commit | source=git | neighbors=[main, a628b27 feat(worklog): the progress gri…, day-hours-card.tsx, entry-queries.ts, page.tsx, 624466e feat(gemini): the ownership que…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@5d6c4592ea4cda66abdae51ea4129feb3fec7bde": "5d6c459 fix(home): resolve model rates on the server, and point the palette at …" | kind=Commit | source=git | neighbors=[main, 8e2986a feat(calendar): push the whole …, commands.ts, hero-showcase.tsx, page.tsx, d7a4a59 fix(people): a follow-up that a…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@695a0476864a14c171728219d31d6f16f5079825": "695a047 fix(worklog): one fill button, and a day panel that fits on a laptop" | kind=Commit | source=git | neighbors=[58b4984 fix(worklog): the team grid sto…, main, c032099 fix(worklog): the Save button s…, day-hours-card.tsx, day-panel.tsx, worklog-form.tsx] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@8d1c18053de278949b28fc34de5c51e76da7c885": "8d1c180 fix(worklog): lift absenceDays out of the page, and render a bullet as …" | kind=Commit | source=git | neighbors=[main, 473168b docs: restore the reasoning the…, worklog-form.tsx, absence-days.test.ts, page.tsx, f180d72 feat(people): capacity in hours…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@8d28f33e23d508776579208206774ab078e5b190": "8d28f33 feat(notifications): dedupe, a daily cap, and nobody notified about the…" | kind=Commit | source=git | neighbors=[main, c93474b feat(notifications): a schedule…, notify.ts, notify-rules.ts, notify-rules.test.ts, e5f8bbf feat(sprints): one door for tas…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@8dd587b4d1c74c6567ff4c8d76f9933490df0afd": "8dd587b feat(people): filter and sort the By project view, from the URL" | kind=Commit | source=git | neighbors=[272f9a7 feat(meetings): store the decis…, main, d614dea feat(people): rank the overlaps…, cohort-views.tsx, cohort-params.ts, page.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@8e5308d736a2ff154ab33dcabda1b926d9bb5c9a": "8e5308d feat(worklog): one grammar for a logged hour, in plain English" | kind=Commit | source=git | neighbors=[77dfc15 fix(worklog): no task entry cou…, main, 1b4f4ee feat(worklog): log an hour by w…, day-hours-card.tsx, entry-language.ts, entry-language.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@95b092e8526e7a88ff1efb083e95bb6f36d18e31": "95b092e feat(meetings): quick note and new meeting share one split pill in the …" | kind=Commit | source=git | neighbors=[3ed16a6 feat(worklog): fix an entry's k…, main, 702dd68 feat(db): takes become a thing …, meeting-header-actions.tsx, meetings-views.tsx, page.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@a9d31f426c57c05cdf10d31ab71e23a590e37b16": "a9d31f4 refactor(tasks): add isTerminal/OPEN_STATUSES seam beside TASK_STATUSES" | kind=Commit | source=git | neighbors=[main, 94c35aa fix(tasks): un-rot the terminal…, board-view.ts, board-view.test.ts, task-status.ts, f823a54 feat(meetings): correct a mishe…] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@abcd631b5f05edbf2f714306c18337ad96e3ff10": "abcd631 feat(db): a task can have several people, and a meeting can name its ne…" | kind=Commit | source=git | neighbors=[563cc1c fix(live): stop blaming the use…, main, 53262eb feat(tasks): several people can…, schema.ts, 0064_task_assignees.sql, 0066_next_meeting.sql] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@b1ef1b91a48a1583f380d85a8fef7024f412a72f": "b1ef1b9 feat(worklog): log where the day's hours went" | kind=Commit | source=git | neighbors=[6e7c05f fix(intel): stop printing a per…, main, 752ea90 style(theme): the ember token f…, day-hours-card.tsx, entry-queries.ts, page.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@b33670d73f79f4348cba44f7c095c60779d20c71": "b33670d feat(ui): make the three selects over unbounded lists searchable" | kind=Commit | source=git | neighbors=[main, d8e49ed fix(apps): ownership is a word,…, assign-dialog.tsx, danger-app-reset-card.tsx, danger-meeting-delete-card.tsx, e594a52 feat(apps): each app carries it…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@c032099d27d04c47aba4aa33f90f239660cb7985": "c032099 fix(worklog): the Save button says what it is waiting for" | kind=Commit | source=git | neighbors=[695a047 fix(worklog): one fill button, …, main, 8e831ec feat(worklog): the catch-up led…, worklog-form.tsx, day-form.ts, day-form.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@cbd4a9c002614a20f96da0fe428a758aa7a58c32": "cbd4a9c feat(search): gemini joins the palette, and its exemption was wrong not…" | kind=Commit | source=git | neighbors=[92857d0 docs: cost spec — finance.view …, main, d407ccc fix(settings): give the AI sect…, commands.ts, commands.ts, registry.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@d70c02bd7abffcfb102dee56379d15c09b82b1a3": "d70c02b fix(ui): bilingual live text survives a dead engine, and printed Sinhal…" | kind=Commit | source=git | neighbors=[5a95470 fix(meetings): transcripts stop…, main, 817bf89 ., activity-feed.tsx, meeting-intel.tsx, page.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@d78a3e18cd7e922b37bf45b39f11025485a28c5c": "d78a3e1 fix(intel): the briefing links its own evidence instead of printing bra…" | kind=Commit | source=git | neighbors=[main, 3893a7b style(theme): holiday moves fro…, briefing-card.tsx, answer-links.ts, answer-links.test.ts, ea1622e fix(intel): Ask LogPup reads as…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@d7a4a590167b247180691864f3e0656efe7157bb": "d7a4a59 fix(people): a follow-up that already became a task is one commitment, …" | kind=Commit | source=git | neighbors=[d407ccc fix(settings): give the AI sect…, main, 5d6c459 fix(home): resolve model rates …, followup-split.ts, followup-split.test.ts, queries.ts] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@d8efe4007940388dd99792b244844a904c4956f4": "d8efe40 feat(admin): reset a teammate's password from the people table" | kind=Commit | source=git | neighbors=[actions.ts, capabilities.ts, main, 3c0bc01 ., user-table.tsx, e2090c6 feat(meetings): "Not tracked" r…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@dda9cf6668b217c384876521c3ceace2681586e6": "dda9cf6 feat(worklog): the AI draft knows what your role on each project makes …" | kind=Commit | source=git | neighbors=[10e7430 fix(ui): a clipped seat descrip…, main, de4cd09 feat(ui): a select you can type…, draft-actions.ts, draft-prompt.ts, draft-prompt.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@de4cd0960a0224ebaa81bdc58a6b907fd5d28a9e": "de4cd09 feat(ui): a select you can type into, and use it to pick an app" | kind=Commit | source=git | neighbors=[dda9cf6 feat(worklog): the AI draft kno…, main, e594a52 feat(apps): each app carries it…, capacity-heat-editable.tsx, search-select.tsx, select.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@de769e3e87f80828b190cc651ec0b19959b1ddfc": "de769e3 refactor(csv): one RFC 4180 parser, beside the writer" | kind=Commit | source=git | neighbors=[41d5428 feat(people): the short read on…, bulk-logic.ts, main, bug-csv.ts, bug-csv.test.ts, 1eedff1 feat(people): a project's team …] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@e2090c6f6cbb0625e4ab0ab31f22373990ca3a74": "e2090c6 feat(meetings): \"Not tracked\" rows edit like every other suggestion" | kind=Commit | source=git | neighbors=[929997a feat(meetings): /meetings opens…, main, d8efe40 feat(admin): reset a teammate's…, meeting-notes.tsx, meeting-notes-model.ts, meeting-notes-model.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@fc6d16a8ffdac9080cb0d0d826546b7bf77a0514": "fc6d16a feat(worklog): one panel for the day, and one button that fills it" | kind=Commit | source=git | neighbors=[f114f1e docs(meetings): record what R6 …, main, 5deded7 feat(meeting-load): the metrics…, day-hours-card.tsx, day-panel.tsx, page.tsx] | lang=en
- "components_csv_download_downloadcsv": "downloadCsv()" | kind=code-symbol | source=src/features/admin/components/csv-download.ts:L14 | neighbors=[apps-table.tsx, audit-csv-button.tsx, bug-csv-import-dialog.tsx, csv-download.ts, team-panel.tsx, user-table.tsx] | lang=en
- "components_delete_bug_button": "delete-bug-button.tsx" | kind=code-symbol | source=src/features/bugs/components/delete-bug-button.tsx:L1 | neighbors=[bug-list.tsx, actions.ts, deleteBug(), DeleteBugButton(), button.tsx, Button()] | lang=en
- "components_dictate_button_dictatebutton": "DictateButton()" | kind=code-symbol | source=src/features/speech/components/dictate-button.tsx:L22 | neighbors=[activity-filter-bar.tsx, dictate-button.tsx, meeting-assistant.tsx, note-timeline.tsx, report-bug-dialog.tsx, worklog-form.tsx] | lang=en
- "components_export_button": "export-button.tsx" | kind=code-symbol | source=src/features/notion/components/export-button.tsx:L1 | neighbors=[ExportButton(), actions.ts, exportSprintToNotion(), button.tsx, Button(), page.tsx] | lang=en
- "components_first_log_nudge": "first-log-nudge.tsx" | kind=code-symbol | source=src/features/worklog/components/first-log-nudge.tsx:L1 | neighbors=[page.tsx, first-log-nudge-banner.tsx, FirstLogNudgeBanner(), FirstLogNudge(), queries.ts, countMyWorklogDays()] | lang=en
- "components_history_skeleton": "history-skeleton.tsx" | kind=code-symbol | source=src/features/people/components/history-skeleton.tsx:L1 | neighbors=[HistoryDataSkeleton(), HistoryShellSkeleton(), skeleton.tsx, Skeleton(), loading.tsx, page.tsx] | lang=en
- "components_meeting_glance_isawaitingviewerrsvp": "isAwaitingViewerRsvp()" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L59 | neighbors=[meeting-glance.ts, summarizeMeetings(), meeting-glance.test.ts, meeting-list.tsx, triage-rail.tsx, list-filter.ts] | lang=en
- "components_meeting_glance_tallyrsvps": "tallyRsvps()" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L30 | neighbors=[meeting-detail-dialog.tsx, meeting-glance.ts, meeting-glance.test.ts, meeting-intel-sheet.tsx, meeting-list.tsx, meetings-day-rail.tsx] | lang=en
- "components_meeting_list_meetinglist": "MeetingList()" | kind=code-symbol | source=src/features/meetings/components/meeting-list.tsx:L109 | neighbors=[meeting-list.tsx, groupMeetings(), meetings-agenda.tsx, past-meetings-section.tsx, upcoming-filter.tsx, page.tsx] | lang=en
- "components_meeting_notes_model_glancefromintel": "glanceFromIntel()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L508 | neighbors=[meeting-intel.tsx, meeting-notes-model.ts, buildActionList(), meeting-notes-model.test.ts, glance-actions.test.ts, glance-core.ts] | lang=en

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-029.json

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
