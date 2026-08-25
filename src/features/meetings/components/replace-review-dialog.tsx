'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { CONTEXT_CHARS, groupOccurrences, type Occurrence } from '@/features/meetings/text-replace'
import {
  applyMeetingReplacements,
  type MeetingReplaceMatches,
  type MeetingReplaceResult,
} from '@/features/meetings/text-replace-actions'

/** One occurrence's identity in the tick list — offsets are unique per target. */
function keyOf(occurrence: Pick<Occurrence, 'targetId' | 'start'>): string {
  return `${occurrence.targetId}@${occurrence.start}`
}

/**
 * What kind of place a group is, said in a word. The group's own label is a
 * speaker name for transcript turns, so on its own it never tells you whether
 * you are about to rewrite the record of what someone said or a line of typed
 * notes — which is the one thing worth knowing before ticking it.
 */
const KIND_WORD: Record<Occurrence['kind'], string> = {
  segment: 'Note',
  summary: 'Summary',
  action: 'Action item',
  transcript: 'Transcript',
}

/**
 * How this review was reached, which changes exactly one word of the copy.
 *
 * 'edit' — somebody corrected a note and saved it. That note already reads
 * correctly, so the list in front of them is the OTHER places.
 *
 * 'selection' — somebody highlighted a word and said what it should be. Nothing
 * has changed yet; the word they highlighted is itself in this list, and
 * calling these the "other" places would send them hunting for a mention that
 * is on screen already.
 */
export type ReplaceOrigin = 'edit' | 'selection'

