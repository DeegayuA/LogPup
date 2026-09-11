# Node Description Batch 148 of 166

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

- "meetings_calendar_grid_daywindowcache": "dayWindowCache" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L151 | neighbors=[calendar-grid.ts]
- "meetings_calendar_grid_offsetformatters": "offsetFormatters" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L140 | neighbors=[calendar-grid.ts]
- "meetings_calendar_grid_test_colombo": "colombo()" | kind=code-symbol | source=src/features/meetings/calendar-grid.test.ts:L24 | neighbors=[calendar-grid.test.ts]
- "meetings_calendar_overlap_overlapplacement": "OverlapPlacement" | kind=code-symbol | source=src/features/meetings/calendar-overlap.ts:L41 | neighbors=[calendar-overlap.ts]
- "meetings_calendar_overlap_test_at": "at()" | kind=code-symbol | source=src/features/meetings/calendar-overlap.test.ts:L12 | neighbors=[calendar-overlap.test.ts]
- "meetings_calendar_overlap_test_event": "event()" | kind=code-symbol | source=src/features/meetings/calendar-overlap.test.ts:L15 | neighbors=[calendar-overlap.test.ts]
- "meetings_calendar_overlap_test_placementsof": "placementsOf()" | kind=code-symbol | source=src/features/meetings/calendar-overlap.test.ts:L22 | neighbors=[calendar-overlap.test.ts]
- "meetings_calendar_view_calendar_views": "CALENDAR_VIEWS" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L26 | neighbors=[calendar-view.ts]
- "meetings_calendar_view_time_grid_views": "TIME_GRID_VIEWS" | kind=code-symbol | source=src/features/meetings/calendar-view.ts:L52 | neighbors=[calendar-view.ts]
- "meetings_coverage_candidate": "Candidate" | kind=code-symbol | source=src/features/meetings/coverage.ts:L291 | neighbors=[coverage.ts]
- "meetings_coverage_cover_ask_kinds": "COVER_ASK_KINDS" | kind=code-symbol | source=src/features/meetings/coverage.ts:L63 | neighbors=[coverage.ts]
- "meetings_coverage_coverageinput": "CoverageInput" | kind=code-symbol | source=src/features/meetings/coverage.ts:L105 | neighbors=[coverage.ts]
- "meetings_coverage_coverageplan": "CoveragePlan" | kind=code-symbol | source=src/features/meetings/coverage.ts:L170 | neighbors=[coverage.ts]
- "meetings_coverage_coveraskkind": "CoverAskKind" | kind=code-symbol | source=src/features/meetings/coverage.ts:L64 | neighbors=[coverage.ts]
- "meetings_coverage_exclusionreason": "ExclusionReason" | kind=code-symbol | source=src/features/meetings/coverage.ts:L128 | neighbors=[coverage.ts]
- "meetings_coverage_kind_rank": "KIND_RANK" | kind=code-symbol | source=src/features/meetings/coverage.ts:L228 | neighbors=[coverage.ts]
- "meetings_coverage_test_ask": "ask()" | kind=code-symbol | source=src/features/meetings/coverage.test.ts:L21 | neighbors=[coverage.test.ts]
- "meetings_coverage_test_four_on_the_same_five": "FOUR_ON_THE_SAME_FIVE" | kind=code-symbol | source=src/features/meetings/coverage.test.ts:L35 | neighbors=[coverage.test.ts]
- "meetings_coverage_test_run": "run()" | kind=code-symbol | source=src/features/meetings/coverage.test.ts:L37 | neighbors=[coverage.test.ts]
- "meetings_coverage_test_team": "TEAM" | kind=code-symbol | source=src/features/meetings/coverage.test.ts:L18 | neighbors=[coverage.test.ts]
- "meetings_event_color_event_classes": "EVENT_CLASSES" | kind=code-symbol | source=src/features/meetings/event-color.ts:L82 | neighbors=[event-color.ts]
- "meetings_event_color_event_dot_classes": "EVENT_DOT_CLASSES" | kind=code-symbol | source=src/features/meetings/event-color.ts:L94 | neighbors=[event-color.ts]
- "meetings_event_color_event_faded_classes": "EVENT_FADED_CLASSES" | kind=code-symbol | source=src/features/meetings/event-color.ts:L144 | neighbors=[event-color.ts]
- "meetings_event_color_event_solid_classes": "EVENT_SOLID_CLASSES" | kind=code-symbol | source=src/features/meetings/event-color.ts:L128 | neighbors=[event-color.ts]
- "meetings_event_color_hash": "hash()" | kind=code-symbol | source=src/features/meetings/event-color.ts:L33 | neighbors=[event-color.ts]
- "meetings_followup_move_actions_edittextinput": "editTextInput" | kind=code-symbol | source=src/features/meetings/followup-move-actions.ts:L204 | neighbors=[followup-move-actions.ts]
- "meetings_followup_move_actions_idsinput": "idsInput" | kind=code-symbol | source=src/features/meetings/followup-move-actions.ts:L24 | neighbors=[followup-move-actions.ts]
- "meetings_followup_move_actions_movefollowupsresult": "MoveFollowupsResult" | kind=code-symbol | source=src/features/meetings/followup-move-actions.ts:L15 | neighbors=[followup-move-actions.ts]
- "meetings_followup_move_actions_summaryinput": "summaryInput" | kind=code-symbol | source=src/features/meetings/followup-move-actions.ts:L260 | neighbors=[followup-move-actions.ts]
- "meetings_followups_derivedfollowuprow": "DerivedFollowupRow" | kind=code-symbol | source=src/features/meetings/followups.ts:L53 | neighbors=[followups.ts]
- "meetings_followups_followupresolutiondecision": "FollowupResolutionDecision" | kind=code-symbol | source=src/features/meetings/followups.ts:L440 | neighbors=[followups.ts]
- "meetings_followups_match_stopwords": "MATCH_STOPWORDS" | kind=code-symbol | source=src/features/meetings/followups.ts:L268 | neighbors=[followups.ts]
- "meetings_followups_tasklikestatus": "TaskLikeStatus" | kind=code-symbol | source=src/features/meetings/followups.ts:L439 | neighbors=[followups.ts]
- "meetings_followups_test_candidate": "candidate()" | kind=code-symbol | source=src/features/meetings/followups.test.ts:L345 | neighbors=[followups.test.ts]
- "meetings_followups_test_daysago": "daysAgo()" | kind=code-symbol | source=src/features/meetings/followups.test.ts:L174 | neighbors=[followups.test.ts]
- "meetings_followups_test_item": "item()" | kind=code-symbol | source=src/features/meetings/followups.test.ts:L160 | neighbors=[followups.test.ts]
- "meetings_glance_actions_idsinput": "idsInput" | kind=code-symbol | source=src/features/meetings/glance-actions.ts:L42 | neighbors=[glance-actions.ts]
- "meetings_glance_actions_test_analyzedat": "analyzedAt" | kind=code-symbol | source=src/features/meetings/glance-actions.test.ts:L65 | neighbors=[glance-actions.test.ts]
- "meetings_glance_actions_test_followup": "followup()" | kind=code-symbol | source=src/features/meetings/glance-actions.test.ts:L39 | neighbors=[glance-actions.test.ts]
- "meetings_glance_actions_test_meeting": "meeting()" | kind=code-symbol | source=src/features/meetings/glance-actions.test.ts:L29 | neighbors=[glance-actions.test.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-147.json

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
