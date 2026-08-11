import Link from 'next/link'
import { PawPrint, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
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

  // The stat strip lives inside PeopleDirectory — it has to count the rows the
  // org filter actually leaves on screen, not every search result.
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
          {/* `type="text"`, not `type="search"` — the native × clears the field
              without submitting, which desyncs the box from the ?q= still
              filtering the list. The explicit Clear link always resets the URL. */}
          <form method="GET" className="flex w-full max-w-xs items-center gap-2">
            <InputGroup>
              <InputGroupAddon>
                <Search aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                name="q"
                placeholder="Filter by name — ⌘K fetches everything"
                defaultValue={q ?? ''}
                aria-label="Filter people by name"
              />
            </InputGroup>
            {q ? (
              <Button variant="ghost" size="sm" render={<Link href="/people" />}>
                Clear
              </Button>
            ) : null}
          </form>
        </div>
      </div>

      {people.length === 0 ? <EmptyState q={q} /> : <PeopleDirectory people={people} />}
    </div>
  )
}
