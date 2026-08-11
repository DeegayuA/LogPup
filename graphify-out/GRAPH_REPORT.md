# Graph Report - /Users/deeghayuadhikari/Documents/GitHub/LogPup  (2026-08-11)

## Corpus Check
- Corpus is ~49,957 words - fits in a single context window. You may not need a graph.

## Summary
- 727 nodes · 1878 edges · 38 communities (28 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.8)
- Token cost: 19,700 input · 5,380 output

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
- Vercel Cron Config
- ESLint Config
- Next Config
- PostCSS Config
- File Icon Asset
- Globe Icon Asset
- Next.js Logo Asset
- Vercel Logo Asset
- Window Icon Asset
- NextAuth Route

## God Nodes (most connected - your core abstractions)
1. `cn()` - 131 edges
2. `ok()` - 38 edges
3. `err()` - 38 edges
4. `Button()` - 27 edges
5. `Db` - 21 edges
6. `compilerOptions` - 16 edges
7. `Card()` - 15 edges
8. `CardContent()` - 15 edges
9. `Badge()` - 14 edges
10. `CardHeader()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Next.js Agent Rules Block` --conceptually_related_to--> `proxy.ts Route Guard`  [INFERRED]
  AGENTS.md → docs/superpowers/plans/2026-08-10-logpup.md
- `Design Tokens (oklch color, type, motion)` --conceptually_related_to--> `Geist Font`  [INFERRED]
  docs/superpowers/specs/2026-08-11-ui-redesign-design.md → README.md
- `Design Tokens (oklch color, type, motion)` --references--> `Fontshare Free Font EULA`  [INFERRED]
  docs/superpowers/specs/2026-08-11-ui-redesign-design.md → src/app/fonts/FONT-LICENSE.txt
- `CalendarDayButton()` --references--> `react`  [EXTRACTED]
  src/components/ui/calendar.tsx → package.json
- `CommandCenterProvider()` --references--> `react`  [EXTRACTED]
  src/features/search/components/command-center.tsx → package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Server Action Pattern (zod validate, auth check, ActionResult)** — docs_superpowers_plans_2026_08_10_logpup_action_result, docs_superpowers_plans_2026_08_10_logpup_authjs_v5_google_signin, docs_superpowers_plans_2026_08_10_logpup_nextjs_16_monolith [EXTRACTED 1.00]
- **External Integration Resilience (save first, warn on API failure)** — docs_superpowers_specs_2026_08_10_logpup_design_non_blocking_integrations, docs_superpowers_plans_2026_08_10_logpup_google_calendar_integration, docs_superpowers_plans_2026_08_10_logpup_notion_export [EXTRACTED 1.00]
- **Capacity Feature (allocation model, math, heat dashboard)** — docs_superpowers_specs_2026_08_10_logpup_design_capacity_allocation, docs_superpowers_plans_2026_08_10_logpup_allocation_math, docs_superpowers_plans_2026_08_10_logpup_capacity_dashboard [INFERRED 0.85]

## Communities (38 total, 10 thin omitted)

### Community 0 - "Server Actions & Results"
Cohesion: 0.06
Nodes (59): geminiKeys, appInput, archiveApp(), createApp(), requireAdmin(), updateApp(), appUpdateInput, AppUpdateResult (+51 more)

### Community 1 - "Database Schema & Queries"
Cohesion: 0.06
Nodes (56): GET(), isAuthorized(), DashboardPage(), greetingFor(), PeoplePage(), Db, apps, appStatus (+48 more)

### Community 2 - "Cards & Page Composition"
Cohesion: 0.09
Nodes (41): capacityTone(), PersonDetailPage(), TASK_STATUS_DOT, TASK_STATUS_LABEL, TASK_STATUS_ORDER, ProfilePage(), metadata, Avatar() (+33 more)

