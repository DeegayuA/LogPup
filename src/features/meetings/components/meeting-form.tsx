'use client'

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react'
import { addHours, format } from 'date-fns'
import { toast } from 'sonner'
import { Loader2, PlusIcon, UsersIcon, VideoIcon, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DateTimeWheelField, roundUpToStep } from '@/components/ui/datetime-wheel'
import { autoMeetingTitle, isAutoMeetingTitle } from '@/features/meetings/auto-title'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MeetingShareDialog } from '@/features/meetings/components/meeting-share-dialog'
import { Textarea } from '@/components/ui/textarea'
import { createMeeting, teamForApp, updateMeeting } from '@/features/meetings/actions'
import {
  addEveryone,
  applyQuickAddAttendees,
  applyTeamPrefill,
} from '@/features/meetings/attendee-prefill'
import { icsHref } from '@/features/meetings/components/add-to-calendar'
import { MEETING_URL_ERROR, isValidMeetingUrl } from '@/features/meetings/meeting-url'
import type { ActiveUser } from '@/features/people/queries'
import { matchApp, type AppOption } from '@/lib/app-match'
import { parseMeetingIntent, type MeetingIntent } from '@/lib/meeting-intent'

// Long enough that a fast typist isn't re-parsing mid-word, short enough that
// the preview still reads as live.
const QUICK_ADD_DEBOUNCE_MS = 200

type FormState = {
  /**
   * Every project this meeting is on, all equal, no primary. `[]` is a real
   * answer — a company all-hands belongs to nobody — and is what the old
   * "No app" sentinel used to stand for. There is no sentinel any more: an
   * empty selection says it in words instead.
   */
  appIds: string[]
  title: string
  start: Date
  end: Date
  agenda: string
  meetingUrl: string
  attendeeIds: string[]
  // Which of attendeeIds only the app-team prefill put there (see
  // attendee-prefill.ts for the swap semantics). Lives inside FormState, not
  // its own useState, so a prefill response updates both lists in ONE
  // updater — split state could apply one half against a form the user had
  // already changed.
  prefilledIds: string[]
  // Each selected project's team, as it came back from teamForApp. Kept in
  // FormState with prefilledIds and for the same reason: the prefilled set is
  // the UNION of the selected projects' teams, so a landing response and the
  // current selection have to be read in ONE updater — split state would apply
  // one project's team against a selection the user had already changed.
  // Cached per project so removing one withdraws exactly its people and
  // re-adding it costs no second fetch.
  teamsByApp: Record<string, string[]>
}

/** The prefilled portion is the union of the selected projects' teams. */
function withTeamPrefill(f: FormState, roster: string[]): FormState {
  const team = f.appIds.flatMap((id) => f.teamsByApp[id] ?? [])
  return { ...f, ...applyTeamPrefill(f, team, roster) }
}

/**
 * A meeting somebody has been ASKED to schedule, but has not yet.
 *
 * The R6 COVER-TOGETHER board proposes who, what and how long, and stops
 * there: the proposal ends where the create flow begins, so there is no second
 * form, no second write path and no second set of validation. Everything here
 * is a starting value in a dialog a human still has to submit — which is what
 * "suggestions, never invites" means in practice.
 */
export type MeetingPrefill = {
  appIds?: string[]
  title?: string
  /** Committed attendees, NOT app-team prefill. See the note in `emptyState`. */
  attendeeIds?: string[]
  agenda?: string
  /** How long the proposal says it needs. The start is still whatever the
   *  dialog would have defaulted to — nothing here knows who is free. */
  minutes?: number
}

