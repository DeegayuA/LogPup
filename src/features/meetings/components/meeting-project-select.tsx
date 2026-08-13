'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2Icon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setMeetingApp } from '@/features/meetings/actions'
import { cn } from '@/lib/utils'

// Base UI's Select has no reserved "empty" value, and `null` as an item value
// is indistinguishable from "nothing chosen yet" — so unfiled gets a sentinel,
// exactly as the create/edit form does.
const NO_APP = '__none__'

export type MeetingAppOption = { id: string; name: string }

/**
 * Files an already-created meeting under an app — or takes it back off one.
 *
 * The point is that a quick meeting can be booked before anyone knows which
 * product it belongs to. Until now the only way to decide later was the full
 * edit form, which re-submits the title, both times and the whole attendee
 * list to change one field. This is that one field.
 *
 * The product calls these "apps" everywhere a person can read (the form label,
 * the detail badge, /apps), so this control says App too — the module is named
 * for the concept, not for the word on screen.
 *
 * Render it only for someone who passes `canManageMeeting`; `setMeetingApp`
 * enforces the same rule server-side regardless.
 */
export function MeetingProjectSelect({
  meetingId,
  appId,
  apps,
  className,
}: {
  meetingId: string
  appId: string | null
  apps: MeetingAppOption[]
  className?: string
}) {
  const router = useRouter()
  const fieldId = useId()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(appId)

  // Re-seed from the server whenever the panel is pointed at a different
  // meeting, or this one is refiled elsewhere — adjusting state during render
  // rather than in an effect, per React's own guidance for resetting state
  // from a prop:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const syncKey = `${meetingId}:${appId ?? ''}`
  const [syncedKey, setSyncedKey] = useState(syncKey)
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey)
    setValue(appId)
  }

  const nameFor = (id: string | null) =>
    id ? (apps.find((app) => app.id === id)?.name ?? null) : null

  function handleChange(next: string | null) {
    const nextAppId = next === NO_APP || !next ? null : next
    if (nextAppId === value) return

    // Shown immediately, restored on failure: the trigger is the only feedback
    // this control has, and leaving it on the old app until the round trip
    // lands reads as a click that did nothing.
    const previous = value
    setValue(nextAppId)

    startTransition(async () => {
      try {
        const res = await setMeetingApp(meetingId, nextAppId)
        if (!res.ok) {
          setValue(previous)
          toast.error(res.error)
          return
        }
        const name = nameFor(nextAppId)
        toast.success(name ? `Filed under ${name}` : 'Meeting is no longer filed under an app')
        router.refresh()
      } catch {
        setValue(previous)
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={fieldId}>App</Label>
      <div className="flex items-center gap-2">
        <Select value={value ?? NO_APP} onValueChange={handleChange} disabled={pending}>
          <SelectTrigger id={fieldId} className="w-full min-w-0">
            {/* The Select's value is the raw id, so without an explicit label
                mapping the trigger renders a UUID instead of the app's name. */}
            <SelectValue>
              {(current: string) => nameFor(current) ?? 'No app'}
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
