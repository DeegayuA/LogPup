'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MentionTextarea, type MentionUser } from '@/components/mention-textarea'
import { deleteMeeting, retryCalendarInvite, updateMeetingNotes } from '@/features/meetings/actions'
import { MeetingIntelPanel } from '@/features/meetings/components/meeting-intel'
import type { MeetingSummary } from '@/features/meetings/queries'

export function MeetingList({
  meetings,
  currentUserId,
  isAdmin,
  showAppBadge = true,
  users = [],
}: {
  meetings: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  showAppBadge?: boolean
  /** Mention pool for the notes editor. Empty just means no suggestions pop up. */
  users?: MentionUser[]
}) {
  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-8 text-center">
        <CalendarDaysIcon className="size-5 text-muted-foreground/60" aria-hidden />
        <p className="text-sm font-medium">No meetings.</p>
        <p className="text-xs text-muted-foreground">Schedule one to get the team in sync.</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {meetings.map((meeting) => (
        <MeetingRow
          key={meeting.id}
          meeting={meeting}
          canManage={isAdmin || meeting.createdBy === currentUserId}
          showAppBadge={showAppBadge}
          users={users}
        />
      ))}
    </ul>
  )
}

function MeetingRow({
  meeting,
  canManage,
  showAppBadge,
  users,
}: {
  meeting: MeetingSummary
  canManage: boolean
  showAppBadge: boolean
  users: MentionUser[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(meeting.notes ?? '')

  function handleSaveNotes() {
    startTransition(async () => {
      try {
        const res = await updateMeetingNotes(meeting.id, notesDraft)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Notes saved')
        setEditingNotes(false)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await deleteMeeting(meeting.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Meeting deleted')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  function handleSendInvite() {
    startTransition(async () => {
      try {
        const res = await retryCalendarInvite(meeting.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Calendar invite sent')
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{meeting.title}</span>
          {showAppBadge && meeting.appName ? (
            <Badge variant="secondary">{meeting.appName}</Badge>
          ) : null}
          {meeting.googleEventId ? (
            <Badge variant="outline" className="gap-1">
              <CalendarCheckIcon className="size-3" /> Calendar invite sent
            </Badge>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {format(meeting.startsAt, 'MMM d, yyyy · h:mm a')} – {format(meeting.endsAt, 'h:mm a')}
        </span>
      </div>
      {meeting.agenda ? <p className="text-sm text-muted-foreground">{meeting.agenda}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {meeting.attendees.length > 0 ? (
          <AvatarGroup>
            {meeting.attendees.slice(0, 6).map((attendee) => (
              <Avatar key={attendee.id} size="sm">
                {attendee.avatarUrl ? (
                  <AvatarImage src={attendee.avatarUrl} alt={attendee.name} />
                ) : null}
                <AvatarFallback>{attendee.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
        ) : (
          <span className="text-xs text-muted-foreground">No attendees</span>
        )}
        {canManage ? (
          <div className="flex items-center gap-1.5">
            {!meeting.googleEventId ? (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={isPending}
                onClick={handleSendInvite}
              >
                <SendIcon /> Send invite
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setEditingNotes((v) => !v)}
            >
              <PencilIcon /> Notes
            </Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                <Trash2Icon />
                <span className="sr-only">Delete meeting</span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete meeting?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes &ldquo;{meeting.title}&rdquo; and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleDelete}>
                    {isPending ? 'Deleting…' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </div>
      {editingNotes ? (
        <div className="flex flex-col gap-2">
          <MentionTextarea
            users={users}
            value={notesDraft}
            onValueChange={setNotesDraft}
            maxLength={5000}
            rows={3}
            aria-label={`Notes for ${meeting.title}`}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setEditingNotes(false)
                setNotesDraft(meeting.notes ?? '')
              }}
            >
              Cancel
            </Button>
            <Button size="sm" type="button" disabled={isPending} onClick={handleSaveNotes}>
              {isPending ? 'Saving…' : 'Save notes'}
            </Button>
          </div>
        </div>
      ) : meeting.notes ? (
        <p className="text-sm text-muted-foreground">Notes: {meeting.notes}</p>
      ) : null}
      <MeetingIntelPanel meetingId={meeting.id} canRecord={canManage} />
    </li>
  )
}
