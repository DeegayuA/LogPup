'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LockIcon,
  PencilIcon,
  Trash2Icon,
  UserCheckIcon,
  XIcon,
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
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { deleteMeeting } from '@/features/meetings/actions'
import { AddToCalendarMenu } from '@/features/meetings/components/add-to-calendar'
import { bilingualText, MetaChip } from '@/features/meetings/components/meeting-chips'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import {
  durationLabel,
  meetingTiming,
  noRsvpYet,
  tallyRsvps,
  type AttendeeResponse,
} from '@/features/meetings/components/meeting-glance'
import { MeetingIntelPanel } from '@/features/meetings/components/meeting-intel'
import { MeetingRsvp } from '@/features/meetings/components/meeting-rsvp'
import type { MeetingGlance } from '@/features/meetings/components/meeting-notes-model'
import type { MentionUser } from '@/components/mention-textarea'
import type { MeetingSummary } from '@/features/meetings/queries'

/** How each face's mark reads to a screen reader and in its tooltip. */
const RESPONSE_WORD: Record<AttendeeResponse, string> = {
  going: 'going',
  maybe: 'maybe',
  declined: 'declined',
  pending: "hasn't replied",
}

/** Faces shown before the "+N" — enough to recognise a room, not a census. */
const FACEPILE_MAX = 8

/**
 * The Dossier sheet: the 4,800-line `MeetingIntelPanel` moved — untouched —
 * out of the row and into a right-side overlay, driven by the same `?open=`
 * URL contract the palette and Quick note already write.
 *
 * Why an overlay and not the old inline expansion: one expand injected up to
 * 11 panels between rows, the title and date scrolled away, and the list
 * stopped being a list. Here the docket never reflows, exactly ONE panel
 * instance exists at a time (so the planner's workspace-wide health pass runs
 * at most once per open sheet by construction), and closing returns focus to
 * wherever the sheet was opened from — both trap and return are the dialog
 * primitive's job, not ours.
 *
 * Precedent: meeting-detail-dialog.tsx (the calendar side) — same primitives,
 * different shape.
 */
