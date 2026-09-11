# Node Description Batch 33 of 166

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

- "meetings_visibility_test": "visibility.test.ts" | kind=code-symbol | source=src/features/meetings/visibility.test.ts:L1 | neighbors=[514d33b feat(meetings): a meeting can b…, ALLOWLIST, FEATURES_DIR, offenders, readers, walk()]
- "notifications_entity_kinds_test": "entity-kinds.test.ts" | kind=code-symbol | source=src/features/notifications/entity-kinds.test.ts:L1 | neighbors=[8c996d9 feat(notifications): a mention …, entity-kinds.ts, ENTITY_KINDS, entityKindForSource(), isMentionSource(), MENTION_SOURCES]
- "notifications_notify_applycap": "applyCap()" | kind=code-symbol | source=src/features/notifications/notify.ts:L494 | neighbors=[notify.ts, countToday(), findBindingDedupeRows(), overflowRow(), overflowSoFar(), createNotifications()]
- "people_activity_levels_test": "activity-levels.test.ts" | kind=code-symbol | source=src/features/people/activity-levels.test.ts:L1 | neighbors=[activity-levels.ts, ACTIVITY_THRESHOLDS, ActivityLevel, activityPeak(), activityTotal(), buildActivitySeries()]
- "people_allocation_summarizeallocations": "summarizeAllocations()" | kind=code-symbol | source=src/features/people/allocation.ts:L4 | neighbors=[capacity-heat-editable.tsx, actions.ts, allocation.ts, allocation-history.ts, allocation.test.ts, queries.ts]
- "people_as_of_date_test": "as-of-date.test.ts" | kind=code-symbol | source=src/features/people/as-of-date.test.ts:L1 | neighbors=[as-of-date.ts, isoDaysAgo(), resolveAsOf(), AFTER_LOCAL_MIDNIGHT, NOW, todayIso()]
- "people_as_of_date_todayiso": "todayIso()" | kind=code-symbol | source=src/features/people/as-of-date.ts:L77 | neighbors=[as-of-picker.tsx, handover-form.tsx, as-of-date.ts, as-of-date.test.ts, isoDay(), history-params.ts]
- "people_format_instant_formatbusinessdaymonth": "formatBusinessDayMonth()" | kind=code-symbol | source=src/features/people/format-instant.ts:L61 | neighbors=[activity-feed.tsx, audit-trail.tsx, person-followups-card.tsx, format-instant.ts, partsOf(), format-instant.test.ts]
- "people_format_instant_test": "format-instant.test.ts" | kind=code-symbol | source=src/features/people/format-instant.test.ts:L1 | neighbors=[format-instant.ts, formatBusinessDayMonth(), formatBusinessMeetingRange(), formatBusinessMonthYear(), formatBusinessTime(), formatBusinessWeekdayDayMonth()]
- "people_iso_day_isisoday": "isIsoDay()" | kind=code-symbol | source=src/features/people/iso-day.ts:L32 | neighbors=[cost.ts, queries.ts, rate-actions.ts, iso-day.ts, iso-day.test.ts, toUtcMidnight()]
- "people_iso_day_isodayrange": "isoDayRange()" | kind=code-symbol | source=src/features/people/iso-day.ts:L84 | neighbors=[signals.ts, activity-levels.ts, iso-day.ts, isoDayAdd(), isoDayDiff(), iso-day.test.ts]
- "people_person_stats_personstat": "PersonStat" | kind=code-symbol | source=src/features/people/person-stats.ts:L27 | neighbors=[dashboard-zones.tsx, person-stat-row.tsx, my-day-stats.ts, history-stats.ts, person-stats.ts, person-stats.test.ts]
- "people_person_stats_test": "person-stats.test.ts" | kind=code-symbol | source=src/features/people/person-stats.test.ts:L1 | neighbors=[person-stats.ts, buildPersonStats(), PersonStat, PersonStatsInput, input(), stat()]
- "people_summary_test": "summary.test.ts" | kind=code-symbol | source=src/features/people/summary.test.ts:L1 | neighbors=[13be4b6 ., summary.ts, buildPersonSummaryPrompt(), derivePersonSummary(), PersonSummaryFacts, facts()]
- "registry_limits_likepattern": "likePattern()" | kind=code-symbol | source=src/features/search/registry/limits.ts:L19 | neighbors=[search-providers.ts, search-providers.ts, search-providers.ts, search-providers.ts, limits.ts, search-providers.ts]
- "roles_shared_share": "share()" | kind=code-symbol | source=src/features/signals/roles/shared.ts:L69 | neighbors=[architect.ts, lead.ts, member.ts, pm.ts, roles.test.ts, shared.ts]
- "scripts_generate_changelog": "generate-changelog.mjs" | kind=code-symbol | source=scripts/generate-changelog.mjs:L1 | neighbors=[data, KINDS, out, root, splitSubject(), versions]
- "settings_nav": "nav.ts" | kind=code-symbol | source=src/features/settings/nav.ts:L1 | neighbors=[commands.ts, settingsNavItem, nav-items.ts, NavItem, mobile-nav.tsx, sidebar.tsx]
- "signals_figure_cannotsay": "cannotSay()" | kind=code-symbol | source=src/features/signals/figure.ts:L80 | neighbors=[architect.ts, lead.ts, member.ts, pm.ts, figure.ts, figure.test.ts]
- "signals_figure_measured": "measured()" | kind=code-symbol | source=src/features/signals/figure.ts:L61 | neighbors=[architect.ts, lead.ts, member.ts, pm.ts, figure.ts, figure.test.ts]
- "signals_figure_median": "median()" | kind=code-symbol | source=src/features/signals/figure.ts:L137 | neighbors=[architect.ts, lead.ts, member.ts, pm.ts, figure.ts, figure.test.ts]
- "speech_chunk_speech_chunkforspeech": "chunkForSpeech()" | kind=code-symbol | source=src/features/speech/chunk-speech.ts:L118 | neighbors=[actions.ts, chunk-speech.ts, cutAt(), effectiveSpeechLength(), rawLimitFor(), chunk-speech.test.ts]
- "speech_wav": "wav.ts" | kind=code-symbol | source=src/features/speech/wav.ts:L1 | neighbors=[use-speech.ts, base64ToBytes(), parsePcmRate(), pcmToWav(), writeAscii(), wav.test.ts]
- "sprints_board_view_boardsummary": "BoardSummary" | kind=code-symbol | source=src/features/sprints/board-view.ts:L385 | neighbors=[board.tsx, board-toolbar.tsx, board-view.ts, isOverdue(), isTerminal(), board-view.test.ts]
- "sprints_checkins_computetaskprogress": "computeTaskProgress()" | kind=code-symbol | source=src/features/sprints/checkins.ts:L40 | neighbors=[sprint-checkins.tsx, notes.ts, planner.ts, page.tsx, checkins.ts, checkins.test.ts]
- "sprints_plan_read_readsprint": "readSprint()" | kind=code-symbol | source=src/features/sprints/plan-read.ts:L108 | neighbors=[roadmap-timeline.tsx, page.tsx, plan-read.ts, daysLeftPhrase(), toTaskCounts(), plan-read.test.ts]
- "sprints_queries_taskwithassignee": "TaskWithAssignee" | kind=code-symbol | source=src/features/sprints/queries.ts:L15 | neighbors=[board.tsx, board-column.tsx, task-card.tsx, task-dialog.tsx, actions.ts, queries.ts]
- "sprints_roadmap_geometry_adddays": "addDays()" | kind=code-symbol | source=src/features/sprints/roadmap-geometry.ts:L42 | neighbors=[roadmap-geometry.ts, parseIsoDate(), toIsoDate(), resizeEnd(), resizeStart(), shiftRange()]
- "sprints_sprint_date_range_daydelta": "dayDelta()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L43 | neighbors=[calendar-view.ts, roadmap-layout.ts, sprint-date-range.ts, parseIsoDate(), inclusiveDayCount(), sprint-date-range.test.ts]
- "sprints_sprint_date_range_shiftenddate": "shiftEndDate()" | kind=code-symbol | source=src/features/sprints/sprint-date-range.ts:L67 | neighbors=[sprint-edit-dialog.tsx, sprint-form-dialog.tsx, sprint-date-range.ts, addCalendarDays(), inclusiveDayCount(), sprint-date-range.test.ts]
- "sprints_task_actions_bulkupdatetasks": "bulkUpdateTasks()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L700 | neighbors=[board.tsx, task-actions.ts, isForeignKeyViolation(), requireSession(), revalidateApps(), unexpected()]
- "sprints_task_actions_deletetask": "deleteTask()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L815 | neighbors=[task-card.tsx, task-dialog.tsx, task-actions.ts, revalidateApp(), taskById(), unexpected()]
- "sprints_task_actions_revalidateapp": "revalidateApp()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L242 | neighbors=[task-actions.ts, createTask(), deleteTask(), moveTaskOnBoard(), revalidateApps(), updateTask()]
- "sprints_task_actions_unexpected": "unexpected()" | kind=code-symbol | source=src/features/sprints/task-actions.ts:L165 | neighbors=[task-actions.ts, bulkUpdateTasks(), createTask(), deleteTask(), moveTaskOnBoard(), updateTask()]
- "sprints_task_status_test": "task-status.test.ts" | kind=code-symbol | source=src/features/sprints/task-status.test.ts:L1 | neighbors=[001694a refactor(tasks): express the co…, e5f8bbf feat(sprints): one door for tas…, eb38ea0 fix(tasks): stamp completed_at …, task-status.ts, NOW, transitionTaskStatus()]
- "texts_counting_number": "counting-number.tsx" | kind=code-symbol | source=src/components/animate-ui/primitives/texts/counting-number.tsx:L1 | neighbors=[stat-number.tsx, use-is-in-view.tsx, useIsInView(), UseIsInViewOptions, CountingNumber(), CountingNumberProps]
- "transcription_flag": "flag.ts" | kind=code-symbol | source=src/features/transcription/flag.ts:L1 | neighbors=[meeting-intel.tsx, page.tsx, actions.ts, isLiveTranscriptionEnabled(), parseLiveTranscriptionFlag(), flag.test.ts]
- "transcription_live_client_livetranscriptionsession_connect": ".connect()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L151 | neighbors=[LiveTranscriptionSession, .fail(), .handleConnectionFailure(), .setStatus(), .start(), .startAudio()]
- "transcription_live_client_livetranscriptionsession_fail": ".fail()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L337 | neighbors=[LiveTranscriptionSession, .connect(), .stop(), .handleConnectionFailure(), .scheduleReconnect(), .startAudio()]
- "transcription_live_client_livetranscriptionsession_handleevent": ".handleEvent()" | kind=code-symbol | source=src/features/transcription/live-client.ts:L237 | neighbors=[LiveTranscriptionSession, .scheduleReconnect(), .setStatus(), .startAudio(), .teardownSocket(), .handleRawMessage()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-032.json

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
