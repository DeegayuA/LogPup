import Link from 'next/link'
import { UserRoundX } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The third state for a person address that resolves to nobody.
 *
 * The route already calls `notFound()` for a malformed id and for an id that
 * matches no row — but with no `not-found.tsx` anywhere under app/, both landed
 * on Next's built-in 404: a bare "This page could not be found" with no
 * navigation, outside the product's shell. Turning a crash into a dead end is
 * only half a fix (rule 6), so this segment now owns its own miss state and
 * puts the directory one click away.
 *
 * Sibling to error.tsx and deliberately distinct from it: this page says "there
 * is nobody at this address", error.tsx says "somebody is here and we could not
 * load them". Collapsing the two would tell a reader their teammate had been
 * deleted every time a query timed out.
 */
export default function PersonNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <UserRoundX aria-hidden className="size-8 text-muted-foreground/60" />
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-semibold">No one at this address.</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This profile link is either mistyped or points at someone who has since been
          removed from the workspace. The directory has everyone who is still here.
        </p>
      </div>
      <Button render={<Link href="/people" />}>Back to people</Button>
    </div>
  )
}
