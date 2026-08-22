'use client'

import * as React from 'react'
import { Loader2, RotateCcw, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  deleteRecordingTake,
  getMeetingRecordings,
  restoreRecordingTake,
} from '@/features/meetings/recording-actions'
import type { MeetingRecordings, RecordingTake } from '@/features/meetings/recording-queries'
import { cn } from '@/lib/utils'

/**
 * One card per take, which is what a meeting actually consists of.
 *
 * A studio presses record ten or fifteen times in a meeting — a break, a
 * client joining late, a laptop that slept. Until takes existed, all of that
 * was one undifferentiated run of segment numbers, so the only thing this
 * panel could say about a two-hour meeting was how many five-minute chunks it
 * had. Now each press is a row somebody can point at, name, and remove.
 *
 * REMOVED TAKES STAY ON SCREEN. That is the whole reason the delete is soft:
 * a take that vanished on click is indistinguishable from one that was lost,
 * and nobody presses that button a second time. A removed card keeps its
 * number, says when it went, and offers the way back.
 */
export function RecordingTakes({
  meetingId,
  canManage,
  className,
}: {
  meetingId: string
  canManage: boolean
  className?: string
}) {
  const [data, setData] = React.useState<MeetingRecordings | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [confirming, setConfirming] = React.useState<RecordingTake | null>(null)

  const [reloadToken, setReloadToken] = React.useState(0)
  const reload = React.useCallback(() => setReloadToken((n) => n + 1), [])

  /* Cancellation guard, not just lint appeasement: this refetches whenever a
     take is removed or put back, and a reply landing after the panel closed —
     or after the reader moved to another meeting — would write somebody
     else's takes into this state. */
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getMeetingRecordings(meetingId)
      if (cancelled) return
      setData(res.ok ? res.data : null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [meetingId, reloadToken])

  async function remove(take: RecordingTake) {
    setBusyId(take.id)
    try {
      const res = await deleteRecordingTake(take.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      reload()
      toast.success(`Take ${take.takeIndex} removed — you can put it back from here`)
    } finally {
      setBusyId(null)
      setConfirming(null)
    }
  }

  async function restore(take: RecordingTake) {
    setBusyId(take.id)
    try {
      const res = await restoreRecordingTake(take.id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      reload()
      toast.success(`Take ${take.takeIndex} is back`)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>Reading this meeting’s takes…</p>
    )
  }
  if (!data || (data.takes.length === 0 && data.untrackedSegments === 0)) return null

  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium">
          {data.rounds} {data.rounds === 1 ? 'recording' : 'recordings'}
        </h4>
        {data.takes.length > data.rounds ? (
          <span className="text-xs text-muted-foreground">
            {data.takes.length - data.rounds} removed
          </span>
        ) : null}
      </div>

      {/* Said once, at the top, because it is about the write-up rather than
          about any one take. Nothing rewrites itself: the summary stays
          exactly as it was and simply admits it no longer covers what the
          meeting holds. */}
      {data.summaryStale ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-2 text-xs text-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
          <span>
            The write-up was made before this changed. It still quotes what it saw at the time —
            run Analyze again to cover what’s here now.
          </span>
        </p>
      ) : null}

      <ul className="flex flex-col gap-1.5">
        {data.takes.map((take) => (
          <li
            key={take.id}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 ring-1',
              take.removed ? 'bg-muted/40 ring-border' : 'bg-card ring-foreground/10',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm', take.removed && 'text-muted-foreground line-through')}>
                {take.label ?? `Take ${take.takeIndex}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {describeTake(take)}
              </p>
            </div>
            {canManage ? (
              take.removed ? (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={busyId === take.id}
                  onClick={() => void restore(take)}
                >
                  {busyId === take.id ? (
                    <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <RotateCcw aria-hidden />
                  )}
                  Put back
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={busyId === take.id}
                  onClick={() => setConfirming(take)}
                  aria-label={`Remove take ${take.takeIndex} and its transcript`}
                >
                  <Trash2 aria-hidden />
                  Remove
                </Button>
              )
            ) : null}
          </li>
        ))}
      </ul>

      {/* Counted and named rather than hidden. This is real transcript that
          belongs to this meeting and cannot be attributed to any take without
          inventing one — see migration 0060, which backfills nothing. */}
      {data.untrackedSegments > 0 ? (
        <p className="text-xs text-muted-foreground">
          {data.untrackedSegments} more {data.untrackedSegments === 1 ? 'segment' : 'segments'} were
          recorded before takes were tracked, so they belong to no take in particular.
        </p>
      ) : null}

      <AlertDialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {confirming?.label ?? `take ${confirming?.takeIndex}`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Its {confirming?.segments ?? 0} transcribed{' '}
              {confirming?.segments === 1 ? 'segment leaves' : 'segments leave'} the meeting with
              it. Nothing is destroyed — you can put it back from this list, and an admin can
              restore it from Trash. If the meeting has already been written up, the summary will
              say it no longer covers what’s here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirming && void remove(confirming)}
              disabled={busyId !== null}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

/** What a take amounts to, in the order somebody scanning the list needs it. */
function describeTake(take: RecordingTake): string {
  const parts: string[] = []
  parts.push(`${take.segments} ${take.segments === 1 ? 'segment' : 'segments'}`)
  const minutes = take.endedAt
    ? Math.max(1, Math.round((take.endedAt.getTime() - take.startedAt.getTime()) / 60_000))
    : null
  // No endedAt means the tab closed mid-take rather than somebody pressing
  // stop. Worth saying: it is the difference between a short recording and an
  // interrupted one.
  if (minutes !== null) parts.push(`${minutes} min`)
  else parts.push('never stopped cleanly')
  if (take.removed && take.removedAt) {
    parts.push(`removed ${take.removedAt.toLocaleDateString()}`)
  }
  return parts.join(' · ')
}
