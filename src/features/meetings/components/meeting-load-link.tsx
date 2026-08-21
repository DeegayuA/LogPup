import Link from 'next/link'
import { Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMeetingLoadSuggestions } from '@/features/meetings/load-actions'

/**
 * The way into /meetings/load from the meetings page.
 *
 * THE LABEL STATES THE FINDING, not the feature. "4 meetings could be 2" gets
 * pressed; "Coverage optimiser" does not, because nobody knows in advance
 * whether they need one. When the sweep finds nothing the button falls back to
 * naming the page — a button that shouted a zero would be worse than one that
 * said nothing.
 *
 * SERVER COMPONENT, MEANT TO BE SUSPENDED. The sweep behind the label is a
 * batch of aggregate reads and the meetings page must not wait on it, so the
 * caller wraps this in Suspense with `MeetingLoadLinkFallback` — which is the
 * same button at the same size, already pointing at the same route. The label
 * upgrades in place when the count lands; nothing moves.
 */
export async function MeetingLoadLink() {
  const result = await getMeetingLoadSuggestions()
  // A reader who may not see the board still gets the plain route: the page
  // itself says why it is empty for them, which is a better answer than a
  // button that silently disappears.
  const headline = result.ok ? result.data.headline : null

  return (
    <Button
      variant={headline ? 'secondary' : 'outline'}
      className="font-medium"
      render={<Link href="/meetings/load" />}
    >
      <Layers aria-hidden className="size-4" />
      {headline ?? 'Meeting load'}
    </Button>
  )
}

/** The same button, before the count is known. Same size, same destination, so
 *  the header does not reflow when the real label arrives. */
export function MeetingLoadLinkFallback() {
  return (
    <Button variant="outline" className="font-medium" render={<Link href="/meetings/load" />}>
      <Layers aria-hidden className="size-4" />
      Meeting load
    </Button>
  )
}
