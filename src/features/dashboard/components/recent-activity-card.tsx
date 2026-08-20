import Link from 'next/link'
import { History, PawPrint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
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
        <CardTitle as="h3" className="flex items-center gap-2">
          <History className="size-4" aria-hidden /> Recent activity
        </CardTitle>
        <CardAction>
          <Link
            href="/activity"
            className="rounded-sm text-xs font-medium text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            View all →
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title="Nothing tracked yet."
            description="Every change anyone makes shows up here from now on."
            action={
              <Button variant="outline" size="sm" render={<Link href="/apps" />}>
                Go to apps
              </Button>
            }
          />
        ) : (
          <ActivityFeed rows={rows} now={now} />
        )}
      </CardContent>
    </Card>
  )
}
