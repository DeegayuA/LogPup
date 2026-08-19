'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2Icon, PlusIcon, XIcon } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { setMeetingApps } from '@/features/meetings/actions'
import { formatAppNames } from '@/features/meetings/app-labels'
import { cn } from '@/lib/utils'

export type MeetingAppOption = { id: string; name: string }

/**
 * Files an already-created meeting under one or more apps — or takes it back
 * off all of them.
 *
 * The point is that a quick meeting can be booked before anyone knows which
 * product it belongs to. Until now the only way to decide later was the full
 * edit form, which re-submits the title, both times and the whole attendee
 * list to change one field. This is that one field.
 *
 * Every app is equal and there is no primary one, so this is a toggle list
 * rather than a Select, and "no app" is an empty selection with a line saying
 * so — not a sentinel row that has to be chosen.
 *
 * The product calls these "apps" everywhere a person can read (the form label,
 * the detail badge, /apps), so this control says App too — the module is named
 * for the concept, not for the word on screen.
 *
 * Render it only for someone who passes `canManageMeeting`; `setMeetingApps`
 * enforces the same rule server-side regardless.
 */
export function MeetingProjectSelect({
  meetingId,
  appIds,
  apps,
  className,
}: {
  meetingId: string
  appIds: string[]
  apps: MeetingAppOption[]
  className?: string
}) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState<string[]>(appIds)

  // Re-seed from the server whenever the panel is pointed at a different
  // meeting, or this one is refiled elsewhere — adjusting state during render
  // rather than in an effect, per React's own guidance for resetting state
  // from a prop:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const syncKey = `${meetingId}:${[...appIds].sort().join(',')}`
  const [syncedKey, setSyncedKey] = useState(syncKey)
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey)
    setValue(appIds)
  }

  const namesFor = (ids: string[]) =>
    apps.filter((app) => ids.includes(app.id)).map((app) => app.name)

  function commit(next: string[]) {
    // Shown immediately, restored on failure: these chips are the only feedback
    // this control has, and leaving them on the old set until the round trip
    // lands reads as a click that did nothing.
    const previous = value
    setValue(next)

    startTransition(async () => {
      try {
        const res = await setMeetingApps(meetingId, next)
        if (!res.ok) {
          setValue(previous)
          toast.error(res.error)
          return
        }
        const names = namesFor(next)
        toast.success(
          names.length > 0
            ? `Filed under ${formatAppNames(names)}`
            : 'Meeting is no longer filed under an app',
        )
        router.refresh()
      } catch {
        setValue(previous)
        toast.error('Something went wrong — try again')
      }
    })
  }

  // `apps` arrives ordered by name from the server, so both lists read the
  // same way the badges elsewhere do.
  const selected = apps.filter((app) => value.includes(app.id))
  const available = apps.filter((app) => !value.includes(app.id))

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label>Apps</Label>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((app) => (
            <Badge key={app.id} variant="secondary" className="gap-1">
              {app.name}
              <button
                type="button"
                disabled={pending}
                onClick={() => commit(value.filter((id) => id !== app.id))}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground outline-none transition-colors duration-150 hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
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
      <div className="flex items-center gap-2">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" type="button" disabled={pending} className="w-fit" />
            }
          >
            <PlusIcon /> Add app
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0">
            <Command>
              <CommandInput placeholder="Search apps…" />
              <CommandList>
                <CommandEmpty>{apps.length === 0 ? 'No apps yet.' : 'No apps found.'}</CommandEmpty>
                <CommandGroup>
                  {available.map((app) => (
                    <CommandItem
                      key={app.id}
                      onSelect={() => {
                        commit([...value, app.id])
                        setPickerOpen(false)
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
        {/* The word carries the state, not just the spinner — and the live
            region announces it to anyone who cannot see either. */}
        <span
          aria-live="polite"
          className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
        >
          {pending ? (
            <>
              <Loader2Icon
                className="size-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
              Saving…
            </>
          ) : null}
        </span>
      </div>
    </div>
  )
}
