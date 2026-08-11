'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

/* One-click light/dark flip (no dropdown). System preference still applies
   until the first click; the ⌘K palette keeps the explicit
   light/dark/system commands for anyone who wants system back. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // resolvedTheme is undefined on the server; render a stable button until
  // hydration so the icon never flashes the wrong state.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard next-themes mounted guard
  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === 'dark'

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
