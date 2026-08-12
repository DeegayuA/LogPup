import { format, formatDistanceToNowStrict } from 'date-fns'
import { CalendarDays, ListChecks, MessageSquare, UserRoundCog } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'
import { parseCalendarDate } from '@/features/apps/app-health'
import {
  groupActivityByDay,
  relativeDayLabel,
  type AppActivityItem,
  type AppActivityKind,
} from '@/features/apps/activity'

const KIND_ICON: Record<AppActivityKind, typeof MessageSquare> = {
  comment: MessageSquare,
  task: ListChecks,
  meeting: CalendarDays,
  assignment: UserRoundCog,
}

const KIND_LABEL: Record<AppActivityKind, string> = {
  comment: 'Comment',
  task: 'Task',
  meeting: 'Meeting',
  assignment: 'Team change',
}

/** `relativeDayLabel` (activity.ts, tested) decides Today/Yesterday from two
 *  Colombo ISO dates; only the fallback formatting belongs in the view. */
function dayLabel(day: string, today: string): string {
  return relativeDayLabel(day, today) ?? format(parseCalendarDate(day), 'EEEE, MMMM d')
}

/**
 * "What changed on this app recently", merged from comments, tasks, meetings
 * and allocation history.
 *
 * Grouped by day rather than shown as one flat stream: a bare list of
 * relative timestamps ("2 days ago", "2 days ago", "3 days ago") makes the
 * rhythm of a project invisible, and the rhythm is the thing you are actually
 * looking for — three days of nothing followed by a burst reads instantly
 * once the days are headings.
 *
 * Day boundaries are computed in Colombo time, matching every other date in
 * the product; the server's own midnight would put a late-evening comment
 * under the wrong heading.
 */
export function AppActivity({
  items,
  emptyHint,
  today,
}: {
  items: AppActivityItem[]
  emptyHint: string
  /** Colombo-local `yyyy-mm-dd`, passed down from the page so every date on
   *  the screen answers "what day is it" the same way. */
  today: string
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="font-heading font-semibold">Nothing has happened here yet.</p>
        <p className="max-w-sm text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    )
  }

  const groups = groupActivityByDay(items, (date) => toIsoDateInTimeZone(date, LK_TIMEZONE))

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.day} className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {dayLabel(group.day, today)}
          </h3>
          <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
            {group.items.map((item) => {
              const Icon = KIND_ICON[item.kind]
              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                  {item.actorName ? (
                    <Avatar size="sm" className="mt-0.5 shrink-0">
                      {item.actorAvatarUrl ? (
                        <AvatarImage src={item.actorAvatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback>
                        {item.actorName.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="size-3 text-muted-foreground" aria-hidden />
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-sm">
                      <span className="sr-only">{KIND_LABEL[item.kind]}: </span>
                      {item.title}
                    </p>
                    {item.detail ? (
                      <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                    ) : null}
                  </div>
                  <time
                    dateTime={item.at.toISOString()}
                    className="shrink-0 font-mono text-2xs text-muted-foreground tabular-nums"
                    title={format(item.at, "MMM d, yyyy 'at' HH:mm")}
                  >
                    {formatDistanceToNowStrict(item.at, { addSuffix: true })}
                  </time>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
