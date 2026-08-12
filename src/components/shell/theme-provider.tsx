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
 * The one place the storage key is written down.
 *
 * The pre-hydration script in app/layout.tsx and this provider MUST agree on
 * it: they are two readers of the same value, running either side of
 * hydration, and a drift between them is a theme that flashes on every load.
 * Importing one constant into both is what makes that drift impossible —
 * which was the standing objection to hand-rolling this at all.
 */
export const THEME_STORAGE_KEY = 'logpup.theme'

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
 */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark' ? stored
      : (window.matchMedia('${MEDIA}').matches ? 'dark' : 'light');
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`

type ThemeContextValue = {
  /** What the user chose — including `'system'`. */
  theme: Theme
  /** What that currently means on screen. `null` until mounted. */
  resolvedTheme: ResolvedTheme | null
  setTheme: (theme: Theme) => void
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

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
