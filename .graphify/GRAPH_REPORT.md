# Graph Report - .  (2026-09-11)

## Corpus Check
- Large corpus: 1206 files · ~1,690,188 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 6628 nodes · 18667 edges · 246 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: imports: 7084 · contains: 5286 · imports_from: 3641 · calls: 1211 · MODIFIES: 921 · ON_BRANCH: 200 · PARENT_OF: 199 · references: 91 · method: 25 · re_exports: 5 · inherits: 4


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 1206 · Candidates: 1371
- Excluded: 11 untracked · 57136 ignored · 10 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `a8c5100`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `Button()` - 162 edges
2. `cn()` - 161 edges
3. `Db` - 116 edges
4. `users` - 71 edges
5. `ActionResult` - 61 edges
6. `ok()` - 56 edges
7. `err()` - 56 edges
8. `Card()` - 54 edges
9. `CardContent()` - 54 edges
10. `CardHeader()` - 51 edges

## Surprising Connections (you probably didn't know these)
- `removeUser()` --calls--> `otherActiveSuperadminCount()`  [EXTRACTED]
  src/features/admin/actions.ts → src/features/admin/actions.ts  _Bridges community 60 → community 58_
- `updateApp()` --calls--> `nameForUser()`  [EXTRACTED]
  src/features/apps/actions.ts → src/features/apps/actions.ts  _Bridges community 58 → community 77_
- `requireCapability()` --calls--> `loadActor`  [EXTRACTED]
  src/features/auth/actor.ts → src/features/auth/actor.ts  _Bridges community 6 → community 3_