function emptyState(
  defaultAppId?: string,
  startAt?: Date,
  endAt?: Date,
  prefill?: MeetingPrefill,
): FormState {
  // A slot the person clicked is already an exact time — round only the
  // "right now" default, which is never on a step boundary. Callers that
  // only know a DAY (the month grid's empty-cell click) put a sensible time
  // on it before calling, rather than this guessing one back out of a date.
  const start = startAt ?? roundUpToStep(new Date())
  const proposed = prefill?.minutes
    ? new Date(start.getTime() + prefill.minutes * 60_000)
    : null
  return {
    appIds: prefill?.appIds ?? (defaultAppId ? [defaultAppId] : []),
    title: prefill?.title ?? '',
    start,
    // A drag-created range hands in its own end; a click only knows a start,
    // and an hour is the default the wheel already teaches.
    end: proposed ?? (endAt && endAt > start ? endAt : addHours(start, 1)),
    agenda: prefill?.agenda ?? '',
    meetingUrl: '',
    attendeeIds: prefill?.attendeeIds ?? [],
    // Deliberately empty even when `prefill` named attendees. `prefilledIds`
    // marks people the APP-TEAM prefill put here, which a later app switch may
    // silently swap out (see attendee-prefill.ts). A proposal's group is a
    // deliberate answer to "who does this decision need", so it is treated the
    // way stateFromMeeting treats a saved meeting's attendees: committed.
    prefilledIds: [],
    teamsByApp: {},
  }
}

/** A parsed phrase with the app hint resolved against *this* dialog's apps. */
type QuickAddPreview = MeetingIntent & { appId: string | null }

/**
 * The parser reports a trailing "on <app>" as a query and leaves the name to
 * the caller, since only the dialog knows the app list. When the words name no
 * app we have, they were never an app hint — they go back on the title rather
 * than being silently dropped.
 */
function resolveQuickAdd(
  raw: string,
  people: ActiveUser[],
  apps: AppOption[],
): QuickAddPreview | null {
  const intent = parseMeetingIntent(raw, people)
  if (!intent) return null
  const app = intent.appQuery ? matchApp(intent.appQuery, apps) : null
  if (intent.appQuery && !app) {
    return {
      ...intent,
      title: `${intent.title} on ${intent.appQuery}`,
      appQuery: null,
      appName: null,
      appId: null,
    }
  }
  return { ...intent, appName: app?.name ?? null, appId: app?.id ?? null }
}

/** Just the host, so a long invite URL doesn't blow out the preview line. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'link'
  } catch {
    return 'link'
  }
}

/** The one-line "here is what I understood" the user reviews before applying. */
function describeQuickAdd(preview: QuickAddPreview): string {
  const parts = [preview.title]
  if (preview.startsAt) {
    const start = format(preview.startsAt, 'EEE, MMM d, h:mm a')
    parts.push(preview.endsAt ? `${start} – ${format(preview.endsAt, 'h:mm a')}` : start)
  }
  if (preview.attendees.length > 0) {
    parts.push(preview.attendees.map((attendee) => attendee.name).join(', '))
  }
  if (preview.appName) parts.push(preview.appName)
  // The parser lifts a pasted link out of the phrase entirely, so without this
  // the URL just vanishes from the preview with no sign it was understood.
  if (preview.meetingUrl) parts.push(hostOf(preview.meetingUrl))
  return parts.join(' · ')
}

/** Names the parser refused to guess at, said plainly. */
function quickAddProblems(preview: QuickAddPreview): string[] {
  const problems: string[] = []
  if (preview.ambiguous.length > 0) {
    problems.push(`More than one person matches ${preview.ambiguous.join(', ')} — add them by hand`)
  }
  if (preview.unresolved.length > 0) {
    problems.push(`No one here is called ${preview.unresolved.join(', ')}`)
  }
  return problems
}

/**
 * An existing meeting to edit instead of creating a new one. Passing this
 * turns the whole dialog into an edit dialog: it opens seeded with what the
 * meeting already is, and submits to `updateMeeting` rather than
 * `createMeeting`.
 *
 * One form for both, deliberately. Editing a meeting asks exactly the same
 * questions as scheduling one, and the alternative — a second, thinner "edit"
 * dialog — is how you end up with a field that can be set at creation and
 * never changed again, which is the bug this whole change exists to fix.
 */
