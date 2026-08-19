'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { LK_TIMEZONE } from '@/lib/lk-holidays'
import { CURRENT_VERSION, VERSION_HISTORY, type ChangelogEntry } from '@/lib/changelog'

/**
 * Times are formatted in Asia/Colombo with an explicit `timeZone`, like every
 * other instant in this app — never the viewer's machine clock. That also
 * makes the output deterministic, which matters here because this menu is
 * client-rendered: a formatter that read the local zone would print one thing
 * on a laptop in Colombo and another on a VPN in Frankfurt for the same build.
 */
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: LK_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const dayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: LK_TIMEZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const isoDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: LK_TIMEZONE })

/** Kind → the word shown on the chip. Unknown kinds keep their own name. */
const KIND_LABEL: Record<string, string> = {
  feat: 'New',
  fix: 'Fix',
  docs: 'Docs',
  refactor: 'Refactor',
  perf: 'Faster',
  test: 'Tests',
  chore: 'Chore',
  style: 'Style',
  build: 'Build',
  ci: 'CI',
  other: 'Change',
}

/**
 * Only two tones, on purpose. What a reader wants from this list is "did
 * something get FIXED or ADDED since the build I saw yesterday" — every other
 * type is housekeeping and reads as one quiet group. Both tones are existing
 * tokens; nothing new is introduced for a menu.
 */
function kindClass(kind: string): string {
  if (kind === 'feat') return 'bg-primary/15 text-primary'
  if (kind === 'fix') return 'bg-warning/15 text-foreground'
  return 'bg-muted text-muted-foreground'
}

/** Groups newest-first entries into days, preserving order within each day. */
function groupByDay(entries: ChangelogEntry[]): { day: string; entries: ChangelogEntry[] }[] {
  const groups: { day: string; entries: ChangelogEntry[] }[] = []
  for (const entry of entries) {
    // The Colombo day, not the `date` field: `date` carries the author's own
    // offset, so a commit made at 01:00 Colombo from a machine set to UTC
    // would head its own phantom day in a list that is otherwise Colombo.
    const day = isoDayFmt.format(new Date(entry.at))
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.entries.push(entry)
    else groups.push({ day, entries: [entry] })
  }
  return groups
}

function dayLabel(day: string, todayIso: string, yesterdayIso: string): string {
  if (day === todayIso) return 'Today'
  if (day === yesterdayIso) return 'Yesterday'
  return dayFmt.format(new Date(`${day}T12:00:00`))
}

export function VersionBadge() {
  // Newest first, and cap the visible history so the menu stays quick to scan.
  const history = [...VERSION_HISTORY].reverse().slice(0, 50)
  const current = history[0]

  // Read once per render of the OPEN menu — this content mounts on open, so
  // there is no server pass to disagree with.
  const now = new Date()
  const todayIso = isoDayFmt.format(now)
  const yesterdayIso = isoDayFmt.format(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const groups = groupByDay(history)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Version ${CURRENT_VERSION} — view what changed`}
            /* The quietest thing in the footer: no dot (it signalled nothing),
               no chrome until hovered. Tabular so the digits stay aligned. */
            className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 font-mono text-2xs tabular-nums text-sidebar-foreground/60 outline-none transition-colors duration-150 motion-reduce:transition-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
          >
            {CURRENT_VERSION}
          </button>
        }
      />
      <DropdownMenuContent align="start" side="top" className="max-h-[26rem] w-80 overflow-y-auto p-0">
        {/* The header answers "which build am I on, and when did it ship" in
            one line — the two facts a bug report needs. The old header printed
            the version alone, so the answer to "when" was somewhere down the
            list next to a date shared with five other rows. */}
        <div className="sticky top-0 z-10 flex flex-col gap-0.5 border-b border-border bg-popover px-3 py-2.5">
          <span className="text-sm font-medium">What&rsquo;s new</span>
          {current ? (
            <span className="flex flex-wrap items-baseline gap-x-1.5 text-2xs text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground">{current.version}</span>
              <span>·</span>
              <span className="tabular-nums">
                {dayLabel(isoDayFmt.format(new Date(current.at)), todayIso, yesterdayIso)}{' '}
                {timeFmt.format(new Date(current.at))}
              </span>
              <span>·</span>
              <span className="font-mono">{current.hash}</span>
            </span>
          ) : null}
        </div>

        {groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No build history was recorded for this deployment.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.day}>
              {/* Day headings carry the count, so a heavy day reads as a heavy
                  day before you scroll it. */}
              <h3 className="flex items-baseline justify-between gap-2 bg-muted/40 px-3 py-1 text-2xs font-medium text-muted-foreground">
                <span>{dayLabel(group.day, todayIso, yesterdayIso)}</span>
                <span className="tabular-nums">
                  {group.entries.length} {group.entries.length === 1 ? 'build' : 'builds'}
                </span>
              </h3>
              <ul className="divide-y divide-border/60">
                {group.entries.map((entry) => {
                  const isCurrent = entry.version === CURRENT_VERSION
                  return (
                    <li
                      key={entry.version}
                      className={cn('flex gap-2.5 px-3 py-2', isCurrent && 'bg-primary/5')}
                    >
                      {/* Time first and in its own column: this is the axis
                          the list is ordered by, and a fixed column lets the
                          eye run down it instead of hunting for it at the end
                          of each row. */}
                      <span className="w-9 shrink-0 pt-0.5 font-mono text-2xs tabular-nums text-muted-foreground">
                        {timeFmt.format(new Date(entry.at))}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="text-xs leading-snug text-foreground">{entry.change}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-px font-medium',
                              kindClass(entry.kind),
                            )}
                          >
                            {KIND_LABEL[entry.kind] ?? entry.kind}
                          </span>
                          <span className="font-mono tabular-nums">{entry.version}</span>
                          {isCurrent ? (
                            <span className="rounded-full bg-primary/15 px-1.5 py-px font-medium text-primary">
                              you are here
                            </span>
                          ) : null}
                          <span className="ml-auto font-mono">{entry.hash}</span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
