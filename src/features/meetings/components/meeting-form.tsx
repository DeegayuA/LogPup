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
import { Loader2, PlusIcon, UsersIcon, XIcon } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { parseMeetingIntent, type MeetingIntent } from '@/lib/meeting-intent'

const NO_APP = '__none__'
// Long enough that a fast typist isn't re-parsing mid-word, short enough that
// the preview still reads as live.
const QUICK_ADD_DEBOUNCE_MS = 200

type FormState = {
  appId: string
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
}

function emptyState(defaultAppId?: string, startAt?: Date): FormState {
  // A slot the person clicked is already an exact time — round only the
  // "right now" default, which is never on a step boundary.
  const start = startAt ?? roundUpToStep(new Date())
  return {
    appId: defaultAppId ?? '',
    title: '',
    start,
    end: addHours(start, 1),
    agenda: '',
    meetingUrl: '',
    attendeeIds: [],
    prefilledIds: [],
  }
}

type AppOption = { id: string; name: string }
/** A parsed phrase with the app hint resolved against *this* dialog's apps. */
type QuickAddPreview = MeetingIntent & { appId: string | null }

function matchApp(query: string, apps: AppOption[]): AppOption | null {
  const q = query.toLowerCase()
  const exact = apps.filter((app) => app.name.toLowerCase() === q)
  const matches = exact.length > 0 ? exact : apps.filter((app) => app.name.toLowerCase().includes(q))
  // Two candidates is no better than none — the app select stays untouched.
  return matches.length === 1 ? matches[0] : null
}

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
  appId: string | null
  title: string
  startsAt: Date
  endsAt: Date
  agenda: string | null
  meetingUrl: string | null
  attendeeIds: string[]
}

function stateFromMeeting(meeting: EditableMeeting): FormState {
  return {
    appId: meeting.appId ?? '',
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
  }
}

