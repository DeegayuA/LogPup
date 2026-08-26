'use client'

/**
 * "Heard as Hasith — who was that?", rendered under the sentence it is about.
 *
 * The compact twin of `UnattributedRow` (meeting-intel.tsx), which is the same
 * control in a full-width card that re-prints the sentence. That card exists
 * because unattributed items used to live in a panel of their own; the cost was
 * that a meeting showed the same twelve sentences twice — once under Action
 * items and For next meeting, once again under Needs attribution — and the
 * place you could FIX the attribution was the copy furthest from the content.
 *
 * This version carries no text of its own. It attaches to the row that already
 * says the words, so a sentence appears once and the control that resolves it
 * is on it. `UnattributedRow` stays for the leftovers — items whose wording
 * matched no rendered row (see unplacedUnattributed) — which have nothing to
 * attach to and would otherwise become unreachable.
 *
 * Both write through the same `attributeFollowup`. There is no second write
 * path and no second notion of what "attributed" means.
 */
import { useState } from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MeetingPeoplePicker } from '@/features/meetings/components/meeting-people-picker'
import type { FollowupPersonOption, UnattributedFollowupView } from '@/features/meetings/ai-actions'

/**
 * Everything the inline pickers need, bundled — one optional prop on
 * MeetingAiNotes rather than six, and one thing to pass or omit entirely for a
 * caller (the calendar's read-only notes dialog) that has no write path.
 */
export type AttributionContext = {
  /** Unattributed follow-ups keyed by kind + normalized text — see
   *  indexUnattributedByText in followups.ts. */
  index: Map<string, UnattributedFollowupView>
  /** People on this meeting. Offered first, under their own heading. */
  attendees: FollowupPersonOption[]
  /** Everyone else approved — never blocked, because the name the model heard
   *  is routinely somebody who was not in the room ("with Shani's assistance"). */
  people: FollowupPersonOption[]
  canWrite: boolean
  /** Which row is mid-write, so only that one's button spins. */
  busyId: string | null
  onAttribute: (followupId: string, userId: string) => void
}

export function AttributionInline({
  item,
  context,
}: {
  item: UnattributedFollowupView
  context: AttributionContext
}) {
  const [personId, setPersonId] = useState<string | null>(null)
  const busy = context.busyId === item.id

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <AlertCircle className="size-3.5 shrink-0 text-warning" aria-hidden />
        {/* States what IS known (a name was heard) alongside what is not (whose
            it is), rather than a bare warning. The name is quoted because it is
            the transcript's word, not a person this app has identified. */}
        Heard as &ldquo;{item.personName}&rdquo; — not matched to anyone yet.
      </span>
      {context.canWrite ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <MeetingPeoplePicker
            value={personId}
            onValueChange={setPersonId}
            attendees={context.attendees}
            people={context.people}
            label={`Who “${item.text}” is for`}
            size="sm"
            unassignedLabel="Pick a person"
            className="h-8 w-40 border-input px-2"
          />
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={busy || !personId}
            onClick={() => personId && context.onAttribute(item.id, personId)}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            Attribute
          </Button>
        </span>
      ) : (
        // Same shape as the gated branch in UnattributedRow: say who can, never
        // render the row as if it were simply broken.
        <span>Only the organizer or an admin can attribute this.</span>
      )}
    </span>
  )
}
