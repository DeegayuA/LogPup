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
 * Height is fixed at `min-h-32` on purpose. A card that swaps between empty and
 * populated at the same size is what keeps the two-column grid from re-flowing
 * as data arrives — the same reason the skeleton models these exact blocks.
 */
export function SectionEmpty({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon
  title: string
  hint: string
}) {
  return (
    <CardContent className="flex min-h-32 flex-col items-center justify-center gap-1.5 py-6 text-center">
      <Icon className="size-5 text-muted-foreground/50" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>
    </CardContent>
  )
}
