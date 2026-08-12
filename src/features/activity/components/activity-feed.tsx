import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { activityPhrase, groupActivityByDay } from '@/features/activity/format'
import type { ActivityRow } from '@/features/activity/types'

/**
 * The trail itself, shared by the dashboard's Recent-activity card (flat,
 * time-ago) and /activity (grouped by day, clock times). Server-rendered:
 * a log line never changes after the fact, so there is nothing here worth
 * shipping JavaScript for.
 *
 * Each row reads as a sentence — "Prabuddha moved task Fix login to In
 * progress" — with the entity label linking to `pagePath` when the write
 * recorded one. Rows for since-deleted entities simply lose their
 * destination (the trail's job is to remember, not to guarantee the page
 * still exists).
 */
function FeedRow({ row, timeLabel }: { row: ActivityRow; timeLabel: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Avatar size="sm" className="mt-0.5">
        {row.actorAvatarUrl ? <AvatarImage src={row.actorAvatarUrl} alt={row.actorName} /> : null}
        <AvatarFallback>{row.actorName.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm leading-snug">
          <span className="font-medium">{row.actorName}</span>{' '}
          <span className="text-muted-foreground">{activityPhrase(row)}</span>{' '}
          {row.pagePath ? (
            <Link href={row.pagePath} className="font-medium hover:underline">
              {row.entityLabel}
            </Link>
          ) : (
            <span className="font-medium">{row.entityLabel}</span>
          )}
          {row.detail ? <span className="text-muted-foreground"> {row.detail}</span> : null}
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{timeLabel}</span>
          {row.appName ? (
            <Badge variant="secondary" className="text-xs">
              {row.appName}
            </Badge>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function ActivityFeed({
  rows,
  now,
  grouped = false,
}: {
  rows: ActivityRow[]
  /** Passed in so server render and tests agree on what "ago" means. */
  now: Date
  /** Day-grouped with clock times (/activity) vs flat with time-ago (dashboard). */
  grouped?: boolean
}) {
  if (rows.length === 0) return null

  if (!grouped) {
    return (
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <FeedRow
            key={row.id}
            row={row}
            timeLabel={formatDistanceToNow(row.createdAt, { addSuffix: true })}
          />
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {groupActivityByDay(rows, now).map((group) => (
        <section key={group.dayIso} className="flex flex-col gap-1">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group.relativeLabel || format(new Date(`${group.dayIso}T00:00:00`), 'EEEE, MMMM d')}
          </h3>
          <ul className="flex flex-col divide-y divide-border">
            {group.rows.map((row) => (
              <FeedRow key={row.id} row={row} timeLabel={format(row.createdAt, 'h:mm a')} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
