'use client'

import * as React from 'react'
import { Check, Loader2Icon, Plus, SparklesIcon, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import {
  ENTRY_CATEGORIES,
  ENTRY_MINUTES_MAX,
  formatHours,
  totalMinutes,
  type EntryCategory,
} from '@/features/worklog/entries'
import { createWorklogEntry, deleteWorklogEntry } from '@/features/worklog/entry-actions'
import { draftWorklogEntries, type DraftedEntry } from '@/features/worklog/entry-ai-actions'
import type { WorklogEntryRow } from '@/features/worklog/entry-queries'

/**
 * Where the day's hours are recorded — one row per piece of work.
 *
 * THESE ARE MEASURED, NOT DERIVED, which is the whole reason this can sit
 * beside the percent slider. The page's "days, never hours" rule is about
 * DERIVATION: multiplying a self-scored percent-of-plan into a duration would
 * invent a timesheet nobody filled in. Minutes somebody typed against a piece
 * of work are the opposite — a first-hand record, and the only honest source
 * of an hours figure in this product.
 *
 * The two never mix. `daily_worklogs.percent` stays a JUDGEMENT ("of what I
 * planned, how much did I get through"); these stay a MEASUREMENT ("where the
 * time went"). Nothing here is computed from that, and nothing there from
 * these.
 */

const CATEGORY_LABEL: Record<EntryCategory, string> = {
  task: 'Task',
  meeting: 'Meeting',
  review: 'Review',
  support: 'Support',
  admin: 'Admin',
  learning: 'Learning',
  other: 'Other',
}

const NO_APP = '__none__'

/**
 * "1.5", "90m", "1h30", "2h" all mean the same thing to somebody logging a
 * day, and refusing three of them because the fourth was expected is the kind
 * of small rudeness that stops a habit forming. Returns whole minutes, or null
 * when there is genuinely no number in there.
 */
export function parseDuration(raw: string): number | null {
  const text = raw.trim().toLowerCase()
  if (!text) return null

  const hm = text.match(/^(\d+)\s*h\s*(\d+)\s*m?$/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])

  const hours = text.match(/^(\d+(?:[.,]\d+)?)\s*h(?:rs?|ours?)?$/)
  if (hours) return Math.round(Number(hours[1].replace(',', '.')) * 60)

  const mins = text.match(/^(\d+)\s*m(?:ins?|inutes?)?$/)
  if (mins) return Number(mins[1])

  // A bare number is HOURS, because that is what somebody typing "1.5" into a
  // box labelled Hours means. Minutes have to say so.
  const bare = text.match(/^(\d+(?:[.,]\d+)?)$/)
  if (bare) return Math.round(Number(bare[1].replace(',', '.')) * 60)

  return null
}

