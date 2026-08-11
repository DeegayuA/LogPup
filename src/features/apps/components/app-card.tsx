import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar'
import type { AppWithMembers } from '@/features/apps/queries'

const STATUS_DOT: Record<AppWithMembers['status'], string> = {
  active: 'bg-primary',
  paused: 'bg-chart-1',
  archived: 'bg-muted-foreground/60',
}

const STATUS_LABEL: Record<AppWithMembers['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

const MAX_TAGS = 4
const MAX_AVATARS = 4

export function AppCard({ app }: { app: AppWithMembers }) {
  const visibleTags = app.techTags.slice(0, MAX_TAGS)
  const extraTags = app.techTags.length - visibleTags.length

  // Lead first in the stack when they are among the members
  const members = app.leadId
    ? [...app.members].sort((a, b) =>
        a.userId === app.leadId ? -1 : b.userId === app.leadId ? 1 : 0
      )
    : app.members
  const visibleMembers = members.slice(0, MAX_AVATARS)
  const extraMembers = members.length - visibleMembers.length

  return (
    <Link
      href={`/apps/${app.slug}`}
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full transition-[transform,box-shadow] duration-150 ease-out group-hover:-translate-y-0.5 group-hover:ring-ring/40 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <CardHeader>
          <CardTitle className="font-heading font-semibold">{app.name}</CardTitle>
          <CardDescription className="font-mono text-xs">{app.slug}</CardDescription>
          <CardAction>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              <span aria-hidden className={`size-1.5 rounded-full ${STATUS_DOT[app.status]}`} />
              {STATUS_LABEL[app.status]}
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          {app.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{app.description}</p>
          ) : null}
          {visibleTags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {visibleTags.map((tag) => (
                <Badge key={tag} variant="outline" className="font-normal text-muted-foreground">
                  {tag}
                </Badge>
              ))}
              {extraTags > 0 ? (
                <Badge variant="outline" className="font-mono font-normal text-muted-foreground">
                  +{extraTags}
                </Badge>
              ) : null}
            </div>
          ) : null}
          {visibleMembers.length > 0 ? (
            <AvatarGroup className="mt-auto pt-1 *:data-[slot=avatar]:ring-card">
              {visibleMembers.map((member) => (
                <Avatar key={member.userId} size="sm" title={member.name}>
                  {member.avatarUrl ? (
                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                  ) : null}
                  <AvatarFallback>{member.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  {member.userId === app.leadId ? (
                    <AvatarBadge title="Lead">
                      <span className="sr-only">Lead</span>
                    </AvatarBadge>
                  ) : null}
                </Avatar>
              ))}
              {extraMembers > 0 ? (
                <AvatarGroupCount className="font-mono text-xs ring-card group-has-data-[size=sm]/avatar-group:size-6">
                  +{extraMembers}
                </AvatarGroupCount>
              ) : null}
            </AvatarGroup>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  )
}