export function MeetingForm({
  apps,
  activeUsers,
  defaultAppId,
  trigger,
  defaultOpen,
  defaultStart,
  onOpenChange: onOpenChangeProp,
  editing,
}: {
  apps: { id: string; name: string }[]
  activeUsers: ActiveUser[]
  defaultAppId?: string
  trigger: ReactElement
  defaultOpen?: boolean
  /** Pre-fill the start time — set when a calendar slot is what opened this. */
  defaultStart?: Date
  /** Told whenever the dialog opens or closes, so a caller holding the slot that
   *  opened it can drop that slot again on close. */
  onOpenChange?: (open: boolean) => void
  editing?: EditableMeeting
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [isPending, startTransition] = useTransition()
  const [attendeePickerOpen, setAttendeePickerOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() =>
    editing ? stateFromMeeting(editing) : emptyState(defaultAppId, defaultStart),
  )
  // Which app's teamForApp call is in flight — drives the loading line in
  // the attendees block. Rendered only while it matches form.appId, so a
  // stale fetch (the user already moved to another app or "No app") never
  // shows a loading line for a selection it no longer belongs to.
  const [pendingTeamAppId, setPendingTeamAppId] = useState<string | null>(null)
  // `quickAdd` is what is being typed; `settled` trails it by the debounce and
  // is the only thing the (re-parsed) preview reads, so parsing never runs on
  // a half-typed word.
  const [quickAdd, setQuickAdd] = useState('')
  const [settled, setSettled] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setSettled(quickAdd), QUICK_ADD_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [quickAdd])

  const preview = useMemo(
    () => (settled.trim() ? resolveQuickAdd(settled, activeUsers, apps) : null),
    [settled, activeUsers, apps],
  )

  // Auto-fill: the moment the debounced parse yields something usable, it flows
  // straight into the form — no "Apply" step. Manual edits afterward stick until
  // the next change to the quick-add text re-parses.
  useEffect(() => {
    if (!preview) return
    setForm((f) => ({
      ...f,
      title: preview.title.slice(0, 120),
      appId: preview.appId ?? f.appId,
      start: preview.startsAt ?? f.start,
      end: preview.endsAt ?? f.end,
      meetingUrl: preview.meetingUrl ?? f.meetingUrl,
      // Named people join (or are promoted to) manual; a phrase that
      // re-points the app also withdraws the previous app's team prefill —
      // otherwise the old team rides along onto the new app and gets
      // submitted with it. See applyQuickAddAttendees for both rules.
      ...applyQuickAddAttendees(
        f,
        preview.attendees.map((a) => a.id),
        preview.appId !== null && preview.appId !== f.appId,
      ),
    }))
  }, [preview])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    onOpenChangeProp?.(next)
    if (next) {
      // Re-opening always starts from the truth again: a blank form when
      // creating, and the meeting as it currently stands when editing — so
      // abandoning an edit and reopening never resurrects the half-typed
      // version that was walked away from.
      setForm(editing ? stateFromMeeting(editing) : emptyState(defaultAppId, defaultStart))
      setQuickAdd('')
      setSettled('')
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
      // Set directly instead of going through handleAppChange: that would
      // fetch and prefill the app's whole team on top of the explicit
      // "with <names>" just typed. Naming people IS the attendee decision
      // here — the team suggestion rides only on the app select.
      appId: intent.appId ?? f.appId,
      start: intent.startsAt ?? f.start,
      end: intent.endsAt ?? f.end,
      meetingUrl: intent.meetingUrl ?? f.meetingUrl,
      // Same merge as the auto-fill effect: named people become manual, and
      // re-pointing the app withdraws the previous app's team prefill.
      ...applyQuickAddAttendees(
        f,
        intent.attendees.map((a) => a.id),
        intent.appId !== null && intent.appId !== f.appId,
      ),
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
   * One teamForApp call per app selection (itself a single query over
   * assignments); the merge is pure and lives in attendee-prefill.ts. The
   * updater re-checks the selected app before applying: a response can land
   * after the user has already switched to "No app" (which fetches nothing,
   * so nothing newer would overwrite the stale team) or after quick-add
   * re-pointed the form at a different app.
   */
  async function prefillTeam(appId: string) {
    setPendingTeamAppId(appId)
    try {
      const res = await teamForApp(appId)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setForm((f) => {
        if (f.appId !== appId) return f
        return {
          ...f,
          ...applyTeamPrefill(f, res.data.map((member) => member.id), activeUsers.map((u) => u.id)),
        }
      })
    } catch {
      // The ActionResult contract means the action itself never throws — this
      // catches the transport (offline, dialog closed mid-flight), which can.
      toast.error('Could not load the team for that app')
    } finally {
      // Only the fetch that set the marker may clear it — a slow response
      // for a superseded app must not hide the loading line of the current
      // one's still-running fetch.
      setPendingTeamAppId((current) => (current === appId ? null : current))
    }
  }

  function handleAppChange(appId: string) {
    // The old team suggestion is withdrawn the moment the app changes — not
    // when (or if) the new team arrives. Waiting for the response to do the
    // swap shows the previous app's team on the new app during the fetch,
    // and strands it there for good if the fetch fails (only a toast would
    // say anything). Manually-picked people stay either way; "No app" just
    // ends here with nothing to fetch.
    setForm((f) => ({ ...f, appId, ...applyTeamPrefill(f, [], []) }))
    if (appId) void prefillTeam(appId)
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
    setForm((f) => ({
      ...f,
      start: next,
      end: next >= f.end ? addHours(next, 1) : f.end,
    }))
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
          appId: form.appId || null,
          title: form.title,
          startsAt: form.start.toISOString(),
          endsAt: form.end.toISOString(),
          agenda: form.agenda || undefined,
          meetingUrl: form.meetingUrl,
          attendeeIds: form.attendeeIds,
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
        } else toast.success(editing ? 'Meeting updated' : 'Meeting created')
        handleOpenChange(false)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  const selectedAttendees = form.attendeeIds
    .map((id) => activeUsers.find((u) => u.id === id))
    .filter((u): u is ActiveUser => Boolean(u))
  const availableUsers = activeUsers.filter((u) => !form.attendeeIds.includes(u.id))
  // Title length is left to the input's native `required`/`minLength` — these
  // two have no native equivalent, so they are surfaced (and focused) by hand.
  const endBeforeStart = form.end <= form.start
  const noAttendees = form.attendeeIds.length === 0
  // Mirrors the server rule so a bad paste is caught before the round-trip.
  // Blank is valid — the link is optional.
  const linkInvalid = !isValidMeetingUrl(form.meetingUrl)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
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
            <Label htmlFor="meeting-app">App</Label>
            <Select
              value={form.appId || NO_APP}
              onValueChange={(value) => handleAppChange(value === NO_APP ? '' : (value ?? ''))}
            >
              <SelectTrigger id="meeting-app" className="w-full">
                {/* Explicit label mapping — the raw id is the Select's `value`, so
                    without this the trigger falls back to rendering that id (a
                    UUID) instead of the app's name. */}
                <SelectValue>
                  {(value: string) => apps.find((app) => app.id === value)?.name ?? 'No app'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_APP}>No app</SelectItem>
                {apps.map((app) => (
                  <SelectItem key={app.id} value={app.id}>
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Input
              id="meeting-link"
              type="url"
              inputMode="url"
              value={form.meetingUrl}
              onChange={(e) => setForm((f) => ({ ...f, meetingUrl: e.target.value }))}
              placeholder="https://meet.google.com/…"
              autoComplete="off"
              className="hover:border-ring/40"
              aria-invalid={linkInvalid || undefined}
              aria-describedby={linkInvalid ? 'meeting-link-error' : 'meeting-link-hint'}
            />
            {linkInvalid ? (
              <p id="meeting-link-error" role="alert" className="text-xs text-destructive">
                {MEETING_URL_ERROR}
              </p>
            ) : (
              <p id="meeting-link-hint" className="text-xs text-muted-foreground">
                Meet, Zoom or Teams link — attendees get a one-click join
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
              {pendingTeamAppId !== null && pendingTeamAppId === form.appId ? (
                <p className="text-xs text-muted-foreground">Adding this app’s team…</p>
              ) : form.prefilledIds.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Suggested from the app’s team — remove anyone not needed.
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
              {!form.appId && availableUsers.length > 0 ? (
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
  )
}
