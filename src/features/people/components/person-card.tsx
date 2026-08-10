import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CapacityBar } from '@/features/people/components/capacity-bar'
import type { UserCapacity } from '@/features/people/queries'

export function PersonCard({ person }: { person: UserCapacity }) {
  const { user, totalPct, breakdown } = person

  return (
    <Card className="relative isolate transition-colors hover:ring-foreground/20">
      {/* Stretched link: makes the whole card navigable to /people/[id] without
          nesting an <a> inside the app-chip <a> tags below (invalid HTML). The
          chips sit in a `relative z-10` wrapper so they intercept clicks first. */}
      <Link
        href={`/people/${user.id}`}
        className="absolute inset-0 z-0"
        aria-label={`View ${user.name}`}
      />
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar>
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
            <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{user.name}</span>
            {user.title ? (
              <span className="text-xs text-muted-foreground">{user.title}</span>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <CapacityBar totalPct={totalPct} />
        {breakdown.length > 0 ? (
          <div className="relative z-10 flex flex-wrap gap-1.5">
            {breakdown.map((entry) => (
              <Badge
                key={entry.appId}
                variant="secondary"
                render={<Link href={`/apps/${entry.slug}`} />}
              >
                {entry.appName}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No app assignments</p>
        )}
      </CardContent>
    </Card>
  )
}
