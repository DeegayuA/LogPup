'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, HelpCircle, Link2, Video, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { respondToMeeting, setMeetingLink } from '@/features/meetings/rsvp-actions'

export type AttendeeResponse = 'pending' | 'going' | 'maybe' | 'declined'

/*
 * The three RSVP states, each on the status token that means what it means —
 * and each with a paired foreground that actually contrasts against it.
 *
 * What was here before: "Going" borrowed --primary (the app's action colour,
 * not a state), "Maybe" borrowed --chart-1 (the data-viz ember ramp, ~3.5:1
 * behind 12px text in light mode), and "Can't" referenced
 * --destructive-foreground, which no stylesheet defined — Tailwind emitted
 * nothing for it and the pill rendered with whatever colour it inherited,
 * measuring ~3.5:1 in light and ~2.6:1 in dark. All three now clear 4.5:1;
 * see the token block in globals.css for the measurements.
 */
const OPTIONS = [
  { id: 'going', label: 'Going', icon: Check, active: 'bg-success text-success-foreground' },
  { id: 'maybe', label: 'Maybe', icon: HelpCircle, active: 'bg-warning text-warning-foreground' },
  { id: 'declined', label: "Can't", icon: X, active: 'bg-destructive text-destructive-foreground' },
] as const

export function MeetingRsvp({
  meetingId,
  meetingUrl,
  myResponse,
  canEditLink,
  isAttendee = true,
}: {
  meetingId: string
  meetingUrl: string | null
  myResponse: AttendeeResponse
  canEditLink: boolean
  /** RSVP buttons only make sense for people actually invited. */
  isAttendee?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(meetingUrl ?? '')

  function respond(id: (typeof OPTIONS)[number]['id']) {
    startTransition(async () => {
      const res = await respondToMeeting(meetingId, id)
      if (res.ok) router.refresh()
      else toast.error(res.error)
    })
  }

  function saveLink() {
    startTransition(async () => {
      const res = await setMeetingLink(meetingId, draft.trim())
      if (res.ok) {
        setEditing(false)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {meetingUrl ? (
        <a
          href={meetingUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
        >
          <Video className="size-4" /> Join
        </a>
      ) : null}

      {isAttendee ? (
      <div role="group" aria-label="Your RSVP" className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
        {OPTIONS.map((o) => {
          const active = myResponse === o.id
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => respond(o.id)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                active ? o.active : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <o.icon className="size-3.5" />
              {o.label}
            </button>
          )
        })}
      </div>
      ) : null}

      {canEditLink ? (
        editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="https://meet.google.com/…"
              autoComplete="off"
              className="h-8 w-56"
            />
            <Button size="sm" onClick={saveLink} disabled={pending}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="gap-1.5 text-muted-foreground">
            <Link2 className="size-3.5" /> {meetingUrl ? 'Edit link' : 'Add link'}
          </Button>
        )
      ) : null}
    </div>
  )
}
