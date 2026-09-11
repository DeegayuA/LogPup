# Node Description Batch 147 of 166

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

- "meetings_attendance_history_test_feb": "FEB" | kind=code-symbol | source=src/features/meetings/attendance-history.test.ts:L10 | neighbors=[attendance-history.test.ts]
- "meetings_attendance_history_test_jan": "JAN" | kind=code-symbol | source=src/features/meetings/attendance-history.test.ts:L9 | neighbors=[attendance-history.test.ts]
- "meetings_attendance_history_test_mar": "MAR" | kind=code-symbol | source=src/features/meetings/attendance-history.test.ts:L11 | neighbors=[attendance-history.test.ts]
- "meetings_attendance_history_test_row": "row()" | kind=code-symbol | source=src/features/meetings/attendance-history.test.ts:L13 | neighbors=[attendance-history.test.ts]
- "meetings_attendee_prefill_attendeeselection": "AttendeeSelection" | kind=code-symbol | source=src/features/meetings/attendee-prefill.ts:L18 | neighbors=[attendee-prefill.ts]
- "meetings_attendee_prefill_test_roster": "roster" | kind=code-symbol | source=src/features/meetings/attendee-prefill.test.ts:L4 | neighbors=[attendee-prefill.test.ts]
- "meetings_attendee_score_airelevanceevidence": "AiRelevanceEvidence" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L268 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_attendanceevidence": "AttendanceEvidence" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L261 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_caveat": "Caveat" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L78 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_caveattemplate": "CaveatTemplate" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L412 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_caveattemplatebycode": "caveatTemplateByCode" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L570 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_discussionevidence": "DiscussionEvidence" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L238 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_family_caps": "FAMILY_CAPS" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L370 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_familyresult": "FamilyResult" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L670 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_followupevidenceitem": "FollowupEvidenceItem" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L188 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_opentaskevidence": "OpenTaskEvidence" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L221 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_pinnedfollowupevidence": "PinnedFollowupEvidence" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L211 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_reason": "Reason" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L70 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_reasontemplate": "ReasonTemplate" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L411 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_reasontemplatebycode": "reasonTemplateByCode" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L569 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_recommendationrun": "RecommendationRun" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L111 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_runningsprintevidence": "RunningSprintEvidence" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L228 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_surface": "Surface" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L132 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_test_banned_phrases": "BANNED_PHRASES" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L1479 | neighbors=[attendee-score.test.ts]
- "meetings_attendee_score_test_basectx": "baseCtx()" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L29 | neighbors=[attendee-score.test.ts]
- "meetings_attendee_score_test_date_placeholders": "DATE_PLACEHOLDERS" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L1506 | neighbors=[attendee-score.test.ts]
- "meetings_attendee_score_test_meeting_day": "MEETING_DAY" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L22 | neighbors=[attendee-score.test.ts]
- "meetings_attendee_score_test_number_placeholders": "NUMBER_PLACEHOLDERS" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L1494 | neighbors=[attendee-score.test.ts]
- "meetings_attendee_score_test_proper_noun_placeholders": "PROPER_NOUN_PLACEHOLDERS" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L1498 | neighbors=[attendee-score.test.ts]
- "meetings_attendee_score_test_templateplaceholders": "templatePlaceholders()" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L1508 | neighbors=[attendee-score.test.ts]
- "meetings_attendee_score_test_tierrank": "tierRank" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L75 | neighbors=[attendee-score.test.ts]
- "meetings_attendee_score_test_today": "TODAY" | kind=code-symbol | source=src/features/meetings/attendee-score.test.ts:L23 | neighbors=[attendee-score.test.ts]
- "meetings_attendee_score_tier_rank": "TIER_RANK" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L393 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_topic_stopwords": "TOPIC_STOPWORDS" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L626 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_topicresult": "TopicResult" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L782 | neighbors=[attendee-score.ts]
- "meetings_attendee_score_voicemeetingevidence": "VoiceMeetingEvidence" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L248 | neighbors=[attendee-score.ts]
- "meetings_attendee_series_seriescandidate": "SeriesCandidate" | kind=code-symbol | source=src/features/meetings/attendee-series.ts:L15 | neighbors=[attendee-series.ts]
- "meetings_auto_title_test_aug_12_10am_lk": "AUG_12_10AM_LK" | kind=code-symbol | source=src/features/meetings/auto-title.test.ts:L6 | neighbors=[auto-title.test.ts]
- "meetings_calendar_grid_daysegment": "DaySegment" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L236 | neighbors=[calendar-grid.ts]
- "meetings_calendar_grid_daystartcache": "dayStartCache" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L150 | neighbors=[calendar-grid.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-146.json

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
