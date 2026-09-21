import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { DashboardView } from '@/features/dashboard/zones'

/**
 * "My projects" or the whole studio — the one control on a personal-first
 * dashboard.
 *
 * Links, not client state, for the reason bug-list.tsx gives for its filter
 * bar: the server renders exactly one narrowed page, the URL is shareable,
 * the back button works, and there is no second copy of which view is on.
 * The page renders this only when some zone can actually widen (canWiden in
 * zones.ts) — a seat whose grants are scoped or own has nothing to switch,
 * and a control that changes nothing is a lie.
 */
const CHOICES: readonly { view: DashboardView; label: string; href: string }[] = [
  { view: 'mine', label: 'My projects', href: '/' },
  { view: 'all', label: 'Whole studio', href: '/?view=all' },
]

export function DashboardViewSwitch({
  view,
  describedBy,
}: {
  view: DashboardView
  /** The id of the page's "not on a project" note, when it is showing. */
  describedBy?: string
}) {
  return (
    <nav
      aria-label="Dashboard scope"
      aria-describedby={describedBy}
      className="flex items-center gap-0.5 rounded-md border bg-card p-0.5 text-xs"
    >
      {CHOICES.map((choice) => {
        const active = choice.view === view
        return (
          <Link
            key={choice.view}
            href={choice.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              // Weight as well as fill marks the active choice, so the state
              // survives forced-colors mode, where the background is dropped.
              'rounded px-2.5 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary font-semibold text-primary-foreground'
                : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {choice.label}
          </Link>
        )
      })}
    </nav>
  )
}
