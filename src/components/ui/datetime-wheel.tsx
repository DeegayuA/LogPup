'use client'

// This used to wrap @ncdai/react-wheel-picker. That library renders its four
// columns via CSS 3D transforms (perspective + rotateX + translateZ) that are
// entirely dependent on its stylesheet loading *and* on the columns being
// given equal flex-basis by that same stylesheet — there's no supported way
// to give the day column more room than the AM/PM column, and any bundler
// hiccup with the CSS (as happened here — see git history) collapses every
// option into an unreadable, overlapping stack. Rather than keep fighting a
// fragile third-party rendering mode, this picker is now self-built from
// primitives already in the design system: the shadcn Calendar for the date,
// plus two plain-button scroll-snap columns (hour, minute) implementing the
// ARIA listbox pattern by hand. No third-party CSS, no 3D transforms, no
// magic-number height formulas — just flexbox, scroll-snap, and scrollTop
// arithmetic, so it can't come apart the way the wheel library did.
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { format, isValid, startOfToday } from 'date-fns'
import { CalendarClockIcon, KeyboardIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const MINUTE_STEP = 5
// Tap target height for every wheel row — meets the 44px minimum for mobile.
const ROW_HEIGHT = 44
// Odd so exactly one row centers in the highlight band, with a partial row
// peeking above and below it.
const VISIBLE_ROWS = 3
const COLUMN_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS
const COLUMN_WIDTH = 104

type WheelOption = { value: number; label: string }

const HOUR_OPTIONS: WheelOption[] = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: format(new Date(2000, 0, 1, hour), 'h a'),
}))

const MINUTE_OPTIONS: WheelOption[] = Array.from(
  { length: 60 / MINUTE_STEP },
  (_, i) => {
    const minute = i * MINUTE_STEP
    return { value: minute, label: minute.toString().padStart(2, '0') }
  },
)

/**
 * Rounds a Date up to the next 5-minute mark — used to seed a sensible
 * default (e.g. "now") for a freshly-opened picker.
 */
