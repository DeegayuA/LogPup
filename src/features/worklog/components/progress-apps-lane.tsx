import Link from 'next/link'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { appTabHref } from '@/features/apps/tabs'
import { eventDotClasses } from '@/features/meetings/event-color'
import type { ProgressAppRow, ProgressSprint } from '@/features/worklog/progress-queries'

/**
 * One card per app the actor can see: the running sprint with the dashboard
 * card's own progress-bar grammar, the open bug backlog, when anything last
 * happened, and — on apps inside the actor's worklog scope — who is on it.
 *
 * Out-of-scope but visible apps get the SAME card minus the people row: the
 * partial tier is a missing section, never a different design, so the reader
 * learns one card and their grant decides how much of it fills in.
 */

const MAX_MEMBER_AVATARS = 5

/** Anchored to local noon — the repo-wide guard for date-only strings. */
function noon(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase()
}

function SprintBlock({ sprint }: { sprint: ProgressSprint }) {
  const percent = Math.round(sprint.progress * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-sm font-medium">{sprint.name}</span>
          {sprint.notStarted ? (
            <Badge
              variant="outline"
              className="shrink-0 text-muted-foreground"
              title="Running by date, but its status hasn't been flipped to Active yet"
            >
              not started
            </Badge>
          ) : null}
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {format(noon(sprint.startDate), 'MMM d')} – {format(noon(sprint.endDate), 'MMM d')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {sprint.done}/{sprint.total}
        </span>
      </div>
      <span className="sr-only">
        Sprint {sprint.name}: {sprint.done} of {sprint.total} tasks done.
      </span>
    </div>
  )
}

export function ProgressAppsLane({ apps }: { apps: ProgressAppRow[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {apps.map((app) => (
        <li key={app.id} className="min-w-0">
          <Card size="sm" className="h-full">
            <CardHeader>
              <CardTitle as="h3" className="flex min-w-0 items-center gap-2">
                {/* The ONE identity hash — the same hue this app wears on the
                    meetings calendar. */}
                <span
                  aria-hidden
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    eventDotClasses(app.id) ?? 'bg-muted-foreground/40',
                  )}
                />
                <Link
                  href={`/apps/${app.slug}`}
                  className="truncate rounded-sm outline-none transition-colors duration-150 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
                >
                  {app.name}
                </Link>
                {app.status === 'paused' ? (
                  <Badge variant="outline" className="shrink-0 text-muted-foreground">
                    paused
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {app.sprint ? (
                <SprintBlock sprint={app.sprint} />
              ) : (
                <p className="text-xs text-muted-foreground">No sprint running.</p>
              )}

              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {app.openBugs > 0 ? (
                  <Link
                    href={appTabHref(app.slug, 'bugs')}
                    className="rounded-sm outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
                  >
                    <span className="font-mono tabular-nums text-foreground">{app.openBugs}</span>{' '}
                    open {app.openBugs === 1 ? 'bug' : 'bugs'}
                  </Link>
                ) : (
                  <span>No open bugs</span>
                )}
                {app.lastActivityAt ? (
                  <span title={app.lastActivityAt.toISOString()}>
                    Last activity{' '}
                    <span className="font-mono tabular-nums text-foreground">
                      {format(app.lastActivityAt, 'MMM d')}
                    </span>
                  </span>
                ) : (
                  <span>Nothing recorded yet</span>
                )}
              </div>

              {app.fullDetail ? (
                app.members.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <AvatarGroup>
                      {app.members.slice(0, MAX_MEMBER_AVATARS).map((member) => (
                        <Avatar key={member.userId} size="sm" title={member.name}>
                          {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                          <AvatarFallback>{initials(member.name)}</AvatarFallback>
                        </Avatar>
                      ))}
                      {app.members.length > MAX_MEMBER_AVATARS ? (
                        <AvatarGroupCount className="size-6 text-xs">
                          +{app.members.length - MAX_MEMBER_AVATARS}
                        </AvatarGroupCount>
                      ) : null}
                    </AvatarGroup>
                    <span className="sr-only">
                      Team: {app.members.map((member) => member.name).join(', ')}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nobody assigned yet.</p>
                )
              ) : (
                // The partial tier says so in words rather than rendering a
                // gap that reads as "no team".
                <p className="text-xs text-muted-foreground">
                  Team detail is outside your scope.
                </p>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}

/** Loading shape for the lane — three card-shaped promises, nothing more. */
export function ProgressAppsLaneSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="sr-only" role="status">
        Loading apps…
      </span>
      <div aria-hidden className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
