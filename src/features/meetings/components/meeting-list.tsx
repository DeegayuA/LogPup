'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  ListChecksIcon,
  MessageCircleQuestionIcon,
  PencilIcon,
  SparklesIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserCheckIcon,
} from 'lucide-react'
import { MeetingRsvp } from '@/features/meetings/components/meeting-rsvp'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
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
import { type MentionUser } from '@/components/mention-textarea'
import { cn } from '@/lib/utils'
import { deleteMeeting } from '@/features/meetings/actions'
import { AddToCalendarMenu } from '@/features/meetings/components/add-to-calendar'
import {
  bilingualText,
  CountChip,
  MetaChip,
  SkeletonBlock,
} from '@/features/meetings/components/meeting-chips'
import {
  durationLabel,
  meetingTiming,
  noRsvpYet,
  tallyRsvps,
  type MeetingTiming,
} from '@/features/meetings/components/meeting-glance'
import { MeetingIntelPanel } from '@/features/meetings/components/meeting-intel'
import type { MeetingGlance } from '@/features/meetings/components/meeting-notes-model'
import type { MeetingSummary } from '@/features/meetings/queries'

export function MeetingList({
  meetings,
  currentUserId,
  isAdmin,
  showAppBadge = true,
  users = [],
  apps = [],
  openMeetingId,
}: {
  meetings: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  showAppBadge?: boolean
  /** Mention pool for the notes editor. Empty just means no suggestions pop up. */
  users?: MentionUser[]
  /**
   * Apps the edit dialog can move a meeting to. Optional so the surfaces that
   * render a list without one keep working — an empty list simply leaves
   * "No app" as the only choice, it does not disable editing.
   */
  apps?: { id: string; name: string }[]
  /** Meeting whose write-up panel should open on arrival (see MeetingIntelPanel.autoOpen). */
  openMeetingId?: string
}) {
  // One clock read for the whole list rather than one per row, so every row's
  // "Tomorrow" / "3 days ago" is measured against the same instant and cannot
  // disagree with its neighbour across a midnight boundary mid-render.
  const now = new Date()

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
    <ul className="flex flex-col gap-2.5">
      {meetings.map((meeting) => (
        <MeetingRow
          key={meeting.id}
          meeting={meeting}
          now={now}
          canManage={isAdmin || meeting.createdBy === currentUserId}
          canDelete={isAdmin}
          currentUserId={currentUserId}
          showAppBadge={showAppBadge}
          users={users}
          apps={apps}
          autoOpen={openMeetingId === meeting.id}
        />
      ))}
    </ul>
  )
}

/** Timing is the one thing on the row that can outrank the title for attention. */
function TimingChip({ timing }: { timing: MeetingTiming }) {
  if (timing.state === 'live') {
    return (
      <MetaChip tone="active">
        <span
          className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
          aria-hidden
        />
        {timing.label}
      </MetaChip>
    )
  }
  if (timing.state === 'soon') return <MetaChip tone="warning">{timing.label}</MetaChip>
  return <MetaChip>{timing.label}</MetaChip>
}

/**
 * What this meeting produced, on the collapsed row.
 *
 * `glance` is null until the panel below has fetched the meeting's intel —
 * which it does anyway, and used to throw away. While it is null the row shows
 * a fixed-width skeleton rather than nothing, so the chips do not shove the
 * agenda down the moment they arrive.
 */
function OutcomeChips({
  glance,
  isPast,
}: {
  /** undefined = the panel has not answered yet; null = nothing to show. */
  glance: MeetingGlance | null | undefined
  isPast: boolean
}) {
  if (glance === undefined) return <SkeletonBlock className="h-5 w-28" />
  if (glance === null) return null

  const chips = []
  if (glance.hasNotes) {
    chips.push(
      <MetaChip key="notes" icon={SparklesIcon} tone="success">
        Notes
      </MetaChip>,
    )
  } else if (isPast) {
    // Only worth saying about a meeting that has already happened — an
    // upcoming meeting having no notes is not news.
    chips.push(
      <MetaChip key="no-notes" tone="warning">
        No notes yet
      </MetaChip>,
    )
  }
  if (glance.actions > 0) {
    chips.push(<CountChip key="actions" value={glance.actions} unit="action" icon={ListChecksIcon} />)
  }
  if (glance.overdueActions > 0) {
    chips.push(
      <CountChip
        key="overdue"
        value={glance.overdueActions}
        unit="overdue"
        tone="danger"
        icon={TriangleAlertIcon}
      />,
    )
  }
  if (glance.openFollowups > 0) {
    chips.push(
      <CountChip
        key="followups"
        value={glance.openFollowups}
        unit="open follow-up"
        tone="warning"
        icon={MessageCircleQuestionIcon}
      />,
    )
  }
  if (glance.staleFollowups > 0) {
    chips.push(
      <CountChip
        key="stale"
        value={glance.staleFollowups}
        unit="stuck"
        tone="danger"
        icon={TriangleAlertIcon}
      />,
    )
  }
  return <>{chips}</>
}

