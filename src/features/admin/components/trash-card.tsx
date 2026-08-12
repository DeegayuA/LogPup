import { format, formatDistanceToNowStrict } from 'date-fns'
import { InboxIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { TrashGroup, TrashKind, TrashRow } from '@/features/admin/trash-grouping'
import { orderGroupsForDisplay, trashCountFootnote, TRASH_GROUP_TITLES } from './trash-card-logic'
import { TrashRowActions } from './trash-row-actions'

/**
 * One trashed row. The label already carries everything a segment/keyframe
 * needs to read as nested under its meeting ("a note segment in Standup") —
 * trash-grouping.ts bakes that in (see its file header on the neutral-label
 * rule), so this stays a flat row rather than a second layout for those two
 * kinds. Never renders segment/keyframe CONTENT — only what trash-grouping.ts
 * already reduced the row to.
 */
function TrashRowItem({ kind, row }: { kind: TrashKind; row: TrashRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{row.label}</span>
        {row.context ? (
          <span className="truncate text-xs text-muted-foreground">{row.context}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            {row.deletedByAvatarUrl ? <AvatarImage src={row.deletedByAvatarUrl} alt="" /> : null}
            <AvatarFallback>{(row.deletedByName ?? '?').slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span>{row.deletedByName ?? 'Unknown'}</span>
        </div>
        <time
          dateTime={row.deletedAt.toISOString()}
          className="font-mono tabular-nums"
          title={format(row.deletedAt, "MMM d, yyyy 'at' HH:mm")}
        >
          {formatDistanceToNowStrict(row.deletedAt, { addSuffix: true })}
        </time>
      </div>

      <TrashRowActions kind={kind} id={row.id} parentTrashed={row.parentTrashed} />
    </li>
  )
}

function TrashGroupSection({ group }: { group: TrashGroup }) {
  if (group.rows.length === 0) return null
  const footnote = trashCountFootnote(group.rows.length, group.totalCount)

  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {TRASH_GROUP_TITLES[group.kind]}
        <Badge variant="secondary">{group.rows.length}</Badge>
      </h3>
      <ul className="flex flex-col gap-2">
        {group.rows.map((row) => (
          <TrashRowItem key={row.id} kind={group.kind} row={row} />
        ))}
      </ul>
      {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}
    </section>
  )
}

/**
 * The admin Trash card — server component fed by getTrash() from the
 * page's Promise.all (never fetched separately, per the admin page's
 * existing bounded-data-loading pattern). Groups render in
 * TRASH_GROUP_ORDER; each row's Restore/"Delete forever" controls live in
 * TrashRowActions, the client leaf this stays a thin renderer around.
 */
export function TrashCard({ groups }: { groups: TrashGroup[] }) {
  const ordered = orderGroupsForDisplay(groups)
  const isEmpty = ordered.every((group) => group.rows.length === 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trash</CardTitle>
        <CardDescription>
          Soft-deleted items, most recent first. Restore brings something back exactly as
          it was; &quot;Delete forever&quot; removes it — and its stored files — for good.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {isEmpty ? (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <InboxIcon className="size-5 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">Nothing in the trash.</p>
          </div>
        ) : (
          ordered.map((group) => <TrashGroupSection key={group.kind} group={group} />)
        )}

        <p className="text-xs text-muted-foreground">
          Deactivated users and archived apps aren&apos;t listed here — those are live
          lifecycle states, not deletions, and stay under the Users and Apps cards above.
        </p>
      </CardContent>
    </Card>
  )
}
