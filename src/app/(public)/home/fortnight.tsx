import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * The fortnight strip — fifteen days of one person's work log, as a ruled row.
 *
 * This is the page's one signature object, and every rule it draws is a rule
 * the product actually holds:
 *
 *  - Saturday is HALF a day. `workingDayFraction` in src/lib/working-days.ts
 *    returns 0.5 for weekday 6, so a Saturday cell is half height. It is not a
 *    smaller version of a weekday; it is a smaller expectation.
 *  - Wednesday 29 July 2026 has no cell at all. It is Esala Full Moon Poya Day
 *    (src/lib/lk-holidays.ts), and a holiday is not a day somebody failed to
 *    log — it is a day nobody was asked to.
 *  - Sundays have no cell either, for the same reason.
 *  - A missed day is drawn, not skipped. `computeCoverage` distinguishes "off"
 *    from "missing" and argues the difference: marking someone's Monday "off"
 *    would claim they were not working. They were working. They were not
 *    logging, and that is a different sentence.
 *  - The last cell is open. `missing-days.ts` excludes the current day from
 *    what is owed — "not missed until it is over" — so the record stops one
 *    cell short of its own end.
 *
 * DELIBERATELY A SAMPLE, NOT TODAY. The whole page runs on a frozen week
 * (AS_OF in plates.tsx) so the plates cannot disagree with each other once the
 * page is cached. A strip claiming its open cell was "today" would therefore
 * be false on the day it shipped and every day after. The caption says what
 * this actually is: a fortnight from the sample week, its final day not yet
 * written.
 *
 * STATE IS NEVER CARRIED BY COLOUR ALONE (WCAG 1.4.1). The states differ in
 * height, in fill, in border weight, or by not existing — an inked full cell,
 * an inked half cell, a 2px outlined cell, a 1px dashed open cell, or no cell
 * at all. Every cell also carries a visually-hidden sentence, because a row of
 * boxes is not a sentence to a screen reader.
 */

type Cell =
  /** Logged in full. */
  | 'logged'
  /** Logged, on a Saturday — half the expectation, so half the cell. */
  | 'half'
  /** Nobody was expected to work: a Sunday, or a public holiday. */
  | 'off'
  /** Expected, and not logged. */
  | 'missing'
  /** The open end of the record. */
  | 'open'

type Day = { date: string; weekday: string; state: Cell; label: string }

/**
 * Wed 29 Jul → Wed 12 Aug 2026, the fortnight ending on the sample week's "as
 * of" date. Weekday letters are written out rather than derived: this is
 * static marketing copy, and a `new Date()` here would make the strip disagree
 * with the plates the moment the page is cached — the same reason AS_OF is a
 * frozen literal.
 */
const FORTNIGHT: Day[] = [
  { date: '29 Jul', weekday: 'W', state: 'off', label: 'Wednesday 29 July, Esala Full Moon Poya Day — a public holiday, nothing expected' },
  { date: '30 Jul', weekday: 'T', state: 'logged', label: 'Thursday 30 July, logged' },
  { date: '31 Jul', weekday: 'F', state: 'logged', label: 'Friday 31 July, logged' },
  { date: '1 Aug', weekday: 'S', state: 'half', label: 'Saturday 1 August, logged — a half working day' },
  { date: '2 Aug', weekday: 'S', state: 'off', label: 'Sunday 2 August, not a working day' },
  { date: '3 Aug', weekday: 'M', state: 'logged', label: 'Monday 3 August, logged' },
  { date: '4 Aug', weekday: 'T', state: 'logged', label: 'Tuesday 4 August, logged' },
  { date: '5 Aug', weekday: 'W', state: 'missing', label: 'Wednesday 5 August, a working day with no entry' },
  { date: '6 Aug', weekday: 'T', state: 'logged', label: 'Thursday 6 August, logged' },
  { date: '7 Aug', weekday: 'F', state: 'logged', label: 'Friday 7 August, logged' },
  { date: '8 Aug', weekday: 'S', state: 'half', label: 'Saturday 8 August, logged — a half working day' },
  { date: '9 Aug', weekday: 'S', state: 'off', label: 'Sunday 9 August, not a working day' },
  { date: '10 Aug', weekday: 'M', state: 'logged', label: 'Monday 10 August, logged' },
  { date: '11 Aug', weekday: 'T', state: 'logged', label: 'Tuesday 11 August, logged' },
  { date: '12 Aug', weekday: 'W', state: 'open', label: 'Wednesday 12 August, the open end of the record — not yet written' },
]

/* Ink and outlines are --foreground on --background, so every mark clears the
   3:1 that WCAG 1.4.11 asks of a graphical object. No state is encoded as a
   pale fill: `bg-muted` on `background` sits under 1.5:1 and would make three
   of these states invisible to the readers those rules exist for. */
const CELL: Record<Cell, string> = {
  logged: 'h-8 bg-foreground',
  half: 'h-4 bg-foreground',
  off: '',
  missing: 'h-8 border-2 border-foreground',
  open: 'h-8 border border-dashed border-foreground',
}

export function Fortnight() {
  return (
    /**
     * MEASURED, NOT STRETCHED. An earlier version let the cells flex to fill
     * the 76rem container, which made each day about 150px wide — at that
     * size the row stopped reading as a fortnight of a ledger and started
     * reading as a bar chart, and it was the only element on the page
     * ignoring the measure everything else is set to. Fixed-width cells keep
     * the strip at its natural size (fifteen days ≈ 24rem), so it sits inside
     * the column as a figure rather than spanning the page.
     */
    <figure className="flex max-w-full flex-col gap-4">
      <div className="flex w-fit items-end gap-1">
        {FORTNIGHT.map((day, index) => (
          <div key={day.date} className="flex w-6 shrink-0 flex-col items-center gap-2">
            <div className="flex h-8 w-full items-end">
              {day.state === 'off' ? (
                /* No cell, on purpose. The gap IS the statement: a holiday or
                   a Sunday is not an empty box waiting to be filled in. A
                   baseline tick rather than nothing at all, so the day still
                   holds its place and the sequence is visibly stepping over
                   it rather than closing the gap. */
                <div aria-hidden className="h-px w-full bg-border" />
              ) : (
                <div
                  data-stamp
                  /* The cell's position in the fortnight, not its rank among
                     the inked ones — so the holiday and the Sundays still
                     consume their beat and the sequence is visibly STEPPING
                     OVER them rather than closing the gap. */
                  style={{ '--reveal-index': index } as CSSProperties}
                  className={cn('w-full', CELL[day.state])}
                >
                  {day.state === 'open' ? (
                    /* The caret sits inside the open cell rather than after
                       the row, so it reads as the record's next line and not
                       as a cursor floating on the page. */
                    <span data-caret aria-hidden className="block h-full w-px bg-foreground" />
                  ) : null}
                </div>
              )}
            </div>
            <span aria-hidden className="font-mono text-2xs text-muted-foreground">
              {day.weekday}
            </span>
            <span className="sr-only">{day.label}</span>
          </div>
        ))}
      </div>

      <figcaption className="max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
        A fortnight from the sample week. Saturdays are half days, the Poya day and the Sundays were
        never expected, one Wednesday was missed, and the last day is not yet written — a log records
        what happened, so the current day stays open until it is over.
      </figcaption>
    </figure>
  )
}
