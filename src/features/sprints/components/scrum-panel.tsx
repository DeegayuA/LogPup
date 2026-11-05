import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { format } from 'date-fns'
import { CEREMONY_LABEL, SCRUM_VIEWS, SCRUM_VIEW_LABEL, type Ceremony, type ScrumView } from '@/features/sprints/scrum'
import type { ScrumViewData } from '@/features/sprints/scrum-queries'
import { StandupBoard } from '@/features/sprints/components/standup-board'
import { SprintReview } from '@/features/sprints/components/sprint-review'
import { RetroBoard } from '@/features/sprints/components/retro-board'

/**
 * The Scrum tab (PRD Module B): a sprint picker, the four ceremony views, and
 * the chosen one. Server rendered; the URL (?view=, ?sprint=, ?day=) owns
 * the state so a standup or a retro can be linked to in a meeting invite.
 *
 * Refinement is the backlog, not a sprint, so its slot renders even when the
 * project has no sprint yet; the other three need one.
 */

export type ScrumSprintOption = { id: string; name: string; status: 'planned' | 'active' | 'done' }
export type ScrumSelectedSprint = ScrumSprintOption & { startDate: string; endDate: string; goal: string | null }

export type ScrumPanelProps = {
  slug: string
  appId: string
  sprints: ScrumSprintOption[]
  selected: ScrumSelectedSprint | null
  view: ScrumView
  /** yyyy-mm-dd; the standup day shown (see defaultStandupDay in scrum.ts). */
  day: string
  currentUser: { id: string }
  canManageSprints: boolean
  people: { id: string; name: string }[]
  /** From loadScrumView; null when there is no sprint (or it is not in this project). */
  data: ScrumViewData | null
  refinementSlot: ReactNode
  /** Meetings tagged as a ceremony of the selected sprint (already visibility-filtered). */
  ceremonies?: { id: string; title: string; startsAt: Date; ceremony: Ceremony }[]
}

function hrefFor(slug: string, view: ScrumView, sprintId: string | null) {
  return `/apps/${slug}?tab=scrum&view=${view}${sprintId ? `&sprint=${sprintId}` : ''}`
}

const pill = (active: boolean) =>
  cn(
    'rounded-full border px-3 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'border-primary bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground',
  )

export function ScrumPanel({
  slug,
  sprints,
  selected,
  view,
  day,
  currentUser,
  canManageSprints,
  people,
  data,
  refinementSlot,
  ceremonies = [],
}: ScrumPanelProps) {
  const sprintId = selected?.id ?? null

  return (
    <div className="flex flex-col gap-5">
      <h2 className="sr-only">Scrum</h2>
      <nav aria-label="Scrum meetings" className="flex flex-wrap gap-1 border-b">
        {SCRUM_VIEWS.map((v) => (
          <Link
            key={v}
            href={hrefFor(slug, v, sprintId)}
            aria-current={v === view ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
              v === view
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {SCRUM_VIEW_LABEL[v]}
          </Link>
        ))}
      </nav>

      {view !== 'refinement' && sprints.length > 0 ? (
        <nav aria-label="Choose a sprint" className="flex flex-wrap gap-1.5">
          {sprints.map((s) => (
            <Link
              key={s.id}
              href={hrefFor(slug, view, s.id)}
              aria-current={s.id === sprintId ? 'page' : undefined}
              className={pill(s.id === sprintId)}
            >
              {s.name}
              {s.status === 'active' ? <span className="ml-1 text-primary">· now</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}

      {view !== 'refinement' && ceremonies.length > 0 ? (
        <section aria-labelledby="scrum-ceremonies" className="flex flex-col gap-1.5">
          <h3 id="scrum-ceremonies" className="text-2xs font-medium text-muted-foreground">
            This sprint&apos;s ceremonies
          </h3>
          <ul className="flex flex-wrap gap-2">
            {ceremonies.map((c) => (
              <li key={c.id} className="rounded-lg border bg-card px-2.5 py-1 text-xs">
                <span className="font-medium">{CEREMONY_LABEL[c.ceremony]}</span>
                <span className="text-muted-foreground"> · {format(c.startsAt, 'MMM d, h:mm a')} · {c.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ScrumBody
        slug={slug}
        selected={selected}
        view={view}
        day={day}
        currentUser={currentUser}
        canManageSprints={canManageSprints}
        people={people}
        data={data}
        refinementSlot={refinementSlot}
        hasSprints={sprints.length > 0}
      />
    </div>
  )
}

function ScrumBody({
  slug,
  selected,
  view,
  day,
  currentUser,
  canManageSprints,
  people,
  data,
  refinementSlot,
  hasSprints,
}: Omit<ScrumPanelProps, 'appId' | 'sprints'> & { hasSprints: boolean }) {
  if (view === 'refinement') return <>{refinementSlot}</>

  if (!selected || !data || data.view !== view) {
    return (
      <section className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        {hasSprints
          ? 'Choose a sprint above to see its ' + SCRUM_VIEW_LABEL[view].toLowerCase() + '.'
          : 'No sprints yet. Create a sprint on the Roadmap tab to run standups, reviews and retros here.'}
      </section>
    )
  }

  switch (data.view) {
    case 'standup':
      return (
        <StandupBoard
          slug={slug}
          sprint={selected}
          day={day}
          today={toIsoDateInTimeZone(new Date(), LK_TIMEZONE)}
          days={data.days}
          entries={data.entries}
          blockers={data.blockers}
          currentUserId={currentUser.id}
        />
      )
    case 'review':
      return (
        <SprintReview
          sprintId={selected.id}
          review={data.review}
          feedback={data.feedback}
          currentUserId={currentUser.id}
          canManage={canManageSprints}
        />
      )
    case 'retro':
      return (
        <RetroBoard
          slug={slug}
          sprintId={selected.id}
          items={data.items}
          people={people}
          currentUserId={currentUser.id}
          canManage={canManageSprints}
        />
      )
    default:
      return null
  }
}
