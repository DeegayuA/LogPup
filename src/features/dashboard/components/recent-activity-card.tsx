import Link from 'next/link'
import { History, PawPrint } from 'lucide-react'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ActivityFeed } from '@/features/activity/components/activity-feed'
import type { ActivityRow } from '@/features/activity/types'

/**
 * The dashboard's window onto the trail: latest handful, flat list, time-ago.
 * The full, filterable backtrack lives at /activity — this card's header
 * links there instead of growing its own controls.
 */
export function RecentActivityCard({ rows, now }: { rows: ActivityRow[]; now: Date }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" aria-hidden /> Recent activity
        </CardTitle>
        <CardAction>
          <Link
            href="/activity"
            className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            View all →
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <PawPrint className="size-5 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">Nothing tracked yet.</p>
            <p className="text-xs text-muted-foreground">
              Every change anyone makes shows up here from now on.
            </p>
          </div>
        ) : (
          <ActivityFeed rows={rows} now={now} />
        )}
      </CardContent>
    </Card>
  )
}
