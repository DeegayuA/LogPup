# Node Description Batch 28 of 166

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

- "meetings_ai_actions_analyzemeetingaudio": "analyzeMeetingAudio()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L1083 | neighbors=[ai-actions.ts, attendeeAppsPromptBlock(), canManageMeeting(), fetchAttendeeAppLists(), fetchAttendees(), persistMeetingAnalysis()]
- "meetings_ai_actions_authorizefollowupwrite": "authorizeFollowupWrite()" | kind=code-symbol | source=src/features/meetings/ai-actions.ts:L2556 | neighbors=[ai-actions.ts, assignFollowupPerson(), closeFollowupAsStale(), copyFollowupResponseToNotes(), reopenFollowup(), resolveFollowup()]
- "meetings_calendar_grid_zoneddaystartms": "zonedDayStartMs()" | kind=code-symbol | source=src/features/meetings/calendar-grid.ts:L199 | neighbors=[meter-actions.ts, calendar-grid.ts, DayWindow, calendar-grid.test.ts, remember(), zoneOffsetMs()]
- "meetings_event_color_test": "event-color.test.ts" | kind=code-symbol | source=src/features/meetings/event-color.test.ts:L1 | neighbors=[event-color.ts, eventColorClasses(), eventColorSlot(), eventDotClasses(), eventFadedClasses(), eventSolidClasses()]
- "meetings_load_actions_getmeetingloadsuggestions": "getMeetingLoadSuggestions()" | kind=code-symbol | source=src/features/meetings/load-actions.ts:L116 | neighbors=[meeting-load-link.tsx, context-pack.ts, page.tsx, load-actions.ts, canReadLoadBoard(), headlineFor()]
- "meetings_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/meetings/loading.tsx:L1 | neighbors=[007c37f ., 671c254 ., MeetingsLoading(), page-header.tsx, PageHeader(), skeleton.tsx]
- "meetings_meeting_url": "meeting-url.ts" | kind=code-symbol | source=src/features/meetings/meeting-url.ts:L1 | neighbors=[meeting-form.tsx, actions.ts, HTTP_URL, isValidMeetingUrl(), meetingUrlSchema, meeting-url.test.ts]
- "meetings_recurrence_test": "recurrence.test.ts" | kind=code-symbol | source=src/features/meetings/recurrence.test.ts:L1 | neighbors=[4d94451 feat(meetings): a recurrence ru…, recurrence.ts, expand(), occurrenceInstant(), RecurrenceRule, rruleFor()]
- "meetings_text_replace_tokenize": "tokenize()" | kind=code-symbol | source=src/features/meetings/text-replace.ts:L128 | neighbors=[text-replace.ts, diffSingleWord(), findOccurrences(), normalizeSelectedTerm(), text-replace.test.ts, isWordChar()]
- "motion_hydrated": "hydrated.ts" | kind=code-symbol | source=src/components/motion/hydrated.ts:L1 | neighbors=[007c37f ., isHydrated(), markHydrated(), motion-provider.tsx, reveal.tsx, route-transition.tsx]
- "notifications_mention_rules_test": "mention-rules.test.ts" | kind=code-symbol | source=src/features/notifications/mention-rules.test.ts:L1 | neighbors=[8c996d9 feat(notifications): a mention …, mention-rules.ts, classifyMention(), mentionAdvisory(), MentionFacts, facts()]
- "people_format_pct": "format-pct.ts" | kind=code-symbol | source=src/features/people/format-pct.ts:L1 | neighbors=[allocation-trend.tsx, assignments-card.tsx, capacity-heat-editable.tsx, cohort-views.tsx, history-views.tsx, formatPct()]
- "people_format_pct_formatpct": "formatPct()" | kind=code-symbol | source=src/features/people/format-pct.ts:L13 | neighbors=[allocation-trend.tsx, assignments-card.tsx, capacity-heat-editable.tsx, cohort-views.tsx, history-views.tsx, format-pct.ts]
- "people_iso_day_test": "iso-day.test.ts" | kind=code-symbol | source=src/features/people/iso-day.test.ts:L1 | neighbors=[iso-day.ts, isIsoDay(), isoDayAdd(), isoDayDiff(), isoDayOf(), isoDayRange()]
- "people_person_stats_buildpersonstats": "buildPersonStats()" | kind=code-symbol | source=src/features/people/person-stats.ts:L64 | neighbors=[page.tsx, person-stats.ts, allocationMeta(), followupMeta(), followupTone(), plural()]
- "people_queries_usercapacity": "UserCapacity" | kind=code-symbol | source=src/features/people/queries.ts:L95 | neighbors=[capacity-card.tsx, capacity-heat.tsx, capacity-heat-editable.tsx, directory.tsx, history-views.tsx, cohorts.ts]
- "people_task_workload_test": "task-workload.test.ts" | kind=code-symbol | source=src/features/people/task-workload.test.ts:L1 | neighbors=[task-workload.ts, bucketOpenTasks(), compareOpenTasks(), DueState, PersonTaskRow, summarizeOpenTasks()]
- "probe_probe": "probe.ts" | kind=code-symbol | source=.probe/probe.ts:L1 | neighbors=[live.ts, liveApps, schema.ts, users, lead, q]
- "public_table_of_contents": "table-of-contents.tsx" | kind=code-symbol | source=src/app/(public)/table-of-contents.tsx:L1 | neighbors=[d0da911 test(gemini): a public page may…, page.tsx, utils.ts, cn(), TableOfContents(), TocSection]
- "registry_types_searchprovider": "SearchProvider" | kind=code-symbol | source=src/features/search/registry/types.ts:L157 | neighbors=[search-providers.ts, search-providers.ts, search-providers.ts, search-providers.ts, providers.ts, types.ts]
- "roles_shared_scorecard": "Scorecard" | kind=code-symbol | source=src/features/signals/roles/shared.ts:L35 | neighbors=[signals-view.tsx, architect.ts, lead.ts, member.ts, pm.ts, shared.ts]
- "roles_shared_signalwindow": "SignalWindow" | kind=code-symbol | source=src/features/signals/roles/shared.ts:L19 | neighbors=[architect.ts, lead.ts, member.ts, pm.ts, roles.test.ts, shared.ts]
- "shell_brand_mark": "brand-mark.tsx" | kind=code-symbol | source=src/components/shell/brand-mark.tsx:L1 | neighbors=[page.tsx, maintenance-overlay.tsx, page.tsx, loading.tsx, page.tsx, layout.tsx]
- "shell_brand_mark_brandmark": "BrandMark()" | kind=code-symbol | source=src/components/shell/brand-mark.tsx:L7 | neighbors=[page.tsx, maintenance-overlay.tsx, page.tsx, loading.tsx, page.tsx, layout.tsx]
- "shell_nav_items_navitems": "navItems" | kind=code-symbol | source=src/components/shell/nav-items.ts:L39 | neighbors=[command-center.tsx, commands.ts, mobile-nav.tsx, nav-items.ts, nav-items.test.ts, shortcuts-overlay.tsx]
- "shell_sidebar_model_test": "sidebar-model.test.ts" | kind=code-symbol | source=src/components/shell/sidebar-model.test.ts:L1 | neighbors=[3dcd417 feat(shell): collapse the sideb…, sidebar-model.ts, nextSidebarState(), resolveSidebarState(), sidebarCommandLabel(), SidebarState]
- "speech_spoken_text_test": "spoken-text.test.ts" | kind=code-symbol | source=src/features/speech/spoken-text.test.ts:L1 | neighbors=[2607f59 fix(speech): read-aloud budgets…, chunk-speech.ts, effectiveSpeechLength(), spoken-text.ts, sinhalaFraction(), toSpokenText()]
- "sprints_board_view_isoverdue": "isOverdue()" | kind=code-symbol | source=src/features/sprints/board-view.ts:L204 | neighbors=[task-card.tsx, notes.ts, board-view.ts, BoardSummary, isTerminal(), matchesFilters()]
- "sprints_due_date_applyduedate": "applyDueDate()" | kind=code-symbol | source=src/features/sprints/due-date.ts:L83 | neighbors=[change-request-appliers.ts, import-actions.ts, actions.ts, due-date.ts, DueDateError, due-date.test.ts]
- "sprints_permissions": "permissions.ts" | kind=code-symbol | source=src/features/sprints/permissions.ts:L1 | neighbors=[board-column.tsx, capabilities.ts, can(), UserRole, canMoveTask(), permissions.test.ts]
- "sprints_plan_read_test": "plan-read.test.ts" | kind=code-symbol | source=src/features/sprints/plan-read.test.ts:L1 | neighbors=[app-health.ts, plan-read.ts, completionCount(), PlanGaps, readSprint(), SprintRead]
- "sprints_sprint_date_range_inclusivedaycount": "inclusiveDayCount()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L52 | neighbors=[roadmap-timeline.tsx, roadmap-layout.ts, sprint-date-range.ts, dayDelta(), shiftEndDate(), sprintDurationLabel()]
- "sprints_task_actions_movetaskonboard": "moveTaskOnBoard()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L547 | neighbors=[board.tsx, task-actions.ts, isForeignKeyViolation(), requireSession(), revalidateApp(), taskById()]
- "sprints_task_rank_planinsert": "planInsert()" | kind=code-symbol | source=src/features/sprints/task-rank.ts:L119 | neighbors=[board.tsx, task-rank.ts, needsRebalance(), neighboursAt(), rankBetween(), rebalance()]
- "transcription_live_client_test": "live-client.test.ts" | kind=code-symbol | source=src/features/transcription/live-client.test.ts:L1 | neighbors=[563cc1c fix(live): stop blaming the use…, live-client.ts, FakeSocket, newSession(), reconnect(), settle()]
- "transcription_pcm": "pcm.ts" | kind=code-symbol | source=src/features/transcription/pcm.ts:L1 | neighbors=[live-client.ts, bytesToBase64(), downsampleTo(), encodeAudioChunk(), floatTo16BitPCM(), int16ToLittleEndianBytes()]
- "transcription_pcm_encodeaudiochunk": "encodeAudioChunk()" | kind=code-symbol | source=src/features/transcription/pcm.ts:L125 | neighbors=[live-client.ts, pcm.ts, bytesToBase64(), downsampleTo(), floatTo16BitPCM(), int16ToLittleEndianBytes()]
- "transcription_session_budget_test": "session-budget.test.ts" | kind=code-symbol | source=src/features/transcription/session-budget.test.ts:L1 | neighbors=[session-budget.ts, AutoStopReason, estimateAudioTokens(), estimateCostUsd(), formatCostEstimate(), formatDuration()]
- "transcription_transcript_buffer_test": "transcript-buffer.test.ts" | kind=code-symbol | source=src/features/transcription/transcript-buffer.test.ts:L1 | neighbors=[5a95470 fix(meetings): transcripts stop…, transcript-buffer.ts, appendFragment(), commitTurn(), EMPTY_TRANSCRIPT, fullText()]
- "ui_dropdown_menu_dropdownmenuitem": "DropdownMenuItem()" | kind=code-symbol | source=src/components/ui/dropdown-menu.tsx:L76 | neighbors=[add-to-calendar.tsx, board-bulk-bar.tsx, meeting-list.tsx, notification-bell-client.tsx, card-quick-menu.tsx, account-menu.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-027.json

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
