import Link from 'next/link'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getPersonDetail } from '@/features/people/queries'
import { CapacityBar } from '@/features/people/components/capacity-bar'

const TASK_STATUS_ORDER = ['todo', 'in_progress', 'done'] as const

const TASK_STATUS_LABEL: Record<(typeof TASK_STATUS_ORDER)[number], string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

export default async function PersonDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const person = await getPersonDetail(id)
  if (!person) notFound()

  const { user, totalPct, breakdown, tasks, meetings } = person

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
            <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <h1 className="font-heading text-xl font-medium">{user.name}</h1>
            <span className="text-sm text-muted-foreground">
              {[user.title, user.email].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
        <div className="w-full sm:max-w-48">
          <CapacityBar totalPct={totalPct} />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium">Allocation breakdown</h2>
        {breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No app assignments.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {breakdown.map((entry) => (
              <div
                key={entry.appId}
                className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
              >
                <Link href={`/apps/${entry.slug}`} className="flex-1 text-sm font-medium hover:underline">
                  {entry.appName}
                </Link>
                <span className="text-xs text-muted-foreground">{entry.role}</span>
                <div className="sm:w-40">
                  <CapacityBar totalPct={entry.allocationPct} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium">Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks assigned.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {TASK_STATUS_ORDER.map((status) => {
              const items = tasks.filter((task) => task.status === status)
              if (items.length === 0) return null
              return (
                <div key={status} className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {TASK_STATUS_LABEL[status]}
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {items.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span>{task.title}</span>
                        <Link
                          href={`/apps/${task.appSlug}`}
                          className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {task.appName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium">Upcoming meetings</h2>
        {meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {meetings.map((meeting) => (
              <li
                key={meeting.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>{meeting.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(meeting.startsAt, 'MMM d, yyyy · h:mm a')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
