'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { SearchSelect } from '@/components/ui/search-select'
import { deleteMeetingFromDanger } from '@/features/admin/danger-actions'
import { deleteMeetingPhrase, deleteMeetingSummary } from '@/features/admin/danger-logic'
import { DangerConfirmControl } from '@/features/admin/components/danger-confirm-control'

export type DangerMeetingOption = { id: string; title: string; startsAt: Date }

/**
 * The recoverable control, and therefore the first destructive one on the page.
 *
 * The phrase is the meeting's own title. A constant word would be typed from
 * memory after the second use, and the mistake worth catching here is not
 * "meant to keep it" but "had the wrong meeting selected" — which only reading
 * the title in front of you catches.
 */
export function DangerMeetingDeleteCard({ meetings }: { meetings: DangerMeetingOption[] }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = meetings.find((m) => m.id === selectedId) ?? null

  return (
    <DangerConfirmControl
      title="Delete a meeting"
      lead={
        <>
          Moves one meeting to Trash and cancels its calendar invite for the guests. An
          admin can restore it from Trash — the notes, keyframes and attendees come back
          with it, though the invite is not re-sent.
        </>
      }
      radius={deleteMeetingSummary(selected?.title ?? 'The meeting')}
      phrase={selected ? deleteMeetingPhrase(selected) : ''}
      phraseLabel="the meeting's title"
      openLabel="Delete this meeting…"
      confirmLabel="Move to Trash"
      pendingLabel="Deleting…"
      emptyMessage={meetings.length === 0 ? 'There are no meetings to delete.' : null}
      onConfirm={async (confirm) => {
        if (!selected) return
        try {
          const res = await deleteMeetingFromDanger(selected.id, confirm)
          if (!res.ok) {
            toast.error(res.error)
            return
          }
          toast.success(`${res.data.title} moved to Trash`)
          setSelectedId(null)
          router.refresh()
        } catch {
          toast.error('Something went wrong — try again')
        }
      }}
    >
      <div className="flex flex-col gap-1">
        <span className="text-2xs text-muted-foreground">
          The {meetings.length} most recent meetings. Older ones are deleted from the
          meeting itself.
        </span>
        {/* Searchable, and here that is a SAFETY property rather than a
            convenience. The meeting list only grows, the action is destructive,
            and picking by scrolling is how somebody deletes the row above the
            one they meant. Typing narrows to the intended meeting before the
            confirm step is reached. The date is in the hint and therefore
            searchable too, which is how you tell two standups apart. */}
        <SearchSelect
          value={selectedId ?? ''}
          onValueChange={setSelectedId}
          options={meetings.map((meeting) => ({
            value: meeting.id,
            label: meeting.title,
            hint: format(meeting.startsAt, 'd MMM yyyy, HH:mm'),
          }))}
          placeholder="Choose a meeting"
          searchPlaceholder="Search meetings…"
          emptyText="No meeting by that name or date."
          aria-label="Select a meeting to delete"
          className="h-9 max-w-sm"
        />
      </div>
    </DangerConfirmControl>
  )
}
