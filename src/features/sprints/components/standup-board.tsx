'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertTriangle, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { hasStandupContent, isRealBlocker, isStandupDayAllowed } from '@/features/sprints/scrum'
import { deleteStandup, saveStandup } from '@/features/sprints/scrum-actions'
import { sprintDays } from '@/features/sprints/sprint-metrics'
import type { SprintBlocker, StandupEntry } from '@/features/sprints/scrum-queries'

/**
 * The daily standup for one sprint day: the viewer's own three answers, the
 * team's answers as cards, and everything blocking the sprint in one box.
 *
 * Saving relies on the action's revalidatePath to bring back the team list,
 * so there is no optimistic copy to keep in step. The form is keyed by day
 * and by the saved row's updatedAt in the parent, so switching day (or a
 * save landing) resets the fields to what is stored rather than keeping a
 * previous day's draft.
 */

export type StandupSprint = { id: string; status: 'planned' | 'active' | 'done'; startDate: string; endDate: string }

const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

export function formatDay(day: string): string {
  return dayFormat.format(new Date(`${day}T00:00:00Z`))
}

export function StandupBoard({
  slug,
  sprint,
  day,
  today,
  days,
  entries,
  blockers,
  currentUserId,
}: {
  slug: string
  sprint: StandupSprint
  day: string
  today: string
  days: string[]
  entries: StandupEntry[]
  blockers: SprintBlocker[]
  currentUserId: string
}) {
  // Every lived day of the sprint, newest first — not only days that already
  // have entries, or a sprint whose standups were missed shows one button and
  // its earlier days cannot be reached at all. Future days are left out:
  // nothing can be written for them yet.
  const lastLived = today < sprint.endDate ? today : sprint.endDate
  const lived = lastLived >= sprint.startDate ? sprintDays(sprint.startDate, lastLived) : []
  const pickable = [...new Set([...lived, day, ...days])].sort().reverse()
  const editable = sprint.status !== 'done' && isStandupDayAllowed(day, sprint, today)
  const mine = entries.find((e) => e.userId === currentUserId) ?? null
  const shown = entries.filter(hasStandupContent)
  const standupBlockers = entries.filter((e) => isRealBlocker(e.blockers))

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Choose a day" className="flex flex-wrap gap-1.5">
        {pickable.map((d) => (
          <Link
            key={d}
            href={`/apps/${slug}?tab=scrum&view=standup&sprint=${sprint.id}&day=${d}`}
            aria-current={d === day ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
              d === day ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {d === today ? 'Today' : formatDay(d)}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex flex-col gap-4">
          {editable ? (
            <StandupForm
              key={`${day}:${mine?.updatedAt ? new Date(mine.updatedAt).getTime() : 'new'}`}
              sprintId={sprint.id}
              day={day}
              isToday={day === today}
              entry={mine}
            />
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              {sprint.status === 'done'
                ? 'This sprint is finished, so its standups are read-only.'
                : day > today
                  ? 'You can fill in a standup on the day itself.'
                  : 'This day is outside the sprint, so there is nothing to fill in.'}
            </p>
          )}
          {/* Read-only day, but your own entry can still be removed. */}
          {!editable && mine ? (
            <div className="flex justify-end">
              <DeleteStandupButton sprintId={sprint.id} day={day} />
            </div>
          ) : null}

          <section aria-labelledby="standup-team" className="flex flex-col gap-3">
            <h3 id="standup-team" className="font-heading text-sm font-semibold">
              Team updates for {day === today ? 'today' : formatDay(day)}
            </h3>
            {shown.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Nobody has posted an update for this day yet.
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {shown.map((e) => (
                  <StandupCard key={e.id} entry={e} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <BlockersBox blockers={blockers} standupBlockers={standupBlockers} />
      </div>
    </div>
  )
}

/**
 * Removes the viewer's own entry for the day. Asks first — there is no undo —
 * and needs no refresh: deleteStandup revalidates the page, and the form's
 * key (built from the entry) remounts it empty.
 */
function DeleteStandupButton({ sprintId, day }: { sprintId: string; day: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    )
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Delete your standup for this day?</span>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await deleteStandup({ sprintId, day })
              if (result.ok) toast.success('Standup deleted')
              else toast.error(result.error)
            } catch {
              toast.error('Could not reach the server, try again.')
            }
            setConfirming(false)
          })
        }
      >
        {pending ? 'Deleting…' : 'Yes, delete'}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  )
}

function StandupForm({
  sprintId,
  day,
  isToday,
  entry,
}: {
  sprintId: string
  day: string
  isToday: boolean
  entry: StandupEntry | null
}) {
  const [yesterday, setYesterday] = useState(entry?.yesterday ?? '')
  const [today, setToday] = useState(entry?.today ?? '')
  const [blockers, setBlockers] = useState(entry?.blockers ?? '')
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        const result = await saveStandup({ sprintId, day, yesterday, today, blockers })
        if (result.ok) toast.success('Standup saved')
        else toast.error(result.error)
      } catch {
        toast.error('Could not reach the server. Your answers are still here, try again.')
      }
    })
  }

  const fields = [
    { id: 'yesterday', label: 'Yesterday', hint: 'What did you finish?', value: yesterday, set: setYesterday },
    { id: 'today', label: 'Today', hint: 'What will you work on?', value: today, set: setToday },
    { id: 'blockers', label: 'Blockers', hint: 'Anything stopping you? Leave empty if not.', value: blockers, set: setBlockers },
  ]

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <h3 className="font-heading text-sm font-semibold">
        {isToday ? 'Your standup for today' : `Your standup for ${formatDay(day)}`}
      </h3>
      <div className="grid gap-3 md:grid-cols-3">
        {fields.map((f) => (
          <div key={f.id} className="flex flex-col gap-1.5">
            <Label htmlFor={`standup-${f.id}`}>{f.label}</Label>
            <Textarea
              id={`standup-${f.id}`}
              value={f.value}
              onChange={(event) => f.set(event.target.value)}
              placeholder={f.hint}
              maxLength={2000}
              rows={3}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {entry ? <DeleteStandupButton sprintId={sprintId} day={day} /> : null}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : entry ? 'Update standup' : 'Save standup'}
        </Button>
      </div>
    </form>
  )
}

