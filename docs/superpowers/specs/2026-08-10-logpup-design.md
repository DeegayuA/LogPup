# LogPup — Internal Project Management Webapp — Design

**Date:** 2026-08-10
**Status:** Approved (brainstorming complete)

## Purpose

Internal webapp for a tech lead managing 30+ people across many internal apps. Answers three daily questions: who works on what (and how loaded they are), what is each team shipping this sprint, and how do I get the right people into a meeting fast.

## Users & roles

- **Whole team logs in** via Google sign-in (Auth.js v5, Google provider), restricted to the company domain. Users are provisioned on first sign-in.
- **Roles:** `admin` (the tech lead — full access, admin panel) and `member` (sees own assignments/tasks/meetings, updates own task status). App-level `lead` is a designation on the app record, not a separate auth role.

## Stack (Approach A — Next.js monolith)

- **Next.js 16** — App Router, React 19 Server Components, Server Actions, Turbopack (default). No separate API layer (no REST/tRPC). Route guard via `src/proxy.ts` (Next 16 rename of middleware; Node.js runtime).
- **TypeScript** — latest stable, `strict: true`; optional `@typescript/native-preview` (tsgo, the TS 7 native compiler preview) for faster typechecks.
- **Neon Postgres + Drizzle ORM** — schema, migrations, type-safe queries.
- **Auth.js v5** — Google provider, domain-restricted sign-in callback, middleware route guard.
- **shadcn/ui + Tailwind CSS v4** — dark/light themes.
- **dnd-kit** — kanban drag-and-drop.
- **Notion SDK** — one-way export.
- **googleapis** — Google Calendar event creation.
- **Hosting:** Vercel + Neon. Note: Vercel Hobby tier prohibits commercial use; internal company tool strictly requires Pro ($20/mo) or an accepted gray area.

## Data model (Postgres via Drizzle)

- **users** — id, name, email, avatar, role (`admin` | `member`), title, active flag. Created on first Google sign-in.
- **apps** — id, name, slug, description, status (`active` | `paused` | `archived`), repo URL, tech tags, lead (user id).
- **assignments** — user ↔ app join: role on that app (frontend/backend/QA/lead/…), allocation %. Unique per (user, app). Per-user allocation sum drives the capacity view; over 100% = overallocated flag (warn, never block).
- **sprints** — belongs to app: name, goal, start/end dates, status (`planned` | `active` | `done`), notion_page_id (set after first export; re-export updates the same Notion page).
- **tasks** — belongs to app, optional sprint (null = backlog): title, description, status (`todo` | `in_progress` | `done`), assignee, priority, sort order.
- **meetings** — optional app link: title, start/end, agenda, notes, google_event_id, created_by.
- **meeting_attendees** — meeting ↔ user join table.

## Architecture

```
src/
  app/            # routes: dashboard, people, apps/[slug], meetings, admin
  db/             # drizzle schema + Neon client
  features/
    people/       # queries.ts, actions.ts, components/
    apps/
    sprints/      # kanban board (dnd-kit)
    meetings/
    notion/       # export service
    calendar/     # Google Calendar service
  lib/auth.ts     # Auth.js config
```

- Server Components read the DB directly via Drizzle. All mutations are Server Actions colocated per feature.
- The proxy route guard (`src/proxy.ts`) protects all routes; the sign-in callback rejects emails outside the company domain.
- Google OAuth requests the `calendar.events` scope with offline access; refresh tokens are stored. Meeting creation places the event on the organizer's calendar; attendees receive standard Google invites.
- Notion export is one-way: a button pushes a sprint/app summary page to the Notion workspace via the official SDK and stores the page id.
- Integration failures (Notion, Google Calendar) never block core saves — the record persists, the export/calendar error surfaces as a toast with retry.

## Pages & flows

- **Dashboard** (`/`) — capacity heat list (every person with total allocation %, red over 100%), active sprints across apps with progress, meetings in the next 7 days.
- **People** (`/people`) — directory with search/filter by app, role, allocation. Per-person page: allocation breakdown bars, their tasks, their meetings.
- **Apps** (`/apps`, `/apps/[slug]`) — grid with status + team avatars. App page tabs: Overview (team + allocations), Sprint board, Meetings, Settings.
- **Sprint board** — 3-column kanban (todo / in progress / done), drag-and-drop, quick-add task, assignee picker limited to the app's team, sprint switcher, backlog toggle, "Export to Notion" button.
- **Meetings** (`/meetings`) — list + create. Create flow: pick app → attendees pre-filled from the app's team (editable) → pick time → Google Calendar event created, invites sent. Notes field for after the meeting.
- **Admin** (`/admin`) — admin only: promote/deactivate users, create/archive apps, set app leads.

## UX

- Command palette (⌘K) to jump to any person/app/sprint/meeting.
- Optimistic updates on kanban drag and task status changes.
- Dark/light theme, designed empty states.

## Error handling

- Every Server Action validates input with Zod and returns a typed `{ ok, error }` result; failures surface as toasts.
- Allocation over 100% warns but does not block.
- External API (Notion/Google) errors are non-blocking with retry affordances.

## Testing

- **Vitest** — allocation math, Server Action validation logic.
- **Playwright** — smoke flows: sign-in, create app, assign person, sprint board drag, meeting creation (Calendar API mocked).

## Build order

1. Scaffold + auth + user provisioning
2. Apps + people + assignments + capacity dashboard
3. Sprints + kanban board
4. Meetings + Google Calendar integration
5. Notion export + polish (⌘K palette, dark mode, empty states)

## Out of scope (YAGNI)

- Two-way Notion sync, epics/story points/velocity/burndown, time tracking, timeboxed allocation history, Slack/Teams notifications, mobile app. All can be added later without schema upheaval.
