import Link from 'next/link'
import { StatNumber } from '@/components/animate-ui/stat-number'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { UserCapacity } from '@/features/people/queries'
import { cn } from '@/lib/utils'

/**
 * Chrome shared by the read-only capacity list (server-rendered) and the
 * admin's editable one (client). No directive and no server-only imports, so
 * it can be pulled into either — which is what keeps the two lists visually
 * identical instead of drifting apart as one of them gets edited.
 */

export const capacityLinkClass =
  'rounded-sm underline-offset-2 transition-colors duration-150 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

export function CapacityCard({
  title = 'Team capacity',
  description,
  count,
  overCount,
  children,
}: {
  title?: string
  description?: string
  count: number
  overCount: number
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {count > 0 ? (
          <CardAction>
            <span
              className={cn(
                'font-mono text-xs tabular-nums',
                overCount > 0 ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              {overCount > 0 ? (
                <>
                  <StatNumber value={overCount} /> over
                </>
              ) : (
                <>
                  <StatNumber value={count} /> {count === 1 ? 'person' : 'people'}
                </>
              )}
            </span>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function CapacityEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1 py-4 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

/** Avatar + linked name + the "Over" badge — identical in both lists. */
export function PersonHeading({ person }: { person: UserCapacity }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/people/${person.user.id}`}
        className={cn('truncate text-sm font-medium', capacityLinkClass)}
      >
        {person.user.name}
      </Link>
      {person.overallocated ? <Badge variant="destructive">Over</Badge> : null}
    </div>
  )
}

export function PersonAvatar({ person }: { person: UserCapacity }) {
  return (
    <Avatar>
      {person.user.avatarUrl ? (
        <AvatarImage src={person.user.avatarUrl} alt={person.user.name} />
      ) : null}
      <AvatarFallback>{person.user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