export type EditableMeeting = {
  id: string
  /** Every project the meeting is on, ordered by name. `[]` is app-less. */
  appIds: string[]
  title: string
  startsAt: Date
  endsAt: Date
  agenda: string | null
  meetingUrl: string | null
  attendeeIds: string[]
}

function stateFromMeeting(meeting: EditableMeeting): FormState {
  return {
    appIds: meeting.appIds,
    title: meeting.title,
    start: meeting.startsAt,
    end: meeting.endsAt,
    agenda: meeting.agenda ?? '',
    meetingUrl: meeting.meetingUrl ?? '',
    attendeeIds: meeting.attendeeIds,
    // Nothing here came from the app-team prefill — these are attendees a
    // person actually committed to. Marking them prefilled would let a later
    // app switch silently swap them out (see attendee-prefill.ts).
    prefilledIds: [],
    teamsByApp: {},
  }
}

export function MeetingForm({
  apps,
  activeUsers,
  defaultAppId,
  defaultStart,
  defaultEnd,
  trigger,
  defaultOpen,
  onOpenChange: onOpenChangeProp,
  editing,
  prefill,
}: {
  apps: { id: string; name: string }[]
  activeUsers: ActiveUser[]
  defaultAppId?: string
  /** Pre-fill the start time (and, one hour later, the end) — set when a
   *  calendar slot or day cell is what opened this. */
  defaultStart?: Date
  /** Drag-created ranges carry their own end; clicks leave it to the 1h default. */
  defaultEnd?: Date
  /** Omit for a caller that opens this form itself with no visible trigger of
   *  its own — the calendar mounts one keyed `MeetingForm` for the slot that
   *  was clicked and passes `defaultOpen` instead. */
  trigger?: ReactElement
  defaultOpen?: boolean
  /** Told whenever the dialog opens or closes, so a caller holding the slot that
   *  opened it can drop that slot again on close. */
  onOpenChange?: (open: boolean) => void
  editing?: EditableMeeting
  /** Starting values for a meeting somebody has been asked to schedule. Ignored
   *  when `editing` is set — a proposal cannot be an edit of a meeting that
   *  already exists. */
  prefill?: MeetingPrefill
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [isPending, startTransition] = useTransition()
  const [attendeePickerOpen, setAttendeePickerOpen] = useState(false)
  const [appPickerOpen, setAppPickerOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() =>
    editing
      ? stateFromMeeting(editing)
      : emptyState(defaultAppId, defaultStart, defaultEnd, prefill),
  )
  // Which projects' teamForApp calls are in flight — drives the loading line
  // in the attendees block. A SET, not one id: adding two projects at once
  // starts two fetches, and a single id would make the line disappear the
  // moment the first landed while the second was still running. Rendered only
  // while at least one of them is still selected, so a fetch for a project the
  // user has since removed never shows a loading line.
  const [pendingTeamAppIds, setPendingTeamAppIds] = useState<string[]>([])
  // `quickAdd` is what is being typed; `settled` trails it by the debounce and
  // is the only thing the (re-parsed) preview reads, so parsing never runs on
  // a half-typed word.
  const [quickAdd, setQuickAdd] = useState('')
  // "Mint a Google Meet link on save". Separate from `form` because it is a
  // request about the save, not a field of the meeting — and it must survive
  // the parser writing into form.meetingUrl without being clobbered.
  const [withMeet, setWithMeet] = useState(false)
  // Set AFTER the form dialog closes on a successful create: the share sheet
  // is its own dialog, keyed on the new meeting's id.
  const [shareMeetingId, setShareMeetingId] = useState<string | null>(null)
  const [settled, setSettled] = useState('')

  // No render-time "did `open` change?" sync here on purpose. `open` is this
  // component's own state, so every open/close goes through handleOpenChange
  // below, which reseeds the fields from the truth — and it knows whether it
  // is reseeding a blank create or the meeting being edited, which a
  // render-time sync watching a bare boolean does not. A caller that wants a
  // form seeded differently mounts a new one under a new `key` (the calendar
  // does, per clicked slot) rather than driving an `open` prop.
  //
  // Auto-fill: the moment the debounced parse yields something usable, it
  // flows straight into the form — no "Apply" step. Manual edits afterward
  // stick until the next change to the quick-add text re-parses. Both the
  // settle and the fill happen inside the TIMER CALLBACK, not the effect
  // body: the effect's only job is wiring up the debounce timer (an external
  // system), and setState from its callback is an event, not a render-time
  // cascade — which is also what keeps this off the set-state-in-effect lint.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(quickAdd)
      const parsed = quickAdd.trim() ? resolveQuickAdd(quickAdd, activeUsers, apps) : null
      if (!parsed) return
      setForm((f) => ({
        ...f,
        title: parsed.title.slice(0, 120),
        // A phrase names ONE project and ADDS it — it does not re-point the
        // meeting off the projects already chosen, because with several
        // allowed there is nothing to re-point from.
        appIds:
          parsed.appId && !f.appIds.includes(parsed.appId)
            ? [...f.appIds, parsed.appId]
            : f.appIds,
        start: parsed.startsAt ?? f.start,
        end: parsed.endsAt ?? f.end,
        meetingUrl: parsed.meetingUrl ?? f.meetingUrl,
        // Named people join (or are promoted to) manual. `appChanged` is false
        // on purpose: that flag withdraws the previous app's team prefill, and
        // adding a project withdraws nothing — the prefilled set is the union
        // of the selected projects' teams, so it only shrinks when one is
        // REMOVED. The phrase's project team is still deliberately not fetched
        // (see applyQuickAddAttendees): in a phrase, the names ARE the
        // decision.
        ...applyQuickAddAttendees(f, parsed.attendees.map((a) => a.id), false),
      }))
    }, QUICK_ADD_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [quickAdd, activeUsers, apps])

  // What the preview line below the field reads — recomputed from the settled
  // text so it can never disagree with what the timer just applied.
  const preview = useMemo(
    () => (settled.trim() ? resolveQuickAdd(settled, activeUsers, apps) : null),
    [settled, activeUsers, apps],
  )

  function handleOpenChange(next: boolean) {
    setOpen(next)
    onOpenChangeProp?.(next)
    if (next) {
      // Re-opening always starts from the truth again: a blank form when
      // creating, and the meeting as it currently stands when editing — so
      // abandoning an edit and reopening never resurrects the half-typed
      // version that was walked away from.
      setForm(editing ? stateFromMeeting(editing) : emptyState(defaultAppId, defaultStart, defaultEnd))
      setQuickAdd('')
      setSettled('')
      setWithMeet(false)
      // Opened from an app page (defaultAppId set): the meeting is linked to
      // that app from the first paint, so its team is offered without a
      // manual re-select of the same app. Never on an edit — the attendees
      // are already whatever this meeting actually has, and prefilling would
      // add the whole app team to a meeting deliberately scoped smaller.
      if (defaultAppId && !editing) void prefillTeam(defaultAppId)
    }
  }

  /**
   * Fills the form below — never submits it. Re-parses the live text rather
   * than reusing `preview`, so hitting Enter the instant you stop typing can't
   * apply a stale reading.
   */
  function applyQuickAdd() {
    const intent = resolveQuickAdd(quickAdd, activeUsers, apps)
    if (!intent) {
      // Nothing usable: flush the debounce so the reason is on screen, and put
      // focus on the field it describes. The button stays enabled — a disabled
      // one is skipped by some AT and explains nothing when it is reached.
      setSettled(quickAdd)
      document.getElementById('meeting-quick-add')?.focus()
      return
    }
    setForm((f) => ({
      ...f,
      title: intent.title.slice(0, 120),
      // Set directly instead of going through toggleApp: that would
      // fetch and prefill the app's whole team on top of the explicit
      // "with <names>" just typed. Naming people IS the attendee decision
      // here — the team suggestion rides only on the app select.
      appIds:
        intent.appId && !f.appIds.includes(intent.appId)
          ? [...f.appIds, intent.appId]
          : f.appIds,
      start: intent.startsAt ?? f.start,
      end: intent.endsAt ?? f.end,
      meetingUrl: intent.meetingUrl ?? f.meetingUrl,
      // Same merge as the auto-fill effect — see there for why `appChanged`
      // is false now that a phrase adds a project rather than replacing one.
      ...applyQuickAddAttendees(f, intent.attendees.map((a) => a.id), false),
    }))
  }

  function handleQuickAddKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    // The field sits outside <form>, but stop the keypress anyway so no future
    // move of this block can turn Enter into a submit.
    event.preventDefault()
    applyQuickAdd()
  }

  /**
   * One teamForApp call per project ADDED (itself a single query over
   * assignments); the merge is pure and lives in attendee-prefill.ts.
   *
   * The response is cached into `teamsByApp` and the prefilled set is then
   * recomputed from the CURRENT selection, so a response that lands after the
   * user removed that project simply contributes nothing — no stale team can
   * survive, and no separate "is it still selected?" guard has to be kept in
   * step with the selection.
   */
  async function prefillTeam(appId: string) {
    setPendingTeamAppIds((ids) => (ids.includes(appId) ? ids : [...ids, appId]))
    try {
      const res = await teamForApp(appId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const team = res.data.map((member) => member.id)
      setForm((f) =>
        withTeamPrefill(
          { ...f, teamsByApp: { ...f.teamsByApp, [appId]: team } },
          activeUsers.map((u) => u.id),
        ),
      )
    } catch {
      // The ActionResult contract means the action itself never throws — this
      // catches the transport (offline, dialog closed mid-flight), which can.
      toast.error('Could not load the team for that app')
    } finally {
      setPendingTeamAppIds((ids) => ids.filter((id) => id !== appId))
    }
  }

  // Fills the title in from the app and start time, but only while the title
  // is still ours to fill: an empty box, or a suggestion we generated earlier
  // and the user has not replaced. The moment someone types their own title,
  // every later app or time change leaves it alone.
  function withAutoTitle(f: FormState, next: { appIds?: string[]; start?: Date }): FormState {
    const merged = { ...f, ...next }
    if (merged.title.trim() && !isAutoMeetingTitle(merged.title)) return merged
    // Only while EXACTLY ONE project is selected. autoMeetingTitle takes one
    // name, and the title is capped at 120 characters — concatenating three
    // project names would overflow it and, worse, invent a name nobody chose.
    // With two or more the title is left alone; isAutoMeetingTitle still
    // protects a human-typed one either way.
    const appName =
      merged.appIds.length === 1
        ? (apps.find((app) => app.id === merged.appIds[0])?.name ?? null)
        : null
    const suggested = autoMeetingTitle({ appName, startsAt: merged.start })
    // An empty suggestion means "no app chosen" — keep whatever is there
    // rather than blanking a title the user is midway through typing.
    return suggested ? { ...merged, title: suggested } : merged
  }

  /**
   * Adds or removes ONE project. Every project is equal, so this is a toggle,
   * not a replacement.
   *
   * Removing withdraws exactly that project's team suggestion immediately —
   * not when some response arrives — and adding withdraws nothing. Manually
   * picked people survive both, which is applyTeamPrefill's whole contract.
   */
  function toggleApp(appId: string) {
    const adding = !form.appIds.includes(appId)
    setForm((f) => {
      const appIds = f.appIds.includes(appId)
        ? f.appIds.filter((id) => id !== appId)
        : [...f.appIds, appId]
      return withAutoTitle(
        withTeamPrefill({ ...f, appIds }, activeUsers.map((u) => u.id)),
        { appIds },
      )
    })
    // Cached teams are reused — re-adding a project it already fetched costs
    // no second round trip.
    if (adding && !form.teamsByApp[appId]) void prefillTeam(appId)
  }

  function toggleAttendee(id: string) {
    setForm((f) => ({
      ...f,
      attendeeIds: f.attendeeIds.includes(id)
        ? f.attendeeIds.filter((a) => a !== id)
        : [...f.attendeeIds, id],
      // Either direction is a human decision about this person: adding makes
      // them manual, and removing spends their prefill entry — so a later
      // re-add is manual too, and an app change won't take them back out.
      prefilledIds: f.prefilledIds.filter((a) => a !== id),
    }))
  }

  // Keeps a meeting from ever ending before (or exactly when) it starts:
  // once the start wheel is moved past the current end time, the end auto-
  // follows to start+1h. Manual edits to the end field afterward are left
  // alone — this only fires off a start change.
  function handleStartChange(next: Date) {
    setForm((f) =>
      withAutoTitle(
        { ...f, start: next, end: next >= f.end ? addHours(next, 1) : f.end },
        { start: next },
      ),
    )
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // The submit button stays enabled so assistive tech can reach it and be
    // told *why* the form won't go through: a disabled button is skipped by
    // some AT navigation modes and states no reason when it is reached.
    // Blocking problems move focus to the offending control instead, whose
    // aria-describedby points at the (role="alert") message.
    if (endBeforeStart) {
      document.getElementById('meeting-end')?.focus()
      return
    }
    if (linkInvalid) {
      document.getElementById('meeting-link')?.focus()
      return
    }
    if (noAttendees) {
      document.getElementById('meeting-attendees-add')?.focus()
      return
    }
    startTransition(async () => {
      try {
        const fields = {
          appIds: form.appIds,
          title: form.title,
          startsAt: form.start.toISOString(),
          endsAt: form.end.toISOString(),
          agenda: form.agenda || undefined,
          meetingUrl: form.meetingUrl,
          attendeeIds: form.attendeeIds,
          // Only meaningful with a blank link — the server enforces the same.
          withMeet: withMeet && !form.meetingUrl ? true : undefined,
        }
        const res = editing
          ? await updateMeeting({ meetingId: editing.id, ...fields })
          : await createMeeting(fields)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        if (res.data.calendarWarning) {
          // The meeting is saved; only Google's email invites are missing. Say
          // that plainly and put the path that always works one click away, in
          // the same toast — a retry here would fail the same way it just did.
          const meetingId = res.data.meetingId
          toast.warning(res.data.calendarWarning, {
            action: {
              label: 'Download invite',
              onClick: () => window.location.assign(icsHref(meetingId)),
            },
            duration: 12_000,
          })
        } else if (!editing && res.data.meetUrl) {
          toast.success('Meeting created — Google Meet link added')
        } else toast.success(editing ? 'Meeting updated' : 'Meeting created')
        handleOpenChange(false)
        // The share sheet follows every successful CREATE — most of all when
        // Google's own emails failed, which is exactly when a WhatsApp nudge
        // is the only delivery. Edits change details; they don't re-invite.
        if (!editing) setShareMeetingId(res.data.meetingId)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  const selectedAttendees = form.attendeeIds
    .map((id) => activeUsers.find((u) => u.id === id))
    .filter((u): u is ActiveUser => Boolean(u))
  const availableUsers = activeUsers.filter((u) => !form.attendeeIds.includes(u.id))
  // Ordered by the `apps` prop, which the server hands over sorted by name —
  // so the chips read the same way the badges elsewhere do.
  const selectedApps = apps.filter((app) => form.appIds.includes(app.id))
  const availableApps = apps.filter((app) => !form.appIds.includes(app.id))
  // Title length is left to the input's native `required`/`minLength` — these
  // two have no native equivalent, so they are surfaced (and focused) by hand.
  const endBeforeStart = form.end <= form.start
  const noAttendees = form.attendeeIds.length === 0
  // Mirrors the server rule so a bad paste is caught before the round-trip.
  // Blank is valid — the link is optional.
  const linkInvalid = !isValidMeetingUrl(form.meetingUrl)

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit meeting' : 'New meeting'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Change the details, the time, or who is invited.'
              : 'Schedule a meeting and invite the team.'}
          </DialogDescription>
        </DialogHeader>
        {/* Deliberately outside the <form>: this only ever fills the fields
            below, so it must never be able to submit them. */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-3">
          <Label htmlFor="meeting-quick-add">Quick add — fills the form as you type</Label>
          <Input
            id="meeting-quick-add"
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            onKeyDown={handleQuickAddKeyDown}
            placeholder="standup tomorrow 9pm with shanika https://meet.google.com/…"
            aria-describedby="meeting-quick-add-preview"
            autoComplete="off"
            className="bg-background"
          />
          <div id="meeting-quick-add-preview" aria-live="polite" className="flex flex-col gap-1">
            {preview ? (
              <>
                <p className="text-xs text-muted-foreground">{describeQuickAdd(preview)}</p>
                {quickAddProblems(preview).map((problem) => (
                  <p key={problem} className="text-xs text-destructive">
                    {problem}
                  </p>
                ))}
              </>
            ) : null}
            {settled.trim() && !preview ? (
              <p className="text-xs text-muted-foreground">
                Add a name for the meeting — standup, design review, 1:1…
              </p>
            ) : null}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Apps</Label>
            {/* A meeting can serve several projects and none of them is the
                primary one, so this is a toggle list, not a Select. There is
                no "No app" item: an empty selection IS "no project", and the
                line below says so in words rather than as a sentinel row. */}
            {selectedApps.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedApps.map((app) => (
                  <Badge key={app.id} variant="secondary" className="gap-1">
                    {app.name}
                    <button
                      type="button"
                      onClick={() => toggleApp(app.id)}
                      className="ml-0.5 rounded-full p-0.5 text-muted-foreground outline-none transition-colors duration-150 hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={`Remove ${app.name}`}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No app — this meeting isn’t filed under a project.
              </p>
            )}
            <Popover open={appPickerOpen} onOpenChange={setAppPickerOpen}>
              <PopoverTrigger
                render={
                  <Button id="meeting-app" variant="outline" size="sm" type="button" className="w-fit" />
                }
              >
                <PlusIcon /> Add app
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0">
                <Command>
                  <CommandInput placeholder="Search apps…" />
                  <CommandList>
                    <CommandEmpty>
                      {apps.length === 0 ? 'No apps yet.' : 'No apps found.'}
                    </CommandEmpty>
                    <CommandGroup>
                      {availableApps.map((app) => (
                        <CommandItem
                          key={app.id}
                          onSelect={() => {
                            toggleApp(app.id)
                            setAppPickerOpen(false)
                          }}
                        >
                          {app.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meeting-title">Title</Label>
            <Input
              id="meeting-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              minLength={2}
              maxLength={120}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <DateTimeWheelField
              id="meeting-start"
              label="Starts"
              value={form.start}
              onChange={handleStartChange}
              className="min-w-0"
            />
            <DateTimeWheelField
              id="meeting-end"
              label="Ends"
              value={form.end}
              onChange={(end) => setForm((f) => ({ ...f, end }))}
              invalid={endBeforeStart}
              describedBy={endBeforeStart ? 'meeting-end-error' : undefined}
              className="min-w-0"
            />
          </div>
          {endBeforeStart ? (
            <p id="meeting-end-error" role="alert" className="-mt-2 text-xs text-destructive">
              End must be after the start time.
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meeting-agenda">Agenda</Label>
            <Textarea
              id="meeting-agenda"
              value={form.agenda}
              onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
              maxLength={2000}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meeting-link">Link</Label>
            <div className="flex items-start gap-2">
              <Input
                id="meeting-link"
                type="url"
                inputMode="url"
                value={form.meetingUrl}
                onChange={(e) => {
                  const value = e.target.value
                  // Typing a link IS the answer to "which room?" — it cancels
                  // the minted one rather than racing it.
                  if (value) setWithMeet(false)
                  setForm((f) => ({ ...f, meetingUrl: value }))
                }}
                placeholder="https://meet.google.com/…"
                autoComplete="off"
                className="hover:border-ring/40"
                disabled={withMeet}
                aria-invalid={linkInvalid || undefined}
                aria-describedby={linkInvalid ? 'meeting-link-error' : 'meeting-link-hint'}
              />
              {!editing && !form.meetingUrl ? (
                <Button
                  type="button"
                  variant={withMeet ? 'secondary' : 'outline'}
                  className="shrink-0"
                  aria-pressed={withMeet}
                  onClick={() => setWithMeet((v) => !v)}
                >
                  <VideoIcon aria-hidden />
                  {withMeet ? 'Meet on save' : 'Create Meet link'}
                </Button>
              ) : null}
            </div>
            {linkInvalid ? (
              <p id="meeting-link-error" role="alert" className="text-xs text-destructive">
                {MEETING_URL_ERROR}
              </p>
            ) : (
              <p id="meeting-link-hint" className="text-xs text-muted-foreground">
                {withMeet
                  ? 'A Google Meet room will be created and its link filled in when you save — needs your Google Calendar connection.'
                  : 'Meet, Zoom or Teams link — attendees get a one-click join'}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Attendees</Label>
            {/* The prefill edits this list without the user touching it, so
                it says what it is doing: a loading line while the team is
                fetched, then a provenance line while any suggestion is
                present. aria-live because the chips themselves appear
                silently to a screen reader — this is the announcement. */}
            <div aria-live="polite">
              {pendingTeamAppIds.some((id) => form.appIds.includes(id)) ? (
                <p className="text-xs text-muted-foreground">Adding the app team…</p>
              ) : form.prefilledIds.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Suggested from the app teams — remove anyone not needed.
                </p>
              ) : null}
            </div>
            {selectedAttendees.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedAttendees.map((u) => (
                  <Badge key={u.id} variant="secondary" className="gap-1">
                    {u.name}
                    <button
                      type="button"
                      onClick={() => toggleAttendee(u.id)}
                      className="ml-0.5 rounded-full p-0.5 text-muted-foreground outline-none transition-colors duration-150 hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={`Remove ${u.name}`}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={attendeePickerOpen} onOpenChange={setAttendeePickerOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      id="meeting-attendees-add"
                      variant="outline"
                      size="sm"
                      type="button"
                      aria-invalid={noAttendees || undefined}
                      aria-describedby={noAttendees ? 'meeting-attendees-error' : undefined}
                      className="w-fit"
                    />
                  }
                >
                  <PlusIcon /> Add attendee
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0">
                  <Command>
                    <CommandInput placeholder="Search people…" />
                    <CommandList>
                      <CommandEmpty>No one found.</CommandEmpty>
                      <CommandGroup>
                        {availableUsers.map((u) => (
                          <CommandItem
                            key={u.id}
                            onSelect={() => {
                              toggleAttendee(u.id)
                              setAttendeePickerOpen(false)
                            }}
                          >
                            {u.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {/* Ad-hoc meetings (no app => no team to prefill) get ONE bulk
                  affordance instead of the whole org being auto-dumped into
                  every meeting. Deliberately hidden once an app is chosen —
                  there the team prefill is the bulk path. Joins as manual
                  picks: clicking this is a decision, not a suggestion. */}
              {form.appIds.length === 0 && availableUsers.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      attendeeIds: addEveryone(f.attendeeIds, activeUsers.map((u) => u.id)),
                    }))
                  }
                >
                  <UsersIcon /> Add everyone active
                </Button>
              ) : null}
            </div>
            {noAttendees ? (
              <p id="meeting-attendees-error" role="alert" className="text-xs text-destructive">
                At least one attendee is required.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" disabled={isPending} />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {editing
                ? isPending
                  ? 'Saving…'
                  : 'Save changes'
                : isPending
                  ? 'Creating…'
                  : 'Create meeting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
      <MeetingShareDialog meetingId={shareMeetingId} onClose={() => setShareMeetingId(null)} />
    </>
  )
}
