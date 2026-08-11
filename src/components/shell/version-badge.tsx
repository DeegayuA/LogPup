'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CURRENT_VERSION, VERSION_HISTORY } from '@/lib/changelog'

export function VersionBadge() {
  // Newest first, and cap the visible history so the menu stays quick to scan.
  const history = [...VERSION_HISTORY].reverse().slice(0, 50)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Version ${CURRENT_VERSION} — view changelog`}
            /* The quietest thing in the footer: no dot (it signalled nothing),
               no chrome until hovered. Tabular so the digits stay aligned. */
            className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 font-mono text-2xs tabular-nums text-sidebar-foreground/60 outline-none transition-colors duration-150 motion-reduce:transition-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
          >
            {CURRENT_VERSION}
          </button>
        }
      />
      <DropdownMenuContent align="start" side="top" className="max-h-96 w-72 overflow-y-auto p-0">
        <div className="sticky top-0 border-b border-border bg-popover px-3 py-2 text-sm font-medium">
          What&apos;s new
          <span className="ml-1.5 font-mono text-xs text-muted-foreground">{CURRENT_VERSION}</span>
        </div>
        <ul className="py-1">
          {history.map((entry, i) => (
            <li key={entry.version} className="flex flex-col gap-0.5 px-3 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium">
                  {entry.version}
                  {i === 0 ? (
                    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      current
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] text-muted-foreground">{entry.date}</span>
              </div>
              <p className="text-xs text-muted-foreground">{entry.change}</p>
            </li>
          ))}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
