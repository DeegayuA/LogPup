import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { PawPrint, ShieldCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPersonActivity, getPersonDetail } from '@/features/people/queries'
import { ActivityGraph } from '@/features/people/components/activity-graph'
import { CapacityBar } from '@/features/people/components/capacity-bar'
import { cn } from '@/lib/utils'

const TASK_STATUS_ORDER = ['todo', 'in_progress', 'done'] as const

const TASK_STATUS_LABEL: Record<(typeof TASK_STATUS_ORDER)[number], string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

const TASK_STATUS_DOT: Record<(typeof TASK_STATUS_ORDER)[number], string> = {
  todo: 'bg-muted-foreground/40',
  in_progress: 'bg-primary',
  done: 'bg-primary/40',
}

const linkClass =
  'rounded-sm underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

export default async function PersonDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const [person, activity] = await Promise.all([getPersonDetail(id), getPersonActivity(id)])
  if (!person) notFound()

  const { user, totalPct, overallocated, breakdown, tasks, meetings } = person
  const openTaskCount = tasks.filter((task) => task.status !== 'done').length

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex items-center gap-4">
        <Avatar size="lg" className="size-14!">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
          <AvatarFallback className="text-lg font-medium">
            {user.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight">{user.name}</h1>
            {user.role === 'admin' ? (
              <Badge variant="secondary">
                <ShieldCheck aria-hidden /> Admin
              </Badge>
            ) : null}
            {!user.active ? (
              <Badge variant="outline" className="text-muted-foreground">
                Inactive
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {[user.title, user.email].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
            {breakdown.length > 0 ? (
              <CardAction>
                <span className="font-mono text-xs text-muted-foreground">
                  {breakdown.length} {breakdown.length === 1 ? 'app' : 'apps'}
                </span>
              </CardAction>
            ) : null}
          </CardHeader>
          {breakdown.length === 0 ? (
            <CardContent className="flex flex-col gap-1 py-4 text-center">
              <p className="text-sm font-medium">Not assigned to any apps yet.</p>
              <p className="text-xs text-muted-foreground">
                Assign them from an app&apos;s Team panel.
              </p>
            </CardContent>
          ) : (
            <>
              <CardContent className="flex flex-col divide-y divide-border">
                {breakdown.map((entry) => (
                  <div
                    key={entry.appId}
                    className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="flex min-w-0 flex-1 items-baseline gap-2">
                      <Link
                        href={`/apps/${entry.slug}`}
                        className={cn('truncate text-sm font-medium', linkClass)}
                      >
                        {entry.appName}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">{entry.role}</span>
                    </div>
                    <div className="flex items-center gap-2 sm:w-44">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(entry.allocationPct, 100)}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
                        {entry.allocationPct}%
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
              {/* Shared CapacityBar, same as /people and the dashboard — the
                  hand-rolled meter here clipped at 100%, so 130% and 100% drew
                  an identical full bar for the same person on two pages. */}
              <CardContent className="flex flex-col gap-2 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Total capacity</span>
                </div>
                <CapacityBar totalPct={totalPct} />
                {overallocated ? (
                  <p className="text-xs text-destructive">Over capacity — lighten the load.</p>
                ) : null}
              </CardContent>
            </>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityGraph data={activity} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              {tasks.length > 0 ? (
                <CardAction>
                  <span className="font-mono text-xs text-muted-foreground">
                    {openTaskCount} open
                  </span>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                  <PawPrint className="size-5 text-muted-foreground/60" aria-hidden />
                  <p className="text-sm font-medium">All clear.</p>
                  <p className="text-xs text-muted-foreground">
                    Nothing on their plate right now.
                  </p>
                </div>
              ) : (
                TASK_STATUS_ORDER.map((status) => {
                  const items = tasks.filter((task) => task.status === status)
                  if (items.length === 0) return null
                  return (
                    <div key={status} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {TASK_STATUS_LABEL[status]}
                        </h3>
                        <span className="font-mono text-xs text-muted-foreground">
                          {items.length}
                        </span>
                      </div>
                      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                        {items.map((task) => (
                          <li key={task.id} className="flex items-center gap-2.5 px-3 py-2">
                            <span
                              className={cn(
                                'size-1.5 shrink-0 rounded-full',
                                TASK_STATUS_DOT[status],
                              )}
                              aria-hidden
                            />
                            <span
                              className={cn(
                                'min-w-0 flex-1 truncate text-sm',
                                status === 'done' && 'text-muted-foreground',
                              )}
                            >
                              {task.title}
                            </span>
                            <Link
                              href={`/apps/${task.appSlug}`}
                              className={cn(
                                'shrink-0 text-xs text-muted-foreground',
                                linkClass,
                              )}
                            >
                              {task.appName}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming meetings</CardTitle>
              {meetings.length > 0 ? (
                <CardAction>
                  <span className="font-mono text-xs text-muted-foreground">{meetings.length}</span>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              {meetings.length === 0 ? (
                <div className="flex flex-col gap-1 py-4 text-center">
                  <p className="text-sm font-medium">No meetings ahead.</p>
                  <p className="text-xs text-muted-foreground">The calendar is quiet.</p>
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                  {meetings.map((meeting) => (
                    <li
                      key={meeting.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-sm">{meeting.title}</span>
                      <time
                        dateTime={meeting.startsAt.toISOString()}
                        className="shrink-0 font-mono text-xs text-muted-foreground"
                      >
                        {format(meeting.startsAt, 'EEE, MMM d · h:mm a')}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
