import { format } from 'date-fns'
import { History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AppRoleKind } from '@/features/apps/role-history'
import type { AppRoleHistoryEntry } from '@/features/apps/queries'

const ROLE_LABEL: Record<AppRoleKind, string> = { pm: 'PM', lead: 'Lead' }

// A distinct dot per role, same idea as AllocationHistoryCard's per-kind dot
// — cheap visual grouping in a list that otherwise reads as one undifferentiated
// column of names and dates.
const ROLE_DOT: Record<AppRoleKind, string> = { pm: 'bg-primary', lead: 'bg-chart-1' }

/**
 * Per-app PM/lead history: every holder of either role, newest first, with
 * who set them and when. Lives on the Settings tab, directly under the form
 * that edits PM/lead — the answer to "who was PM/lead of this app, and when"
 * sits right next to where that fact is changed.
 *
 * A backfilled row says so in plain language rather than presenting an
 * assumed date as an observed fact — see BACKFILLED_APP_ROLE_NOTE in
 * features/apps/role-history.ts for why that distinction exists at all.
 */
export function AppRoleHistoryCard({ history }: { history: AppRoleHistoryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">PM &amp; lead history</CardTitle>
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
          <History className="size-5 text-muted-foreground/60" aria-hidden />
          <p className="text-sm font-medium">No history recorded yet.</p>
          <p className="text-xs text-muted-foreground">
            PM and lead changes will show up here with who made them.
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
                    <span className="truncate text-sm font-medium">
                      {entry.userName ?? 'Unknown user'}
                    </span>
                    <Badge variant="secondary" className="text-2xs">
                      {ROLE_LABEL[entry.role]}
                    </Badge>
                    {entry.effectiveTo === null ? (
                      <Badge variant="outline" className="text-2xs">
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
