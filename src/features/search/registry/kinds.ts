import type { ComponentType } from 'react'
import { AppWindow, CalendarDays, FileText, SquareKanban, Timer, User } from 'lucide-react'
import type { PaletteRecent } from './types'

/**
 * How each kind of result looks. Client side, and separate from the providers
 * that produce the results, because a provider runs on the server and a React
 * component cannot be handed back across that boundary.
 *
 * This is also what recents render from: a recent stores its `type` and until
 * now nothing read it, so every recent wore the same magnifying glass
 * whatever it pointed at.
 */
export type KindMeta = {
  icon: ComponentType<{ className?: string }>
  /**
   * Render the subtitle in the mono face. Identifiers you would type or paste
   * — an app slug — never prose like a job title.
   */
  mono?: boolean
}

export const KIND_META: Record<PaletteRecent['type'], KindMeta> = {
  app: { icon: AppWindow, mono: true },
  person: { icon: User },
  task: { icon: SquareKanban },
  sprint: { icon: Timer },
  meeting: { icon: CalendarDays },
  // Written by no current code path — the `page` kind exists in recents stored
  // by older builds, so it still needs something to render as.
  page: { icon: FileText },
}
