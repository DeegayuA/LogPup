'use client'

import { Fragment, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  ArrowUpRightIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  Check,
  DownloadIcon,
  FileTextIcon,
  HelpCircle,
  ListChecksIcon,
  LockIcon,
  MessageCircleQuestionIcon,
  MoreVerticalIcon,
  PencilIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserCheckIcon,
  VideoIcon,
  X,
} from 'lucide-react'
import { Stagger, StaggerItem } from '@/components/motion/stagger'
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
} from '@/components/ui/alert-dialog'
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { type MentionUser } from '@/components/mention-textarea'
import { cn } from '@/lib/utils'
import { toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { addCalendarDays } from '@/features/sprints/sprint-date-range'
import { isoToDisplayDate } from '@/features/meetings/calendar-view'
import { deleteMeeting } from '@/features/meetings/actions'
import { respondToMeeting } from '@/features/meetings/rsvp-actions'
import { icsHref } from '@/features/meetings/components/add-to-calendar'
import { googleCalendarUrl, outlookCalendarUrl } from '@/features/meetings/ics'
import { eventDotClasses } from '@/features/meetings/event-color'
import { describeNextMeeting } from '@/features/meetings/next-meeting'
import {
  bilingualText,
  capChips,
  CountChip,
  MetaChip,
  QuestionsChip,
  ReconvenesChip,
  ROW_CHIP_CAP_DESKTOP,
  ROW_CHIP_CAP_MOBILE,
  SkeletonBlock,
} from '@/features/meetings/components/meeting-chips'
import {
  durationLabel,
  isAwaitingViewerRsvp,
  meetingTiming,
  noRsvpYet,
  tallyRsvps,
  type AttendeeResponse,
  type MeetingTiming,
} from '@/features/meetings/components/meeting-glance'
import { useGlanceMapOptional } from '@/features/meetings/components/use-glance-map'
import type { MeetingGlance } from '@/features/meetings/components/meeting-notes-model'
import type { MeetingSummary } from '@/features/meetings/queries'

/** How each face's mark reads to a screen reader and in its tooltip. */
const RESPONSE_WORD: Record<AttendeeResponse, string> = {
  going: 'going',
  maybe: 'maybe',
  declined: 'declined',
  pending: "hasn't replied",
}

/** Faces on a row before "+N" — enough to recognise a room, not a census. */
const ROW_FACES = 5

/** How the docket sections label their groups. 'none' keeps a flat list —
 *  the app page's tab and the agenda already carry their own headings. */
export type MeetingListGroupBy = 'none' | 'day' | 'month'

export function MeetingList({
  meetings,
  currentUserId,
  isAdmin,
  hideAppId,
  users = [],
  apps = [],
  offerCreate = false,
  groupBy = 'none',
  now: nowProp,
  todayIso: todayIsoProp,
  onOpenMeeting,
}: {
  meetings: MeetingSummary[]
  currentUserId: string
  isAdmin: boolean
  /**
   * The project whose chip to LEAVE OFF — the app page's own Meetings tab
   * passes its own id, because "you are already in this project".
   *
   * It does not hide the row's projects entirely, which is what the boolean it
   * replaced did: a meeting that also serves two other projects would then
   * render as if it belonged to this one alone, and the reader would have no
   * way to find out otherwise from the list.
   */
  hideAppId?: string
  /**
   * Attendee/mention pool for the row's edit and schedule-follow-up dialogs.
   * Empty just means those dialogs offer no people — except in the empty
   * state, where it is also the attendee pool the create form would have to
   * offer (see offersCreate).
   */
  users?: MentionUser[]
  /**
   * Whether this list's empty state may OFFER to create a meeting.
   *
   * Opt-in, and only true where a new meeting would actually land in the list
   * the button was pressed from. MeetingForm seeds the next slot from now, so
   * a past-scoped or app-scoped list must leave this false: the meeting it
   * created would be filed somewhere the reader is not looking, and the empty
   * state they are staring at would not change.
   */
  offerCreate?: boolean
  /**
   * Apps the edit dialog can move a meeting to. Optional so the surfaces that
   * render a list without one keep working — an empty list simply leaves
   * "No app" as the only choice, it does not disable editing.
   */
  apps?: { id: string; name: string }[]
  /**
   * ACCEPTED BUT INERT. Rows no longer mount MeetingIntelPanel, so there is
   * nothing here left to auto-open — the Dossier sheet (mounted by
   * MeetingsViews off `?open=`) took that job. Kept in the type so existing
   * callers (the agenda view) compile unchanged; never destructured.
   */
  openMeetingId?: string
  /** Styled-div group labels between rows — NOT headings, so the page outline
   *  (h1 → h2 Upcoming/Past → h3 row title) survives grouping untouched. */
  groupBy?: MeetingListGroupBy
  /** The shared list clock (useListNow) where the caller has one — a single
   *  read per render keeps neighbouring rows agreeing across midnight. */
  now?: Date
  /** Today as an Asia/Colombo ISO day, threaded from the server render so
   *  the "Today"/"Tomorrow" group labels agree across hydration (the server
   *  may run in UTC — see calendar-view.ts's header). Derived from `now` in
   *  the business timezone when absent. */
  todayIso?: string
  /**
   * Opens a meeting's Dossier sheet. The docket passes its own handler
   * (which writes `?open=` in place); surfaces without a sheet host fall
   * back to routing to /meetings, where the sheet lives.
   */
  onOpenMeeting?: (meeting: MeetingSummary) => void
}) {
  const router = useRouter()
  // One clock read for the whole list rather than one per row, so every row's
  // timing is measured against the same instant and cannot disagree with its
  // neighbour across a midnight boundary mid-render.
  const now = nowProp ?? new Date()
  // The business-timezone "today", for group identity — never the ambient
  // local day, which differs between the (UTC) server render and a Colombo
  // browser every evening.
  const todayIso = todayIsoProp ?? toIsoDateInTimeZone(now)
  const glanceMap = useGlanceMapOptional()

  const openMeeting =
    onOpenMeeting ??
    ((meeting: MeetingSummary) => router.push(`/meetings?view=list&open=${meeting.id}`))

  if (meetings.length === 0) {
    /*
     * Whether this empty state can offer creation rather than describe it.
     *
     * Two conditions, both about being able to keep the promise:
     *
     * `offerCreate` — opt-in, passed only by the upcoming list. Every other
     * caller leaves it false because the meeting this button makes starts at
     * the next slot from now: on the app page's tab it would be filed under
     * "No app" and vanish from a list filtered by project, and in the past
     * section it would be upcoming and therefore invisible there by
     * definition. Those surfaces offer creation through their own form,
     * seeded correctly.
     *
     * `users` — createMeeting requires at least one attendee, and the picker
     * can only offer the people passed in. With none, the dialog opens onto a
     * form that cannot be submitted.
     */
    const offersCreate = offerCreate && users.length > 0
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
        <div className="flex flex-col items-center gap-1">
          <CalendarDaysIcon className="size-5 text-muted-foreground/60" aria-hidden />
          <p className="text-sm font-medium">No meetings.</p>
          <p className="text-xs text-muted-foreground">
            {offersCreate
              ? // What happens after, rather than a second description of the
                // button under it: createMeeting notifies every attendee
                // except the organiser. Who MAY schedule one is a page-level
                // fact and is said once, on /meetings, not on each list.
                'Everyone you invite gets a notification.'
              : 'Schedule one to get the team in sync.'}
          </p>
        </div>
        {offersCreate ? (
          <MeetingForm
            apps={apps}
            activeUsers={users}
            trigger={
              <Button variant="outline" size="sm">
                New meeting
              </Button>
            }
          />
        ) : null}
      </div>
    )
  }

  const groups = groupMeetings(meetings, groupBy, todayIso)

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-1.5">
          {group.label ? (
            // A styled div, deliberately NOT a heading: day/month labels are
            // furniture inside the h2 section, and giving each one a heading
            // level would bury the row h3s a level too deep.
            <div className="px-1 font-mono text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </div>
          ) : null}
          {/* The docket: one hairline group container, rows divided by
              hairlines — rows are not cards floating in a void. */}
          <Stagger
            as="ul"
            count={group.meetings.length}
            className="flex flex-col divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border"
          >
            {group.meetings.map((meeting) => (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                now={now}
                canManage={isAdmin || meeting.createdBy === currentUserId}
                canDelete={isAdmin}
                currentUserId={currentUserId}
                hideAppId={hideAppId}
                users={users}
                apps={apps}
                glance={
                  glanceMap &&
                  glanceMap.status !== 'pending' &&
                  !glanceMap.pendingIds.has(meeting.id)
                    ? (glanceMap.glances[meeting.id] ?? null)
                    : undefined
                }
                glanceStatus={
                  glanceMap
                    ? // A paged-in row whose supplemental batch is still in
                      // flight pulses like the initial load did — absence
                      // already means null once the page's batch is 'ready'.
                      glanceMap.pendingIds.has(meeting.id)
                      ? 'pending'
                      : glanceMap.status
                    : 'none'
                }
                onOpen={() => openMeeting(meeting)}
              />
            ))}
          </Stagger>
        </div>
      ))}
    </div>
  )
}

