import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatTile } from '@/components/ui/stat-tile'
import { cn } from '@/lib/utils'
import { appTabHref, boardHref } from '@/features/apps/tabs'
import {
  completionPct,
  type AppHealth,
  type AppStatus,
  type AppTaskCounts,
} from '@/features/apps/app-health'
import { HealthDot } from '@/features/apps/components/health-dot'
import type { ReactNode } from 'react'

const STATUS_DOT: Record<AppStatus, string> = {
  active: 'bg-primary',
  // --warning is the house status token (globals.css); --chart-1 is the
  // data-viz ramp and does not belong on a state dot.
  paused: 'bg-warning',
  archived: 'bg-muted-foreground/60',
}

const STATUS_LABEL: Record<AppStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

type HeaderStat = {
  label: string
  value: string
  alert?: boolean
  /** Where the number's answering rows live. The portfolio strip's At-risk
   *  tile already deep-links; these are the same figures one page in, and a
   *  count that names a problem but won't take you to it is a dead end. */
  href?: string
  meta?: string
}

/**
 * The app's identity and its five numbers, above the section bar.
 *
 * Hierarchy is the point: ONE page title, then a muted identity line
 * (slug/lead/repo/tags) that recedes, then a row of large tabular figures
 * that can be read without stopping. The old header put the lead, the repo
 * link and every tech tag on one muted line at the same weight as each other
 * and gave no numbers at all, so "how is this app doing" needed a click into
 * the board and a count by eye.
 */
export function AppHeader({
  name,
  slug,
  status,
  description,
  repoUrl,
  techTags,
  leadName,
  pmName,
  health,
  tasks,
  memberCount,
  sprintCount,
  meetingCount,
  actions,
}: {
  name: string
  slug: string
  status: AppStatus
  description: string | null
  repoUrl: string | null
  techTags: string[]
  leadName: string | null
  pmName: string | null
  health: AppHealth
  tasks: AppTaskCounts
  memberCount: number
  sprintCount: number
  meetingCount: number
  actions?: ReactNode
}) {
  const stats: HeaderStat[] = [
    { label: 'Open', value: String(tasks.todo + tasks.in_progress), href: boardHref(slug) },
    {
      label: 'Overdue',
      value: String(tasks.overdue),
      alert: tasks.overdue > 0,
      // Linked only when there is something to land on — a filter link that
      // resolves to an empty board would teach people the tiles don't work.
      href: tasks.overdue > 0 ? boardHref(slug, undefined, { overdue: '1' }) : undefined,
      meta: tasks.overdue > 0 ? 'Show these →' : undefined,
    },
    { label: 'Done', value: `${completionPct(tasks)}%` },
    { label: 'Team', value: String(memberCount) },
    { label: 'Sprints', value: String(sprintCount), href: appTabHref(slug, 'roadmap') },
    { label: 'Meetings', value: String(meetingCount), href: appTabHref(slug, 'meetings') },
  ]

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight">{name}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              <span aria-hidden className={cn('size-1.5 rounded-full', STATUS_DOT[status])} />
              {STATUS_LABEL[status]}
            </span>
            <HealthDot health={health} />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono">/{slug}</span>
            <span aria-hidden>·</span>
            <span>
              PM{' '}
              <span className={pmName ? 'font-medium text-foreground' : undefined}>
                {pmName ?? 'not set'}
              </span>
            </span>
            <span aria-hidden>·</span>
            <span>
              Lead{' '}
              <span className={leadName ? 'font-medium text-foreground' : undefined}>
                {leadName ?? 'not set'}
              </span>
            </span>
            {repoUrl ? (
              <>
                <span aria-hidden>·</span>
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-sm outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
                >
                  Repo <ExternalLink className="size-3" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </>
            ) : null}
          </div>

          {description ? (
            <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
          ) : null}

          {techTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {techTags.map((tag) => (
                <Badge key={tag} variant="outline" className="font-normal text-muted-foreground">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {/* StatTile (shared primitive): mono tabular values, and every count
          that has answering rows is a link to them — Open and Overdue land on
          the board (Overdue pre-filtered), Sprints on the roadmap, Meetings on
          the meetings tab. Same numbers as before, now actionable. */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {stats.map((stat) => (
          <StatTile
            key={stat.label}
            label={stat.label}
            value={stat.value}
            meta={stat.meta}
            tone={stat.alert ? 'destructive' : 'default'}
            href={stat.href}
          />
        ))}
      </div>
    </header>
  )
}
