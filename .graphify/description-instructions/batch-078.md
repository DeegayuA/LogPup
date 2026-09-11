# Node Description Batch 79 of 166

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

- "transcription_transcript_buffer_fulltext": "fullText()" | kind=code-symbol | source=src/features/transcription/transcript-buffer.ts:L69 | neighbors=[use-live-transcription.ts, transcript-buffer.ts, transcript-buffer.test.ts]
- "transcription_transcript_buffer_longestsuffixprefixoverlap": "longestSuffixPrefixOverlap()" | kind=code-symbol | source=src/features/transcription/transcript-buffer.ts:L83 | neighbors=[transcript-buffer.ts, appendFragment(), transcript-buffer.test.ts]
- "transcription_transcript_buffer_transcriptstate": "TranscriptState" | kind=code-symbol | source=src/features/transcription/transcript-buffer.ts:L6 | neighbors=[use-live-transcription.ts, live-client.ts, transcript-buffer.ts]
- "ui_badge_badgevariants": "badgeVariants" | kind=code-symbol | source=src/components/ui/badge.tsx:L7 | neighbors=[org-tags-field.tsx, badge.tsx, Badge()]
- "ui_dialog_dialogoverlay": "DialogOverlay()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L26 | neighbors=[ask-bubble.tsx, mobile-nav.tsx, dialog.tsx]
- "ui_dialog_dialogportal": "DialogPortal()" | kind=code-symbol | source=src/components/ui/dialog.tsx:L18 | neighbors=[ask-bubble.tsx, mobile-nav.tsx, dialog.tsx]
- "ui_dropdown_menu_dropdownmenugroup": "DropdownMenuGroup()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L52 | neighbors=[add-to-calendar.tsx, meeting-list.tsx, dropdown-menu.tsx]
- "ui_native_button_infernativebutton": "inferNativeButton()" | kind=code-symbol | source=src/components/ui/native-button.ts:L21 | neighbors=[button.tsx, native-button.ts, native-button.test.ts]
- "ui_radio_group_radiogroup": "RadioGroup()" | kind=code-symbol | source=src/components/ui/radio-group.tsx:L13 | neighbors=[gemini-keys-card.tsx, maintenance-controls.tsx, radio-group.tsx]
- "ui_radio_group_radiogroupitem": "RadioGroupItem()" | kind=code-symbol | source=src/components/ui/radio-group.tsx:L23 | neighbors=[gemini-keys-card.tsx, maintenance-controls.tsx, radio-group.tsx]
- "worklog_absence_actions_approveabsence": "approveAbsence()" | kind=code-symbol | source=src/features/worklog/absence-actions.ts:L179 | neighbors=[approval-actions.tsx, absence-actions.ts, review()]
- "worklog_absence_actions_rejectabsence": "rejectAbsence()" | kind=code-symbol | source=src/features/worklog/absence-actions.ts:L183 | neighbors=[approval-actions.tsx, absence-actions.ts, review()]
- "worklog_absence_actions_withdrawabsence": "withdrawAbsence()" | kind=code-symbol | source=src/features/worklog/absence-actions.ts:L187 | neighbors=[pending-absence-list.tsx, absence-actions.ts, unexpected()]
- "worklog_absence_kinds_absence_kind_phrases": "ABSENCE_KIND_PHRASES" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L249 | neighbors=[absence-kinds.ts, absence-kinds.test.ts, catch-up-offline.ts]
- "worklog_absence_kinds_selfdeclarablegroups": "selfDeclarableGroups()" | kind=code-symbol | source=src/features/worklog/absence-kinds.ts:L199 | neighbors=[declare-absence-dialog.tsx, absence-kinds.ts, absence-kinds.test.ts]
- "worklog_absence_queries_approvedabsenceuserids": "approvedAbsenceUserIds()" | kind=code-symbol | source=src/features/worklog/absence-queries.ts:L107 | neighbors=[load-actions.ts, absence-queries.ts, select]
- "worklog_absence_queries_listrecentabsences": "listRecentAbsences()" | kind=code-symbol | source=src/features/worklog/absence-queries.ts:L51 | neighbors=[page.tsx, absence-queries.ts, select]
- "worklog_actions_setdaynote": "setDayNote()" | kind=code-symbol | source=src/features/worklog/actions.ts:L127 | neighbors=[day-panel.tsx, log-box.tsx, actions.ts]
- "worklog_auto_score_mayautoscore": "mayAutoScore()" | kind=code-symbol | source=src/features/worklog/auto-score.ts:L91 | neighbors=[auto-score.ts, auto-score-sync.ts, auto-score.test.ts]
- "worklog_auto_score_sync_backfillautoscores": "backfillAutoScores()" | kind=code-symbol | source=src/features/worklog/auto-score-sync.ts:L208 | neighbors=[route.ts, auto-score-sync.ts, syncAutoScore()]
- "worklog_catch_up_actions_readcatchuptext": "readCatchUpText()" | kind=code-symbol | source=src/features/worklog/catch-up-actions.ts:L98 | neighbors=[log-box.tsx, catch-up-actions.ts, writer()]
- "worklog_catch_up_offline_findmarkers": "findMarkers()" | kind=code-symbol | source=src/features/worklog/catch-up-offline.ts:L128 | neighbors=[catch-up-offline.ts, resolveDate(), readCatchUpTextOffline()]
- "worklog_catch_up_parse_buildcatchupprompt": "buildCatchUpPrompt()" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L179 | neighbors=[catch-up-actions.ts, catch-up-parse.ts, catch-up-parse.test.ts]
- "worklog_catch_up_parse_catchupday": "CatchUpDay" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L106 | neighbors=[log-box.tsx, catch-up-offline.ts, catch-up-parse.ts]
- "worklog_catch_up_parse_lookslikeseveraldays": "looksLikeSeveralDays()" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L404 | neighbors=[log-box.tsx, catch-up-parse.ts, catch-up-parse.test.ts]
- "worklog_catch_up_parse_readabsence": "readAbsence()" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L252 | neighbors=[catch-up-parse.ts, readText(), readCatchUpReply()]
- "worklog_catch_up_parse_readentries": "readEntries()" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L263 | neighbors=[catch-up-parse.ts, readCatchUpReply(), readText()]
- "worklog_catch_up_parse_summarizereading": "summarizeReading()" | kind=code-symbol | source=src/features/worklog/catch-up-parse.ts:L416 | neighbors=[log-box.tsx, catch-up-parse.ts, catch-up-parse.test.ts]
- "worklog_coverage_queries_getcoverage": "getCoverage()" | kind=code-symbol | source=src/features/worklog/coverage-queries.ts:L18 | neighbors=[dashboard-zones.tsx, context-pack.ts, coverage-queries.ts]
- "worklog_day_app_mix_builddaymix": "buildDayMix()" | kind=code-symbol | source=src/features/worklog/day-app-mix.ts:L46 | neighbors=[progress-matrix.tsx, day-app-mix.ts, day-app-mix.test.ts]
- "worklog_day_app_mix_buildmixlegend": "buildMixLegend()" | kind=code-symbol | source=src/features/worklog/day-app-mix.ts:L104 | neighbors=[day-app-mix.ts, day-app-mix.test.ts, progress-queries.ts]
- "worklog_day_app_mix_dayentry": "DayEntry" | kind=code-symbol | source=src/features/worklog/day-app-mix.ts:L20 | neighbors=[day-app-mix.ts, day-app-mix.test.ts, progress-queries.ts]
- "worklog_day_app_mix_legendentry": "LegendEntry" | kind=code-symbol | source=src/features/worklog/day-app-mix.ts:L94 | neighbors=[progress-matrix.tsx, day-app-mix.ts, progress-queries.ts]
- "worklog_day_form_dayformproblem": "dayFormProblem()" | kind=code-symbol | source=src/features/worklog/day-form.ts:L31 | neighbors=[worklog-form.tsx, day-form.ts, day-form.test.ts]
- "worklog_day_form_test": "day-form.test.ts" | kind=code-symbol | source=src/features/worklog/day-form.test.ts:L1 | neighbors=[c032099 fix(worklog): the Save button s…, day-form.ts, dayFormProblem()]
- "worklog_day_state_daystate": "DayState" | kind=code-symbol | source=src/features/worklog/day-state.ts:L20 | neighbors=[progress-matrix.tsx, worklog-calendar.tsx, day-state.ts]
- "worklog_draft_actions_worklogdraft": "WorklogDraft" | kind=code-symbol | source=src/features/worklog/draft-actions.ts:L37 | neighbors=[catch-up-panel.tsx, worklog-form.tsx, draft-actions.ts]
- "worklog_draft_prompt_buildworklogdraftprompt": "buildWorklogDraftPrompt()" | kind=code-symbol | source=src/features/worklog/draft-prompt.ts:L29 | neighbors=[draft-actions.ts, draft-prompt.ts, draft-prompt.test.ts]
- "worklog_entries_accountedfraction": "accountedFraction()" | kind=code-symbol | source=src/features/worklog/entries.ts:L106 | neighbors=[day-hours-card.tsx, entries.ts, entries.test.ts]
- "worklog_entries_entryinput": "EntryInput" | kind=code-symbol | source=src/features/worklog/entries.ts:L115 | neighbors=[entries.ts, entries.test.ts, entry-form.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-078.json

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