### Community 3 - "App Detail & Board Pages"
Cohesion: 0.05
Nodes (48): AdminPage(), AppsPage(), AppDetailPage(), formatSprintDate(), SPRINT_STATUS_LABEL, SPRINT_STATUS_VARIANT, STATUS_DOT, STATUS_LABEL (+40 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.04
Nodes (47): @base-ui/react, class-variance-authority, clsx, cmdk, date-fns, @dnd-kit/core, @dnd-kit/sortable, drizzle-orm (+39 more)

### Community 5 - "Design Docs & Plans"
Cohesion: 0.06
Nodes (34): Next.js Agent Rules Block, CLAUDE.md Project Instructions, ActionResult Pattern, Allocation Math (summarizeAllocations), Auth.js v5 Google Sign-In, Capacity Heat Dashboard, Command Palette (Cmd+K) + Empty States, Drizzle Schema (7 tables, Neon Postgres) (+26 more)

### Community 6 - "Tables & Selects"
Cohesion: 0.13
Nodes (28): DashboardLoading(), PeopleLoading(), AlertDialogMedia(), AlertDialogOverlay(), CardFooter(), SelectContent(), SelectGroup(), SelectItem() (+20 more)

### Community 7 - "Dev Tooling Config"
Cohesion: 0.06
Nodes (30): drizzle-kit, eslint, eslint-config-next, devDependencies, drizzle-kit, eslint, eslint-config-next, tailwindcss (+22 more)

### Community 8 - "Form Dialogs"
Cohesion: 0.15
Nodes (18): Dialog(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle(), DialogTrigger() (+10 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 10 - "Command Center Search"
Cohesion: 0.12
Nodes (26): react, react, CalendarDayButton(), Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput() (+18 more)

### Community 11 - "Shell & Navigation"
Cohesion: 0.11
Nodes (17): Header(), HeaderUser, navItems, NavLink(), Sidebar(), ThemeToggle(), DropdownMenu(), DropdownMenuCheckboxItem() (+9 more)

### Community 12 - "Feature Dialogs & Panels"
Cohesion: 0.22
Nodes (18): AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogTitle() (+10 more)

### Community 13 - "Auth & Security Lib"
Cohesion: 0.13
Nodes (11): allowedDomains(), emailAllowed(), { handlers, auth, signIn, signOut }, hashPassword(), verifyPassword(), createRateLimiter(), loginRateLimiter, RateLimiter (+3 more)

### Community 14 - "shadcn Component Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 15 - "Meeting Actions"
Cohesion: 0.26
Nodes (17): client(), createCalendarEvent(), deleteCalendarEvent(), attendeeEmails(), canManageMeeting(), createMeeting(), deleteMeeting(), isForeignKeyViolation() (+9 more)

### Community 16 - "Meeting Forms & Calendar"
Cohesion: 0.18
Nodes (12): Button(), buttonVariants, Calendar(), Popover(), PopoverContent(), PopoverDescription(), PopoverHeader(), PopoverTitle() (+4 more)

### Community 17 - "People & Allocation Actions"
Cohesion: 0.25
Nodes (13): assignInput, assignmentUpdateInput, assignUser(), isUniqueViolation(), removeAssignment(), requireAdmin(), revalidateAssignmentPaths(), slugForApp() (+5 more)

### Community 18 - "Input Primitives"
Cohesion: 0.24
Nodes (9): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+1 more)

### Community 19 - "Tabs"
Cohesion: 0.29
Nodes (9): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger(), AppTabs(), normalizeTab(), TAB_VALUES (+1 more)

### Community 20 - "Root Layout & Theming"
Cohesion: 0.24
Nodes (6): cabinet, geistMono, metadata, satoshi, ThemeProvider(), Toaster()

### Community 21 - "NextAuth Type Extensions"
Cohesion: 0.40
Nodes (4): JWT, next-auth, next-auth/jwt, Session

## Knowledge Gaps
- **190 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+185 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Tables & Selects` to `Server Actions & Results`, `Cards & Page Composition`, `App Detail & Board Pages`, `Form Dialogs`, `Command Center Search`, `Shell & Navigation`, `Feature Dialogs & Panels`, `Meeting Forms & Calendar`, `Input Primitives`, `Tabs`?**
  _High betweenness centrality (0.228) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies` to `Command Center Search`, `Dev Tooling Config`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **Why does `react` connect `Command Center Search` to `Runtime Dependencies`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _190 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Server Actions & Results` be split into smaller, more focused modules?**
  _Cohesion score 0.06070175438596491 - nodes in this community are weakly interconnected._
- **Should `Database Schema & Queries` be split into smaller, more focused modules?**
  _Cohesion score 0.060718252499074414 - nodes in this community are weakly interconnected._
- **Should `Cards & Page Composition` be split into smaller, more focused modules?**
  _Cohesion score 0.0875 - nodes in this community are weakly interconnected._