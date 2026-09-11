# Node Description Batch 45 of 166

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

- "commit:repo:github.com/DeegayuA/LogPup@a34ddfb83c6c8b519d9e28108e22feeb2f7b5a2f": "a34ddfb fix(worklog): the review rule referenced an id AppRef does not have" | kind=Commit | source=git | neighbors=[0caca2e feat(worklog): who may review s…, main, a974c38 feat(progress): hours beside da…, review-rules.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@a974c387a374f94c80eb242044a77b96378f1de8": "a974c38 feat(progress): hours beside days, and a cell that shows it can be hove…" | kind=Commit | source=git | neighbors=[a34ddfb fix(worklog): the review rule r…, main, 056203d fix(worklog): stop printing the…, progress-matrix.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@ac3c5515612f524fdd20ef0923c30175fc4dd289": "ac3c551 fix(db): usage_duration takes slot 0059 — its journal entry raced two s…" | kind=Commit | source=git | neighbors=[056203d fix(worklog): stop printing the…, main, 5e32b09 fix(worklog): Fill my day ignor…, 0059_usage_duration.sql] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@ba3e95b037b8b47381cae419ffcdf28e5f5eed49": "ba3e95b test(auth): stop a red that depends on machine load rather than on the …" | kind=Commit | source=git | neighbors=[enforcement.test.ts, main, 325eb16 fix(search): one finance entry …, d8dbc1f test(search): declare the new f…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@bddbb00796466eee78c9cc9a377181c1702ae767": "bddbb00 fix(intel): a day you already asked to be away for is not a missing wor…" | kind=Commit | source=git | neighbors=[main, 0ef5142 fix(ui): correctness, responsiv…, context-pack.ts, c1235a2 docs(public): restore the four …] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@c4994ffbd4a13a48967767b68c2b07d04550702c": "c4994ff feat(worklog): your own row on the team view opens straight into the ed…" | kind=Commit | source=git | neighbors=[1b4f4ee feat(worklog): log an hour by w…, main, bee388b feat(intel): fold the page into…, page.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@c6cff98b754d278b3c1dece9e80fa4669aefbdf1": "c6cff98 feat(auth): gate money behind one capability, rates and totals alike" | kind=Commit | source=git | neighbors=[7b6d19c docs: cost spec — gate aggregat…, capabilities.ts, main, 227e958 build: npm run verify:head — ty…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@ce0f1f559a1364f99fd2c926e185ac7af2ba0d70": "ce0f1f5 feat(people): a person card behind the name, with a way to reach them" | kind=Commit | source=git | neighbors=[8bacbca ., main, 8a3fe20 feat(intel): Ask LogPup on ever…, meeting-planner.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@d407ccc10f32c8aa8b62f2e2aadd30ba569bf07e": "d407ccc fix(settings): give the AI sections the anchors the palette links to" | kind=Commit | source=git | neighbors=[cbd4a9c feat(search): gemini joins the …, main, d7a4a59 fix(people): a follow-up that a…, page.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@d614dea17b8e95d1b6d121e8a7607d0342a925a6": "d614dea feat(people): rank the overlaps before making anyone read them" | kind=Commit | source=git | neighbors=[8dd587b feat(people): filter and sort t…, main, a1e0845 ., cohort-views.tsx] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@d8dbc1f18dc939dd3d0d0745b810f2d76d984f4a": "d8dbc1f test(search): declare the new finance feature, honestly and falsifiably" | kind=Commit | source=git | neighbors=[main, ba3e95b test(auth): stop a red that dep…, registry.test.ts, e282043 feat(deadlines): grade the date…] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@d8e49ed160c86d6b5fed6269e491435736150b8e": "d8e49ed fix(apps): ownership is a word, not a third colour" | kind=Commit | source=git | neighbors=[b33670d feat(ui): make the three select…, main, bd5f524 feat(gemini): the honest half o…, app-card.tsx] | lang=pt
- "commit:repo:github.com/DeegayuA/LogPup@de48f5bab4f2a339cb3f76714e853669d6ee6b9b": "de48f5b feat(meetings): a page that says which meetings could have been one" | kind=Commit | source=git | neighbors=[a1e0845 ., main, f114f1e docs(meetings): record what R6 …, planner.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@e890757f5db6fc6b176f1f26ab945cbb45718aed": "e890757 test(search): and it is not searchable either — check 4's half of the a…" | kind=Commit | source=git | neighbors=[047a7e7 feat(people): change someone's …, main, d5b6409 ., registry.test.ts] | lang=en
- "commit:repo:github.com/DeegayuA/LogPup@f3c4d354d80934a83b877c360bd406f8bfc3fcc0": "f3c4d35 feat(meetings): one segment on the wire at a time, and leaving the page…" | kind=Commit | source=git | neighbors=[72b853c feat(meetings): segment upload …, main, afba1c3 feat(worklog): the hours form c…, meeting-intel.tsx] | lang=en
- "components_action_item_board_actionitemsuggestionslist": "ActionItemSuggestionsList()" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L951 | neighbors=[action-item-board.tsx, buildAssigneePool(), meeting-notes.tsx, note-timeline.tsx] | lang=en
- "components_action_item_board_buildassigneepool": "buildAssigneePool()" | kind=code-symbol | source=src/features/meetings/components/action-item-board.tsx:L108 | neighbors=[action-item-board.tsx, ActionItemSuggestionsList(), meeting-notes.tsx, note-timeline.tsx] | lang=en
- "components_active_sprints_activesprints": "ActiveSprints()" | kind=code-symbol | source=src/features/dashboard/components/active-sprints.tsx:L49 | neighbors=[active-sprints.tsx, formatUpcomingDate(), startsInLabel(), dashboard-zones.tsx] | lang=en
- "components_apps_table_userowrun": "useRowRun()" | kind=code-symbol | source=src/features/admin/components/apps-table.tsx:L182 | neighbors=[apps-table.tsx, LeadCell(), PmCell(), RowActions()] | lang=en
- "components_bug_description": "bug-description.tsx" | kind=code-symbol | source=src/features/bugs/components/bug-description.tsx:L1 | neighbors=[BugDescription(), utils.ts, cn(), bug-list.tsx] | lang=en
- "components_bug_list_buglist": "BugList()" | kind=code-symbol | source=src/features/bugs/components/bug-list.tsx:L60 | neighbors=[page.tsx, bug-list.tsx, triage-queue-pager.tsx, page.tsx] | lang=en
- "components_bulk_bar_bulkbar": "BulkBar()" | kind=code-symbol | source=src/features/admin/components/bulk-bar.tsx:L19 | neighbors=[apps-table.tsx, bulk-bar.tsx, trash-card.tsx, user-table.tsx] | lang=en
- "components_bulk_bar_toastbulkresult": "toastBulkResult()" | kind=code-symbol | source=src/features/admin/components/bulk-bar.tsx:L56 | neighbors=[apps-table.tsx, bulk-bar.tsx, trash-card.tsx, user-table.tsx] | lang=en
- "components_bulk_select_headercheckbox": "HeaderCheckbox()" | kind=code-symbol | source=src/features/admin/components/bulk-select.tsx:L66 | neighbors=[apps-table.tsx, bulk-select.tsx, trash-card.tsx, user-table.tsx] | lang=en
- "components_bulk_select_rowcheckbox": "RowCheckbox()" | kind=code-symbol | source=src/features/admin/components/bulk-select.tsx:L21 | neighbors=[apps-table.tsx, bulk-select.tsx, trash-card.tsx, user-table.tsx] | lang=en
- "components_contact_buttons_contactbuttons": "ContactButtons()" | kind=code-symbol | source=src/components/contact-buttons.tsx:L17 | neighbors=[app-contributions.tsx, contact-buttons.tsx, directory.tsx, team-panel.tsx] | lang=en
- "components_dashboard_zones_coveragezone": "CoverageZone()" | kind=code-symbol | source=src/features/dashboard/components/dashboard-zones.tsx:L710 | neighbors=[dashboard-zones.tsx, formatOwed(), pairedCards(), rosterForApps()] | lang=en
- "components_declare_absence_dialog_declareabsencedialog": "DeclareAbsenceDialog()" | kind=code-symbol | source=src/features/worklog/components/declare-absence-dialog.tsx:L84 | neighbors=[catch-up-panel.tsx, declare-absence-dialog.tsx, formatAbsenceRange(), log-box.tsx] | lang=en
- "components_declare_absence_dialog_filedabsence": "FiledAbsence" | kind=code-symbol | source=src/features/worklog/components/declare-absence-dialog.tsx:L62 | neighbors=[catch-up-panel.tsx, declare-absence-dialog.tsx, log-box.tsx, page.tsx] | lang=en
- "components_entry_grammar_help_entrygrammarhelp": "EntryGrammarHelp()" | kind=code-symbol | source=src/features/worklog/components/entry-grammar-help.tsx:L39 | neighbors=[day-hours-card.tsx, day-one-line.tsx, entry-grammar-help.tsx, log-box.tsx] | lang=en
- "components_first_log_nudge_banner": "first-log-nudge-banner.tsx" | kind=code-symbol | source=src/features/worklog/components/first-log-nudge-banner.tsx:L1 | neighbors=[first-log-nudge.tsx, FirstLogNudgeBanner(), button.tsx, Button()] | lang=en
- "components_meeting_notes_dialog_meetingnotesdialog": "MeetingNotesDialog()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-dialog.tsx:L62 | neighbors=[meeting-notes-dialog.tsx, summaryBlocks(), meetings-calendar.tsx, meetings-month-calendar.tsx] | lang=en
- "components_meeting_notes_model_buildactionlist": "buildActionList()" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L153 | neighbors=[meeting-notes-model.ts, glanceFromIntel(), meeting-notes-model.test.ts, ai-actions.ts] | lang=en
- "components_meeting_notes_model_duestatus": "DueStatus" | kind=code-symbol | source=src/features/meetings/components/meeting-notes-model.ts:L25 | neighbors=[meeting-notes-dialog.tsx, meeting-notes-model.ts, parseSpokenDueDate(), meeting-notes-model.test.ts] | lang=en
- "components_meeting_panels_model_matchesfilters": "matchesFilters()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L88 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts, matchesPerson(), meeting-panels-model.test.ts] | lang=en
- "components_meetings_calendar_meetingscalendar": "MeetingsCalendar()" | kind=code-symbol | source=src/features/meetings/components/meetings-calendar.tsx:L117 | neighbors=[meetings-calendar.tsx, rangeHeading(), useIsWideScreen(), meetings-views.tsx] | lang=en
- "components_meetings_month_calendar_chiptone": "chipTone()" | kind=code-symbol | source=src/features/meetings/components/meetings-month-calendar.tsx:L75 | neighbors=[meetings-month-calendar.tsx, ChipFace(), MeetingChip(), meetings-time-grid.tsx] | lang=en
- "components_mention_textarea_mentiontextarea": "MentionTextarea()" | kind=code-symbol | source=src/components/mention-textarea.tsx:L64 | neighbors=[app-comments.tsx, mention-textarea.tsx, note-timeline.tsx, task-dialog.tsx] | lang=en
- "components_note_timeline_model_buildsuggestionupdatepayload": "buildSuggestionUpdatePayload()" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L77 | neighbors=[action-item-board.tsx, meeting-notes.tsx, note-timeline-model.ts, note-timeline-model.test.ts] | lang=en
- "components_note_timeline_model_findduedatehint": "findDueDateHint()" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L147 | neighbors=[action-item-board.tsx, note-timeline-model.ts, normalizeForMatch(), note-timeline-model.test.ts] | lang=en

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-044.json

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