/** Rows bucketed for rendering, in the order they arrived (the caller owns
 *  sort order — upcoming ascends, past descends, and grouping must not
 *  reorder either). Group identity is the meeting's BUSINESS-timezone day
 *  (toIsoDateInTimeZone), never the ambient local one: this renders on a
 *  UTC server and again in a Colombo browser, and a local-day key would
 *  regroup the whole list at hydration every evening. */
function groupMeetings(
  meetings: MeetingSummary[],
  groupBy: MeetingListGroupBy,
  todayIso: string,
): { key: string; label: string | null; meetings: MeetingSummary[] }[] {
  if (groupBy === 'none') return [{ key: 'all', label: null, meetings }]

  const groups: { key: string; label: string | null; meetings: MeetingSummary[] }[] = []
  for (const meeting of meetings) {
    const dayIso = toIsoDateInTimeZone(meeting.startsAt)
    const key = groupBy === 'day' ? dayIso : dayIso.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.meetings.push(meeting)
      continue
    }
    groups.push({ key, label: groupLabel(dayIso, groupBy, todayIso), meetings: [meeting] })
  }
  return groups
}

function groupLabel(dayIso: string, groupBy: 'day' | 'month', todayIso: string): string {
  // isoToDisplayDate carries the ISO day's calendar fields in local time for
  // format() only — the same words come out on both sides of hydration.
  const displayDate = isoToDisplayDate(dayIso)
  if (groupBy === 'month') return format(displayDate, 'MMMM yyyy')
  // The year is noise 51 weeks of the year and load-bearing in the 52nd —
  // same rule the date rail applied before this layout.
  const dated =
    dayIso.slice(0, 4) === todayIso.slice(0, 4)
      ? format(displayDate, 'EEE MMM d')
      : format(displayDate, 'EEE MMM d, yyyy')
  if (dayIso === todayIso) return `Today · ${dated}`
  if (dayIso === addCalendarDays(todayIso, 1)) return `Tomorrow · ${dated}`
  return dated
}

