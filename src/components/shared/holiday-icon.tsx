import { Flag, Landmark, Moon, Store } from 'lucide-react'
import {
  getHolidayIconKind,
  type HolidayCategory,
  type HolidayIconKind,
} from '@/lib/lk-holidays'
import { cn } from '@/lib/utils'

/** Icon, color token, and accessible category label for each holiday icon
    kind — the single source of truth shared by the day strip, the month
    calendar, and the legend below, so all three can never drift out of
    sync with each other. */
export const HOLIDAY_ICON_META: Record<
  HolidayIconKind,
  { Icon: typeof Flag; tone: string; label: string }
> = {
  // Poya wins the precedence in getHolidayIconKind, but still reads as a
  // holiday: it shares --holiday with 'public', just a different glyph
  // (it is literally the day of the full moon).
  poya: { Icon: Moon, tone: 'text-holiday', label: 'Poya day' },
  public: { Icon: Flag, tone: 'text-holiday', label: 'Public holiday' },
  // Mercantile and bank days are NOT public holidays, so they share a
  // different color token (--mercantile) rather than reusing --holiday, which
  // would visually claim they're the same thing. They're told apart by glyph:
  // a shopfront for the day that closes shops and offices, a columned bank
  // building for the day that only closes banks — distinct silhouettes even
  // at the 12px the day strip renders them at.
  mercantile: { Icon: Store, tone: 'text-mercantile', label: 'Mercantile holiday' },
  bank: { Icon: Landmark, tone: 'text-mercantile', label: 'Bank holiday' },
}

/** Render order for the legend and any other "all kinds at once" listing —
    most to least disruptive to a working day. */
export const HOLIDAY_ICON_ORDER: HolidayIconKind[] = ['public', 'poya', 'mercantile', 'bank']

/** The accessible category label a screen reader should hear alongside a
    holiday's name (e.g. "Independence Day, Public holiday"). Undefined for
    a non-holiday. */
export function holidayCategoryLabel(categories: HolidayCategory[] | undefined): string | undefined {
  const kind = getHolidayIconKind(categories)
  return kind ? HOLIDAY_ICON_META[kind].label : undefined
}

/** The token color class (`text-holiday` / `text-mercantile`) matching a
    holiday's icon, for tinting the date number next to it consistently.
    Undefined for a non-holiday. */
export function holidayToneClass(categories: HolidayCategory[] | undefined): string | undefined {
  const kind = getHolidayIconKind(categories)
  return kind ? HOLIDAY_ICON_META[kind].tone : undefined
}

/**
 * Renders the single icon representing `categories`, tinted with the
 * matching token — nothing when `categories` isn't a holiday.
 *
 * The icon is `aria-hidden` and is never the only signal a viewer gets:
 * callers must also carry the holiday name and `holidayCategoryLabel` as
 * visible or sr-only text alongside it (WCAG 1.4.1 — color/shape alone
 * can't be the sole means of conveying information).
 */
export function HolidayIcon({
  categories,
  className,
}: {
  categories: HolidayCategory[] | undefined
  className?: string
}) {
  const kind = getHolidayIconKind(categories)
  if (!kind) return null
  const { Icon, tone } = HOLIDAY_ICON_META[kind]
  return <Icon aria-hidden className={cn(tone, className)} />
}

/** Compact icon -> category key. The meetings page shows these holiday
    icons in two places (the day strip and the month calendar), so a viewer
    only needs to learn the mapping once — tokens only, no new colors. */
export function HolidayLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground', className)}>
      {HOLIDAY_ICON_ORDER.map((kind) => {
        const { Icon, tone, label } = HOLIDAY_ICON_META[kind]
        return (
          <li key={kind} className="flex items-center gap-1">
            <Icon aria-hidden className={cn('size-3', tone)} />
            {label}
          </li>
        )
      })}
    </ul>
  )
}
