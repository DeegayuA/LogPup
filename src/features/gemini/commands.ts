import { KeyRound, Sparkles } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * What Gemini contributes to the palette.
 *
 * Its old exemption said key management "lives on /profile". That was not
 * merely stale — it was WRONG once the keys card moved to /settings, and an
 * exemption that names the wrong page is worse than none, because the next
 * person writes their row from it and ships a link to where the thing used to
 * be. Retired rather than reworded.
 *
 * PLAIN /settings, NOT /settings#gemini. The fragment was the obvious thing to
 * write and there is no element carrying that id — the link would land at the
 * top of the page and look like it had failed. A row that half-works is worse
 * than a row that goes somewhere honest, so this points at the page until an
 * anchor exists to point into.
 *
 * NO PER-FEATURE TOGGLES YET, deliberately. Rows like "Turn off read-aloud"
 * need each feature's current state to name the state they will leave you in,
 * the way the go-shortcuts row does — but that lives in the database per user,
 * not in client state, so PaletteContext would have to carry server-fetched
 * prefs. That is a contract change and belongs in one deliberate pass with the
 * current-app extension, not folded in here.
 */
export const commands: CommandDescriptor[] = [
  {
    id: 'gemini.keys',
    label: 'Manage Gemini keys',
    keywords: ['api key', 'byok', 'gemini', 'ai key', 'add key'],
    group: 'navigate',
    icon: KeyRound,
    href: '/settings',
  },
  {
    id: 'gemini.features',
    label: 'AI features and usage',
    keywords: ['ai settings', 'turn off ai', 'read aloud', 'dictation', 'cost', 'tokens'],
    group: 'navigate',
    icon: Sparkles,
    href: '/settings',
  },
]
