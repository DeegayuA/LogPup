import { Input } from '@/components/ui/input'
import { getUserCapacities } from '@/features/people/queries'
import { PersonCard } from '@/features/people/components/person-card'

export default async function PeoplePage(props: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await props.searchParams
  const people = await getUserCapacities(q)

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-medium">People</h1>
      </div>
      <form method="GET" className="max-w-sm">
        <Input type="search" name="q" placeholder="Search by name…" defaultValue={q ?? ''} />
      </form>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q ? 'No one matches your search.' : 'No people yet.'}
        </p>
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
