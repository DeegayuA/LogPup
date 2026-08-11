import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CapacityBar } from '@/features/people/components/capacity-bar'
import type { UserCapacity } from '@/features/people/queries'

const MAX_CHIPS = 3

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

export function PersonCard({ person }: { person: UserCapacity }) {
  const { user, totalPct, breakdown } = person
  const topApps = [...breakdown]
    .sort((a, b) => b.allocationPct - a.allocationPct)
    .slice(0, MAX_CHIPS)
  const moreCount = breakdown.length - topApps.length

  return (
    <Card className="relative isolate transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:ring-ring/40 has-[>a:focus-visible]:ring-2 has-[>a:focus-visible]:ring-ring/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      {/* Stretched link: makes the whole card navigable to /people/[id] without
          nesting an <a> inside the app-chip <a> tags below (invalid HTML). The
          chips sit in a `relative z-10` wrapper so they intercept clicks first. */}
      <Link
        href={`/people/${user.id}`}
        className="absolute inset-0 z-0 rounded-xl outline-none"
        aria-label={`View ${user.name}`}
      />
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
            <AvatarFallback className="font-medium">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-heading font-semibold">{user.name}</span>
            {user.title ? (
              <span className="truncate text-xs text-muted-foreground">{user.title}</span>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <CapacityBar totalPct={totalPct} />
        {breakdown.length > 0 ? (
          <div className="relative z-10 flex flex-wrap gap-1.5">
            {topApps.map((entry) => (
              <Badge
                key={entry.appId}
                variant="secondary"
                render={<Link href={`/apps/${entry.slug}`} />}
              >
                {entry.appName}
                <span className="font-mono text-muted-foreground">{entry.allocationPct}%</span>
              </Badge>
            ))}
            {moreCount > 0 ? (
              <Badge variant="outline" className="text-muted-foreground">
                <span className="font-mono">+{moreCount}</span> more
              </Badge>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No app assignments yet</p>
        )}
      </CardContent>
    </Card>
  )
}
