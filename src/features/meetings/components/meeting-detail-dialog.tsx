'use client'

import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  CalendarCheckIcon,
  CalendarOffIcon,
  ClipboardListIcon,
  FileTextIcon,
  ListIcon,
  PencilIcon,
  SparklesIcon,
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
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { MeetingProjectSelect } from '@/features/meetings/components/meeting-project-select'
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
  onOpenNotes,
  users = [],
  apps = [],
}: {
  /** The open meeting, or null when the panel is closed. */
  meeting: MeetingSummary | null
  currentUserId: string
  isAdmin: boolean
  onOpenChange: (open: boolean) => void
  /** Jumps to the list view for this meeting (notes timeline, follow-ups, AI). */
  onOpenInList?: (meeting: MeetingSummary) => void
  /**
   * Opens the write-up popup without leaving the calendar. The caller owns that
   * dialog and closes this one first — two stacked dialogs share a focus trap
   * and a scroll lock, and unwinding them in the right order costs more than
   * having both panels on screen is worth.
   */
  onOpenNotes?: (meetingId: string) => void
  /**
   * Attendee pool and app list for the edit dialog. Both optional and both
   * defaulting to empty, because a caller that has neither should still get a
   * working panel — the edit form simply offers fewer choices, rather than the
   * panel refusing to render.
   */
  users?: { id: string; name: string }[]
  apps?: { id: string; name: string }[]
}) {
  // Held so the panel still has content (and a DialogTitle) while it plays its
  // closing animation, after the parent has already cleared the selection.
  const [lastMeeting, setLastMeeting] = useState(meeting)
  if (meeting && meeting !== lastMeeting) setLastMeeting(meeting)
  const shown = meeting ?? lastMeeting

  // The meeting the header's Edit was pressed on. Held HERE, not in the body:
  // Edit closes this dialog first (see the comment on the button), and state
  // kept inside the popup's content would unmount along with it, taking the
  // form down before it ever opened.
  const [editing, setEditing] = useState<MeetingSummary | null>(null)

  return (
    <>
      <Dialog open={meeting !== null} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          {shown ? (
            <MeetingDetailBody
              meeting={shown}
              // Same rule as every meeting write on the server: an admin, or the
              // person who created it.
              canManage={isAdmin || shown.createdBy === currentUserId}
              canDelete={isAdmin}
              apps={apps}
              onOpenChange={onOpenChange}
              onOpenInList={onOpenInList}
              onOpenNotes={onOpenNotes}
              onEdit={setEditing}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* The edit form, a SIBLING of the popup rather than a child of it — the
          same close-one-open-the-other hand-off `onOpenNotes` documents above,
          and for the same reason: stacked dialogs share a focus trap and a
          scroll lock. Keyed on the meeting so editing a different one later
          mounts a form seeded from that meeting, not left-over state. */}
      {editing ? (
        <MeetingForm
          key={editing.id}
          apps={apps}
          activeUsers={users}
          editing={{
            id: editing.id,
            appId: editing.appId,
            title: editing.title,
            startsAt: editing.startsAt,
            endsAt: editing.endsAt,
            agenda: editing.agenda,
            meetingUrl: editing.meetingUrl,
            attendeeIds: editing.attendees.map((attendee) => attendee.id),
          }}
          defaultOpen
          onOpenChange={(next) => {
            if (!next) setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}

function MeetingDetailBody({
  meeting,
  canManage,
  canDelete,
  apps,
  onOpenChange,
  onOpenInList,
  onOpenNotes,
  onEdit,
}: {
  meeting: MeetingSummary
  canManage: boolean
  /** Deletion is admin-only — stricter than canManage, see deleteMeeting. */
  canDelete: boolean
  apps: { id: string; name: string }[]
  onOpenChange: (open: boolean) => void
  onOpenInList?: (meeting: MeetingSummary) => void
  onOpenNotes?: (meetingId: string) => void
  /** Hands the meeting up so the edit form can outlive this popup's close. */
  onEdit: (meeting: MeetingSummary) => void
}) {
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
  // A quick meeting gets booked before anyone knows which product it belongs
  // to — sometimes it never belongs to one. Filing it later used to mean the
  // full edit form, which re-submits the title, both times and the whole
  // attendee list to change one column.
  const canRefile = canManage && apps.length > 0

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
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <>
      <DialogHeader>
        {/* Title row with Edit in the top-right corner — where every editor
            puts it, instead of buried in the footer under the reschedule form.
            It changes everything the reschedule form below does not: title,
            app, agenda, link, attendees. `pr-10` clears the dialog's own X,
            which floats over this corner. Closing this popup BEFORE opening
            the form keeps the two dialogs from stacking — the same rule the
            `onOpenNotes` hand-off documents. */}
        <div className="flex items-start justify-between gap-2 pr-10">
          <DialogTitle>{meeting.title}</DialogTitle>
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                onOpenChange(false)
                onEdit(meeting)
              }}
            >
              <PencilIcon aria-hidden /> Edit
            </Button>
          ) : null}
        </div>
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
          ) : canRefile ? null : (
            // Dropped only when the picker below is there to say the same
            // thing in a control — a badge reading "No app" directly above a
            // field whose value is "No app" is the same fact twice.
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

      {canRefile ? (
        <MeetingProjectSelect
          meetingId={meeting.id}
          appId={meeting.appId}
          apps={apps}
          className="max-w-xs"
        />
      ) : null}

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
        {/* Not a dead end: the buttons that actually get there are named right
            here, next to the thing they are missing, instead of only in the
            footer under a generic label. */}
        <div className="flex flex-wrap gap-2">
          {/* Reading the AI write-up is the common case and it does not need
              the list view at all — this stays on the calendar. Editing any of
              it still means going to the list, which is the button beside it. */}
          {onOpenNotes ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                onOpenChange(false)
                onOpenNotes(meeting.id)
              }}
            >
              <SparklesIcon aria-hidden /> Read the write-up
            </Button>
          ) : null}
          {onOpenInList ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                onOpenInList(meeting)
                onOpenChange(false)
              }}
            >
              <ListIcon aria-hidden /> Transcript and follow-ups
            </Button>
          ) : null}
        </div>
        {!onOpenInList && !onOpenNotes ? (
          <p className="text-xs text-muted-foreground">
            The write-up, transcript and follow-ups live in the list view.
          </p>
        ) : null}
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
        {/* Editing moved to the header's top-right corner — the footer keeps
            only the destructive exit (left) and the plain one (right). */}
        {canDelete ? (
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
