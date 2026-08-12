# 🐾 LogPup

The watchdog for your team's apps, people, and sprints.

LogPup is an internal engineering ops HQ for a small studio: track every app you run, who works on what (and how loaded they are), what each team ships this sprint, and what happened in every meeting — with AI notes in English and Sinhala.

## Features

- **Dashboard** — team capacity heat, active sprints with progress, upcoming meetings, all in one briefing.
- **Apps** — one card per product: status, tech tags, team avatars, lead; detail page with team, sprint board, meetings, and settings.
- **Sprint boards** — kanban with drag-and-drop, optimistic updates, per-role move permissions, backlog view, one-way Notion export.
- **People & capacity** — allocation percentages per app; capacity bars go pine → ember → red past 100%; per-person activity contribution graph.
- **Meetings** — schedule with Google Calendar invites, mini-calendar day filter, and **Meeting Intelligence**: record mic or screen+mic audio in the browser and Gemini transcribes it (English + සිංහල), extracting per-person notes, action items, deadlines, a software-terms glossary, and follow-up questions that surface as prep at the next meeting.
- **⌘K Command Center** — Spotlight-style universal search over apps, people, tasks, sprints, and meetings, plus commands (theme, sign out) and `g`+`d/a/p/m` keyboard jumps.
- **Roles** — admin (full control) and member (reads all, updates own tasks); every mutation enforced server-side.
- **Per-user Gemini keys** — each user brings their own free-tier key (up to 5); requests roll across active keys on rate limits; keys are AES-256-GCM encrypted at rest.

## Stack

Next.js 16 (App Router, Server Actions, `src/proxy.ts` route guard) · React 19 · Tailwind v4 + shadcn (Base UI flavored) · Drizzle ORM + Neon Postgres · Auth.js v5 (Google, optional Notion, password) · Google Gemini · Kibo UI components · Vitest + Playwright.

No REST layer: Server Components read the DB, all writes are Server Actions returning a typed `ActionResult`.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values below
npx drizzle-kit push          # create tables in your Neon database
npm run dev
```

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `AUTH_SECRET` | Auth.js session signing (`openssl rand -base64 32`) |
| `AUTH_URL` | Origin the app runs on (e.g. `http://localhost:3000`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (redirect URI: `{AUTH_URL}/api/auth/callback/google`) |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated domains allowed to sign in |
| `GEMINI_KEY_ENCRYPTION_SECRET` | Optional dedicated secret for encrypting stored Gemini keys (falls back to `AUTH_SECRET`) |
| `NOTION_OAUTH_CLIENT_ID` / `NOTION_OAUTH_CLIENT_SECRET` | Optional "Continue with Notion" sign-in (redirect URI: `{AUTH_URL}/api/auth/callback/notion`) |
| `NOTION_TOKEN` / `NOTION_PARENT_PAGE_ID` | Optional one-way sprint export to Notion |
| `CRON_SECRET` / `BACKUP_ENCRYPTION_KEY` / `BLOB_READ_WRITE_TOKEN` | Nightly encrypted DB backup cron (`/api/cron/backup`) |
| `ENABLE_DB_CLEAR` | Set to enable the admin danger-zone database clear |

### Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build
npm test        # vitest unit suites
npm run lint    # eslint
```

## Meeting Intelligence

1. Add a Gemini API key in **Profile → Gemini API keys** (free at aistudio.google.com).
2. On any meeting, open **Intelligence** → *Record mic* or *Record screen + mic* (pick a tab and enable "Share audio" for calls). Chrome recommended.
3. Stop recording — Gemini transcribes and stores structured notes; the next meeting for the same app shows each person's follow-up questions.

Audio is processed with the recorder's own API key; make sure attendees consent to recording.

## Design system

The UI follows the committed **"watchdog calm"** spec — warm stone surfaces, pine green working color, ember amber reserved for attention, Cabinet Grotesk headings, mono data values. See [docs/superpowers/specs/2026-08-11-ui-redesign-design.md](docs/superpowers/specs/2026-08-11-ui-redesign-design.md) and the conventions in [AGENTS.md](AGENTS.md) before touching UI.

## Knowledge graph

`graphify-out/` holds a queryable graph of the whole codebase (727 nodes, 38 communities): open `graphify-out/graph.html` in a browser, read `graphify-out/GRAPH_REPORT.md`, or ask questions with `graphify query "..."`.

## Public pages

Four routes are reachable without a session, and are excluded from the auth guard in `src/proxy.ts`: `/sign-in`, plus `/home`, `/privacy`, and `/terms` under `src/app/(public)/`. They exist because Google's OAuth review fetches the home page, privacy policy, and terms with no session before it will approve the sensitive `calendar.events` scope — put them back behind the guard and verification breaks with nothing else in the app noticing. `src/app/robots.ts` allows crawling of exactly those four.

## Deploying (Vercel)

- Framework preset **Next.js**, root directory = repo root, production branch `main`.
- Set all env vars above for Production (change `AUTH_URL` to the production origin).
- Register the production OAuth redirect URIs with Google (and Notion if enabled).
- Getting the Google consent screen verified — console fields, scope justification, demo-video script: [docs/google-oauth-verification.md](docs/google-oauth-verification.md).
- `vercel.json` schedules the nightly backup cron.
- ACCEPTED RISK: in-memory per-instance — on serverless scale-out lockout weakens; move to durable store (e.g. Upstash/DB) before external exposure. (login rate limiter, `src/lib/rate-limit.ts`)
