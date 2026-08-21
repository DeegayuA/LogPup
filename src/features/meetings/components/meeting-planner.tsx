'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronDown, ExternalLink, NotebookPen, RotateCcw, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { getMeetingPlanner } from '@/features/meetings/planner-actions'
import {
  buildAgenda,
  type AskKind,
  type MeetingPlan,
  type PlannerAsk,
  type PlannerCandidate,
} from '@/features/meetings/planner'
import { eventDotClasses } from '@/features/meetings/event-color'
import { PersonHoverCard } from '@/features/people/components/person-hover-card'
import {
  MetaChip,
  SectionHeading,
  SkeletonBlock,
  bilingualText,
  type ChipTone,
} from '@/features/meetings/components/meeting-chips'

/**
 * "Plan the meeting" — who should be in the room for a meeting that covers
 * several projects, and what to ask each of them.
 *
 * THE ONE RULE THIS SURFACE IS BUILT AROUND: every line here is derived from a
 * live row at the moment the panel loads, and nothing is written anywhere. A
 * question about a task disappears when the task is ticked; a follow-up line
 * disappears when it is resolved; an at-risk reason disappears when the sprint
 * it names closes. That is not a cleanup job somebody has to remember — there
 * is simply no copy to go stale. Reload is the refresh.
 *
 * The organiser's accept/remove decisions are held in THIS component and are
 * not saved either. The panel says so in words rather than letting anyone
 * assume a plan survived the tab, because the alternative — writing the
 * generated agenda into `meetings.agenda`, which is prose a human typed — puts
 * a snapshot in a column nothing would ever clear.
 *
 * SUGGESTIONS, NEVER INVITES. Accepting somebody puts them on the agenda you
 * are reading; it does not add a `meeting_attendees` row, does not send a
 * calendar invite and does not notify them. Adding people is the meeting form's
 * job, and the pointer to it only renders for a viewer who can actually open it.
 */

const ASK_TONE: Record<AskKind, ChipTone> = {
  followup: 'warning',
  checkin: 'warning',
  overdue: 'danger',
  health: 'danger',
  stalled: 'danger',
  unassigned: 'warning',
}

const ASK_LABEL: Record<AskKind, string> = {
  followup: 'Follow-up',
  checkin: 'Check-in',
  overdue: 'Overdue',
  health: 'Project health',
  stalled: 'In progress, past due',
  unassigned: 'Unassigned',
}

