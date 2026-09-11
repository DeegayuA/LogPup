# Node Description Batch 70 of 166

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

- "meetings_ai_actions_addtypednotesegment": "addTypedNoteSegment()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3442 | neighbors=[note-timeline.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_asactionitems": "asActionItems()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L342 | neighbors=[ai-actions.ts, asArray(), persistMeetingAnalysis()]
- "meetings_ai_actions_asspeakersegments": "asSpeakerSegments()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L332 | neighbors=[ai-actions.ts, asArray(), persistMeetingAnalysis()]
- "meetings_ai_actions_attributefollowup": "attributeFollowup()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2764 | neighbors=[meeting-intel.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_clearmeetingainotes": "clearMeetingAiNotes()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3611 | neighbors=[meeting-intel.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_closefollowupasstale": "closeFollowupAsStale()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2714 | neighbors=[meeting-intel.tsx, ai-actions.ts, authorizeFollowupWrite()]
- "meetings_ai_actions_deferfollowupreason": "deferFollowupReason()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2852 | neighbors=[meeting-intel.tsx, ai-actions.ts, writeOpenFollowupNote()]
- "meetings_ai_actions_deletemeetingkeyframe": "deleteMeetingKeyframe()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1964 | neighbors=[meeting-intel.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_deletenotesegment": "deleteNoteSegment()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3550 | neighbors=[note-timeline.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_dismisstasksuggestion": "dismissTaskSuggestion()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L4390 | neighbors=[action-item-board.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_fetchapprovedusers": "fetchApprovedUsers()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L953 | neighbors=[ai-actions.ts, getMeetingIntel(), getMeetingNoteTimeline()]
- "meetings_ai_actions_fetchattendeeapplists": "fetchAttendeeAppLists()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L697 | neighbors=[ai-actions.ts, analyzeMeetingAudio(), finalizeMeetingRecordingInner()]
- "meetings_ai_actions_fetchcarriedfollowups": "fetchCarriedFollowups()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L787 | neighbors=[ai-actions.ts, getMeetingIntel(), persistMeetingAnalysis()]
- "meetings_ai_actions_fetchorgpeople": "fetchOrgPeople()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3133 | neighbors=[ai-actions.ts, getMeetingNoteTimeline(), getSpeakerAssignmentData()]
- "meetings_ai_actions_fetchtasksuggestions": "fetchTaskSuggestions()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3187 | neighbors=[ai-actions.ts, getMeetingIntel(), getMeetingNoteTimeline()]
- "meetings_ai_actions_followuppersonoption": "FollowupPersonOption" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L228 | neighbors=[attribution-inline.tsx, meeting-intel.tsx, ai-actions.ts]
- "meetings_ai_actions_insertautonotesandsuggestions": "insertAutoNotesAndSuggestions()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L387 | neighbors=[ai-actions.ts, linkFollowupToTask(), persistMeetingAnalysis()]
- "meetings_ai_actions_linkfollowuptotask": "linkFollowupToTask()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L992 | neighbors=[ai-actions.ts, acceptTaskSuggestion(), insertAutoNotesAndSuggestions()]
- "meetings_ai_actions_meetingappids": "meetingAppIds()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L664 | neighbors=[ai-actions.ts, canManageMeeting(), canReadMeetingIntel()]
- "meetings_ai_actions_meetingintel": "MeetingIntel" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L251 | neighbors=[meeting-intel.tsx, meeting-notes-dialog.tsx, ai-actions.ts]
- "meetings_ai_actions_meetingscreenshotview": "MeetingScreenshotView" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1862 | neighbors=[screen-filmstrip.tsx, use-screen-keyframes.ts, ai-actions.ts]
- "meetings_ai_actions_notefollowup": "noteFollowup()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2843 | neighbors=[meeting-intel.tsx, ai-actions.ts, writeOpenFollowupNote()]
- "meetings_ai_actions_notesegmentview": "NoteSegmentView" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L3014 | neighbors=[note-timeline.tsx, page.tsx, ai-actions.ts]
- "meetings_ai_actions_recordingfailure": "recordingFailure()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1396 | neighbors=[ai-actions.ts, finalizeMeetingRecording(), transcribeSegment()]
- "meetings_ai_actions_reopenfollowup": "reopenFollowup()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2665 | neighbors=[meeting-intel.tsx, ai-actions.ts, authorizeFollowupWrite()]
- "meetings_ai_actions_resolveaddressedfollowups": "resolveAddressedFollowups()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1019 | neighbors=[ai-actions.ts, persistMeetingAnalysis(), asArray()]
- "meetings_ai_actions_setmeetingautoassigntasks": "setMeetingAutoAssignTasks()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2318 | neighbors=[meeting-intel.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_setmeetingnextmeeting": "setMeetingNextMeeting()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2373 | neighbors=[next-meeting-card.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_suggestnextmeeting": "suggestNextMeeting()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2435 | neighbors=[next-meeting-card.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_trackactionitem": "trackActionItem()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L4138 | neighbors=[meeting-notes.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_ai_actions_unattributedfollowupview": "UnattributedFollowupView" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L231 | neighbors=[attribution-inline.tsx, meeting-intel.tsx, ai-actions.ts]
- "meetings_ai_actions_undoautoacceptedsuggestion": "undoAutoAcceptedSuggestion()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L4448 | neighbors=[action-item-board.tsx, ai-actions.ts, canManageMeeting()]
- "meetings_attendee_prefill_addeveryone": "addEveryone()" | kind=code-symbol | source=src/features/meetings/attendee-prefill.ts:L84 | neighbors=[meeting-form.tsx, attendee-prefill.ts, attendee-prefill.test.ts]
- "meetings_attendee_score_e4e5recency": "e4e5Recency()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L619 | neighbors=[attendee-score.ts, scoreDiscussion(), scoreVoice()]
- "meetings_attendee_score_findtechtaghit": "findTechTagHit()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L646 | neighbors=[attendee-score.ts, escapeRegExp(), scoreTopic()]
- "meetings_attendee_score_interpolate": "interpolate()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L572 | neighbors=[attendee-score.ts, renderCaveat(), renderReason()]
- "meetings_attendee_score_meaningfultokencount": "meaningfulTokenCount()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L635 | neighbors=[attendee-score.ts, scoreCandidate(), scoreTopic()]
- "meetings_attendee_score_rendercaveat": "renderCaveat()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L591 | neighbors=[attendee-score.ts, interpolate(), scoreCandidate()]
- "meetings_attendee_score_scoreattendance": "scoreAttendance()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L1011 | neighbors=[attendee-score.ts, renderReason(), scoreCandidate()]
- "meetings_attendee_score_scoreownership": "scoreOwnership()" | kind=code-symbol | source=src/features/meetings/attendee-score.ts:L968 | neighbors=[attendee-score.ts, scoreCandidate(), renderReason()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-069.json

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
