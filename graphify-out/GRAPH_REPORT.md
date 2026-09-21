# Graph Report - LogPup  (2026-09-21)

## Corpus Check
- 1298 files · ~1,537,457 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 7954 nodes · 22869 edges · 354 communities (306 shown, 48 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 171 edges (avg confidence: 0.66)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d52fdf93`
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
- 2. Every reader of `meetings.appId`, and what it becomes
- route.ts
- page.tsx
- BUILD ORDER
- meeting-people-picker-model.ts
- Decisions
- Multi-discipline projects — design
- gather.ts
- audit-queries.ts
- queries.ts
- ai-engine.ts
- ask-panel.tsx
- task-composer.tsx
- escalation.ts
- Part A — Foundation
- Decisions
- sidebar-store.ts
- queries.ts
- recurrence.ts
- Decisions
- budget-notify.ts
- actions.ts
- model-discovery.ts
- entry-actions.ts
- Meeting coverage — R6 COVER-TOGETHER
- Command Center & Universal Search — Registry Design Spec
- Calendar Hardening — Organiser Handover, Full Patch, Classified Failure — Design
- Work Signals — measuring what people did, without inventing it
- admin-queries.ts
- format-instant.ts
- zones.ts
- Global Constraints
- coverage.ts
- glance-core.ts
- registry.test.ts
- /activity redesign — implementation report
- app-aliases.ts
- event-identity.ts
- Recurring meetings
- google-calendar.ts
- recurrence.ts
- Activity Trail Redesign — Design Spec
- field-reconcile.ts
- Motion and Theming — design
- role-history.ts
- app-client.ts
- actions.ts
- Role-shaped dashboards
- audit-queries.test.ts
- File Structure
- Per-feature model choice
- Project cost, worth, and effort reporting
- trash-card-logic.ts
- UI Intelligence Redesign — design
- Worklog: a calendar, per-task hours, and an AI cross-check
- The Dossier Docket — /meetings list view redesign
- sections.ts
- recording-progress.ts
- team-csv.test.ts
- entry-actions.test.ts
- App PM/lead history as queryable intervals
- Work-Management Substrate — Scope, Delivery, and the Missing Column — Design
- calendar-overlap.ts
- live-client.test.ts
- Self-teaching audit
- Work movement, role KPIs, and three intake fixes
- Decisions
- tech-tags-input.tsx
- list-filter.ts
- Global Constraints
- Work-Management Substrate Implementation Plan
- Part 1 — The measurement model
- activity-levels.ts
- review-rules.ts
- Self-teaching audit — meeting notes & intel
- 1.3 Role panels
- Part 4 — Deadline upload for PMs and tech leads
- page.tsx
- mine.ts
- enforcement.test.ts
- key-census.ts
- list-search.ts
- backlog.ts
- 2. Commit history (GitHub App)
- bulk-actions.test.ts
- churn.ts
- collisions.ts
- meeting-url.ts
- visibility.test.ts
- Part 0 — What the data can and cannot answer
- Part 3 — Project people as CSV, with names and emails
- Part 2 — Ignore the template lines in an uploaded bug report
- auto-title.ts
- split-upcoming.test.ts
- live-token.test.ts
- sort-order.ts
- package.json
- check-schema-drift.ts
- verify-head.mjs
- ledger-sheet.tsx
- fuzzyMatches
- tracked-imports.test.ts
- remove-user.test.ts
- queries.test.ts
- queries.test.ts
- @dnd-kit/core
- drizzle-orm
- lucide-react
- radix-ui
- @vercel/analytics
- zod
- task-assignees.test.ts
- UNASSIGNED
- segment-store.ts
- activity-skeleton.tsx
- task-status.ts
- googleapis
- danger-actions.test.ts
- Project change policy — PM/lead parity + per-project sign-off
- meter-actions.ts
- actions.test.ts
- page.tsx
- signal-board.tsx
- activity-levels.ts
- churn.ts
- meeting-url.ts
- first-log-nudge.tsx
- clsx
- google-one-tap.tsx
- auto-title.ts
- set-user-personal-email.test.ts
- ai-actions.finalize.test.ts
- month-summary.tsx
- effectiveGrant
- budget-notify.ts
- page.tsx
- briefing-card.tsx
- danger-actions.test.ts
- queries.ts
- prompt.ts
- mention-rules.ts
- live-protocol.ts
- participation.ts
- Personal-first dashboard — design
- maintenance-banner.tsx
- entity-kinds.ts
- applyCap
- backlog.ts
- dedupe.ts
- meeting-url.ts
- absence-queries.test.ts
- sw.test.ts
- rate-queries.test.ts
- 2026-09-21-personal-first-dashboard.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 482 edges
2. `err()` - 279 edges
3. `ok()` - 265 edges
4. `Button()` - 171 edges
5. `logActivity()` - 144 edges
6. `Db` - 127 edges
7. `requireCapability()` - 123 edges
8. `can()` - 118 edges
9. `users` - 79 edges
10. `toIsoDateInTimeZone()` - 78 edges

## Surprising Connections (you probably didn't know these)
- `CountingNumber()` --references--> `react`  [EXTRACTED]
  src/components/animate-ui/primitives/texts/counting-number.tsx → package.json
- `useStaticNumber()` --references--> `react`  [EXTRACTED]
  src/components/animate-ui/stat-number.tsx → package.json
- `MentionTextarea()` --references--> `react`  [EXTRACTED]
  src/components/mention-textarea.tsx → package.json
- `MobileNav()` --references--> `react`  [EXTRACTED]
  src/components/shell/mobile-nav.tsx → package.json
- `CalendarDayButton()` --references--> `react`  [EXTRACTED]
  src/components/ui/calendar.tsx → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Server Action Pattern (zod validate, auth check, ActionResult)** — docs_superpowers_plans_2026_08_10_logpup_action_result, docs_superpowers_plans_2026_08_10_logpup_authjs_v5_google_signin, docs_superpowers_plans_2026_08_10_logpup_nextjs_16_monolith [EXTRACTED 1.00]
- **Capacity Feature (allocation model, math, heat dashboard)** — docs_superpowers_specs_2026_08_10_logpup_design_capacity_allocation, docs_superpowers_plans_2026_08_10_logpup_allocation_math, docs_superpowers_plans_2026_08_10_logpup_capacity_dashboard [INFERRED 0.85]
- **External Integration Resilience (save first, warn on API failure)** — docs_superpowers_specs_2026_08_10_logpup_design_non_blocking_integrations, docs_superpowers_plans_2026_08_10_logpup_google_calendar_integration, docs_superpowers_plans_2026_08_10_logpup_notion_export [EXTRACTED 1.00]

## Communities (354 total, 48 thin omitted)

### Community 0 - "Server Actions & Results"
Cohesion: 0.31
Nodes (8): AppFormDialog(), toFormState(), TechTagsInput(), canonicalizeTag(), CURATED_TECH_TAGS, CURATED_TECH_TAGS_RAW, filterTagSuggestions(), mergeTagSources()

### Community 1 - "Database Schema & Queries"
Cohesion: 0.06
Nodes (69): AdminPeoplePage(), metadata, DEFAULT_COPY, ERROR_COPY, metadata, DeactivatedPage(), metadata, metadata (+61 more)

### Community 2 - "Cards & Page Composition"
Cohesion: 0.05
Nodes (61): Fortnight(), getDeterministicLog(), SampleLog, SATURDAY_TASKS_POOL, STUDIO_TASKS_POOL, ViewMode, WEEKDAYS, formatDate() (+53 more)

### Community 3 - "App Detail & Board Pages"
Cohesion: 0.11
Nodes (27): ActivityDayGroup, AppActivityItem, AppActivityKind, assignmentActivityTitle(), groupActivityByDay(), mergeActivity(), firstLine(), getAppActivity() (+19 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.13
Nodes (29): MeetingPeopleMultiPicker(), MeetingPeoplePicker(), buildPeopleOptions(), BuildPeopleOptionsInput, buildPeoplePool(), ChipLabel, composeHint(), fromPickerValue() (+21 more)

### Community 5 - "Design Docs & Plans"
Cohesion: 0.07
Nodes (27): drizzle-kit, eslint, eslint-config-next, devDependencies, drizzle-kit, eslint, eslint-config-next, @playwright/test (+19 more)

### Community 6 - "Tables & Selects"
Cohesion: 0.04
Nodes (134): geminiKeys, logActivity(), approveUser(), rejectUser(), resetUserPassword(), revalidateAdminPaths(), revalidateUserDetailPaths(), setUserEmploymentType() (+126 more)

### Community 7 - "Dev Tooling Config"
Cohesion: 0.13
Nodes (35): sprintOrBacklogCondition(), boardMoveInput, bulkUpdateInput, bulkUpdateTasks(), createTask(), deleteTask(), isForeignKeyViolation(), moveTaskOnBoard() (+27 more)

### Community 8 - "Form Dialogs"
Cohesion: 0.02
Nodes (135): APP_SLUG, decidedKeys, meetingIds, RUN_ID, APP_SLUG, RUN_ID, lead, q (+127 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, .next-e2e/dev/types/**/*.ts, .next-e2e/types/**/*.ts, next-env.d.ts (+22 more)

### Community 10 - "Command Center Search"
Cohesion: 0.05
Nodes (43): APP_INK, APP_LABEL, APP_RULE, AppKey, BandBadge(), BODY_PLACEMENT, BriefingStatItem, CAPTION_PLACEMENT (+35 more)

### Community 11 - "Shell & Navigation"
Cohesion: 0.10
Nodes (27): Activity, ContributionGraph(), ContributionGraphBlock(), ContributionGraphBlockProps, ContributionGraphCalendar(), ContributionGraphCalendarProps, ContributionGraphContext, ContributionGraphContextType (+19 more)

### Community 12 - "Feature Dialogs & Panels"
Cohesion: 0.07
Nodes (28): ActionResult Pattern, Allocation Math (summarizeAllocations), Auth.js v5 Google Sign-In, Capacity Heat Dashboard, Command Palette (Cmd+K) + Empty States, Drizzle Schema (7 tables, Neon Postgres), Google Calendar Integration, LogPup Implementation Plan (+20 more)

### Community 13 - "Auth & Security Lib"
Cohesion: 0.07
Nodes (38): CommandLoading(), BubbleView, OpenBubbleRequest, openIntelBubble(), commands, assignableUsers(), likePattern(), previewTaskIntent() (+30 more)

### Community 14 - "shadcn Component Config"
Cohesion: 0.02
Nodes (138): GET(), segmentWho(), meetingNoteSegments, sprintCheckins, isAdminRole(), callGeminiWithImages(), acceptSuggestionInput, ActionItemOut (+130 more)

### Community 15 - "Meeting Actions"
Cohesion: 0.09
Nodes (22): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+14 more)

### Community 16 - "Meeting Forms & Calendar"
Cohesion: 0.18
Nodes (16): QuickMenuItem, BoardGroup, GroupPatch, isDueToday(), isOverdue(), BoardColumn(), columnDroppableId(), CardFace() (+8 more)

### Community 17 - "People & Allocation Actions"
Cohesion: 0.12
Nodes (39): managesAnyApp(), appIdsForMeeting(), appNameById(), appNamesByIds(), attendeeEmails(), AttendeeRef, canManageMeeting(), createMeeting() (+31 more)

### Community 18 - "Input Primitives"
Cohesion: 0.12
Nodes (21): mentions, scopeSourceFor(), collapsingArbiter(), dropDeadEntities(), dropIneligibleRecipients(), escapeRegExp(), gateKey(), insertAll() (+13 more)

### Community 19 - "Tabs"
Cohesion: 0.30
Nodes (15): assignInput, assignmentStillExists(), assignmentUpdateInput, assignUser(), closeOpenInterval(), historyStatements(), isUniqueViolation(), nameForUser() (+7 more)

### Community 20 - "Root Layout & Theming"
Cohesion: 0.11
Nodes (18): css, NON_DEFAULT, Root, Accent, ACCENTS, applyAccent(), applyTheme(), isAccent() (+10 more)

### Community 21 - "NextAuth Type Extensions"
Cohesion: 0.05
Nodes (36): MeterTaskHandle, CarriedForwardItem, FollowupPersonOption, FollowupTargetOption, LinkedTaskView, MeetingIntel, UnattributedFollowupView, AttributionContext (+28 more)

### Community 22 - "App Detail Skeleton"
Cohesion: 0.12
Nodes (21): bugReports, deleteBug(), loadMoreTriageBugs(), reportBug(), revalidateBug(), { authMock, getBugScopeMock, insertSpy, updateSpy, logActivityMock, selectRows }, triageBug(), unexpected() (+13 more)

### Community 23 - "Person Detail Skeleton"
Cohesion: 0.03
Nodes (109): PublicHomePage(), ContactButtons(), HelpDetail(), HelpNote(), InlineRename(), LazyDisclosure(), AttendanceAppButton(), NavLink() (+101 more)

### Community 24 - "Vercel Cron Config"
Cohesion: 0.04
Nodes (46): 1. Replay: `src/db/schema.ts` — a new `sso_redemptions` table, 1. `src/lib/bridge-auth.ts` (new), 2. `src/features/sprints/task-status-write.ts` (new) — the important one, 2. `src/lib/auth.ts` — a new `attendance-sso` Credentials provider, 3. `src/app/api/external/tasks/route.ts` (new), 3. `src/app/sso/attendance/page.tsx` — the receiver, 4. `src/app/api/external/tasks/[id]/status/route.ts` (new), 5. The write freeze — verify, don't assume (+38 more)

### Community 25 - "ESLint Config"
Cohesion: 0.27
Nodes (8): FollowupKind, hasBecomeATask(), oldestFirst(), PersonFollowupItem, PersonFollowupRow, PersonFollowups, splitPersonFollowups(), withAge()

### Community 27 - "PostCSS Config"
Cohesion: 0.33
Nodes (4): AppleIcon(), size, GET(), pawSvg()

### Community 28 - "Apps List Skeleton"
Cohesion: 0.15
Nodes (17): ENTRY_CATEGORIES, buildEntryDraftPrompt(), DraftActivityRow, DraftMeeting, DraftPerson, DraftRecentDay, DraftTask, hrs() (+9 more)

### Community 29 - "Meetings Skeleton"
Cohesion: 0.23
Nodes (10): buildBlocks(), notion(), NotionParentError, resolveParentPageId(), SprintExportData, data, upsertSprintPage(), NotionPageCandidate (+2 more)

### Community 30 - "Drizzle Config"
Cohesion: 0.07
Nodes (58): buildDragAnnouncements(), DragSurface(), useDragSensors(), HEALTH_FILL, remainingLabel(), RoadmapSpine(), SpineSprint, ActiveDrag (+50 more)

### Community 31 - "File Icon Asset"
Cohesion: 0.08
Nodes (50): formatElapsed(), localSpend(), MeterInput, MeterPhase, MeterUsage, meterView, AT, AiMeterDock() (+42 more)

### Community 32 - "Globe Icon Asset"
Cohesion: 0.26
Nodes (7): Action, getSessionMock, SAMPLE, selectSpy, actionsAllowedDuringMaintenance(), isFrozenByMaintenance(), MAINTENANCE_ALLOWED_WRITES

### Community 33 - "Next.js Logo Asset"
Cohesion: 0.29
Nodes (6): sin1, buildCommand, crons, framework, regions, $schema

### Community 35 - "Window Icon Asset"
Cohesion: 0.07
Nodes (33): BentoFeatures(), CAPABILITIES, CapabilitiesGrid(), ACTIVITY_ROWS, BRIEFING_COMPILE, BRIEFING_STATS, BriefingDetailRow, BriefingStat (+25 more)

### Community 37 - "Vitest Config"
Cohesion: 0.17
Nodes (27): DangerAppOption, DangerAppResetCard(), BlastRadiusLists(), DangerConfirmControl(), DangerRecordingsCard(), DangerTrashEmptyCard(), emptyTrash(), backupFilename() (+19 more)

### Community 38 - "dependencies"
Cohesion: 0.07
Nodes (29): @base-ui/react, class-variance-authority, @dnd-kit/sortable, googleapis, lodash.throttle, motion, @neondatabase/serverless, @notionhq/client (+21 more)

### Community 39 - "user-table.tsx"
Cohesion: 0.06
Nodes (51): JobRoleSelect(), SelectContent(), SelectGroup(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator() (+43 more)

### Community 41 - "meetings-time-grid.tsx"
Cohesion: 0.08
Nodes (37): eventGeometry, minEventMinutes(), laneFraction(), AllDayEvent(), BlockPreview, buildBlockPreview(), CreateDraft, CreateGestureHandlers (+29 more)

### Community 42 - "@dnd-kit/sortable"
Cohesion: 0.11
Nodes (35): AdminAuditPage(), AUDIT_SORT_DIRECTIONS, AUDIT_SORT_KEYS, AUDIT_SORT_LABELS, AuditDayGroup, auditDepthNotice(), auditEmptyKind(), auditHref() (+27 more)

### Community 43 - "actions.ts"
Cohesion: 0.14
Nodes (13): authFile, repoRoot, seedDevUser(), SeedResult, ALL_MEETING_TITLES, APP_SLUG, createMeeting(), deleteMeetingViaList() (+5 more)

### Community 45 - "googleapis"
Cohesion: 0.06
Nodes (64): AbsenceGridData(), AbsenceListData(), AdminAbsencesPage(), RawAbsenceParams, PresenceList(), absenceKind, absences, { authMock, logActivityMock, whereSpy, setSpy, canReviewAbsenceMock } (+56 more)

### Community 46 - "lodash.throttle"
Cohesion: 0.13
Nodes (23): AiEngineRow, aiEngineTotals, buildAiEngineRows(), chainFor(), defaultLeadFor(), formatRate(), formatTokenCount(), MODEL_FACTS (+15 more)

### Community 47 - "queries.ts"
Cohesion: 0.10
Nodes (32): HistoryData(), HistoryRow, annotateTeamChanges(), AppLoadRow, appLoadRows(), CapacityDelta, CapacitySnapshotEntry, churnCounts (+24 more)

### Community 48 - "motion"
Cohesion: 0.12
Nodes (29): CatchUpDayFacts, DayOneLine(), TOKEN_CLASS, FiledAbsence, EntryGrammarHelp(), dayLabel(), derivedScoreFor(), hasSomethingToSave() (+21 more)

### Community 49 - "meeting-intel.tsx"
Cohesion: 0.26
Nodes (12): describeDeadlineImport(), deadlineCsvInput, DeadlineImportPreview, DeadlineImportPreviewRow, DeadlineImportResult, importDeadlineCsvRows(), loadTasks(), planImport() (+4 more)

### Community 53 - "meeting-panels.tsx"
Cohesion: 0.06
Nodes (60): AroundTheTablePanel(), PlannerWithNotesHandoff(), PlanTheMeetingPanel(), broadcastPanelPrefs(), DensityToggle(), EMPTY_OPEN_MAP, EmptyFilterState(), FilterBar() (+52 more)

### Community 54 - "meeting-list.tsx"
Cohesion: 0.05
Nodes (71): MiniCalendar(), escapeRegExp(), MentionText(), MentionUser, CardQuickMenu(), dayFmt, dayLabel(), groupByDay() (+63 more)

### Community 55 - "notes.ts"
Cohesion: 0.06
Nodes (58): MentionTextarea(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+50 more)

### Community 57 - "Meeting Attendee Recommender — Design Spec (sub-project A)"
Cohesion: 0.05
Nodes (37): 1. SCHEDULING (stateless, in the new-meeting form), 2. PRE-MEETING (persisted review on an upcoming meeting), 3. RETROSPECTIVE (organizer-private, past meetings), 4. SERIES (drift over inferred recurring series), A1 — Gemini agenda-topic relevance (the AI scoring component)  — 10 max — 10% of the ledger, and it can never make anyone required by points, AI component (A1), AI override bounds, Degradation (+29 more)

### Community 59 - "note-timeline.tsx"
Cohesion: 0.15
Nodes (9): Board(), metadata, PerAppLoad(), SeriesLoadTable(), WeeklyLoadTable(), PerAppLoadRow, SeriesTableRow, WeeklyLoadRow (+1 more)

### Community 61 - "app-health.ts"
Cohesion: 0.07
Nodes (46): AppDetailPage(), SPRINT_STATUS_LABEL, SPRINT_STATUS_VARIANT, TABS_NEEDING_USERS, SprintProgress, listAppComments(), AppComments(), DeleteAppCard() (+38 more)

### Community 62 - "@vercel/blob"
Cohesion: 0.11
Nodes (37): cannotSay(), Figure, FigureBasis, FigureUnit, inferred(), isSuppressed(), measured(), median() (+29 more)

### Community 63 - "history-views.tsx"
Cohesion: 0.09
Nodes (29): commands, today(), commands, commands, commands, EMPTY_SCOPE, commands, EMPTY_SCOPE (+21 more)

### Community 67 - "meeting-prep.tsx"
Cohesion: 0.05
Nodes (41): Admin RBAC, Change Requests and Coverage Implementation Plan, Decisions this plan is built on, Execution, File structure, Global Constraints, Self-review, Task 10: The admin shell, Task 11: The eight sections (+33 more)

### Community 68 - "calendar-view.ts"
Cohesion: 0.13
Nodes (37): clampPxPerHour(), addCalendarMonths(), CALENDAR_VIEWS, calendarUrlPatch(), CalendarView, endOfMonthIso(), isCalendarView(), isIsoDate() (+29 more)

### Community 78 - "browse.ts"
Cohesion: 0.10
Nodes (41): AppsPage(), metadata, AppTaskCounts, summarizePortfolio(), activityMs(), APP_RISK_FILTERS, APP_SORTS, APP_STATUS_FILTERS (+33 more)

### Community 79 - "board.tsx"
Cohesion: 0.12
Nodes (30): activeFilterCount(), BoardFilters, boardSummary, BoardTask, BoardView, boardViewPatch(), dropIndexIn(), EMPTY_FILTERS (+22 more)

### Community 80 - "Google OAuth verification — LogPup"
Cohesion: 0.07
Nodes (27): This is NOT the Next.js you know, 0. The one shortcut worth checking first, 1. Prerequisites, 1. "The website of your home page URL is not registered to you", 2. Public URLs the reviewer will open, 2. "Your home page does not explain the purpose of your app" — FIXED IN CODE, 3. App logo, 3. "The app name 'log-pup' does not match the app name on your home page" (+19 more)

### Community 81 - "add-to-calendar.tsx"
Cohesion: 0.15
Nodes (21): RFC-6868, GET(), paramsSchema, sequenceFor(), RFC-5545, buildIcs(), CalendarLinkInput, escapeIcsText() (+13 more)

### Community 82 - "followups.ts"
Cohesion: 0.05
Nodes (55): MarkdownLite(), renderInline(), DateTimeWheelField(), roundUpToStep(), MeetingAiNotesView, NextMeetingSuggestion, TaskSuggestionView, ActionItemActions (+47 more)

### Community 83 - "dashboard-zones.tsx"
Cohesion: 0.12
Nodes (28): BulkNouns, BulkOutcome, BulkReport, bulkResultTone(), BulkSkip, csvCell(), csvFilename(), CsvValue (+20 more)

### Community 84 - "page.tsx"
Cohesion: 0.08
Nodes (60): AdminHolidaysPage(), CalendarZone(), closedStudioDays(), firstParam(), isRealDay(), LogZone(), maxIso(), metadata (+52 more)

### Community 85 - "page.tsx"
Cohesion: 0.08
Nodes (26): dateFmt, durationLabel(), fileDateFmt, generateMetadata(), MeetingPrintPage(), msToClock(), PillTone, readParam() (+18 more)

### Community 86 - "meetings-month-calendar.tsx"
Cohesion: 0.14
Nodes (21): MeetingDetailDialog(), ChipFace(), chipLabel(), chipTone(), Entry, MeetingChip(), MeetingsMonthCalendar(), ReschedulePatch (+13 more)

### Community 87 - "task-intent.ts"
Cohesion: 0.13
Nodes (23): fuzzyMatches(), levenshtein(), similarity(), addDays(), AT_ANYWHERE, BANG_PRIORITY, extractApp(), extractDue() (+15 more)

### Community 88 - "history-params.ts"
Cohesion: 0.08
Nodes (40): metadata, TeamCapacityHistoryPage(), InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput() (+32 more)

### Community 89 - "allocation-history.ts"
Cohesion: 0.08
Nodes (30): attendanceAsOf, AttendanceChange, AttendanceEntry, AttendanceEntryInput, AttendanceHistoryRow, AttendanceResponse, FEB, JAN (+22 more)

### Community 90 - "attendee-score.ts"
Cohesion: 0.09
Nodes (26): AiRelevanceEvidence, AttendanceEvidence, Caveat, CaveatTemplate, caveatTemplateByCode, DiscussionEvidence, e1Recency(), escapeRegExp() (+18 more)

### Community 91 - "action-item-board.tsx"
Cohesion: 0.09
Nodes (26): NoteWithAppTags(), CatchUpGap, CatchUpPanel(), PercentSuggestion, SCORE_PRESETS, WorklogForm(), DayFormFields, dayFormProblem() (+18 more)

### Community 92 - "iso-day.ts"
Cohesion: 0.21
Nodes (13): chunkForSpeech(), cutAt(), effectiveSpeechLength(), rawLimitFor(), sinhalaFraction(), toSpokenText(), truncateForSpeech(), DayGlance (+5 more)

### Community 93 - "Global Constraints"
Cohesion: 0.07
Nodes (27): Departures from the plan, each deliberate, Design constraints carried from the spec (non-negotiable — do not soften), Global Constraints, Grounding corrections (read before Task 1), Meeting Load Reduction (B) Implementation Plan, Open questions for the human, Outcome — SHIPPED 2026-08-21, Still not live, and why (+19 more)

### Community 94 - "Gemini Live streaming transcription — design"
Cohesion: 0.08
Nodes (23): 0. What I could and could not verify, 10. Open items, 1.1 How audio is metered, 1.2 Rate limits — Google stopped publishing the free-tier table, 1.3 Published pricing (paid tier, per 1M tokens, audio input), 1.4 Live API session mechanics, 1.5 Transcription-only configuration (the important one), 1.6 Ephemeral tokens (+15 more)

### Community 95 - "page.tsx"
Cohesion: 0.11
Nodes (36): AppsSection(), MatrixSection(), metadata, ProgressPage(), daysRemaining(), sprintProgress(), noon(), ProgressFilters() (+28 more)

### Community 96 - "attendee-score.test.ts"
Cohesion: 0.10
Nodes (21): CandidateFacts, CAVEAT_TEMPLATES, CaveatCode, REASON_TEMPLATES, ReasonCode, ScoreContext, ScoredCandidate, BANNED_PHRASES (+13 more)

### Community 97 - "page.tsx"
Cohesion: 0.04
Nodes (80): Button(), Command(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), Dialog() (+72 more)

### Community 98 - "live.test.ts"
Cohesion: 0.11
Nodes (23): liveMeetingsAs(), MEETING_CHILD_TABLES, SOFT_TABLES, ALIAS_RE, ALLOWLIST, allowlistSet, bodyBraceIndex(), check4MatchIndexes() (+15 more)

### Community 99 - "client.ts"
Cohesion: 0.11
Nodes (24): AiCallSlug, shouldUseInlineAudio(), getAiBudget, buildAudioPart(), buildImagePart(), callGeminiCore(), callGeminiSpeech(), extractInlineAudio() (+16 more)

### Community 100 - "meeting-intent.ts"
Cohesion: 0.19
Nodes (15): addDays(), extractApp(), extractDay(), extractDuration(), extractTime(), MeetingIntent, MeetingPerson, parseMeetingIntent() (+7 more)

### Community 101 - "Metrics"
Cohesion: 0.10
Nodes (20): Agenda-field and app-field usage (drill-down columns only), Assumptions (delegated decisions — veto here), Goal, In-app RSVP adoption (DEMOTED — was 'pending-RSVP cost'), Invited hours per week (headline — renamed from attendee-hours), Meeting Load Reduction — Design Spec (sub-project B), Metrics, Observed change since decision (REPLACES 'hours saved to date') (+12 more)

### Community 102 - "page.tsx"
Cohesion: 0.10
Nodes (41): ActivityControls(), ActivityDescription(), ActivityPage(), ActivityPageParams, ActivityTrailSection(), colomboDayEnd(), colomboDayStart(), metadata (+33 more)

### Community 103 - "webauthn-actions.ts"
Cohesion: 0.08
Nodes (33): glanceFromIntel(), AttendeeRef, CarriedForwardEntry, CarriedForwardGroup, decideFollowupResolutionOnTaskStatusChange(), DerivedFollowupRow, FollowupKind, FollowupMatchCandidate (+25 more)

### Community 104 - "Direct-manipulation browser verification"
Cohesion: 0.11
Nodes (18): Attempted unblock — refused, correctly, Blocked — NOT TESTED, Confession: one real meeting was moved and restored, Defect: rows could never be moved DOWN (keyboard or mouse), Defect: Space-to-lift never worked on task cards, Dev database is two migrations behind — this blocked everything initially, Direct-manipulation browser verification, Environment findings (before any UI test) (+10 more)

### Community 105 - "sprint-checkins.tsx"
Cohesion: 0.13
Nodes (20): generateMetadata(), PersonDetailPage(), personId, MyDayZone(), TASK_TILES, firstName(), PersonFollowupsCard(), PersonMeetingsCard() (+12 more)

### Community 106 - "person-stats.ts"
Cohesion: 0.07
Nodes (38): AdminApprovalsPage(), listRecentActivity, getApprovalsInbox(), getMyRequests(), InboxRequest, select, toInbox(), listPendingUsers (+30 more)

### Community 107 - "actions.ts"
Cohesion: 0.04
Nodes (100): AdminAppsPage(), AdminBugsPage(), DangerControls(), AdminInsightsPage(), AdminLayout(), HandoverPage(), AdminRatesPage(), askAuditFilters() (+92 more)

### Community 108 - "meetings-day-rail.tsx"
Cohesion: 0.06
Nodes (50): CohortData(), DirectoryData(), PeoplePage(), FilterableProject, filterSortProjects(), matchesQuery(), matchesRole(), PROJECT_SORT_LABEL (+42 more)

### Community 109 - "mention-match.ts"
Cohesion: 0.16
Nodes (17): ActiveMention, classify(), compare(), findMentionQuery(), matchMentions(), MENTION_QUERY_RE, MentionCandidate, MentionMatchKind (+9 more)

### Community 110 - "use-screen-keyframes.ts"
Cohesion: 0.24
Nodes (11): MeetingScreenshotView, ScreenFilmstrip(), encodeFrame(), hashOfFrame(), ScreenKeyframesHandle, useScreenKeyframes(), computeDHash(), computeDownscaledDimensions() (+3 more)

### Community 111 - "calendar-grid.ts"
Cohesion: 0.15
Nodes (19): queueFilterHref(), TriageQueue(), liveBugReports, TriageQueuePager(), assignee, bugColumns, BugQueueRow, getOpenBugCounts() (+11 more)

### Community 112 - "meeting-notes-model.ts"
Cohesion: 0.18
Nodes (7): {
  actorMock,
  canMock,
  logActivityMock,
  callGeminiMock,
  getAiPrefsMock,
  aiDisabledMock,
  resolveChainMock,
  sessionUserMock,
  approvedAbsenceDaysMock,
  workScheduleMock,
  orgHolidayDaysMock,
  joinDayMock,
  commitEvidenceMock,
}, insertCalls, Row, rowsByTable, selectCalls, SelectNode, updateCalls

### Community 113 - "text-replace.ts"
Cohesion: 0.21
Nodes (16): applyReplacements(), diffSingleWord(), editDistance(), findOccurrences(), FindOptions, fuzzyBudget(), groupOccurrences(), isWordChar() (+8 more)

### Community 114 - "task-card.tsx"
Cohesion: 0.14
Nodes (23): DayHoursCard(), editableDuration(), EditDraft, EMPTY_HIDDEN, observationKey(), rowFields(), CATEGORY_LABEL, accountedFraction() (+15 more)

### Community 115 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, db:drift, db:generate, db:migrate, db:status, dev, e2e (+7 more)

### Community 116 - "sidebar.tsx"
Cohesion: 0.31
Nodes (7): activityNavItem, adminNavItems, getVisibleNavItems(), NavItem, navItems, progressNavItem, settingsNavItem

### Community 117 - "types.ts"
Cohesion: 0.14
Nodes (20): ActivityFeed(), ActivityTrail(), AppChip(), DayMarker(), FlatRow(), graphemes, initialOf(), RailNode() (+12 more)

### Community 118 - "app-activity.tsx"
Cohesion: 0.19
Nodes (17): externalBaseUrl(), ExternalTask, ExternalTaskRow, serializeTask(), input, isFrozen(), PATCH(), readTask() (+9 more)

### Community 119 - "LiveTranscriptionSession"
Cohesion: 0.14
Nodes (22): LiveTranscriptionCostNotice(), LiveTranscriptionStatus(), STATUS_COPY, LiveTranscriptionHandle, useLiveTranscription(), LiveCallbacks, LiveSessionOptions, LiveStatus (+14 more)

### Community 120 - "Changes"
Cohesion: 0.12
Nodes (15): 1. Provisional rendering — the vanishing phrase (defect 1), 2. The pairing window (defect 2), 3. Script-aware interim leader (defect 3), 4. Concurrency probe, and never claiming dual (defect 4), 5. Restart gap (defect 5), 6. Honest degradation for si-LK (browser reality), 7. Bug found while implementing: the last utterance was dropped, Changes (+7 more)

### Community 121 - "Speaker identification from the meeting record"
Cohesion: 0.12
Nodes (15): Architecture, Data model, Decisions, Migration 0033, Out of scope, Refusal rules, Risks, Speaker identification from the meeting record (+7 more)

### Community 122 - "attendee-series.ts"
Cohesion: 0.11
Nodes (17): sameSeries(), SeriesCandidate, CADENCE_RE, CADENCE_WORDS, MONTHS, NON_WORD_RUN_RE, PURPOSE_RE, PURPOSE_SPELLINGS (+9 more)

### Community 123 - "language-switch.ts"
Cohesion: 0.21
Nodes (12): ActiveLanguage, containsSinhala(), countMatches(), estimateSpokenUnits(), InterimLeaderInput, isRestartStorm(), isSilentSinhalaFallback(), pickInterimLeader() (+4 more)

### Community 124 - "now.ts"
Cohesion: 0.23
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
Cohesion: 0.09
Nodes (34): AskTaskRow, checkinAskContext(), checkinAskText(), isPastDue(), overdueAskText(), OverdueRow, overdueRowsByUserApp(), plural() (+26 more)

### Community 129 - "Meeting Intel Panel Redesign — Design Spec"
Cohesion: 0.14
Nodes (13): Accessibility, Attribution language (consistent with 0021_attribution_membership), Avoided defaults, Bilingual treatment, Carried forward actions, Diagnosis of current UI (screenshot 2026-08-12), Meeting Intel Panel Redesign — Design Spec, Out of scope (+5 more)

### Community 130 - "App-wide Soft Deletes — Design Spec (sub-project D)"
Cohesion: 0.14
Nodes (13): App-wide Soft Deletes — Design Spec (sub-project D), Assumptions (delegated decisions — veto here), Cascade rule, External cleanup (Blob / Google Calendar / notifications), Mechanism, One flagged exception requiring your attention, Query safety, Rejected (+5 more)

### Community 131 - "queries.ts"
Cohesion: 0.13
Nodes (24): MeetingApp, cursorInput, dayInput, fetchMeetingsForDay(), fetchMeetingsForRange(), fetchOlderPast(), rangeInput, NextMeetingDescription (+16 more)

### Community 132 - "live-transcription-status.tsx"
Cohesion: 0.09
Nodes (27): webauthnLoginTokens, PasskeyLoginButton(), beginPasskeyLogin(), beginPasskeyRegistration(), completePasskeyLogin(), completePasskeyRegistration(), PasskeySummary, relyingParty() (+19 more)

### Community 133 - "live-token.ts"
Cohesion: 0.09
Nodes (34): AliasedApp, findAbsence(), findMarkers(), groupMarkers(), Marker, MarkerGroup, MONTHS, readCatchUpTextOffline() (+26 more)

### Community 134 - "task-workload.ts"
Cohesion: 0.14
Nodes (21): normalizeHeader(), buildHeaderIndex(), buildHeaderIndex(), DEADLINE_CSV_COLUMNS, DEADLINE_CSV_EXAMPLE_ROW, DEADLINE_CSV_HEADERS, DeadlineCsvColumn, DeadlineCsvColumnSpec (+13 more)

### Community 135 - "use-live-transcription.ts"
Cohesion: 0.10
Nodes (34): ProgressAppsLaneSkeleton(), compactCoverage(), formatMinutes(), initials(), LEGEND_STATES, mixTitle(), noon(), num() (+26 more)

### Community 136 - "Global Constraints"
Cohesion: 0.17
Nodes (11): Global Constraints, Meeting Attendee Recommender (A1) Implementation Plan, Task 1: Schema, migration, and `optional` plumbing, Task 2: `seriesKey` — pure series inference, Task 3: Agenda topic buckets and app matching, Task 4: The scorer — `attendee-score.ts`, Task 5: Validator, redaction projector, and reasons merge, Task 6: Fact gathering, orchestrator, and server actions (+3 more)

### Community 137 - "Unified Roadmap — design"
Cohesion: 0.05
Nodes (35): Global Constraints, Roadmap Surface Redesign Implementation Plan, Self-Review, Task 1: Schedule mode, parsed from the URL, Task 2: The shared short day-count label, Task 3: The sprint header (band 2), Task 4: Recompose the page into four bands, Task 5: Toolbar — stat row out, scope line and segmented control in (+27 more)

### Community 138 - "buttonVariants"
Cohesion: 0.12
Nodes (27): bugSeverity, bugStatus, BugBadgeVariant, BugSeverity, bugSeverityBadgeVariant(), bugSeverityLabel(), BugStatus, bugStatusBadgeVariant() (+19 more)

### Community 139 - "actions.ts"
Cohesion: 0.16
Nodes (23): AdminTrashPage(), buildAppTrashRow(), buildAssignmentTrashRow(), buildBugTrashRow(), buildKeyframeTrashRow(), buildMeetingTrashRow(), buildPersonTrashRow(), buildSegmentTrashRow() (+15 more)

### Community 140 - "plan-read.ts"
Cohesion: 0.13
Nodes (28): appHealth, AppHealthInput, AppSprintSnapshot, completionPct(), dayDiff(), daysSince(), HEALTH_LABEL, HealthLevel (+20 more)

### Community 141 - "active-sprints.tsx"
Cohesion: 0.60
Nodes (3): FirstLogNudgeBanner(), FirstLogNudge(), countMyWorklogDays()

### Community 142 - "task-rank.ts"
Cohesion: 0.35
Nodes (9): compareRanked(), InsertPlan, needsRebalance(), neighboursAt(), planInsert(), rankBetween(), Ranked, rankForAppend() (+1 more)

### Community 143 - "live-client.ts"
Cohesion: 0.10
Nodes (19): 10. Phasing, 1. Goal, 2. Architecture, 3. Data model — migration `0071_knowledge_index`, 4.1 Drafts, 4.2 Reindex, 4.3 Hook and explicit calls, 4.4 Nightly reconcile — `notify-tick` step 4 (+11 more)

### Community 144 - "page.tsx"
Cohesion: 0.28
Nodes (17): buildSignals(), capacitySignals(), clip(), compareSignals(), dayOf(), mergeableMeetingSignal(), nameFor(), overdueTaskSignal() (+9 more)

### Community 145 - "queries.ts"
Cohesion: 0.14
Nodes (24): NAMEY, aggregateSuggestions(), ALLOWED_OCCURRENCE_KEYS, AnalyzedOccurrence, coverage(), inviteJaccard(), median(), oneDecimal() (+16 more)

### Community 146 - "capacity-card.tsx"
Cohesion: 0.13
Nodes (29): AiZone(), AiFeatureDef, AiFeatureEstimate, AiFeatureId, AiFeatureShape, BY_SLUG, estimatePerUseCostUsd(), FALLBACK_MODEL_CHOICES (+21 more)

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
Cohesion: 0.10
Nodes (29): ProfilePage(), formatBuildStamp(), metadata, SettingsPage(), roleLabel(), getOwnAvatarUrl(), getOwnGithubLogin(), getOwnPhone() (+21 more)

### Community 156 - "MeetingForm"
Cohesion: 0.14
Nodes (28): ActivityFilterBar(), CoverageZone(), buildGrounding(), entryLines(), fit(), GroundingEntry, GroundingSection, GroundingSource (+20 more)

### Community 157 - "text-replace-actions.ts"
Cohesion: 0.11
Nodes (21): isHydrated(), markHydrated(), MotionProvider(), Reveal(), RevealProps, RouteTransition(), MOTION_TAGS, MotionTag (+13 more)

### Community 158 - "roadmap-geometry.ts"
Cohesion: 0.42
Nodes (8): addDays(), daysFromOffset(), diffDaysInclusive(), parseIsoDate(), resizeEnd(), resizeStart(), shiftRange(), toIsoDate()

### Community 159 - "use-smart-poll.ts"
Cohesion: 0.12
Nodes (26): MaintenanceControls(), asMs(), asText(), atLocalTime(), autoMessage(), dayFormatter(), defaultWindow(), EXTEND_STEPS (+18 more)

### Community 160 - "agenda-topics.ts"
Cohesion: 0.31
Nodes (8): AgendaTopicMatch, escapeRegExp(), findEarliestKeywordMatch(), matchAgendaTopic(), normalizeRoleToken(), GENERIC_KEYWORD_DENYLIST, TOPIC_BUCKETS, TopicBucket

### Community 161 - "Meeting keyframe proxy route — report"
Cohesion: 0.20
Nodes (9): Authorization matrix (`keyframe-access.test.ts`), Commit, Concerns / follow-ups (none blocking), How the admin exception was handled, Meeting keyframe proxy route — report, Path/pathname handling, Verification, What was built (+1 more)

### Community 162 - "search.ts"
Cohesion: 0.22
Nodes (15): buildModelCatalog(), classifyModel(), compareModels(), labelFor(), modelIdFrom(), PAID_TIER_ONLY, RawGeminiModel, stabilityOf() (+7 more)

### Community 163 - "recording-segments.ts"
Cohesion: 0.08
Nodes (30): orgHolidays, SchedulePattern, workSchedules, CoverageFigure(), allocatedHours(), hoursForFraction(), hoursLoad, round1() (+22 more)

### Community 164 - "person-tasks-card.tsx"
Cohesion: 0.19
Nodes (15): approveChangeRequest(), createChangeRequest(), createInput, leadIdFor(), notifyDecision(), notifyFiled(), rejectChangeRequest(), reviewInput (+7 more)

### Community 165 - "/activity real search — implementation report"
Cohesion: 0.22
Nodes (8): /activity real search — implementation report, Browser verification, Files touched (all within assigned scope), Layer 1 — SQL condition shape (`activitySearchCondition`, in `filters.ts`), Layer 2 — pure TS contracts (`search.ts`), Page wiring (`src/app/(app)/activity/page.tsx`), UI (`activity-filter-bar.tsx`), Verification

### Community 166 - "Google integration — two-bug report"
Cohesion: 0.22
Nodes (8): Bug 1 — profile pictures fall back to initials, Bug 2 — "A Google Meet room will be created … needs your Google Calendar connection", Files changed, Google integration — two-bug report, The actual bug, found by a live test against a real refresh token, User action required — nothing else in the code can fix this, Verification, What was already correct (do not re-fix)

### Community 167 - "LogPup Development"
Cohesion: 0.22
Nodes (8): Explore before editing, LogPup Development, Migrations — the trap list, Multi-session coordination, Product decisions already made (don't relitigate), Speech / TTS, Still OPEN — ask the user, don't assume, Verification — when a rung is broken, not failing

### Community 168 - "Dashboard Redesign + Activity Trail — Design Spec"
Cohesion: 0.25
Nodes (7): 1. Dashboard layout (`/`), 2. Activity trail (`activity_log`), 3. Errors & performance, 4. Testing, Dashboard Redesign + Activity Trail — Design Spec, Decisions (from brainstorm), Out of scope

### Community 169 - "print-masthead-edit.tsx"
Cohesion: 0.16
Nodes (24): better(), Candidate, compareAsks(), COVER_ASK_KINDS, CoverageGroup, coverageHeadline(), CoverageInput, CoveragePlan (+16 more)

### Community 170 - "page.tsx"
Cohesion: 0.22
Nodes (7): metadata, SECTIONS, LEGAL_PROSE, TableOfContents(), TocSection, metadata, TERMS_SECTIONS

### Community 171 - "segment-store.ts"
Cohesion: 0.08
Nodes (52): CostFigure(), hours(), money(), ProjectFinanceCard(), shiftDays(), addMonthsIso(), CostableAttributedEntry, CostableEntry (+44 more)

### Community 172 - "Merge report: `main` → `feat/soft-deletes`"
Cohesion: 0.25
Nodes (7): Commit, Gates, Merge report: `main` → `feat/soft-deletes`, Per-file table (key files from the original merge, `5baa0ef`), Things I was unsure about / flagging for visibility, TL;DR, What I verified, and why I believe it's right

### Community 173 - "encodeAudioChunk"
Cohesion: 0.71
Nodes (5): bytesToBase64(), downsampleTo(), encodeAudioChunk(), floatTo16BitPCM(), int16ToLittleEndianBytes()

### Community 174 - "dedupe.ts"
Cohesion: 0.24
Nodes (10): clock, DayEntryRow, dayWindow(), DrafterContext, EvidenceMeeting, formatMinutes(), loadDayEvidence(), meetingsAttended() (+2 more)

### Community 175 - "LogPup mobile usability audit"
Cohesion: 0.29
Nodes (6): Already good (do not churn these in the fix pass), Findings table, LogPup mobile usability audit, Summary, Systemic patterns (fix once, not N times), Top 10 by impact (fix these first)

### Community 176 - "models.ts"
Cohesion: 0.21
Nodes (10): PUBLIC_DIR, RateHit, REPO_ROOT, GEMINI_MODEL_FALLBACK_ORDER, ANALYSIS_MODELS, ASSISTANT_MODELS, QUICK_MODELS, SYNTHESIS_MODELS (+2 more)

### Community 177 - "project-roles.ts"
Cohesion: 0.13
Nodes (18): managesApp(), heldRoles(), DraftActivity, DraftProjectRole, ROLE_PHRASE, activity, buildEntrySuggestions(), dedupe() (+10 more)

### Community 178 - "generate-changelog.mjs"
Cohesion: 0.29
Nodes (5): data, KINDS, out, root, versions

### Community 179 - "loading.tsx"
Cohesion: 0.05
Nodes (25): money(), PeopleZone(), ProjectsZone(), shift(), PersonRatesZone(), ProjectValueZone(), RoleRatesZone(), CardSkeleton() (+17 more)

### Community 180 - "setOwnPassword"
Cohesion: 0.05
Nodes (60): PendingPage(), approveUserInput, clearTestData(), createUser(), createUserInput, dbClearEnabled(), duplicateUserMessage(), employmentInput (+52 more)

### Community 181 - "google-one-tap.ts"
Cohesion: 0.50
Nodes (4): GoogleIdentity, TokenInfo, VALID_ISSUERS, verifyGoogleIdToken()

### Community 182 - "meeting-pip.tsx"
Cohesion: 0.36
Nodes (8): adoptStyles(), clock(), DocumentPipHost, MeetingPip(), PipBody(), pipHost(), readAutoPref(), writeAutoPref()

### Community 183 - "drizzle/ migrations"
Cohesion: 0.50
Nodes (3): 2026-08-12: migration ledger was out of sync with the database, drizzle/ migrations, Rule going forward

### Community 184 - "check-migrations.mjs"
Cohesion: 0.67
Nodes (3): expectedTables(), main(), root

### Community 185 - "set-user-personal-email.test.ts"
Cohesion: 0.13
Nodes (19): APP_REQUESTABLE_COLUMNS, APP_REQUESTABLE_FIELDS, asIsoDate(), asTaskStatus(), buildApplyStatement(), buildTaskDeadlineSet(), buildTaskStatusSet(), SUPPORTED_ENTITY_TYPES (+11 more)

### Community 187 - "board-skeleton.tsx"
Cohesion: 0.15
Nodes (16): buildMyDayStats(), MyDayInput, plural(), QUIET, QUIET_TASKS, RING_TONE, VALUE_TONE, allocationMeta() (+8 more)

### Community 188 - "isLiveTranscriptionEnabled"
Cohesion: 0.09
Nodes (35): splitCsvRows(), BUG_CSV_COLUMNS, BUG_CSV_EXAMPLE_ROW, BUG_CSV_HEADERS, BugCsvColumn, BugCsvColumnSpec, bugCsvFields, BugCsvParse (+27 more)

### Community 190 - "schema.ts"
Cohesion: 0.23
Nodes (11): AskCitation, AnswerSegment, DETAIL_LABEL, findLabelNearEnd(), pushText(), readableLabel(), SECTION_LABEL, splitAnswerLinks() (+3 more)

### Community 193 - "@notionhq/client"
Cohesion: 0.14
Nodes (29): CHECKED_CHANNELS, corroborateDay(), corroborateRange(), CorroborationSummary, DayCorroboration, DayInput, DayVerdict, findQuietRuns() (+21 more)

### Community 195 - "@simplewebauthn/server"
Cohesion: 0.11
Nodes (21): totalMinutes(), AttendedMeeting, CHECK_THRESHOLDS, CheckEntry, DayEvidence, findDiscrepancies(), hoursPhrase(), hrs() (+13 more)

### Community 198 - "ANALYSIS_MODELS"
Cohesion: 0.07
Nodes (28): 1. Every figure the four families need, and who produces it, 1a. Delivery, 1b. People load & coverage, 1c. Meeting follow-through, 1d. Project health rollup, 2.10 `NEAR_CAPACITY_PCT` is honoured in one place and re-typed in another, 2.11 "Over capacity" is decided in three places, 2.12 Live allocation and historical allocation come from different tables (+20 more)

### Community 199 - "2. Every reader of `meetings.appId`, and what it becomes"
Cohesion: 0.07
Nodes (27): 1. The join table, 2.1 The type everything hangs off, 2.2 Query sites, 2.3 Permission gates — the ones that must not be got wrong, 2.4 Write sites, 2.5 `src/features/meetings/search-providers.ts` — the LIMIT bug, 2.6 UI sites, 2.7 AI / intel sites (`src/features/meetings/ai-actions.ts`) (+19 more)

### Community 200 - "route.ts"
Cohesion: 0.06
Nodes (38): GET(), isAuthorized(), nudgeUnloggedDays(), pruneExpiredNotifications(), pruneExpiredSsoRedemptions(), PruneResult, attendanceBaseUrl(), POST() (+30 more)

### Community 201 - "page.tsx"
Cohesion: 0.08
Nodes (23): CAPABILITIES, metadata, AltaVisionLogo(), AccountMenu(), AccountUser, Header(), MobileNav(), useTheme() (+15 more)

### Community 202 - "BUILD ORDER"
Cohesion: 0.07
Nodes (27): BUILD ORDER, Self-review, Task 10: Migration — the two indexes that name only columns that exist today, Task 11: Notification kinds and render-at-read-time text, Task 12: The volume budget and the per-recipient daily cap, Task 13: Dedupe as a storage-layer guarantee, with two semantics, Task 14: Recipient filtering, as a pure decision, Task 15: Migration — the `notifications` columns and the `type`-to-`text` conversion (+19 more)

### Community 203 - "meeting-people-picker-model.ts"
Cohesion: 0.33
Nodes (7): ACTIVITY_ENTITY_TYPES, ACTIVITY_VERBS, AuditNlPatch, auditNlSchema, buildAuditNlPrompt(), current, VERB_VALUES

### Community 204 - "Decisions"
Cohesion: 0.08
Nodes (25): `apps.internal` keeps LogPup's own defects out of client metrics, Bugs are never attributed to a person — including indirectly, Bugs are `tasks.kind = 'bug'` plus a 1:1 satellite — not a `bugs` table, Build order, Committing is one capability; moving a commitment is a different one, Data model, Deadline notifications are kinds and keys, never enum values or sentences, Deadlines and Bugs — Grading the Date, Discriminating the Work — Design (+17 more)

### Community 205 - "Multi-discipline projects — design"
Cohesion: 0.08
Nodes (25): AI, Architecture, Decisions taken, Finance roll-up, Migrations, Multi-discipline projects — design, Note on decision 12, Parallel-session protocol (+17 more)

### Community 206 - "gather.ts"
Cohesion: 0.19
Nodes (12): deadlinesCount(), ModelSegment, OutputCounts, OutputFacts, partitionByModel(), splitOutputs(), groupIntoSeries(), SeriesGroup (+4 more)

### Community 207 - "audit-queries.ts"
Cohesion: 0.12
Nodes (23): AuditControls(), AuditTrailSection(), AuditParamState, colomboDayEnd(), colomboDayStart(), hasAuditFilters(), RawSearchParams, auditConditions() (+15 more)

### Community 208 - "queries.ts"
Cohesion: 0.29
Nodes (8): metadata, FigureCell(), formatFigure(), SignalsHelp(), SignalsView(), unitSuffix(), VERDICT_COPY, PersonSignals

### Community 209 - "ai-engine.ts"
Cohesion: 0.19
Nodes (14): AttendanceEvent, newEventId(), postEventsToAttendance(), warned, warnOnce(), AssignmentInput, AssignmentNotice, buildAssignmentNotice() (+6 more)

### Community 210 - "ask-panel.tsx"
Cohesion: 0.12
Nodes (16): Final verify (after every task, before the recap), Owner: `components`, Owner: `page`, Owner: `queries`, Plan — The Rates Desk (/admin/rates), Task 10 — ⌘K row, and retiring the exemption, Task 11 — README, Task 1 — amount-leak guard over all five rate actions (+8 more)

### Community 211 - "task-composer.tsx"
Cohesion: 0.16
Nodes (17): PasteRow, PasteState, shortDue(), TaskComposer(), ComposerPlan, planFor(), PEOPLE, TODAY (+9 more)

### Community 212 - "escalation.ts"
Cohesion: 0.15
Nodes (17): GradedPromise, gradePromises(), MONTHS, PromiseRow, promisesSummary(), shortDate(), slipLineFor(), STEP_RANK (+9 more)

### Community 213 - "Part A — Foundation"
Cohesion: 0.09
Nodes (21): A1. Usage ledger, A2. Pricing module, A3. Key sharing (org pool), A4. Free/paid key tier, A5. Settings AI hub, A6. Admin feature-adoption panel, A7. Migrations, AI Everywhere — usage ledger, key economy, settings hub, and feature waves (+13 more)

### Community 214 - "Decisions"
Cohesion: 0.09
Nodes (21): Build order, Check 6 — the owner predicate is enforced by a file scan, Data model, Decisions, Error handling, ⌘K stops dead-ending, Migrations, `/my-day` is a read. It owns no status. (+13 more)

### Community 215 - "sidebar-store.ts"
Cohesion: 0.17
Nodes (21): nextSidebarState(), resolveSidebarState(), sidebarCommandLabel(), SidebarState, sidebarToggleLabel(), Sidebar(), SidebarToggle(), getServerSnapshot() (+13 more)

### Community 216 - "queries.ts"
Cohesion: 0.17
Nodes (18): appendTurn(), capBytes(), ChatCitation, ChatTurn, isTurn(), parseChat(), serializedBytes(), AnswerBody() (+10 more)

### Community 217 - "recurrence.ts"
Cohesion: 0.26
Nodes (14): AppMatch, AppMatchHow, appPromptLine(), appVocabulary(), containsWord(), deriveAcronyms(), escape(), matchApp() (+6 more)

### Community 218 - "Decisions"
Cohesion: 0.10
Nodes (20): A mention that cannot be delivered is recorded and reported, never dropped, Assignment is an offer, recorded as a half-open interval, Build order, Data model, Decisions, Decline requires a reason and returns the task to a named person, Error handling, Four relationships, two built, two cut (+12 more)

### Community 219 - "budget-notify.ts"
Cohesion: 0.16
Nodes (17): ConcatenatedSegments, concatenateSegments(), hintTail(), isRetriableSegmentError(), segmentRetryDelayMs(), shouldCutSegment(), TranscribedSegment, afterAttempt() (+9 more)

### Community 220 - "actions.ts"
Cohesion: 0.15
Nodes (19): assertWritable(), FREEZE_EXEMPT_TABLES, gateBatch(), gated, gateWrite(), isExemptTable(), assertWritable, wrap() (+11 more)

### Community 221 - "model-discovery.ts"
Cohesion: 0.29
Nodes (15): daysBetween(), e4e5Recency(), fmtDayMonth(), interpolate(), maxTier(), renderCaveat(), renderReason(), scoreAttendance() (+7 more)

### Community 222 - "entry-actions.ts"
Cohesion: 0.09
Nodes (30): DashboardPage(), greetingFor(), webauthnCredentials, GrantLevel, PasskeyNudgeBanner(), PasskeyNudge(), CHOICES, DashboardViewSwitch() (+22 more)

### Community 223 - "Meeting coverage — R6 COVER-TOGETHER"
Cohesion: 0.11
Nodes (18): §10 answered: R6 shipped first, 10. Open question for the owner, 11. What shipped, and where it differs from this plan, 1. This is a sixth rule, not a sixth page, 2. What this reuses instead of building, 3. The unit of work, and who each one requires, 4. The algorithm, 5. Guards — the reason it does not degenerate (+10 more)

### Community 224 - "Command Center & Universal Search — Registry Design Spec"
Cohesion: 0.11
Nodes (18): A security fix that came with it, Architecture — two planes, one id space, Assumptions (delegated decisions — veto here), Behavior preservation, Command Center & Universal Search — Registry Design Spec, Concurrency, Intentional behavior changes, Keeping it current when a feature is added (the Claude-skills half) (+10 more)

### Community 225 - "Calendar Hardening — Organiser Handover, Full Patch, Classified Failure — Design"
Cohesion: 0.11
Nodes (18): A failure becomes a fact on the row, not a line in a log, Build order, Calendar Hardening — Organiser Handover, Full Patch, Classified Failure — Design, Data model, Decisions, Error handling, `google_calendar_id` ships as a column with no UI, `google_token_status` is written on observation and never guesses (+10 more)

### Community 226 - "Work Signals — measuring what people did, without inventing it"
Cohesion: 0.11
Nodes (18): Architect / reviewer — `isReviewerRole()` over `assignments.role`, Architecture, Deliberately not built, Fairness rules, enforced by tests rather than comments, IC / member, Layer 1 — Observations, Layer 2 — Corroboration, Layer 3 — Role scorecards (+10 more)

### Community 227 - "admin-queries.ts"
Cohesion: 0.17
Nodes (10): MeetingLoadTrend(), average(), ObservedChange, observedChangeFor(), ObservedChangeInput, DECIDED, LoadTrendData, LoadTrendPoint (+2 more)

### Community 228 - "format-instant.ts"
Cohesion: 0.25
Nodes (16): TrailEvent(), AuditRow(), MeetingHeaderActions(), ShareContent(), buildMeetingShareMessage(), mailtoHref(), formatBusinessDate(), formatBusinessDateTime() (+8 more)

### Community 229 - "zones.ts"
Cohesion: 0.26
Nodes (12): fetchMaintenanceWindow(), AUTH_PATHS, Bypass, bypassKey(), canManageMaintenance(), MaintenanceGate(), NEVER_CHANGES(), PRINT_PATHS (+4 more)

### Community 230 - "Global Constraints"
Cohesion: 0.11
Nodes (17): AI Foundation (Phase A) Implementation Plan, Global Constraints, Plan self-review notes (applied), Task 10: Usage summaries and adoption math — TDD, Task 11: Keys card UI — tier, sharing consent, used-by, honest copy, Task 12: Settings AI hub, Task 13: Admin AI adoption panel, Task 14: Entry-point gating + final verification (+9 more)

### Community 231 - "coverage.ts"
Cohesion: 0.22
Nodes (7): cabinet, geistMono, metadata, notoSinhala, satoshi, viewport, Toaster()

### Community 232 - "glance-core.ts"
Cohesion: 0.11
Nodes (21): FollowupRow(), ActionLine(), ActionItemPromoter, ActionItemReconciliation, ActionItemSuggestionRef, ActionOutcome, buildActionList(), createActionItemPromoter() (+13 more)

### Community 233 - "registry.test.ts"
Cohesion: 0.11
Nodes (14): ALL_FEATURE_COMMANDS, ALL_PROVIDERS, CLIENT_FORBIDDEN, commandsRegistrySource, FEATURES, FEATURES_DIR, GATE_PENDING, NO_COMMANDS (+6 more)

### Community 234 - "/activity redesign — implementation report"
Cohesion: 0.11
Nodes (17): 1. Design rationale, 2. The six frontend API concerns, 3. Review lens findings and fixes, 4. Verification output, 5. Files, 6. Open items / follow-ups, /activity redesign — implementation report, Honest constraints respected (+9 more)

### Community 235 - "app-aliases.ts"
Cohesion: 0.21
Nodes (19): dayNumber(), daysInMonth(), expand(), isoFromDayNumber(), isoOf(), monthIndex(), MonthlyMode, nthOfMonth() (+11 more)

### Community 236 - "event-identity.ts"
Cohesion: 0.21
Nodes (13): attendeeOverlap(), canAutoMerge(), CandidateEvent, CandidateMeeting, Identification, identifyEvent(), IdentityReason, IdentityVerdict (+5 more)

### Community 237 - "Recurring meetings"
Cohesion: 0.12
Nodes (15): Compatibility, Constraints discovered, Data model, Decision: materialised occurrences, Edit semantics, Expansion, Google and ICS, Horizon (+7 more)

### Community 238 - "google-calendar.ts"
Cohesion: 0.29
Nodes (8): CountingNumber(), CountingNumberProps, StatNumber(), statTransition, subscribeToReducedMotion(), useStaticNumber(), useIsInView(), UseIsInViewOptions

### Community 239 - "recurrence.ts"
Cohesion: 0.23
Nodes (12): addDays(), at(), describeRecurrence(), ExpandOptions, expandRecurrence(), Frequency, RecurrenceError, RecurrenceRule (+4 more)

### Community 240 - "Activity Trail Redesign — Design Spec"
Cohesion: 0.13
Nodes (14): 10. Tokens and craft, 11. Explicitly avoided defaults, 12. What must not regress, 13. Testing, 1. The page's job, 2. Who reads it, and what decision it serves, 3. What is wrong with the current page, 4. Information hierarchy (+6 more)

### Community 241 - "field-reconcile.ts"
Cohesion: 0.22
Nodes (12): asSet(), AttendeeMerge, FIELD_REASON_SENTENCE, FieldDecision, FieldReason, FieldVerdict, reconcileAttendees(), reconcileMeeting() (+4 more)

### Community 242 - "Motion and Theming — design"
Cohesion: 0.14
Nodes (13): Accessibility, Adopted where, Avoided defaults, Colourways, Contrast, all six ways × both modes, Guards, Known gap, not fixed here, Motion and Theming — design (+5 more)

### Community 243 - "role-history.ts"
Cohesion: 0.23
Nodes (11): appRoleAsOf(), AppRoleEntry, AppRoleEntryInput, AppRoleInterval, AppRoleKind, buildRoleTimeline(), isBackfilled(), FEB (+3 more)

### Community 244 - "app-client.ts"
Cohesion: 0.21
Nodes (14): SignalsPage(), appJwt(), b64url(), commitsByAuthor(), gh(), installationToken(), CommitEvidence, commitPromptLines() (+6 more)

### Community 245 - "actions.ts"
Cohesion: 0.31
Nodes (10): acceptLoadSuggestion(), decide(), decisionInput, deepLinkFor(), dismissLoadSuggestion(), isUniqueViolation(), KINDS, mayDecide() (+2 more)

### Community 246 - "Role-shaped dashboards"
Cohesion: 0.15
Nodes (12): Architecture, Dependencies and sequencing, Division of ownership with the KPI work, Narrow by grant level, never by scope emptiness, Per-role ordering, Role-shaped dashboards, Testing, The idea (+4 more)

### Community 247 - "audit-queries.test.ts"
Cohesion: 0.15
Nodes (9): ADMIN, AUDITOR, BASE, countQueue, distinctQueue, HOSTILE_TAIL, MANAGER, MEMBER (+1 more)

### Community 248 - "File Structure"
Cohesion: 0.17
Nodes (11): File Structure, Global Constraints, Task 1: The seam, Task 2: Pair guard for `people/queries.ts`, Task 3: The `completed_at` transition, Task 4: In-memory predicate sites, Task 5: Drizzle condition builders, Task 6: `sql` template sites (+3 more)

### Community 249 - "Per-feature model choice"
Cohesion: 0.17
Nodes (11): Explicitly out of scope, Feature kinds, Goal, Interaction with the cost display, Per-feature model choice, Resolution — a choice is a preference, never a cliff, Storage, Surfaces (+3 more)

### Community 250 - "Project cost, worth, and effort reporting"
Cohesion: 0.17
Nodes (12): Derived figures, Out of scope, Ownership, `person_rates` — the optional override, Project cost, worth, and effort reporting, `rate_cards` — the base, per job role, Rates, Reconcile before reporting (+4 more)

### Community 251 - "trash-card-logic.ts"
Cohesion: 0.25
Nodes (11): matchesPurgeConfirm(), orderGroupsForDisplay(), restoreDisabledReason(), TRASH_GROUP_ORDER, TRASH_GROUP_TITLES, trashCountFootnote(), rowKey(), TrashCard() (+3 more)

### Community 252 - "UI Intelligence Redesign — design"
Cohesion: 0.18
Nodes (10): Avoided defaults, New primitives (src/components/ui), Non-negotiables carried from repo law, Per-surface fixes (fan-out wave), /progress (new page), Subject and stance, Tokens (additive only — nothing renamed), UI Intelligence Redesign — design (+2 more)

### Community 253 - "Worklog: a calendar, per-task hours, and an AI cross-check"
Cohesion: 0.18
Nodes (10): AI: draft on request, review on save, Coordination — three sessions work in this area, Data model, Goal, Out of scope, Testing, The calendar, The catch-up panel: subsumed, under three binding conditions (+2 more)

### Community 254 - "The Dossier Docket — /meetings list view redesign"
Cohesion: 0.18
Nodes (10): Data contracts (pin these — implementers build to them), Deferred (recorded, not forgotten), File plan, Intel handoff (the Dossier sheet), Page zones (8 pre-list zones become 4), Palette / type / signature, Row anatomy (one fixed anatomy, ~56px desktop / two-line 64px mobile), States (+2 more)

### Community 255 - "sections.ts"
Cohesion: 0.15
Nodes (17): AdminOverviewPage(), MeetingLoad(), AppLayout(), ADMIN_SECTION_ICONS, countPendingApprovals, AdminNav(), NavItem(), ADMIN_SECTIONS (+9 more)

### Community 256 - "recording-progress.ts"
Cohesion: 0.22
Nodes (11): describeTake(), RecordingTakes(), capPercent(), formatRemaining(), meetingProcessing, observedMsPerSegment(), SegmentSnapshot, SegmentState (+3 more)

### Community 257 - "team-csv.test.ts"
Cohesion: 0.27
Nodes (11): TeamPanel(), employmentLabel(), projectPosition(), TEAM_CSV_HEADERS, TeamCsvMember, teamCsvPrefix(), teamCsvRows(), TeamPositions (+3 more)

### Community 258 - "entry-actions.test.ts"
Cohesion: 0.08
Nodes (28): liveNoteSegments, meetingTaskSuggestions, worklogEntries, { authMock, writeSpy, deleteSpy, logActivityMock }, meetingQueue, screenshotQueue, segmentQueue, suggestionQueue (+20 more)

### Community 259 - "App PM/lead history as queryable intervals"
Cohesion: 0.18
Nodes (10): 1. Table shape and its invariant, 2. Backfill and its sentinel, 3. Half-open boundary convention, 4. Write path (`src/features/apps/actions.ts`), 5. Read path, 6. Surfaced in the UI, 7. Verification output, 8. Browser verification (dev server on :3000, reachable) (+2 more)

### Community 260 - "Work-Management Substrate — Scope, Delivery, and the Missing Column — Design"
Cohesion: 0.20
Nodes (10): Build order, Data model, Error handling, Migrations, Out of scope (YAGNI), Pages & flows, Purpose, Testing (+2 more)

### Community 261 - "calendar-overlap.ts"
Cohesion: 0.15
Nodes (12): - [ ] 1a. Pure calendar module, - [ ] 1b. Calendar query module, - [ ] 2a. Toolbar + skeleton (server components, no client JS), - [ ] 2b. Month grid, - [ ] 2c. Day sheet + list view, - [ ] 3. Rewrite the route, - [ ] 4. Review, - [ ] 5. Record (+4 more)

### Community 262 - "live-client.test.ts"
Cohesion: 0.10
Nodes (6): FakeAudioContext, FakeNode, FakeSocket, reconnect(), settle(), TokenFn

### Community 263 - "Self-teaching audit"
Cohesion: 0.22
Nodes (8): 1. Screen-by-screen, 2. Empty states, 3. Controls whose purpose is not readable from the UI, 4. Role differences and what the UI reveals, 5. Places a missed day reads as failure, 6. Ranked fix list, Self-teaching audit, Status — applied 2026-08-19

### Community 264 - "Work movement, role KPIs, and three intake fixes"
Cohesion: 0.22
Nodes (7): Part 5 — Where it all surfaces, Part 6 — Decisions *(answered 2026-08-22)*, Part 7 — Out of scope, Part 8 — Testing, Part 9 — Order of work, The question, Work movement, role KPIs, and three intake fixes

### Community 265 - "Decisions"
Cohesion: 0.22
Nodes (9): Decisions, Dedupe is a storage-layer guarantee, with two semantics, `dismissed_at`, deliberately not `deletedAt`, ⌘K scoping hangs off the seam the command registry already built, Notification text is a key and a parameter bag, never a frozen string, Recipient filtering moves inside `createNotifications`, Scheduling: exactly one cron job, The digest is one email per person per day, and it has preconditions (+1 more)

### Community 266 - "tech-tags-input.tsx"
Cohesion: 0.24
Nodes (14): AuditAsk(), meterOrigin(), MeterOriginSource, useAiMeter(), MeetingAssistant(), SpeakButton(), DictationHandle, useDictation() (+6 more)

### Community 267 - "list-filter.ts"
Cohesion: 0.27
Nodes (8): AppStatus, AppBeforeState, AppChangeNames, AppChangeSummary, appUpdateInput, AppUpdateResult, buildAppUpdate(), summarizeAppChanges()

### Community 268 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Per-Feature Model Choice Implementation Plan, Task 1: Migration — `user_ai_prefs.model`, Task 2: Registry kinds, model catalog, and prices, Task 3: `resolveChain` — TDD, Task 4: Prefs shape, action, and call sites, Task 5: The Select in Settings

### Community 269 - "Work-Management Substrate Implementation Plan"
Cohesion: 0.25
Nodes (6): Decisions this plan is built on, File structure, Global Constraints, The notification volume budget, Toolchain facts this plan relies on, each verified against the tree, Work-Management Substrate Implementation Plan

### Community 270 - "Part 1 — The measurement model"
Cohesion: 0.25
Nodes (8): 1.1 The rule that shapes everything, 1.2 Three measures answer "4 hours and nothing", 1.4 Fairness rules — non-negotiable, applied before any measure, 1.5 Failure modes and gaming — how each measure breaks, M1 · Time with no visible outcome, M2 · Stalled tasks *(the honest per-work version of the same question)*, M3 · Throughput, per project per week, Part 1 — The measurement model

### Community 271 - "activity-levels.ts"
Cohesion: 0.15
Nodes (12): A11y, Capability, Data contracts (pin these — implementers build to them), Day cell anatomy, Day sheet, Deferred (recorded, not forgotten), Palette / type / signature, Registry (+4 more)

### Community 272 - "review-rules.ts"
Cohesion: 0.30
Nodes (12): MaintenanceMount(), readMaintenancePhase(), readMaintenanceRow, readMaintenanceWindow(), announceScheduled(), announceToEveryone(), claim(), runMaintenanceLifecycle() (+4 more)

### Community 273 - "Self-teaching audit — meeting notes & intel"
Cohesion: 0.29
Nodes (6): 1. Panel-by-panel, 2. Ranked fix list, 3. What this surface teaches well, 4. Needs a decision, not code, Self-teaching audit — meeting notes & intel, Verification notes

### Community 274 - "1.3 Role panels"
Cohesion: 0.29
Nodes (7): 1.3 Role panels, Admin / manager, Architect, Engineer / editor / member, Project Manager — `app_role_history.role = 'pm'`, open interval, Stakeholder / auditor, Tech Lead — `app_role_history.role = 'lead'`, open interval

### Community 275 - "Part 4 — Deadline upload for PMs and tech leads"
Cohesion: 0.29
Nodes (7): Columns, Files, Part 4 — Deadline upload for PMs and tech leads, Permission, Template, What, Write rules — these already exist and must be honoured, not reimplemented

### Community 276 - "page.tsx"
Cohesion: 0.15
Nodes (12): Accessibility, Data contracts (pin these — implementers build to them), Deferred (recorded, not forgotten), File plan, Gating (three layers, all the same capability), Page zones, Palette, Section anatomy (identical for all three) (+4 more)

### Community 277 - "mine.ts"
Cohesion: 0.16
Nodes (17): UnreadMentionsPill(), fetchNotificationSnapshot(), NotificationSnapshot, iconFor(), NOTIFICATION_ICONS, NotificationBellClient(), sameSnapshot(), NotificationBell() (+9 more)

### Community 278 - "enforcement.test.ts"
Cohesion: 0.33
Nodes (5): authMock, chain(), deleteSpy, insertSpy, updateSpy

### Community 279 - "key-census.ts"
Cohesion: 0.43
Nodes (4): creditLine(), keyCensus, KeyOwnership, PersonKeyCensus

### Community 280 - "list-search.ts"
Cohesion: 0.38
Nodes (4): filterMeetingsBySearch(), fold(), SearchableMeeting, Row

### Community 281 - "backlog.ts"
Cohesion: 0.13
Nodes (14): Apply the migration **[USER — Claude cannot run this]**, Phase 1a — kill the second manager definition [x] landed, Phase 1b — pass the forgotten Resource [x] landed, Phase 1c — task edit through the matrix [x] landed, Phase 1d — open the routes [x] landed, Phase 1e — surfaces the review found downstream [x] landed, this session, Phase 2 — migration file only [x] landed, Phase 3 — declare and wire the pure half (all dead code, zero behaviour change) [partial] landed as inert code (not wired) (+6 more)

### Community 282 - "2. Commit history (GitHub App)"
Cohesion: 0.33
Nodes (5): 1. Sign-in (OAuth App), 2. Commit history (GitHub App), GitHub setup — sign-in and commit history, What was deliberately not built, Who gets commit evidence

### Community 284 - "churn.ts"
Cohesion: 0.13
Nodes (18): react, react, ShortcutsOverlay(), isMethod(), METHODS, readLastMethod(), rememberSignInMethod(), SignInMethod (+10 more)

### Community 285 - "collisions.ts"
Cohesion: 0.10
Nodes (36): Audit(), YourSeries(), TeamZone(), zoneScope, getAllDecidedKeys(), getAllSuggestionsForAdmin(), getObservedChangesForAdmin(), getSuggestionsForOrganizer() (+28 more)

### Community 286 - "meeting-url.ts"
Cohesion: 0.06
Nodes (66): GET(), isAuthorized(), liveScreenshots, liveSprints, assignmentHistory, meetingScreenshots, sprints, userDeletions (+58 more)

### Community 287 - "visibility.test.ts"
Cohesion: 0.33
Nodes (4): ALLOWLIST, FEATURES_DIR, offenders, readers

### Community 288 - "Part 0 — What the data can and cannot answer"
Cohesion: 0.40
Nodes (5): Available tables, Part 0 — What the data can and cannot answer, Seats, roles, and who is even measurable, The ceiling — read this before designing any measure, The clock

### Community 289 - "Part 3 — Project people as CSV, with names and emails"
Cohesion: 0.40
Nodes (5): Columns, Infrastructure — already built, reuse it, Part 3 — Project people as CSV, with names and emails, Rules, What

### Community 290 - "Part 2 — Ignore the template lines in an uploaded bug report"
Cohesion: 0.40
Nodes (5): Files, Part 2 — Ignore the template lines in an uploaded bug report, Secondary — pasted issue templates, The bug, The rule

### Community 291 - "auto-title.ts"
Cohesion: 0.21
Nodes (14): callModelWithRetry(), backoffDelayMs(), parseRetryAfterMs(), RETRIABLE_STATUSES, shouldRetry(), sleep(), orderKeysForRotation(), recordAiUsage() (+6 more)

### Community 293 - "live-token.test.ts"
Cohesion: 0.50
Nodes (3): { fetchMock, selectRows, updates }, refuse(), respondPerModel()

### Community 294 - "sort-order.ts"
Cohesion: 0.13
Nodes (16): addEveryone(), applyQuickAddAttendees(), applyTeamPrefill(), AttendeeSelection, roster, describeQuickAdd(), emptyState(), hostOf() (+8 more)

### Community 295 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 296 - "check-schema-drift.ts"
Cohesion: 0.67
Nodes (3): declaredTables(), Drift, main()

### Community 297 - "verify-head.mjs"
Cohesion: 0.50
Nodes (3): dir, repo, sha

### Community 299 - "fuzzyMatches"
Cohesion: 0.48
Nodes (5): autoScoreFromHours(), mayAutoScore(), SCORE_SOURCES, ScoreSource, scoreSourceLabel()

### Community 313 - "segment-store.ts"
Cohesion: 0.46
Nodes (7): keyFor(), loadParkedSegments(), openDb(), ParkedSegment, parkSegment(), releaseSegment(), runTransaction()

### Community 314 - "activity-skeleton.tsx"
Cohesion: 0.29
Nodes (8): applyHandover(), applyInput, shareInput, NON_TRANSFERABLE, Share, splitAllocation(), TRANSFERABLE_GROUPS, TransferableGroup

### Community 315 - "task-status.ts"
Cohesion: 0.12
Nodes (5): { rows }, baseReq, { createChangeRequestMock }, Actor, { selectRows }

### Community 316 - "googleapis"
Cohesion: 0.33
Nodes (6): effectiveEnd(), layoutOverlaps(), OverlapEvent, overlapMap(), OverlapPlacement, placementsOf()

### Community 317 - "danger-actions.test.ts"
Cohesion: 0.19
Nodes (16): clipToDay(), DaySegment, dayStartCache, dayWindow, dayWindowCache, hourLabel(), isAllDayMeeting(), isWorkingHour() (+8 more)

### Community 318 - "Project change policy — PM/lead parity + per-project sign-off"
Cohesion: 0.22
Nodes (8): Assumed defaults, Audit findings, Data contracts, Decisions, Deferred, Edge rules, Project change policy — PM/lead parity + per-project sign-off, UI surfaces

### Community 319 - "meter-actions.ts"
Cohesion: 0.16
Nodes (16): Resource, mergeInBatch(), applyDailyCap(), CapOutcome, dailyCapFor(), DedupedRow, dedupeKeyFor(), DedupeSpec (+8 more)

### Community 320 - "actions.test.ts"
Cohesion: 0.32
Nodes (11): deriveBriefing(), entityKey(), joinClauses(), ownClauses(), plural(), priorityFor(), teamClauses(), derive() (+3 more)

### Community 321 - "page.tsx"
Cohesion: 0.12
Nodes (19): hoursLabel(), MeetingsPage(), metadata, WeekSummaryLine(), managedAppIdsFor(), MeetingLoadLink(), MeetingLoadLinkFallback(), GlanceMapContext (+11 more)

### Community 322 - "signal-board.tsx"
Cohesion: 0.16
Nodes (13): bucketOpenTasks(), compareOpenTasks(), DUE_STATE_LABEL, DUE_STATE_ORDER, PersonTaskRow, PersonTaskStatus, summarizeOpenTasks(), TaskBucket (+5 more)

### Community 323 - "activity-levels.ts"
Cohesion: 0.50
Nodes (6): ACTIVITY_THRESHOLDS, activityLevel, activityPeak(), activityTotal(), buildActivitySeries(), getPersonActivity()

### Community 324 - "churn.ts"
Cohesion: 0.53
Nodes (3): inviteChurnBetween(), OccurrenceInvites, seriesChurnCount()

### Community 325 - "meeting-url.ts"
Cohesion: 0.23
Nodes (13): buildConferenceDataRequest(), CALENDAR_ERROR_SENTENCES, CalendarErrorKey, classifyCalendarError(), client(), createCalendarEvent(), deleteCalendarEvent(), describeCalendarError() (+5 more)

### Community 326 - "first-log-nudge.tsx"
Cohesion: 0.47
Nodes (4): CollisionResult, at(), meeting(), WeekMeetingInterval

### Community 329 - "auto-title.ts"
Cohesion: 0.19
Nodes (11): AiAdoptionCard(), AiAdoptionCardProps, VERDICT_BADGE, aggregateAdoption(), perUserFeatureUsage(), AdoptionAggRow, FeatureAdoption, SLUG_TO_FEATURE (+3 more)

### Community 333 - "effectiveGrant"
Cohesion: 0.32
Nodes (9): searchProviders, effectiveGrant(), searchProviders, searchProviders, searchProviders, likePattern(), SearchProvider, appReach() (+1 more)

### Community 334 - "budget-notify.ts"
Cohesion: 0.33
Nodes (11): Budget, BudgetInput, budgetLadderStep(), budgetMonth(), budgetState, isOverBudget(), notifyBudgetThreshold(), overBudgetMessage() (+3 more)

### Community 335 - "page.tsx"
Cohesion: 0.22
Nodes (10): AdminDangerPage(), DANGER_PAGE_ACTIONS, DangerBackupCard(), DangerMeetingDeleteCard(), DangerMeetingOption, DbClearButton(), backupSummary(), deleteMeetingPhrase() (+2 more)

### Community 336 - "briefing-card.tsx"
Cohesion: 0.23
Nodes (8): SpotlightCard(), useMediaQuery(), Briefing, BriefingCard(), toMarkdown(), Load, parsePriority(), Signal

### Community 337 - "danger-actions.test.ts"
Cohesion: 0.18
Nodes (5): {
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
}, trashGroup(), trashRow(), TrashKind, TrashRow

### Community 338 - "queries.ts"
Cohesion: 0.21
Nodes (11): AppCounts, AppMember, AppRoleHistoryEntry, AppStats, AppWithMembers, countWhere(), emptyTaskCounts(), getAppBySlug() (+3 more)

### Community 339 - "prompt.ts"
Cohesion: 0.23
Nodes (10): AskPromptInput, BriefingPromptInput, buildAskPrompt(), buildBriefingPrompt(), defence(), FENCES, ParsedPriority, SHARED_RULES (+2 more)

### Community 340 - "mention-rules.ts"
Cohesion: 0.29
Nodes (8): classifyMention(), mentionAdvisory(), MentionFacts, nameList(), SUPPRESSED_REASONS, SuppressedMention, SuppressedReason, worthReporting()

### Community 341 - "live-protocol.ts"
Cohesion: 0.38
Nodes (8): AuthTokenRequestOptions, buildAudioMessage(), buildAuthTokenRequest(), buildSetupMessage(), liveSocketUrl(), parseDurationMs(), parseServerEvent(), SetupOptions

### Community 342 - "participation.ts"
Cohesion: 0.33
Nodes (7): isLowParticipation(), median(), OccurrenceParticipation, participationFor(), ParticipationMedians, seriesParticipationMedians(), VoiceSegment

### Community 343 - "Personal-first dashboard — design"
Cohesion: 0.25
Nodes (7): Data contracts, Decisions (each recorded as an assumption; the brief named none of them), Deferred, Personal-first dashboard — design, Problem, States, Testing

### Community 344 - "maintenance-banner.tsx"
Cohesion: 0.32
Nodes (7): MaintenanceBanner(), MaintenanceDetailsDialog(), MaintenanceAuthNotice(), MaintenanceOverlay(), formatCountdown(), isUrgent(), KIND_HEADINGS

### Community 345 - "entity-kinds.ts"
Cohesion: 0.39
Nodes (6): ENTITY_KINDS, EntityKind, entityKindForSource(), isMentionSource(), MENTION_SOURCES, MentionSource

### Community 346 - "applyCap"
Cohesion: 0.33
Nodes (7): applyCap(), countToday(), findBindingDedupeRows(), overflowRow(), overflowSoFar(), colomboDayWindow(), dedupeRowStillBinds()

### Community 347 - "backlog.ts"
Cohesion: 0.38
Nodes (5): backlogCondition, backlogJoinCondition, backlogTasksQuery(), isBacklogRow(), qb

### Community 348 - "dedupe.ts"
Cohesion: 0.33
Nodes (4): createDeduper(), Deduper, DeduperOptions, Entry

### Community 349 - "meeting-url.ts"
Cohesion: 0.47
Nodes (3): HTTP_URL, isValidMeetingUrl(), meetingUrlSchema

## Knowledge Gaps
- **2432 isolated node(s):** `qb`, `lead`, `q`, `$schema`, `style` (+2427 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Person Detail Skeleton` to `scoreCandidate`, `Database Schema & Queries`, `Cards & Page Composition`, `App Detail & Board Pages`, `Runtime Dependencies`, `recording-progress.ts`, `use-live-transcription.ts`, `Command Center Search`, `Shell & Navigation`, `plan-read.ts`, `buttonVariants`, `tech-tags-input.tsx`, `Auth & Security Lib`, `Meeting Forms & Calendar`, `NextAuth Type Extensions`, `mine.ts`, `churn.ts`, `MeetingForm`, `Drizzle Config`, `File Icon Asset`, `use-smart-poll.ts`, `Window Icon Asset`, `recording-segments.ts`, `Vitest Config`, `user-table.tsx`, `meetings-time-grid.tsx`, `page.tsx`, `googleapis`, `lodash.throttle`, `motion`, `loading.tsx`, `meeting-panels.tsx`, `meeting-list.tsx`, `notes.ts`, `board-skeleton.tsx`, `app-health.ts`, `calendar-view.ts`, `page.tsx`, `month-summary.tsx`, `browse.ts`, `board.tsx`, `briefing-card.tsx`, `queries.ts`, `followups.ts`, `task-composer.tsx`, `page.tsx`, `meetings-month-calendar.tsx`, `sidebar-store.ts`, `history-params.ts`, `queries.ts`, `maintenance-banner.tsx`, `action-item-board.tsx`, `entry-actions.ts`, `page.tsx`, `page.tsx`, `format-instant.ts`, `glance-core.ts`, `person-stats.ts`, `use-screen-keyframes.ts`, `task-card.tsx`, `sections.ts`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `Button()` connect `page.tsx` to `Database Schema & Queries`, `Cards & Page Composition`, `live-transcription-status.tsx`, `use-live-transcription.ts`, `Command Center Search`, `tech-tags-input.tsx`, `buttonVariants`, `active-sprints.tsx`, `NextAuth Type Extensions`, `Person Detail Skeleton`, `readiness.ts`, `churn.ts`, `meeting-url.ts`, `Drizzle Config`, `Vitest Config`, `user-table.tsx`, `@dnd-kit/sortable`, `googleapis`, `motion`, `meeting-panels.tsx`, `meeting-list.tsx`, `notes.ts`, `meeting-pip.tsx`, `note-timeline.tsx`, `app-health.ts`, `page.tsx`, `calendar-view.ts`, `page.tsx`, `browse.ts`, `audit-queries.ts`, `page.tsx`, `briefing-card.tsx`, `followups.ts`, `dashboard-zones.tsx`, `page.tsx`, `board.tsx`, `meetings-month-calendar.tsx`, `task-composer.tsx`, `history-params.ts`, `queries.ts`, `action-item-board.tsx`, `entry-actions.ts`, `page.tsx`, `page.tsx`, `meetings-day-rail.tsx`, `use-screen-keyframes.ts`, `calendar-grid.ts`, `task-card.tsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `Db` connect `Form Dialogs` to `Database Schema & Queries`, `entry-actions.test.ts`, `App Detail & Board Pages`, `live-transcription-status.tsx`, `queries.ts`, `Tables & Selects`, `Dev Tooling Config`, `actions.ts`, `Auth & Security Lib`, `shadcn Component Config`, `review-rules.ts`, `People & Allocation Actions`, `Input Primitives`, `Tabs`, `App Detail Skeleton`, `readiness.ts`, `MeetingForm`, `collisions.ts`, `meeting-url.ts`, `search.ts`, `auto-title.ts`, `person-tasks-card.tsx`, `recording-segments.ts`, `actions.ts`, `segment-store.ts`, `googleapis`, `dedupe.ts`, `queries.ts`, `meeting-intel.tsx`, `setOwnPassword`, `set-user-personal-email.test.ts`, `activity-skeleton.tsx`, `app-health.ts`, `@notionhq/client`, `route.ts`, `effectiveGrant`, `budget-notify.ts`, `audit-queries.ts`, `queries.ts`, `add-to-calendar.tsx`, `queries.ts`, `ai-engine.ts`, `page.tsx`, `actions.ts`, `entry-actions.ts`, `page.tsx`, `client.ts`, `page.tsx`, `actions.ts`, `calendar-grid.ts`, `app-client.ts`, `actions.ts`, `app-activity.tsx`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `qb`, `lead`, `q` to the rest of the system?**
  _2432 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Database Schema & Queries` be split into smaller, more focused modules?**
  _Cohesion score 0.055048529624800814 - nodes in this community are weakly interconnected._
- **Should `Cards & Page Composition` be split into smaller, more focused modules?**
  _Cohesion score 0.0547945205479452 - nodes in this community are weakly interconnected._
- **Should `App Detail & Board Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.1126984126984127 - nodes in this community are weakly interconnected._