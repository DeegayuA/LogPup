import Link from 'next/link'
import { cn } from '@/lib/utils'
import { APP_TAB_LABEL, appTabHref, type AppTabId } from '@/features/apps/tabs'

/**
 * The app's section bar. A <nav> of links, rendered on the server — see
 * tabs.ts for why this is navigation rather than a tab widget.
 *
 * Scrolls horizontally rather than wrapping: seven sections wrap to two rows
 * at 375px, which pushes the page content down and makes the bar look like
 * two different controls. A single scrolling row keeps the "these are peers"
 * reading intact at every width.
 */
export function AppTabNav({
  slug,
  active,
  tabs,
  counts = {},
}: {
  slug: string
  active: AppTabId
  tabs: readonly AppTabId[]
  /** Optional badge numbers, e.g. how many comments are in Discussion. */
  counts?: Partial<Record<AppTabId, number>>
}) {
  return (
    <nav aria-label="App sections" className="border-b border-border">
      <ul className="-mb-px flex items-stretch gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const selected = tab === active
          const count = counts[tab]
          return (
            <li key={tab} className="shrink-0">
              <Link
                href={appTabHref(slug, tab)}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm outline-none',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  selected
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {APP_TAB_LABEL[tab]}
                {count !== undefined && count > 0 ? (
                  <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                    {count}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
