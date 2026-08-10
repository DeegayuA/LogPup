import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage, AvatarGroup } from '@/components/ui/avatar'
import type { AppWithMembers } from '@/features/apps/queries'

const STATUS_VARIANT = {
  active: 'default',
  paused: 'outline',
  archived: 'secondary',
} as const

const STATUS_LABEL: Record<AppWithMembers['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

export function AppCard({ app }: { app: AppWithMembers }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{app.name}</CardTitle>
        <CardAction>
          <Badge variant={STATUS_VARIANT[app.status]}>{STATUS_LABEL[app.status]}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {app.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{app.description}</p>
        ) : null}
        {app.techTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {app.techTags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
        {app.members.length > 0 ? (
          <AvatarGroup>
            {app.members.map((member) => (
              <Avatar key={member.userId} size="sm">
                {member.avatarUrl ? (
                  <AvatarImage src={member.avatarUrl} alt={member.name} />
                ) : null}
                <AvatarFallback>{member.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
            ))}
          </AvatarGroup>
        ) : null}
      </CardContent>
    </Card>
  )
}
