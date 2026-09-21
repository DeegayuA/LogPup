'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Pin,
  Sparkles,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { MeetingForm } from '@/features/meetings/components/meeting-form'
import { dismissSuggestion, type LoadSuggestion } from '@/features/meetings/load-actions'
import type { ActiveUser } from '@/features/people/queries'

/**
 * The suggestion queue.
 *
 * R6 COVER-TOGETHER cards today; R1-R5 land on this same board later with no
 * new plumbing.
 *
 * ONE PRIMARY ACTION PER CARD: "Schedule this" opens the existing meeting form
 * with the group, the projects and an agenda already filled in.
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
      <SpotlightCard className="relative overflow-hidden rounded-2xl border border-dashed border-border/80 bg-card/40 p-8 backdrop-blur-md">
        <div
          className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-primary/10 blur-2xl"
          aria-hidden
        />
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
            <CheckCircle2 className="size-6" aria-hidden />
          </div>
          <h3 className="mt-4 font-heading text-lg font-bold tracking-tight text-foreground">
            Schedule is clean &amp; balanced
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {dismissedCount > 0
              ? `Every open item either needs a dedicated room or is already owned by an individual. ${
                  dismissedCount === 1 ? '1 suggestion was' : `${dismissedCount} suggestions were`
                } dismissed earlier.`
              : 'Every open item either needs a dedicated room or is already owned by an individual. Suggestions will appear here when multiple decisions require the same team members.'}
          </p>
        </div>
      </SpotlightCard>
    )
  }

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-2 rounded-full bg-primary animate-pulse" aria-hidden />
          <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
            Actionable Consolidations ({visible.length})
          </h2>
        </div>
        <span className="text-2xs font-medium text-muted-foreground">
          Combine fragmented topics into single high-impact sessions
        </span>
      </div>

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
      toast.success('Dismissed. This suggestion will not appear again.')
    })
  }

  return (
    <SpotlightCard className="group relative flex flex-col gap-5 rounded-2xl border border-border/80 bg-card/75 p-5 shadow-xs backdrop-blur-md transition-all duration-200 hover:border-primary/40 hover:shadow-md md:p-6">
      {/* Card Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-mono text-2xs font-semibold text-primary">
              <Sparkles className="size-3" aria-hidden />
              Cover Together · R6
            </span>

            {suggestion.appName ? (
              <Badge variant="outline" className="border-border/80 bg-background/50 font-medium">
                {suggestion.appName}
              </Badge>
            ) : null}

            {suggestion.pinnedCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-chart-1/25 bg-chart-1/10 px-2 py-0.5 text-2xs font-medium text-chart-1">
                <Pin className="size-3" aria-hidden />
                {suggestion.pinnedCount === 1 ? '1 item pinned' : `${suggestion.pinnedCount} items pinned`}
              </span>
            ) : null}
          </div>

          {suggestion.savedPersonMinutes > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 font-mono text-2xs font-bold text-emerald-600 dark:text-emerald-400">
              <Users className="size-3.5" aria-hidden />
              +{suggestion.savedPersonMinutes} person-mins saved
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="font-heading text-base font-bold tracking-tight text-foreground sm:text-lg">
            {suggestion.required.length === 1
              ? `${suggestion.required[0].name} has ${itemCount} open items — one slot instead of ${itemCount}?`
              : `Same ${suggestion.required.length} people, ${itemCount} open items — one ${suggestion.minutes}-minute slot instead of ${itemCount}?`}
          </h3>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" aria-hidden />
              {suggestion.minutes} minutes slot
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 text-muted-foreground" aria-hidden />
              Earliest slot: <span className="font-medium text-foreground">{suggestion.notBefore}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Card Content Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Open items to clear */}
        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3.5 lg:col-span-7">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
            What it clears ({suggestion.items.length})
          </span>
          <ul className="flex flex-col gap-2">
            {suggestion.items.map((item) => (
              <li key={item.id} className="group/item flex items-start gap-2.5 text-xs">
                {item.pinned ? (
                  <Pin className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60"
                  />
                )}
                <Link
                  href={item.href}
                  className="flex min-w-0 flex-1 items-center gap-1 text-foreground/90 transition-colors hover:text-primary hover:underline underline-offset-4"
                >
                  <span className="truncate">{item.text}</span>
                  <ExternalLink className="size-2.5 shrink-0 opacity-0 transition-opacity group-hover/item:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: Who it needs */}
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 lg:col-span-5">
          <div className="flex flex-col gap-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
              Who it needs ({suggestion.required.length + suggestion.optional.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {suggestion.required.map((person) => (
                <span
                  key={person.id}
                  className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-0.5 text-xs font-medium text-foreground shadow-2xs"
                >
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                  {person.name}
                </span>
              ))}
              {suggestion.optional.map((person) => (
                <Badge
                  key={person.id}
                  variant="outline"
                  className="border-dashed border-border/70 text-2xs text-muted-foreground"
                >
                  {person.name} · optional
                </Badge>
              ))}
            </div>
          </div>

          <p className="text-2xs leading-relaxed text-muted-foreground/80">
            Reviewers ride along on the card without being prefilled, keeping calendars protected.
          </p>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3.5">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 text-muted-foreground/70 shrink-0" aria-hidden />
          <span>Nothing here knows who is free — pick the best slot on the calendar.</span>
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            {isPending ? 'Dismissing…' : 'Not worth it'}
          </Button>

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
              <Button size="sm" className="gap-1.5 font-semibold shadow-sm cursor-pointer">
                <CalendarCheck className="size-4" aria-hidden />
                Schedule this
              </Button>
            }
          />
        </div>
      </div>
    </SpotlightCard>
  )
}
