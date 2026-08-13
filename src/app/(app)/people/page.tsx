import Link from 'next/link'
import { History, PawPrint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPeopleNow, getUserCapacities } from '@/features/people/queries'
import { PeopleDirectory } from '@/features/people/components/directory'
import { LK_TIMEZONE, toIsoDateInTimeZone } from '@/lib/lk-holidays'

// Only the "nobody exists yet" case lives here now — an empty *search* result
// is rendered by PeopleDirectory, which owns the query text.
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
      <PawPrint className="size-8 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-heading font-semibold">Nobody in the pack yet.</p>
        <p className="text-sm text-muted-foreground">
          Teammates appear here once they join the workspace.
        </p>
      </div>
    </div>
  )
}

export default async function PeoplePage() {
  // Everyone is loaded once; the name filter is client-side inside
  // PeopleDirectory so it narrows on every keystroke instead of needing a
  // form submit and a server round trip per search.
  const people = await getUserCapacities()
  // Two more queries for the whole page, not two per person — getPeopleNow is
  // batched precisely because this list grows with the workspace.
  const now = await getPeopleNow(people.map((person) => person.user.id))
  // Resolved here, in the business timezone, so no row calls `new Date()` and
  // every "overdue" on the page agrees about which day it is.
  const todayIso = toIsoDateInTimeZone(new Date(), LK_TIMEZONE)

  // The stat strip lives inside PeopleDirectory — it has to count the rows the
  // org filter actually leaves on screen, not every search result.
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight">People</h1>
            <p className="text-sm text-muted-foreground">
              What everyone is working on right now, what they have been doing, and how much
              room they have left.
            </p>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/people/history" />}>
            <History aria-hidden /> Capacity history
          </Button>
        </div>
      </div>

      {people.length === 0 ? (
        <EmptyState />
      ) : (
        <PeopleDirectory people={people} now={now} todayIso={todayIso} />
      )}
    </div>
  )
}
