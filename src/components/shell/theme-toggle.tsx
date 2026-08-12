'use client'

import { useTheme } from '@/components/shell/theme-provider'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

/* One-click light/dark flip (no dropdown). System preference still applies
   until the first click; the ⌘K palette keeps the explicit
   light/dark/system commands for anyone who wants system back. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  // `resolvedTheme` is null on the server and until the provider has read
  // localStorage, which is exactly the "not yet known" signal this needs — so
  // there is no separate `mounted` flag to keep in step. Until it resolves the
  // button renders its stable light-icon state, matching the server HTML.
  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <Sun className="scale-100 rotate-0 transition-transform duration-150 dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute scale-0 rotate-90 transition-transform duration-150 dark:scale-100 dark:rotate-0" />
    </Button>
  )
}
