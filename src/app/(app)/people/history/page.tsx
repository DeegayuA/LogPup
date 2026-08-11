import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTeamCapacityAsOf } from '@/features/people/queries'
import { resolveAsOf } from '@/features/people/as-of-date'
import { AsOfPicker } from '@/features/people/components/as-of-picker'
import { CapacityHeat } from '@/features/dashboard/components/capacity-heat'

/**
 * Team capacity as it stood on a chosen day, rendered by the SAME capacity
 * list the dashboard uses — read-only, because a past interval is not
 * something the edit actions can target (getTeamCapacityAsOf returns a null
 * assignmentId for every entry, and the read-only path never ships the
 * mutation code at all).
 */
export default async function TeamCapacityHistoryPage(props: {
  searchParams: Promise<{ at?: string }>
}) {
  const { at } = await props.searchParams
  const asOf = resolveAsOf(at)
  const capacities = await getTeamCapacityAsOf(asOf.at)

  // Formatted from the resolved DAY, not from the instant: `asOf.at` is
  // 23:59:59.999 Asia/Colombo, and date-fns formats in the *server's* zone, so
  // running anywhere east of Colombo would print the following day right here
  // while the picker below still read the day the user asked for. Midday keeps
  // it away from either boundary.
  const stamp = format(new Date(`${asOf.iso}T12:00:00`), 'EEEE, MMMM d, yyyy')

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight">Capacity history</h1>
            <p className="text-sm text-muted-foreground">
              {asOf.isToday
                ? 'Today’s team load. Pick a past date to see how it looked then.'
                : `How the team was loaded on ${stamp}.`}
            </p>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/people" />}>
            <ArrowLeft aria-hidden /> People
          </Button>
        </div>

        {asOf.invalid ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            That date couldn’t be read, so today is shown instead.
          </p>
        ) : null}

        <AsOfPicker iso={asOf.iso} isToday={asOf.isToday} />
      </div>

      <div className="max-w-2xl">
        <CapacityHeat
          capacities={capacities}
          title={asOf.isToday ? 'Team capacity — now' : `Team capacity — ${asOf.iso}`}
          description={
            asOf.isToday
              ? 'Live allocations.'
              : 'Reconstructed from allocation history. People are today’s roster; only the allocations are historical.'
          }
          emptyTitle="Nobody in the pack yet."
          emptyHint="Once people are assigned to apps, their history shows up here."
        />
      </div>
    </div>
  )
}
