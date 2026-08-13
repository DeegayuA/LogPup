import { Badge } from '@/components/ui/badge'
import { eventDotClasses } from '@/features/meetings/event-color'
import { CapacityBar } from '@/features/people/components/capacity-bar'
import type { AssignableApp, UserCapacity } from '@/features/people/queries'
import { cn } from '@/lib/utils'
import { sortCapacities } from '@/features/dashboard/sort-capacities'
import {
  CapacityCard,
  CapacityEmpty,
  PersonAvatar,
  PersonHeading,
} from '@/features/dashboard/components/capacity-card'
import { CapacityHeatEditable } from '@/features/dashboard/components/capacity-heat-editable'

/**
 * Server-safe: no client-only APIs, so it can render directly from the
 * dashboard server component. Rows sorted overallocated-first, then by
 * totalPct descending, so the people who need attention float to the top.
 *
 * An admin gets the editable list instead — same chrome, same sort, but each
 * app chip opens an inline allocation editor. Everyone else (and every
 * historical "as of" render, which has nothing editable behind it) keeps this
 * static path, which never ships the mutation code to the browser at all.
 */
export function CapacityHeat({
  capacities,
  isAdmin = false,
  apps = [],
  title,
  description,
  emptyTitle = 'Nobody in the pack yet.',
  emptyHint = 'Add people and assign them to apps to see capacity here.',
}: {
  capacities: UserCapacity[]
  isAdmin?: boolean
  apps?: AssignableApp[]
  title?: string
  description?: string
  emptyTitle?: string
  emptyHint?: string
}) {
  if (isAdmin) return <CapacityHeatEditable capacities={capacities} apps={apps} />

  const sorted = sortCapacities(capacities)
  const overCount = sorted.filter((person) => person.overallocated).length

  return (
    <CapacityCard
      title={title}
      description={description}
      count={sorted.length}
      overCount={overCount}
    >
      {sorted.length === 0 ? (
        <CapacityEmpty title={emptyTitle} hint={emptyHint} />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {sorted.map((person) => (
            <li key={person.user.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <PersonAvatar person={person} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <PersonHeading person={person} />
                {person.breakdown.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {person.breakdown.map((entry) => (
                      // Name only, no percentage: this is the non-admin view
                      // and the per-app split is a click away on the person
                      // page; the total is right below.
                      //
                      // The dot is the app's identity hue — the same one its
                      // meetings wear on the calendar and its chip wears in
                      // the people directory, so one app is one colour
                      // wherever it is named. It is NOT status: the amber a
                      // few pixels below means "near capacity", and the word
                      // on that badge is what carries it.
                      <Badge key={entry.appId} variant="secondary" className="gap-1 text-[10px]">
                        <span
                          aria-hidden
                          className={cn(
                            'size-1.5 shrink-0 rounded-full',
                            eventDotClasses(entry.appId) ?? 'bg-muted-foreground/50',
                          )}
                        />
                        {entry.appName}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No app assignments</p>
                )}
                <CapacityBar totalPct={person.totalPct} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </CapacityCard>
  )
}
