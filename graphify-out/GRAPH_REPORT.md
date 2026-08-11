# Graph Report - /Users/deeghayuadhikari/Documents/GitHub/LogPup  (2026-08-11)

## Corpus Check
- 196 files · ~76,381 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 967 nodes · 2459 edges · 78 communities (42 shown, 36 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 35
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 69
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76

## God Nodes (most connected - your core abstractions)
1. `cn()` - 161 edges
2. `ok()` - 45 edges
3. `err()` - 45 edges
4. `Button()` - 39 edges
5. `Db` - 24 edges
6. `Input()` - 19 edges
7. `Badge()` - 18 edges
8. `compilerOptions` - 16 edges
9. `Card()` - 15 edges
10. `CardHeader()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `useStaticNumber()` --references--> `react`  [EXTRACTED]
  src/components/animate-ui/stat-number.tsx → package.json
- `CommandCenterProvider()` --references--> `react`  [EXTRACTED]
  src/features/search/components/command-center.tsx → package.json
- `Design Tokens (oklch color, type, motion)` --references--> `Fontshare Free Font EULA`  [INFERRED]
  docs/superpowers/specs/2026-08-11-ui-redesign-design.md → src/app/fonts/FONT-LICENSE.txt
- `CountingNumber()` --references--> `react`  [EXTRACTED]
  src/components/animate-ui/primitives/texts/counting-number.tsx → package.json
- `MentionTextarea()` --references--> `react`  [EXTRACTED]
  src/components/mention-textarea.tsx → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Server Action Pattern (zod validate, auth check, ActionResult)** — docs_superpowers_plans_2026_08_10_logpup_action_result, docs_superpowers_plans_2026_08_10_logpup_authjs_v5_google_signin, docs_superpowers_plans_2026_08_10_logpup_nextjs_16_monolith [EXTRACTED 1.00]
- **Capacity Feature (allocation model, math, heat dashboard)** — docs_superpowers_specs_2026_08_10_logpup_design_capacity_allocation, docs_superpowers_plans_2026_08_10_logpup_allocation_math, docs_superpowers_plans_2026_08_10_logpup_capacity_dashboard [INFERRED 0.85]
- **External Integration Resilience (save first, warn on API failure)** — docs_superpowers_specs_2026_08_10_logpup_design_non_blocking_integrations, docs_superpowers_plans_2026_08_10_logpup_google_calendar_integration, docs_superpowers_plans_2026_08_10_logpup_notion_export [EXTRACTED 1.00]

## Communities (78 total, 36 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (62): JobRoleSelect(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+54 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (60): AdminPage(), PersonDetailPage(), TASK_STATUS_DOT, TASK_STATUS_LABEL, TASK_STATUS_ORDER, ProfilePage(), CAPABILITIES, metadata (+52 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (48): MeetingsPage(), DashboardPage(), greetingFor(), PeoplePage(), formatDate(), getDays(), MiniCalendar(), MiniCalendarContext (+40 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (42): AppsPage(), AppDetailPage(), formatSprintDate(), SPRINT_STATUS_LABEL, SPRINT_STATUS_VARIANT, STATUS_DOT, STATUS_LABEL, Tabs() (+34 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (35): DashboardLoading(), PeopleLoading(), AlertDialogMedia(), AlertDialogOverlay(), buttonVariants, Calendar(), CardFooter(), DateTimeWheelField() (+27 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (38): drizzle-kit, eslint, eslint-config-next, devDependencies, drizzle-kit, eslint, eslint-config-next, @playwright/test (+30 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (26): clearTestData(), createUser(), createUserInput, dbClearEnabled(), orgTagsInput, otherActiveAdminCount(), requireAdmin(), revalidateAdminPaths() (+18 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (31): CalendarBody(), CalendarBodyProps, CalendarContext, CalendarContextProps, CalendarDatePagination(), CalendarDatePaginationProps, CalendarDatePicker(), CalendarDatePickerProps (+23 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (23): Db, apps, appStatus, assignments, meetingAiNotes, meetingAttendees, sprints, sprintStatus (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, .next-e2e/dev/types/**/*.ts, .next-e2e/types/**/*.ts, next-env.d.ts (+22 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (25): appInput, archiveApp(), createApp(), requireAdmin(), updateApp(), appUpdateInput, AppUpdateResult, buildAppUpdate() (+17 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (27): Activity, ContributionGraph(), ContributionGraphBlock(), ContributionGraphBlockProps, ContributionGraphCalendar(), ContributionGraphCalendarProps, ContributionGraphContext, ContributionGraphContextType (+19 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (28): ActionResult Pattern, Allocation Math (summarizeAllocations), Auth.js v5 Google Sign-In, Capacity Heat Dashboard, Command Palette (Cmd+K) + Empty States, Drizzle Schema (7 tables, Neon Postgres), Google Calendar Integration, LogPup Implementation Plan (+20 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (22): Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandLoading() (+14 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (19): geminiKeys, callGemini(), GeminiError, GeminiErrorCode, GeminiPart, analyzeMeetingAudio(), asArray(), canManageMeeting() (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (22): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+14 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (13): HeaderUser, ThemeToggle(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem() (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.24
Nodes (18): client(), createCalendarEvent(), deleteCalendarEvent(), attendeeEmails(), canManageMeeting(), createMeeting(), deleteMeeting(), isForeignKeyViolation() (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (8): authFile, repoRoot, seedDevUser(), SeedResult, APP_SLUG, RUN_ID, meetings, slugify()

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (13): assignInput, assignmentUpdateInput, assignUser(), isUniqueViolation(), removeAssignment(), requireAdmin(), revalidateAssignmentPaths(), slugForApp() (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.16
Nodes (10): cabinet, geistMono, metadata, satoshi, viewport, ThemeProvider(), Toaster(), InstallButton() (+2 more)

### Community 21 - "Community 21"
Cohesion: 0.27
Nodes (14): createTask(), deleteTask(), isForeignKeyViolation(), moveTask(), requireAdmin(), requireSession(), revalidateApp(), slugForApp() (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (8): users, loginWithPassword(), setOwnPassword(), setOwnPhone(), setPasswordInput, { handlers, auth, signIn, signOut }, RateLimitError, config

### Community 23 - "Community 23"
Cohesion: 0.24
Nodes (10): react, react, CountingNumber(), CountingNumberProps, MentionTextarea(), CalendarDayButton(), CommandCenterTrigger(), useCommandCenter() (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.27
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 25 - "Community 25"
Cohesion: 0.22
Nodes (9): clsx, cmdk, jotai, @notionhq/client, dependencies, clsx, cmdk, jotai (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (4): createRateLimiter(), loginRateLimiter, RateLimiter, RateLimiterOptions

### Community 27 - "Community 27"
Cohesion: 0.43
Nodes (5): AppleIcon(), size, GET(), brandTileSvg(), pawSvg()

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (4): Header(), navItems, NavLink(), Sidebar()

### Community 29 - "Community 29"
Cohesion: 0.48
Nodes (5): buildBlocks(), notion(), SprintExportData, data, upsertSprintPage()

### Community 30 - "Community 30"
Cohesion: 0.38
Nodes (6): EMPTY, likePattern(), parseQuickAssign(), QuickAssignData, quickAssignTask(), quickAssignTitle

### Community 31 - "Community 31"
Cohesion: 0.53
Nodes (5): GET(), isAuthorized(), buildSnapshot(), encryptionKey(), encryptSnapshot()

### Community 32 - "Community 32"
Cohesion: 0.40
Nodes (4): JWT, next-auth, next-auth/jwt, Session

### Community 33 - "Community 33"
Cohesion: 0.40
Nodes (4): buildCommand, crons, framework, $schema

## Knowledge Gaps
- **280 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+275 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 4` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 7`, `Community 11`, `Community 13`, `Community 16`, `Community 23`, `Community 24`, `Community 28`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 25` to `Community 5`, `Community 23`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 45`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 51`, `Community 53`, `Community 54`, `Community 55`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 62`, `Community 63`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Why does `react` connect `Community 23` to `Community 25`, `Community 13`, `Community 1`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _280 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06798245614035088 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06117353308364544 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.060814383923849816 - nodes in this community are weakly interconnected._