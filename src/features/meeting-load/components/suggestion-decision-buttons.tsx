'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { acceptLoadSuggestion, dismissLoadSuggestion } from '@/features/meeting-load/actions'
import type { SuggestionKind } from '@/features/meeting-load/suggest'

/**
 * The only interactive thing on the organizer's card.
 *
 * ACCEPT DOES NOT APPLY ANYTHING. It records that somebody intends to act and
 * hands back a link into a flow they already own — the deliberate absence of a
 * one-click apply, which is the fix rather than a missing feature. Nothing
 * either button does can change a meeting, its end time, or its invite list.
 */
export function SuggestionDecisionButtons({
  kind,
  targetKey,
  evidence,
  onDecided,
}: {
  kind: SuggestionKind
  targetKey: string
  evidence: Record<string, unknown>
  onDecided?: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function decide(accept: boolean) {
    startTransition(async () => {
      const result = accept
        ? await acceptLoadSuggestion(kind, targetKey, evidence)
        : await dismissLoadSuggestion(kind, targetKey, evidence)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onDecided?.()
      toast.success(
        accept
          ? 'Noted. Make the change where you normally would — nothing has moved yet.'
          : 'Dismissed. This one will not come back.',
      )
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => decide(true)} disabled={isPending}>
        {isPending ? 'Saving…' : 'I’ll do that'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => decide(false)} disabled={isPending}>
        Not worth it
      </Button>
    </div>
  )
}
