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
            aria-label={`Version ${CURRENT_VERSION} — view changelog`}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
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
