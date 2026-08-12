import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CHECKIN_GAP_THRESHOLD } from '@/features/sprints/checkins'
import type { PlanGaps, SprintRead } from '@/features/sprints/plan-read'

/**
 * The judgement line: one sentence about the selected sprint, then only the
 * facts that would change what somebody does next.
 *
 * Everything here is a link or it is not here. A count of unassigned work
 * that cannot be clicked through to that work is a decoration — so each chip
 * carries a board filter that shows exactly the cards it is talking about,
 * reusing the filter params the board already reads out of the URL (`who`,
 * `overdue`) rather than inventing a second filtering mechanism.
 *
 * Silence is a state. When nothing is worth flagging, the strip renders the
 * sprint's own summary and nothing else — a row of green zeroes is how a
 * status line teaches people to stop reading it.
 */
export function PlanReadStrip({
  read,
  gaps,
  checkinGapCount,
  boardHrefFor,
  className,
}: {
  read: SprintRead
  gaps: PlanGaps
  /** How many people's self-reports disagree with their own cards. */
  checkinGapCount: number
  /** Builds a link to this same board with the given filter params applied. */
  boardHrefFor: (params: Record<string, string>) => string
  className?: string
}) {
  /**
   * `href: null` means "state this, do not pretend it is a drill-down".
   *
   * The board can filter to unassigned work (`who=unassigned`) and nothing
   * else here — it has no "no due date" filter and no notion of check-ins.
   * Linking those two anywhere would produce a control that navigates to the
   * page you are already on, which is worse than plain text: it teaches
   * people that the chips do not work.
   */
  const chips: { key: string; label: string; href: string | null; tone: 'warn' | 'neutral' }[] = []

  if (gaps.unassigned > 0) {
    chips.push({
      key: 'unassigned',
      label: `${gaps.unassigned} unassigned`,
      href: boardHrefFor({ who: 'unassigned' }),
      tone: 'warn',
    })
  }
  if (gaps.undated > 0) {
    chips.push({
      key: 'undated',
      label: `${gaps.undated} with no date`,
      href: null,
      tone: 'neutral',
    })
  }
  if (checkinGapCount > 0) {
    chips.push({
      key: 'checkins',
      label:
        checkinGapCount === 1
          ? '1 check-in disagrees with the board'
          : `${checkinGapCount} check-ins disagree with the board`,
      href: null,
      tone: 'warn',
    })
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10',
        className,
      )}
    >
      <p
        className={cn(
          'text-sm font-medium',
          read.health === 'behind' && 'text-warning',
          read.health === 'overdue' && 'text-destructive',
          read.health === 'complete' && 'text-success',
        )}
      >
        {read.summary}
      </p>

      {chips.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => {
            // min-h-7 + px-2: these are the surface's drill-down controls, and
            // an 11px label with 2px of padding is a ~20px target — under the
            // 24px minimum, and well under it on a coarse pointer.
            const base = cn(
              'inline-flex min-h-7 items-center rounded-md border px-2 text-2xs',
              chip.tone === 'warn'
                ? 'border-warning/40 bg-warning/8 text-warning'
                : 'border-border text-muted-foreground',
            )
            return (
              <li key={chip.key}>
                {chip.href ? (
                  <Link
                    href={chip.href}
                    className={cn(
                      base,
                      'outline-none transition-colors duration-150 motion-reduce:transition-none',
                      'focus-visible:ring-2 focus-visible:ring-ring',
                      chip.tone === 'warn' ? 'hover:bg-warning/15' : 'hover:bg-muted',
                    )}
                  >
                    {chip.label}
                  </Link>
                ) : (
                  <span className={base}>{chip.label}</span>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}

      {checkinGapCount > 0 ? (
        <span className="sr-only">
          A check-in counts as disagreeing when it is more than {CHECKIN_GAP_THRESHOLD} percentage
          points away from what that person&rsquo;s cards show.
        </span>
      ) : null}
    </div>
  )
}
