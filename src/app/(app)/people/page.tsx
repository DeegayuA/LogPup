import Link from 'next/link'
import { PawPrint, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { StatNumber } from '@/components/animate-ui/stat-number'
import { getUserCapacities } from '@/features/people/queries'
import { PeopleDirectory } from '@/features/people/components/directory'

function EmptyState({ q }: { q?: string }) {
  if (q) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
        <div className="flex flex-col gap-1">
          <p className="font-heading font-semibold">No one matches your search.</p>
          <p className="text-sm text-muted-foreground">Try ⌘K — it fetches apps and tasks too.</p>
        </div>
        <Button variant="outline" size="sm" render={<Link href="/people" />}>
          Clear search
        </Button>
      </div>
    )
  }
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

export default async function PeoplePage(props: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await props.searchParams
  const people = await getUserCapacities(q)

  const assigned = people.filter((p) => p.breakdown.length > 0).length
  const over = people.filter((p) => p.overallocated).length
  const avgLoad =
    people.length > 0
      ? Math.round(people.reduce((sum, p) => sum + p.totalPct, 0) / people.length)
      : 0

  const stats = [
    { label: 'People', value: people.length },
    { label: 'Assigned', value: assigned },
    { label: 'Over capacity', value: over, alert: over > 0 },
    { label: 'Avg load %', value: avgLoad },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight">People</h1>
            <p className="text-sm text-muted-foreground">
              Who&apos;s on what, and how much room they have left.
            </p>
          </div>
          <form method="GET" className="w-full max-w-xs">
            <InputGroup>
              <InputGroupAddon>
                <Search aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                name="q"
                placeholder="Filter by name…"
                defaultValue={q ?? ''}
                aria-label="Filter people by name"
              />
            </InputGroup>
          </form>
        </div>

        {people.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5 rounded-xl border bg-card p-3">
                <span
                  className={`font-mono text-xl font-semibold ${stat.alert ? 'text-destructive' : ''}`}
                >
                  <StatNumber value={stat.value} />
                </span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {people.length === 0 ? <EmptyState q={q} /> : <PeopleDirectory people={people} />}
    </div>
  )
}