export function MeetingIntelSheet({
  meeting,
  currentUserId,
  isAdmin,
  users = [],
  apps = [],
  canReadIntel,
  now,
  onOpenChange,
  onPrev,
  onNext,
  onGlanceChange,
}: {
  /** The open meeting, or null when the sheet is closed. */
  meeting: MeetingSummary | null
  currentUserId: string
  isAdmin: boolean
  /** Attendee/mention pool and project list, exactly what the list rows
   *  already hold — threaded through to the panel and the edit form. */
  users?: MentionUser[]
  apps?: { id: string; name: string }[]
  /**
   * canReadMeetingIntel for THIS meeting, resolved by the caller. False gets
   * the identity header only — the facts the visibility filter already
   * granted — and deliberately no hint naming what is withheld: a hint that
   * names a hidden control is a map of what to ask for.
   */
  canReadIntel: boolean
  /** The caller's shared list clock (useListNow) — the sheet's timing facts
   *  must agree with the row behind it, and a render-time clock read here
   *  would break both that and the now-as-argument rule (meeting-glance.ts).
   *  Falls back to a per-open read for callers without the shared clock. */
  now?: Date
  /** Close (Esc, X, backdrop). The caller owns stripping `?open`. */
  onOpenChange: (open: boolean) => void
  /**
   * Step `?open=` through the caller's current filtered order. Absent at
   * either end of the list — the button renders disabled rather than
   * vanishing, so the pair does not shift under a pointer mid-stepping.
   */
  onPrev?: () => void
  onNext?: () => void
  /** The panel's glance write-through, forwarded with the meeting id so the
   *  caller can merge it into the shared glance store. */
  onGlanceChange?: (meetingId: string, glance: MeetingGlance | null) => void
}) {
  // Held so the sheet still has content (and a DialogTitle) while it plays
  // its closing slide, after the caller has already cleared `?open` — the
  // same retention the calendar's detail dialog uses.
  const [lastMeeting, setLastMeeting] = useState(meeting)
  if (meeting && meeting !== lastMeeting) setLastMeeting(meeting)
  const shown = meeting ?? lastMeeting

  return (
    <Dialog open={meeting !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={
          // Overriding the kit dialog's centred-card geometry into a right
          // sheet rather than rebuilding the popup: the focus trap, focus
          // return, Esc and backdrop behaviour all live in the primitive and
          // must stay there. Full-screen below lg; min(720px, 92vw) beside
          // the docket from lg up. The page's only shadow and only floating
          // layer, per the docket spec.
          'fixed inset-y-0 right-0 left-0 h-auto max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none shadow-lg sm:max-w-none lg:left-auto lg:w-[min(720px,92vw)] ' +
          'flex flex-col gap-0 p-0 ' +
          // 200ms transform+opacity on the motion tokens; the base zoom is
          // neutralised (zoom-in-100 = scale 1) so the slide is the only
          // transform, and reduced motion keeps just the fade. The EXIT runs
          // on the exit tokens (120ms, ease-in) per the motion vocabulary —
          // ease-out entering, ease-in leaving, never a lingering dismissal.
          'duration-(--dur-base) ease-(--ease-enter) data-closed:duration-(--dur-quick) data-closed:ease-(--ease-exit) data-open:zoom-in-100 data-closed:zoom-out-100 data-open:slide-in-from-right-full data-closed:slide-out-to-right-full motion-reduce:data-open:slide-in-from-right-0 motion-reduce:data-closed:slide-out-to-right-0'
        }
      >
        {shown ? (
          <MeetingIntelSheetBody
            meeting={shown}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            users={users}
            apps={apps}
            canReadIntel={canReadIntel}
            now={now}
            onOpenChange={onOpenChange}
            onPrev={onPrev}
            onNext={onNext}
            onGlanceChange={onGlanceChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MeetingIntelSheetBody({
  meeting,
  currentUserId,
  isAdmin,
  users,
  apps,
  canReadIntel,
  now,
  onOpenChange,
  onPrev,
  onNext,
  onGlanceChange,
}: {
  meeting: MeetingSummary
  currentUserId: string
  isAdmin: boolean
  users: MentionUser[]
  apps: { id: string; name: string }[]
  canReadIntel: boolean
  now?: Date
  onOpenChange: (open: boolean) => void
  onPrev?: () => void
  onNext?: () => void
  onGlanceChange?: (meetingId: string, glance: MeetingGlance | null) => void
}) {
  const [isPending, startTransition] = useTransition()

  // Same rule as every meeting write on the server: an admin, or the person
  // who created it. Deletion is admin-only — stricter than canManage.
  const canManage = isAdmin || meeting.createdBy === currentUserId
  const canDelete = isAdmin
  const mine = meeting.attendees.find((attendee) => attendee.id === currentUserId)
  const rsvp = tallyRsvps(meeting.attendees)
  const timing = meetingTiming(meeting.startsAt, meeting.endsAt, now ?? new Date())
  const extraFaces = meeting.attendees.length - FACEPILE_MAX

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await deleteMeeting(meeting.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Meeting deleted')
        // The meeting this sheet shows no longer exists — staying open would
        // be a dossier on nothing.
        onOpenChange(false)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <>
      {/* The sticky ANCHOR: title, date and the stepper never scroll away —
          the missing identity line was what made the old inline expansion
          disorienting. Only this slim bar sticks; the full agenda and the
          people below scroll, because an unbounded sticky header would leave
          a short viewport no room for the panel it introduces. */}
      <div className="sticky top-0 z-10 flex items-start gap-2 border-b border-border bg-popover px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* h3, matching the level a row title holds in the page outline —
              the panel's own sections continue at h4 below it. */}
          <DialogTitle render={<h3 />} className="font-heading text-base font-semibold">
            {meeting.title}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {format(meeting.startsAt, 'EEEE, MMMM d, yyyy')}
            {' · '}
            <span className="font-mono tabular-nums">
              {format(meeting.startsAt, 'h:mm a')} – {format(meeting.endsAt, 'h:mm a')}
            </span>
            {' · '}
            <span className="font-mono tabular-nums">
              {durationLabel(meeting.startsAt, meeting.endsAt)}
            </span>
          </DialogDescription>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {/* aria-disabled, NOT disabled, at either end of the stepping
              order: the native attribute drops focus to <body> the moment
              the focused button becomes an end, breaking the stepping flow.
              44px targets below lg, where the sheet is full-screen (the row
              kebab's own responsive rule). */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn('size-11 lg:size-7', !onPrev && 'pointer-events-none opacity-50')}
            aria-label="Previous meeting"
            aria-disabled={!onPrev}
            onClick={onPrev ?? (() => {})}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn('size-11 lg:size-7', !onNext && 'pointer-events-none opacity-50')}
            aria-label="Next meeting"
            aria-disabled={!onNext}
            onClick={onNext ?? (() => {})}
          >
            <ChevronRightIcon />
          </Button>
          <DialogClose
            render={
              <Button type="button" variant="ghost" size="icon-sm" className="size-11 lg:size-7" />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
      </div>

      {/* Identity block — every fact the visibility filter already granted
          this viewer, so it renders for EVERYONE, intel permission or not. */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* One badge per project, linking into it — identity as text, never
              as a colour (the app tick on the row already spent the ramp). */}
          {meeting.apps.map((app) => (
            <Badge key={app.id} variant="secondary" render={<Link href={`/apps/${app.slug}`} />}>
              {app.name}
            </Badge>
          ))}
          {meeting.visibility === 'attendees' ? (
            <Badge variant="outline">
              <LockIcon aria-hidden /> Private
              <span className="sr-only"> — attendees only</span>
            </Badge>
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
        </div>

        {/* The FULL agenda, un-clamped — the row clamps to one line, and for
            non-organisers this used to be locked behind the edit dialog.
            CSS does any fitting; Sinhala graphemes are never cut by JS. */}
        {meeting.agenda ? (
          <p className={`${bilingualText} whitespace-pre-wrap`}>{meeting.agenda}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No agenda was set for this meeting.</p>
        )}

        {meeting.attendees.length > 0 ? (
          <TooltipProvider>
            <div className="flex flex-wrap items-center gap-2">
              <AvatarGroup>
                {meeting.attendees.slice(0, FACEPILE_MAX).map((attendee) => (
                  <Tooltip key={attendee.id}>
                    {/* A real BUTTON wrapper (for the mark): it breaks
                        AvatarGroup's direct-child ring selector on purpose
                        (the ring rides the Avatar itself, against the
                        sheet's own surface) and — unlike a bare span — is
                        focusable, so Base UI opens the tooltip on Tab and
                        sighted keyboard users can reach each person's RSVP. */}
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="relative inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      }
                    >
                      <Avatar size="sm" className="ring-2 ring-popover">
                        {attendee.avatarUrl ? (
                          <AvatarImage src={attendee.avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback>
                          {attendee.name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {/* Only the two answers worth a mark: declined (came
                          back "no") and pending (never answered). Both carry
                          words in the tooltip and sr-only text — the mark is
                          never the only signal. */}
                      {attendee.response === 'declined' ? (
                        <span
                          className="absolute -right-0.5 -bottom-0.5 z-10 flex size-3 items-center justify-center rounded-full bg-destructive text-destructive-foreground ring-2 ring-popover"
                          aria-hidden
                        >
                          <XIcon className="size-2" />
                        </span>
                      ) : null}
                      {attendee.response === 'pending' ? (
                        <span
                          className="absolute -right-0.5 -bottom-0.5 z-10 size-3 rounded-full border-2 border-muted-foreground bg-popover ring-2 ring-popover"
                          aria-hidden
                        />
                      ) : null}
                      <span className="sr-only">
                        {attendee.name} — {RESPONSE_WORD[attendee.response]}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {attendee.name} — {RESPONSE_WORD[attendee.response]}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {extraFaces > 0 ? (
                  <AvatarGroupCount>
                    +{extraFaces}
                    <span className="sr-only"> more attendees</span>
                  </AvatarGroupCount>
                ) : null}
              </AvatarGroup>
            </div>
          </TooltipProvider>
        ) : null}

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
          <AddToCalendarMenu meeting={meeting} canManage={canManage} />
          {canManage ? (
            <MeetingForm
              apps={apps}
              activeUsers={users}
              editing={{
                id: meeting.id,
                appIds: meeting.apps.map((app) => app.id),
                title: meeting.title,
                startsAt: meeting.startsAt,
                endsAt: meeting.endsAt,
                agenda: meeting.agenda,
                meetingUrl: meeting.meetingUrl,
                attendeeIds: meeting.attendees.map((attendee) => attendee.id),
                visibility: meeting.visibility,
              }}
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-11 lg:size-7"
                  aria-label={`Edit ${meeting.title}`}
                >
                  <PencilIcon />
                </Button>
              }
            />
          ) : null}
          {canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="ghost" size="icon-sm" className="size-11 lg:size-7" />}
              >
                <Trash2Icon />
                <span className="sr-only">Delete meeting</span>
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

      {/* The intel panel, UNCHANGED, mounted here and only here — rows never
          mount it, which is what retires the 300px-prefetch sweep. Keyed by
          meeting id so Prev/Next mounts a fresh panel (autoOpen is a
          one-shot); the prop set is exactly what today's row threads. A
          viewer without intel permission gets the header above and nothing
          more. */}
      {canReadIntel ? (
        <div className="px-4 py-4">
          <MeetingIntelPanel
            key={meeting.id}
            meetingId={meeting.id}
            meetingTitle={meeting.title}
            canRecord={canManage}
            // `isAdmin` unlocks the follow-up Remove/Edit-text controls —
            // the same admin fact the row passed as `canDelete`.
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            attendees={meeting.attendees}
            appIds={meeting.apps.map((app) => app.id)}
            apps={apps}
            activeUsers={users}
            mentionUsers={users}
            onGlanceChange={(next) => onGlanceChange?.(meeting.id, next)}
            // The sheet IS the opened write-up — arriving here always means
            // "show me this meeting's intelligence", so the panel opens
            // rather than presenting one more collapsed door.
            autoOpen
          />
        </div>
      ) : null}
    </>
  )
}
