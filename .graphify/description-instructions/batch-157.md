# Node Description Batch 158 of 166

Graphify is running in assistant/skill mode (no API key). You are the host
assistant (Claude Code / Codex / Gemini CLI). Read the prompt below and write
your JSON answer to the answer file.

## Prompt

You are documenting nodes in a knowledge graph.
For each entry below, write ONE concise factual plain-language sentence
describing what it is or does. Use only the provided context.
For a code symbol (kind=code-symbol — a function, class, or constant),
describe what the function/symbol does based on its name, source location
and neighbors — e.g. "Resolves the configured ontology profile from graphify.yaml.".
Write every description in English (en). Do not switch languages.
No marketing language.
Respond ONLY with a JSON object mapping each node id (as a string) to its
one-sentence description — no prose, no markdown fences.

- "shell_sidebar_sidebartoggle": "SidebarToggle()" | kind=code-symbol | source=src/components/shell/sidebar.tsx:L183 | neighbors=[sidebar.tsx]
- "shell_sidebar_store_getserversnapshot": "getServerSnapshot()" | kind=code-symbol | source=src/components/shell/sidebar-store.ts:L82 | neighbors=[sidebar-store.ts]
- "shell_sidebar_store_subscribe": "subscribe()" | kind=code-symbol | source=src/components/shell/sidebar-store.ts:L67 | neighbors=[sidebar-store.ts]
- "shell_theme_provider_applyaccent": "applyAccent()" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L175 | neighbors=[theme-provider.tsx]
- "shell_theme_provider_applytheme": "applyTheme()" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L158 | neighbors=[theme-provider.tsx]
- "shell_theme_provider_isaccent": "isAccent()" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L83 | neighbors=[theme-provider.tsx]
- "shell_theme_provider_istheme": "isTheme()" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L79 | neighbors=[theme-provider.tsx]
- "shell_theme_provider_resolvedtheme": "ResolvedTheme" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L16 | neighbors=[theme-provider.tsx]
- "shell_theme_provider_systemtheme": "systemTheme()" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L154 | neighbors=[theme-provider.tsx]
- "shell_theme_provider_themecontext": "ThemeContext" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L146 | neighbors=[theme-provider.tsx]
- "shell_theme_provider_themecontextvalue": "ThemeContextValue" | kind=code-symbol | source=src/components/shell/theme-provider.tsx:L129 | neighbors=[theme-provider.tsx]
- "shell_version_badge_dayfmt": "dayFmt" | kind=code-symbol | source=src/components/shell/version-badge.tsx:L25 | neighbors=[version-badge.tsx]
- "shell_version_badge_isodayfmt": "isoDayFmt" | kind=code-symbol | source=src/components/shell/version-badge.tsx:L31 | neighbors=[version-badge.tsx]
- "shell_version_badge_kind_label": "KIND_LABEL" | kind=code-symbol | source=src/components/shell/version-badge.tsx:L34 | neighbors=[version-badge.tsx]
- "shell_version_badge_kindclass": "kindClass()" | kind=code-symbol | source=src/components/shell/version-badge.tsx:L54 | neighbors=[version-badge.tsx]
- "shell_version_badge_timefmt": "timeFmt" | kind=code-symbol | source=src/components/shell/version-badge.tsx:L19 | neighbors=[version-badge.tsx]
- "sign_in_page_capabilities": "CAPABILITIES" | kind=code-symbol | source=src/app/sign-in/page.tsx:L34 | neighbors=[page.tsx]
- "sign_in_page_metadata": "metadata" | kind=code-symbol | source=src/app/sign-in/page.tsx:L32 | neighbors=[page.tsx]
- "sign_in_page_signinpage": "SignInPage()" | kind=code-symbol | source=src/app/sign-in/page.tsx:L46 | neighbors=[page.tsx]
- "signals_corroborate_dayverdict": "DayVerdict" | kind=code-symbol | source=src/features/signals/corroborate.ts:L30 | neighbors=[corroborate.ts]
- "signals_corroborate_test_day": "day()" | kind=code-symbol | source=src/features/signals/corroborate.test.ts:L14 | neighbors=[corroborate.test.ts]
- "signals_corroborate_test_obs": "obs()" | kind=code-symbol | source=src/features/signals/corroborate.test.ts:L24 | neighbors=[corroborate.test.ts]
- "signals_figure_figurebasis": "FigureBasis" | kind=code-symbol | source=src/features/signals/figure.ts:L21 | neighbors=[figure.ts]
- "signals_figure_figureunit": "FigureUnit" | kind=code-symbol | source=src/features/signals/figure.ts:L31 | neighbors=[figure.ts]
- "signals_figure_suppressed": "Suppressed" | kind=code-symbol | source=src/features/signals/figure.ts:L105 | neighbors=[figure.ts]
- "signals_figure_test_base": "base" | kind=code-symbol | source=src/features/signals/figure.test.ts:L13 | neighbors=[figure.test.ts]
- "signals_observe_externalwitness": "ExternalWitness" | kind=code-symbol | source=src/features/signals/observe.ts:L176 | neighbors=[observe.ts]
- "signals_observe_outcome_kinds": "OUTCOME_KINDS" | kind=code-symbol | source=src/features/signals/observe.ts:L55 | neighbors=[observe.ts]
- "signals_observe_test_row": "row()" | kind=code-symbol | source=src/features/signals/observe.test.ts:L12 | neighbors=[observe.test.ts]
- "signals_page_metadata": "metadata" | kind=code-symbol | source=src/app/(app)/signals/page.tsx:L16 | neighbors=[page.tsx]
- "signals_page_signalspage": "SignalsPage()" | kind=code-symbol | source=src/app/(app)/signals/page.tsx:L36 | neighbors=[page.tsx]
- "signals_queries_colomboday": "colomboDay()" | kind=code-symbol | source=src/features/signals/queries.ts:L77 | neighbors=[queries.ts]
- "signals_queries_heldrole": "HeldRole" | kind=code-symbol | source=src/features/signals/queries.ts:L231 | neighbors=[queries.ts]
- "slug_error_appdetailerror": "AppDetailError()" | kind=code-symbol | source=src/app/(app)/apps/[slug]/error.tsx:L18 | neighbors=[error.tsx]
- "slug_loading_appdetailloading": "AppDetailLoading()" | kind=code-symbol | source=src/app/(app)/apps/[slug]/loading.tsx:L18 | neighbors=[loading.tsx]
- "slug_loading_shimmer": "Shimmer()" | kind=code-symbol | source=src/app/(app)/apps/[slug]/loading.tsx:L1 | neighbors=[loading.tsx]
- "slug_page_appdetailpage": "AppDetailPage()" | kind=code-symbol | source=src/app/(app)/apps/[slug]/page.tsx:L96 | neighbors=[page.tsx]
- "slug_page_checkinsskeleton": "CheckinsSkeleton()" | kind=code-symbol | source=src/app/(app)/apps/[slug]/page.tsx:L881 | neighbors=[page.tsx]
- "slug_page_sprint_status_label": "SPRINT_STATUS_LABEL" | kind=code-symbol | source=src/app/(app)/apps/[slug]/page.tsx:L75 | neighbors=[page.tsx]
- "slug_page_sprint_status_variant": "SPRINT_STATUS_VARIANT" | kind=code-symbol | source=src/app/(app)/apps/[slug]/page.tsx:L81 | neighbors=[page.tsx]

## Instructions

Write a single JSON object mapping each node id to a one-sentence description
to: C:\Users\ASUS\Documents\GitHub\LogPup\.graphify\description-instructions\batch-157.json

Keep each description factual and concise (one sentence). No markdown, no prose
outside the JSON object. It is acceptable to omit a node if context is
insufficient — but include every node you can ground confidently.

Example answer format:
```json
{
  "node_id_1": "Resolves the configured ontology profile from graphify.yaml.",
  "node_id_2": "Colonel James Barclay, an antagonist in The Crooked Man."
}
```
