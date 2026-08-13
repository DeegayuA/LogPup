import Link from 'next/link'
import { format } from 'date-fns'
import { Landmark } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AppRoleKind } from '@/features/apps/role-history'
import type { PersonAppRoleEntry } from '@/features/people/queries'

const linkClass =
  'rounded-sm underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

const ROLE_LABEL: Record<AppRoleKind, string> = { pm: 'PM', lead: 'Lead' }
const ROLE_DOT: Record<AppRoleKind, string> = { pm: 'bg-primary', lead: 'bg-chart-1' }

/**
 * "Who did which project, and when" from the person's side — every app this
 * person has been PM or lead of, newest first. Sits alongside
 * AllocationHistoryCard on the person page: that card answers "how much of
 * their time went where", this one answers "what were they in charge of".
 *
 * A backfilled row says so in plain language rather than presenting an
 * assumed date as an observed fact — see BACKFILLED_APP_ROLE_NOTE in
 * features/apps/role-history.ts.
 */
export function PersonAppRoleHistoryCard({ history }: { history: PersonAppRoleEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project roles</CardTitle>
        {history.length > 0 ? (
          <CardAction>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {history.length} {history.length === 1 ? 'entry' : 'entries'}
            </span>
          </CardAction>
        ) : null}
      </CardHeader>
      {history.length === 0 ? (
        <CardContent className="flex flex-col items-center gap-1.5 py-4 text-center">
          <Landmark className="size-5 text-muted-foreground/60" aria-hidden />
          <p className="text-sm font-medium">No PM or lead roles recorded.</p>
          <p className="text-xs text-muted-foreground">
            Apps they manage or lead will show up here with when it started.
          </p>
        </CardContent>
      ) : (
        <CardContent>
          <ol className="flex flex-col divide-y divide-border">
            {history.map((entry) => (
              <li key={entry.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', ROLE_DOT[entry.role])}
                  aria-hidden
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <Link href={`/apps/${entry.slug}`} className={cn('truncate text-sm font-medium', linkClass)}>
                      {entry.appName}
                    </Link>
                    <Badge variant="secondary" className="text-[10px]">
                      {ROLE_LABEL[entry.role]}
                    </Badge>
                    {entry.effectiveTo === null ? (
                      <Badge variant="outline" className="text-[10px]">
                        Current
                      </Badge>
                    ) : null}
                  </div>
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    <time dateTime={entry.effectiveFrom.toISOString()}>
                      {format(entry.effectiveFrom, 'MMM d, yyyy')}
                    </time>
                    {' – '}
                    {entry.effectiveTo ? (
                      <time dateTime={entry.effectiveTo.toISOString()}>
                        {format(entry.effectiveTo, 'MMM d, yyyy')}
                      </time>
                    ) : (
                      'now'
                    )}
                  </p>
                  <p className="text-2xs text-muted-foreground/80">
                    {entry.backfilled
                      ? 'Assumed at migration time — not an observed change'
                      : `Set by ${entry.changedByName ?? 'Unknown user'}`}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
  )
}