function MeetingRow({
  meeting,
  now,
  canManage,
  canDelete,
  currentUserId,
  showAppBadge,
  users,
  apps,
  autoOpen,
}: {
  meeting: MeetingSummary
  now: Date
  canManage: boolean
  /** Deletion is admin-only — stricter than canManage, see deleteMeeting. */
  canDelete: boolean
  currentUserId: string
  showAppBadge: boolean
  users: MentionUser[]
  apps: { id: string; name: string }[]
  autoOpen: boolean
}) {
  const [isPending, startTransition] = useTransition()
  // Handed up by the panel each time it (re)loads this meeting's intel, so the
  // collapsed row can say what the meeting produced without being opened.
  const [glance, setGlance] = useState<MeetingGlance | null | undefined>(undefined)

  const timing = meetingTiming(meeting.startsAt, meeting.endsAt, now)
  const rsvp = tallyRsvps(meeting.attendees)
  const mine = meeting.attendees.find((attendee) => attendee.id === currentUserId)
  const headingId = `meeting-title-${meeting.id}`

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await deleteMeeting(meeting.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Meeting deleted')
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className={cn(
          'flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4',
          // The only structural colour on the card: a meeting happening right
          // now is the one thing worth pulling the eye off everything else.
          timing.state === 'live' && 'border-primary/50 ring-1 ring-primary/20',
        )}
      >
        <div className="flex gap-3">
          {/* Date rail. A calendar block reads as a date instantly where
              "Aug 14, 2026 · 2:00 PM" in a wrapping sentence does not, and it
              gives the row a fixed left edge to scan down.
              The three visible lines are aria-hidden and the whole rail is a
              <time> carrying the full date once: read out, "Aug / 14 / Fri" is
              three disconnected fragments. The bottom line trades the weekday
              for the YEAR on anything outside the current year — the past list
              goes back indefinitely, and "Aug 14" with no year was the one
              thing the previous row layout said that this one had stopped
              saying. */}
          <time
            dateTime={meeting.startsAt.toISOString()}
            className="flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-lg border text-center"
          >
            <span
              aria-hidden
              className="w-full bg-muted py-0.5 font-mono text-2xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              {format(meeting.startsAt, 'MMM')}
            </span>
            <span aria-hidden className="font-heading text-lg leading-tight font-bold">
              {format(meeting.startsAt, 'd')}
            </span>
            <span aria-hidden className="pb-0.5 font-mono text-2xs leading-3 text-muted-foreground">
              {meeting.startsAt.getFullYear() === now.getFullYear()
                ? format(meeting.startsAt, 'EEE')
                : format(meeting.startsAt, 'yyyy')}
            </span>
            <span className="sr-only">{format(meeting.startsAt, 'EEEE, MMMM d, yyyy')}</span>
          </time>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              {/* A real heading: 30 rows of <span> gave screen-reader users no
                  way to move between meetings, and left the title weighing the
                  same as the buttons underneath it. */}
              <h3 id={headingId} className="font-heading text-base leading-snug font-semibold">
                {meeting.title}
              </h3>
              <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                {format(meeting.startsAt, 'h:mm a')} – {format(meeting.endsAt, 'h:mm a')} ·{' '}
                {durationLabel(meeting.startsAt, meeting.endsAt)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <TimingChip timing={timing} />
              {showAppBadge && meeting.appName ? (
                <Badge variant="secondary">{meeting.appName}</Badge>
              ) : null}
              {meeting.googleEventId ? (
                <MetaChip icon={CalendarCheckIcon}>Invite sent</MetaChip>
              ) : null}
              {rsvp.total > 0 ? (
                <MetaChip
                  icon={UserCheckIcon}
                  tone={noRsvpYet(rsvp, timing.state) ? 'warning' : 'neutral'}
                >
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
              <OutcomeChips glance={glance} isPast={timing.state === 'past'} />
            </div>

            {meeting.agenda ? (
              <p className={cn(bilingualText, 'line-clamp-2 text-muted-foreground')}>
                {meeting.agenda}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
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
          <div className="flex flex-wrap items-center gap-1.5">
            {meeting.meetingUrl || mine || canManage ? (
              <MeetingRsvp
                meetingId={meeting.id}
                meetingUrl={meeting.meetingUrl}
                myResponse={mine?.response ?? 'pending'}
                isAttendee={Boolean(mine)}
                canEditLink={canManage}
              />
            ) : null}
            {/* Always offered, to every viewer: the .ics download and the
                add-to-calendar links need no Google connection, so this is the
                one calendar affordance that is never a dead end. */}
            <AddToCalendarMenu meeting={meeting} canManage={canManage} />
            {/* Edit sits immediately before Delete, and behind the same
                `canManage` gate — the organiser or any admin. Until now this
                block offered destruction as the only way to correct a meeting:
                a typo in a title or a wrong app could be fixed only by
                deleting the meeting and rebuilding it, losing its notes, its
                actions and its calendar event with it. */}
            {canManage ? (
              <MeetingForm
                apps={apps}
                activeUsers={users}
                editing={{
                  id: meeting.id,
                  appId: meeting.appId,
                  title: meeting.title,
                  startsAt: meeting.startsAt,
                  endsAt: meeting.endsAt,
                  agenda: meeting.agenda,
                  meetingUrl: meeting.meetingUrl,
                  attendeeIds: meeting.attendees.map((attendee) => attendee.id),
                }}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${meeting.title}`}>
                    <PencilIcon />
                  </Button>
                }
              />
            ) : null}
            {canDelete ? (
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
                    <AlertDialogAction
                      variant="destructive"
                      disabled={isPending}
                      onClick={handleDelete}
                    >
                      {isPending ? 'Deleting…' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </div>

        {/* Typed notes, AI notes, and the speech transcript are one unified
            surface inside the panel below (see meeting-intel.tsx) — notes
            editing does not live here as a separate control. */}
        <MeetingIntelPanel
          meetingId={meeting.id}
          meetingTitle={meeting.title}
          canRecord={canManage}
          currentUserId={currentUserId}
          attendees={meeting.attendees}
          appId={meeting.appId}
          mentionUsers={users}
          onGlanceChange={setGlance}
          autoOpen={autoOpen}
        />
      </article>
    </li>
  )
}
