'use client'

import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MeetingList } from '@/features/meetings/components/meeting-list'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

export function PastMeetingsSection({
  meetings,
  currentUserId,
  isAdmin,
  users,
}: {
  meetings: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  /** Mention pool for the notes editor — all active users. */
  users?: MentionUser[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <section className="flex flex-col gap-3">
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="w-fit"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDownIcon className={cn('transition-transform', open && 'rotate-180')} />
        Past meetings ({meetings.length})
      </Button>
      {open ? (
        <MeetingList
          meetings={meetings}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          users={users}
        />
      ) : null}
    </section>
  )
}
