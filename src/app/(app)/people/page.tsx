import Link from 'next/link'
import { PawPrint, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { getUserCapacities } from '@/features/people/queries'
import { PersonCard } from '@/features/people/components/person-card'

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

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight">People</h1>
          <span className="font-mono text-sm text-muted-foreground">
            {people.length} {people.length === 1 ? 'person' : 'people'}
          </span>
        </div>
        <form method="GET" className="w-full max-w-sm">
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              name="q"
              placeholder="Filter by name — ⌘K fetches everything"
              defaultValue={q ?? ''}
              aria-label="Filter people by name"
            />
          </InputGroup>
        </form>
      </div>
      {people.length === 0 ? (
        <EmptyState q={q} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((person) => (
            <PersonCard key={person.user.id} person={person} />
          ))}
        </div>
      )}
    </div>
  )
}