/** Timing is the one thing on the row that can outrank the title for
 *  attention — and only while it is happening or about to: the group label
 *  already names the day, so "Tomorrow" on every row would say it twice. */
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
  return <MetaChip tone="warning">{timing.label}</MetaChip>
}

/** A chip that deep-links into the meeting's write-up — every count on the
 *  row is a door, not a label (the inert chips were pain 3). */
function ChipButton({ onOpen, children }: { onOpen: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  )
}

/**
 * The row's chip line: strict priority, state first, capped so a busy meeting
 * never grows a second line. Tri-state per the glance contract — `undefined`
 * (batch still counting) is a fixed-width pulse, `null` is nothing, and a
 * failed batch renders NO glance chips at all: the list-level notice above
 * owns the failure, thirty per-row error chips would be a wall of red.
 */
function RowChips({
  meeting,
  timing,
  glance,
  glanceStatus,
  now,
  onOpen,
}: {
  meeting: MeetingSummary
  timing: MeetingTiming
  glance: MeetingGlance | null | undefined
  glanceStatus: 'none' | 'pending' | 'ready' | 'error'
  now: Date
  onOpen: () => void
}) {
  const chips: { key: string; node: ReactNode }[] = []

  if (timing.state === 'live' || timing.state === 'soon') {
    chips.push({ key: 'timing', node: <TimingChip timing={timing} /> })
  }

  if (glanceStatus === 'pending') {
    return (
      <>
        {chips.map((chip) => (
          <Fragment key={chip.key}>{chip.node}</Fragment>
        ))}
        {/* The chip's real box (26px: 20px leading + 4px padding + borders)
            — a shorter placeholder would grow the row when the batch lands
            and reflow the whole docket. */}
        <SkeletonBlock className="h-[26px] w-28 rounded-md" />
        {meeting.googleEventId ? <MetaChip icon={CalendarCheckIcon}>Invite sent</MetaChip> : null}
      </>
    )
  }

  if (glance) {
    if (glance.overdueActions > 0) {
      chips.push({
        key: 'overdue',
        node: (
          <ChipButton onOpen={onOpen}>
            <CountChip
              value={glance.overdueActions}
              unit="overdue"
              plural="overdue"
              tone="danger"
              icon={TriangleAlertIcon}
            />
          </ChipButton>
        ),
      })
    }
    if (glance.staleFollowups > 0) {
      chips.push({
        key: 'stale',
        node: (
          <ChipButton onOpen={onOpen}>
            <CountChip
              value={glance.staleFollowups}
              unit="stuck"
              plural="stuck"
              tone="danger"
              icon={TriangleAlertIcon}
            />
          </ChipButton>
        ),
      })
    }
    if (glance.openFollowups > 0) {
      chips.push({
        key: 'followups',
        node: (
          <ChipButton onOpen={onOpen}>
            <CountChip
              value={glance.openFollowups}
              unit="open follow-up"
              tone="warning"
              icon={MessageCircleQuestionIcon}
            />
          </ChipButton>
        ),
      })
    }
    if (glance.questions > 0) {
      chips.push({
        key: 'questions',
        node: (
          <ChipButton onOpen={onOpen}>
            <QuestionsChip count={glance.questions} />
          </ChipButton>
        ),
      })
    }
    if (glance.hasNotes) {
      chips.push({
        key: 'notes',
        node: (
          <ChipButton onOpen={onOpen}>
            {/* A document icon, not a sparkle: the fact is "this meeting has a
                write-up", and AI is not a decoration. */}
            <MetaChip icon={FileTextIcon} tone="success">
              Notes
            </MetaChip>
          </ChipButton>
        ),
      })
    } else if (timing.state === 'past') {
      // Only worth saying about a meeting that has already happened — an
      // upcoming meeting having no notes is not news.
      chips.push({
        key: 'no-notes',
        node: (
          <ChipButton onOpen={onOpen}>
            <MetaChip tone="warning">No notes yet</MetaChip>
          </ChipButton>
        ),
      })
    }
    // Gated on `.past` HERE rather than trusting ReconvenesChip's own null
    // return, so a gone date never spends one of the row's five chip slots
    // rendering nothing.
    if (glance.nextMeetingAt && !describeNextMeeting(glance.nextMeetingAt, now).past) {
      chips.push({
        key: 'reconvenes',
        node: <ReconvenesChip nextMeetingAt={glance.nextMeetingAt} now={now} />,
      })
    }
  }

  if (meeting.googleEventId) {
    chips.push({
      key: 'invite',
      node: <MetaChip icon={CalendarCheckIcon}>Invite sent</MetaChip>,
    })
  }

  const { shown } = capChips(chips, ROW_CHIP_CAP_DESKTOP)
  const desktopOverflow = chips.length - shown.length
  const mobileOverflow = Math.max(0, chips.length - ROW_CHIP_CAP_MOBILE)

  return (
    <>
      {shown.map((chip, index) =>
        index < ROW_CHIP_CAP_MOBILE ? (
          <Fragment key={chip.key}>{chip.node}</Fragment>
        ) : (
          <span key={chip.key} className="hidden sm:inline-flex">
            {chip.node}
          </span>
        ),
      )}
      {/* "+N" is a door like every counted chip — an inert span would leave
          keyboard and screen-reader users no way to learn what folded away. */}
      {desktopOverflow > 0 ? (
        <span className="hidden sm:inline-flex">
          <ChipButton onOpen={onOpen}>
            <MetaChip>
              +{desktopOverflow}
              <span className="sr-only"> more facts — open meeting details</span>
            </MetaChip>
          </ChipButton>
        </span>
      ) : null}
      {mobileOverflow > 0 ? (
        <span className="sm:hidden">
          <ChipButton onOpen={onOpen}>
            <MetaChip>
              +{mobileOverflow}
              <span className="sr-only"> more facts — open meeting details</span>
            </MetaChip>
          </ChipButton>
        </span>
      ) : null}
    </>
  )
}