export function ReplaceReviewDialog({
  meetingId,
  term,
  replacement,
  matches,
  origin = 'edit',
  open,
  onOpenChange,
  onApplied,
}: {
  meetingId: string
  /** The spelling being corrected — what the highlighted matches are. */
  term: string
  /** What every ticked match becomes. */
  replacement: string
  /** Result of findMeetingReplacements for `term` on this meeting. */
  matches: MeetingReplaceMatches
  origin?: ReplaceOrigin
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fired after a successful apply so the caller can refetch its notes. */
  onApplied?: (result: MeetingReplaceResult) => void
}) {
  const { occurrences } = matches
  const groups = useMemo(() => groupOccurrences(occurrences), [occurrences])
  const [selected, setSelected] = useState<Set<string>>(() => defaultSelection(occurrences))
  const [isPending, startTransition] = useTransition()
  // Set once the write has happened: the offsets in `occurrences` no longer
  // describe the text that is now stored, so the list is replaced by its
  // outcome rather than left tickable a second time.
  const [outcome, setOutcome] = useState<MeetingReplaceResult | null>(null)

  // Reset during render rather than in an effect: a new search arriving while
  // this dialog is mounted must never paint one frame of the previous term's
  // ticks — those checkboxes would be pointing at offsets in a different list.
  const [reviewed, setReviewed] = useState(occurrences)
  if (reviewed !== occurrences) {
    setReviewed(occurrences)
    setSelected(defaultSelection(occurrences))
    setOutcome(null)
  }

  function toggle(occurrence: Occurrence) {
    setSelected((current) => {
      const next = new Set(current)
      const key = keyOf(occurrence)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleApply() {
    const chosen = occurrences.filter((occurrence) => selected.has(keyOf(occurrence)))
    if (chosen.length === 0) return

    startTransition(async () => {
      try {
        const res = await applyMeetingReplacements({
          meetingId,
          term,
          replacement,
          selections: chosen.map((occurrence) => ({
            targetId: occurrence.targetId,
            start: occurrence.start,
            matched: occurrence.matched,
          })),
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setOutcome(res.data)
        onApplied?.(res.data)
        if (res.data.skipped === 0) {
          toast.success(
            `Replaced in ${res.data.applied} ${res.data.applied === 1 ? 'place' : 'places'}`,
          )
          onOpenChange(false)
          return
        }
        // Left open on purpose: "some of these no longer matched" is a fact
        // about someone else's edit, and a toast that vanishes is not where
        // it belongs.
        toast.warning(`Replaced ${res.data.applied}, skipped ${res.data.skipped}`)
      } catch {
        toast.error('Something went wrong — try again')
      }
    })
  }

  const total = occurrences.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Found <span className="font-mono tabular-nums">{matches.total}</span>{' '}
            {origin === 'edit' ? 'other ' : ''}
            {matches.total === 1 ? 'place' : 'places'}
          </DialogTitle>
          <DialogDescription>
            Replacing “{term}” with “{replacement}”. Tick the ones that mean the same thing —
            nothing else in the meeting is touched.
            {origin === 'selection' ? ' The one you highlighted is in this list too.' : ''}
          </DialogDescription>
        </DialogHeader>

        {outcome ? (
          <div role="status" className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm">
              Replaced in <span className="font-mono tabular-nums">{outcome.applied}</span>{' '}
              {outcome.applied === 1 ? 'place' : 'places'}.
            </p>
            {outcome.skipped > 0 ? (
              <p className="text-sm text-muted-foreground">
                Skipped <span className="font-mono tabular-nums">{outcome.skipped}</span> that had
                already changed since this list was built — the notes were edited somewhere else, so
                those were left exactly as they are. Search again to see where they stand now.
              </p>
            ) : null}
          </div>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">
            {origin === 'edit'
              ? 'Nothing else in this meeting uses that spelling.'
              : 'That spelling is no longer anywhere in this meeting.'}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
                <span className="font-mono tabular-nums">{selected.size}</span> of{' '}
                <span className="font-mono tabular-nums">{total}</span> selected
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || selected.size === total}
                onClick={() => setSelected(new Set(occurrences.map(keyOf)))}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending || selected.size === 0}
                onClick={() => setSelected(new Set())}
              >
                Select none
              </Button>
            </div>

            {matches.truncated ? (
              <p className="text-xs text-muted-foreground">
                Showing the first <span className="font-mono tabular-nums">{total}</span> of{' '}
                <span className="font-mono tabular-nums">{matches.total}</span>. Correct these, then
                search again for the rest.
              </p>
            ) : null}

            {/* Its own scroll region so Apply never leaves the screen on a long list. */}
            <div className="flex max-h-[45svh] flex-col gap-4 overflow-y-auto">
              {groups.map((group) => (
                <section key={`${group.kind}:${group.items[0].targetId}`} className="flex flex-col gap-1.5">
                  <h3 className="flex items-baseline gap-2 text-xs font-medium text-muted-foreground">
                    <span className="truncate">{group.label}</span>
                    {group.label === KIND_WORD[group.kind] ? null : (
                      <span className="shrink-0 text-2xs">{KIND_WORD[group.kind]}</span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums">
                      {group.items.length}
                    </span>
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {group.items.map((occurrence) => {
                      const key = keyOf(occurrence)
                      const isSelected = selected.has(key)
                      return (
                        <li key={key}>
                          <label
                            className={cn(
                              'flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-colors duration-150',
                              'hover:border-ring/60 has-focus-visible:border-ring',
                              isSelected ? 'border-border bg-muted/40' : 'border-transparent',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggle(occurrence)}
                              disabled={isPending}
                              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-popover focus-visible:outline-none"
                            />
                            <span className="flex min-w-0 flex-col gap-1">
                              <span className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                <span className="text-muted-foreground">
                                  {occurrence.context.before.length === CONTEXT_CHARS ? '…' : ''}
                                  {occurrence.context.before}
                                </span>
                                <mark
                                  className={cn(
                                    'rounded-sm px-0.5 text-foreground',
                                    occurrence.approximate ? 'bg-warning/20' : 'bg-primary/15',
                                  )}
                                >
                                  {occurrence.matched}
                                </mark>
                                <span className="text-muted-foreground">
                                  {occurrence.context.after}
                                  {occurrence.context.after.length === CONTEXT_CHARS ? '…' : ''}
                                </span>
                              </span>
                              {/* The word carries the state, not the highlight
                                  colour: an approximate match is a different
                                  spelling, and someone has to read that as a
                                  claim they can refuse. */}
                              {occurrence.approximate ? (
                                <span className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="border-warning/50 text-warning">
                                    Approximate
                                  </Badge>
                                  <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                                    {Math.round(occurrence.similarity * 100)}% match
                                  </span>
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="ghost" disabled={isPending} />}>
            {outcome || total === 0 ? 'Close' : 'Cancel'}
          </DialogClose>
          {outcome || total === 0 ? null : (
            <Button type="button" disabled={isPending || selected.size === 0} onClick={handleApply}>
              {isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {isPending ? 'Replacing…' : `Replace ${selected.size} selected`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Exact matches start ticked, approximate ones do not. An approximate match is
 * a guess about a different spelling; making somebody opt in to each one is the
 * difference between a review screen and a rubber stamp.
 */
function defaultSelection(occurrences: Occurrence[]): Set<string> {
  return new Set(occurrences.filter((o) => !o.approximate).map(keyOf))
}
