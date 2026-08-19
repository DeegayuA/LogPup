import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  COHORT_VIEWS,
  COHORT_VIEW_LABEL,
  peopleHref,
  type CohortParams,
} from '@/features/people/cohort-params'

/**
 * Which cohort of /people is in front.
 *
 * A SERVER COMPONENT, and every control is a plain <Link> — no state, no
 * client bundle, and every view is a URL somebody can paste. It renders from
 * the query string alone, so it is on screen and clickable while the data
 * behind it is still loading (see the Suspense boundary in the page).
 *
 * aria-current="page", not aria-pressed: these are links inside a nav, and
 * aria-pressed is only defined for buttons — on a link it is ignored, which
 * would leave "which view am I in" carried by fill colour alone. Same rule the
 * capacity-history filters follow.
 */
export function CohortNav({ params }: { params: CohortParams }) {
  return (
    <nav aria-label="People views" className="flex flex-wrap gap-1.5">
      {COHORT_VIEWS.map((view) => (
        <Button
          key={view}
          variant={params.view === view ? 'secondary' : 'ghost'}
          size="sm"
          aria-current={params.view === view ? 'page' : undefined}
          render={<Link href={peopleHref(params, { view })} />}
        >
          {COHORT_VIEW_LABEL[view]}
        </Button>
      ))}
    </nav>
  )
}
