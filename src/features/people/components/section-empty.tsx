import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CardContent } from '@/components/ui/card'

/**
 * The one empty state every card on the person page uses.
 *
 * It exists because the previous page had five hand-rolled ones that had
 * already drifted — different paddings, some centred and some not, some with an
 * icon — so the page visibly twitched depending on which sections happened to
 * be empty. One component means one vertical rhythm, and a `hint` that is
 * REQUIRED rather than optional: an empty state with nothing but a headline is
 * a dead end, and rule 6 exists to stop those shipping.
 *
 * `action` is the other half of that rule, and it is OPTIONAL because the two
 * kinds of empty want opposite things:
 *
 *   - A DEAD END — the reader came for something, found nothing, and there is
 *     a real next step somewhere else in the product. Offer it. "No meetings
 *     either side of today" is one: the meetings list is a click away and the
 *     card cannot show it.
 *   - GOOD NEWS — "nothing outstanding", "nobody went over capacity", "all
 *     their tasks are closed". Leave these prose-only. A button under a
 *     positive state invents work that nobody asked for, and it teaches the
 *     reader that the app nags.
 *
 * Omit it too when the next step is gated: the action must be one the reader
 * can actually take. If the card does not already know their role, it does not
 * know that, and prose is the honest answer.
 *
 * Height is fixed at `min-h-32` on purpose. A card that swaps between empty and
 * populated at the same size is what keeps the two-column grid from re-flowing
 * as data arrives — the same reason the skeleton models these exact blocks. An
 * action grows the block past that floor, which is why it is worth one only at
 * the sites above.
 */
export function SectionEmpty({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon
  title: string
  hint: string
  action?: ReactNode
}) {
  return (
    <CardContent className="flex min-h-32 flex-col items-center justify-center gap-1.5 py-6 text-center">
      <Icon className="size-5 text-muted-foreground/50" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>
      {action ? <div className="pt-1">{action}</div> : null}
    </CardContent>
  )
}
