# Node Description Batch 22 of 166

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
For an entity node (any other kind — e.g. a person, place, event, object),
describe what the entity is and its role, grounded in its type, its
relations (neighbors) and the provided citations/evidence — e.g.
"Lady Carfax, a wealthy heiress who disappears en route to Lausanne.".
Ground entity descriptions in the citations/evidence when present; do not
speculate beyond the context, so a node with no supporting context may be
left out of the reply.
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "commit:repo:github.com/DeegayuA/LogPup@b0692bd2dff7b3d07cfe79214e6e796cbec92e3b": "b0692bd fix(bugs): the template is not a bug somebody filed" | kind=Commit | source=git | neighbors=[13be4b6 ., main, bug-csv.ts, bug-csv.test.ts, import-actions.ts, report-input.ts]
- "commit:repo:github.com/DeegayuA/LogPup@d933927ee089d86ac20e02a7972cc46ccda15886": "d933927 feat(meeting-load): reads that cannot name anyone, and the three writes" | kind=Commit | source=git | neighbors=[5deded7 feat(meeting-load): the metrics…, main, 5c7efa5 feat(meeting-load): four surfac…, live.test.ts, actions.ts, admin-queries.ts]
- "components_activity_graph": "activity-graph.tsx" | kind=code-symbol | source=src/features/people/components/activity-graph.tsx:L1 | neighbors=[ActivityGraph(), tooltip(), index.tsx, ContributionGraph(), ContributionGraphBlock(), ContributionGraphCalendar()]
- "components_audit_csv_button": "audit-csv-button.tsx" | kind=code-symbol | source=src/features/admin/components/audit-csv-button.tsx:L1 | neighbors=[bulk-logic.ts, CsvValue, AUDIT_CSV_HEADERS, AuditCsvButton(), csv-download.ts, downloadCsv()]
- "components_bulk_select": "bulk-select.tsx" | kind=code-symbol | source=src/features/admin/components/bulk-select.tsx:L1 | neighbors=[apps-table.tsx, bulk-logic.ts, HeaderState, HeaderCheckbox(), RowCheckbox(), utils.ts]
- "components_cohort_nav": "cohort-nav.tsx" | kind=code-symbol | source=src/features/people/components/cohort-nav.tsx:L1 | neighbors=[CohortNav(), cohort-params.ts, COHORT_VIEW_LABEL, COHORT_VIEWS, CohortParams, peopleHref()]
- "components_contact_buttons": "contact-buttons.tsx" | kind=code-symbol | source=src/components/contact-buttons.tsx:L1 | neighbors=[app-contributions.tsx, ContactButtons(), phone.ts, telHref(), waHref(), utils.ts]
- "components_meeting_glance_meetingtiming": "MeetingTiming" | kind=code-symbol | source=src/features/meetings/components/meeting-glance.ts:L69 | neighbors=[meeting-detail-dialog.tsx, meeting-glance.ts, plural(), meeting-glance.test.ts, meeting-intel-sheet.tsx, meeting-list.tsx]
- "components_notification_bell": "notification-bell.tsx" | kind=code-symbol | source=src/features/notifications/components/notification-bell.tsx:L1 | neighbors=[notification-bell-client.tsx, NotificationBellClient(), NotificationBell(), session.ts, getSession, queries.ts]
- "components_tech_tags_input": "tech-tags-input.tsx" | kind=code-symbol | source=src/features/apps/components/tech-tags-input.tsx:L1 | neighbors=[app-form-dialog.tsx, TechTagsInput(), tech-tags.ts, canonicalizeTag(), filterTagSuggestions(), badge.tsx]
- "db_live_liveworklogentries": "liveWorklogEntries" | kind=code-symbol | source=src/db/live.ts:L51 | neighbors=[live.ts, queries.ts, queries.ts, auto-score-sync.ts, entry-actions.ts, entry-actions.test.ts]
- "db_schema_assignmenthistory": "assignmentHistory" | kind=code-symbol | source=src/db/schema.ts:L397 | neighbors=[trash-actions.ts, trash-actions.test.ts, trash-queries.ts, trash-queries.test.ts, activity-queries.ts, schema.ts]
- "db_schema_meetingfollowups": "meetingFollowups" | kind=code-symbol | source=src/db/schema.ts:L1091 | neighbors=[schema.ts, gather.ts, ai-actions.ts, assistant-actions.ts, followup-move-actions.ts, glance-actions.ts]
- "gemini_ai_meter_test": "ai-meter.test.ts" | kind=code-symbol | source=src/features/gemini/ai-meter.test.ts:L1 | neighbors=[13be4b6 ., bd5f524 feat(gemini): the honest half o…, ai-meter.ts, formatElapsed(), localSpend(), MeterInput]
- "gemini_budget_test": "budget.test.ts" | kind=code-symbol | source=src/features/gemini/budget.test.ts:L1 | neighbors=[59873cc feat(gemini): a monthly AI budg…, budget.ts, budgetLadderStep(), budgetMonth(), BudgetState, isOverBudget()]
- "gemini_pricing_priceformodel": "priceForModel()" | kind=code-symbol | source=src/features/gemini/pricing.ts:L66 | neighbors=[ai-model-select.tsx, ai-engine.ts, advertised-models.test.ts, ai-features.test.ts, ai-meter.ts, pricing.ts]
- "holidays_page": "page.tsx" | kind=code-symbol | source=src/app/(app)/admin/holidays/page.tsx:L1 | neighbors=[actor.ts, loadActor, capabilities.ts, can(), org-holidays-card.tsx, OrgHolidaysCard()]
- "intel_signals_clip": "clip()" | kind=code-symbol | source=src/features/intel/signals.ts:L109 | neighbors=[signals.ts, capacitySignals(), mergeableMeetingSignal(), overdueTaskSignal(), quietAppSignals(), sprintRiskSignals()]
- "lib_agenda_topics": "agenda-topics.ts" | kind=code-symbol | source=src/lib/agenda-topics.ts:L1 | neighbors=[AgendaTopicMatch, escapeRegExp(), findEarliestKeywordMatch(), matchAgendaTopic(), normalizeRoleToken(), TOPIC_BUCKETS]
- "lib_lk_holidays_islksunday": "isLkSunday()" | kind=code-symbol | source=src/lib/lk-holidays.ts:L226 | neighbors=[meetings-agenda.tsx, meetings-month-calendar.tsx, meetings-time-grid.tsx, fortnight.tsx, lk-holidays.ts, weekdayFormatter()]
- "lib_meeting_intent_parsemeetingintent": "parseMeetingIntent()" | kind=code-symbol | source=src/lib/meeting-intent.ts:L194 | neighbors=[meeting-form.tsx, meeting-intent.ts, extractApp(), extractDay(), extractDuration(), extractTime()]
- "lib_org_from_domain_orgforemail": "orgForEmail()" | kind=code-symbol | source=src/lib/org-from-domain.ts:L12 | neighbors=[actions.ts, add-user-dialog.tsx, user-table.tsx, auth.ts, org-from-domain.ts, org-from-domain.test.ts]
- "lib_recurrence_test": "recurrence.test.ts" | kind=code-symbol | source=src/lib/recurrence.test.ts:L1 | neighbors=[924eca4 feat(calendar): expand a daily …, recurrence.ts, describeRecurrence(), expandRecurrence(), RecurrenceError, RecurrenceRule]
- "lib_tech_tags": "tech-tags.ts" | kind=code-symbol | source=src/lib/tech-tags.ts:L1 | neighbors=[actions.ts, app-form-dialog.tsx, tech-tags-input.tsx, canonicalizeTag(), CURATED_TECH_TAGS, CURATED_TECH_TAGS_RAW]
- "lib_working_days_workingdayfraction": "WorkingDayFraction" | kind=code-symbol | source=src/lib/working-days.ts:L23 | neighbors=[fortnight.tsx, signals.ts, working-days.ts, working-days.test.ts, coverage.ts, notify-rules.ts]
- "meeting_load_series_groups": "series-groups.ts" | kind=code-symbol | source=src/features/meeting-load/series-groups.ts:L1 | neighbors=[5deded7 feat(meeting-load): the metrics…, gather.ts, queries.ts, groupIntoSeries(), SeriesGroup, SeriesOccurrenceInput]
- "meetings_actions_meetingbyid": "meetingById()" | kind=code-symbol | source=src/features/meetings/actions.ts:L154 | neighbors=[actions.ts, deleteMeeting(), duplicateMeeting(), appIdsForMeeting(), rescheduleMeeting(), retryCalendarInvite()]
- "meetings_actions_retrycalendarinvite": "retryCalendarInvite()" | kind=code-symbol | source=src/features/meetings/actions.ts:L540 | neighbors=[add-to-calendar.tsx, actions.ts, appNameById(), canManageMeeting(), meetingById(), requireSession()]
- "meetings_queries_hydrate": "hydrate()" | kind=code-symbol | source=src/features/meetings/queries.ts:L155 | neighbors=[queries.ts, getMeetingsForApp(), getMeetingsForDay(), getMeetingsForRange(), getUpcomingMeetingsForUser(), attachApps()]
- "meetings_recording_progress_test": "recording-progress.test.ts" | kind=code-symbol | source=src/features/meetings/recording-progress.test.ts:L1 | neighbors=[007c37f ., recording-progress.ts, formatRemaining(), MeetingProcessing, observedMsPerSegment(), SegmentSnapshot]
- "meetings_rsvp_actions_test": "rsvp-actions.test.ts" | kind=code-symbol | source=src/features/meetings/rsvp-actions.test.ts:L1 | neighbors=[live.ts, liveMeetings, schema.ts, meetingAttendees, rsvp-actions.ts, asUser()]
- "meetings_screen_keyframes_test": "screen-keyframes.test.ts" | kind=code-symbol | source=src/features/meetings/screen-keyframes.test.ts:L1 | neighbors=[screen-keyframes.ts, computeDHash(), computeDownscaledDimensions(), formatCapturedAt(), hammingDistance(), shouldKeepFrame()]
- "notifications_entity_kinds": "entity-kinds.ts" | kind=code-symbol | source=src/features/notifications/entity-kinds.ts:L1 | neighbors=[8c996d9 feat(notifications): a mention …, ENTITY_KINDS, EntityKind, entityKindForSource(), isMentionSource(), MENTION_SOURCES]
- "notifications_retention_test": "retention.test.ts" | kind=code-symbol | source=src/features/notifications/retention.test.ts:L1 | neighbors=[c93474b feat(notifications): a schedule…, retention.ts, DEFAULT_RETENTION_POLICY, planRetention(), PruneReason, RetentionCutoffs]
- "people_actions_assignuser": "assignUser()" | kind=code-symbol | source=src/features/people/actions.ts:L201 | neighbors=[assign-dialog.tsx, capacity-heat-editable.tsx, actions.ts, historyStatements(), isUniqueViolation(), nameForUser()]
- "people_format_instant_partsof": "partsOf()" | kind=code-symbol | source=src/features/people/format-instant.ts:L40 | neighbors=[format-instant.ts, businessHourOf(), formatBusinessDate(), formatBusinessDayMonth(), formatBusinessDayMonthTime(), formatBusinessMonthYear()]
- "people_handover_inventory": "handover-inventory.ts" | kind=code-symbol | source=src/features/people/handover-inventory.ts:L1 | neighbors=[handover-form.tsx, handover-actions.ts, NON_TRANSFERABLE, Share, splitAllocation(), TRANSFERABLE_GROUPS]
- "people_queries_activeuser": "ActiveUser" | kind=code-symbol | source=src/features/people/queries.ts:L110 | neighbors=[app-form-dialog.tsx, apps-table.tsx, assign-dialog.tsx, load-board.tsx, meeting-form.tsx, meeting-intel.tsx]
- "profile_loading": "loading.tsx" | kind=code-symbol | source=src/app/(app)/profile/loading.tsx:L1 | neighbors=[ProfileLoading(), card.tsx, Card(), CardContent(), CardHeader(), page-header.tsx]
- "settings_overview": "overview.ts" | kind=code-symbol | source=src/features/settings/overview.ts:L1 | neighbors=[readiness.ts, ReadinessLevel, changelog.ts, ChangelogEntry, AiStatus, describeAiStatus()]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-021.json

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