/** The compact Yes/Maybe/No, on the row and only while the viewer's own
 *  answer is pending — the page's most frequent gesture must not hide
 *  behind the sheet. Same options and tokens as MeetingRsvp. */
function InlineRsvp({ meetingId, titleId }: { meetingId: string; titleId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const options = [
    { id: 'going', label: 'Yes', icon: Check, active: 'hover:text-success' },
    { id: 'maybe', label: 'Maybe', icon: HelpCircle, active: 'hover:text-warning' },
    { id: 'declined', label: 'No', icon: X, active: 'hover:text-destructive' },
  ] as const

  function respond(id: (typeof options)[number]['id']) {
    startTransition(async () => {
      // try/catch like handleDelete below: a thrown action (offline tap,
      // deploy mid-flight) is NOT an { ok: false } — unhandled, React 19
      // surfaces it to the route error boundary and the page's most frequent
      // gesture would replace the whole docket with the error page.
      try {
        const res = await respondToMeeting(meetingId, id)
        if (res.ok) {
          // Confirm and park focus BEFORE the refresh unmounts this trio
          // (awaitingMe flips false), or keyboard focus drops to <body> and
          // a screen reader hears nothing after pressing Yes.
          toast.success('RSVP saved')
          const title = document.getElementById(titleId)?.closest('button')
          if (title instanceof HTMLElement) title.focus()
          // refresh(): the row's pending state comes from the server list,
          // so the trio dismisses itself by no longer being needed.
          router.refresh()
        } else {
          toast.error(res.error)
        }
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <div
      role="group"
      aria-label="Your RSVP"
      className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={pending}
          onClick={() => respond(option.id)}
          className={cn(
            // 44px touch targets below md (the kebab's own size-11 md:size-8
            // rule — the spec pins "RSVP + kebab stay 44px" on mobile),
            // compact 28px from md up.
            'flex min-h-11 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-muted-foreground outline-none transition-colors duration-(--dur-quick) focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 motion-reduce:transition-none md:min-h-7 md:px-1.5',
            option.active,
          )}
        >
          <option.icon className="size-3.5" aria-hidden />
          {option.label}
        </button>
      ))}
    </div>
  )
}

function MeetingRow({
  meeting,
  now,
  canManage,
  canDelete,
  currentUserId,
  hideAppId,
  users,
  apps,
  glance,
  glanceStatus,
  onOpen,
}: {
  meeting: MeetingSummary
  now: Date
  canManage: boolean
  /** Deletion is admin-only — stricter than canManage, see deleteMeeting. */
  canDelete: boolean
  currentUserId: string
  hideAppId?: string
  users: MentionUser[]
  apps: { id: string; name: string }[]
  glance: MeetingGlance | null | undefined
  glanceStatus: 'none' | 'pending' | 'ready' | 'error'
  onOpen: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [schedulingFollowup, setSchedulingFollowup] = useState(false)

  const timing = meetingTiming(meeting.startsAt, meeting.endsAt, now)
  const rsvp = tallyRsvps(meeting.attendees)
  const awaitingMe = timing.state !== 'past' && isAwaitingViewerRsvp(meeting, currentUserId)
  const headingId = `meeting-title-${meeting.id}`
  const isLive = timing.state === 'live'
  const visibleApps = meeting.apps.filter((app) => app.id !== hideAppId)

  // Past + has a write-up + the room agreed no next date: the one state where
  // "Schedule follow-up" is a real next action rather than noise. A
  // deterministic MeetingForm prefill (same people, same projects) — no AI.
  const offerFollowup =
    timing.state === 'past' && Boolean(glance?.hasNotes) && !glance?.nextMeetingAt

  function handleDelete() {
    startTransition(async () => {
      try {
        const res = await deleteMeeting(meeting.id)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Meeting deleted')
        setConfirmingDelete(false)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <StaggerItem as="li">
      <article
        aria-labelledby={headingId}
        className={cn(
          'relative flex min-h-14 items-center gap-3 py-2 pr-2 pl-4 sm:pr-3',
          // A live meeting is the one thing worth pulling the eye off
          // everything else — the spec's live ring (the page's sole
          // structural colour), with the wash as a supplement; the tick's
          // identity job is replaced by the solid primary segment below.
          isLive && 'bg-primary/5 ring-1 ring-primary/25 ring-inset',
        )}
      >
        {/* The app-identity tick: 3px of the audited --event ramp, stacked
            for a joint meeting, absent for all-hands ([] apps). Identity
            never carries alone — the app names render as text badges beside
            the title (≥lg) and always in the sheet header. */}
        <div
          aria-hidden
          className="absolute inset-y-1.5 left-1 flex w-[3px] flex-col gap-px overflow-hidden rounded-full"
        >
          {isLive ? (
            <span className="min-h-0 flex-1 bg-primary" />
          ) : (
            visibleApps.map((app) => (
              <span key={app.id} className={cn('min-h-0 flex-1', eventDotClasses(app.id))} />
            ))
          )}
        </div>

        {/* Fixed-width mono time column — the docket's scannable left edge. */}
        <div className="hidden w-16 shrink-0 flex-col font-mono text-xs tabular-nums sm:flex">
          {isLive ? (
            <span className="flex items-center gap-1 font-medium text-primary">
              <span
                className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
                aria-hidden
              />
              Now
            </span>
          ) : (
            <span>{format(meeting.startsAt, 'h:mm a')}</span>
          )}
          <span className="text-muted-foreground">
            {durationLabel(meeting.startsAt, meeting.endsAt)}
          </span>
        </div>
        {/* The full date once, for readers — visible rows lean on the group
            label for the day. */}
        <time className="sr-only" dateTime={meeting.startsAt.toISOString()}>
          {format(meeting.startsAt, 'EEEE, MMMM d, yyyy h:mm a')}
        </time>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            {/* The title-block is one ≥44px button into the Dossier sheet —
                no stretched link, no hover-gated door. h3 keeps the outline
                (h2 section → h3 meeting); the button lives inside it, the
                accordion-header pattern. */}
            <h3 className="min-w-0 font-heading text-sm leading-snug font-semibold">
              <button
                type="button"
                onClick={onOpen}
                className="flex min-h-11 w-full flex-col items-start justify-center gap-0.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span id={headingId} className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{meeting.title}</span>
                  {meeting.visibility === 'attendees' ? (
                    <>
                      <LockIcon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="sr-only">Private — attendees only</span>
                    </>
                  ) : null}
                </span>
                {/* Mobile folds the time column into the title block. */}
                <span className="font-mono text-2xs font-normal text-muted-foreground tabular-nums sm:hidden">
                  {format(meeting.startsAt, 'h:mm a')} ·{' '}
                  {durationLabel(meeting.startsAt, meeting.endsAt)}
                </span>
              </button>
            </h3>
            {visibleApps.map((app) => (
              <Badge key={app.id} variant="secondary" className="hidden lg:inline-flex">
                {app.name}
              </Badge>
            ))}
            {/* Below lg the badges hide and the colour tick would carry app
                identity alone (WCAG 1.4.1) — name the projects for readers
                at every width. */}
            {visibleApps.length > 0 ? (
              <span className="sr-only lg:hidden">
                Projects: {visibleApps.map((app) => app.name).join(', ')}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <RowChips
              meeting={meeting}
              timing={timing}
              glance={glance}
              glanceStatus={glanceStatus}
              now={now}
              onOpen={onOpen}
            />
          </div>

          {meeting.agenda ? (
            // Desktop-only second line. A wrapper owns the hide/show so its
            // display never fights line-clamp's own `-webkit-box`; the clamp
            // is CSS — Sinhala graphemes are never cut by JS.
            <div className="hidden md:block">
              <p className={cn(bilingualText, 'line-clamp-1 text-muted-foreground')}>
                {meeting.agenda}
              </p>
            </div>
          ) : null}
        </div>

        {/* People cluster: who is coming, with per-person answers worn on the
            faces — identity data that used to hide behind the edit dialog. */}
        <div className="flex shrink-0 items-center gap-2">
          {rsvp.total > 0 ? (
            <MetaChip
              icon={UserCheckIcon}
              tone={noRsvpYet(rsvp, timing.state) ? 'warning' : 'neutral'}
              className="hidden sm:inline-flex"
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
          {meeting.attendees.length > 0 ? (
            <TooltipProvider>
              <AvatarGroup className="hidden md:flex">
                {meeting.attendees.slice(0, ROW_FACES).map((attendee) => (
                  <Tooltip key={attendee.id}>
                    {/* A real BUTTON wrapper (for the mark): it breaks
                        AvatarGroup's direct-child ring selector on purpose
                        (the ring rides the Avatar itself, against the row's
                        card surface) and — unlike a bare span — is focusable,
                        so Base UI opens the tooltip on Tab and sighted
                        keyboard users can reach each person's RSVP. */}
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="relative inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      }
                    >
                      <Avatar size="sm" className="ring-2 ring-card">
                        {attendee.avatarUrl ? (
                          <AvatarImage src={attendee.avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback>
                          {attendee.name.slice(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {/* Only the two answers worth a mark: declined and
                          never-answered. Words ride in the tooltip and
                          sr-only text — the mark is never the only signal. */}
                      {attendee.response === 'declined' ? (
                        <span
                          className="absolute -right-0.5 -bottom-0.5 z-10 flex size-3 items-center justify-center rounded-full bg-destructive text-destructive-foreground ring-2 ring-card"
                          aria-hidden
                        >
                          <X className="size-2" />
                        </span>
                      ) : null}
                      {attendee.response === 'pending' ? (
                        <span
                          className="absolute -right-0.5 -bottom-0.5 z-10 size-3 rounded-full border-2 border-muted-foreground bg-card ring-2 ring-card"
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
                {meeting.attendees.length > ROW_FACES ? (
                  <AvatarGroupCount>
                    +{meeting.attendees.length - ROW_FACES}
                    <span className="sr-only"> more attendees</span>
                  </AvatarGroupCount>
                ) : null}
              </AvatarGroup>
            </TooltipProvider>
          ) : null}
        </div>

        {/* Action cluster, always visible — never hover-revealed. */}
        <div className="flex shrink-0 items-center gap-1">
          {/* One-click Join for the meeting happening NOW — the old row's
              most valuable single control, which must not require opening
              the sheet mid-meeting. */}
          {isLive && meeting.meetingUrl ? (
            <a
              href={meeting.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
            >
              <VideoIcon className="size-4" aria-hidden /> Join
              <span className="sr-only"> {meeting.title} (opens in a new tab)</span>
            </a>
          ) : null}
          {awaitingMe ? <InlineRsvp meetingId={meeting.id} titleId={headingId} /> : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-11 md:size-8"
                  aria-label={`Actions for ${meeting.title}`}
                />
              }
            >
              <MoreVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-48">
              <DropdownMenuGroup>
                {/* The three calendar paths that cannot fail, straight from
                    add-to-calendar.tsx's helpers — the best-effort Google
                    invite stays in the sheet's full AddToCalendarMenu. */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <CalendarPlusIcon />
                    Add to calendar
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => window.location.assign(icsHref(meeting.id))}
                    >
                      <DownloadIcon />
                      Download invite (.ics)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={
                        <a
                          href={googleCalendarUrl({
                            title: meeting.title,
                            description: meeting.agenda,
                            location: meeting.meetingUrl,
                            url: meeting.meetingUrl,
                            startsAt: meeting.startsAt,
                            endsAt: meeting.endsAt,
                          })}
                          target="_blank"
                          rel="noreferrer noopener"
                        />
                      }
                    >
                      <ArrowUpRightIcon />
                      Google Calendar
                      <span className="sr-only">(opens in a new tab)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={
                        <a
                          href={outlookCalendarUrl({
                            title: meeting.title,
                            description: meeting.agenda,
                            location: meeting.meetingUrl,
                            url: meeting.meetingUrl,
                            startsAt: meeting.startsAt,
                            endsAt: meeting.endsAt,
                          })}
                          target="_blank"
                          rel="noreferrer noopener"
                        />
                      }
                    >
                      <ArrowUpRightIcon />
                      Outlook
                      <span className="sr-only">(opens in a new tab)</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                {canManage ? (
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <PencilIcon />
                    Edit
                  </DropdownMenuItem>
                ) : null}
                {offerFollowup ? (
                  <DropdownMenuItem onClick={() => setSchedulingFollowup(true)}>
                    <ListChecksIcon />
                    Schedule follow-up
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Dialogs the kebab items open. Mounted only while requested, so a
            thirty-row docket does not hold thirty idle forms. */}
        {editing ? (
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
            defaultOpen
            onOpenChange={(next) => {
              if (!next) setEditing(false)
            }}
          />
        ) : null}
        {schedulingFollowup ? (
          <MeetingForm
            apps={apps}
            activeUsers={users}
            // Deterministic prefill: same people, same projects, a titled
            // continuation. The start stays MeetingForm's own next-slot
            // default — nothing here knows who is free, and no AI is asked.
            prefill={{
              appIds: meeting.apps.map((app) => app.id),
              title: `Follow-up: ${meeting.title}`,
              attendeeIds: meeting.attendees.map((attendee) => attendee.id),
            }}
            defaultOpen
            onOpenChange={(next) => {
              if (!next) setSchedulingFollowup(false)
            }}
          />
        ) : null}
        {canDelete ? (
          <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
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
      </article>
    </StaggerItem>
  )
}