export function roundUpToStep(date: Date, stepMinutes = MINUTE_STEP): Date {
  const ms = stepMinutes * 60 * 1000
  return new Date(Math.ceil(date.getTime() / ms) * ms)
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// A single scroll-snap wheel column implementing the ARIA listbox pattern:
// the scrollable div is the sole tab stop (role="listbox"), each row is a
// virtual option (role="option") tracked via aria-activedescendant, and
// arrow/home/end keys move the selection without moving focus off the
// container. Selection has two sources of truth that must never fight each
// other: (1) user-driven scroll settling (debounced, read back via
// scrollTop / ROW_HEIGHT) and (2) an external `selected` prop change (e.g.
// typing a value into the native fallback). `pendingSelfUpdate` tells the
// sync effect "this change came from us, don't re-snap it" so a smooth,
// self-initiated scroll never gets cut off by the effect instantly
// re-applying the same position.
function TimeColumn({
  id,
  label,
  options,
  selected,
  onSelect,
}: {
  id: string
  label: string
  options: WheelOption[]
  selected: number
  onSelect: (value: number) => void
}): ReactElement {
  const listRef = useRef<HTMLDivElement>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSelfUpdate = useRef(false)
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selected),
  )

  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    if (pendingSelfUpdate.current) {
      pendingSelfUpdate.current = false
      return
    }
    const target = selectedIndex * ROW_HEIGHT
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target
  }, [selectedIndex])

  useLayoutEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current)
    },
    [],
  )

  function scrollToIndex(index: number, smooth: boolean) {
    listRef.current?.scrollTo({
      top: index * ROW_HEIGHT,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }

  function commit(index: number) {
    const clamped = Math.min(options.length - 1, Math.max(0, index))
    const option = options[clamped]
    if (!option) return
    pendingSelfUpdate.current = true
    onSelect(option.value)
    scrollToIndex(clamped, !prefersReducedMotion())
  }

  function handleScroll() {
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const el = listRef.current
      if (!el) return
      const index = Math.min(
        options.length - 1,
        Math.max(0, Math.round(el.scrollTop / ROW_HEIGHT)),
      )
      const option = options[index]
      if (option && option.value !== selected) {
        pendingSelfUpdate.current = true
        onSelect(option.value)
      }
    }, 120)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        commit(selectedIndex - 1)
        break
      case 'ArrowDown':
        event.preventDefault()
        commit(selectedIndex + 1)
        break
      case 'Home':
        event.preventDefault()
        commit(0)
        break
      case 'End':
        event.preventDefault()
        commit(options.length - 1)
        break
    }
  }

  const activeId = `${id}-opt-${options[selectedIndex]?.value ?? selected}`

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xs font-medium text-muted-foreground select-none">
        {label}
      </span>
      {/* `isolate` — the highlight band below sits at -z-10, and without its own
          stacking context that negative index escapes to the popover's, which
          paints its opaque background over the band. */}
      <div className="relative isolate" style={{ width: COLUMN_WIDTH, height: COLUMN_HEIGHT }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 -translate-y-1/2 rounded-md border-y border-border bg-accent/40"
          style={{ height: ROW_HEIGHT }}
        />
        <div
          ref={listRef}
          role="listbox"
          aria-label={label}
          aria-activedescendant={activeId}
          tabIndex={0}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          // The native scrollbar rendered as a bright track beside each column
          // and read as UI chrome rather than a wheel; the column still scrolls
          // by wheel, drag and keyboard.
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-md outline-none [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-scrollbar]:hidden"
          style={{ paddingBlock: ROW_HEIGHT }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === selected
            return (
              <div
                key={option.value}
                id={`${id}-opt-${option.value}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => commit(index)}
                className={cn(
                  'flex cursor-pointer items-center justify-center font-mono text-sm tabular-nums select-none snap-center',
                  isSelected
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                style={{ height: ROW_HEIGHT }}
              >
                {option.label}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Date + time picker: a shadcn Calendar for the date, plus hour/minute
// scroll-snap wheels below it, inside a popover. Always controlled: `value`
// is the Date currently shown, `onChange` fires with a new Date the moment
// any part changes. A "Type instead" toggle swaps in a plain
// <input type="datetime-local"> so keyboard/screen-reader users and anyone
// who wants exact precision never have to touch the wheels.
export function DateTimeWheelField({
  id,
  label,
  value,
  onChange,
  className,
  invalid,
  describedBy,
}: {
  id: string
  label: string
  value: Date
  onChange: (date: Date) => void
  className?: string
  /** Marks the control `aria-invalid` when the surrounding form has rejected
   * this value (e.g. an end time that precedes the start). */
  invalid?: boolean
  /** Id of the element holding the blocking error message, so the message is
   * announced with the control instead of only being visible beside it. */
  describedBy?: string
}): ReactElement {
  const [typedMode, setTypedMode] = useState(false)
  const [open, setOpen] = useState(false)

  const raw = isValid(value) ? value : new Date()
  // The wheels only offer 5-minute marks, so an off-step value has to be
  // rounded to something they can show. Let Date carry the rollover —
  // setMinutes(60) advances the hour (and the day) — instead of clamping the
  // minutes to 0, which would silently rewrite 23:58 as 23:00 the moment any
  // wheel is nudged.
  const anchor = new Date(raw)
  anchor.setSeconds(0, 0)
  anchor.setMinutes(Math.round(raw.getMinutes() / MINUTE_STEP) * MINUTE_STEP)
  const hour = anchor.getHours()
  const minute = anchor.getMinutes()

  function commitDate(patch: { day?: Date; hour?: number; minute?: number }) {
    const day = patch.day ?? anchor
    const nextHour = patch.hour ?? hour
    const nextMinute = patch.minute ?? minute
    onChange(
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), nextHour, nextMinute, 0, 0),
    )
  }

  function handleTypedChange(raw: string) {
    if (!raw) return
    const parsed = new Date(raw)
    if (isValid(parsed)) onChange(parsed)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {/* A plain <button>, not the Button primitive — its ~20px visible
            height is intentional (it sits beside a Label, not in a toolbar),
            but it still needs a real touch target on phones/tablets. That
            comes from the global `@media (pointer: coarse)` rule in
            globals.css, which expands the tap target of every <button> via
            an invisible ::after — no extra markup needed here. */}
        <button
          type="button"
          onClick={() => setTypedMode((v) => !v)}
          className="inline-flex items-center gap-1 rounded-sm px-1 text-xs text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KeyboardIcon className="size-3" aria-hidden />
          {typedMode ? 'Use wheel picker' : 'Type instead'}
        </button>
      </div>
      {typedMode ? (
        <Input
          id={id}
          type="datetime-local"
          value={isValid(value) ? format(value, "yyyy-MM-dd'T'HH:mm") : ''}
          onChange={(e) => handleTypedChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required
        />
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                id={id}
                variant="outline"
                type="button"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                className="w-full min-w-0 justify-start font-normal"
              />
            }
          >
            <CalendarClockIcon className="shrink-0 opacity-60" aria-hidden />
            <span className="min-w-0 truncate">
              {isValid(value) ? format(value, 'EEE, MMM d · h:mm a') : 'Pick a date & time'}
            </span>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            collisionPadding={16}
            className="w-[min(22rem,calc(100vw-2rem))] p-0"
          >
            <div className="p-2">
              <Calendar
                mode="single"
                selected={isValid(value) ? value : undefined}
                defaultMonth={anchor}
                onSelect={(day) => day && commitDate({ day })}
                disabled={{ before: startOfToday() }}
                className="p-0"
              />
            </div>
            <div className="flex items-start justify-center gap-2 border-t border-border px-3 py-2.5">
              <TimeColumn
                id={`${id}-hour`}
                label="Hour"
                options={HOUR_OPTIONS}
                selected={hour}
                onSelect={(nextHour) => commitDate({ hour: nextHour })}
              />
              <div className="flex flex-col items-center gap-1" aria-hidden>
                <span className="text-2xs font-medium text-transparent select-none">:</span>
                <span
                  className="flex items-center justify-center text-base font-medium text-muted-foreground"
                  style={{ height: COLUMN_HEIGHT }}
                >
                  :
                </span>
              </div>
              <TimeColumn
                id={`${id}-minute`}
                label="Minute"
                options={MINUTE_OPTIONS}
                selected={minute}
                onSelect={(nextMinute) => commitDate({ minute: nextMinute })}
              />
            </div>
            <div className="flex justify-end border-t border-border p-1.5">
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
