# Graph Report - LogPup  (2026-08-13)

## Corpus Check
- 635 files · ~659,969 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3648 nodes · 9924 edges · 199 communities (160 shown, 39 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 82 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `385ee0af`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Server Actions & Results
- Database Schema & Queries
- Cards & Page Composition
- App Detail & Board Pages
- Runtime Dependencies
- Design Docs & Plans
- Tables & Selects
- Dev Tooling Config
- Form Dialogs
- TypeScript Config
- Command Center Search
- Shell & Navigation
- Feature Dialogs & Panels
- Auth & Security Lib
- shadcn Component Config
- Meeting Actions
- Meeting Forms & Calendar
- People & Allocation Actions
- Input Primitives
- Tabs
- Root Layout & Theming
- NextAuth Type Extensions
- App Detail Skeleton
- Person Detail Skeleton
- Vercel Cron Config
- ESLint Config
- Next Config
- PostCSS Config
- Apps List Skeleton
- Meetings Skeleton
- Drizzle Config
- File Icon Asset
- Globe Icon Asset
- Next.js Logo Asset
- Window Icon Asset
- Vitest Config
- dependencies
- user-table.tsx
- date-fns
- meetings-time-grid.tsx
- @dnd-kit/sortable
- actions.ts
- eslint.config.mjs
- googleapis
- lodash.throttle
- queries.ts
- motion
- meeting-intel.tsx
- next
- next-auth
- next.config.ts
- meeting-panels.tsx
- meeting-list.tsx
- notes.ts
- react-day-picker
- Meeting Attendee Recommender — Design Spec (sub-project A)
- shadcn
- note-timeline.tsx
- tailwind-merge
- app-health.ts
- @vercel/blob
- history-views.tsx
- playwright.config.ts
- postcss.config.mjs
- meeting-prep.tsx
- calendar-view.ts
- CLAUDE.md Project Instructions
- File Icon (Next.js starter document/page glyph: 16x16 gray SVG of a sheet with folded corner and text lines, used for footer/example links)
- Globe Icon (Next.js starter asset): 16x16 gray wireframe globe SVG from the default create-next-app template, used for footer/external links
- Next.js Logo (wordmark SVG): the black 'NEXT.js' wordmark shipped with the create-next-app starter template, a 394x80 vector graphic used as a decorative logo asset in the public directory
- Vercel Logo (default Next.js starter asset): minimalist white equilateral triangle logomark on a 1155x1000 viewBox, single SVG path, no styling beyond fill #fff
- Window Icon (Next.js starter asset): 16x16 SVG outline of a browser window with three control dots, gray (#666) fill, unused decorative default asset from create-next-app
- { GET, POST }
- browse.ts
- board.tsx
- Google OAuth verification — LogPup
- add-to-calendar.tsx
- followups.ts
- dashboard-zones.tsx
- page.tsx
- page.tsx
- meetings-month-calendar.tsx
- task-intent.ts
- history-params.ts
- allocation-history.ts
- attendee-score.ts
- action-item-board.tsx
- iso-day.ts
- Global Constraints
- Gemini Live streaming transcription — design
- page.tsx
- attendee-score.test.ts
- page.tsx
- live.test.ts
- client.ts
- meeting-intent.ts
- Metrics
- page.tsx
- webauthn-actions.ts
- Direct-manipulation browser verification
- sprint-checkins.tsx
- person-stats.ts
- actions.ts
- meetings-day-rail.tsx
- mention-match.ts
- use-screen-keyframes.ts
- calendar-grid.ts
- meeting-notes-model.ts
- text-replace.ts
- task-card.tsx
- scripts
- sidebar.tsx
- types.ts
- app-activity.tsx
- LiveTranscriptionSession
- Changes
- Speaker identification from the meeting record
- attendee-series.ts
- language-switch.ts
- now.ts
- Global Constraints
- Attribution Truth & Membership — Design Spec
- People Work History, Observed Load & KPIs — Design Spec (sub-project C)
- scoreCandidate
- Meeting Intel Panel Redesign — Design Spec
- App-wide Soft Deletes — Design Spec (sub-project D)
- queries.ts
- live-transcription-status.tsx
- live-token.ts
- task-workload.ts
- use-live-transcription.ts
- Global Constraints
- Unified Roadmap — design
- buttonVariants
- actions.ts
- plan-read.ts
- active-sprints.tsx
- task-rank.ts
- live-client.ts
- page.tsx
- queries.ts
- capacity-card.tsx
- meeting-window.ts
- Project Manager (PM) on apps
- Calendar drag-to-resize — implementation report
- Global Constraints
- Global Constraints
- Global Constraints
- Direct Manipulation — Sprint Board, Roadmap & Meetings Calendar
- Meeting Write-up Panels — Design Spec
- readiness.ts
- MeetingForm
- text-replace-actions.ts
- roadmap-geometry.ts
- use-smart-poll.ts
- agenda-topics.ts
- Meeting keyframe proxy route — report
- search.ts
- recording-segments.ts
- person-tasks-card.tsx
- /activity real search — implementation report
- Google integration — two-bug report
- LogPup Development
- Dashboard Redesign + Activity Trail — Design Spec
- print-masthead-edit.tsx
- page.tsx
- segment-store.ts
- Merge report: `main` → `feat/soft-deletes`
- encodeAudioChunk
- dedupe.ts
- LogPup mobile usability audit
- models.ts
- project-roles.ts
- generate-changelog.mjs
- loading.tsx
- setOwnPassword
- google-one-tap.ts
- meeting-pip.tsx
- drizzle/ migrations
- check-migrations.mjs
- set-user-personal-email.test.ts
- set-user-title.test.ts
- board-skeleton.tsx
- isLiveTranscriptionEnabled
- log.test.ts
- schema.ts
- cmdk
- jotai
- @notionhq/client
- @simplewebauthn/browser
- @simplewebauthn/server
- @vercel/speed-insights
- ANALYSIS_MODELS

## God Nodes (most connected - your core abstractions)
1. `cn()` - 315 edges
2. `err()` - 156 edges
3. `ok()` - 149 edges
4. `Button()` - 90 edges
5. `logActivity()` - 90 edges
6. `Db` - 56 edges
7. `toIsoDateInTimeZone()` - 45 edges
8. `users` - 36 edges
9. `Input()` - 35 edges
10. `ActionResult` - 35 edges

## Surprising Connections (you probably didn't know these)
- `MentionTextarea()` --references--> `react`  [EXTRACTED]
  src/components/mention-textarea.tsx → package.json
- `MobileNav()` --references--> `react`  [EXTRACTED]
  src/components/shell/mobile-nav.tsx → package.json
- `CalendarDayButton()` --references--> `react`  [EXTRACTED]
  src/components/ui/calendar.tsx → package.json
- `CommandCenterProvider()` --references--> `react`  [EXTRACTED]
  src/features/search/components/command-center.tsx → package.json
- `Design Tokens (oklch color, type, motion)` --references--> `Fontshare Free Font EULA`  [INFERRED]
  docs/superpowers/specs/2026-08-11-ui-redesign-design.md → src/app/fonts/FONT-LICENSE.txt

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Server Action Pattern (zod validate, auth check, ActionResult)** — docs_superpowers_plans_2026_08_10_logpup_action_result, docs_superpowers_plans_2026_08_10_logpup_authjs_v5_google_signin, docs_superpowers_plans_2026_08_10_logpup_nextjs_16_monolith [EXTRACTED 1.00]
- **Capacity Feature (allocation model, math, heat dashboard)** — docs_superpowers_specs_2026_08_10_logpup_design_capacity_allocation, docs_superpowers_plans_2026_08_10_logpup_allocation_math, docs_superpowers_plans_2026_08_10_logpup_capacity_dashboard [INFERRED 0.85]
- **External Integration Resilience (save first, warn on API failure)** — docs_superpowers_specs_2026_08_10_logpup_design_non_blocking_integrations, docs_superpowers_plans_2026_08_10_logpup_google_calendar_integration, docs_superpowers_plans_2026_08_10_logpup_notion_export [EXTRACTED 1.00]

## Communities (199 total, 39 thin omitted)

### Community 0 - "Server Actions & Results"
Cohesion: 0.08
Nodes (31): Button(), Dialog(), DialogClose(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay() (+23 more)

### Community 1 - "Database Schema & Queries"
Cohesion: 0.16
Nodes (19): DashboardLoading(), SettingsLoading(), DEFAULT_COPY, ERROR_COPY, metadata, Card(), CardContent(), CardDescription() (+11 more)

### Community 2 - "Cards & Page Composition"
Cohesion: 0.12
Nodes (33): formatDate(), getDays(), MiniCalendarContext, MiniCalendarContextType, MiniCalendarDay(), MiniCalendarDayProps, MiniCalendarDaysProps, MiniCalendarNavigationProps (+25 more)

### Community 3 - "App Detail & Board Pages"
Cohesion: 0.13
Nodes (24): AppDetailPage(), SPRINT_STATUS_LABEL, SPRINT_STATUS_VARIANT, TABS_NEEDING_USERS, listAppComments(), AppComments(), AppContributions(), AppTabNav() (+16 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.07
Nodes (36): Badge(), badgeVariants, DateTimeWheelField(), HOUR_OPTIONS, MINUTE_OPTIONS, roundUpToStep(), TimeColumn(), WheelOption (+28 more)

### Community 5 - "Design Docs & Plans"
Cohesion: 0.07
Nodes (27): drizzle-kit, eslint, eslint-config-next, devDependencies, drizzle-kit, eslint, eslint-config-next, @playwright/test (+19 more)

### Community 6 - "Tables & Selects"
Cohesion: 0.05
Nodes (96): meetingAttendeeHistory, logActivity(), approveUser(), approveUserInput, clearTestData(), createUser(), createUserInput, dbClearEnabled() (+88 more)

### Community 7 - "Dev Tooling Config"
Cohesion: 0.03
Nodes (51): APP_SLUG, RUN_ID, liveNoteSegments, liveScreenshots, liveSprints, liveTasks, liveTasksAs(), qb (+43 more)

### Community 8 - "Form Dialogs"
Cohesion: 0.05
Nodes (62): paramsSchema, RFC-5545, Db, liveMeetings, activityLog, allocationChange, appComments, appStatus (+54 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, .next-e2e/dev/types/**/*.ts, .next-e2e/types/**/*.ts, next-env.d.ts (+22 more)

### Community 10 - "Command Center Search"
Cohesion: 0.22
Nodes (18): createSprint(), deleteSprint(), listSprintOptions(), renameSprint(), reorderSprint(), requireAdmin(), resortSprintsByDate(), slugForApp() (+10 more)

### Community 11 - "Shell & Navigation"
Cohesion: 0.10
Nodes (26): Activity, ContributionGraph(), ContributionGraphBlock(), ContributionGraphBlockProps, ContributionGraphCalendar(), ContributionGraphCalendarProps, ContributionGraphContext, ContributionGraphContextType (+18 more)

### Community 12 - "Feature Dialogs & Panels"
Cohesion: 0.07
Nodes (28): ActionResult Pattern, Allocation Math (summarizeAllocations), Auth.js v5 Google Sign-In, Capacity Heat Dashboard, Command Palette (Cmd+K) + Empty States, Drizzle Schema (7 tables, Neon Postgres), Google Calendar Integration, LogPup Implementation Plan (+20 more)

### Community 13 - "Auth & Security Lib"
Cohesion: 0.05
Nodes (66): CardSkeleton(), PersonDetailLoading(), PeopleLoading(), ContactButtons(), InlineRename(), LazyDisclosure(), AlertDialogMedia(), AlertDialogOverlay() (+58 more)

### Community 14 - "shadcn Component Config"
Cohesion: 0.03
Nodes (91): GET(), sprintCheckins, acceptSuggestionInput, ActionItemOut, addFollowup(), addFollowupInput, addTypedNoteInput, ALLOWED_KEYFRAME_TYPES (+83 more)

### Community 15 - "Meeting Actions"
Cohesion: 0.09
Nodes (22): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+14 more)

### Community 16 - "Meeting Forms & Calendar"
Cohesion: 0.13
Nodes (19): CardQuickMenu(), QuickMenuItem, DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel() (+11 more)

### Community 17 - "People & Allocation Actions"
Cohesion: 0.07
Nodes (59): DashboardPage(), greetingFor(), buildConferenceDataRequest(), client(), createCalendarEvent(), deleteCalendarEvent(), describeCalendarError(), extractMeetLink() (+51 more)

### Community 18 - "Input Primitives"
Cohesion: 0.29
Nodes (4): authFile, repoRoot, seedDevUser(), SeedResult

### Community 19 - "Tabs"
Cohesion: 0.21
Nodes (19): assignInput, assignmentStillExists(), assignmentUpdateInput, assignUser(), closeOpenInterval(), historyStatements(), isUniqueViolation(), nameForUser() (+11 more)

### Community 20 - "Root Layout & Theming"
Cohesion: 0.13
Nodes (17): cabinet, geistMono, metadata, satoshi, viewport, applyTheme(), isTheme(), ResolvedTheme (+9 more)

### Community 21 - "NextAuth Type Extensions"
Cohesion: 0.16
Nodes (25): decideFollowupResolutionOnTaskStatusChange(), canMoveTask(), boardMoveInput, bulkUpdateInput, bulkUpdateTasks(), createTask(), deleteTask(), isForeignKeyViolation() (+17 more)

### Community 22 - "App Detail Skeleton"
Cohesion: 0.47
Nodes (3): canAccessApp(), UserStatus, config

### Community 23 - "Person Detail Skeleton"
Cohesion: 0.22
Nodes (12): react, react, CountingNumber(), CountingNumberProps, StatNumber(), statTransition, subscribeToReducedMotion(), useStaticNumber() (+4 more)

### Community 24 - "Vercel Cron Config"
Cohesion: 0.60
Nodes (3): PeoplePage(), getPeopleNow, getUserCapacities

### Community 27 - "PostCSS Config"
Cohesion: 0.33
Nodes (4): AppleIcon(), size, GET(), pawSvg()

### Community 28 - "Apps List Skeleton"
Cohesion: 0.10
Nodes (31): AppLayout(), ProfilePage(), metadata, SettingsPage(), metadata, PendingPage(), AccountMenu(), AccountUser (+23 more)

### Community 29 - "Meetings Skeleton"
Cohesion: 0.23
Nodes (10): buildBlocks(), notion(), NotionParentError, resolveParentPageId(), SprintExportData, data, upsertSprintPage(), NotionPageCandidate (+2 more)

### Community 30 - "Drizzle Config"
Cohesion: 0.07
Nodes (61): buildDragAnnouncements(), DragSurface(), useDragSensors(), event(), ResizeHandle(), Roadmap(), HEALTH_FILL, HEALTH_WORD (+53 more)

### Community 31 - "File Icon Asset"
Cohesion: 0.19
Nodes (11): GET(), isAuthorized(), meetingAttendeeRecommendations, meetingAttendees, backupUserColumns, buildSnapshot(), encryptionKey(), encryptSnapshot() (+3 more)

### Community 32 - "Globe Icon Asset"
Cohesion: 0.40
Nodes (4): JWT, next-auth, next-auth/jwt, Session

### Community 33 - "Next.js Logo Asset"
Cohesion: 0.40
Nodes (4): buildCommand, crons, framework, $schema

### Community 35 - "Window Icon Asset"
Cohesion: 0.15
Nodes (15): text(), MeetingAssistant(), { isCacheableAsset, isStorable, CACHE }, url(), synthesizeSpeech(), chunkForSpeech(), cutAt(), SpeechHandle (+7 more)

### Community 37 - "Vitest Config"
Cohesion: 0.09
Nodes (54): matchesPurgeConfirm(), orderGroupsForDisplay(), restoreDisabledReason(), TRASH_GROUP_ORDER, TRASH_GROUP_TITLES, trashCountFootnote(), TrashCard(), TrashGroupSection() (+46 more)

### Community 38 - "dependencies"
Cohesion: 0.07
Nodes (27): @base-ui/react, class-variance-authority, @dnd-kit/core, drizzle-orm, lucide-react, @neondatabase/serverless, dependencies, @base-ui/react (+19 more)

### Community 39 - "user-table.tsx"
Cohesion: 0.09
Nodes (30): JobRoleSelect(), SelectContent(), SelectGroup(), SelectItem(), SelectLabel(), SelectSeparator(), SelectTrigger(), SelectValue() (+22 more)

### Community 41 - "meetings-time-grid.tsx"
Cohesion: 0.07
Nodes (43): eventGeometry, minutesIntoDay(), effectiveEnd(), laneFraction(), layoutOverlaps(), OverlapEvent, overlapMap(), OverlapPlacement (+35 more)

### Community 43 - "actions.ts"
Cohesion: 0.07
Nodes (35): ALL_MEETING_TITLES, APP_SLUG, createMeeting(), deleteMeetingViaList(), expandPastMeetingsIfCollapsed(), fillMeetingDateTime(), RUN_ID, todayAt() (+27 more)

### Community 47 - "queries.ts"
Cohesion: 0.08
Nodes (42): HistoryData(), entry(), CapacityHeatEditable(), PersonRow(), at(), allocationTotalSeries(), HistoryRow, PersonAllocationHistoryView (+34 more)

### Community 49 - "meeting-intel.tsx"
Cohesion: 0.05
Nodes (37): CarriedForwardItem, deferFollowupReason(), FollowupPersonOption, FollowupTargetOption, LinkedTaskView, MeetingIntel, noteFollowup(), UnattributedFollowupView (+29 more)

### Community 53 - "meeting-panels.tsx"
Cohesion: 0.09
Nodes (40): DensityToggle(), EmptyFilterState(), FilterBar(), FilterChip(), KIND_META, kindAccentClass(), MeetingPanelsProvider(), ActiveFilters (+32 more)

### Community 54 - "meeting-list.tsx"
Cohesion: 0.13
Nodes (28): AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogTitle() (+20 more)

### Community 55 - "notes.ts"
Cohesion: 0.08
Nodes (35): segmentWho(), insertAutoNotesAndSuggestions(), candidate(), AppOption, AttendeeAppPrep, AutoAssignCandidate, AutoAssignDecision, AutoAssignedTaskFields (+27 more)

### Community 57 - "Meeting Attendee Recommender — Design Spec (sub-project A)"
Cohesion: 0.05
Nodes (37): 1. SCHEDULING (stateless, in the new-meeting form), 2. PRE-MEETING (persisted review on an upcoming meeting), 3. RETROSPECTIVE (organizer-private, past meetings), 4. SERIES (drift over inferred recurring series), A1 — Gemini agenda-topic relevance (the AI scoring component)  — 10 max — 10% of the ledger, and it can never make anyone required by points, AI component (A1), AI override bounds, Degradation (+29 more)

### Community 59 - "note-timeline.tsx"
Cohesion: 0.10
Nodes (31): MiniCalendar(), MiniCalendarDays(), MiniCalendarNavigation(), MiniCalendarTodayButton(), useMiniCalendar(), MarkdownLite(), renderInline(), escapeRegExp() (+23 more)

### Community 61 - "app-health.ts"
Cohesion: 0.12
Nodes (31): appHealth, AppHealthInput, AppSprintSnapshot, AppStatus, completionPct(), dayDiff(), daysSince(), HEALTH_LABEL (+23 more)

### Community 63 - "history-views.tsx"
Cohesion: 0.10
Nodes (24): metadata, describeAllocationChange(), AllocationHistoryCard(), KIND_DOT, KIND_LABEL, AllocationTrend(), APP_STATUS_LABEL, AssignmentsCard() (+16 more)

### Community 67 - "meeting-prep.tsx"
Cohesion: 0.13
Nodes (12): CHIP_TONE, ChipTone, CountChip(), MetaChip(), SectionHeading(), SkeletonBlock(), StatTile(), MeetingPrepSection() (+4 more)

### Community 68 - "calendar-view.ts"
Cohesion: 0.15
Nodes (32): HolidayLegend(), clampPxPerHour(), addCalendarMonths(), CALENDAR_VIEWS, calendarUrlPatch(), CalendarView, endOfMonthIso(), isCalendarView() (+24 more)

### Community 78 - "browse.ts"
Cohesion: 0.14
Nodes (30): AppTaskCounts, activityMs(), APP_RISK_FILTERS, APP_SORTS, APP_STATUS_FILTERS, AppRiskFilter, AppSort, AppStatusFilter (+22 more)

### Community 79 - "board.tsx"
Cohesion: 0.15
Nodes (27): activeFilterCount(), BoardFilters, boardSummary, BoardTask, BoardView, boardViewPatch(), dropIndexIn(), EMPTY_FILTERS (+19 more)

### Community 80 - "Google OAuth verification — LogPup"
Cohesion: 0.07
Nodes (27): This is NOT the Next.js you know, 0. The one shortcut worth checking first, 1. Prerequisites, 1. "The website of your home page URL is not registered to you", 2. Public URLs the reviewer will open, 2. "Your home page does not explain the purpose of your app" — FIXED IN CODE, 3. App logo, 3. "The app name 'log-pup' does not match the app name on your home page" (+19 more)

### Community 81 - "add-to-calendar.tsx"
Cohesion: 0.12
Nodes (26): RFC-6868, GET(), sequenceFor(), AddToCalendarMenu(), icsHref(), RFC-5545, attendee(), buildIcs() (+18 more)

### Community 82 - "followups.ts"
Cohesion: 0.10
Nodes (25): deriveAndInsertFollowups(), fetchUnattributedFollowups(), linkFollowupToTask(), reconcileActionItems(), AttendeeRef, buildFollowupRows(), CarriedForwardEntry, CarriedForwardGroup (+17 more)

### Community 83 - "dashboard-zones.tsx"
Cohesion: 0.12
Nodes (24): AdminPage(), listRecentActivity, AddUserDialog(), AppsTable(), DbClearButton(), PendingApprovalsCard(), UserTable(), listAllUsers() (+16 more)

### Community 84 - "page.tsx"
Cohesion: 0.15
Nodes (19): CatchUp(), metadata, MyHistory(), TeamHistory(), TodayEntry(), WorklogPage(), isRequiredWorkDay(), missingWorkDays() (+11 more)

### Community 85 - "page.tsx"
Cohesion: 0.10
Nodes (21): dateFmt, durationLabel(), fileDateFmt, generateMetadata(), MeetingPrintPage(), msToClock(), PillTone, readParam() (+13 more)

### Community 86 - "meetings-month-calendar.tsx"
Cohesion: 0.14
Nodes (22): MeetingDetailDialog(), ChipFace(), chipLabel(), chipTone(), Entry, MeetingChip(), MeetingsMonthCalendar(), ReschedulePatch (+14 more)

### Community 87 - "task-intent.ts"
Cohesion: 0.12
Nodes (24): ComposerPlan, planFor(), TaskComposer(), addDays(), AT_ANYWHERE, BANG_PRIORITY, extractApp(), extractDue() (+16 more)

### Community 88 - "history-params.ts"
Cohesion: 0.14
Nodes (22): TeamCapacityHistoryPage(), isoDay(), isoDaysAgo(), resolveAsOf(), ResolvedAsOf, AFTER_LOCAL_MIDNIGHT, NOW, todayIso() (+14 more)

### Community 89 - "allocation-history.ts"
Cohesion: 0.11
Nodes (21): attendanceAsOf, AttendanceChange, AttendanceEntry, AttendanceEntryInput, AttendanceHistoryRow, AttendanceResponse, FEB, JAN (+13 more)

### Community 90 - "attendee-score.ts"
Cohesion: 0.09
Nodes (26): AiRelevanceEvidence, AttendanceEvidence, Caveat, CaveatTemplate, caveatTemplateByCode, DiscussionEvidence, e1Recency(), escapeRegExp() (+18 more)

### Community 91 - "action-item-board.tsx"
Cohesion: 0.12
Nodes (21): ActionItemActions, ActionItemDueDate(), ActionItemTitle(), AutoAssignedActionCard(), EditForm, PRIORITY_OPTIONS, SuggestedActionCard(), toEditForm() (+13 more)

### Community 92 - "iso-day.ts"
Cohesion: 0.17
Nodes (19): ACTIVITY_THRESHOLDS, activityLevel, activityPeak(), activityTotal(), buildActivitySeries(), FollowupKind, oldestFirst(), PersonFollowupItem (+11 more)

### Community 93 - "Global Constraints"
Cohesion: 0.08
Nodes (23): Design constraints carried from the spec (non-negotiable — do not soften), Global Constraints, Grounding corrections (read before Task 1), Meeting Load Reduction (B) Implementation Plan, Open questions for the human, Task 10: `observed-change.ts`, Task 11: `queries.ts` — org-facing reads (no userIds, structurally), Task 12: `admin-queries.ts` — named reads, gated call sites only (+15 more)

### Community 94 - "Gemini Live streaming transcription — design"
Cohesion: 0.08
Nodes (23): 0. What I could and could not verify, 10. Open items, 1.1 How audio is metered, 1.2 Rate limits — Google stopped publishing the free-tier table, 1.3 Published pricing (paid tier, per 1M tokens, audio input), 1.4 Live API session mechanics, 1.5 Transcription-only configuration (the important one), 1.6 Ephemeral tokens (+15 more)

### Community 95 - "page.tsx"
Cohesion: 0.14
Nodes (19): generateMetadata(), PersonDetailPage(), personId, CardAction(), MyDayZone(), FILL_CLASSES, formatDay(), PersonActivityCard() (+11 more)

### Community 96 - "attendee-score.test.ts"
Cohesion: 0.10
Nodes (21): CandidateFacts, CAVEAT_TEMPLATES, CaveatCode, REASON_TEMPLATES, ReasonCode, ScoreContext, ScoredCandidate, BANNED_PHRASES (+13 more)

### Community 97 - "page.tsx"
Cohesion: 0.11
Nodes (14): CAPABILITIES, metadata, AltaVisionLogo(), BrandMark(), CredentialResponse, GoogleIdApi, GoogleOneTap(), Window (+6 more)

### Community 98 - "live.test.ts"
Cohesion: 0.11
Nodes (22): liveMeetingsAs(), MEETING_CHILD_TABLES, SOFT_TABLES, ALIAS_RE, ALLOWLIST, allowlistSet, bodyBraceIndex(), check4MatchIndexes() (+14 more)

### Community 99 - "client.ts"
Cohesion: 0.13
Nodes (18): shouldUseInlineAudio(), buildAudioPart(), buildImagePart(), callGeminiCore(), callGeminiSpeech(), extractInlineAudio(), extractText(), GeminiErrorCode (+10 more)

### Community 100 - "meeting-intent.ts"
Cohesion: 0.16
Nodes (18): fuzzyMatches(), levenshtein(), similarity(), addDays(), extractApp(), extractDay(), extractDuration(), extractTime() (+10 more)

### Community 101 - "Metrics"
Cohesion: 0.10
Nodes (20): Agenda-field and app-field usage (drill-down columns only), Assumptions (delegated decisions — veto here), Goal, In-app RSVP adoption (DEMOTED — was 'pending-RSVP cost'), Invited hours per week (headline — renamed from attendee-hours), Meeting Load Reduction — Design Spec (sub-project B), Metrics, Observed change since decision (REPLACES 'hours saved to date') (+12 more)

### Community 102 - "page.tsx"
Cohesion: 0.21
Nodes (17): ActivityPage(), colomboDayEnd(), colomboDayStart(), metadata, paramsSchema, ActivityFilterBar(), activityConditions(), activityParams() (+9 more)

### Community 103 - "webauthn-actions.ts"
Cohesion: 0.19
Nodes (15): webauthnCredentials, PasskeyNudgeBanner(), PasskeyNudge(), PasskeysCard(), beginPasskeyLogin(), beginPasskeyRegistration(), completePasskeyLogin(), completePasskeyRegistration() (+7 more)

### Community 104 - "Direct-manipulation browser verification"
Cohesion: 0.11
Nodes (18): Attempted unblock — refused, correctly, Blocked — NOT TESTED, Confession: one real meeting was moved and restored, Defect: rows could never be moved DOWN (keyboard or mouse), Defect: Space-to-lift never worked on task cards, Dev database is two migrations behind — this blocked everything initially, Direct-manipulation browser verification, Environment findings (before any UI test) (+10 more)

### Community 105 - "sprint-checkins.tsx"
Cohesion: 0.20
Nodes (14): sprint(), assembleMeetingPrep(), getSprintCheckins(), checkinGap, ComputedProgress, computeTaskProgress(), TaskForProgress, GapHint() (+6 more)

### Community 106 - "person-stats.ts"
Cohesion: 0.18
Nodes (14): buildMyDayStats(), MyDayInput, plural(), QUIET, QUIET_TASKS, allocationMeta(), buildPersonStats(), followupMeta() (+6 more)

### Community 107 - "actions.ts"
Cohesion: 0.15
Nodes (14): callGemini(), callGeminiWithAudio(), callGeminiWithImages(), GeminiError, askMeeting(), DictationResult, speakInput, SpokenAudio (+6 more)

### Community 108 - "meetings-day-rail.tsx"
Cohesion: 0.22
Nodes (15): MeetingDetailBody(), AttendeeResponse, durationLabel(), MeetingsOverview, MeetingState, meetingTiming, noRsvpYet(), OverviewMeeting (+7 more)

### Community 109 - "mention-match.ts"
Cohesion: 0.16
Nodes (17): ActiveMention, classify(), compare(), findMentionQuery(), matchMentions(), MENTION_QUERY_RE, MentionCandidate, MentionMatchKind (+9 more)

### Community 110 - "use-screen-keyframes.ts"
Cohesion: 0.24
Nodes (11): MeetingScreenshotView, ScreenFilmstrip(), encodeFrame(), hashOfFrame(), ScreenKeyframesHandle, useScreenKeyframes(), computeDHash(), computeDownscaledDimensions() (+3 more)

### Community 111 - "calendar-grid.ts"
Cohesion: 0.20
Nodes (15): clipToDay(), DaySegment, dayStartCache, dayWindow, dayWindowCache, hourLabel(), isAllDayMeeting(), isWorkingHour() (+7 more)

### Community 112 - "meeting-notes-model.ts"
Cohesion: 0.16
Nodes (14): ActionLine(), ActionItemReconciliation, ActionItemSuggestionRef, buildActionList(), DeadlineLike, dueStatus, glanceFromIntel(), IntelLike (+6 more)

### Community 113 - "text-replace.ts"
Cohesion: 0.22
Nodes (15): applyReplacements(), diffSingleWord(), editDistance(), findOccurrences(), FindOptions, fuzzyBudget(), groupOccurrences(), isWordChar() (+7 more)

### Community 114 - "task-card.tsx"
Cohesion: 0.18
Nodes (15): BoardGroup, GroupPatch, isDueToday(), isOverdue(), BoardBulkBar(), BoardColumn(), columnDroppableId(), CardFace() (+7 more)

### Community 115 - "scripts"
Cohesion: 0.12
Nodes (16): name, private, scripts, build, db:generate, db:migrate, db:status, dev (+8 more)

### Community 116 - "sidebar.tsx"
Cohesion: 0.19
Nodes (11): adminNavItems, getVisibleNavItems(), NavItem, navItems, NavLink(), Sidebar(), VersionBadge(), InstallButton() (+3 more)

### Community 117 - "types.ts"
Cohesion: 0.20
Nodes (12): ActivityFeed(), FeedRow(), ActivityDayGroup, activityPhrase(), groupActivityByDay(), VERB_PHRASES, ACTIVITY_ENTITY_TYPES, ACTIVITY_VERBS (+4 more)

### Community 118 - "app-activity.tsx"
Cohesion: 0.21
Nodes (13): ActivityDayGroup, AppActivityItem, AppActivityKind, assignmentActivityTitle(), groupActivityByDay(), mergeActivity(), firstLine(), getAppActivity() (+5 more)

### Community 120 - "Changes"
Cohesion: 0.12
Nodes (15): 1. Provisional rendering — the vanishing phrase (defect 1), 2. The pairing window (defect 2), 3. Script-aware interim leader (defect 3), 4. Concurrency probe, and never claiming dual (defect 4), 5. Restart gap (defect 5), 6. Honest degradation for si-LK (browser reality), 7. Bug found while implementing: the last utterance was dropped, Changes (+7 more)

### Community 121 - "Speaker identification from the meeting record"
Cohesion: 0.12
Nodes (15): Architecture, Data model, Decisions, Migration 0033, Out of scope, Refusal rules, Risks, Speaker identification from the meeting record (+7 more)

### Community 122 - "attendee-series.ts"
Cohesion: 0.16
Nodes (13): CADENCE_RE, CADENCE_WORDS, MONTHS, NON_WORD_RUN_RE, sameSeries(), SeriesCandidate, seriesKey(), SPRINT_NUM_RE (+5 more)

### Community 123 - "language-switch.ts"
Cohesion: 0.21
Nodes (12): ActiveLanguage, containsSinhala(), countMatches(), estimateSpokenUnits(), InterimLeaderInput, isRestartStorm(), isSilentSinhalaFallback(), pickInterimLeader() (+4 more)

### Community 124 - "now.ts"
Cohesion: 0.25
Nodes (13): PersonNowLines(), actionSentence(), capitalise(), EMPTY_NOW, isOverdue(), nowHeadline(), NowTask, overdueCount() (+5 more)

### Community 125 - "Global Constraints"
Cohesion: 0.13
Nodes (14): Design invariants this plan must not soften, Global Constraints, Open questions for the human, People Work History, Observed Load & KPIs (C) Implementation Plan, Task 10: Full verification gate, Task 1: Upstream writer fixes — per-task bulk logging, assignee snapshots, follow-up dedupe, Task 2: `iso-day.ts` week-key helper + `observed-load.ts` — meeting-hours shaping and signal, Task 3: `task-events.ts` — task-completion shaping and attribution (no signal rule) (+6 more)

### Community 126 - "Attribution Truth & Membership — Design Spec"
Cohesion: 0.13
Nodes (14): Attribution Truth & Membership — Design Spec, Backfill, Data repair — migration `0018`, One action, no half-applied state, Out of scope (named, not silently skipped), Removal never touches the past, Rendering: label chip vs. person name, Section 1 — Never guess (+6 more)

### Community 127 - "People Work History, Observed Load & KPIs — Design Spec (sub-project C)"
Cohesion: 0.13
Nodes (14): Allocation trend (shipped) + churn (real reassignment count), Assumptions (delegated decisions — veto here), Hard product rules, KPIs, Meeting load — scheduled hours/week ('scheduled, not declined'), Observed-load surface, Open follow-up debt (adopted as-is: the shipped Owes tile, made truthful at the source; NO new followup chart), People Work History, Observed Load & KPIs — Design Spec (sub-project C) (+6 more)

### Community 128 - "scoreCandidate"
Cohesion: 0.29
Nodes (15): daysBetween(), e4e5Recency(), fmtDayMonth(), interpolate(), maxTier(), renderCaveat(), renderReason(), scoreAttendance() (+7 more)

### Community 129 - "Meeting Intel Panel Redesign — Design Spec"
Cohesion: 0.14
Nodes (13): Accessibility, Attribution language (consistent with 0021_attribution_membership), Avoided defaults, Bilingual treatment, Carried forward actions, Diagnosis of current UI (screenshot 2026-08-12), Meeting Intel Panel Redesign — Design Spec, Out of scope (+5 more)

### Community 130 - "App-wide Soft Deletes — Design Spec (sub-project D)"
Cohesion: 0.14
Nodes (13): App-wide Soft Deletes — Design Spec (sub-project D), Assumptions (delegated decisions — veto here), Cascade rule, External cleanup (Blob / Google Calendar / notifications), Mechanism, One flagged exception requiring your attention, Query safety, Rejected (+5 more)

### Community 131 - "queries.ts"
Cohesion: 0.23
Nodes (9): MeetingsPage(), summarizeMeetings(), attachAttendees(), getUpcomingMeetingsForUser(), listMeetings(), MeetingAttendee, meetingColumns, splitByUpcoming() (+1 more)

### Community 132 - "live-transcription-status.tsx"
Cohesion: 0.30
Nodes (10): LiveTranscriptionCostNotice(), LiveTranscriptionStatus(), STATUS_COPY, AutoStopInput, autoStopReason, estimateAudioTokens(), estimateCostUsd(), formatCostEstimate() (+2 more)

### Community 133 - "live-token.ts"
Cohesion: 0.32
Nodes (10): callModelWithRetry(), backoffDelayMs(), parseRetryAfterMs(), RETRIABLE_STATUSES, shouldRetry(), sleep(), MintAttempt, MintedLiveToken (+2 more)

### Community 134 - "task-workload.ts"
Cohesion: 0.23
Nodes (10): PersonTasksCard(), bucketOpenTasks(), compareOpenTasks(), DUE_STATE_LABEL, DUE_STATE_ORDER, dueState, PersonTaskRow, PersonTaskStatus (+2 more)

### Community 135 - "use-live-transcription.ts"
Cohesion: 0.28
Nodes (9): LiveTranscriptionHandle, useLiveTranscription(), LiveStatus, appendFragment(), commitTurn(), EMPTY_TRANSCRIPT, fullText(), longestSuffixPrefixOverlap() (+1 more)

### Community 136 - "Global Constraints"
Cohesion: 0.17
Nodes (11): Global Constraints, Meeting Attendee Recommender (A1) Implementation Plan, Task 1: Schema, migration, and `optional` plumbing, Task 2: `seriesKey` — pure series inference, Task 3: Agenda topic buckets and app matching, Task 4: The scorer — `attendee-score.ts`, Task 5: Validator, redaction projector, and reasons merge, Task 6: Fact gathering, orchestrator, and server actions (+3 more)

### Community 137 - "Unified Roadmap — design"
Cohesion: 0.17
Nodes (11): 10. Build order, 1. The problem with two tabs, 2. The single job, 3. The shape, 4. Signature element, 5. Intelligence — only what changes a decision, 6. States (every one designed), 7. Interaction rules (+3 more)

### Community 138 - "buttonVariants"
Cohesion: 0.21
Nodes (9): CAPABILITIES, metadata, PublicHomePage(), buttonVariants, Calendar(), CalendarDayButton(), AttendeeResponse, MeetingRsvp() (+1 more)

### Community 139 - "actions.ts"
Cohesion: 0.24
Nodes (10): geminiKeys, addGeminiKey(), addKeyInput, idInput, toggleInput, validateGeminiKey(), RecordingReadiness, decryptSecret() (+2 more)

### Community 140 - "plan-read.ts"
Cohesion: 0.27
Nodes (9): SprintProgress, PlanReadStrip(), daysLeftPhrase(), planGaps, readSprint(), SprintHealth, SprintRead, StatusCounts (+1 more)

### Community 141 - "active-sprints.tsx"
Cohesion: 0.32
Nodes (9): ActiveSprints(), daysRemainingLabel(), formatSprintDate(), formatUpcomingDate(), startsInLabel(), daysRemaining(), sprintProgress(), ActiveSprintSummary (+1 more)

### Community 142 - "task-rank.ts"
Cohesion: 0.35
Nodes (9): compareRanked(), InsertPlan, needsRebalance(), neighboursAt(), planInsert(), rankBetween(), Ranked, rankForAppend() (+1 more)

### Community 143 - "live-client.ts"
Cohesion: 0.33
Nodes (9): LiveCallbacks, LiveSessionOptions, buildAudioMessage(), buildSetupMessage(), LiveServerEvent, liveSocketUrl(), parseDurationMs(), parseServerEvent() (+1 more)

### Community 144 - "page.tsx"
Cohesion: 0.25
Nodes (9): AppsPage(), PortfolioSummary, browseHref(), AppFormDialog(), toFormState(), PortfolioSummaryStrip(), Tile, listDistinctTechTags() (+1 more)

### Community 145 - "queries.ts"
Cohesion: 0.24
Nodes (10): AppCounts, AppMember, AppPortfolioEntry, AppStats, AppWithMembers, countWhere(), emptyTaskCounts(), getAppBySlug() (+2 more)

### Community 146 - "capacity-card.tsx"
Cohesion: 0.33
Nodes (7): CapacityCard(), CapacityEmpty(), PersonAvatar(), PersonHeading(), CapacityHeat(), sortCapacities(), UserCapacity

### Community 147 - "meeting-window.ts"
Cohesion: 0.22
Nodes (8): AttendeeResponse, DEFAULTS, PersonMeetingEntry, PersonMeetingRow, PersonMeetings, SplitOptions, splitPersonMeetings(), NOW

### Community 148 - "Project Manager (PM) on apps"
Cohesion: 0.18
Nodes (10): 1. Migration (`drizzle/0033_app_pm.sql`), 2. History (audit trail, not an as-of index), 3. Create form, 4. Edit anytime, 5. Display, Browser exercise (dev server on :3000, reachable), Project Manager (PM) on apps, Tests (+2 more)

### Community 149 - "Calendar drag-to-resize — implementation report"
Cohesion: 0.18
Nodes (10): 1. The pure helpers' contracts (`time-drag.ts`), 2. Distinguishing the three gestures, 3. Midnight-cut suppression, 4. Accessibility — pointer-only, deliberately, 5. A real bug found and fixed during verification: pointer capture, 6. Full verification output, 7. Browser verification, 8. Housekeeping note (+2 more)

### Community 150 - "Global Constraints"
Cohesion: 0.20
Nodes (9): Global Constraints, Meeting Intel Panel Redesign — Implementation Plan, Self-review notes, Task 1: `IntelCard` shared section shell, Task 2: shared attribution chips (extract from note-timeline), Task 3: Summary card — EN + SI siblings, provenance footer, Task 4: Act tier — Decisions, Next steps, Carried forward, Task 5: Read + Reference tiers — Discussion, For next meeting, Glossary (+1 more)

### Community 151 - "Global Constraints"
Cohesion: 0.20
Nodes (9): App-wide Soft Deletes (D) Implementation Plan, Global Constraints, Task 1: Migration + schema columns, Task 2: `src/db/live.ts` + enforcement test, Task 3: Convert the five delete actions, Task 4: Backlog builder + read-site conversion, Task 5: Trash queries + restore/purge actions, Task 6: Trash card UI + keyframe proxy auth (+1 more)

### Community 152 - "Global Constraints"
Cohesion: 0.20
Nodes (9): Daily Work-Done Log Implementation Plan, Global Constraints, Self-review, Task 1: Schema and migration, Task 2: Pure day/percent logic, Task 3: Write and read actions, Task 4: AI draft from the person's own activity, Task 5: Personal entry form (+1 more)

### Community 153 - "Direct Manipulation — Sprint Board, Roadmap & Meetings Calendar"
Cohesion: 0.20
Nodes (9): Direct Manipulation — Sprint Board, Roadmap & Meetings Calendar, Goal, Phase 1 — shared drag kit, Phase 2 — board fixes, Phase 3 — live roadmap, Phase 4 — calendar refit, Phase 5 — inline edit, Testing / Verification (+1 more)

### Community 154 - "Meeting Write-up Panels — Design Spec"
Cohesion: 0.20
Nodes (9): Avoided defaults, Bilingual summary control, Colour + tag system, Filter / control model, Meeting Write-up Panels — Design Spec, Panel model, Relationship to `2026-08-12-meeting-intel-redesign-design.md`, Test plan (pure logic only, per house convention) (+1 more)

### Community 155 - "readiness.ts"
Cohesion: 0.33
Nodes (8): assessRecordingReadiness(), estimateSessionShare(), indicativeHoursPerKey(), isCurrentlyFailing(), KeyHealth, key(), MINUTES_AGO, NOW

### Community 156 - "MeetingForm"
Cohesion: 0.31
Nodes (8): addEveryone(), applyQuickAddAttendees(), applyTeamPrefill(), AttendeeSelection, roster, MeetingForm(), quickAddProblems(), stateFromMeeting()

### Community 157 - "text-replace-actions.ts"
Cohesion: 0.29
Nodes (9): applyInput, applyMeetingReplacements(), decodeTargetId(), encodeTargetId(), fetchTargets(), findInput, findMeetingReplacements(), MeetingReplaceResult (+1 more)

### Community 158 - "roadmap-geometry.ts"
Cohesion: 0.42
Nodes (8): addDays(), daysFromOffset(), diffDaysInclusive(), parseIsoDate(), resizeEnd(), resizeStart(), shiftRange(), toIsoDate()

### Community 159 - "use-smart-poll.ts"
Cohesion: 0.33
Nodes (7): SmartPollOptions, useSmartPoll(), nextPollDelay(), PollConditions, PollSchedule, shouldPoll(), SCHEDULE

### Community 160 - "agenda-topics.ts"
Cohesion: 0.31
Nodes (8): AgendaTopicMatch, escapeRegExp(), findEarliestKeywordMatch(), matchAgendaTopic(), normalizeRoleToken(), GENERIC_KEYWORD_DENYLIST, TOPIC_BUCKETS, TopicBucket

### Community 161 - "Meeting keyframe proxy route — report"
Cohesion: 0.20
Nodes (9): Authorization matrix (`keyframe-access.test.ts`), Commit, Concerns / follow-ups (none blocking), How the admin exception was handled, Meeting keyframe proxy route — report, Path/pathname handling, Verification, What was built (+1 more)

### Community 162 - "search.ts"
Cohesion: 0.47
Nodes (7): activityRowSearchText(), bestWordSimilarity(), fuzzyActivityFallback(), rankActivityMatches(), Row, tokenize(), words()

### Community 163 - "recording-segments.ts"
Cohesion: 0.36
Nodes (7): ConcatenatedSegments, concatenateSegments(), hintTail(), isRetriableSegmentError(), segmentRetryDelayMs(), shouldCutSegment(), TranscribedSegment

### Community 164 - "person-tasks-card.tsx"
Cohesion: 0.28
Nodes (8): DUE_DOT, DUE_TONE, dueSuffix(), formatDueDate(), PRIORITY_DOT, PRIORITY_LABEL, STATUS_LABEL, TaskRow()

### Community 165 - "/activity real search — implementation report"
Cohesion: 0.22
Nodes (8): /activity real search — implementation report, Browser verification, Files touched (all within assigned scope), Layer 1 — SQL condition shape (`activitySearchCondition`, in `filters.ts`), Layer 2 — pure TS contracts (`search.ts`), Page wiring (`src/app/(app)/activity/page.tsx`), UI (`activity-filter-bar.tsx`), Verification

### Community 166 - "Google integration — two-bug report"
Cohesion: 0.22
Nodes (8): Bug 1 — profile pictures fall back to initials, Bug 2 — "A Google Meet room will be created … needs your Google Calendar connection", Files changed, Google integration — two-bug report, The actual bug, found by a live test against a real refresh token, User action required — nothing else in the code can fix this, Verification, What was already correct (do not re-fix)

### Community 167 - "LogPup Development"
Cohesion: 0.25
Nodes (7): Explore before editing, LogPup Development, Migrations — the trap list, Multi-session coordination, Product decisions already made (don't relitigate), Speech / TTS, Still OPEN — ask the user, don't assume

### Community 168 - "Dashboard Redesign + Activity Trail — Design Spec"
Cohesion: 0.25
Nodes (7): 1. Dashboard layout (`/`), 2. Activity trail (`activity_log`), 3. Errors & performance, 4. Testing, Dashboard Redesign + Activity Trail — Design Spec, Decisions (from brainstorm), Out of scope

### Community 169 - "print-masthead-edit.tsx"
Cohesion: 0.36
Nodes (5): EditableAgenda(), EditableAttendees(), EditableTitle(), MeetingEditBase, useMeetingWrite()

### Community 170 - "page.tsx"
Cohesion: 0.32
Nodes (3): metadata, LEGAL_PROSE, metadata

### Community 171 - "segment-store.ts"
Cohesion: 0.46
Nodes (7): keyFor(), loadParkedSegments(), openDb(), ParkedSegment, parkSegment(), releaseSegment(), runTransaction()

### Community 172 - "Merge report: `main` → `feat/soft-deletes`"
Cohesion: 0.25
Nodes (7): Commit, Gates, Merge report: `main` → `feat/soft-deletes`, Per-file table (key files from the original merge, `5baa0ef`), Things I was unsure about / flagging for visibility, TL;DR, What I verified, and why I believe it's right

### Community 173 - "encodeAudioChunk"
Cohesion: 0.71
Nodes (5): bytesToBase64(), downsampleTo(), encodeAudioChunk(), floatTo16BitPCM(), int16ToLittleEndianBytes()

### Community 174 - "dedupe.ts"
Cohesion: 0.33
Nodes (4): createDeduper(), Deduper, DeduperOptions, Entry

### Community 175 - "LogPup mobile usability audit"
Cohesion: 0.29
Nodes (6): Already good (do not churn these in the fix pass), Findings table, LogPup mobile usability audit, Summary, Systemic patterns (fix once, not N times), Top 10 by impact (fix these first)

### Community 176 - "models.ts"
Cohesion: 0.33
Nodes (5): GEMINI_MODEL_FALLBACK_ORDER, QUICK_MODELS, SYNTHESIS_MODELS, TTS_MODEL_FALLBACK_ORDER, LIVE_MODEL_FALLBACK_ORDER

### Community 177 - "project-roles.ts"
Cohesion: 0.67
Nodes (4): isProjectManagerRole(), isReviewerRole(), ProjectRoleTone, roleBadgeTone()

### Community 178 - "generate-changelog.mjs"
Cohesion: 0.40
Nodes (4): data, out, root, versions

### Community 180 - "setOwnPassword"
Cohesion: 0.60
Nodes (3): setOwnPassword(), hashPassword(), verifyPassword()

### Community 181 - "google-one-tap.ts"
Cohesion: 0.50
Nodes (4): GoogleIdentity, TokenInfo, VALID_ISSUERS, verifyGoogleIdToken()

### Community 182 - "meeting-pip.tsx"
Cohesion: 0.60
Nodes (4): adoptStyles(), DocumentPipHost, MeetingPip(), pipHost()

### Community 183 - "drizzle/ migrations"
Cohesion: 0.50
Nodes (3): 2026-08-12: migration ledger was out of sync with the database, drizzle/ migrations, Rule going forward

### Community 184 - "check-migrations.mjs"
Cohesion: 0.67
Nodes (3): expectedTables(), main(), root

## Knowledge Gaps
- **1090 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+1085 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Auth & Security Lib` to `Server Actions & Results`, `Database Schema & Queries`, `Cards & Page Composition`, `App Detail & Board Pages`, `Runtime Dependencies`, `task-workload.ts`, `buttonVariants`, `Shell & Navigation`, `plan-read.ts`, `active-sprints.tsx`, `Meeting Forms & Calendar`, `page.tsx`, `capacity-card.tsx`, `People & Allocation Actions`, `Person Detail Skeleton`, `Apps List Skeleton`, `Drizzle Config`, `Window Icon Asset`, `person-tasks-card.tsx`, `user-table.tsx`, `meetings-time-grid.tsx`, `meeting-intel.tsx`, `meeting-panels.tsx`, `meeting-list.tsx`, `note-timeline.tsx`, `app-health.ts`, `history-views.tsx`, `meeting-prep.tsx`, `calendar-view.ts`, `browse.ts`, `board.tsx`, `dashboard-zones.tsx`, `page.tsx`, `meetings-month-calendar.tsx`, `task-intent.ts`, `history-params.ts`, `action-item-board.tsx`, `page.tsx`, `page.tsx`, `meetings-day-rail.tsx`, `use-screen-keyframes.ts`, `meeting-notes-model.ts`, `task-card.tsx`, `sidebar.tsx`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `Person Detail Skeleton`, `ESLint Config`, `date-fns`, `@dnd-kit/sortable`, `googleapis`, `lodash.throttle`, `motion`, `next`, `next-auth`, `react-day-picker`, `shadcn`, `tailwind-merge`, `@vercel/blob`, `cmdk`, `jotai`, `@notionhq/client`, `@simplewebauthn/browser`, `@simplewebauthn/server`, `@vercel/speed-insights`, `scripts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `react` connect `Person Detail Skeleton` to `dependencies`, `buttonVariants`, `Auth & Security Lib`, `note-timeline.tsx`, `Apps List Skeleton`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _1090 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Server Actions & Results` be split into smaller, more focused modules?**
  _Cohesion score 0.08469945355191257 - nodes in this community are weakly interconnected._
- **Should `Cards & Page Composition` be split into smaller, more focused modules?**
  _Cohesion score 0.1166429587482219 - nodes in this community are weakly interconnected._
- **Should `App Detail & Board Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.1349206349206349 - nodes in this community are weakly interconnected._