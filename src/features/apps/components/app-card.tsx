import Link from 'next/link'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { CalendarDays, MessageSquare, SquareKanban, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar'
import {
  completionPct,
  parseCalendarDate,
  sprintDayProgress,
  HEALTH_LABEL,
  type AppStatus,
  type HealthLevel,
} from '@/features/apps/app-health'
import { HealthDot } from '@/features/apps/components/health-dot'
import { TaskSplitBar } from '@/features/apps/components/task-split-bar'
import type { AppPortfolioEntry } from '@/features/apps/queries'

const STATUS_LABEL: Record<AppStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

/**
 * Left-edge accent keyed to HEALTH, not to status. Status is already stated in
 * words on the card; what you cannot read from six feet away is which of
 * twelve cards needs a human today, and that is the only thing worth spending
 * colour on. `on-track` gets no accent at all — a grid where every card is
 * coloured says nothing.
 */
const HEALTH_ACCENT: Record<HealthLevel, string> = {
  'at-risk': 'border-l-destructive',
  // --warning, not --chart-1: see health-dot.tsx. The split bar below IS a
  // chart and keeps the ramp; this stripe is a status signal and must not.
  watch: 'border-l-warning',
  'on-track': 'border-l-transparent',
  dormant: 'border-l-transparent',
}

const MAX_TAGS = 3
const MAX_AVATARS = 4

export function AppCard({ app, today }: { app: AppPortfolioEntry; today: string }) {
  const { tasks, currentSprint, nextSprint, meetings, comments, lastActivityAt } = app.stats
  const openTasks = tasks.todo + tasks.in_progress
  const donePct = completionPct(tasks)

  const visibleTags = app.techTags.slice(0, MAX_TAGS)
  const extraTags = app.techTags.length - visibleTags.length

  // Lead first in the avatar stack when they're also assigned to the app.
  const members = app.leadId
    ? [...app.members].sort((a, b) =>
        a.userId === app.leadId ? -1 : b.userId === app.leadId ? 1 : 0,
      )
    : app.members
  const visibleMembers = members.slice(0, MAX_AVATARS)
  const extraMembers = members.length - visibleMembers.length

  const progress = currentSprint
    ? sprintDayProgress(currentSprint.startDate, currentSprint.endDate, today)
    : null
  const overrun = progress?.phase === 'ended'

  return (
    <Link
      href={`/apps/${app.slug}`}
      // A whole-card link would otherwise announce every fragment on the card
      // — each tag, each avatar, "Day 3 of 7" — as one run-on name. The full
      // detail stays readable in browse mode; this is the tab-through summary,
      // and it carries the three figures the card is built around rather than
      // just the verdict. Someone arrowing down a grid of twelve links should
      // not have to enter each card to find out which one has the overdue work.
      aria-label={
        `${app.name} — ${HEALTH_LABEL[app.health.level]}. ` +
        `${openTasks} open, ${tasks.overdue} overdue, ${donePct}% done.`
      }
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article
        className={cn(
          'flex h-full flex-col gap-3 rounded-xl border-l-2 bg-card p-4 ring-1 ring-foreground/10',
          'transition-[transform,box-shadow] duration-150 ease-out',
          'group-hover:-translate-y-0.5 group-hover:ring-ring/40',
          'motion-reduce:transition-none motion-reduce:group-hover:translate-y-0',
          HEALTH_ACCENT[app.health.level],
          app.status === 'archived' && 'opacity-70',
        )}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="truncate font-heading text-base font-semibold tracking-tight">
              {app.name}
            </h3>
            <p className="truncate font-mono text-2xs text-muted-foreground">
              {app.slug}
              {app.status !== 'active' ? ` · ${STATUS_LABEL[app.status]}` : null}
            </p>
          </div>
          <HealthDot health={app.health} />
        </header>

        {/* At-a-glance row — the three numbers that answer "is this healthy?" */}
        <dl className="flex items-end gap-4">
          <div className="flex flex-col">
            <dt className="text-2xs text-muted-foreground">Open</dt>
            <dd className="font-mono text-xl leading-tight font-semibold tabular-nums">
              {openTasks}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-2xs text-muted-foreground">Overdue</dt>
            <dd
              className={cn(
                'font-mono text-xl leading-tight font-semibold tabular-nums',
                tasks.overdue > 0 ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {tasks.overdue}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-2xs text-muted-foreground">Done</dt>
            <dd className="font-mono text-xl leading-tight font-semibold tabular-nums">
              {donePct}
              <span className="text-sm font-normal text-muted-foreground">%</span>
            </dd>
          </div>
          {tasks.overdue > 0 ? (
            <TriangleAlert
              aria-hidden
              className="mb-1 ml-auto size-4 shrink-0 text-destructive"
            />
          ) : null}
        </dl>

        <TaskSplitBar tasks={tasks} />

        {/* Current sprint + its day-progress: the deadline you're running against. */}
        {currentSprint && progress ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{currentSprint.name}</span>
              <span
                className={cn(
                  'shrink-0 font-mono tabular-nums',
                  overrun || progress.remainingDays <= 2
                    ? 'font-medium text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {overrun
                  ? `${-progress.remainingDays}d over`
                  : `${progress.remainingDays}d left`}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className={cn('h-full', overrun ? 'bg-destructive' : 'bg-chart-2')}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <p className="font-mono text-2xs text-muted-foreground tabular-nums">
              Day {progress.elapsedDays} of {progress.totalDays} · ends{' '}
              {format(parseCalendarDate(currentSprint.endDate), 'MMM d')}
            </p>
          </div>
        ) : nextSprint ? (
          <p className="font-mono text-2xs text-muted-foreground tabular-nums">
            Next sprint {nextSprint.name} starts{' '}
            {format(parseCalendarDate(nextSprint.startDate), 'MMM d')}
          </p>
        ) : (
          <p className="text-2xs text-muted-foreground">No sprint running</p>
        )}

        {visibleTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleTags.map((tag) => (
              <Badge key={tag} variant="outline" className="font-normal text-muted-foreground">
                {tag}
              </Badge>
            ))}
            {extraTags > 0 ? (
              <Badge variant="outline" className="font-mono font-normal text-muted-foreground">
                +{extraTags}
              </Badge>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1" title="Sprints">
            <SquareKanban className="size-3" aria-hidden />
            <span className="font-mono tabular-nums">{app.stats.sprints.total}</span>
            <span className="sr-only">sprints</span>
          </span>
          <span className="flex items-center gap-1" title="Meetings">
            <CalendarDays className="size-3" aria-hidden />
            <span className="font-mono tabular-nums">{meetings.total}</span>
            <span className="sr-only">meetings</span>
          </span>
          <span className="flex items-center gap-1" title="Comments">
            <MessageSquare className="size-3" aria-hidden />
            <span className="font-mono tabular-nums">{comments}</span>
            <span className="sr-only">comments</span>
          </span>
          <span className="ml-auto truncate">
            {lastActivityAt
              ? `Active ${formatDistanceToNowStrict(lastActivityAt, { addSuffix: true })}`
              : 'No activity yet'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          {visibleMembers.length > 0 ? (
            <AvatarGroup className="*:data-[slot=avatar]:ring-card">
              {visibleMembers.map((member) => (
                <Avatar key={member.userId} size="sm" title={`${member.name} · ${member.role}`}>
                  {member.avatarUrl ? (
                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                  ) : null}
                  <AvatarFallback>{member.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  {member.userId === app.leadId ? (
                    <AvatarBadge title="Lead">
                      <span className="sr-only">Lead</span>
                    </AvatarBadge>
                  ) : null}
                </Avatar>
              ))}
              {extraMembers > 0 ? (
                <AvatarGroupCount className="font-mono text-xs ring-card group-has-data-[size=sm]/avatar-group:size-6">
                  +{extraMembers}
                </AvatarGroupCount>
              ) : null}
            </AvatarGroup>
          ) : (
            <span className="text-2xs text-muted-foreground">Nobody assigned</span>
          )}
          <span className="truncate text-2xs text-muted-foreground">
            {app.leadName ? (
              <>
                Lead · <span className="font-medium text-foreground">{app.leadName}</span>
              </>
            ) : (
              'No lead'
            )}
          </span>
        </div>
      </article>
    </Link>
  )
}
