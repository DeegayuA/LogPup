<!-- BEGIN:nextjs-agent-rules -->

# Development conventions (team-standard)

- **UI/UX — every change**: load the user-level `designing-ui` skill first and follow
  `docs/superpowers/specs/2026-08-11-ui-redesign-design.md` (the "watchdog calm" system:
  warm stone surfaces, pine primary, ember = attention only, Cabinet Grotesk headings,
  mono data values). Tokens only — raw hex/oklch in a component is a defect. Every async
  surface ships loading/empty/error states; every control ships hover + focus-visible.
- **Component sourcing order**: 1) existing `src/components/ui` primitives; 2) the
  team's standard registries — Kibo UI (kibo-ui.com — contribution graph, mini calendar,
  gantt/roadmap, kanban helpers), Animate UI (animate-ui.com — motion components),
  Untitled UI (untitledui.com) — installed via their CLIs into `src/components/ui`;
  3) hand-rolled only when neither has it. Primitives here are Base UI flavored:
  triggers take `render={<.../>}` props, NOT `asChild` — verify registry components
  against that before shipping.
- **Knowledge graph**: `graphify-out/` holds this repo's graph. For architecture
  questions run `graphify query "<question>"`; after large changes run
  `/graphify . --update` to refresh it.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
