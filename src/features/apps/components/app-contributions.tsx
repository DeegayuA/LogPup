import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, CircleDot, Sparkles, UsersRound } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ContactButtons } from '@/components/contact-buttons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AppContribution } from '@/features/apps/contribution-queries'

/** One number plus its unit, sharing a row's typography so a column can be scanned. */
function Stat({
  value,
  label,
  icon: Icon,
  tone,
}: {
  value: number
  label: string
  icon: typeof CheckCircle2
  tone?: 'success'
}) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Icon aria-hidden className={cn('size-3.5 shrink-0', tone === 'success' && 'text-success')} />
      <span className="font-mono tabular-nums text-foreground">{value}</span>
      <span>{label}</span>
    </span>
  )
}

/**
 * WHAT EACH MEMBER HAS ACTUALLY DONE ON THIS APP.
 *
 * Sits beneath the Team panel and settles the question that panel raises but
 * cannot answer. Team says "Ada, Backend, 40%" — an intention, agreed once and
 * true until someone edits it. This says what came of it: tasks closed, tasks
 * still open, logged actions, last seen.
 *
 * Two deliberate choices:
 *
 * - **Idle members are shown, not hidden.** Someone allocated 40% who has done
 *   nothing here is the most useful row on the panel. Ranking them last (see
 *   rankContributors) surfaces that without an accusatory treatment: the row
 *   is dimmed and says "No activity yet" in words, because a bare set of
 *   zeroes reads as a loading state and a dimmed row alone says nothing at all
 *   to a screen reader.
 * - **These counts are not a score.** Plain units — "done", "open", "actions"
 *   — with no total, no rank number and no leaderboard framing. A closed task
 *   and a logged action are not comparable quantities, and combining them
 *   would invent a precision the data does not have.
 *
 * The history behind the numbers is the app's own Recent activity feed
 * (getAppActivity), already on this page: same trail, so the two cannot
 * disagree.
 */
export function AppContributions({
  contributions,
  appName,
}: {
  contributions: AppContribution[]
  /** Prefills the WhatsApp message with which project this is about. */
  appName?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersRound className="size-4" aria-hidden /> Contribution
        </CardTitle>
        <CardDescription>
          What each member has done on this app, counted from the same activity trail as the
          feed below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {contributions.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <Sparkles className="size-5 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">Nothing to measure yet.</p>
            <p className="text-xs text-muted-foreground">
              Assign someone to this app and their work shows up here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {contributions.map((person) => {
              const idle =
                person.actions === 0 && person.tasksDone === 0 && person.tasksOpen === 0
              return (
                <li
                  key={person.userId}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0',
                    idle && 'opacity-60',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar size="sm">
                      {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt="" /> : null}
                      <AvatarFallback>{person.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <Link
                        href={`/people/${person.userId}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {person.name}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">
                        {person.role} ·{' '}
                        <span className="font-mono tabular-nums">{person.allocationPct}%</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stat value={person.tasksDone} label="done" icon={CheckCircle2} tone="success" />
                    <Stat value={person.tasksOpen} label="open" icon={CircleDot} />
                    <Stat value={person.actions} label="actions" icon={Sparkles} />
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {person.lastActiveAt ? (
                        <time dateTime={person.lastActiveAt.toISOString()}>
                          {formatDistanceToNow(person.lastActiveAt, { addSuffix: true })}
                        </time>
                      ) : (
                        'No activity yet'
                      )}
                    </span>
                    <ContactButtons name={person.name} phone={person.phone} context={appName} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
