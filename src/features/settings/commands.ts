import { Keyboard, Monitor, Moon, Sun } from 'lucide-react'
import type { Theme } from '@/components/shell/theme-provider'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * The appearance and keyboard switches, owned by the feature that owns the
 * Settings page rather than left inline in the palette.
 *
 * These are the two rows that need to know what state they are ALREADY in —
 * which is why PaletteContext carries `theme` and `goShortcutsOn`. A switch
 * that says "toggle" makes you press it to find out; one that says "Turn off
 * go-to shortcuts" is also the answer to "are they on right now?".
 */

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Theme: light', icon: Sun },
  { value: 'dark', label: 'Theme: dark', icon: Moon },
  { value: 'system', label: 'Theme: system', icon: Monitor },
]

export const commands: CommandDescriptor[] = [
  ...THEMES.map(
    (theme): CommandDescriptor => ({
      id: `settings.theme.${theme.value}`,
      label: theme.label,
      keywords: ['theme', 'appearance', 'dark mode', 'light mode', 'contrast'],
      group: 'command',
      icon: theme.icon,
      run: ({ setTheme, close }) => {
        setTheme(theme.value)
        close()
      },
      /* The theme you are already on is not a command, it is the status quo —
         and hiding it keeps the other two one keystroke closer. */
      visible: (ctx) => ctx.theme !== theme.value,
    }),
  ),
  {
    id: 'settings.go-shortcuts',
    label: (ctx) =>
      ctx.goShortcutsOn
        ? 'Turn off go-to shortcuts (g + key)'
        : 'Turn on go-to shortcuts (g + key)',
    keywords: ['keyboard', 'jump', 'shortcuts', 'single key', 'accessibility'],
    group: 'command',
    icon: Keyboard,
    run: ({ setGoShortcuts, close }, ctx) => {
      setGoShortcuts(!ctx.goShortcutsOn)
      close()
    },
  },
]
