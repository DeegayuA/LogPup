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
 * The fragments are real, and were checked before being written. They landed
 * in d407ccc on wrappers rather than inside the cards, with the AI-features one
 * deliberately wrapping the Suspense boundary rather than its child — an anchor
 * that only exists once data resolves is an anchor that misses on a cold
 * navigation, which is exactly when somebody follows a palette row. Both carry
 * scroll-mt-20 so the sticky header does not cover what the fragment scrolled
 * to. Until they existed these pointed at plain /settings, because a link that
 * silently lands at the page top reads as the feature being broken rather than
 * as the link being plain.
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
    href: '/settings#gemini',
  },
  {
    id: 'gemini.features',
    label: 'AI features and usage',
    keywords: ['ai settings', 'turn off ai', 'read aloud', 'dictation', 'cost', 'tokens'],
    group: 'navigate',
    icon: Sparkles,
    href: '/settings#ai-features',
  },
]
