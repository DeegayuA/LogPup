'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, NotebookPen, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { createMeeting } from '@/features/meetings/actions'
import {
  formatBusinessTime,
  formatBusinessWeekdayDayMonth,
} from '@/features/people/format-instant'
import type { MentionUser } from '@/components/mention-textarea'
import { cn } from '@/lib/utils'

/**
 * The header's one creation control: a split button, half "Quick note", half
 * "New meeting". They were two buttons on two different rows — the notebook
 * gesture lived down in the list toolbar while scheduling lived up here, and
 * both answer the same intent ("capture something") at two levels of
 * ceremony, so they share one pill.
 *
 * At rest each half is its icon; hovering (or keyboard-focusing) a half
 * unfolds its label beside the icon. The unfold is a grid-column trick —
 * 0fr → 1fr — so the text never reflows mid-fade and nothing animates but
 * the one column. Pointers that cannot hover (touch) get both labels
 * permanently: an affordance that only exists on hover does not exist on a
 * phone. Reduced motion keeps the unfold but snaps it.
 *
 * Quick note is the notebook-first path: one click creates a real meeting row
 * (no project, sole attendee: you, starting now) and lands on it with the
 * write-up open — see the long rationale in meetings-views.tsx, where this
 * behaviour previously lived. Navigation happens by URL (?view=list&open=id),
 * which the mounted views now react to, so this control works from the header
 * without reaching into the list's state.
 */
export function MeetingHeaderActions({
  apps,
  activeUsers,
  currentUserId,
  defaultOpenNewMeeting = false,
}: {
  apps: { id: string; name: string }[]
  activeUsers: MentionUser[]
  currentUserId: string
  defaultOpenNewMeeting?: boolean
}) {
  const router = useRouter()
  const [creating, startCreating] = React.useTransition()

  function handleQuickNote() {
    startCreating(async () => {
      try {
        const start = new Date()
        const end = new Date(start.getTime() + 60 * 60 * 1000)
        const res = await createMeeting({
          // No project — an empty SET, which is what "no app" is. The
          // Google-invite warning is deliberately swallowed: it means
          // "attendees were not emailed", and the only attendee is you.
          appIds: [],
          title: `Quick notes — ${formatBusinessWeekdayDayMonth(start)} · ${formatBusinessTime(start)}`,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          attendeeIds: [currentUserId],
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        router.push(`/meetings?view=list&open=${res.data.meetingId}`)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  return (
    <div className="flex items-stretch overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm">
      <SplitHalf
        onClick={handleQuickNote}
        disabled={creating}
        label={creating ? 'Opening…' : 'Quick note'}
        icon={
          creating ? (
            <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <NotebookPen className="size-4 shrink-0" aria-hidden />
          )
        }
      />
      <span aria-hidden className="my-1.5 w-px bg-primary-foreground/25" />
      <MeetingForm
        apps={apps}
        activeUsers={activeUsers}
        defaultOpen={defaultOpenNewMeeting}
        trigger={
          <SplitHalf label="New meeting" icon={<Plus className="size-4 shrink-0" aria-hidden />} />
        }
      />
    </div>
  )
}

/**
 * One half of the pill. A plain button (not the kit's Button) because the
 * pill owns the chrome — radius, shadow, background — and a nested rounded
 * button inside an overflow-hidden pill fights its own corners.
 */
function SplitHalf({
  icon,
  label,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'button'> & {
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      {...props}
      aria-label={label}
      className={cn(
        'group/half flex items-center px-3 py-2 text-sm font-semibold transition-colors duration-(--dur-quick) hover:bg-primary-foreground/10 focus-visible:bg-primary-foreground/10 focus-visible:outline-none disabled:opacity-60',
        className,
      )}
    >
      {icon}
      <span
        className={cn(
          'grid grid-cols-[0fr] overflow-hidden transition-[grid-template-columns] duration-(--dur-base) ease-(--ease-enter)',
          'group-hover/half:grid-cols-[1fr] group-focus-visible/half:grid-cols-[1fr]',
          // No hover, no unfold — so on touch the labels are simply there.
          '[@media(hover:none)]:grid-cols-[1fr]',
          'motion-reduce:transition-none',
        )}
      >
        <span className="min-w-0 overflow-hidden pl-1.5 whitespace-nowrap">{label}</span>
      </span>
    </button>
  )
}
