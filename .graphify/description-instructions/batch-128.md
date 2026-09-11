# Node Description Batch 129 of 166

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

- "components_meeting_prep_checkinline": "CheckinLine()" | kind=code-symbol | source=src/features/meetings/components/meeting-prep.tsx:L375 | neighbors=[meeting-prep.tsx]
- "components_meeting_prep_preprow": "PrepRow()" | kind=code-symbol | source=src/features/meetings/components/meeting-prep.tsx:L297 | neighbors=[meeting-prep.tsx]
- "components_meeting_prep_prepskeleton": "PrepSkeleton()" | kind=code-symbol | source=src/features/meetings/components/meeting-prep.tsx:L277 | neighbors=[meeting-prep.tsx]
- "components_meeting_project_select_meetingappoption": "MeetingAppOption" | kind=code-symbol | source=src/features/meetings/components/meeting-project-select.tsx:L23 | neighbors=[meeting-project-select.tsx]
- "components_meeting_rsvp_attendeeresponse": "AttendeeResponse" | kind=code-symbol | source=src/features/meetings/components/meeting-rsvp.tsx:L12 | neighbors=[meeting-rsvp.tsx]
- "components_meeting_rsvp_options": "OPTIONS" | kind=code-symbol | source=src/features/meetings/components/meeting-rsvp.tsx:L26 | neighbors=[meeting-rsvp.tsx]
- "components_meeting_share_dialog_sharecontent": "ShareContent()" | kind=code-symbol | source=src/features/meetings/components/meeting-share-dialog.tsx:L64 | neighbors=[meeting-share-dialog.tsx]
- "components_meetings_month_calendar_daycell": "DayCell()" | kind=code-symbol | source=src/features/meetings/components/meetings-month-calendar.tsx:L530 | neighbors=[meetings-month-calendar.tsx]
- "components_meetings_month_calendar_entry": "Entry" | kind=code-symbol | source=src/features/meetings/components/meetings-month-calendar.tsx:L100 | neighbors=[meetings-month-calendar.tsx]
- "components_meetings_month_calendar_reschedulepatch": "ReschedulePatch" | kind=code-symbol | source=src/features/meetings/components/meetings-month-calendar.tsx:L101 | neighbors=[meetings-month-calendar.tsx]
- "components_meetings_month_calendar_spokenday": "spokenDay()" | kind=code-symbol | source=src/features/meetings/components/meetings-month-calendar.tsx:L122 | neighbors=[meetings-month-calendar.tsx]
- "components_meetings_month_calendar_weekdays": "WEEKDAYS" | kind=code-symbol | source=src/features/meetings/components/meetings-month-calendar.tsx:L86 | neighbors=[meetings-month-calendar.tsx]
- "components_meetings_time_grid_alldayevent": "AllDayEvent()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1776 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_attendeeavatars": "AttendeeAvatars()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1744 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_blockpreview": "BlockPreview" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L197 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_buildshape": "buildShape()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1051 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_createdraft": "CreateDraft" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L207 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_creategesturehandlers": "CreateGestureHandlers" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L217 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_createslotbutton": "CreateSlotButton()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1230 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_daycolumn": "DayColumn" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L262 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_daydropcolumn": "DayDropColumn()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L272 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_dayheader": "DayHeader" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1264 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_dayshape": "DayShape" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L250 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_dayslice": "DaySlice" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L224 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_dragdata": "DragData" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L171 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_dragkind": "DragKind" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L169 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_dragpreview": "DragPreview" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L184 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_hourcells": "HourCells" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1183 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_hourgutter": "HourGutter" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1143 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_nowline": "NowLine()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1818 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_packblocks": "packBlocks()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1106 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_resizehandle": "ResizeHandle()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1583 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_timedblock": "TimedBlock" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L238 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_timegridevent": "TimeGridEvent" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1363 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_time_grid_timerangechip": "TimeRangeChip()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1677 | neighbors=[meetings-time-grid.tsx]
- "components_meetings_views_empty_set": "EMPTY_SET" | kind=code-symbol | source=src/features/meetings/components/meetings-views.tsx:L43 | neighbors=[meetings-views.tsx]
- "components_meetings_views_views": "VIEWS" | kind=code-symbol | source=src/features/meetings/components/meetings-views.tsx:L38 | neighbors=[meetings-views.tsx]
- "components_mention_textarea_escaperegexp": "escapeRegExp()" | kind=code-symbol | source=src/components/mention-textarea.tsx:L10 | neighbors=[mention-textarea.tsx]
- "components_note_timeline_model_actionitemedittarget": "ActionItemEditTarget" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L14 | neighbors=[note-timeline-model.ts]
- "components_note_timeline_model_actionitemlike": "ActionItemLike" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L18 | neighbors=[note-timeline-model.ts]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-128.json

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
