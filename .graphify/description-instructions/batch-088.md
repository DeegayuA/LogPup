# Node Description Batch 89 of 166

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

- "components_meeting_panels_model_content_kinds": "CONTENT_KINDS" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L13 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts]
- "components_meeting_panels_model_density": "Density" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L149 | neighbors=[meeting-panels.tsx, meeting-panels-model.ts]
- "components_meeting_panels_model_filteritems": "filterItems()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L97 | neighbors=[meeting-panels-model.ts, meeting-panels-model.test.ts]
- "components_meeting_panels_model_issinhalablock": "isSinhalaBlock()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L192 | neighbors=[meeting-panels-model.ts, splitBilingualSummary()]
- "components_meeting_panels_model_matchesperson": "matchesPerson()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L72 | neighbors=[meeting-panels-model.ts, matchesFilters()]
- "components_meeting_panels_model_normalizepersonname": "normalizePersonName()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels-model.ts:L52 | neighbors=[meeting-panels-model.ts, personNamesMatch()]
- "components_meeting_panels_panel_default_open": "PANEL_DEFAULT_OPEN" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L113 | neighbors=[meeting-intel.tsx, meeting-panels.tsx]
- "components_meeting_panels_panelid": "PanelId" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L108 | neighbors=[meeting-intel.tsx, meeting-panels.tsx]
- "components_meeting_panels_panelnavitem": "PanelNavItem" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L442 | neighbors=[meeting-intel.tsx, meeting-panels.tsx]
- "components_meeting_panels_panelslayout": "PanelsLayout()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L490 | neighbors=[meeting-intel.tsx, meeting-panels.tsx]
- "components_meeting_panels_summarylanguagecontrol": "SummaryLanguageControl()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L709 | neighbors=[meeting-notes.tsx, meeting-panels.tsx]
- "components_meeting_panels_usesummarylanguage": "useSummaryLanguage()" | kind=code-symbol | source=src/features/meetings/components/meeting-panels.tsx:L335 | neighbors=[meeting-notes.tsx, meeting-panels.tsx]
- "components_meeting_people_picker_model_buildpeoplepool": "buildPeoplePool()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L100 | neighbors=[meeting-people-picker-model.ts, meeting-people-picker-model.test.ts]
- "components_meeting_people_picker_model_composehint": "composeHint()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L115 | neighbors=[meeting-people-picker-model.ts, toOption()]
- "components_meeting_people_picker_model_tooption": "toOption()" | kind=code-symbol | source=src/features/meetings/components/meeting-people-picker-model.ts:L119 | neighbors=[meeting-people-picker-model.ts, composeHint()]
- "components_meeting_pip_clock": "clock()" | kind=code-symbol | source=src/features/meetings/components/meeting-pip.tsx:L99 | neighbors=[meeting-pip.tsx, PipBody()]
- "components_meeting_pip_pipbody": "PipBody()" | kind=code-symbol | source=src/features/meetings/components/meeting-pip.tsx:L342 | neighbors=[meeting-pip.tsx, clock()]
- "components_meeting_pip_piphost": "pipHost()" | kind=code-symbol | source=src/features/meetings/components/meeting-pip.tsx:L49 | neighbors=[meeting-pip.tsx, MeetingPip()]
- "components_meeting_planner_meetingplannersection": "MeetingPlannerSection()" | kind=code-symbol | source=src/features/meetings/components/meeting-planner.tsx:L68 | neighbors=[meeting-intel.tsx, meeting-planner.tsx]
- "components_meeting_prep_meetingprepsection": "MeetingPrepSection()" | kind=code-symbol | source=src/features/meetings/components/meeting-prep.tsx:L31 | neighbors=[meeting-intel.tsx, meeting-prep.tsx]
- "components_meeting_prep_parsepercent": "parsePercent()" | kind=code-symbol | source=src/features/meetings/components/meeting-prep.tsx:L411 | neighbors=[meeting-prep.tsx, SelfCheckinForm()]
- "components_meeting_prep_selfcheckinform": "SelfCheckinForm()" | kind=code-symbol | source=src/features/meetings/components/meeting-prep.tsx:L423 | neighbors=[meeting-prep.tsx, parsePercent()]
- "components_meeting_project_select_meetingprojectselect": "MeetingProjectSelect()" | kind=code-symbol | source=src/features/meetings/components/meeting-project-select.tsx:L45 | neighbors=[meeting-detail-dialog.tsx, meeting-project-select.tsx]
- "components_meeting_rsvp_meetingrsvp": "MeetingRsvp()" | kind=code-symbol | source=src/features/meetings/components/meeting-rsvp.tsx:L32 | neighbors=[meeting-intel-sheet.tsx, meeting-rsvp.tsx]
- "components_meeting_share_dialog_meetingsharedialog": "MeetingShareDialog()" | kind=code-symbol | source=src/features/meetings/components/meeting-share-dialog.tsx:L37 | neighbors=[meeting-form.tsx, meeting-share-dialog.tsx]
- "components_meetings_agenda_meetingsagenda": "MeetingsAgenda()" | kind=code-symbol | source=src/features/meetings/components/meetings-agenda.tsx:L30 | neighbors=[meetings-agenda.tsx, meetings-calendar.tsx]
- "components_meetings_calendar_rangeheading": "rangeHeading()" | kind=code-symbol | source=src/features/meetings/components/meetings-calendar.tsx:L506 | neighbors=[meetings-calendar.tsx, MeetingsCalendar()]
- "components_meetings_day_rail_meetingsdayrail": "MeetingsDayRail()" | kind=code-symbol | source=src/features/meetings/components/meetings-day-rail.tsx:L37 | neighbors=[meetings-calendar.tsx, meetings-day-rail.tsx]
- "components_meetings_month_calendar_chipface": "ChipFace()" | kind=code-symbol | source=src/features/meetings/components/meetings-month-calendar.tsx:L634 | neighbors=[meetings-month-calendar.tsx, chipTone()]
- "components_meetings_month_calendar_chiplabel": "chipLabel()" | kind=code-symbol | source=src/features/meetings/components/meetings-month-calendar.tsx:L105 | neighbors=[meetings-month-calendar.tsx, MeetingChip()]
- "components_meetings_month_calendar_meetingsmonthcalendar": "MeetingsMonthCalendar()" | kind=code-symbol | source=src/features/meetings/components/meetings-month-calendar.tsx:L127 | neighbors=[meetings-calendar.tsx, meetings-month-calendar.tsx]
- "components_meetings_time_grid_buildblockpreview": "buildBlockPreview()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1636 | neighbors=[meetings-time-grid.tsx, timeRangeLabel()]
- "components_meetings_time_grid_createghost": "CreateGhost()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L1700 | neighbors=[meetings-time-grid.tsx, timeRangeLabel()]
- "components_meetings_time_grid_meetingstimegrid": "MeetingsTimeGrid()" | kind=code-symbol | source=src/features/meetings/components/meetings-time-grid.tsx:L312 | neighbors=[meetings-calendar.tsx, meetings-time-grid.tsx]
- "components_meetings_views_meetingsviews": "MeetingsViews()" | kind=code-symbol | source=src/features/meetings/components/meetings-views.tsx:L60 | neighbors=[meetings-views.tsx, page.tsx]
- "components_mention_textarea_mentiontext": "MentionText()" | kind=code-symbol | source=src/components/mention-textarea.tsx:L21 | neighbors=[mention-textarea.tsx, note-timeline.tsx]
- "components_month_summary_num": "num()" | kind=code-symbol | source=src/features/worklog/components/month-summary.tsx:L11 | neighbors=[month-summary.tsx, MonthSummary()]
- "components_next_meeting_card_nextmeetingpanel": "NextMeetingPanel()" | kind=code-symbol | source=src/features/meetings/components/next-meeting-card.tsx:L45 | neighbors=[meeting-intel.tsx, next-meeting-card.tsx]
- "components_note_timeline_model_normalizeformatch": "normalizeForMatch()" | kind=code-symbol | source=src/features/meetings/components/note-timeline-model.ts:L128 | neighbors=[note-timeline-model.ts, findDueDateHint()]
- "components_note_timeline_notetimeline": "NoteTimeline()" | kind=code-symbol | source=src/features/meetings/components/note-timeline.tsx:L88 | neighbors=[meeting-intel.tsx, note-timeline.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-088.json

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
