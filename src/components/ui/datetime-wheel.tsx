'use client'

import { useMemo, useState, type ReactElement } from 'react'
import { addDays, format, isValid, startOfDay } from 'date-fns'
import { CalendarClockIcon, KeyboardIcon } from 'lucide-react'
import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
} from '@ncdai/react-wheel-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const DAY_WINDOW = 60
const MINUTE_STEP = 5

// Shared wheel highlight/option styling — every column gets the same classes
// so the four columns' highlight bands line up into one continuous bar.
const WHEEL_CLASS_NAMES = {
  optionItem: 'text-muted-foreground',
  highlightWrapper: 'border-y border-border font-medium text-foreground',
  highlightItem: 'text-foreground',
}

type WheelState = {
  day: string
  hour: number
  minute: number
  period: 'AM' | 'PM'
}

function buildDayOptions(anchor: Date): WheelPickerOption<string>[] {
  const start = startOfDay(anchor)
  return Array.from({ length: DAY_WINDOW }, (_, i) => {
    const day = addDays(start, i)
    return { value: format(day, 'yyyy-MM-dd'), label: format(day, 'EEE, MMM d') }
  })
}

const HOUR_OPTIONS: WheelPickerOption<number>[] = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}))

const MINUTE_OPTIONS: WheelPickerOption<number>[] = Array.from(
  { length: 60 / MINUTE_STEP },
  (_, i) => {
    const minute = i * MINUTE_STEP
    return { value: minute, label: minute.toString().padStart(2, '0') }
  },
)

const PERIOD_OPTIONS: WheelPickerOption<'AM' | 'PM'>[] = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
]

function toWheelState(date: Date): WheelState {
  const hour24 = date.getHours()
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  const roundedMinute = Math.round(date.getMinutes() / MINUTE_STEP) * MINUTE_STEP
  return {
    day: format(date, 'yyyy-MM-dd'),
    hour: hour12,
    minute: roundedMinute === 60 ? 0 : roundedMinute,
    period,
  }
}

function fromWheelState(state: WheelState): Date {
  const [year, month, day] = state.day.split('-').map(Number)
  const hour24 = (state.hour % 12) + (state.period === 'PM' ? 12 : 0)
  return new Date(year, month - 1, day, hour24, state.minute, 0, 0)
}

/**
 * Rounds a Date up to the next 5-minute mark — used to seed a sensible
 * default (e.g. "now") for a freshly-opened picker.
 */
export function roundUpToStep(date: Date, stepMinutes = MINUTE_STEP): Date {
  const ms = stepMinutes * 60 * 1000
  return new Date(Math.ceil(date.getTime() / ms) * ms)
}

// Date + time picker built from three/four independent scroll wheels (day,
// hour, minute, AM/PM) inside a popover — the day wheel covers a rolling
// 60-day window starting today. Always controlled: `value` is the Date
// currently shown, `onChange` fires with a new Date the moment any wheel
// moves. A "Type instead" toggle swaps in a plain <input type="datetime-local">
// so keyboard/screen-reader users and anyone who wants exact precision never
// have to touch the wheel.
export function DateTimeWheelField({
  id,
  label,
  value,
  onChange,
  className,
}: {
  id: string
  label: string
  value: Date
  onChange: (date: Date) => void
  className?: string
}): ReactElement {
  const [typedMode, setTypedMode] = useState(false)
  const [open, setOpen] = useState(false)
  // The 60-day window is anchored once per mount so it doesn't shift under
  // the user while the picker is open.
  const [anchor] = useState(() => new Date())
  const dayOptions = useMemo(() => buildDayOptions(anchor), [anchor])

  const state = isValid(value) ? toWheelState(value) : toWheelState(anchor)

  function updateState(partial: Partial<WheelState>) {
    onChange(fromWheelState({ ...state, ...partial }))
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
        <button
          type="button"
          onClick={() => setTypedMode((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
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
                className="w-full justify-start font-normal"
              />
            }
          >
            <CalendarClockIcon className="opacity-60" aria-hidden />
            {format(value, 'EEE, MMM d')} · {state.hour}:
            {String(state.minute).padStart(2, '0')} {state.period}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <WheelPickerWrapper className="w-72 gap-0 px-2 py-1.5">
              <WheelPicker
                options={dayOptions}
                value={state.day}
                onValueChange={(day) => updateState({ day })}
                classNames={WHEEL_CLASS_NAMES}
              />
              <WheelPicker
                options={HOUR_OPTIONS}
                value={state.hour}
                onValueChange={(hour) => updateState({ hour })}
                classNames={WHEEL_CLASS_NAMES}
              />
              <WheelPicker
                options={MINUTE_OPTIONS}
                value={state.minute}
                onValueChange={(minute) => updateState({ minute })}
                classNames={WHEEL_CLASS_NAMES}
              />
              <WheelPicker
                options={PERIOD_OPTIONS}
                value={state.period}
                onValueChange={(period) => updateState({ period })}
                classNames={WHEEL_CLASS_NAMES}
              />
            </WheelPickerWrapper>
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
