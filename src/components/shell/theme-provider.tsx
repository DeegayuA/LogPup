'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark' | 'system'
/** What `system` currently resolves to — never `'system'` itself. */
export type ResolvedTheme = 'light' | 'dark'

/**
 * Which hue the product wears. Orthogonal to light/dark on purpose: a way
 * moves --primary/--accent/--ring and nothing else, so the six of them
 * multiply with the two modes instead of forking them. See the COLOURWAYS
 * block in app/globals.css for the token contract and the contrast audit.
 */
export type Accent = 'pine' | 'ember' | 'moss' | 'ocean' | 'purple' | 'rose'

/**
 * The list, in picker order, and the only thing that decides what is a valid
 * way. The pre-hydration script below reads it too, so a way added here shows
 * up in both readers or in neither.
 */
export const ACCENTS: readonly Accent[] = [
  'pine',
  'ember',
  'moss',
  'ocean',
  'purple',
  'rose',
]

/**
 * Pine is the studio's own colour and the one :root already declares, so it
 * is both the default and the way with no CSS block of its own.
 */
export const DEFAULT_ACCENT: Accent = 'pine'

/**
 * The one place the storage key is written down.
 *
 * The pre-hydration script in app/layout.tsx and this provider MUST agree on
 * it: they are two readers of the same value, running either side of
 * hydration, and a drift between them is a theme that flashes on every load.
 * Importing one constant into both is what makes that drift impossible —
 * which was the standing objection to hand-rolling this at all.
 */
export const THEME_STORAGE_KEY = 'logpup.theme'

/**
 * Separate key from the theme's, not a merged object.
 *
 * The two choices are independent — someone on dark + ocean who switches to
 * light keeps ocean — and a single JSON blob would mean the pre-paint script
 * has to parse before it can apply, plus a migration the first time either
 * half's shape changes. Two scalar reads cost the same and can fail apart.
 */
export const ACCENT_STORAGE_KEY = 'logpup.accent'

const MEDIA = '(prefers-color-scheme: dark)'

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * The theme re-apply below must land BEFORE paint, which only the layout
 * variant guarantees — but React logs a warning when `useLayoutEffect` runs
 * during SSR, where it does nothing useful anyway. Swapping by environment is
 * the standard way to have both.
 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isAccent(value: unknown): value is Accent {
  return ACCENTS.includes(value as Accent)
}

/**
 * The script that runs BEFORE first paint, inlined into `<head>`.
 *
 * Why a string rather than a component: React 19 warns whenever it meets a
 * `<script>` while rendering a component on the client, because it will not
 * execute one there. `next-themes` renders exactly such a script inside its
 * provider and offers no way to turn it off (`scriptProps` is spread before
 * its own props, so it cannot override them) — which is where that console
 * error came from. Rendered here into `<head>` from a Server Component, this
 * script is part of the initial HTML and is never client-rendered, so there
 * is nothing for React to warn about.
 *
 * Deliberately tiny and defensive: it runs before anything else on the page,
 * so a throw here is a blank screen. Private-mode `localStorage` access
 * throws on read, hence the try/catch, and the fallback is the system
 * preference rather than a hardcoded light.
 *
 * THE ACCENT IS READ HERE, not in the provider, for exactly the reason the
 * theme is. A way is a set of custom-property overrides on <html>; applied a
 * tick after hydration instead of before first paint, every load would show
 * pine and then flip to the reader's actual colour — the same flash this
 * script exists to prevent, in a different token. It is validated against
 * ACCENTS rather than written through, so a stale or hand-edited storage
 * value lands on a way that has CSS behind it instead of an attribute
 * nothing matches.
 */
export const themeInitScript = `
(function() {
  try {
    var root = document.documentElement;
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark' ? stored
      : (window.matchMedia('${MEDIA}').matches ? 'dark' : 'light');
    root.classList.add(theme);
    root.style.colorScheme = theme;
    var ways = ${JSON.stringify(ACCENTS)};
    var accent = localStorage.getItem('${ACCENT_STORAGE_KEY}');
    root.setAttribute('data-accent', ways.indexOf(accent) > -1 ? accent : '${DEFAULT_ACCENT}');
  } catch (e) {}
})();
`

