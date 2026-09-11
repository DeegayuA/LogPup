# Node Description Batch 55 of 166

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

- "ui_popover_popovertitle": "PopoverTitle()" | kind=code-symbol | source=src/components/ui/popover.tsx:L62 | neighbors=[apps-table.tsx, capacity-heat-editable.tsx, user-table.tsx, popover.tsx]
- "ui_select_selectgroup": "SelectGroup()" | kind=code-symbol | source=src/components/ui/select.tsx:L11 | neighbors=[seat-select.tsx, speaker-assignment.tsx, job-role-select.tsx, select.tsx]
- "ui_select_selectlabel": "SelectLabel()" | kind=code-symbol | source=src/components/ui/select.tsx:L111 | neighbors=[seat-select.tsx, speaker-assignment.tsx, job-role-select.tsx, select.tsx]
- "ui_spotlight_card_spotlightcard": "SpotlightCard()" | kind=code-symbol | source=src/components/ui/spotlight-card.tsx:L47 | neighbors=[ask-panel.tsx, briefing-card.tsx, spotlight-card.tsx, useMediaQuery()]
- "ui_tooltip_tooltip": "Tooltip()" | kind=code-symbol | source=src/components/ui/tooltip.tsx:L24 | neighbors=[gemini-keys-card.tsx, meeting-intel-sheet.tsx, meeting-list.tsx, tooltip.tsx]
- "ui_tooltip_tooltipcontent": "TooltipContent()" | kind=code-symbol | source=src/components/ui/tooltip.tsx:L32 | neighbors=[gemini-keys-card.tsx, meeting-intel-sheet.tsx, meeting-list.tsx, tooltip.tsx]
- "ui_tooltip_tooltipprovider": "TooltipProvider()" | kind=code-symbol | source=src/components/ui/tooltip.tsx:L17 | neighbors=[gemini-keys-card.tsx, meeting-intel-sheet.tsx, meeting-list.tsx, tooltip.tsx]
- "ui_tooltip_tooltiptrigger": "TooltipTrigger()" | kind=code-symbol | source=src/components/ui/tooltip.tsx:L28 | neighbors=[gemini-keys-card.tsx, meeting-intel-sheet.tsx, meeting-list.tsx, tooltip.tsx]
- "worklog_absence_actions_createabsence": "createAbsence()" | kind=code-symbol | source=src/features/worklog/absence-actions.ts:L50 | neighbors=[declare-absence-dialog.tsx, log-box.tsx, absence-actions.ts, unexpected()]
- "worklog_absence_actions_review": "review()" | kind=code-symbol | source=src/features/worklog/absence-actions.ts:L113 | neighbors=[absence-actions.ts, approveAbsence(), rejectAbsence(), unexpected()]
- "worklog_absence_actions_unexpected": "unexpected()" | kind=code-symbol | source=src/features/worklog/absence-actions.ts:L45 | neighbors=[absence-actions.ts, createAbsence(), review(), withdrawAbsence()]
- "worklog_absence_days_test": "absence-days.test.ts" | kind=code-symbol | source=src/features/worklog/absence-days.test.ts:L1 | neighbors=[8d1c180 fix(worklog): lift absenceDays …, absence-days.ts, absenceDays(), range()]
- "worklog_absence_kinds_absencekindlabel": "absenceKindLabel()" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L214 | neighbors=[page.tsx, page.tsx, absence-kinds.ts, absence-kinds.test.ts]
- "worklog_absence_kinds_exemptswholeday": "exemptsWholeDay()" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L223 | neighbors=[page.tsx, page.tsx, absence-kinds.ts, absence-kinds.test.ts]
- "worklog_absence_kinds_self_declarable_kinds": "SELF_DECLARABLE_KINDS" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L194 | neighbors=[absence-actions.ts, absence-kinds.ts, absence-kinds.test.ts, catch-up-parse.ts]
- "worklog_absence_queries_listpendingabsences": "listPendingAbsences()" | kind=code-symbol | source=src/features/worklog/absence-queries.ts:L35 | neighbors=[approval-queries.ts, page.tsx, absence-queries.ts, select]
- "worklog_auto_score_autoscorefromhours": "autoScoreFromHours()" | kind=code-symbol | source=src/features/worklog/auto-score.ts:L59 | neighbors=[log-box.tsx, auto-score.ts, auto-score-sync.ts, auto-score.test.ts]
- "worklog_auto_score_scoresource": "ScoreSource" | kind=code-symbol | source=src/features/worklog/auto-score.ts:L41 | neighbors=[day-panel.tsx, logged-days-list.tsx, auto-score.ts, queries.ts]
- "worklog_catch_up_parse_catchupreading": "CatchUpReading" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L120 | neighbors=[log-box.tsx, catch-up-actions.ts, catch-up-offline.ts, catch-up-parse.ts]
- "worklog_catch_up_parse_readtext": "readText()" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L238 | neighbors=[catch-up-parse.ts, readAbsence(), readCatchUpReply(), readEntries()]
- "worklog_day_state_day_state_class": "DAY_STATE_CLASS" | kind=code-symbol | source=src/features/worklog/day-state.ts:L90 | neighbors=[progress-matrix.tsx, worklog-calendar.tsx, day-state.ts, page.tsx]
- "worklog_day_state_day_state_label": "DAY_STATE_LABEL" | kind=code-symbol | source=src/features/worklog/day-state.ts:L117 | neighbors=[progress-matrix.tsx, worklog-calendar.tsx, day-state.ts, page.tsx]
- "worklog_day_summary_glanceatday": "glanceAtDay()" | kind=code-symbol | source=src/features/worklog/day-summary.ts:L60 | neighbors=[day-panel.tsx, day-summary.ts, firstMeaningfulLine(), day-summary.test.ts]
- "worklog_day_summary_test": "day-summary.test.ts" | kind=code-symbol | source=src/features/worklog/day-summary.test.ts:L1 | neighbors=[3c0bc01 ., day-summary.ts, glanceAtDay(), glance()]
- "worklog_draft_actions_draftworklognote": "draftWorklogNote()" | kind=code-symbol | source=src/features/worklog/draft-actions.ts:L61 | neighbors=[catch-up-panel.tsx, worklog-form.tsx, draft-actions.ts, snapPercent()]
- "worklog_draft_prompt_test": "draft-prompt.test.ts" | kind=code-symbol | source=src/features/worklog/draft-prompt.test.ts:L1 | neighbors=[dda9cf6 feat(worklog): the AI draft kno…, draft-prompt.ts, buildWorklogDraftPrompt(), activity]
- "worklog_entry_actions_deleteworklogentry": "deleteWorklogEntry()" | kind=code-symbol | source=src/features/worklog/entry-actions.ts:L364 | neighbors=[day-hours-card.tsx, entry-actions.ts, unexpected(), writer()]
- "worklog_entry_actions_unexpected": "unexpected()" | kind=code-symbol | source=src/features/worklog/entry-actions.ts:L42 | neighbors=[entry-actions.ts, createWorklogEntry(), deleteWorklogEntry(), updateWorklogEntry()]
- "worklog_entry_actions_writer": "writer()" | kind=code-symbol | source=src/features/worklog/entry-actions.ts:L53 | neighbors=[entry-actions.ts, createWorklogEntry(), deleteWorklogEntry(), updateWorklogEntry()]
- "worklog_entry_ai_actions_draftworklogentries": "draftWorklogEntries()" | kind=code-symbol | source=src/features/worklog/entry-ai-actions.ts:L106 | neighbors=[day-hours-card.tsx, day-panel.tsx, entry-ai-actions.ts, writer()]
- "worklog_entry_check_prompt_applyphrasing": "applyPhrasing()" | kind=code-symbol | source=src/features/worklog/entry-check-prompt.ts:L197 | neighbors=[entry-ai-actions.ts, entry-check-prompt.ts, readLines(), entry-check-prompt.test.ts]
- "worklog_entry_draft_prompt_buildentrydraftprompt": "buildEntryDraftPrompt()" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L136 | neighbors=[entry-ai-actions.ts, entry-draft-prompt.ts, hrs(), entry-draft-prompt.test.ts]
- "worklog_entry_draft_prompt_parsedraftedentries": "parseDraftedEntries()" | kind=code-symbol | source=src/features/worklog/entry-draft-prompt.ts:L300 | neighbors=[entry-ai-actions.ts, entry-draft-prompt.ts, readRow(), entry-draft-prompt.test.ts]
- "worklog_entry_language_describegrammar": "describeGrammar()" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L269 | neighbors=[entry-grammar-help.tsx, entry-language.ts, grammarForPrompt(), entry-language.test.ts]
- "worklog_entry_language_describeline": "describeLine()" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L331 | neighbors=[day-one-line.tsx, log-box.tsx, entry-language.ts, entry-language.test.ts]
- "worklog_entry_language_lineintent": "LineIntent" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L354 | neighbors=[day-one-line.tsx, log-box.tsx, entry-language.ts, entry-language.test.ts]
- "worklog_entry_language_linesuggestions": "lineSuggestions()" | kind=code-symbol | source=src/features/worklog/entry-language.ts:L376 | neighbors=[day-one-line.tsx, log-box.tsx, entry-language.ts, entry-language.test.ts]
- "worklog_guest_projects_test": "guest-projects.test.ts" | kind=code-symbol | source=src/features/worklog/guest-projects.test.ts:L1 | neighbors=[a4b271b Improve leave types and worklog…, guest-projects.ts, partitionGuestApps(), guests]
- "worklog_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/worklog/loading.tsx:L1 | neighbors=[0ef5142 fix(ui): correctness, responsiv…, skeleton.tsx, Skeleton(), WorklogLoading()]
- "worklog_note_app_tags_splitnoteapptags": "splitNoteAppTags()" | kind=code-symbol | source=src/features/worklog/note-app-tags.ts:L33 | neighbors=[note-app-tags.ts, note-app-tags.test.ts, page.tsx, review-rules.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-054.json

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
