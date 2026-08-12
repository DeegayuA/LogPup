'use client'

import { useEffect, useId, useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { AlertCircle, ChevronDown, RotateCcw, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getMeetingPrep } from '@/features/meetings/ai-actions'
import type { AttendeeCheckinPrep, AttendeePrep } from '@/features/meetings/notes'
import { checkinGap } from '@/features/sprints/checkins'
import { upsertSprintCheckin } from '@/features/sprints/checkin-actions'
import { GapHint } from '@/features/sprints/components/sprint-checkin-editor'
import { MetaChip, SectionHeading, SkeletonBlock } from '@/features/meetings/components/meeting-chips'

/**
 * "Around the table" — one row per attendee so the organiser can walk person
 * by person through every project they carry, without a second meeting: their
 * apps (with the current sprint's open/overdue counts), and their latest
 * check-in held up against what their board computes (GapHint). The signed-in
 * attendee updates their own number right here, mid-discussion.
 *
 * Fetches its own data (getMeetingPrep) rather than riding on getMeetingIntel:
 * this payload is board-derived and refetches after every inline check-in,
 * while the intel payload carries transcripts and only changes when an
 * analysis runs — coupling their lifecycles would refetch the heavy one to
 * update one number.
 */
export function MeetingPrepSection({
  meetingId,
  currentUserId,
  open: controlledOpen,
  onOpenChange,
}: {
  meetingId: string
  currentUserId: string
  /** Controlled open state, for a caller (the meeting write-up's panel shell)
   *  that persists this alongside every other panel's collapse preference.
   *  Omit both this and onOpenChange to keep the original uncontrolled
   *  behaviour (starts open, manages its own state) — every other caller,
   *  if one ever exists, is unaffected. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(true)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const [rows, setRows] = useState<AttendeePrep[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savePending, startSave] = useTransition()
  const bodyId = useId()

  /**
   * `visible` drives the skeleton/error surface; `refresh` (after a check-in
   * write) replaces rows silently — the row already updated optimistically,
   * so blanking the list would be the bigger disruption. Writes no state
   * before its await, which is what lets the mount effect call it directly
   * without a cascading render (same account as loadIntel in
   * meeting-intel.tsx).
   */
  async function load(mode: 'visible' | 'refresh') {
    try {
      const res = await getMeetingPrep(meetingId)
      if (res.ok) {
        setRows(res.data)
        if (mode === 'visible') setLoadError(null)
      } else if (mode === 'visible') {
        setLoadError(res.error)
      }
    } catch {
      if (mode === 'visible') setLoadError('Could not load the table')
    } finally {
      if (mode === 'visible') setLoading(false)
    }
  }

  function loadVisibly() {
    setLoading(true)
    setLoadError(null)
    void load('visible')
  }

  // The mount fetch is written out inline (not `load('visible')`) so every
  // setState provably sits behind the await, and stale results from an
  // unmounted/superseded effect are dropped — the standard cancellation
  // shape, same as meeting-intel.tsx's parked-segment recovery effect.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getMeetingPrep(meetingId)
        if (cancelled) return
        if (res.ok) {
          setRows(res.data)
          setLoadError(null)
        } else {
          setLoadError(res.error)
        }
      } catch {
        if (!cancelled) setLoadError('Could not load the table')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [meetingId])

  function patchCheckin(userId: string, checkin: AttendeeCheckinPrep | null) {
    setRows((prev) =>
      prev ? prev.map((row) => (row.userId === userId ? { ...row, checkin } : row)) : prev,
    )
  }

  // Optimistic write with an explicit rollback: the row's own line moves the
  // instant Save is pressed (this is mid-meeting — the number IS the
  // conversation), reverts to what was there before if the server refuses,
  // and is replaced by server truth via the silent refetch on success.
  function handleCheckin(row: AttendeePrep, percent: number, note: string | null) {
    const target = row.checkinTarget
    if (!target) return
    const before = row.checkin
    patchCheckin(row.userId, {
      sprintId: target.sprintId,
      sprintName: target.sprintName,
      appName: target.appName,
      percent,
      note,
      updatedAt: new Date(),
      computedPercent: target.computedPercent,
      gap: checkinGap(percent, { percent: target.computedPercent }),
    })
    startSave(async () => {
      try {
        const res = await upsertSprintCheckin(target.sprintId, percent, note ?? undefined)
        if (!res.ok) {
          patchCheckin(row.userId, before)
          toast.error(res.error)
          return
        }
        toast.success(`Checked in at ${res.data.percent}%`)
        await load('refresh')
      } catch {
        patchCheckin(row.userId, before)
        toast.error('Something went wrong — try again')
      }
    })
  }

  // "No attendee has any app" is a different statement from "still loading" —
  // only claim it once rows have actually arrived.
  const allEmpty = rows !== null && rows.every((row) => row.apps.length === 0)

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading
        icon={Users}
        title="Around the table"
        count={rows?.length}
        action={
          <Button
            variant="ghost"
            size="sm"
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            // Computed from the resolved `open` rather than a functional
            // updater: `setOpen` may be the caller's onOpenChange, whose
            // signature is `(open: boolean) => void` — an updater function
            // would be passed straight through as the new "open" value.
            onClick={() => setOpen(!open)}
          >
            {open ? 'Hide' : 'Show'}
            <ChevronDown
              className={cn(
                'transition-transform duration-150 motion-reduce:transition-none',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </Button>
        }
      />
      {open ? (
        <div id={bodyId} className="flex flex-col gap-2">
          {loading ? (
            <PrepSkeleton />
          ) : loadError ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden /> {loadError}
              </p>
              <Button variant="outline" size="sm" type="button" onClick={loadVisibly}>
                <RotateCcw aria-hidden /> Retry
              </Button>
            </div>
          ) : rows === null || rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No attendees on this meeting yet — add people to see their projects here.
            </p>
          ) : allEmpty ? (
            <p className="text-xs text-muted-foreground">
              Nobody around this table is linked to a project yet. Assignments (or tasks in a
              running sprint) are what put someone&rsquo;s work on the table.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Person by person: every project they carry, and what they say against what their
                board says.
              </p>
              <ul className="flex flex-col gap-2">
                {rows.map((row) => (
                  <PrepRow
                    key={row.userId}
                    row={row}
                    isSelf={row.userId === currentUserId}
                    savePending={savePending}
                    onCheckin={(percent, note) => handleCheckin(row, percent, note)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}

function PrepSkeleton() {
  return (
    <div
      className="flex flex-col gap-2"
      role="status"
      aria-label="Loading who's around the table"
    >
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5">
          <div className="flex items-center justify-between gap-3">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="h-3.5 w-24" />
          </div>
          <SkeletonBlock className="h-5 w-3/5" />
        </div>
      ))}
    </div>
  )
}

function PrepRow({
  row,
  isSelf,
  savePending,
  onCheckin,
}: {
  row: AttendeePrep
  isSelf: boolean
  savePending: boolean
  onCheckin: (percent: number, note: string | null) => void
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">
          {row.name}
          {isSelf ? <span className="ml-1.5 text-2xs text-muted-foreground">(you)</span> : null}
        </span>
        <CheckinLine checkin={row.checkin} />
      </div>

      {row.apps.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {row.apps.map((app) => (
            <li key={app.appId} className="flex items-center gap-1.5">
              <Link
                href={`/apps/${app.appSlug}`}
                className="text-xs font-medium underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {app.appName}
              </Link>
              {app.sprintId ? (
                <>
                  <MetaChip>
                    <span className="font-mono">{app.openCount}</span> open
                  </MetaChip>
                  {app.overdueCount > 0 ? (
                    <MetaChip tone="danger">
                      <span className="font-mono">{app.overdueCount}</span> overdue
                    </MetaChip>
                  ) : null}
                </>
              ) : (
                <MetaChip>no sprint running</MetaChip>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Not linked to any project.</p>
      )}

      {isSelf && row.checkinTarget ? (
        <SelfCheckinForm row={row} pending={savePending} onSubmit={onCheckin} />
      ) : null}
    </li>
  )
}

/**
 * What one person's latest check-in says, next to what their board computes —
 * GapHint is borrowed from the sprint editor so 'ahead'/'behind' can never
 * mean two different colours on two surfaces. A gap of 'unknown' is stated in
 * words ("no tasks to compare"): "we can't tell" and "they agree" must not
 * render identically.
 */
function CheckinLine({ checkin }: { checkin: AttendeeCheckinPrep | null }) {
  if (!checkin) {
    return <span className="text-xs text-muted-foreground">No check-in yet</span>
  }
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
      <span className="font-mono font-medium tabular-nums">said {checkin.percent}%</span>
      <span className="text-muted-foreground">
        · board{' '}
        {checkin.computedPercent === null ? (
          '—'
        ) : (
          <span className="font-mono tabular-nums">{checkin.computedPercent}%</span>
        )}
      </span>
      <GapHint verdict={checkin.gap} />
      {checkin.gap === 'unknown' ? (
        <span className="text-2xs text-muted-foreground">no tasks to compare</span>
      ) : null}
      {checkin.note ? (
        <span className="min-w-0 text-muted-foreground">&ldquo;{checkin.note}&rdquo;</span>
      ) : null}
      <span className="text-2xs text-muted-foreground">
        {checkin.appName} · {formatDistanceToNow(checkin.updatedAt, { addSuffix: true })}
      </span>
    </span>
  )
}

/**
 * Client-side mirror of upsertSprintCheckin's percent rule (int 0..100) so
 * Save can refuse before a round trip — same digits-only reasoning as
 * sprint-checkin-editor.tsx's parsePercent (parseInt('12abc') is 12, and
 * silently saving a number the user didn't quite type is worse than a
 * disabled button).
 */
function parsePercent(text: string): number | null {
  if (!/^\d{1,3}$/.test(text.trim())) return null
  const value = Number(text)
  return value <= 100 ? value : null
}

/**
 * The signed-in attendee's inline check-in — update the number right as your
 * turn comes up. The optimistic display lives in the parent's row (see
 * handleCheckin); this form only holds the draft, which a failed save does
 * NOT reset — "try again" must never mean "type it all again".
 */
function SelfCheckinForm({
  row,
  pending,
  onSubmit,
}: {
  row: AttendeePrep
  pending: boolean
  onSubmit: (percent: number, note: string | null) => void
}) {
  const target = row.checkinTarget
  const [percentText, setPercentText] = useState(row.checkin ? String(row.checkin.percent) : '')
  const [note, setNote] = useState(row.checkin?.note ?? '')
  const draftPercent = parsePercent(percentText)

  if (!target) return null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draftPercent === null || pending) return
    // '' → null, mirroring the action's own convention.
    onSubmit(draftPercent, note.trim() || null)
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-2"
    >
      <p className="text-2xs font-medium text-muted-foreground">
        Your check-in — {target.appName} · {target.sprintName}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={draftPercent ?? row.checkin?.percent ?? 0}
          onChange={(event) => setPercentText(event.target.value)}
          aria-label="Your progress"
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
        />
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={percentText}
          onChange={(event) => setPercentText(event.target.value)}
          aria-label="Your progress percent"
          aria-invalid={percentText !== '' && draftPercent === null}
          className="w-16 shrink-0 text-right font-mono tabular-nums"
        />
        <span aria-hidden className="text-xs text-muted-foreground">
          %
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={280}
          placeholder="Optional note — one sentence of context"
          aria-label="Check-in note (optional)"
        />
        <Button
          type="submit"
          size="sm"
          className="shrink-0"
          disabled={pending || draftPercent === null}
        >
          {row.checkin ? 'Update' : 'Check in'}
        </Button>
      </div>
    </form>
  )
}
