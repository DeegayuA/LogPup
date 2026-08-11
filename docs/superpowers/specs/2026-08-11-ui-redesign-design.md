# LogPup UI Redesign — Design Spec

Date: 2026-08-11 · Branch: main · Status: approved-by-directive (autonomous session; user re-issued redesign request with "code on main only")

## Product

LogPup is the engineering ops HQ for a small studio: apps (products), people + capacity,
sprints/kanban boards, meetings (soon). Audience: developers and admin leads who live in
the tool daily. The page's job is speed — see status, act, leave.

## Direction: "Watchdog calm"

LogPup is the loyal watchdog of the team's work. The UI should feel alert but unhurried:
warm paper-like surfaces, deep pine green as the working color, one ember-amber highlight
reserved for capacity/attention. Dog personality appears only in microcopy (empty states,
command palette placeholder) — never in chrome.

Explicitly avoided defaults: cream + serif + terracotta; near-black + acid green;
broadsheet hairlines. Neutral-gray shadcn default (current state) is the thing being replaced.

## Tokens

Color (oklch):
- Light: background `0.977 0.004 95` (warm stone), foreground `0.22 0.012 155` (green-cast ink),
  card white `1 0 0`, primary pine `0.44 0.09 165`, primary-foreground `0.98 0.005 95`,
  accent sage `0.95 0.012 155`, ember (chart-1 / attention) `0.76 0.14 70`,
  border `0.91 0.006 95`, muted-foreground `0.55 0.01 130`.
- Dark: background spruce charcoal `0.17 0.01 165`, card `0.21 0.012 165`,
  primary mint-pine `0.78 0.1 165`, border `1 0 0 / 10%`, ember `0.8 0.13 70`.
- Semantic ramps: capacity heat = sage → ember → destructive; sprint/app status chips
  derive from primary/muted/destructive, never new hues.

Type: Cabinet Grotesk display (weights 600–800, tight tracking, lh ~1.1) · Satoshi body
(lh 1.5–1.6) · Geist Mono for slugs, dates, counts, percentages — always `tabular-nums`.
Scale: 12 / 14 / 16 / 20 / 28. Hierarchy from weight+color before size.

Radius 0.625rem (unchanged). Elevation: hairline borders for structure; soft low-alpha
shadows only for floating layers (menus, dialogs, palette, drag ghost).

Motion: 120–250ms, ease-out entering / ease-in leaving, transform+opacity only,
`prefers-reduced-motion` respected. `motion` (Framer) for palette + board micro-moments.

## Signature: the Command Center

A Spotlight-style ⌘K palette is the product's front door, triggered from a visible
search-shaped button centered in the header ("Fetch anything… ⌘K"). One universal index:
pages, apps (name/slug/tags), people (name/email), tasks, sprints, plus actions
(theme, sign out, admin links). Server action does the entity search (debounced,
min 2 chars); static commands filter client-side; recents kept in localStorage.
Every entity in the product is reachable in ≤3 keystrokes.

## Architecture

- `src/features/search/actions.ts` — `universalSearch(q)` server action (read-only, auth-gated).
- `src/features/search/components/command-center.tsx` — client cmdk dialog + ⌘K listener.
- Mounted once in `(app)/layout.tsx`; header button opens it via context/event.
- Shell: sidebar refined (rail indicator, grouped nav, workspace footer with user),
  header hosts command trigger + theme + avatar.
- `/meetings` placeholder page added (sidebar already links to it; route was missing).
- Page redesigns are per-route and touch only their own feature components; shared
  `src/components/ui/*` primitives are frozen during the parallel pass.

## Pages (each keeps existing data flow; visual + UX pass only)

Dashboard (mission control: capacity heat + sprint pulse + my tasks) · Apps list ·
App detail (header, tabs, sprint chrome) · Board (kanban polish, drag physics, states) ·
People list · Person detail · Profile + Admin · Sign-in (first impression, brand moment).

## Error/empty/loading

Every async surface gets designed loading/empty/error states. Empty states use
watchdog voice + a clear next action ("Nothing to fetch here yet. Add your first app.").

## Testing

Existing vitest suites must stay green; `next build` must pass. No schema or
server-action behavior changes beyond the additive search action.
