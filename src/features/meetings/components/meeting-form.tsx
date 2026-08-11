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
import { useRouter } from 'next/navigation'
import { addHours, format } from 'date-fns'
import { toast } from 'sonner'
import { Loader2, PlusIcon, XIcon } from 'lucide-react'
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
import { createMeeting, teamForApp } from '@/features/meetings/actions'
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
}

function emptyState(defaultAppId?: string): FormState {
  const start = roundUpToStep(new Date())
  return {
    appId: defaultAppId ?? '',
    title: '',
    start,
    end: addHours(start, 1),
    agenda: '',
    meetingUrl: '',
    attendeeIds: [],
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

export function MeetingForm({
  apps,
  activeUsers,
  defaultAppId,
  trigger,
  defaultOpen,
}: {
  apps: { id: string; name: string }[]
  activeUsers: ActiveUser[]
  defaultAppId?: string
  trigger: ReactElement
  defaultOpen?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [isPending, startTransition] = useTransition()
  const [attendeePickerOpen, setAttendeePickerOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() => emptyState(defaultAppId))
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
      attendeeIds:
        preview.attendees.length > 0
          ? Array.from(new Set([...f.attendeeIds, ...preview.attendees.map((a) => a.id)]))
          : f.attendeeIds,
    }))
  }, [preview])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setForm(emptyState(defaultAppId))
      setQuickAdd('')
      setSettled('')
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
      // Set directly instead of going through handleAppChange: that fetches the
      // app's team and replaces the attendee list, which would race with (and
      // overwrite) the people just named in the phrase.
      appId: intent.appId ?? f.appId,
      start: intent.startsAt ?? f.start,
      end: intent.endsAt ?? f.end,
      meetingUrl: intent.meetingUrl ?? f.meetingUrl,
      attendeeIds:
        intent.attendees.length > 0
          ? Array.from(new Set([...f.attendeeIds, ...intent.attendees.map((a) => a.id)]))
          : f.attendeeIds,
    }))
  }

  function handleQuickAddKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    // The field sits outside <form>, but stop the keypress anyway so no future
    // move of this block can turn Enter into a submit.
    event.preventDefault()
    applyQuickAdd()
  }

  async function handleAppChange(appId: string) {
    setForm((f) => ({ ...f, appId }))
    if (!appId) return
    try {
      const team = await teamForApp(appId)
      setForm((f) => ({ ...f, attendeeIds: team.map((member) => member.id) }))
    } catch {
      toast.error('Could not load the team for that app')
    }
  }

  function toggleAttendee(id: string) {
    setForm((f) => ({
      ...f,
      attendeeIds: f.attendeeIds.includes(id)
        ? f.attendeeIds.filter((a) => a !== id)
        : [...f.attendeeIds, id],
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
        const res = await createMeeting({
          appId: form.appId || null,
          title: form.title,
          startsAt: form.start.toISOString(),
          endsAt: form.end.toISOString(),
          agenda: form.agenda || undefined,
          meetingUrl: form.meetingUrl,
          attendeeIds: form.attendeeIds,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        if (res.data.calendarWarning) toast.warning(res.data.calendarWarning)
        else toast.success('Meeting created')
        handleOpenChange(false)
        router.refresh()
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
          <DialogTitle>New meeting</DialogTitle>
          <DialogDescription>Schedule a meeting and invite the team.</DialogDescription>
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
              {isPending ? 'Creating…' : 'Create meeting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
