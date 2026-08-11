'use client'

import { useState, useTransition, type FormEvent, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { CalendarIcon, PlusIcon, XIcon } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
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
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  agenda: string
  attendeeIds: string[]
}

function emptyState(defaultAppId?: string): FormState {
  return {
    appId: defaultAppId ?? '',
    title: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    agenda: '',
    attendeeIds: [],
  }
}

function DateTimeField({
  label,
  idPrefix,
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  label: string
  idPrefix: string
  date: string
  time: string
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
}) {
  const selected = date ? new Date(`${date}T12:00:00`) : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}-time`}>{label}</Label>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger
            render={<Button variant="outline" type="button" className="flex-1 justify-start font-normal" />}
          >
            <CalendarIcon className="opacity-60" />
            {selected ? format(selected, 'MMM d, yyyy') : 'Pick a date'}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(day) => day && onDateChange(format(day, 'yyyy-MM-dd'))}
            />
          </PopoverContent>
        </Popover>
        <Input
          id={`${idPrefix}-time`}
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className="w-28"
          required
        />
      </div>
    </div>
  )
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      try {
        const startsAt = new Date(`${form.startDate}T${form.startTime}`).toISOString()
        const endsAt = new Date(`${form.endDate}T${form.endTime}`).toISOString()
        const res = await createMeeting({
          appId: form.appId || null,
          title: form.title,
          startsAt,
          endsAt,
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
  const canSubmit =
    form.title.trim().length >= 2 &&
    form.startDate &&
    form.startTime &&
    form.endDate &&
    form.endTime &&
    form.attendeeIds.length > 0

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
                <SelectValue />
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
            <DateTimeField
              label="Starts"
              idPrefix="meeting-start"
              date={form.startDate}
              time={form.startTime}
              onDateChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
              onTimeChange={(v) => setForm((f) => ({ ...f, startTime: v }))}
            />
            <DateTimeField
              label="Ends"
              idPrefix="meeting-end"
              date={form.endDate}
              time={form.endTime}
              onDateChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
              onTimeChange={(v) => setForm((f) => ({ ...f, endTime: v }))}
            />
          </div>
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
              <PopoverTrigger render={<Button variant="outline" size="sm" type="button" className="w-fit" />}>
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
            {form.attendeeIds.length === 0 ? (
              <p className="text-xs text-destructive">At least one attendee is required.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending ? 'Creating…' : 'Create meeting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
