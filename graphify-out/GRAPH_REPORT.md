# Graph Report - /Users/deeghayuadhikari/Documents/GitHub/LogPup  (2026-08-11)

## Corpus Check
- 178 files · ~63,536 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 871 nodes · 2205 edges · 70 communities (35 shown, 35 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

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
- Meetings Skeleton
- Drizzle Config
- File Icon Asset
- Globe Icon Asset
- Next.js Logo Asset
- Vercel Logo Asset
- Window Icon Asset
- NextAuth Route
- Vitest Config
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
- Community 62
- Community 63
- Community 64
- Community 66
- Community 67
- Community 68

## God Nodes (most connected - your core abstractions)
1. `cn()` - 148 edges
2. `ok()` - 42 edges
3. `err()` - 42 edges
4. `Button()` - 32 edges
5. `Db` - 23 edges
6. `Badge()` - 16 edges
7. `compilerOptions` - 16 edges
8. `Card()` - 15 edges
9. `CardHeader()` - 15 edges
10. `CardContent()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `MentionTextarea()` --references--> `react`  [EXTRACTED]
  src/components/mention-textarea.tsx → package.json
- `CalendarDayButton()` --references--> `react`  [EXTRACTED]
  src/components/ui/calendar.tsx → package.json
- `Next.js Agent Rules Block` --conceptually_related_to--> `proxy.ts Route Guard`  [INFERRED]
  AGENTS.md → docs/superpowers/plans/2026-08-10-logpup.md
- `Design Tokens (oklch color, type, motion)` --references--> `Fontshare Free Font EULA`  [INFERRED]
  docs/superpowers/specs/2026-08-11-ui-redesign-design.md → src/app/fonts/FONT-LICENSE.txt
- `CountingNumber()` --references--> `react`  [EXTRACTED]
  src/components/animate-ui/primitives/texts/counting-number.tsx → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Server Action Pattern (zod validate, auth check, ActionResult)** — docs_superpowers_plans_2026_08_10_logpup_action_result, docs_superpowers_plans_2026_08_10_logpup_authjs_v5_google_signin, docs_superpowers_plans_2026_08_10_logpup_nextjs_16_monolith [EXTRACTED 1.00]
- **Capacity Feature (allocation model, math, heat dashboard)** — docs_superpowers_specs_2026_08_10_logpup_design_capacity_allocation, docs_superpowers_plans_2026_08_10_logpup_allocation_math, docs_superpowers_plans_2026_08_10_logpup_capacity_dashboard [INFERRED 0.85]
- **External Integration Resilience (save first, warn on API failure)** — docs_superpowers_specs_2026_08_10_logpup_design_non_blocking_integrations, docs_superpowers_plans_2026_08_10_logpup_google_calendar_integration, docs_superpowers_plans_2026_08_10_logpup_notion_export [EXTRACTED 1.00]

## Communities (70 total, 35 thin omitted)

### Community 0 - "Server Actions & Results"
Cohesion: 0.06
Nodes (68): DashboardLoading(), capacityTone(), PersonDetailPage(), TASK_STATUS_DOT, TASK_STATUS_LABEL, TASK_STATUS_ORDER, PeopleLoading(), ProfilePage() (+60 more)

### Community 1 - "Database Schema & Queries"
Cohesion: 0.06
Nodes (55): MeetingsPage(), formatDate(), getDays(), MiniCalendar(), MiniCalendarContext, MiniCalendarContextType, MiniCalendarDay(), MiniCalendarDayProps (+47 more)

### Community 2 - "Cards & Page Composition"
Cohesion: 0.09
Nodes (40): badgeVariants, Dialog(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogTitle(), DialogTrigger() (+32 more)

### Community 3 - "App Detail & Board Pages"
Cohesion: 0.05
Nodes (45): AdminPage(), AppsPage(), AppDetailPage(), formatSprintDate(), SPRINT_STATUS_LABEL, SPRINT_STATUS_VARIANT, STATUS_DOT, STATUS_LABEL (+37 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.08
Nodes (41): DashboardPage(), greetingFor(), PeoplePage(), InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants (+33 more)

### Community 5 - "Design Docs & Plans"
Cohesion: 0.07
Nodes (27): cabinet, geistMono, metadata, satoshi, viewport, Header(), HeaderUser, navItems (+19 more)

### Community 6 - "Tables & Selects"
Cohesion: 0.05
Nodes (38): drizzle-kit, eslint, eslint-config-next, devDependencies, drizzle-kit, eslint, eslint-config-next, @playwright/test (+30 more)

### Community 7 - "Dev Tooling Config"
Cohesion: 0.09
Nodes (34): react, react, CountingNumber(), CountingNumberProps, StatNumber(), statTransition, subscribeToReducedMotion(), useStaticNumber() (+26 more)

### Community 8 - "Form Dialogs"
Cohesion: 0.12
Nodes (24): APP_SLUG, RUN_ID, Db, apps, appStatus, assignments, meetingAiNotes, meetingAttendees (+16 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.11
Nodes (26): geminiKeys, addGeminiKey(), addKeyInput, deleteGeminiKey(), idInput, toggleGeminiKey(), toggleInput, callGemini() (+18 more)

### Community 10 - "Command Center Search"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, .next-e2e/dev/types/**/*.ts, .next-e2e/types/**/*.ts, next-env.d.ts (+22 more)

### Community 11 - "Shell & Navigation"
Cohesion: 0.07
Nodes (30): Next.js Agent Rules Block, CLAUDE.md Project Instructions, ActionResult Pattern, Allocation Math (summarizeAllocations), Auth.js v5 Google Sign-In, Capacity Heat Dashboard, Command Palette (Cmd+K) + Empty States, Drizzle Schema (7 tables, Neon Postgres) (+22 more)

### Community 12 - "Feature Dialogs & Panels"
Cohesion: 0.10
Nodes (27): Activity, ContributionGraph(), ContributionGraphBlock(), ContributionGraphBlockProps, ContributionGraphCalendar(), ContributionGraphCalendarProps, ContributionGraphContext, ContributionGraphContextType (+19 more)

### Community 13 - "Auth & Security Lib"
Cohesion: 0.09
Nodes (22): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+14 more)

### Community 14 - "shadcn Component Config"
Cohesion: 0.20
Nodes (16): clearTestData(), createUser(), createUserInput, dbClearEnabled(), orgTagsInput, otherActiveAdminCount(), requireAdmin(), revalidateAdminPaths() (+8 more)

### Community 15 - "Meeting Actions"
Cohesion: 0.16
Nodes (11): applyMove(), Board(), BoardColumn(), COLUMNS, MoveUpdate, TaskStatus, PRIORITY_BAR, PRIORITY_LABEL (+3 more)

### Community 16 - "Meeting Forms & Calendar"
Cohesion: 0.21
Nodes (9): setOwnPassword(), setPasswordInput, allowedDomains(), emailAllowed(), { handlers, auth, signIn, signOut }, hashPassword(), verifyPassword(), RateLimitError (+1 more)

### Community 17 - "People & Allocation Actions"
Cohesion: 0.25
Nodes (10): appInput, archiveApp(), createApp(), requireAdmin(), updateApp(), appUpdateInput, AppUpdateResult, buildAppUpdate() (+2 more)

### Community 18 - "Input Primitives"
Cohesion: 0.27
Nodes (14): createTask(), deleteTask(), isForeignKeyViolation(), moveTask(), requireAdmin(), requireSession(), revalidateApp(), slugForApp() (+6 more)

### Community 19 - "Tabs"
Cohesion: 0.40
Nodes (10): assignInput, assignmentUpdateInput, assignUser(), isUniqueViolation(), removeAssignment(), requireAdmin(), revalidateAssignmentPaths(), slugForApp() (+2 more)

### Community 20 - "Root Layout & Theming"
Cohesion: 0.22
Nodes (9): @base-ui/react, cmdk, jotai, @notionhq/client, dependencies, @base-ui/react, cmdk, jotai (+1 more)

### Community 21 - "NextAuth Type Extensions"
Cohesion: 0.33
Nodes (4): authFile, repoRoot, seedDevUser(), SeedResult

### Community 22 - "App Detail Skeleton"
Cohesion: 0.25
Nodes (4): createRateLimiter(), loginRateLimiter, RateLimiter, RateLimiterOptions

### Community 23 - "Person Detail Skeleton"
Cohesion: 0.43
Nodes (5): AppleIcon(), size, GET(), brandTileSvg(), pawSvg()

### Community 24 - "Vercel Cron Config"
Cohesion: 0.43
Nodes (7): createSprint(), requireAdmin(), slugForApp(), SPRINT_STATUSES, sprintInput, SprintStatus, updateSprintStatus()

### Community 25 - "ESLint Config"
Cohesion: 0.53
Nodes (5): GET(), isAuthorized(), buildSnapshot(), encryptionKey(), encryptSnapshot()

### Community 26 - "Next Config"
Cohesion: 0.40
Nodes (4): JWT, next-auth, next-auth/jwt, Session

## Knowledge Gaps
- **246 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+241 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Server Actions & Results` to `Database Schema & Queries`, `Cards & Page Composition`, `App Detail & Board Pages`, `Runtime Dependencies`, `Design Docs & Plans`, `Dev Tooling Config`, `Feature Dialogs & Panels`, `Meeting Actions`?**
  _High betweenness centrality (0.220) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Root Layout & Theming` to `Tables & Selects`, `Dev Tooling Config`, `Drizzle Config`, `File Icon Asset`, `Globe Icon Asset`, `Next.js Logo Asset`, `Vercel Logo Asset`, `Window Icon Asset`, `Vitest Config`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 45`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 51`, `Community 52`, `Community 53`, `Community 54`, `Community 55`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Why does `react` connect `Dev Tooling Config` to `Database Schema & Queries`, `Root Layout & Theming`?**
  _High betweenness centrality (0.169) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _246 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Server Actions & Results` be split into smaller, more focused modules?**
  _Cohesion score 0.06162280701754386 - nodes in this community are weakly interconnected._
- **Should `Database Schema & Queries` be split into smaller, more focused modules?**
  _Cohesion score 0.06322624743677376 - nodes in this community are weakly interconnected._
- **Should `Cards & Page Composition` be split into smaller, more focused modules?**
  _Cohesion score 0.09351256575102279 - nodes in this community are weakly interconnected._