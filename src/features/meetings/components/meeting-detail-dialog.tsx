'use client'

import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  CalendarCheckIcon,
  CalendarOffIcon,
  ClipboardListIcon,
  FileTextIcon,
  ListIcon,
  Trash2Icon,
  UsersIcon,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateTimeWheelField } from '@/components/ui/datetime-wheel'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deleteMeeting, rescheduleMeeting } from '@/features/meetings/actions'
import { AddToCalendarMenu } from '@/features/meetings/components/add-to-calendar'
import { MetaChip } from '@/features/meetings/components/meeting-chips'
import {
  durationLabel,
  meetingTiming,
  noRsvpYet,
  tallyRsvps,
  type AttendeeResponse,
} from '@/features/meetings/components/meeting-glance'
import type { MeetingSummary } from '@/features/meetings/queries'

/**
 * How each attendee answered. Shown as a word next to their name rather than
 * as a colour on their avatar: the response is fetched for every attendee and
 * this panel — the one place that lists them by name at all — used to throw
 * it away. `pending` gets no label; "hasn't replied" is the absence of an
 * answer, not an answer.
 */
const RESPONSE_LABEL: Record<AttendeeResponse, string | null> = {
  going: 'Going',
  maybe: 'Maybe',
  declined: "Can't",
  pending: null,
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UsersIcon
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-1.5">
      {/* h3 — the dialog title is the h2-equivalent here, so these must not
          skip a level for anyone navigating the panel by heading. */}
      <h3 className="flex items-center gap-1.5 font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * Everything known about one meeting, opened by clicking its chip in the month
 * calendar: when it is, which app it belongs to, the agenda, who is attending
 * (by name, not just an avatar pile), the notes, and whether the Google
 * Calendar invite went out.
 *
 * It is also the keyboard/screen-reader route to rescheduling: dragging a chip
 * across the grid is a pointer-only gesture, so the same move is available
 * here as two ordinary date-time fields.
 */
export function MeetingDetailDialog({
  meeting,
  currentUserId,
  isAdmin,
  onOpenChange,
  onOpenInList,
}: {
  /** The open meeting, or null when the panel is closed. */
  meeting: MeetingSummary | null
  currentUserId: string
  isAdmin: boolean
  onOpenChange: (open: boolean) => void
  /** Jumps to the list view for this meeting (notes timeline, follow-ups, AI). */
  onOpenInList?: (meeting: MeetingSummary) => void
}) {
  // Held so the panel still has content (and a DialogTitle) while it plays its
  // closing animation, after the parent has already cleared the selection.
  const [lastMeeting, setLastMeeting] = useState(meeting)
  if (meeting && meeting !== lastMeeting) setLastMeeting(meeting)
  const shown = meeting ?? lastMeeting

  return (
    <Dialog open={meeting !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        {shown ? (
          <MeetingDetailBody
            meeting={shown}
            // Same rule as every meeting write on the server: an admin, or the
            // person who created it.
            canManage={isAdmin || shown.createdBy === currentUserId}
            onOpenChange={onOpenChange}
            onOpenInList={onOpenInList}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MeetingDetailBody({
  meeting,
  canManage,
  onOpenChange,
  onOpenInList,
}: {
  meeting: MeetingSummary
  canManage: boolean
  onOpenChange: (open: boolean) => void
  onOpenInList?: (meeting: MeetingSummary) => void
}) {
  const router = useRouter()
  const fieldId = useId()
  const [isPending, startTransition] = useTransition()
  const [start, setStart] = useState(meeting.startsAt)
  const [end, setEnd] = useState(meeting.endsAt)

  // Re-seed the fields whenever the meeting itself changes underneath the
  // panel — a different meeting, or the same one moved by a drag or by
  // somebody else. Adjusting state during render rather than in an effect is
  // React's own recommendation for resetting state from a prop:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const syncKey = `${meeting.id}:${meeting.startsAt.getTime()}:${meeting.endsAt.getTime()}`
  const [syncedKey, setSyncedKey] = useState(syncKey)
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey)
    setStart(meeting.startsAt)
    setEnd(meeting.endsAt)
  }

  const timing = meetingTiming(meeting.startsAt, meeting.endsAt, new Date())
  const rsvp = tallyRsvps(meeting.attendees)
  const endBeforeStart = end.getTime() <= start.getTime()
  const moved =
    start.getTime() !== meeting.startsAt.getTime() || end.getTime() !== meeting.endsAt.getTime()
  const errorId = `${fieldId}-end-error`

  /** Dragging the start carries the end with it, so the duration survives —
      the same promise the drag-to-another-day gesture makes. */
  function handleStartChange(next: Date) {
    const delta = next.getTime() - start.getTime()
    setStart(next)
    setEnd(new Date(end.getTime() + delta))
  }

  function handleReschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (endBeforeStart || !moved) return
    startTransition(async () => {
      try {
        const res = await rescheduleMeeting(meeting.id, start.toISOString(), end.toISOString())
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        if (res.data.calendarWarning) toast.warning(res.data.calendarWarning)
        else toast.success('Meeting moved')
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
        onOpenChange(false)
        router.refresh()
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{meeting.title}</DialogTitle>
        <DialogDescription>
          {format(meeting.startsAt, 'EEEE, MMMM d, yyyy')}
          {' · '}
          <span className="font-mono">
            {format(meeting.startsAt, 'h:mm a')} – {format(meeting.endsAt, 'h:mm a')}
          </span>
          {' · '}
          {durationLabel(meeting.startsAt, meeting.endsAt)}
        </DialogDescription>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Where this meeting sits relative to now, and whether anybody has
              answered — the two facts a chip in a month grid cannot show. */}
          {timing.state === 'live' ? (
            <MetaChip tone="active">
              <span
                className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
                aria-hidden
              />
              {timing.label}
            </MetaChip>
          ) : (
            <MetaChip tone={timing.state === 'soon' ? 'warning' : 'neutral'}>{timing.label}</MetaChip>
          )}
          {rsvp.total > 0 ? (
            <MetaChip tone={noRsvpYet(rsvp, timing.state) ? 'warning' : 'neutral'}>
              {noRsvpYet(rsvp, timing.state) ? (
                'No replies yet'
              ) : (
                <>
                  <span className="font-mono">{rsvp.going}</span>/
                  <span className="font-mono">{rsvp.total}</span> going
                </>
              )}
            </MetaChip>
          ) : null}
          {meeting.appName && meeting.appSlug ? (
            <Badge variant="secondary" render={<Link href={`/apps/${meeting.appSlug}`} />}>
              {meeting.appName}
            </Badge>
          ) : meeting.appName ? (
            <Badge variant="secondary">{meeting.appName}</Badge>
          ) : (
            <Badge variant="outline">No app</Badge>
          )}
          {meeting.googleEventId ? (
            <Badge variant="outline">
              <CalendarCheckIcon aria-hidden /> Google invite sent
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <CalendarOffIcon aria-hidden /> No Google invite
            </Badge>
          )}
          {/* The menu below is the answer to that badge either way: it hands
              over the .ics file and the add-to-calendar links, neither of
              which depends on a Google connection. */}
          <AddToCalendarMenu meeting={meeting} canManage={canManage} size="xs" />
        </div>
      </DialogHeader>

      <Section icon={ClipboardListIcon} title="Agenda">
        {meeting.agenda ? (
          <p className="text-sm whitespace-pre-wrap">{meeting.agenda}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No agenda was set for this meeting.</p>
        )}
      </Section>

      <Section
        icon={UsersIcon}
        title={`Attendees${meeting.attendees.length > 0 ? ` · ${meeting.attendees.length}` : ''}`}
      >
        {meeting.attendees.length > 0 ? (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {meeting.attendees.map((attendee) => (
              <li key={attendee.id} className="flex min-w-0 items-center gap-2">
                <Avatar size="sm" className="shrink-0">
                  {attendee.avatarUrl ? (
                    <AvatarImage src={attendee.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback>{attendee.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                {/* The name is text, not just an avatar tooltip — an avatar
                    pile tells a screen-reader user nothing about who is in
                    the room. */}
                <span className="min-w-0 truncate text-sm">{attendee.name}</span>
                {RESPONSE_LABEL[attendee.response] ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {RESPONSE_LABEL[attendee.response]}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nobody is on the invite yet.</p>
        )}
      </Section>

      {/* The written notes as the meeting row carries them. Writing them —
          along with the transcript, AI summary and follow-ups — happens in the
          list view's notes timeline, so this panel shows rather than
          duplicates that surface. */}
      <Section icon={FileTextIcon} title="Notes">
        {meeting.notes ? (
          <p className="text-sm whitespace-pre-wrap">{meeting.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
        {/* Not a dead end: the button that actually gets there is named right
            here, next to the thing it is missing, instead of only in the
            footer under a generic label. */}
        {onOpenInList ? (
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="w-fit"
            onClick={() => {
              onOpenInList(meeting)
              onOpenChange(false)
            }}
          >
            <ListIcon aria-hidden /> Open the write-up, transcript and follow-ups
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            The write-up, transcript and follow-ups live in the list view.
          </p>
        )}
      </Section>

      {canManage ? (
        <form
          onSubmit={handleReschedule}
          className="flex flex-col gap-3 rounded-lg border border-border p-3"
        >
          <h3 className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Move this meeting
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <DateTimeWheelField
              id={`${fieldId}-start`}
              label="Starts"
              value={start}
              onChange={handleStartChange}
            />
            <DateTimeWheelField
              id={`${fieldId}-end`}
              label="Ends"
              value={end}
              onChange={setEnd}
              invalid={endBeforeStart}
              describedBy={endBeforeStart ? errorId : undefined}
            />
          </div>
          {endBeforeStart ? (
            <p id={errorId} role="alert" className="text-xs text-destructive">
              End time must be after the start time.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Changing the start keeps the meeting {durationLabel(start, end)} long. Attendees are
              notified, and a sent calendar invite is updated.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={!moved || isPending}
              onClick={() => {
                setStart(meeting.startsAt)
                setEnd(meeting.endsAt)
              }}
            >
              Reset
            </Button>
            <Button size="sm" type="submit" disabled={!moved || endBeforeStart || isPending}>
              {isPending ? 'Moving…' : 'Move meeting'}
            </Button>
          </div>
        </form>
      ) : null}

      <DialogFooter className="sm:justify-between">
        {canManage ? (
          <AlertDialog>
            <AlertDialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
              <Trash2Icon /> Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete meeting?</AlertDialogTitle>
                <AlertDialogDescription>
                  Moves &ldquo;{meeting.title}&rdquo; to Trash — admins can view and restore it.
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
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {/* The route to the notes now also sits inside the Notes section
              above, where its absence is what prompts the question. */}
          <DialogClose render={<Button variant="outline" size="sm" />}>Close</DialogClose>
        </div>
      </DialogFooter>
    </>
  )
}
