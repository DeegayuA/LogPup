'use client'

import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme, type Theme } from '@/components/shell/theme-provider'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const OPTIONS: {
  value: Theme
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/**
 * The full light / dark / system choice.
 *
 * The header's ThemeToggle is a one-click light↔dark flip that can never get
 * you back to `system` once you've pressed it, and the ⌘K palette hides the
 * third option behind a keystroke phones don't have. This is the surface
 * where all three are visible at once — which is the reason it exists rather
 * than being a fourth copy of the same control.
 *
 * Native radios inside a fieldset, deliberately: arrow-key navigation,
 * roving focus and the "one of these" grouping are all free and correct,
 * where a hand-rolled `role="radiogroup"` of buttons would owe a keyboard
 * implementation. The inputs are visually hidden, not `display:none` — the
 * latter would take them out of the tab order entirely.
 */
export function AppearanceCard() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <Palette className="size-4 shrink-0" aria-hidden />
          Appearance
        </CardTitle>
        <CardDescription>
          Saved in this browser, not on your account — every device you sign in
          from keeps its own choice.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <fieldset>
          <legend className="sr-only">Theme</legend>
          <div className="grid grid-cols-3 gap-2">
            {OPTIONS.map(({ value, label, icon: Icon }) => {
              const selected = theme === value
              return (
                <label
                  key={value}
                  className={cn(
                    'relative flex cursor-pointer flex-col items-center justify-center gap-1.5',
                    'rounded-lg border px-2 py-3 text-sm',
                    'transition-[background-color,border-color,color] duration-150 ease-out',
                    'motion-reduce:transition-none',
                    'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/50',
                    selected
                      ? 'border-primary bg-accent font-medium text-accent-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="logpup-theme"
                    value={value}
                    checked={selected}
                    onChange={() => setTheme(value)}
                    className="sr-only"
                  />
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
                  {/* The checkmark is what makes the selection readable
                      without colour vision — the border and fill only
                      reinforce it (WCAG 1.4.1). */}
                  {selected ? (
                    <Check className="absolute top-1.5 right-1.5 size-3.5 text-primary" aria-hidden />
                  ) : null}
                </label>
              )
            })}
          </div>
        </fieldset>

        {/* `resolvedTheme` is null on the server and until the provider has
            read localStorage — the "not known yet" state, rendered as such
            rather than guessed at, so the sentence never flips from a wrong
            answer to the right one. */}
        <p className="text-xs text-muted-foreground">
          {resolvedTheme === null
            ? 'Checking what this device prefers…'
            : theme === 'system'
              ? `Following this device, which is set to ${resolvedTheme} right now.`
              : `Always ${resolvedTheme}, whatever this device prefers.`}
        </p>
      </CardContent>
    </Card>
  )
}
