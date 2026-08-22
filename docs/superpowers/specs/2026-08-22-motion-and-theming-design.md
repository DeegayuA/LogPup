# Motion and Theming — design

**Date:** 2026-08-22
**Scope:** the authed shell (`src/app/(app)`), the shared motion primitives, the colourway tokens, and the loading/announcement layer. Public pages and /sign-in excluded — they animate with CSS only and keep `--ease-editorial` as their own curve.
**Verification:** 4102 vitest tests green, `tsc --noEmit` clean, `eslint` 0 errors. The 84 contrast pairs below were computed (OKLCH → linear sRGB → WCAG luminance), not eyeballed; the method reproduces the ratios already recorded in globals.css to within 0.05.

## Subject and stance

The app already had a motion vocabulary and no way to speak it. `globals.css` declared `--ease-enter/exit/editorial` and `--dur-quick/base/slow`, the public page had a full CSS reveal system behind `[data-motion]`, and `motion@13` had been in `package.json` for a while — used by exactly three files. So this is not "add animations". It is **giving the existing vocabulary a JS half, and giving the existing token system a second axis.**

Three rules the whole change is built on:

1. **The server's output is the visible state.** Nothing ships hidden. This is the same rule the public page's reveals were inverted to satisfy, applied to a library that defaults to breaking it.
2. **Motion means "this is new".** Content that was in the first response is not new and does not animate. Content that arrives — a streamed zone, an added row, the next route — does.
3. **A colourway moves the working colour and nothing else.** Surfaces stay. Semantic colours stay. A theme picker that repaints "at risk" is not a theme picker.

## Avoided defaults

- No spring physics, no bounce, no `whileHover` scale on cards, no page-level exit animations, no parallax, no scroll-linked anything.
- No second easing family. The JS layer reads the same three curves the CSS layer does, and a test fails if they drift.
- No colourway that repaints the app. Six ways × two modes = twelve looks, all of them the same interface.
- No new dependencies. `motion` was already installed; nothing else was added.

## The motion vocabulary

Mirrored in `src/components/motion/transitions.ts` from the CSS custom properties, which stay the source of truth. `transitions.test.ts` parses `globals.css` and fails if the two disagree — the mirror is enforced, not hoped for.

| Token | Value | Applies to |
|---|---|---|
| `--dur-quick` | 120ms | hover/press feedback; **every exit** |
| `--dur-base` | 200ms | opacity on enter; route fade |
| `--dur-slow` | 320ms | movement on enter; large surfaces |
| `--ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | anything arriving |
| `--ease-exit` | `cubic-bezier(0.7, 0, 0.84, 0)` | anything leaving |
| `--ease-editorial` | `cubic-bezier(0.22, 0.68, 0.2, 1)` | public page only; untouched here |

**Opacity finishes first.** Enter animates opacity over `--dur-base` and movement over `--dur-slow`, so an element is legible while it is still settling. Copied deliberately from the public page's reveal, which wrote down why: fading and moving over one duration makes an element land and solidify in the same instant, and that is what reads as mushy.

**Travel is 8px (0.5rem)** — the distance the public page settled on — except the route transition, which uses 4px because it moves a viewport's worth of content and the same distance reads as a lurch at page scale.

**Stagger is 40ms**, capped at a ~480ms total: past twelve children the interval divides down, so a 90-person directory finishes in the same budget a six-row list does. A fixed interval over a long list stops reading as arrival and starts reading as a slow connection.

## Primitives (src/components/motion)

| Primitive | What it is |
|---|---|
| `MotionProvider` | `LazyMotion features={domMax} strict` + `MotionConfig reducedMotion="user"`. Mounted once in `(app)/layout.tsx`. |
| `Reveal` | One element arriving. `index` for hand-sequenced groups, `inView` for below-the-fold, `as` for list elements. |
| `Stagger` / `StaggerItem` | A group whose children arrive in DOM order. The container owns the timing; items carry none. |
| `PresenceList` | `AnimatePresence` for add/remove. Not reorder — see below. |
| `RouteTransition` | The next route fading and rising 4px, keyed on pathname. |
| `hydrated.ts` | The module flag that keeps rule 1 true. |

**`domMax`, not `domAnimation`.** The smaller feature set is the obvious choice and the wrong one: the AI meter dock animates with `layout`, which `domAnimation` omits — it would not error, it would silently stop animating. This is still less than the app shipped before, because the dock's plain `motion` import was already pulling everything, per route. `strict` is on, so `motion.*` throws instead of quietly re-bundling; the dock was converted to `m.*` in the same change.

**Reorder is not animated**, though `domMax` could. The only real reordering surface is dnd-kit's, which already animates its own transforms and would fight a second engine for the same element; everywhere else a row sliding across the screen obscures the fact that the list just re-sorted.

**Reduced motion is handled twice.** `MotionConfig reducedMotion="user"` is the floor — it suppresses transform and layout animation for any component, including ones written without these primitives. The primitives go further and drop the **opacity** animation too, which that setting leaves running: a fade is still motion to someone it makes ill, and WCAG 2.3.3 expects non-essential motion to go away rather than get quieter.

## Why `hydrated.ts` exists

A `motion` component with `initial="hidden"` renders that hidden state **on the server**. The HTML ships with `style="opacity:0"` and the content appears only once the bundle has loaded and hydrated — a few hundred milliseconds on a good connection, a blank page on a bad one, a permanently blank page if the bundle fails.

This codebase already refused that trade once, on `/home`, where the reveals are inverted so nothing is hidden before JS runs (the OAuth reviewer fetches that page). The same refusal applies here.

So a module-level flag, set by `MotionProvider`'s mount effect, is read during render: before it flips, `initial` is `false` and everything renders visible and unanimated; after, arrivals animate. **Not** `useState` + `useEffect`, which answers "have *I* mounted" — every component answers false on its own first render, including the one mounted ten seconds later that should animate.

The side effect is that the animation becomes semantically honest: it now means "this is new", and only things that are new have it.

## Colourways

Six ways, orthogonal to light/dark. Selectable in Settings → Appearance and from ⌘K ("Colour: Ocean").

**Ten tokens move, and only these:** `--primary`, `--accent`, `--accent-foreground`, `--ring`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-ring`, plus `--primary-foreground` and `--sidebar-primary-foreground` in dark, where the foreground is hue-tinted. Surfaces, borders and every semantic token stay shared. `accent-tokens.test.ts` fails if a way ever touches `--destructive`, `--background`, `--chart-1` and the rest of that list.