export function DayHoursCard({
  day,
  entries,
  scheduledMinutes,
  apps,
  canEdit,
  aiDraftEnabled = false,
  suggestions = null,
  evidence = 0,
}: {
  day: string
  entries: WorklogEntryRow[]
  /** Minutes this person was scheduled to work, or null when unknown. */
  scheduledMinutes: number | null
  apps: { id: string; name: string }[]
  /** False for a future day, which cannot be logged against. */
  canEdit: boolean
  /** Whether the per-entry AI draft is switched on for this person. */
  aiDraftEnabled?: boolean
  /**
   * Suggestions produced by an OUTER control — the day panel's single "Fill my
   * day", which drafts the note and the hours in one pass. When this is
   * supplied the card shows no button of its own: two AI triggers on one
   * screen doing overlapping work is how somebody spends their quota twice
   * and wonders which one they were meant to press.
   */
  suggestions?: DraftedEntry[] | null
  evidence?: number
}) {
  const [pending, startTransition] = React.useTransition()
  const [duration, setDuration] = React.useState('')
  const [category, setCategory] = React.useState<EntryCategory>('task')
  const [appId, setAppId] = React.useState<string>(NO_APP)
  const [note, setNote] = React.useState('')
  const [busyId, setBusyId] = React.useState<string | null>(null)
  // Proposals live HERE, not in the entries list, and are never written until
  // somebody accepts one. A draft that saved itself would be the model filing
  // a timesheet in a person's name — and hours, unlike a note, are the thing
  // an invoice is built from.
  const [ownDrafted, setOwnDrafted] = React.useState<DraftedEntry[] | null>(null)
  const [ownEvidence, setOwnEvidence] = React.useState(0)
  // Dismissed suggestions are tracked by index against whichever list is
  // showing, so a person can clear rows the outer panel handed down without
  // that panel having to own the dismissal.
  const [dismissed, setDismissed] = React.useState<Set<number>>(new Set())
  const externallyDriven = suggestions !== null
  // ONE source list, and dismissal is tracked by INDEX INTO IT rather than by
  // rebuilding the array. The panel owns its array and this card cannot
  // rewrite it, so a filtered copy would make every index mean something
  // different from what the dismiss handler was given — rows would vanish in
  // the wrong order as soon as two were cleared.
  const sourceDrafts = externallyDriven ? suggestions : ownDrafted
  const evidenceCount = externallyDriven ? evidence : ownEvidence
  const visibleCount = sourceDrafts
    ? sourceDrafts.filter((_, i) => !dismissed.has(i)).length
    : 0

  // A fresh batch clears the previous batch's dismissals, or new rows inherit
  // the old list's holes. Adjusted DURING RENDER rather than in an effect —
  // React's own guidance for "reset state when a prop changes", and the
  // effect version trips the cascading-render rule because it sets state on
  // the commit after the one that already had the new list.
  const [seenSuggestions, setSeenSuggestions] = React.useState(suggestions)
  if (suggestions !== seenSuggestions) {
    setSeenSuggestions(suggestions)
    setDismissed(new Set())
  }

  const dismissAt = React.useCallback((index: number) => {
    setDismissed((prev) => new Set(prev).add(index))
  }, [])

  const dismissAll = React.useCallback(() => {
    setDismissed(new Set(sourceDrafts?.map((_, i) => i) ?? []))
  }, [sourceDrafts])
  const [drafting, setDrafting] = React.useState(false)

  async function handleDraft() {
    setDrafting(true)
    try {
      const res = await draftWorklogEntries(day)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setOwnDrafted(res.data.entries)
      setOwnEvidence(res.data.evidenceCount)
      if (res.data.entries.length === 0) {
        // An empty day is a quiet day, not a failure. Saying so beats an
        // empty list somebody reads as the feature being broken.
        toast.info(
          res.data.evidenceCount === 0
            ? 'LogPup recorded nothing for that day — nothing to suggest.'
            : 'Nothing worth suggesting on top of what you already logged.',
        )
      }
    } catch {
      toast.error('Could not draft that right now — try again')
    } finally {
      setDrafting(false)
    }
  }

  function acceptDraft(entry: DraftedEntry, index: number) {
    startTransition(async () => {
      try {
        const res = await createWorklogEntry({
          day,
          minutes: entry.minutes,
          category: entry.category,
          taskId: entry.taskId,
          note: entry.note,
          // Recorded as AI-suggested so the row remembers how it arrived, and
          // so nothing can later present it as something a person typed.
          source: 'ai_suggested',
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        dismissAt(index)
        toast.success(`Logged ${formatHours(entry.minutes)}h`)
      } catch {
        toast.error('Could not log that — try again')
      }
    })
  }

  const logged = totalMinutes(entries)
  const minutes = parseDuration(duration)
  const canSubmit = minutes !== null && minutes > 0 && minutes <= ENTRY_MINUTES_MAX && !pending

  function handleAdd() {
    if (minutes === null) {
      toast.error('Enter a time — "1.5", "90m" and "1h30" all work')
      return
    }
    startTransition(async () => {
      try {
        const res = await createWorklogEntry({
          day,
          minutes,
          category,
          // The server DERIVES a task entry's project from the task itself, so
          // this is only consulted for the categories that carry one.
          appId: appId === NO_APP ? null : appId,
          note: note.trim() || null,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setDuration('')
        setNote('')
        toast.success(`Logged ${formatHours(minutes)}h`)
      } catch {
        toast.error('Could not log that — try again')
      }
    })
  }

  function handleDelete(id: string, mins: number) {
    setBusyId(id)
    startTransition(async () => {
      try {
        const res = await deleteWorklogEntry({ id })
        if (!res.ok) toast.error(res.error)
        else toast.success(`Removed ${formatHours(mins)}h`)
      } catch {
        toast.error('Could not remove that — try again')
      } finally {
        setBusyId(null)
      }
    })
  }

  return (
    <section
      aria-label="Hours logged"
      className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold">Where the time went</h3>
        {canEdit && aiDraftEnabled && !externallyDriven ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={drafting || pending}
            onClick={handleDraft}
          >
            {drafting ? (
              <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <SparklesIcon className="text-primary" aria-hidden />
            )}
            {drafting ? 'Reading your day…' : 'Fill from my day'}
          </Button>
        ) : null}
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {/* Logged over scheduled, never a percentage: this is coverage, and a
              percent here would read as a sibling of the self-score above it,
              which measures something else entirely. */}
          {formatHours(logged)}h logged
          {scheduledMinutes ? ` of ${formatHours(scheduledMinutes)}h scheduled` : ''}
        </p>
      </header>

      {sourceDrafts && visibleCount > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-primary/30 bg-primary/5 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-2xs font-medium text-primary">
              <SparklesIcon className="size-3" aria-hidden />
              Suggested from {evidenceCount} recorded {evidenceCount === 1 ? 'thing' : 'things'}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={dismissAll}
              disabled={pending}
            >
              Dismiss all
            </Button>
          </div>
          {/* Reviewed one at a time, on purpose. An "accept all" on HOURS is a
              button that files a timesheet nobody read — and the model is
              inferring durations from meetings and activity, which is exactly
              where it is most likely to be plausibly wrong. */}
          <ul className="flex flex-col gap-1">
            {sourceDrafts.map((entry, index) =>
              dismissed.has(index) ? null : (
              <li
                key={`${entry.category}-${entry.minutes}-${index}`}
                className="flex items-start gap-2 rounded-lg bg-background/60 px-2.5 py-2"
              >
                <span className="w-14 shrink-0 font-mono text-xs font-semibold tabular-nums">
                  {formatHours(entry.minutes)}h
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-xs font-medium">
                    {CATEGORY_LABEL[entry.category]}
                  </span>
                  {entry.note ? (
                    <span className="truncate text-2xs text-muted-foreground">{entry.note}</span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Log ${formatHours(entry.minutes)} hours of ${CATEGORY_LABEL[entry.category]}`}
                  disabled={pending}
                  onClick={() => acceptDraft(entry, index)}
                >
                  <Check aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Dismiss this suggestion"
                  disabled={pending}
                  onClick={() => dismissAt(index)}
                >
                  <X aria-hidden />
                </Button>
              </li>
              ),
            )}
          </ul>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          title="No hours on this day yet"
          description="Add where the time went — a task, a meeting, review, support. Separate from the score above, which is about your plan."
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2"
            >
              <span className="w-14 shrink-0 font-mono text-xs font-semibold tabular-nums">
                {formatHours(entry.minutes)}h
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-xs font-medium">
                  {entry.taskTitle ?? CATEGORY_LABEL[entry.category]}
                </span>
                <span className="truncate text-2xs text-muted-foreground">
                  {[
                    entry.taskTitle ? CATEGORY_LABEL[entry.category] : null,
                    entry.appName,
                    entry.billable ? 'Billable' : null,
                    entry.note,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${formatHours(entry.minutes)} hours`}
                  disabled={pending}
                  onClick={() => handleDelete(entry.id, entry.minutes)}
                >
                  {busyId === entry.id ? (
                    <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <Trash2 aria-hidden />
                  )}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="entry-duration" className="text-xs">
                Hours
              </Label>
              <Input
                id="entry-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
                placeholder="1.5"
                inputMode="decimal"
                aria-describedby="entry-duration-hint"
                className="w-24"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="entry-category" className="text-xs">
                Kind
              </Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as EntryCategory)}
              >
                <SelectTrigger id="entry-category" size="sm" className="w-32">
                  {/* Function child, NOT a bare <SelectValue />. Base UI renders
                      String(value) without one, so the closed trigger showed
                      "task" rather than "Task" — and for the project select
                      below it showed the raw "__none__" sentinel. This repo
                      has now hit that default four times. */}
                  <SelectValue>
                    {(value: string) =>
                      CATEGORY_LABEL[value as EntryCategory] ?? 'Kind'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {apps.length > 0 ? (
              <div className="flex min-w-0 flex-col gap-1">
                <Label htmlFor="entry-app" className="text-xs">
                  Project
                </Label>
                <Select
                  value={appId}
                  onValueChange={(value) => setAppId(value ?? NO_APP)}
                >
                  <SelectTrigger id="entry-app" size="sm" className="w-40">
                    <SelectValue>
                      {(value: string) =>
                        value === NO_APP
                          ? 'No project'
                          : (apps.find((a) => a.id === value)?.name ?? 'No project')
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_APP}>No project</SelectItem>
                    {apps.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <Button type="button" size="sm" disabled={!canSubmit} onClick={handleAdd}>
              {pending ? (
                <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <Plus aria-hidden />
              )}
              Add
            </Button>
          </div>

          <Input
            aria-label="What was it"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was it? (optional)"
            className="text-xs"
          />

          <p id="entry-duration-hint" className="text-2xs text-muted-foreground">
            &ldquo;1.5&rdquo;, &ldquo;90m&rdquo; and &ldquo;1h30&rdquo; all mean the same thing. A
            bare number is hours.
          </p>
        </div>
      ) : null}
    </section>
  )
}