export function MeetingPlannerSection({
  meetingId,
  canManage,
  open: controlledOpen,
  onOpenChange,
  onAnswerInNotes,
}: {
  meetingId: string
  /** Whether this viewer can open the meeting form. Gates the ONE sentence
   *  that points at it — a hint naming a control the reader cannot see is
   *  worse than no hint. */
  canManage: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Hands an accepted question to the note composer, so the answer is typed
   *  next to the question that produced it. Absent when there is no composer
   *  to hand it to. */
  onAnswerInNotes?: (text: string) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const [plan, setPlan] = useState<MeetingPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const bodyId = useId()

  // Explicit decisions only. Someone already on the invite counts as accepted
  // until they are explicitly removed; someone suggested counts as accepted
  // only once they are explicitly accepted. Storing the DECISIONS rather than
  // the resulting list is what lets the plan refetch underneath without
  // resurrecting a person the organiser already took off it.
  const [acceptedIds, setAcceptedIds] = useState<ReadonlySet<string>>(new Set())
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set())
  const [droppedAsks, setDroppedAsks] = useState<ReadonlySet<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getMeetingPlanner(meetingId)
      if (res.ok) setPlan(res.data)
      else setLoadError(res.error)
    } catch {
      setLoadError('Could not work out who should be here')
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  // Loaded when the panel is first opened, not on mount: this read costs a
  // workspace-wide health pass (see getMeetingPlanner), and a list of thirty
  // meetings must not pay for it thirty times over for panels nobody expanded.
  useEffect(() => {
    if (!open || plan !== null || loading || loadError !== null) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await getMeetingPlanner(meetingId)
        if (cancelled) return
        if (res.ok) setPlan(res.data)
        else setLoadError(res.error)
      } catch {
        if (!cancelled) setLoadError('Could not work out who should be here')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, plan, loading, loadError, meetingId])

  const isAccepted = useCallback(
    (candidate: PlannerCandidate) =>
      candidate.onInvite ? !removedIds.has(candidate.userId) : acceptedIds.has(candidate.userId),
    [acceptedIds, removedIds],
  )

  function accept(userId: string) {
    setAcceptedIds((prev) => new Set(prev).add(userId))
    setRemovedIds((prev) => {
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
  }

  function remove(userId: string) {
    setRemovedIds((prev) => new Set(prev).add(userId))
    setAcceptedIds((prev) => {
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
  }

  function toggleAsk(key: string) {
    setDroppedAsks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const acceptedSet = useMemo(() => {
    const ids = new Set<string>()
    for (const candidate of plan?.candidates ?? []) {
      if (isAccepted(candidate)) ids.add(candidate.userId)
    }
    return ids
  }, [plan, isAccepted])

  const agenda = useMemo(
    () => (plan ? buildAgenda(plan, acceptedSet, droppedAsks) : []),
    [plan, acceptedSet, droppedAsks],
  )

  const suggested = (plan?.candidates ?? []).filter((c) => !c.onInvite && !isAccepted(c) && !removedIds.has(c.userId))
  const dismissed = (plan?.candidates ?? []).filter((c) => removedIds.has(c.userId))
  const onTheList = (plan?.candidates ?? []).filter((c) => isAccepted(c))

  return (
    <section className="flex flex-col gap-2">
      <SectionHeading
        icon={UserPlus}
        title="Plan this meeting"
        count={plan?.candidates.length}
        action={
          <Button
            variant="ghost"
            size="sm"
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
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
        <div id={bodyId} className="flex flex-col gap-3">
          {loading ? (
            <PlannerSkeleton />
          ) : loadError ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden /> {loadError}
              </p>
              <Button variant="outline" size="sm" type="button" onClick={() => void load()}>
                <RotateCcw aria-hidden /> Retry
              </Button>
            </div>
          ) : plan === null ? null : plan.projects.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              This meeting isn&rsquo;t filed under a project yet, so there is no board, sprint or
              follow-up trail to work from.
              {canManage ? ' Use Edit on this meeting to file it under one.' : ''}
            </p>
          ) : (
            <>
              <ProjectStrip plan={plan} />

              {plan.candidates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nothing to plan on {plan.projects.map((p) => p.name).join(', ')} right now — no
                  overdue work, no unanswered follow-up, no check-in that disagrees with a board,
                  and nobody who runs {plan.projects.length === 1 ? 'it' : 'them'} could be named.
                </p>
              ) : (
                <>
                  <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
                    <span>
                      Worked out from live rows when this panel first opened. Nothing is saved,
                      nobody is invited, and a line vanishes the moment the work behind it closes.
                    </span>
                    {/* The read is not repeated on its own — it costs a
                        workspace-wide health pass — so the refresh is offered
                        rather than the sentence claiming a freshness the code
                        does not deliver. */}
                    <button
                      type="button"
                      onClick={() => void load()}
                      disabled={loading}
                      className="rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {loading ? 'Re-reading…' : 'Re-read now'}
                    </button>
                  </p>

                  {suggested.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <h5 className="font-heading text-xs font-semibold">
                        Suggested — {suggested.length} not on the agenda yet
                      </h5>
                      <ul className="flex flex-col gap-1.5">
                        {suggested.map((candidate) => (
                          <CandidateRow
                            key={candidate.userId}
                            candidate={candidate}
                            canManage={canManage}
                            onAccept={() => accept(candidate.userId)}
                            onRemove={() => remove(candidate.userId)}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {onTheList.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <h5 className="font-heading text-xs font-semibold">
                        On the agenda — {onTheList.length}
                      </h5>
                      <ul className="flex flex-col gap-1.5">
                        {onTheList.map((candidate) => (
                          <CandidateRow
                            key={candidate.userId}
                            candidate={candidate}
                            canManage={canManage}
                            accepted
                            onRemove={() => remove(candidate.userId)}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {dismissed.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-2xs text-muted-foreground">Taken off:</span>
                      {dismissed.map((candidate) => (
                        <Button
                          key={candidate.userId}
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => accept(candidate.userId)}
                        >
                          Put {candidate.name} back
                        </Button>
                      ))}
                    </div>
                  ) : null}

                  <Agenda
                    groups={agenda}
                    droppedAsks={droppedAsks}
                    onToggleAsk={toggleAsk}
                    onAnswerInNotes={onAnswerInNotes}
                    hasAccepted={onTheList.length > 0}
                  />
                </>
              )}
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}

/**
 * The projects this meeting covers, each with the health verdict the /apps
 * grid shows for it and who runs it. The dot is `eventDotClasses` — the one
 * 8-slot identity system (event-color.ts); no second hash, no new token.
 */
function ProjectStrip({ plan }: { plan: MeetingPlan }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {plan.projects.map((project) => (
        <li
          key={project.appId}
          className="flex flex-wrap items-center gap-1.5 rounded-md border border-border px-2 py-1"
        >
          <span
            className={cn('size-2 shrink-0 rounded-full', eventDotClasses(project.appId))}
            aria-hidden
          />
          <Link
            href={`/apps/${project.slug}`}
            className="text-xs font-medium underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {project.name}
          </Link>
          <MetaChip tone={project.healthLevel === 'at-risk' ? 'danger' : project.healthLevel === 'watch' ? 'warning' : 'neutral'}>
            {project.healthLabel}
          </MetaChip>
          {/* leadId is nullable, so "no lead" is a real state and is said in
              words rather than rendered as a blank. pmId is NOT NULL, so the
              only way its name is missing is a user row that could not be
              read — which is a different sentence from "there is no PM". */}
          {/* The names carry a person card now: this row is where somebody
              decides who to pull into a meeting, and "who is this, and are they
              already at 112%" was a question the row raised and answered
              nowhere. The card also holds Call and WhatsApp, so deciding and
              reaching out happen in the same place. */}
          <span className="text-2xs text-muted-foreground">
            {project.pmName && project.pmId ? (
              <>
                PM{' '}
                <PersonHoverCard userId={project.pmId} className="text-foreground">
                  {project.pmName}
                </PersonHoverCard>
              </>
            ) : (
              'PM not resolved'
            )}
            {' · '}
            {project.leadName && project.leadId ? (
              <>
                lead{' '}
                <PersonHoverCard userId={project.leadId} className="text-foreground">
                  {project.leadName}
                </PersonHoverCard>
              </>
            ) : (
              'no lead'
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

function CandidateRow({
  candidate,
  canManage,
  accepted = false,
  onAccept,
  onRemove,
}: {
  candidate: PlannerCandidate
  canManage: boolean
  accepted?: boolean
  onAccept?: () => void
  onRemove: () => void
}) {
  const assumed = candidate.roles.some((role) => role.assumedAtMigration)
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-card p-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <Avatar size="sm">
          {candidate.avatarUrl ? <AvatarImage src={candidate.avatarUrl} alt={candidate.name} /> : null}
          <AvatarFallback>{candidate.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{candidate.name}</span>
          <span className={cn(bilingualText, 'text-xs text-muted-foreground')}>
            {candidate.reason}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            {candidate.onInvite ? (
              <MetaChip tone="success">Already on the invite</MetaChip>
            ) : (
              <MetaChip>
                Not on the invite
                {canManage ? ' — use Edit to add them' : ''}
              </MetaChip>
            )}
            {candidate.asks.length > 0 ? (
              <MetaChip>
                <span className="font-mono">{candidate.asks.length}</span> to ask
              </MetaChip>
            ) : null}
            {/* Migration 0034 stamped a sentinel note on the rows it assumed
                (isBackfilled, role-history.ts). Saying so is the difference
                between "we watched this appointment happen" and "we inferred
                it when the table was created". */}
            {assumed ? <MetaChip>role assumed at migration</MetaChip> : null}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {!accepted && onAccept ? (
          <Button size="sm" type="button" onClick={onAccept}>
            Add to agenda
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" type="button" onClick={onRemove}>
          {accepted ? 'Take off' : 'Not needed'}
        </Button>
      </div>
    </li>
  )
}

/**
 * The accepted plan, grouped by project. Rebuilt from the CURRENT plan on
 * every render (buildAgenda is pure), so it can only ever show lines whose
 * underlying rows still matched at the last load.
 */
function Agenda({
  groups,
  droppedAsks,
  onToggleAsk,
  onAnswerInNotes,
  hasAccepted,
}: {
  groups: ReturnType<typeof buildAgenda>
  droppedAsks: ReadonlySet<string>
  onToggleAsk: (key: string) => void
  onAnswerInNotes?: (text: string) => void
  hasAccepted: boolean
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
      <SectionHeading as="h5" icon={Users} title="The agenda, by project" count={groups.length} />
      {!hasAccepted ? (
        <p className="text-xs text-muted-foreground">
          Nobody on the agenda yet — add someone above and their questions land here, grouped by
          project.
        </p>
      ) : groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Everyone on the agenda is clear: no overdue work, no unanswered follow-up and no check-in
          that disagrees with a board.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {groups.map((group) => (
            <li key={group.appId ?? 'cross-project'} className="flex flex-col gap-1.5">
              <h6 className="flex items-center gap-1.5 font-heading text-xs font-semibold">
                {group.appId ? (
                  <span
                    className={cn('size-2 shrink-0 rounded-full', eventDotClasses(group.appId))}
                    aria-hidden
                  />
                ) : null}
                {group.title}
              </h6>
              <ul className="flex flex-col gap-1.5">
                {group.entries.map((entry) => (
                  <li key={entry.candidate.userId} className="flex flex-col gap-1 rounded-md border border-border bg-card p-2">
                    <span className="text-xs font-medium">{entry.candidate.name}</span>
                    <ul className="flex flex-col gap-1">
                      {entry.asks.map((ask) => (
                        <AskRow
                          key={ask.key}
                          ask={ask}
                          dropped={droppedAsks.has(ask.key)}
                          onToggle={() => onToggleAsk(ask.key)}
                          onAnswerInNotes={onAnswerInNotes}
                          personName={entry.candidate.name}
                        />
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {/* Stated, not implied. Nothing here is stored, so a reader must not walk
          away believing they saved a plan. */}
      <p className="text-2xs text-muted-foreground">
        Worked out from live rows when this panel first opened — re-read it any time from the link
        above. What you add or take off here is not saved; the questions are, because the tasks,
        follow-ups and check-ins behind them are.
      </p>
    </div>
  )
}

function AskRow({
  ask,
  dropped,
  onToggle,
  onAnswerInNotes,
  personName,
}: {
  ask: PlannerAsk
  dropped: boolean
  onToggle: () => void
  onAnswerInNotes?: (text: string) => void
  personName: string
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn(bilingualText, 'text-xs', dropped && 'line-through opacity-60')}>
          {ask.text}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <MetaChip tone={ASK_TONE[ask.kind]}>{ASK_LABEL[ask.kind]}</MetaChip>
          {ask.context ? (
            <span className="text-2xs text-muted-foreground">{ask.context}</span>
          ) : null}
          {ask.gap === 'unknown' ? (
            <span className="text-2xs text-muted-foreground">
              nothing on the board to compare against
            </span>
          ) : null}
          {ask.external ? (
            <a
              href={ask.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-2xs underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {ask.linkLabel} <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : (
            <Link
              href={ask.href}
              className="text-2xs underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {ask.linkLabel}
            </Link>
          )}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onAnswerInNotes && !dropped ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onAnswerInNotes(`${personName} — ${ask.text}: `)}
          >
            <NotebookPen aria-hidden /> Answer in notes
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" type="button" onClick={onToggle}>
          {dropped ? 'Put back' : 'Drop'}
        </Button>
      </div>
    </li>
  )
}

function PlannerSkeleton() {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Working out who should be here">
      <div className="flex flex-wrap gap-1.5">
        <SkeletonBlock className="h-6 w-40" />
        <SkeletonBlock className="h-6 w-32" />
      </div>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  )
}
