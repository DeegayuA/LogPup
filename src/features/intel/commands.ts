import { MessageCircleQuestion, Radar, SunMedium } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'

/**
 * What Intel contributes to the command center.
 *
 * /intel itself already reaches the palette from the nav registry, so these
 * three rows exist for the reason a second row under People does: the page
 * holds three distinct things and only one of them is what you came for. The
 * hrefs carry the region in the fragment, so the row lands you on the panel
 * you asked for instead of the top of the page.
 *
 * All three are `navigate`, not `command`: none of them writes anything, so
 * none needs `invalidateSearch` — they put you somewhere. The ask row in
 * particular looks like a verb but is not one; the palette has no question to
 * send, so the honest row is the one that hands you the box to type it in.
 *
 * No `visible` gate: /intel is open to every signed-in seat, and it restates
 * rows the dashboard already shows the same reader.
 *
 * ADDING A ROW THAT ACTUALLY DOES SOMETHING? Import the action lazily, inside
 * `run`: `const { x } = await import('@/features/intel/actions')`. A static
 * import of a 'use server' module pulls next-auth into the module graph of
 * everything that reads this registry, and the first casualty is
 * registry.test.ts, which runs in a node environment and dies at IMPORT time
 * with "Cannot find module 'next/server' imported from next-auth/lib/env.js".
 * Not a type error, not a lint error — a crash in the guard that exists to
 * protect this file. The rule does not bite today only because none of the
 * three rows below calls anything.
 */
export const commands: CommandDescriptor[] = [
  {
    id: 'intel.ask',
    label: 'Ask LogPup…',
    keywords: ['ask', 'question', 'query workspace', 'what should i do', 'ai', 'chat', 'assistant'],
    group: 'navigate',
    icon: MessageCircleQuestion,
    // app/(app)/intel/page.tsx anchors the ask panel at #ask.
    href: '/intel#ask',
  },
  {
    id: 'intel.briefing',
    label: "Today's briefing",
    keywords: ['briefing', 'brief', 'daily', 'summary', 'standup', 'what happened', 'morning'],
    group: 'navigate',
    icon: SunMedium,
    href: '/intel#briefing',
  },
  {
    id: 'intel.signals',
    label: 'Studio signals',
    keywords: ['signals', 'alerts', 'warnings', 'attention', 'at risk', 'overdue', 'what needs me'],
    group: 'navigate',
    icon: Radar,
    href: '/intel#signals',
  },
]