type ThemeContextValue = {
  /** What the user chose — including `'system'`. */
  theme: Theme
  /** What that currently means on screen. `null` until mounted. */
  resolvedTheme: ResolvedTheme | null
  setTheme: (theme: Theme) => void
  /**
   * Which way is on. Never null, unlike `resolvedTheme`: the server and the
   * first client render both answer DEFAULT_ACCENT, which is exactly what the
   * markup they produce is styled as, and the layout effect below corrects it
   * before paint. So a consumer can render a checked radio from this without
   * the two-render dance the theme needs.
   */
  accent: Accent
  setAccent: (accent: Accent) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(MEDIA).matches ? 'dark' : 'light'
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  // Both classes are removed first: toggling light→dark→light would otherwise
  // leave `class="light dark"` and let CSS order decide the theme.
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  // Tells the browser which built-in control palette to use, so form controls,
  // scrollbars and the like follow the app instead of the OS.
  root.style.colorScheme = resolved
}

/**
 * Written as an attribute rather than a class so the way and the mode occupy
 * different namespaces on <html> — `.dark[data-accent='ocean']` reads as the
 * two independent axes it is, where a second class would leave the CSS
 * guessing which of two class names meant what.
 */
function applyAccent(accent: Accent) {
  document.documentElement.setAttribute('data-accent', accent)
}

/**
 * Theme state for the app: the user's choice, what it resolves to, and the
 * DOM side effects that make it visible.
 *
 * Replaces `next-themes`, whose only remaining job here was this — and which
 * could not stop emitting a client-rendered `<script>` that React 19 warns
 * about on every load. The behaviour it provided is preserved exactly:
 * `system` follows the OS live, the choice survives reloads, and the class is
 * on `<html>` before first paint so there is no flash.
 *
 * `resolvedTheme` is `null` on the server and on the first client render,
 * because the real answer lives in `localStorage`/`matchMedia` and reading
 * either during render would make the markup disagree with the HTML the
 * script already produced. Consumers showing a light/dark-specific icon
 * should wait for it (see theme-toggle.tsx).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme | null>(null)
  const [accent, setAccentState] = useState<Accent>(DEFAULT_ACCENT)

  // Adopt whatever the pre-hydration script already decided — and re-apply it.
  //
  // Teaching React the value is only half the job. React Strict Mode remounts
  // once in development and, on that remount, resets <html> to the attributes
  // it manages from JSX — dropping the class the parser-time script set (see
  // "Re-applying attributes in development" in Next preventing-flash guide).
  // A layout effect runs before paint, so the re-apply is invisible; in
  // production, where there is no remount, it is a no-op that rewrites the
  // class it already had.
  useIsomorphicLayoutEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY)
    } catch {
      // Private mode / storage disabled — fall through to 'system'.
    }
    const next = isTheme(stored) ? stored : 'system'
    setThemeState(next)
    const resolved = next === 'system' ? systemTheme() : next
    setResolvedTheme(resolved)
    applyTheme(resolved)

    // Same adopt-and-re-apply for the way, and in the same effect rather than
    // a second one: they are read from the same storage at the same moment,
    // and splitting them would let a future edit reorder them relative to
    // paint. The Strict Mode remount that drops the theme class drops this
    // attribute too — <html> is rendered from JSX in app/layout.tsx, so React
    // owns its attributes on remount.
    let storedAccent: string | null = null
    try {
      storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY)
    } catch {
      // Same private-mode case as the theme above: fall through to the default.
    }
    const nextAccent = isAccent(storedAccent) ? storedAccent : DEFAULT_ACCENT
    setAccentState(nextAccent)
    applyAccent(nextAccent)
  }, [])

  // Follow the OS while (and only while) the choice is 'system'.
  useEffect(() => {
    if (theme !== 'system') return
    const media = window.matchMedia(MEDIA)
    const onChange = () => {
      const resolved = media.matches ? 'dark' : 'light'
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // The choice still applies for this session; it just won't survive a
      // reload. Losing persistence is not a reason to refuse the toggle.
    }
    const resolved = next === 'system' ? systemTheme() : next
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next)
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, next)
    } catch {
      // The way still applies for this session; it just won't survive a
      // reload. Same trade the theme makes directly above.
    }
    applyAccent(next)
  }, [])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, accent, setAccent }),
    [theme, resolvedTheme, setTheme, accent, setAccent],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