**Hue only.** Every value is the audited pine value with its hue rotated — same L, same C. Same move `--holiday` and `--warning` made going orange-to-purple, and for the same reason: L and C are what the ratios were measured against, so rotating hue alone keeps the audit valid. It also stops any one way from shouting louder than the others.

**Pine has no CSS block** — it is what `:root` and `.dark` already declare. The attribute is still written for it so the picker and the tests can read the current way rather than infer it from absence.

**Applied before first paint.** The pre-hydration script in `theme-provider.tsx` reads the accent from `localStorage` in the same pass as the theme and validates it against `ACCENTS`. Applied a tick later instead, every load would show pine and then flip.

**The picker paints itself from these blocks.** The mode half of each selector is `:is(.dark, .dark *)` — an ancestor-or-self test — so a swatch carrying `data-accent="ocean"` resolves `--primary` to ocean inside its own subtree while the page keeps the way that is actually on. The picker is not six hardcoded hex values that can drift from the stylesheet; it is the stylesheet, rendered small.

### Contrast, all six ways × both modes

Floors: 4.5:1 for text, 3:1 for the focus ring. `p` = `--primary`, `pFg` = `--primary-foreground`, `aFg/a` = `--accent-foreground` on `--accent`. Nothing clips the sRGB gamut, so no browser is rendering a colour other than the one audited.

| way | hex (light) | p/bg | p/card | p/sidebar | pFg/p | aFg/a | ring/bg | hex (dark) | p/bg | p/card | p/sidebar | pFg/p | aFg/a | ring/bg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pine (165) | #076246 | 6.93 | 7.41 | 6.50 | 6.99 | 11.25 | 4.18 | #75cca7 | 9.95 | 9.21 | 10.18 | 9.74 | 11.82 | 6.88 |
| ember (55) | #78431b | 7.50 | 8.01 | 7.03 | 7.56 | 11.56 | 4.47 | #e9a679 | 9.29 | 8.60 | 9.50 | 9.19 | 11.90 | 6.48 |
| moss (118) | #4e5916 | 7.12 | 7.61 | 6.68 | 7.18 | 11.36 | 4.27 | #b1c075 | 9.73 | 9.01 | 9.95 | 9.56 | 11.85 | 6.75 |
| ocean (250) | #275582 | 7.25 | 7.74 | 6.80 | 7.31 | 11.43 | 4.33 | #85bcf5 | 9.59 | 8.87 | 9.81 | 9.45 | 11.87 | 6.66 |
| purple (293.61) | #55487f | 7.51 | 8.03 | 7.04 | 7.58 | 11.56 | 4.47 | #baabf2 | 9.28 | 8.59 | 9.49 | 9.19 | 11.91 | 6.47 |
| rose (350) | #773c59 | 7.65 | 8.17 | 7.17 | 7.71 | 11.63 | 4.55 | #e89dc0 | 9.11 | 8.43 | 9.32 | 9.04 | 11.93 | 6.37 |

