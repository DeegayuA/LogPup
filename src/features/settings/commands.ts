import { Keyboard, Monitor, Moon, PanelLeft, Palette, Sun } from 'lucide-react'
import { ACCENTS, type Accent, type Theme } from '@/components/shell/theme-provider'
import { nextSidebarState, sidebarCommandLabel } from '@/components/shell/sidebar-model'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * The appearance and keyboard switches, owned by the feature that owns the
 * Settings page rather than left inline in the palette.
 *
 * These are the rows that need to know what state they are ALREADY in — which
 * is why PaletteContext carries `theme`, `goShortcutsOn` and `sidebar`. A
 * switch that says "toggle" makes you press it to find out; one that says
 * "Turn off go-to shortcuts" is also the answer to "are they on right now?".
 */

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Theme: light', icon: Sun },
  { value: 'dark', label: 'Theme: dark', icon: Moon },
  { value: 'system', label: 'Theme: system', icon: Monitor },
]

/**
 * Title-case for the label, from the way's own id. Six hand-written strings
 * would be a second list to keep in step with ACCENTS, and the one thing that
 * list must never do is disagree with the CSS.
 */
const accentLabel = (accent: Accent) => accent[0].toUpperCase() + accent.slice(1)

export const commands: CommandDescriptor[] = [
  ...ACCENTS.map(
    (accent): CommandDescriptor => ({
      id: `settings.accent.${accent}`,
      label: `Colour: ${accentLabel(accent)}`,
      keywords: ['colour', 'color', 'accent', 'theme', 'palette', 'appearance'],
      group: 'command',
      icon: Palette,
      run: ({ setAccent, close }) => {
        setAccent(accent)
        close()
      },
      /* Same rule the theme rows follow: the way you are already on is the
         status quo, not a command, and hiding it keeps the other five one
         keystroke closer. */
      visible: (ctx) => ctx.accent !== accent,
    }),
  ),
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
    /* The sidebar switch, reachable without finding the 28px button that
       normally throws it — which matters most in the state where that button
       is the only labelled thing left in a 64px column.
       `sidebarCommandLabel` is the same declaration the button's own
       accessible name comes from, so the two cannot end up describing
       opposite moves. */
    id: 'settings.sidebar',
    label: (ctx) => sidebarCommandLabel(ctx.sidebar),
    keywords: ['sidebar', 'navigation', 'nav', 'collapse', 'expand', 'rail', 'layout', 'hide'],
    group: 'command',
    icon: PanelLeft,
    run: ({ setSidebar, close }, ctx) => {
      setSidebar(nextSidebarState(ctx.sidebar))
      close()
    },
  },
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
