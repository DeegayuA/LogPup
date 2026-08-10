import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CapacityBar } from '@/features/people/components/capacity-bar'
import type { UserCapacity } from '@/features/people/queries'
import { sortCapacities } from '@/features/dashboard/sort-capacities'

/**
 * Server-safe: no client-only APIs, so it can render directly from the
 * dashboard server component. Rows sorted overallocated-first, then by
 * totalPct descending, so the people who need attention float to the top.
 */
export function CapacityHeat({ capacities }: { capacities: UserCapacity[] }) {
  const sorted = sortCapacities(capacities)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team capacity</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="flex flex-col gap-1 py-4 text-center">
            <p className="text-sm text-muted-foreground">No team members yet</p>
            <p className="text-xs text-muted-foreground">
              Add people and assign them to apps to see capacity here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {sorted.map((person) => (
              <li key={person.user.id} className="relative isolate">
                <Link
                  href={`/people/${person.user.id}`}
                  className="absolute inset-0 z-0"
                  aria-label={`View ${person.user.name}`}
                />
                <div className="flex items-center gap-3">
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
                      <span className="truncate font-medium">{person.user.name}</span>
                      {person.overallocated ? (
                        <Badge variant="destructive">Over</Badge>
                      ) : null}
                    </div>
                    {person.breakdown.length > 0 ? (
                      <div className="relative z-10 flex flex-wrap gap-1.5">
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
