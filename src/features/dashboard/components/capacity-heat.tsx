import Link from 'next/link'
import { StatNumber } from '@/components/animate-ui/stat-number'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CapacityBar } from '@/features/people/components/capacity-bar'
import type { UserCapacity } from '@/features/people/queries'
import { sortCapacities } from '@/features/dashboard/sort-capacities'
import { cn } from '@/lib/utils'

const linkClass =
  'rounded-sm underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

/**
 * Server-safe: no client-only APIs, so it can render directly from the
 * dashboard server component. Rows sorted overallocated-first, then by
 * totalPct descending, so the people who need attention float to the top.
 */
export function CapacityHeat({ capacities }: { capacities: UserCapacity[] }) {
  const sorted = sortCapacities(capacities)
  const overCount = sorted.filter((person) => person.overallocated).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team capacity</CardTitle>
        {sorted.length > 0 ? (
          <CardAction>
            <span
              className={cn(
                'font-mono text-xs',
                overCount > 0 ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              {overCount > 0 ? (
                <>
                  <StatNumber value={overCount} /> over
                </>
              ) : (
                <>
                  <StatNumber value={sorted.length} />{' '}
                  {sorted.length === 1 ? 'person' : 'people'}
                </>
              )}
            </span>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="flex flex-col gap-1 py-4 text-center">
            <p className="text-sm font-medium">Nobody in the pack yet.</p>
            <p className="text-xs text-muted-foreground">
              Add people and assign them to apps to see capacity here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {sorted.map((person) => (
              <li
                key={person.user.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Avatar>
                  {person.user.avatarUrl ? (
                    <AvatarImage src={person.user.avatarUrl} alt={person.user.name} />
                  ) : null}
                  <AvatarFallback>
                    {person.user.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/people/${person.user.id}`}
                      className={cn('truncate text-sm font-medium', linkClass)}
                    >
                      {person.user.name}
                    </Link>
                    {person.overallocated ? (
                      <Badge variant="destructive">Over</Badge>
                    ) : null}
                  </div>
                  {person.breakdown.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {person.breakdown.map((entry) => (
                        <Badge key={entry.appId} variant="secondary" className="text-[10px]">
                          {entry.appName}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No app assignments</p>
                  )}
                  <CapacityBar totalPct={person.totalPct} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
