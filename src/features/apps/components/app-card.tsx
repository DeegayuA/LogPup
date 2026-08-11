import Link from 'next/link'
import { differenceInCalendarDays, format } from 'date-fns'
import { CalendarClock, CalendarDays, ListChecks, SquareKanban } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
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

// Left-edge accent so a card's status reads at a glance across the grid, not
// only from the chip in its corner.
const STATUS_ACCENT: Record<AppWithMembers['status'], string> = {
  active: 'border-l-primary',
  paused: 'border-l-chart-1',
  archived: 'border-l-muted-foreground/40',
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
  const lead = app.leadId ? app.members.find((m) => m.userId === app.leadId) : undefined

  const { tasks: t, activeSprint, sprintCount, meetingCount } = app.stats
  const donePct = t.total > 0 ? (t.done / t.total) * 100 : 0
  const inProgressPct = t.total > 0 ? (t.in_progress / t.total) * 100 : 0
  const deadlineDate = activeSprint ? new Date(`${activeSprint.endDate}T12:00:00`) : null
  const daysLeft = deadlineDate ? differenceInCalendarDays(deadlineDate, new Date()) : null
  const deadlineSoon = daysLeft !== null && daysLeft <= 3

  return (
    <Link
      href={`/apps/${app.slug}`}
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className={`h-full border-l-2 ${STATUS_ACCENT[app.status]} transition-[transform,box-shadow] duration-150 ease-out group-hover:-translate-y-0.5 group-hover:ring-ring/40 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0`}>
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

          {/* Task progress — a mini stacked bar (done / in-progress / todo). */}
          {t.total > 0 ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t.done}/{t.total} tasks done</span>
                <span className="font-mono text-muted-foreground">{Math.round(donePct)}%</span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="bg-primary" style={{ width: `${donePct}%` }} />
                <div className="bg-chart-1" style={{ width: `${inProgressPct}%` }} />
              </div>
            </div>
          ) : null}

          {/* Deadline — the soonest-closing active sprint. */}
          {activeSprint && deadlineDate ? (
            <div className="flex items-center gap-1.5 text-xs">
              <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate text-muted-foreground">{activeSprint.name} · ends</span>
              <span
                className={cn('shrink-0 font-medium', deadlineSoon ? 'text-destructive' : 'text-foreground')}
              >
                {format(deadlineDate, 'MMM d')}
                {daysLeft !== null && daysLeft >= 0 ? ` · ${daysLeft}d left` : ' · overdue'}
              </span>
            </div>
          ) : null}

          {/* At-a-glance counts. */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1" title="Sprints">
              <SquareKanban className="size-3.5" aria-hidden /> {sprintCount}
            </span>
            <span className="flex items-center gap-1" title="Open tasks">
              <ListChecks className="size-3.5" aria-hidden /> {t.todo + t.in_progress} open
            </span>
            <span className="flex items-center gap-1" title="Meetings">
              <CalendarDays className="size-3.5" aria-hidden /> {meetingCount}
            </span>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            {visibleMembers.length > 0 ? (
              <AvatarGroup className="*:data-[slot=avatar]:ring-card">
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
            ) : (
              <span />
            )}
            {lead ? (
              <span className="truncate text-xs text-muted-foreground">
                Lead · <span className="font-medium text-foreground">{lead.name}</span>
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