- `001694a refactor(tasks): express the completed_at rule against the terminal set` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 132 → community 14_
- `007c37f .` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 153 → community 14_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (83): askAuditFilters(), 473168b docs: restore the reasoning the sweep deleted, and record one rule it broke, 743b1f2 fix(ui): a false-positive tag match, a dead branch, and two restored docs, meterOrigin(), MeterOriginSource, useAiMeter(), PRESETS, AuditAsk() (+75 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (106): 0a2e8bb feat(gemini): ask Google what models exist, instead of remembering to, AiEngineCard(), READINESS_TONE, STABILITY_HINT, STABILITY_NOTE, AiFeatureToggle(), AiFeaturesCard(), AiModelSelect() (+98 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (130): liveAppsAs(), liveNoteSegments, liveTasksAs(), meetingNoteSegments, meetingTaskSuggestions, acceptSuggestionInput, ActionItemOut, addFollowup() (+122 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (69): countPendingApprovals, getApprovalsInbox(), getMyRequests(), select, toInbox(), mayReview(), ReviewableRequest, listPendingUsers (+61 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (103): backupUserColumns, buildSnapshot(), encryptionKey(), encryptSnapshot(), { authMock, deleteSpy }, AppContribution, rankContributors(), managedAppIdsFor() (+95 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (61): metadata, deleteUploadedAvatar(), removeOwnAvatar(), uploadOwnAvatar(), roleLabel(), DEFAULT_COPY, ERROR_COPY, metadata (+53 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (79): logActivity(), INPUT, { insertSpy, valuesSpy }, grantInput, askInput, AuditAskResult, commentInput, requireCapability() (+71 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (61): generateAppFromReadme(), generateAppFromRepo(), generateFromFacts(), emptyState, FormState, AppFormDialog(), AppFormInitialValues, emptyState (+53 more)

### Community 8 - "Community 8"
Cohesion: 0.04
Nodes (69): 514d33b feat(meetings): a meeting can belong to its attendees alone, and quick notes do, AddToCalendarMenu(), MeetingDetailDialog(), RESPONSE_LABEL, describeQuickAdd(), EditableMeeting, FormState, hostOf() (+61 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (79): 929997a feat(meetings): /meetings opens on the week grid, JumpToDate(), MeetingIntelSheet(), MeetingList(), MeetingsAgenda(), MeetingsCalendar(), rangeHeading(), useIsWideScreen() (+71 more)

### Community 10 - "Community 10"
Cohesion: 0.03
Nodes (65): searchProviders, setOwnGithubLogin(), setOwnPhone(), setPasswordInput, GoogleIdentity, TokenInfo, VALID_ISSUERS, verifyGoogleIdToken() (+57 more)

### Community 11 - "Community 11"
Cohesion: 0.04
Nodes (48): AdminUser, listAllUsers(), PendingUser, StatNumber(), statTransition, useStaticNumber(), EmploymentType, hasCappablePower() (+40 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (58): 056203d fix(worklog): stop printing the grammar legend twice on one screen, 51008f1 feat(worklog): one click fills the day's hours from what LogPup already saw, 7479d4a docs(specs): measure the work, not the worker, 752ea90 style(theme): the ember token follows holiday to purple, 8cfbffd fix(worklog): the hours selects showed raw values, not labels, 8e5308d feat(worklog): one grammar for a logged hour, in plain English, 8fa8f26 feat(worklog): the whole day in one field, showing what it heard as you type, afba1c3 feat(worklog): the hours form can name a task, which is what it always required (+50 more)

### Community 13 - "Community 13"
Cohesion: 0.04
Nodes (59): listRecentActivity, InboxRequest, DashboardPage(), greetingFor(), PortfolioSummary, USER_ROLES, 104afee feat(dashboard): the dashboard is a list of zones, not a chain of ternaries, CoverageFigure() (+51 more)

### Community 14 - "Community 14"
Cohesion: 0.04
Nodes (65): main, 00ce430 feat(fonts): bundle Noto Sans Sinhala so printed Sinhala looks the same on every machine, 09468aa feat(worklog): the team view can finally show the people who are behind, 1b4f4ee feat(worklog): log an hour by writing one sentence, 227e958 build: npm run verify:head — typecheck the commit, not the working tree, 24fb822 fix(worklog): two absence writes that quietly discarded somebody's decision, 264e022 fix(home): align three read sites with MeetingIntelItem's field names, 272f9a7 feat(meetings): store the decision, never the suggestion (+57 more)

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (49): approvalBadgeLabel(), approvalBadgeText(), ApprovalCounts, approvalTotal(), NO_APPROVALS, showApprovals(), 3dcd417 feat(shell): collapse the sidebar to an icon rail, a1e227e feat(search): a zero-hit search becomes a question, not a dead end (+41 more)

### Community 16 - "Community 16"
Cohesion: 0.04
Nodes (53): e38a385 feat(worklog): what a logged day went to, as segments a cell can carry, FirstLogNudgeBanner(), FirstLogNudge(), daysRemaining(), sprintProgress(), dailyWorklogs, orgHolidays, workSchedules (+45 more)

### Community 17 - "Community 17"
Cohesion: 0.05
Nodes (56): e2090c6 feat(meetings): "Not tracked" rows edit like every other suggestion, f823a54 feat(meetings): correct a misheard word everywhere by selecting it, ActionItemActions, ActionItemAssignee(), ActionItemDueDate(), ActionItemSuggestionsList(), ActionItemTitle(), buildAssigneePool() (+48 more)

### Community 18 - "Community 18"
Cohesion: 0.05
Nodes (57): AliasedApp, AppMatch, AppMatchHow, appPromptLine(), appVocabulary(), containsWord(), deriveAcronyms(), escape() (+49 more)

### Community 19 - "Community 19"
Cohesion: 0.05
Nodes (46): 671c254 ., 95b092e feat(meetings): quick note and new meeting share one split pill in the header, AttendeeResponse, durationLabel(), isAwaitingViewerRsvp(), MeetingsOverview, MeetingState, MeetingTiming (+38 more)

### Community 20 - "Community 20"
Cohesion: 0.06
Nodes (42): commands, commands, isAdminRole(), commands, commands, EMPTY_SCOPE, 029ff45 feat(search): worklog and activity join the palette, and two stale exemptions retire, bee388b feat(intel): fold the page into the bubble, behind one arrow (+34 more)

### Community 21 - "Community 21"
Cohesion: 0.06
Nodes (52): BulkPatch, BoardColumn(), columnDroppableId(), groupIdFromDroppable(), OptimisticMove, CardFace(), cardLabel(), formatDueDate() (+44 more)

### Community 22 - "Community 22"
Cohesion: 0.05
Nodes (49): EMPTY_OPEN_MAP, EmptyFilterState(), FilterBar(), getDensitySnapshot(), getSummaryLanguageSnapshot(), KIND_META, kindAccentClass(), MeetingPanelsProvider() (+41 more)

### Community 23 - "Community 23"
Cohesion: 0.06
Nodes (41): 58b4984 fix(worklog): the team grid stops leaving screen-high holes, and the legend fits one line, 89dee50 fix(ui): craft regressions the sweep introduced into its own surfaces, a628b27 feat(worklog): the progress grid shows which project each day went to, e8b2ac2 feat(worklog): hours you logged stop counting as nothing logged, LogBox(), LogBoxGap, MonthSummary(), num() (+33 more)

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (46): BackupDownload, DangerTargets, deleteMeetingFromDanger(), emptyTrash(), exportWorkspaceBackup(), loadDangerTargets(), PURGE_BY_KIND, resetApp() (+38 more)

### Community 25 - "Community 25"
Cohesion: 0.04
Nodes (40): ACTIVE_LANGUAGE_LABEL, CaptureMode, COMPOSER_COPY, ComposerField, Event, EventTarget, LANGUAGE_OPTIONS, LanguagePreference (+32 more)

### Community 26 - "Community 26"
Cohesion: 0.08
Nodes (46): MaintenanceBanner(), KIND_ICONS, MaintenanceControls(), MaintenanceDetailsDialog(), MaintenanceAuthNotice(), MaintenanceOverlay(), armMaintenance(), cancelMaintenance() (+38 more)

### Community 27 - "Community 27"
Cohesion: 0.06
Nodes (36): appCreateInput, 3ac9d68 ., 77dfc15 fix(worklog): no task entry could be saved, at all, 8d1c180 fix(worklog): lift absenceDays out of the page, and render a bullet as one, 9f936b5 Add app aliases and auto-scored worklog flow, liveWorklogEntries, worklogEntries, inferNativeButton() (+28 more)

### Community 28 - "Community 28"
Cohesion: 0.11
Nodes (33): AssignDialog(), APP_STATUS_LABEL, UsedByRow, RESPONSE_WORD, EMPTY, FormState, SprintEditDialog(), Status (+25 more)

### Community 29 - "Community 29"
Cohesion: 0.06
Nodes (40): postAppComment(), AppComment, listAppComments(), getAppContributions, APP_TAB_IDS, APP_TAB_LABEL, appTabHref(), AppTabId (+32 more)

### Community 30 - "Community 30"
Cohesion: 0.05
Nodes (36): AltaVisionLogo(), AssignmentsCard(), PersonHeader(), PersonSummaryCard(), dateFmt, durationLabel(), fileDateFmt, generateMetadata() (+28 more)

### Community 31 - "Community 31"
Cohesion: 0.07
Nodes (47): 35d16f8 feat(finance): server layer for project cost, worth and margin, addMonthsIso(), CostableAttributedEntry, CostableEntry, CostBreakdown, costForEntries(), costForProject(), coveringRate() (+39 more)

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (38): 3e134d4 fix(finance): project cost counted only task hours, so almost none of it, d5b6409 ., ArchitectMeeting, ArchitectScorecard, ArchitectScorecardInput, LeadAssignment, LeadCompletion, LeadReview (+30 more)

### Community 33 - "Community 33"
Cohesion: 0.07
Nodes (37): 59873cc feat(gemini): a monthly AI budget — warn at 90%, refuse at 100%, aiUsageEvents, AiCallSlug, shouldUseInlineAudio(), Budget, BudgetInput, budgetLadderStep(), budgetMonth() (+29 more)

### Community 34 - "Community 34"
Cohesion: 0.09
Nodes (39): a1e0845 ., BriefingCard(), IntelView(), Load, Filter, SEVERITY, SEVERITY_ORDER, SignalBoard() (+31 more)

### Community 35 - "Community 35"
Cohesion: 0.06
Nodes (33): AsOfPicker(), HistoryFilters(), HistoryDataSkeleton(), HistoryShellSkeleton(), BAND_WORD, HistoryAppsTable(), HistoryChangeLog(), HistoryPeopleTable() (+25 more)

### Community 36 - "Community 36"
Cohesion: 0.07
Nodes (45): Resource, 8d28f33 feat(notifications): dedupe, a daily cap, and nobody notified about themselves, e5f8bbf feat(sprints): one door for task status, so completed_at cannot lie, applyCap(), collapsingArbiter(), countToday(), createNotifications(), dropDeadEntities() (+37 more)

### Community 37 - "Community 37"
Cohesion: 0.07
Nodes (42): 353c6e9 docs(deadlines): pre-0049 tasks never gain an original, and that is the answer, cdc541d feat(deadlines): let a PM upload the plan, and check it first, DEADLINE_CSV_COLUMNS, DEADLINE_CSV_EXAMPLE_ROW, DEADLINE_CSV_HEADERS, DeadlineCsvColumn, DeadlineCsvColumnSpec, DeadlineCsvParse (+34 more)

### Community 38 - "Community 38"
Cohesion: 0.09
Nodes (41): AppHealth, AppHealthInput, AppSprintSnapshot, AppTaskCounts, completionPct(), dayDiff(), daysSince(), HEALTH_LABEL (+33 more)

### Community 39 - "Community 39"
Cohesion: 0.06
Nodes (33): apps, meetingLoadDecisions, meetings, authFile, repoRoot, APP_SLUG, decidedKeys, meetingIds (+25 more)

### Community 40 - "Community 40"
Cohesion: 0.08
Nodes (39): normalizeHeader(), splitCsvRows(), BUG_CSV_COLUMNS, BUG_CSV_EXAMPLE_ROW, BUG_CSV_HEADERS, BugCsvColumn, BugCsvColumnSpec, bugCsvFields (+31 more)

### Community 41 - "Community 41"
Cohesion: 0.08
Nodes (36): HEALTH_FILL, RoadmapSpine(), SpineSprint, ActiveDrag, BarBody(), BarMetaLevel, buildTicks(), dragId() (+28 more)

### Community 42 - "Community 42"
Cohesion: 0.09
Nodes (31): 8bacbca ., AUTH_PATHS, Bypass, bypassKey(), canManageMaintenance(), MaintenanceGate(), PRINT_PATHS, readStoredBypass() (+23 more)

### Community 43 - "Community 43"
Cohesion: 0.07
Nodes (30): 3c0bc01 ., icsHref(), capChips(), CHIP_TONE, CountChip(), MetaChip(), QuestionsChip(), ReconvenesChip() (+22 more)

### Community 44 - "Community 44"
Cohesion: 0.10
Nodes (31): colomboDayEnd(), colomboDayStart(), loadOlderActivity(), loadOlderInput, LoadOlderResult, activityConditions(), activityParams(), activitySearchCondition() (+23 more)

### Community 45 - "Community 45"
Cohesion: 0.07
Nodes (32): 53ae2f3 feat(worklog): attribute hours to a project, not only to a task, 5e32b09 fix(worklog): Fill my day ignored the day a developer actually had, ac3c551 fix(db): usage_duration takes slot 0059 — its journal entry raced two sessions, LoggedDay, LoggedDaysList(), public.apps, worklog_entries, ScoreSource (+24 more)

### Community 46 - "Community 46"
Cohesion: 0.07
Nodes (33): AllocationHistoryCard(), KIND_DOT, KIND_LABEL, AllocationTrend(), AttendanceAsOf, AttendanceChange, AttendanceEntry, AttendanceEntryInput (+25 more)

### Community 47 - "Community 47"
Cohesion: 0.09
Nodes (34): APP_RISK_FILTERS, APP_SORTS, APP_STATUS_FILTERS, AppRiskFilter, AppSort, AppStatusFilter, BrowsableApp, browseHref() (+26 more)

### Community 48 - "Community 48"
Cohesion: 0.08
Nodes (34): 0ef5105 fix(intel): a briefing priority may only link inside the product, and accept ?ask=, 3893a7b style(theme): holiday moves from amber to purple, in both themes, 6e7c05f fix(intel): stop printing a person's name twice in a row, 92857d0 docs: cost spec — finance.view is the gate, with its three deliberate properties, d269096 feat(intel): keep the Ask LogPup conversation, and stop printing UUIDs at people, d78a3e1 fix(intel): the briefing links its own evidence instead of printing brackets, AskCitation, AnswerSegment (+26 more)

### Community 49 - "Community 49"
Cohesion: 0.06
Nodes (28): 702dd68 feat(db): takes become a thing the database knows about, liveMeetingsAs(), liveMeetingSeries, liveRecordings, liveRecordingSegments, MEETING_CHILD_TABLES, qb, SOFT_TABLES (+20 more)

### Community 50 - "Community 50"
Cohesion: 0.07
Nodes (34): ActivityGraph(), CELL_CLASSES, formatDay(), PersonActivityCard(), SWATCH, Activity, ContributionGraph(), ContributionGraphBlock() (+26 more)

### Community 51 - "Community 51"
Cohesion: 0.09
Nodes (29): dd6f2fd feat(worklog): define how long a full day is, in one place, f180d72 feat(people): capacity in hours, derived from each person's own week, SchedulePattern, allocatedHours(), hoursForFraction(), HoursLoad, round1(), NO_WEEK (+21 more)

### Community 52 - "Community 52"
Cohesion: 0.10
Nodes (30): BulkNouns, BulkOutcome, BulkReport, bulkResultTone(), BulkSkip, csvCell(), csvFilename(), CsvValue (+22 more)

### Community 53 - "Community 53"
Cohesion: 0.07
Nodes (23): 8dd587b feat(people): filter and sort the By project view, from the URL, d614dea feat(people): rank the overlaps before making anyone read them, AddUserDialog(), CLEARED, CohortDataSkeleton(), DirectoryDataSkeleton(), ProjectCohortList(), ProjectOverlapView() (+15 more)

### Community 54 - "Community 54"
Cohesion: 0.09
Nodes (26): d933927 feat(meeting-load): reads that cannot name anyone, and the three writes, inviteChurnBetween(), OccurrenceInvites, seriesChurnCount(), churnFacts(), gatherLoadFacts(), LoadFacts, MeetingFact (+18 more)

### Community 55 - "Community 55"
Cohesion: 0.07
Nodes (36): AppOption, assembleMeetingPrep(), AttendeeAppPrep, AutoAssignCandidate, AutoAssignDecision, AutoAssignedTaskFields, AutoAssignNotificationInput, AutoAssignNotificationPayload (+28 more)

### Community 56 - "Community 56"
Cohesion: 0.10
Nodes (32): 137eacc docs(intel): write down which absence set the gap filter means, since no test pins it, 1eb625d docs(intel): name the gap-list / denominator asymmetry before it reads as a bug, buildGrounding(), entryLines(), fit(), GroundingEntry, GroundingSection, GroundingSource (+24 more)

### Community 57 - "Community 57"
Cohesion: 0.07
Nodes (30): liveApps, liveSprints, sprints, buildExportData(), columnItems(), exportSprintToNotion(), lead, q (+22 more)

### Community 58 - "Community 58"
Cohesion: 0.08
Nodes (33): otherActiveSuperadminCount(), setUserActive(), setUserEmploymentType(), setUserRole(), activeInput, bulkArchiveApps(), bulkDeleteApps(), bulkSetAppLead() (+25 more)

### Community 59 - "Community 59"
Cohesion: 0.10
Nodes (27): de4812e feat(github): commits become worklog evidence, inert until the App exists, appJwt(), b64url(), commitsByAuthor(), gh(), installationToken(), CommitEvidence, commitPromptLines() (+19 more)

### Community 60 - "Community 60"
Cohesion: 0.09
Nodes (27): approveUser(), approveUserInput, clearTestData(), createUser(), createUserInput, dbClearEnabled(), duplicateUserMessage(), employmentInput (+19 more)

### Community 61 - "Community 61"
Cohesion: 0.07
Nodes (23): cabinet, geistMono, metadata, notoSinhala, satoshi, viewport, 10e7430 fix(ui): a clipped seat description and an error toast that looked like a success, AskBubble() (+15 more)

### Community 62 - "Community 62"
Cohesion: 0.08
Nodes (16): {
  authMock,
  logActivityMock,
  getTrashMock,
  buildSnapshotMock,
  encryptSnapshotMock,
  deleteMeetingMock,
  purgeSpies,
  reads,
  updateCalls,
  fakeDb,
}, { authMock, writeSpy, insertSpy, deleteSpy, logActivityMock, blobDelMock }, TableState, TrashGroup, TrashRow, TableQueues, matchesPurgeConfirm(), orderGroupsForDisplay() (+8 more)

### Community 63 - "Community 63"
Cohesion: 0.09
Nodes (23): 3c30bf4 worklog: per-task hours substrate (worklog_entries + pure check), public.tasks, public.users, worklog_entries, AttendedMeeting, CHECK_THRESHOLDS, CheckEntry, DayEvidence (+15 more)

### Community 64 - "Community 64"
Cohesion: 0.09
Nodes (29): 7228d54 refactor(meetings): one derivation behind both surfaces that ask the same thing, c2bc5fd refactor(tasks): route in-memory status predicates through isTerminal, AskTaskRow, checkinAskContext(), checkinAskText(), isPastDue(), overdueAskText(), OverdueRow (+21 more)

### Community 65 - "Community 65"
Cohesion: 0.11
Nodes (27): HistoryRow, annotateTeamChanges(), AppLoadRow, appLoadRows(), CapacityDelta, CapacitySnapshotEntry, ChurnCounts, compareCapacities() (+19 more)

### Community 66 - "Community 66"
Cohesion: 0.12
Nodes (25): CHECKED_CHANNELS, corroborateDay(), corroborateRange(), CorroborationSummary, DayCorroboration, DayInput, DayVerdict, findQuietRuns() (+17 more)

### Community 67 - "Community 67"
Cohesion: 0.17
Nodes (30): appNameById(), checkConfirm(), isUniqueViolation(), nameForUser(), purgeApp(), purgeBug(), purgeKeyframe(), purgeMeeting() (+22 more)

### Community 68 - "Community 68"
Cohesion: 0.12
Nodes (27): BoardToolbar(), activeFilterCount(), BoardFilters, BoardGroup, BoardSummary, BoardTask, BoardView, boardViewPatch() (+19 more)

### Community 69 - "Community 69"
Cohesion: 0.10
Nodes (21): NOTIFICATION_ICONS, NotificationBellClient(), NotificationBell(), notifications, tasks, assertWritable(), FREEZE_EXEMPT_TABLES, gateBatch() (+13 more)

### Community 70 - "Community 70"
Cohesion: 0.12
Nodes (19): OPEN_BUG_STATUSES, assignee, bugColumns, BugQueueRow, BugRow, getOpenBugCounts(), listTriageQueue(), OpenBugCount (+11 more)

### Community 71 - "Community 71"
Cohesion: 0.13
Nodes (22): BUG_SEVERITIES, BUG_STATUSES, BugBadgeVariant, BugSeverity, bugSeverityBadgeVariant(), bugSeverityLabel(), BugStatus, bugStatusBadgeVariant() (+14 more)

### Community 72 - "Community 72"
Cohesion: 0.13
Nodes (25): 624466e feat(gemini): the ownership query behind the key census, c2f2819 feat(meetings): work out which meetings could have been one meeting, better(), Candidate, compareAsks(), COVER_ASK_KINDS, CoverageGroup, coverageHeadline() (+17 more)

### Community 73 - "Community 73"
Cohesion: 0.12
Nodes (22): c93474b feat(notifications): a scheduled tick that prunes what nobody will read, assertUsable(), DEFAULT_RETENTION_POLICY, planRetention(), PruneReason, RetentionCandidate, RetentionCutoffs, RetentionDecision (+14 more)

### Community 74 - "Community 74"
Cohesion: 0.08
Nodes (24): BAND_SUFFIX, CapacityBand, CapacityBar(), FILL, ACTIVITY_ROWS, BRIEFING_COMPILE, BRIEFING_STATS, BriefingDetailRow (+16 more)

### Community 75 - "Community 75"
Cohesion: 0.08
Nodes (18): BlockPreview, buildBlockPreview(), CreateDraft, CreateGestureHandlers, CreateGhost(), DayColumn, DayHeader, DayShape (+10 more)

### Community 76 - "Community 76"
Cohesion: 0.14
Nodes (23): buildAppTrashRow(), buildAssignmentTrashRow(), buildBugTrashRow(), buildKeyframeTrashRow(), buildMeetingTrashRow(), buildPersonTrashRow(), buildSegmentTrashRow(), buildSprintTrashRow() (+15 more)

### Community 77 - "Community 77"
Cohesion: 0.12
Nodes (21): createApp(), GeneratedApp, GenerateOutcome, nameForUser(), fetchReadme(), fetchRepoContext(), githubHeaders(), parseGitHubRepo() (+13 more)

### Community 78 - "Community 78"
Cohesion: 0.12
Nodes (19): 5c7efa5 feat(meeting-load): four surfaces for a number that has to be honest, MeetingLoadAdminCard(), SuggestionDecisionButtons(), YourSeriesCard(), getAcceptanceByKind(), getAllDecidedKeys(), getAllSuggestionsForAdmin(), getDismissedDecisions() (+11 more)

### Community 79 - "Community 79"
Cohesion: 0.09
Nodes (19): HeroShowcase(), MouseFollower(), OpsMetricsStrip(), STUDIO_GEMINI_MODELS, metadata, APP_INK, APP_LABEL, APP_RULE (+11 more)

### Community 80 - "Community 80"
Cohesion: 0.12
Nodes (22): AttendeeRef, buildFollowupRows(), CarriedForwardEntry, CarriedForwardGroup, decideFollowupResolutionOnTaskStatusChange(), DerivedFollowupRow, filterValidIds(), findMatchingFollowup() (+14 more)

### Community 81 - "Community 81"
Cohesion: 0.11
Nodes (13): ActivityDayGroup, activityDaySummary(), ActivityEntry, activityPhrase(), activityPhraseParts(), groupActivityBursts(), groupActivityByDay(), VERB_PHRASES (+5 more)

### Community 82 - "Community 82"
Cohesion: 0.11
Nodes (21): ActionItemPromoter, ActionItemReconciliation, ActionItemSuggestionRef, ActionOutcome, buildActionList(), createActionItemPromoter(), DeadlineLike, DueStatus (+13 more)

### Community 83 - "Community 83"
Cohesion: 0.12
Nodes (23): formatAppNames(), MeetingApp, cursorInput, dayInput, fetchMeetingsForDay(), fetchMeetingsForRange(), fetchOlderPast(), rangeInput (+15 more)

### Community 84 - "Community 84"
Cohesion: 0.15
Nodes (21): approveChangeRequest(), createChangeRequest(), createInput, currentRowFor(), rejectChangeRequest(), reviewInput, unexpected(), withdrawChangeRequest() (+13 more)

### Community 85 - "Community 85"
Cohesion: 0.11
Nodes (20): 232b7ef ., sameSeries(), SeriesCandidate, CADENCE_RE, CADENCE_WORDS, MONTHS, NON_WORD_RUN_RE, PURPOSE_RE (+12 more)

### Community 86 - "Community 86"
Cohesion: 0.13
Nodes (20): 644d391 feat(meetings): ask before closing a tab that still holds unsent audio, 72b853c feat(meetings): segment upload order and honest progress, as a pure module, f3c4d35 feat(meetings): one segment on the wire at a time, and leaving the page is just Stop, ConcatenatedSegments, concatenateSegments(), hintTail(), isRetriableSegmentError(), segmentRetryDelayMs() (+12 more)

### Community 87 - "Community 87"
Cohesion: 0.12
Nodes (12): CapacityCard(), CapacityEmpty(), PersonAvatar(), PersonHeading(), CapacityHeat(), CapacityHeatEditable(), sortCapacities(), AllocationRow (+4 more)

### Community 88 - "Community 88"
Cohesion: 0.13
Nodes (17): PasteRow, PasteState, TaskComposer(), IntentPerson, PRIORITY_LABEL, ComposerPlan, planFor(), PEOPLE (+9 more)

### Community 89 - "Community 89"
Cohesion: 0.14
Nodes (18): NAMEY, aggregateSuggestions(), ALLOWED_OCCURRENCE_KEYS, AnalyzedOccurrence, coverage(), inviteJaccard(), median(), oneDecimal() (+10 more)

### Community 90 - "Community 90"
Cohesion: 0.08
Nodes (24): AiRelevanceEvidence, AttendanceEvidence, Caveat, CaveatTemplate, caveatTemplateByCode, DiscussionEvidence, e1Recency(), escapeRegExp() (+16 more)

### Community 91 - "Community 91"
Cohesion: 0.18
Nodes (22): AUDIT_SORT_DIRECTIONS, AuditDayGroup, auditDepthNotice(), auditEmptyKind(), auditHref(), auditPageCount(), auditParamsSchema, auditQueryString() (+14 more)

### Community 92 - "Community 92"
Cohesion: 0.15
Nodes (20): deleteBug(), loadMoreTriageBugs(), reportBug(), revalidateBug(), triageBug(), unexpected(), updateBugContent(), getBugScope() (+12 more)

### Community 93 - "Community 93"
Cohesion: 0.18
Nodes (17): normalizePhone(), telHref(), waHref(), buildMeetingShareMessage(), mailtoHref(), businessHourOf(), formatBusinessDate(), formatBusinessDateTime() (+9 more)

### Community 94 - "Community 94"
Cohesion: 0.10
Nodes (16): CredentialResponse, GoogleIdApi, GoogleOneTap(), Window, PasskeyLoginButton(), RINGS, RingVars, SignInBackdrop() (+8 more)

### Community 95 - "Community 95"
Cohesion: 0.14
Nodes (17): PersonStatRow(), RING_TONE, VALUE_TONE, buildMyDayStats(), MyDayInput, plural(), QUIET, QUIET_TASKS (+9 more)

### Community 96 - "Community 96"
Cohesion: 0.17
Nodes (20): noon(), ProgressFilters(), ProgressFiltersInner(), addDaysIso(), eachDayInclusive(), first(), firstOfMonth(), isValidIsoDay() (+12 more)

### Community 97 - "Community 97"
Cohesion: 0.12
Nodes (19): AT_ANYWHERE, BANG_PRIORITY, extractApp(), extractDue(), extractPriority(), findPeople(), PEOPLE, TODAY (+11 more)

### Community 98 - "Community 98"
Cohesion: 0.10
Nodes (20): CandidateFacts, CAVEAT_TEMPLATES, CaveatCode, REASON_TEMPLATES, ReasonCode, ScoreContext, ScoredCandidate, BANNED_PHRASES (+12 more)

### Community 99 - "Community 99"
Cohesion: 0.22
Nodes (19): 4d94451 feat(meetings): a recurrence rule, and the dates it actually means, dayNumber(), daysInMonth(), expand(), isoFromDayNumber(), isoOf(), monthIndex(), MonthlyMode (+11 more)

### Community 100 - "Community 100"
Cohesion: 0.13
Nodes (19): 59aa7b9 feat(search): people's cohort views join the palette, derived not listed, CohortNav(), PROJECT_SORTS, ProjectSort, ROLE_FILTERS, RoleFilter, STAFF_FILTERS, StaffFilter (+11 more)

### Community 101 - "Community 101"
Cohesion: 0.13
Nodes (18): AppRoleHistoryEntry, appRoleAsOf(), AppRoleEntry, AppRoleEntryInput, AppRoleInterval, AppRoleKind, buildAppRoleEntry(), buildRoleTimeline() (+10 more)

### Community 102 - "Community 102"
Cohesion: 0.11
Nodes (12): listApps, LoadBoard(), PerAppLoad(), SeriesLoadTable(), WeeklyLoadTable(), metadata, getPerAppLoad(), getSeriesTable() (+4 more)

### Community 103 - "Community 103"
Cohesion: 0.11
Nodes (16): 047a7e7 feat(people): change someone's workload from their own page, 6c9beed test(search): the github feature is evidence plumbing, not a palette row, e890757 test(search): and it is not searchable either — check 4's half of the answer, ALL_PROVIDERS, CLIENT_FORBIDDEN, commandsRegistrySource, FEATURES, FEATURES_DIR (+8 more)

### Community 104 - "Community 104"
Cohesion: 0.17
Nodes (13): 5deded7 feat(meeting-load): the metrics and the engine behind R1-R5, MeetingLoadTrend(), CollisionResult, computeCollisions(), at(), meeting(), WeekMeetingInterval, buildLoadTrend() (+5 more)

### Community 105 - "Community 105"
Cohesion: 0.18
Nodes (17): clampPxPerHour(), clipToDay(), DaySegment, dayStartCache, DayWindow, dayWindowCache, EventGeometry, hourLabel() (+9 more)

### Community 106 - "Community 106"
Cohesion: 0.19
Nodes (17): buildIcs(), CalendarLinkInput, escapeIcsText(), foldIcsLine(), formatIcsUtc(), googleCalendarUrl(), IcsEventInput, icsFileName() (+9 more)

### Community 107 - "Community 107"
Cohesion: 0.20
Nodes (15): buildConferenceDataRequest(), CALENDAR_ERROR_SENTENCES, CalendarErrorKey, classifyCalendarError(), client(), createCalendarEvent(), deleteCalendarEvent(), describeCalendarError() (+7 more)

### Community 108 - "Community 108"
Cohesion: 0.13
Nodes (18): personRates, projectValue, rateCards, closePersonRate(), closePersonRateInput, closeRoleRate(), closeRoleRateInput, currencyInput (+10 more)

### Community 109 - "Community 109"
Cohesion: 0.18
Nodes (12): assessRecordingReadiness(), estimateSessionShare(), indicativeHoursPerKey(), KeyHealth, ReadinessLevel, MINUTES_AGO, NOW, ChangelogEntry (+4 more)

### Community 110 - "Community 110"
Cohesion: 0.13
Nodes (13): ActiveMention, classify(), findMentionQuery(), matchMentions(), MENTION_QUERY_RE, MentionCandidate, MentionMatchKind, MentionSuggestion (+5 more)

### Community 111 - "Community 111"
Cohesion: 0.15
Nodes (15): FollowupKind, analyzedAt, nextMeetingAt, notesJson, now, asArray(), assembleGlanceResponse(), buildGlanceMap() (+7 more)

### Community 112 - "Community 112"
Cohesion: 0.20
Nodes (15): applyReplacements(), diffSingleWord(), editDistance(), findOccurrences(), FindOptions, fuzzyBudget(), groupOccurrences(), isWordChar() (+7 more)

### Community 113 - "Community 113"
Cohesion: 0.23
Nodes (1): LiveTranscriptionSession

### Community 114 - "Community 114"
Cohesion: 0.14
Nodes (9): hasAuditFilters(), RawSearchParams, AuditFacets, listAuditFacets, AuditFilterBar(), AuditControlsSkeleton(), AuditTrailSkeleton(), ROW_WIDTHS (+1 more)

### Community 115 - "Community 115"
Cohesion: 0.19
Nodes (11): ActivityDayGroup, AppActivityItem, AppActivityKind, assignmentActivityTitle(), groupActivityByDay(), mergeActivity(), getAppActivity(), relativeDayLabel() (+3 more)

### Community 116 - "Community 116"
Cohesion: 0.19
Nodes (11): 2e02b26 feat(worklog): suggest a person's day by what their role on it makes it about, isProjectManagerRole(), isReviewerRole(), ProjectRoleTone, roleBadgeTone(), buildEntrySuggestions(), dedupe(), EntrySuggestion (+3 more)

### Community 117 - "Community 117"
Cohesion: 0.20
Nodes (14): 40c5d41 feat(calendar): decide whether a Google event and a LogPup meeting are the same, attendeeOverlap(), canAutoMerge(), CandidateEvent, CandidateMeeting, Identification, identifyEvent(), IdentityReason (+6 more)

### Community 118 - "Community 118"
Cohesion: 0.15
Nodes (9): d7a4a59 fix(people): a follow-up that already became a task is one commitment, not two, firstName(), PersonFollowupsCard(), SectionEmpty(), FollowupKind, PersonFollowupItem, PersonFollowupRow, PersonFollowups (+1 more)

### Community 119 - "Community 119"
Cohesion: 0.14
Nodes (12): BentoFeatures(), CAPABILITIES, CapabilitiesGrid(), Fortnight(), SampleLog, SATURDAY_TASKS_POOL, STUDIO_TASKS_POOL, ViewMode (+4 more)

### Community 120 - "Community 120"
Cohesion: 0.18
Nodes (14): extractApp(), extractDay(), extractDuration(), extractTime(), MeetingIntent, MeetingPerson, parseMeetingIntent(), resolvePeople() (+6 more)

### Community 121 - "Community 121"
Cohesion: 0.15
Nodes (13): FilterableProject, filterSortProjects(), hasActiveProjectFilters(), matchesRole(), ProjectFilters, projectLoad(), ROLE_FILTER_LABEL, ALL (+5 more)

### Community 122 - "Community 122"
Cohesion: 0.19
Nodes (14): 050a921 feat(calendar): classify a two-way sync field by field, and refuse to guess, 1c2fee5 fix(worklog): a trashed task must not accept hours, asSet(), AttendeeMerge, FIELD_REASON_SENTENCE, FieldDecision, FieldReason, FieldVerdict (+6 more)

### Community 123 - "Community 123"
Cohesion: 0.24
Nodes (14): 563cc1c fix(live): stop blaming the user's key for our own bugs, and try the second model, e73a38e fix(live): mint tokens with the REST field name, and pin the resumption handle, LiveCallbacks, LiveSessionOptions, AuthTokenRequestOptions, buildAudioMessage(), buildAuthTokenRequest(), buildSetupMessage() (+6 more)

### Community 124 - "Community 124"
Cohesion: 0.23
Nodes (13): 924eca4 feat(calendar): expand a daily or weekly rule into the days it means, addDays(), at(), describeRecurrence(), ExpandOptions, expandRecurrence(), Frequency, RecurrenceError (+5 more)

### Community 125 - "Community 125"
Cohesion: 0.20
Nodes (12): e432241 feat(deadlines): the escalation ladder, in working days, DONE_STATUSES, EscalationInput, EscalationStep, nextDay(), notificationKindFor(), NOTIFYING_STEPS, STEP_NOTIFICATION_KIND (+4 more)

### Community 126 - "Community 126"
Cohesion: 0.15
Nodes (12): PersonMeetingsCard(), RESPONSE_CLASS, RESPONSE_LABEL, AttendeeResponse, DEFAULTS, PersonMeetingEntry, PersonMeetingRow, PersonMeetings (+4 more)

### Community 127 - "Community 127"
Cohesion: 0.19
Nodes (12): GapHint(), parsePercent(), ReportedCheckin, SprintCheckinEditor(), Person, SprintCheckins(), getSprintCheckins(), CheckinGap (+4 more)

### Community 128 - "Community 128"
Cohesion: 0.21
Nodes (13): addTask(), canRetry(), closeSettleWindow(), dismissTask(), DockView, expireSettled(), flightDelta(), isKeyFailure() (+5 more)

### Community 129 - "Community 129"
Cohesion: 0.23
Nodes (17): daysBetween(), e4e5Recency(), fmtDayMonth(), interpolate(), maxTier(), meaningfulTokenCount(), renderCaveat(), renderReason() (+9 more)

### Community 130 - "Community 130"
Cohesion: 0.15
Nodes (11): isHydrated(), RouteTransition(), Cubic, DURATION, EASE, enterTransition, enterVariants(), exitTransition (+3 more)

### Community 131 - "Community 131"
Cohesion: 0.29
Nodes (15): addCalendarDays(), dayDelta(), defaultSprintRange(), inclusiveDayCount(), initialSprintStatus(), isSprintRunningNow(), moveSprintRange(), parseIsoDate() (+7 more)

### Community 132 - "Community 132"
Cohesion: 0.17
Nodes (12): 001694a refactor(tasks): express the completed_at rule against the terminal set, 17ab9cc refactor(tasks): route sql-template status filters through OPEN_STATUSES, 4ba83e6 test(people): guard the open/done pair in getPersonWorkload, 94c35aa fix(tasks): un-rot the terminal-status seam comment's call-site claim, a9d31f4 refactor(tasks): add isTerminal/OPEN_STATUSES seam beside TASK_STATUSES, eb38ea0 fix(tasks): stamp completed_at on the done literal, not isTerminal, SOURCE, TaskStatus (+4 more)

### Community 133 - "Community 133"
Cohesion: 0.20
Nodes (11): 11575db fix(worklog): project chips can be clicked off again, 8382eb6 fix(worklog): project tags become links, and the amber squares get a name, partitionGuestApps(), guests, AppRef, NoteAppTag, noteHasAppTag(), splitNoteAppTags() (+3 more)

### Community 134 - "Community 134"
Cohesion: 0.13
Nodes (13): AiMeterApi, AiMeterContext, AiMeterProvider(), MeterTaskHandle, NOOP_API, NOOP_HANDLE, originPoint(), SETTLE_BACKOFF_MS (+5 more)

### Community 135 - "Community 135"
Cohesion: 0.17
Nodes (13): FigureCell(), formatFigure(), SignalsHelp(), SignalsView(), unitSuffix(), VERDICT_COPY, metadata, daysInRange() (+5 more)

### Community 136 - "Community 136"
Cohesion: 0.20
Nodes (8): ScreenKeyframesHandle, useScreenKeyframes(), MeetingScreenshotView, computeDHash(), computeDownscaledDimensions(), formatCapturedAt(), hammingDistance(), shouldKeepFrame()

### Community 137 - "Community 137"
Cohesion: 0.21
Nodes (12): ActiveLanguage, containsSinhala(), countMatches(), estimateSpokenUnits(), InterimLeaderInput, isRestartStorm(), isSilentSinhalaFallback(), pickInterimLeader() (+4 more)

### Community 138 - "Community 138"
Cohesion: 0.21
Nodes (12): actionSentence(), capitalise(), EMPTY_NOW, isOverdue(), nowHeadline(), NowTask, overdueCount(), PersonNow (+4 more)

### Community 139 - "Community 139"
Cohesion: 0.21
Nodes (9): activityRowSearchText(), fuzzyActivityFallback(), rankActivityMatches(), Row, tokenize(), 8d1b390 fix(i18n): Sinhala survives every ASCII-shaped matcher, fuzzyMatches(), levenshtein() (+1 more)

### Community 140 - "Community 140"
Cohesion: 0.19
Nodes (13): AuditSortDir, AuditSortKey, auditConditions(), AuditEntry, auditOrderBy(), AuditPage, AuditRowShape, auditSearchCondition() (+5 more)

### Community 141 - "Community 141"
Cohesion: 0.21
Nodes (13): 53262eb feat(tasks): several people can own one task, taskAssignees, AssigneeChange, AssigneeOrderRow, diffAssignees(), getTaskAssignees(), normalizeAssigneeIds(), orderAssignees() (+5 more)

### Community 142 - "Community 142"
Cohesion: 0.23
Nodes (8): 5a95470 fix(meetings): transcripts stop eating repeated words, and Sinhala meetings get full-depth minutes, truncateAtWordBoundary(), estimateMinutesFromAudioBytes(), estimateMinutesFromTranscript(), summaryDepthInstruction(), DayGlance, firstMeaningfulLine(), glanceAtDay()

### Community 143 - "Community 143"
Cohesion: 0.18
Nodes (9): AnswerBody(), ASKED_AT, NO_CHAT, pushTurn(), readChat(), toParagraphs(), writeChat(), SpotlightCard() (+1 more)

### Community 144 - "Community 144"
Cohesion: 0.13
Nodes (9): ASK_LABEL, ASK_TONE, MeetingPlannerSection(), PersonHoverCard(), getMeetingPlanner(), AskKind, MeetingPlan, PlannerAsk (+1 more)

### Community 145 - "Community 145"
Cohesion: 0.18
Nodes (12): absences, appGrants, changeRequests, NON_TRANSFERABLE, Share, splitAllocation(), TRANSFERABLE_GROUPS, TransferableGroup (+4 more)

### Community 146 - "Community 146"
Cohesion: 0.23
Nodes (10): buildBlocks(), notion(), NotionParentError, resolveParentPageId(), SprintExportData, data, upsertSprintPage(), NotionPageCandidate (+2 more)

### Community 147 - "Community 147"
Cohesion: 0.32
Nodes (14): assignInput, assignmentStillExists(), assignmentUpdateInput, assignUser(), closeOpenInterval(), historyStatements(), isUniqueViolation(), nameForUser() (+6 more)

### Community 148 - "Community 148"
Cohesion: 0.14
Nodes (3): AUDIT_SORT_KEYS, AUDIT_SORT_LABELS, EMPTY_COPY

### Community 149 - "Community 149"
Cohesion: 0.24
Nodes (11): SprintProgress, PlanReadStrip(), completionCount(), daysLeftPhrase(), HEALTH_WORD, PlanGaps, readSprint(), SprintHealth (+3 more)

### Community 150 - "Community 150"
Cohesion: 0.21
Nodes (9): bddbb00 fix(intel): a day you already asked to be away for is not a missing work log, c1235a2 docs(public): restore the four explanations the rewrite dropped, and the hero cap, d0da911 test(gemini): a public page may only name a model the app can price, metadata, SECTIONS, LEGAL_PROSE, TableOfContents(), metadata (+1 more)

### Community 151 - "Community 151"
Cohesion: 0.25
Nodes (10): LiveTranscriptionCostNotice(), LiveTranscriptionStatus(), STATUS_COPY, AutoStopInput, AutoStopReason, estimateAudioTokens(), estimateCostUsd(), formatCostEstimate() (+2 more)

### Community 152 - "Community 152"
Cohesion: 0.15
Nodes (9): ADMIN, AUDITOR, BASE, countQueue, distinctQueue, HOSTILE_TAIL, MANAGER, MEMBER (+1 more)

### Community 153 - "Community 153"
Cohesion: 0.21
Nodes (5): 007c37f ., PendingAbsenceList(), markHydrated(), MotionProvider(), PresenceList()

### Community 154 - "Community 154"
Cohesion: 0.23
Nodes (9): 03e2c3f feat(deadlines): grade and order an app's promises, with a test that discriminates, GradedPromise, gradePromises(), MONTHS, PromiseRow, promisesSummary(), shortDate(), slipLineFor() (+1 more)

### Community 155 - "Community 155"
Cohesion: 0.24
Nodes (11): 1eedff1 feat(people): a project's team as a file, without the private half, employmentLabel(), projectPosition(), TEAM_CSV_HEADERS, TeamCsvMember, teamCsvPrefix(), teamCsvRows(), TeamPositions (+3 more)

### Community 156 - "Community 156"
Cohesion: 0.23
Nodes (10): bd5f524 feat(gemini): the honest half of the live AI meter, d8e49ed fix(apps): ownership is a word, not a third colour, formatElapsed(), localSpend(), MeterInput, MeterPhase, MeterUsage, MeterView (+2 more)

### Community 157 - "Community 157"
Cohesion: 0.18
Nodes (7): AiMeterDock(), announcement(), CHAIN_GLYPH, EASE_ENTER, EASE_EXIT, MeterCard(), number()

### Community 158 - "Community 158"
Cohesion: 0.27
Nodes (10): LiveTranscriptionHandle, useLiveTranscription(), requestLiveToken(), LiveStatus, appendFragment(), commitTurn(), EMPTY_TRANSCRIPT, fullText() (+2 more)

### Community 159 - "Community 159"
Cohesion: 0.28
Nodes (10): EVENT_CLASSES, EVENT_DOT_CLASSES, EVENT_FADED_CLASSES, EVENT_SOLID_CLASSES, eventColorClasses(), eventColorSlot(), eventDotClasses(), eventFadedClasses() (+2 more)

### Community 160 - "Community 160"
Cohesion: 0.38
Nodes (8): 2607f59 fix(speech): read-aloud budgets and fallbacks learn that Sinhala is not English, chunkForSpeech(), cutAt(), effectiveSpeechLength(), rawLimitFor(), sinhalaFraction(), toSpokenText(), truncateForSpeech()

### Community 161 - "Community 161"
Cohesion: 0.26
Nodes (9): 8c996d9 feat(notifications): a mention notifies exactly once, and says so when it cannot, classifyMention(), mentionAdvisory(), MentionFacts, nameList(), SUPPRESSED_REASONS, SuppressedMention, SuppressedReason (+1 more)

### Community 162 - "Community 162"
Cohesion: 0.30
Nodes (8): SpeakButton(), SpeechHandle, useSpeech(), synthesizeSpeech(), base64ToBytes(), parsePcmRate(), pcmToWav(), writeAscii()

### Community 163 - "Community 163"
Cohesion: 0.33
Nodes (11): apps, assignments, meeting_attendees, meetings, public.apps, public.meetings, public.sprints, public.users (+3 more)

### Community 164 - "Community 164"
Cohesion: 0.27
Nodes (8): capPercent(), formatRemaining(), MeetingProcessing, observedMsPerSegment(), SegmentSnapshot, SegmentState, TakeProgress, TakeSnapshot

### Community 165 - "Community 165"
Cohesion: 0.29
Nodes (9): dragCreateRange(), draggedMinutes(), isRealMove(), isRealResize(), moveMeetingByDrag(), resizeMeetingEndByDrag(), resizeMeetingStartByDrag(), END (+1 more)

### Community 166 - "Community 166"
Cohesion: 0.35
Nodes (9): compareRanked(), InsertPlan, needsRebalance(), neighboursAt(), planInsert(), rankBetween(), Ranked, rankForAppend() (+1 more)

### Community 167 - "Community 167"
Cohesion: 0.25
Nodes (9): ACTIVITY_VERBS, AuditParamState, applyAuditNlPatch(), AuditNlPatch, auditNlSchema, buildAuditNlPrompt(), isEmptyAuditNlPatch(), current (+1 more)

### Community 168 - "Community 168"
Cohesion: 0.25
Nodes (4): { authMock, writeSpy }, jobRoleInput, JOB_ROLE_GROUPS, JOB_ROLES

### Community 169 - "Community 169"
Cohesion: 0.35
Nodes (9): f8a9b00 feat(gemini): the meter learns the two percentages it may honestly show, DurationHistory, durationStorage, PACE_EXEMPT, paceKey(), PaceView, recordDuration(), stepsRemainingMs() (+1 more)

### Community 170 - "Community 170"
Cohesion: 0.29
Nodes (6): effectiveEnd(), laneFraction(), layoutOverlaps(), OverlapEvent, overlapMap(), OverlapPlacement

### Community 171 - "Community 171"
Cohesion: 0.27
Nodes (8): AppStatus, AppBeforeState, AppChangeNames, AppChangeSummary, appUpdateInput, AppUpdateResult, buildAppUpdate(), summarizeAppChanges()

### Community 172 - "Community 172"
Cohesion: 0.31
Nodes (7): 13be4b6 ., buildPersonSummaryPrompt(), derivePersonSummary(), factsFromPersonViews(), PersonSummary, PersonSummaryFacts, plural()

### Community 173 - "Community 173"
Cohesion: 0.29
Nodes (6): 2b1ac4a feat(calendar): the organiser is its own fact, and a failed cancel is recorded, b6bde77 feat(gemini): key census — who shares, who keeps, and who to thank, creditLine(), KeyCensus, KeyOwnership, PersonKeyCensus

### Community 174 - "Community 174"
Cohesion: 0.24
Nodes (9): DUE_DOT, DUE_TONE, dueSuffix(), formatDueDate(), PersonTasksCard(), PRIORITY_DOT, PRIORITY_LABEL, STATUS_LABEL (+1 more)

### Community 175 - "Community 175"
Cohesion: 0.31
Nodes (7): SmartPollOptions, useSmartPoll(), nextPollDelay(), PollConditions, PollSchedule, shouldPoll(), SCHEDULE

### Community 176 - "Community 176"
Cohesion: 0.29
Nodes (7): AgendaTopicMatch, escapeRegExp(), findEarliestKeywordMatch(), matchAgendaTopic(), GENERIC_KEYWORD_DENYLIST, TOPIC_BUCKETS, TopicBucket

### Community 177 - "Community 177"
Cohesion: 0.24
Nodes (8): Reveal(), RevealProps, MOTION_TAGS, MotionTag, Stagger(), StaggerItem(), StaggerItemProps, StaggerProps

### Community 178 - "Community 178"
Cohesion: 0.42
Nodes (8): addDays(), daysFromOffset(), diffDaysInclusive(), parseIsoDate(), resizeEnd(), resizeStart(), shiftRange(), toIsoDate()

### Community 179 - "Community 179"
Cohesion: 0.22
Nodes (4): FakeSocket, reconnect(), settle(), TokenFn

### Community 180 - "Community 180"
Cohesion: 0.28
Nodes (2): size, pawSvg()

### Community 181 - "Community 181"
Cohesion: 0.33
Nodes (7): 04583d8 feat(sprints): the words a task hand-off says, as a tested rule, AssignmentInput, AssignmentNotice, buildAssignmentNotice(), clip(), shouldNotifyAssignee(), base

### Community 182 - "Community 182"
Cohesion: 0.28
Nodes (7): dda9cf6 feat(worklog): the AI draft knows what your role on each project makes the day, de4cd09 feat(ui): a select you can type into, and use it to pick an app, buildWorklogDraftPrompt(), DraftActivity, DraftProjectRole, ROLE_PHRASE, activity

### Community 183 - "Community 183"
Cohesion: 0.28
Nodes (5): clock(), DocumentPipHost, MeetingPip(), PipBody(), pipHost()

### Community 184 - "Community 184"
Cohesion: 0.36
Nodes (7): coverageOf(), deadlinesCount(), ModelSegment, OutputCounts, OutputFacts, partitionByModel(), splitOutputs()

### Community 185 - "Community 185"
Cohesion: 0.43
Nodes (6): activityFilterHref(), describeActivityFilters(), isoDayLabel(), MONTHS, EMPTY, ActivityParamState

### Community 186 - "Community 186"
Cohesion: 0.25
Nodes (2): { authMock, getBugScopeMock, insertSpy, updateSpy, logActivityMock, selectRows }, bugReports

### Community 187 - "Community 187"
Cohesion: 0.54
Nodes (7): meeting_note_segments, meeting_speakers, meeting_task_suggestions, public.meeting_note_segments, public.meetings, public.tasks, public.users

### Community 188 - "Community 188"
Cohesion: 0.50
Nodes (7): absences, app_grants, change_requests, org_holidays, public.apps, public.users, work_schedules

### Community 189 - "Community 189"
Cohesion: 0.36
Nodes (6): isLowParticipation(), median(), OccurrenceParticipation, ParticipationMedians, seriesParticipationMedians(), VoiceSegment

### Community 190 - "Community 190"
Cohesion: 0.43
Nodes (7): keyFor(), loadParkedSegments(), openDb(), ParkedSegment, parkSegment(), releaseSegment(), runTransaction()

### Community 191 - "Community 191"
Cohesion: 0.39
Nodes (6): ENTITY_KINDS, EntityKind, entityKindForSource(), isMentionSource(), MENTION_SOURCES, MentionSource

### Community 192 - "Community 192"
Cohesion: 0.38
Nodes (3): ActivityControlsSkeleton(), ActivityTrailSkeleton(), ROW_WIDTHS

### Community 193 - "Community 193"
Cohesion: 0.29
Nodes (4): authMock, deleteSpy, insertSpy, updateSpy

### Community 194 - "Community 194"
Cohesion: 0.48
Nodes (6): 85c3961 feat(finance): cost and worth data substrate — tables and pure maths, person_rates, project_value, public.apps, public.users, rate_cards

### Community 195 - "Community 195"
Cohesion: 0.52
Nodes (6): meeting_series, meeting_series_attendees, meetings, public.apps, public.meeting_series, public.users

### Community 196 - "Community 196"
Cohesion: 0.43
Nodes (5): backoffDelayMs(), parseRetryAfterMs(), RETRIABLE_STATUSES, shouldRetry(), sleep()

### Community 197 - "Community 197"
Cohesion: 0.33
Nodes (4): createDeduper(), Deduper, DeduperOptions, Entry

### Community 198 - "Community 198"
Cohesion: 0.29
Nodes (5): data, KINDS, out, root, versions

### Community 199 - "Community 199"
Cohesion: 0.29
Nodes (3): { authMock, writeSpy, deleteSpy, logActivityMock }, taskQueue, updateReturningQueue

### Community 200 - "Community 200"
Cohesion: 0.71
Nodes (5): bytesToBase64(), downsampleTo(), encodeAudioChunk(), floatTo16BitPCM(), int16ToLittleEndianBytes()

### Community 201 - "Community 201"
Cohesion: 0.33
Nodes (2): OK, {
  requireCapabilityMock,
  archiveAppMock,
  deleteAppMock,
  updateAppMock,
  setUserActiveMock,
  setUserRoleMock,
  setUserEmploymentTypeMock,
  supervisorRowsMock,
}

### Community 202 - "Community 202"
Cohesion: 0.47
Nodes (4): abcd631 feat(db): a task can have several people, and a meeting can name its next one, public.tasks, public.users, task_assignees

### Community 203 - "Community 203"
Cohesion: 0.47
Nodes (4): useIsInView(), UseIsInViewOptions, CountingNumber(), CountingNumberProps

### Community 204 - "Community 204"
Cohesion: 0.33
Nodes (4): ALLOWLIST, FEATURES_DIR, offenders, readers

### Community 205 - "Community 205"
Cohesion: 0.70
Nodes (4): gemini_keys, meeting_ai_notes, public.meetings, public.users

### Community 206 - "Community 206"
Cohesion: 0.60
Nodes (4): meeting_attendee_recommendations, meeting_attendees, public.meetings, public.users

### Community 207 - "Community 207"
Cohesion: 0.70
Nodes (4): bug_reports, public.apps, public.tasks, public.users

### Community 208 - "Community 208"
Cohesion: 0.60
Nodes (2): SortOrdered, sortOrderForIndex()

### Community 209 - "Community 209"
Cohesion: 0.50
Nodes (2): splitByUpcoming(), now

### Community 210 - "Community 210"
Cohesion: 0.83
Nodes (3): notifications, public.meetings, public.users

### Community 211 - "Community 211"
Cohesion: 0.83
Nodes (3): meeting_followups, public.meetings, public.users

### Community 212 - "Community 212"
Cohesion: 0.83
Nodes (3): app_comments, public.apps, public.users

### Community 213 - "Community 213"
Cohesion: 0.83
Nodes (3): meeting_followups, public.meetings, public.users

### Community 214 - "Community 214"
Cohesion: 0.83
Nodes (3): assignment_history, public.apps, public.users

### Community 215 - "Community 215"
Cohesion: 0.83
Nodes (3): meeting_recording_segments, public.meetings, public.users

### Community 216 - "Community 216"
Cohesion: 0.83
Nodes (3): meeting_screenshots, public.meetings, public.users

### Community 217 - "Community 217"
Cohesion: 0.83
Nodes (3): public.sprints, public.users, sprint_checkins

### Community 218 - "Community 218"
Cohesion: 0.83
Nodes (3): meeting_attendee_history, public.meetings, public.users

### Community 219 - "Community 219"
Cohesion: 0.83
Nodes (3): public.users, webauthn_credentials, webauthn_login_tokens

### Community 220 - "Community 220"
Cohesion: 0.83
Nodes (3): app_role_history, public.apps, public.users

### Community 221 - "Community 221"
Cohesion: 0.83
Nodes (3): ai_usage_events, gemini_keys, users

### Community 222 - "Community 222"
Cohesion: 0.83
Nodes (3): meeting_apps, public.apps, public.meetings

### Community 223 - "Community 223"
Cohesion: 0.50
Nodes (2): ENTRIES, RULES

### Community 224 - "Community 224"
Cohesion: 0.50
Nodes (1): RESOLUTIONS

### Community 226 - "Community 226"
Cohesion: 0.50
Nodes (1): { isCacheableAsset, isStorable, CACHE }

### Community 227 - "Community 227"
Cohesion: 0.67
Nodes (3): expectedTables(), main(), root

### Community 228 - "Community 228"
Cohesion: 0.67
Nodes (3): declaredTables(), Drift, main()

### Community 229 - "Community 229"
Cohesion: 0.83
Nodes (2): isLiveTranscriptionEnabled(), parseLiveTranscriptionFlag()

### Community 230 - "Community 230"
Cohesion: 0.67
Nodes (3): 00d6621 fix(intel): one hung Gemini call froze both panels, forever, 3ed16a6 feat(worklog): fix an entry's kind and project without deleting it, c5251d4 fix(gemini): six holes an adversarial review shot in the meter, closed

### Community 231 - "Community 231"
Cohesion: 1.00
Nodes (2): activity_log, public.users

### Community 232 - "Community 232"
Cohesion: 1.00
Nodes (2): meeting_ai_notes, public.users

### Community 233 - "Community 233"
Cohesion: 1.00
Nodes (2): meeting_followups, public.tasks

### Community 234 - "Community 234"
Cohesion: 1.00
Nodes (2): meeting_task_suggestions, public.apps

### Community 235 - "Community 235"
Cohesion: 1.00
Nodes (2): daily_worklogs, public.users

### Community 236 - "Community 236"
Cohesion: 1.00
Nodes (2): apps, public.users

### Community 237 - "Community 237"
Cohesion: 1.00
Nodes (2): user_ai_prefs, users

### Community 238 - "Community 238"
Cohesion: 1.00
Nodes (2): public.users, users

### Community 239 - "Community 239"
Cohesion: 1.00
Nodes (2): org_holidays, public.users

### Community 240 - "Community 240"
Cohesion: 1.00
Nodes (2): apps, public.users

### Community 241 - "Community 241"
Cohesion: 1.00
Nodes (2): public.users, user_deletions

### Community 242 - "Community 242"
Cohesion: 1.00
Nodes (2): mentions, public.users

### Community 244 - "Community 244"
Cohesion: 1.00
Nodes (1): eslintConfig

### Community 246 - "Community 246"
Cohesion: 1.00
Nodes (1): nextConfig

### Community 247 - "Community 247"
Cohesion: 1.00
Nodes (1): authFile

### Community 248 - "Community 248"
Cohesion: 1.00
Nodes (1): config

## Knowledge Gaps
- **1358 isolated node(s):** `qb`, `lead`, `q`, `users`, `authFile` (+1353 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 113`** (1 nodes): `LiveTranscriptionSession`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 180`** (2 nodes): `size`, `pawSvg()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 186`** (2 nodes): `{ authMock, getBugScopeMock, insertSpy, updateSpy, logActivityMock, selectRows }`, `bugReports`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 201`** (2 nodes): `OK`, `{
  requireCapabilityMock,
  archiveAppMock,
  deleteAppMock,
  updateAppMock,
  setUserActiveMock,
  setUserRoleMock,
  setUserEmploymentTypeMock,
  supervisorRowsMock,
}`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 208`** (2 nodes): `SortOrdered`, `sortOrderForIndex()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 209`** (2 nodes): `splitByUpcoming()`, `now`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 223`** (2 nodes): `ENTRIES`, `RULES`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 224`** (1 nodes): `RESOLUTIONS`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 226`** (1 nodes): `{ isCacheableAsset, isStorable, CACHE }`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 229`** (2 nodes): `isLiveTranscriptionEnabled()`, `parseLiveTranscriptionFlag()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 231`** (2 nodes): `activity_log`, `public.users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 232`** (2 nodes): `meeting_ai_notes`, `public.users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 233`** (2 nodes): `meeting_followups`, `public.tasks`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 234`** (2 nodes): `meeting_task_suggestions`, `public.apps`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 235`** (2 nodes): `daily_worklogs`, `public.users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 236`** (2 nodes): `apps`, `public.users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 237`** (2 nodes): `user_ai_prefs`, `users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 238`** (2 nodes): `public.users`, `users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 239`** (2 nodes): `org_holidays`, `public.users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 240`** (2 nodes): `apps`, `public.users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 241`** (2 nodes): `public.users`, `user_deletions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 242`** (2 nodes): `mentions`, `public.users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 244`** (1 nodes): `eslintConfig`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 246`** (1 nodes): `nextConfig`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 247`** (1 nodes): `authFile`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 248`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 0` to `Community 3`, `Community 30`, `Community 17`, `Community 5`, `Community 1`, `Community 157`, `Community 46`, `Community 38`, `Community 29`, `Community 101`, `Community 47`, `Community 7`, `Community 143`, `Community 28`, `Community 21`, `Community 68`, `Community 71`, `Community 52`, `Community 74`, `Community 87`, `Community 53`, `Community 15`, `Community 93`, `Community 13`, `Community 24`, `Community 12`, `Community 11`, `Community 35`, `Community 45`, `Community 26`, `Community 43`, `Community 8`, `Community 25`, `Community 22`, `Community 144`, `Community 9`, `Community 75`, `Community 23`, `Community 69`, `Community 153`, `Community 50`, `Community 118`, `Community 126`, `Community 95`, `Community 174`, `Community 149`, `Community 96`, `Community 41`, `Community 94`, `Community 34`, `Community 135`, `Community 162`, `Community 88`, `Community 19`, `Community 119`, `Community 79`, `Community 61`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `Button()` connect `Community 0` to `Community 44`, `Community 5`, `Community 17`, `Community 7`, `Community 29`, `Community 84`, `Community 47`, `Community 58`, `Community 143`, `Community 28`, `Community 52`, `Community 114`, `Community 148`, `Community 21`, `Community 68`, `Community 40`, `Community 87`, `Community 100`, `Community 53`, `Community 24`, `Community 12`, `Community 92`, `Community 11`, `Community 16`, `Community 35`, `Community 26`, `Community 8`, `Community 25`, `Community 43`, `Community 19`, `Community 22`, `Community 183`, `Community 144`, `Community 9`, `Community 10`, `Community 4`, `Community 153`, `Community 93`, `Community 126`, `Community 174`, `Community 96`, `Community 41`, `Community 34`, `Community 162`, `Community 127`, `Community 78`, `Community 88`, `Community 67`, `Community 70`, `Community 23`, `Community 102`, `Community 15`, `Community 61`, `Community 94`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `Db` connect `Community 4` to `Community 6`, `Community 44`, `Community 60`, `Community 140`, `Community 58`, `Community 84`, `Community 3`, `Community 24`, `Community 11`, `Community 67`, `Community 76`, `Community 77`, `Community 115`, `Community 29`, `Community 38`, `Community 10`, `Community 5`, `Community 92`, `Community 40`, `Community 70`, `Community 37`, `Community 39`, `Community 31`, `Community 108`, `Community 1`, `Community 33`, `Community 59`, `Community 56`, `Community 42`, `Community 78`, `Community 54`, `Community 8`, `Community 2`, `Community 83`, `Community 69`, `Community 36`, `Community 73`, `Community 57`, `Community 20`, `Community 147`, `Community 145`, `Community 65`, `Community 135`, `Community 66`, `Community 21`, `Community 141`, `Community 27`, `Community 16`, `Community 12`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `qb`, `lead`, `q` to the rest of the system?**
  _1358 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02570281124497992 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.028366000196986114 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.02387655093316651 - nodes in this community are weakly interconnected._