### What each way collides with

The palette was already dense; every new hue lands near something. Written down rather than discovered later:

| way | nearest existing token | separation |
|---|---|---|
| ember (55) | `--chart-4`, the data-viz amber | 15° |
| moss (118) | `--tag-action` / `--event-8` | 8° / 2° |
| ocean (250) | `--event-1`, `--mercantile` | 0° / 15° |
| purple (293.61) | `--warning` / `--holiday` / `--chart-1` | 0° |
| rose (350) | `--tag-term` / `--event-6` | 0° / 10° |

The `--event-*` and `--tag-*` ramps are identity and taxonomy colours that always ship with a name or an icon, so a shared hue costs nothing there. **Purple is the one that costs something:** on that way the working colour and the attention colour are the same hue, told apart by lightness and chroma alone — the exact narrowing the `--warning` comment in globals.css warns about. Shipped anyway, because the alternative was a second, different purple in an app that already has one, and because every `--warning` surface carries its own word ("Owed", "Near capacity") rather than relying on hue (WCAG 1.4.1). **Anyone retuning `--warning` should move it away from 293.61.**

## Adopted where

| Surface | Treatment |
|---|---|
| `(app)/layout.tsx` | `MotionProvider` + `RouteTransition` inside `<main>`, so the sidebar and header stay put across navigations |
| Dashboard | `Reveal` per zone, **inside** each Suspense boundary — a reveal around the boundary would animate the skeleton |
| People directory | `Stagger as="ul"` with `count`, so a 90-person roster keeps the budget |
| Meetings list | `Stagger as="ul"` over the day's meetings |
| Worklog pending absences | `PresenceList` — withdraw removes a row from under the cursor, and 120ms is what makes it clear *which* row left |

`as` on the primitives is not a convenience: these lists are `<ul>`/`<li>`, and a `<div>` wrapper around an `<li>` is invalid markup that also breaks the "list, 12 items" a screen reader announces.

## Accessibility

- **All 16 loading routes now announce.** Six announced nothing: a route change is silent to a screen reader, the URL moves and the DOM fills with `aria-hidden` placeholders. Each now carries the `sr-only` `role="status"` the other ten already used.
- `activity/loading.tsx` hand-rolled the shimmer `Skeleton` exists to own — replaced.
- Colourway swatches are labelled by name, checked with a `Check` glyph, and selected through native radios inside a `<fieldset>`, matching the theme group directly above.
- Withdraw's pending state now changes its **label** ("Withdrawing…") and sets `aria-busy`. A disabled button with a spinning `aria-hidden` icon is silent.

### Known gap, not fixed here

**51 of 74 spinners app-wide have no reduced-motion handling**, and nearly all are `aria-hidden` icons whose busy state is announced nowhere. The blanket fix — adding `motion-reduce:animate-none` to all of them — was **deliberately not applied**: for the sites with no text label, it would remove the only busy indicator a reduced-motion reader gets, trading a motion complaint for a worse accessibility one. The correct fix is per-site (label + `aria-busy`, as done on withdraw) across 31 files, which is its own change.

## Guards

New tests, all of them the kind that fail when someone forgets rather than when someone breaks:

- `transitions.test.ts` — the JS motion tokens must equal the CSS ones; every `motion/react` import must be in a `'use client'` file; nothing may import `framer-motion` directly (it arrives as a transitive dependency, so importing it works and would split the app across two copies of the runtime).
- `accent-tokens.test.ts` — every way in `ACCENTS` has both blocks; every block in the CSS is offered by the picker; the default has no block; all ways override the same token set; no way touches a surface or semantic token.

The client-boundary guard found `src/hooks/use-is-in-view.tsx` importing `motion/react` with no `'use client'` on its first run. Harmless today (only client components reach it) and a confusing build failure the day a Server Component does. Marked, one line.
