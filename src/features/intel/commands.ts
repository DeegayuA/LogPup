import { MessageCircleQuestion, Radar, SunMedium } from 'lucide-react'
import type { CommandDescriptor } from '@/features/search/registry/types'
import { openIntelBubble } from '@/features/intel/bubble-bus'

/**
 * What Intel contributes to the command center.
 *
 * THESE USED TO BE THREE `navigate` ROWS pointing at /intel#ask, #briefing and
 * #signals. That page was removed — everything it held now lives in the Ask
 * LogPup bubble, which is mounted once by the app layout and reachable from
 * every screen. So the rows became commands that OPEN the bubble on the half
 * asked for, and Intel no longer contributes a nav destination at all.
 *
 * Each still names its region, so "Today's briefing" lands on the briefing
 * rather than on whichever half happened to be open last time — the same thing
 * the URL fragment used to buy.
 *
 * `openIntelBubble` is a plain window-event dispatcher with no React and no
 * server import, which is what makes a STATIC import safe here. The rule the
 * long note below states is unchanged and still applies to anything that
 * actually touches the database.
 *
 * No `visible` gate: the bubble is open to every signed-in seat, and it
 * restates rows the dashboard already shows the same reader. The bubble itself
 * decides what a seat without AI gets — it falls back to the signals half
 * rather than refusing, because signals are computed without a model.
 *
 * ADDING A ROW THAT ACTUALLY DOES SOMETHING? Import the action lazily, inside
 * `run`: `const { x } = await import('@/features/intel/actions')`. A static
 * import of a 'use server' module pulls next-auth into the module graph of
 * everything that reads this registry, and the first casualty is
 * registry.test.ts, which runs in a node environment and dies at IMPORT time
 * with "Cannot find module 'next/server' imported from next-auth/lib/env.js".
 * Not a type error, not a lint error — a crash in the guard that exists to
 * protect this file.
 */
export const commands: CommandDescriptor[] = [
  {
    id: 'intel.ask',
    label: 'Ask LogPup…',
    keywords: ['ask', 'question', 'query workspace', 'what should i do', 'ai', 'chat', 'assistant'],
    group: 'navigate',
    icon: MessageCircleQuestion,
    run: () => openIntelBubble({ view: 'ask' }),
  },
  {
    id: 'intel.briefing',
    label: "Today's briefing",
    keywords: ['briefing', 'brief', 'daily', 'summary', 'standup', 'what happened', 'morning'],
    group: 'navigate',
    icon: SunMedium,
    run: () => openIntelBubble({ view: 'intel', region: 'briefing' }),
  },
  {
    id: 'intel.signals',
    label: 'LogPup signals',
    keywords: ['signals', 'alerts', 'warnings', 'attention', 'at risk', 'overdue', 'what needs me'],
    group: 'navigate',
    icon: Radar,
    run: () => openIntelBubble({ view: 'intel', region: 'signals' }),
  },
]