function StandupCard({ entry }: { entry: StandupEntry }) {
  const blocked = isRealBlocker(entry.blockers)
  const rows: [string, string | null][] = [
    ['Yesterday', entry.yesterday],
    ['Today', entry.today],
  ]
  return (
    <li className={cn('flex flex-col gap-2 rounded-xl border bg-card p-4', blocked && 'border-destructive/50')}>
      <div className="flex items-center gap-2">
        <Avatar size="sm">
          {entry.avatarUrl ? <AvatarImage src={entry.avatarUrl} alt="" /> : null}
          <AvatarFallback>{entry.userName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{entry.userName}</span>
        {blocked ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-2xs font-medium text-destructive">
            <AlertTriangle className="size-3" aria-hidden />
            Blocked
          </span>
        ) : null}
      </div>
      <dl className="flex flex-col gap-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-2xs text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-wrap">{value?.trim() || <span className="text-muted-foreground">Nothing written</span>}</dd>
          </div>
        ))}
        {blocked ? (
          <div>
            <dt className="text-2xs text-muted-foreground">Blockers</dt>
            <dd className="whitespace-pre-wrap text-destructive">{entry.blockers}</dd>
          </div>
        ) : null}
      </dl>
    </li>
  )
}

function BlockersBox({ blockers, standupBlockers }: { blockers: SprintBlocker[]; standupBlockers: StandupEntry[] }) {
  const empty = blockers.length === 0 && standupBlockers.length === 0
  return (
    <section aria-labelledby="standup-blockers" className="flex h-fit flex-col gap-3 rounded-xl border bg-card p-4">
      <h3 id="standup-blockers" className="flex items-center gap-1.5 font-heading text-sm font-semibold">
        <Ban className="size-4 text-destructive" aria-hidden />
        Blockers
      </h3>
      {empty ? (
        <p className="text-sm text-muted-foreground">Nothing is blocked right now.</p>
      ) : (
        <>
          {blockers.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <h4 className="text-2xs text-muted-foreground">Work items marked Blocked</h4>
              <ul className="flex flex-col gap-1.5 text-sm">
                {blockers.map((b) => (
                  <li key={b.id} className="flex flex-col">
                    <span>
                      {b.taskKey ? <span className="mr-1.5 font-mono text-2xs text-muted-foreground">{b.taskKey}</span> : null}
                      {b.title}
                    </span>
                    <span className="text-2xs text-muted-foreground">{b.assigneeName ?? 'Nobody assigned'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {standupBlockers.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <h4 className="text-2xs text-muted-foreground">Raised in standup</h4>
              <ul className="flex flex-col gap-1.5 text-sm">
                {standupBlockers.map((e) => (
                  <li key={e.id}>
                    <span className="font-medium">{e.userName}:</span>{' '}
                    <span className="whitespace-pre-wrap">{e.blockers}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
