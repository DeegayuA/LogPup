'use client'

import * as React from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPersonSummary } from '@/features/people/summary-actions'
import type { PersonSummary } from '@/features/people/summary'
import { cn } from '@/lib/utils'

/**
 * The short read on a person, above the fold.
 *
 * First paint is the DERIVED summary the server computed from views the page
 * had already loaded — no round trip, no skeleton, and it is correct on its
 * own. The client then asks once for the AI rewrite and swaps it in if one
 * comes back; when the feature is off or a key is down, that request returns
 * the same derived text and the swap is invisible. The card therefore has no
 * empty state at all — the only states are "the facts" and "the facts, better
 * written".
 */
export function PersonSummaryCard({
  personId,
  initial,
}: {
  personId: string
  initial: PersonSummary
}) {
  const [summary, setSummary] = React.useState(initial)
  const [refreshing, setRefreshing] = React.useState(false)
  // Inline, beside the text it failed to replace — a toast would outlive the
  // page position the reader needs to see the stale copy in.
  const [error, setError] = React.useState<string | null>(null)
  const asked = React.useRef(false)

  const upgrade = React.useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true)
    setError(null)
    try {
      const res = await getPersonSummary(personId)
      if (res.ok) setSummary(res.data)
      else if (isRefresh) setError(res.error)
      // A failed silent upgrade stays silent: the derived text on screen is
      // already true, and an error banner over correct words would report a
      // problem the reader does not have.
    } catch {
      if (isRefresh) setError('Could not refresh this summary — try again')
    } finally {
      if (isRefresh) setRefreshing(false)
    }
  }, [personId])

  React.useEffect(() => {
    // Once per mount, StrictMode included — this is an upgrade request, and
    // asking twice spends a metered AI call to learn nothing new.
    if (asked.current) return
    asked.current = true
    void upgrade(false)
  }, [upgrade])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          In short
        </CardTitle>
        <CardAction>
          <span className="flex items-center gap-1.5">
            {/* Which kind of words these are. 'ai' names the model because a
                generated sentence must never pass as something a person
                wrote; derived text is the page's own numbers, said aloud. */}
            <span className="text-2xs text-muted-foreground">
              {summary.source === 'ai' ? (summary.model ?? 'AI') : 'from the numbers'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Refresh summary"
              disabled={refreshing}
              onClick={() => void upgrade(true)}
            >
              <RefreshCw
                className={cn(refreshing && 'animate-spin motion-reduce:animate-none')}
                aria-hidden
              />
            </Button>
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className={cn('text-sm leading-relaxed', refreshing && 'opacity-60')}>{summary.text}</p>
        {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
