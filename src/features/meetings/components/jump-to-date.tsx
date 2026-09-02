'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarSearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { isoToDisplayDate } from '@/features/meetings/calendar-view'

/**
 * The month-calendar answer to "get me to a meeting from three weeks ago".
 *
 * The 30-day strip starts at today and walks FORWARD, so the only route to a
 * past day used to be pressing "Show earlier days" until the window happened
 * to reach it. This popover jumps anywhere in one pick — deliberately NO
 * disabled dates, because the day filter reaches both the Upcoming and Past
 * halves and an out-of-window pick is the caller's cue to fetch that day,
 * not a dead square.
 *
 * DISPLAY-SPACE DATES, same two-edge contract as the day rail: the app's day
 * identity is a business-timezone ISO string, react-day-picker works in local
 * `Date`s, and the conversion happens only at `isoToDisplayDate` going in and
 * `format(date, 'yyyy-MM-dd')` coming out — so a click on "12" cannot land on
 * the 11th from a UTC-offset browser.
 */
export function JumpToDate({
  day,
  onPickDay,
}: {
  /** The currently filtered day as a business-timezone ISO string, if any. */
  day?: string
  /** Receives the picked day as `YYYY-MM-DD`; the caller owns writing `?day`. */
  onPickDay: (isoDay: string) => void
}) {
  const [open, setOpen] = useState(false)
  // Which month the grid shows, independent of the filtered day so browsing
  // does not move the filter. Re-seeded on every open (not once per mount):
  // reopening after the filter changed elsewhere should land ON the filtered
  // day, or on today when there is none.
  const [month, setMonth] = useState<Date>(() => new Date())

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setMonth(day ? isoToDisplayDate(day) : new Date())
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <CalendarSearchIcon aria-hidden /> Jump to date
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-2">
        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          selected={day ? isoToDisplayDate(day) : undefined}
          onSelect={(date) => {
            if (!date) return
            onPickDay(format(date, 'yyyy-MM-dd'))
            // Picking is the whole job — the popover closing is the
            // confirmation, and focus returns to the trigger via the
            // popover primitive.
            setOpen(false)
          }}
          className="w-64 p-0"
        />
      </PopoverContent>
    </Popover>
  )
}
