'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CalendarCheck, CheckCircle2, Clock, Pin, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { dismissSuggestion, type LoadSuggestion } from '@/features/meetings/load-actions'
import type { ActiveUser } from '@/features/people/queries'

/**
 * The suggestion queue.
 *
 * R6 COVER-TOGETHER cards today; R1-R5 land on this same board later with no
 * new plumbing, which is the whole reason R6 ships first — it needs no
 * recording pipeline, so it can carry the route, the table and the lifecycle
 * that the other five will arrive into.
 *
 * ONE PRIMARY ACTION PER CARD, and it is not "apply". "Schedule this" opens
 * the existing meeting form with the group, the projects and an agenda already
 * filled in; a human still presses save. There is no one-click apply, and the
 * absence of one is the fix rather than an omission: nothing on this page may
 * write meeting_attendees.
 *
 * Dismissal is optimistic. The server write is a decision row guarded by a
 * unique index, so a failed dismissal is recoverable by re-rendering — and
 * leaving a card sitting there while a round trip completes is how somebody
 * presses it twice.
 */
export function LoadBoard({
  suggestions,
  apps,
  activeUsers,
  dismissedCount,
}: {
  suggestions: LoadSuggestion[]
  apps: { id: string; name: string }[]
  activeUsers: ActiveUser[]
  dismissedCount: number
}) {
  const [hidden, setHidden] = useState<string[]>([])
  const visible = suggestions.filter((s) => !hidden.includes(s.targetKey))

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 backdrop-blur-sm">
        <EmptyState
          icon={CheckCircle2}
          title="Nothing worth combining right now."
          description={
            dismissedCount > 0
              ? `Every open item either needs a different room or is already somebody's own to answer. ${dismissedCount === 1 ? 'One suggestion was' : `${dismissedCount} suggestions were`} dismissed earlier and will not come back.`
              : 'Every open item either needs a different room or is already somebody’s own to answer. This page fills up when several decisions start needing the same people.'
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {visible.map((suggestion) => (
        <SuggestionCard
          key={suggestion.targetKey}
          suggestion={suggestion}
          apps={apps}
          activeUsers={activeUsers}
          onDismissed={() => setHidden((ids) => [...ids, suggestion.targetKey])}
        />
      ))}
    </div>
  )
}

function SuggestionCard({
  suggestion,
  apps,
  activeUsers,
  onDismissed,
}: {
  suggestion: LoadSuggestion
  apps: { id: string; name: string }[]
  activeUsers: ActiveUser[]
  onDismissed: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const itemCount = suggestion.items.length

  function dismiss() {
    startTransition(async () => {
      const result = await dismissSuggestion(suggestion.targetKey, {
        askIds: suggestion.items.map((item) => item.id),
        requiredIds: suggestion.required.map((person) => person.id),
        minutes: suggestion.minutes,
        savedPersonMinutes: suggestion.savedPersonMinutes,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onDismissed()
      toast.success('Dismissed. This one will not come back.')
    })
  }

  return (
    <Card className="border-border/70 bg-card/60 shadow-xs backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-base">
          {/* A question, never a value claim. The rule cannot know whether one
              room is better than four — only that it costs less. */}
          {suggestion.required.length === 1
            ? `${suggestion.required[0].name} has ${itemCount} open items — one slot instead of ${itemCount}?`
            : `Same ${suggestion.required.length} people, ${itemCount} open items — one ${suggestion.minutes}-minute slot instead of ${itemCount}?`}
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-3.5" />
            {suggestion.minutes} minutes
          </span>
          {suggestion.savedPersonMinutes > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Users aria-hidden className="size-3.5" />
              {suggestion.savedPersonMinutes} person-minutes less than {itemCount} separate calls
            </span>
          ) : null}
          {suggestion.pinnedCount > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Pin aria-hidden className="size-3.5" />
              {suggestion.pinnedCount === 1
                ? 'One item was already pinned to a meeting'
                : `${suggestion.pinnedCount} items were already pinned to a meeting`}
            </span>
          ) : null}
          {suggestion.appName ? <Badge variant="outline">{suggestion.appName}</Badge> : null}
        </CardDescription>
        <CardAction>
          <MeetingForm
            apps={apps}
            activeUsers={activeUsers}
            prefill={{
              appIds: suggestion.appId ? [suggestion.appId] : [],
              attendeeIds: suggestion.required.map((person) => person.id),
              agenda: suggestion.agenda,
              minutes: suggestion.minutes,
              title: suggestion.appName ? `${suggestion.appName} — open items` : 'Open items',
            }}
            trigger={
              <Button size="sm" className="font-semibold shadow-sm">
                <CalendarCheck aria-hidden className="size-4" />
                Schedule this
              </Button>
            }
          />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">What it clears</p>
          <ul className="flex flex-col gap-1.5">
            {suggestion.items.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                {item.pinned ? (
                  <Pin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
                ) : (
                  <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                )}
                {/* Every line links back to the row it was derived from — a
                    claim about somebody's work you cannot click through to is
                    a claim nobody can check. */}
                <Link
                  href={item.href}
                  className="min-w-0 text-foreground underline-offset-4 hover:underline"
                >
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Who it needs</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestion.required.map((person) => (
              <Badge key={person.id} variant="secondary">{person.name}</Badge>
            ))}
            {/* Reviewers ride along on the card and are NOT prefilled into the
                form: a lead is a busy reviewer, and being named here must never
                be the thing that puts somebody in a room. */}
            {suggestion.optional.map((person) => (
              <Badge key={person.id} variant="outline" className="text-muted-foreground">
                {person.name} · optional
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          {/* A floor, not a proposal. There is no free/busy anywhere in this
              product, so the page says the earliest day the studio works and
              leaves the slot to the person picking it. */}
          <p className="text-xs text-muted-foreground">
            Earliest working day is {suggestion.notBefore}. Nothing here knows who is free —
            pick the slot on the calendar.
          </p>
          <Button variant="ghost" size="sm" onClick={dismiss} disabled={isPending}>
            {isPending ? 'Dismissing…' : 'Not worth it'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
