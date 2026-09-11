# Node Description Batch 151 of 166

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

- "meetings_rsvp_actions_test_asuser": "asUser()" | kind=code-symbol | source=src/features/meetings/rsvp-actions.test.ts:L59 | neighbors=[rsvp-actions.test.ts]
- "meetings_rsvp_actions_test_attendeequeue": "attendeeQueue" | kind=code-symbol | source=src/features/meetings/rsvp-actions.test.ts:L27 | neighbors=[rsvp-actions.test.ts]
- "meetings_rsvp_actions_test_authmock_writespy_logactivitymock": "{ authMock, writeSpy, logActivityMock }" | kind=code-symbol | source=src/features/meetings/rsvp-actions.test.ts:L12 | neighbors=[rsvp-actions.test.ts]
- "meetings_rsvp_actions_test_meetingqueue": "meetingQueue" | kind=code-symbol | source=src/features/meetings/rsvp-actions.test.ts:L22 | neighbors=[rsvp-actions.test.ts]
- "meetings_screen_keyframes_test_checkerboardpixels": "checkerboardPixels()" | kind=code-symbol | source=src/features/meetings/screen-keyframes.test.ts:L41 | neighbors=[screen-keyframes.test.ts]
- "meetings_screen_keyframes_test_flatpixels": "flatPixels()" | kind=code-symbol | source=src/features/meetings/screen-keyframes.test.ts:L18 | neighbors=[screen-keyframes.test.ts]
- "meetings_screen_keyframes_test_splitpixels": "splitPixels()" | kind=code-symbol | source=src/features/meetings/screen-keyframes.test.ts:L25 | neighbors=[screen-keyframes.test.ts]
- "meetings_segment_queue_test_seg": "seg()" | kind=code-symbol | source=src/features/meetings/segment-queue.test.ts:L14 | neighbors=[segment-queue.test.ts]
- "meetings_segment_store_parkedsegment": "ParkedSegment" | kind=code-symbol | source=src/features/meetings/segment-store.ts:L35 | neighbors=[segment-store.ts]
- "meetings_series_key_cadence_re": "CADENCE_RE" | kind=code-symbol | source=src/features/meetings/series-key.ts:L102 | neighbors=[series-key.ts]
- "meetings_series_key_cadence_words": "CADENCE_WORDS" | kind=code-symbol | source=src/features/meetings/series-key.ts:L93 | neighbors=[series-key.ts]
- "meetings_series_key_months": "MONTHS" | kind=code-symbol | source=src/features/meetings/series-key.ts:L76 | neighbors=[series-key.ts]
- "meetings_series_key_non_word_run_re": "NON_WORD_RUN_RE" | kind=code-symbol | source=src/features/meetings/series-key.ts:L136 | neighbors=[series-key.ts]
- "meetings_series_key_purpose_re": "PURPOSE_RE" | kind=code-symbol | source=src/features/meetings/series-key.ts:L261 | neighbors=[series-key.ts]
- "meetings_series_key_purpose_spellings": "PURPOSE_SPELLINGS" | kind=code-symbol | source=src/features/meetings/series-key.ts:L246 | neighbors=[series-key.ts]
- "meetings_series_key_purpose_tokens": "PURPOSE_TOKENS" | kind=code-symbol | source=src/features/meetings/series-key.ts:L213 | neighbors=[series-key.ts]
- "meetings_series_key_sinhala_purposes": "SINHALA_PURPOSES" | kind=code-symbol | source=src/features/meetings/series-key.ts:L237 | neighbors=[series-key.ts]
- "meetings_series_key_sprint_num_re": "SPRINT_NUM_RE" | kind=code-symbol | source=src/features/meetings/series-key.ts:L131 | neighbors=[series-key.ts]
- "meetings_series_key_stopwords": "STOPWORDS" | kind=code-symbol | source=src/features/meetings/series-key.ts:L99 | neighbors=[series-key.ts]
- "meetings_series_key_week_num_re": "WEEK_NUM_RE" | kind=code-symbol | source=src/features/meetings/series-key.ts:L128 | neighbors=[series-key.ts]
- "meetings_series_key_weekday_month_re": "WEEKDAY_MONTH_RE" | kind=code-symbol | source=src/features/meetings/series-key.ts:L101 | neighbors=[series-key.ts]
- "meetings_series_key_weekdays_en": "WEEKDAYS_EN" | kind=code-symbol | source=src/features/meetings/series-key.ts:L53 | neighbors=[series-key.ts]
- "meetings_series_key_weekdays_si": "WEEKDAYS_SI" | kind=code-symbol | source=src/features/meetings/series-key.ts:L66 | neighbors=[series-key.ts]
- "meetings_series_key_wordlistpattern": "wordListPattern()" | kind=code-symbol | source=src/features/meetings/series-key.ts:L47 | neighbors=[series-key.ts]
- "meetings_split_upcoming_test_meeting": "meeting()" | kind=code-symbol | source=src/features/meetings/split-upcoming.test.ts:L7 | neighbors=[split-upcoming.test.ts]
- "meetings_split_upcoming_test_now": "now" | kind=code-symbol | source=src/features/meetings/split-upcoming.test.ts:L4 | neighbors=[split-upcoming.test.ts]
- "meetings_text_replace_actions_applyinput": "applyInput" | kind=code-symbol | source=src/features/meetings/text-replace-actions.ts:L64 | neighbors=[text-replace-actions.ts]
- "meetings_text_replace_actions_findinput": "findInput" | kind=code-symbol | source=src/features/meetings/text-replace-actions.ts:L54 | neighbors=[text-replace-actions.ts]
- "meetings_text_replace_actions_targettable": "TargetTable" | kind=code-symbol | source=src/features/meetings/text-replace-actions.ts:L38 | neighbors=[text-replace-actions.ts]
- "meetings_text_replace_findoptions": "FindOptions" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L237 | neighbors=[text-replace.ts]
- "meetings_text_replace_kind_label": "KIND_LABEL" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L407 | neighbors=[text-replace.ts]
- "meetings_text_replace_selection": "Selection" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L348 | neighbors=[text-replace.ts]
- "meetings_text_replace_test_occurrencesfor": "occurrencesFor()" | kind=code-symbol | source=src/features/meetings/text-replace.test.ts:L455 | neighbors=[text-replace.test.ts]
- "meetings_text_replace_test_target": "target()" | kind=code-symbol | source=src/features/meetings/text-replace.test.ts:L18 | neighbors=[text-replace.test.ts]
- "meetings_time_drag_test_end": "END" | kind=code-symbol | source=src/features/meetings/time-drag.test.ts:L20 | neighbors=[time-drag.test.ts]
- "meetings_time_drag_test_move": "move()" | kind=code-symbol | source=src/features/meetings/time-drag.test.ts:L22 | neighbors=[time-drag.test.ts]
- "meetings_time_drag_test_start": "START" | kind=code-symbol | source=src/features/meetings/time-drag.test.ts:L19 | neighbors=[time-drag.test.ts]
- "meetings_visibility_test_allowlist": "ALLOWLIST" | kind=code-symbol | source=src/features/meetings/visibility.test.ts:L29 | neighbors=[visibility.test.ts]
- "meetings_visibility_test_features_dir": "FEATURES_DIR" | kind=code-symbol | source=src/features/meetings/visibility.test.ts:L22 | neighbors=[visibility.test.ts]
- "meetings_visibility_test_offenders": "offenders" | kind=code-symbol | source=src/features/meetings/visibility.test.ts:L87 | neighbors=[visibility.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-150.json

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
