'use client'

import { useState, useTransition, type FormEvent, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { addHours } from 'date-fns'
import { toast } from 'sonner'
import { PlusIcon, XIcon } from 'lucide-react'
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
import type { ActiveUser } from '@/features/people/queries'

const NO_APP = '__none__'

type FormState = {
  appId: string
  title: string
  start: Date
  end: Date
  agenda: string
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
    attendeeIds: [],
  }
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

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setForm(emptyState(defaultAppId))
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New meeting</DialogTitle>
          <DialogDescription>Schedule a meeting and invite the team.</DialogDescription>
        </DialogHeader>
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
            />
            <DateTimeWheelField
              id="meeting-end"
              label="Ends"
              value={form.end}
              onChange={(end) => setForm((f) => ({ ...f, end }))}
              invalid={endBeforeStart}
              describedBy={endBeforeStart ? 'meeting-end-error' : undefined}
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
            <Label>Attendees</Label>
            {selectedAttendees.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedAttendees.map((u) => (
                  <Badge key={u.id} variant="secondary" className="gap-1">
                    {u.name}
                    <button
                      type="button"
                      onClick={() => toggleAttendee(u.id)}
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
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
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create meeting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
