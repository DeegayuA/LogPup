"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { addDays, isSameDay } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Slot } from "radix-ui";
import {
  type ButtonHTMLAttributes,
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
  useContext,
} from "react";
import { Button } from "@/components/ui/button";
import { HolidayIcon, holidayCategoryLabel, holidayToneClass } from "@/components/shared/holiday-icon";
import {
  getLkHoliday,
  isLkSunday,
  LK_TIMEZONE,
  toIsoDateInTimeZone,
} from "@/lib/lk-holidays";
import { cn } from "@/lib/utils";

// Context for sharing state between components
type MiniCalendarContextType = {
  selectedDate: Date | null | undefined;
  onDateSelect: (date: Date) => void;
  startDate: Date;
  onNavigate: (direction: "prev" | "next") => void;
  /** Resets the strip window to start on today AND selects today, in one shot. */
  onJumpToToday: () => void;
  days: number;
};

const MiniCalendarContext = createContext<MiniCalendarContextType | null>(null);

const useMiniCalendar = () => {
  const context = useContext(MiniCalendarContext);

  if (!context) {
    throw new Error("MiniCalendar components must be used within MiniCalendar");
  }

  return context;
};

// Helper function to get array of consecutive dates
const getDays = (startDate: Date, count: number): Date[] => {
  const days: Date[] = [];
  for (let i = 0; i < count; i++) {
    days.push(addDays(startDate, i));
  }
  return days;
};

// Helper function to format date. Rendered in Asia/Colombo — the same zone the
// holiday/weekend markers below are resolved in — so the visible day number can
// never disagree with the dot beside it for a viewer in another timezone (and
// so the server's UTC render matches the client's).
const formatDate = (date: Date) => ({
  month: new Intl.DateTimeFormat("en-US", {
    timeZone: LK_TIMEZONE,
    month: "short",
  }).format(date),
  day: new Intl.DateTimeFormat("en-US", {
    timeZone: LK_TIMEZONE,
    day: "numeric",
  }).format(date),
});

export type MiniCalendarProps = HTMLAttributes<HTMLDivElement> & {
  value?: Date;
  defaultValue?: Date;
  onValueChange?: (date: Date | undefined) => void;
  startDate?: Date;
  defaultStartDate?: Date;
  onStartDateChange?: (date: Date | undefined) => void;
  days?: number;
};

export const MiniCalendar = ({
  value,
  defaultValue,
  onValueChange,
  startDate,
  defaultStartDate = new Date(),
  onStartDateChange,
  days = 5,
  className,
  children,
  ...props
}: MiniCalendarProps) => {
  const [selectedDate, setSelectedDate] = useControllableState<
    Date | undefined
  >({
    prop: value,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });

  const [currentStartDate, setCurrentStartDate] = useControllableState({
    prop: startDate,
    defaultProp: defaultStartDate,
    onChange: onStartDateChange,
  });

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleNavigate = (direction: "prev" | "next") => {
    const newStartDate = addDays(
      currentStartDate || new Date(),
      direction === "next" ? days : -days
    );
    setCurrentStartDate(newStartDate);
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentStartDate(today);
    setSelectedDate(today);
  };

  const contextValue: MiniCalendarContextType = {
    selectedDate: selectedDate || null,
    onDateSelect: handleDateSelect,
    startDate: currentStartDate || new Date(),
    onNavigate: handleNavigate,
    onJumpToToday: handleJumpToToday,
    days,
  };

  return (
    <MiniCalendarContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex w-full min-w-0 items-center gap-2 rounded-lg border bg-background p-2",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </MiniCalendarContext.Provider>
  );
};

export type MiniCalendarNavigationProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    direction: "prev" | "next";
    asChild?: boolean;
  };

export const MiniCalendarNavigation = ({
  direction,
  asChild = false,
  children,
  onClick,
  className,
  ...props
}: MiniCalendarNavigationProps) => {
  const { onNavigate } = useMiniCalendar();
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    onNavigate(direction);
    onClick?.(event);
  };

  if (asChild) {
    return (
      <Slot.Root onClick={handleClick} className={className} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <Button
      // 44px square — WCAG 2.5.8 minimum touch target, so paging stays
      // reachable at mobile widths without shrinking below the icon's
      // default 32px "icon" size.
      className={cn("size-11 shrink-0", className)}
      onClick={handleClick}
      size="icon"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon className="size-4" />}
    </Button>
  );
};

export type MiniCalendarTodayButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
};

export const MiniCalendarTodayButton = ({
  asChild = false,
  children,
  onClick,
  className,
  ...props
}: MiniCalendarTodayButtonProps) => {
  const { onJumpToToday, selectedDate, startDate } = useMiniCalendar();

  // A click here is a true no-op exactly when today is already both the
  // selection AND the first visible day of the strip — the same two things
  // handleJumpToToday itself sets — so this can never disagree with what
  // pressing the button would actually do.
  const isNoOp =
    selectedDate != null &&
    isSameDay(selectedDate, new Date()) &&
    isSameDay(startDate, new Date());

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    onJumpToToday();
    onClick?.(event);
  };

  if (asChild) {
    return (
      <Slot.Root onClick={handleClick} className={className} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <Button
      // Matches the chevrons' 44px square footprint so the row reads as one
      // control cluster; disabled reuses the shared disabled: tokens
      // (opacity + pointer-events) rather than a bespoke inactive style.
      className={cn("h-11 shrink-0 px-3", className)}
      disabled={isNoOp}
      onClick={handleClick}
      size="sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? "Today"}
    </Button>
  );
};

export type MiniCalendarDaysProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: (date: Date) => ReactNode;
};

export const MiniCalendarDays = ({
  className,
  children,
  ...props
}: MiniCalendarDaysProps) => {
  const { startDate, days: dayCount } = useMiniCalendar();
  const days = getDays(startDate, dayCount);

  return (
    <div
      className={cn(
        // `min-w-0` lets this flex child shrink below its content's
        // intrinsic width instead of stretching the page — the row scrolls
        // in its own container edge-to-edge, the page body never does.
        // `motion-safe:` keeps the snap scroll instant for
        // prefers-reduced-motion instead of unconditionally animating it.
        "flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-px-2 snap-x snap-mandatory motion-safe:scroll-smooth",
        className
      )}
      {...props}
    >
      {days.map((date) => children(date))}
    </div>
  );
};

export type MiniCalendarDayProps = ComponentProps<typeof Button> & {
  date: Date;
};

export const MiniCalendarDay = ({
  date,
  className,
  ...props
}: MiniCalendarDayProps) => {
  const { selectedDate, onDateSelect } = useMiniCalendar();
  const { month, day } = formatDate(date);
  const isSelected = selectedDate && isSameDay(date, selectedDate);

  // "Today" and weekend/holiday status are computed against the Sri Lanka
  // wall clock (Asia/Colombo), never the server or browser's local
  // time/UTC — otherwise the marker can land on the wrong cell right around
  // midnight in either timezone.
  const isTodayDate = toIsoDateInTimeZone(date) === toIsoDateInTimeZone(new Date());
  const holiday = getLkHoliday(date);
  const holidayName = holiday?.name;
  const categoryLabel = holidayCategoryLabel(holiday?.categories);
  // A Sunday that is also a holiday is still marked (holiday wins) — the
  // icon below is what keeps that distinguishable from a plain Sunday for
  // anyone who can't rely on hue alone.
  const isWeekend = isLkSunday(date) && !holidayName;

  // The visible "Feb" / "4" fragments are marked aria-hidden and a single
  // sr-only span carries the full accessible name instead, so today/holiday
  // context is always announced regardless of what aria-label (if any) a
  // caller passes through `props`. The category label ("Public holiday" /
  // "Poya day" / "Bank holiday") is spoken too — the icon alone is never
  // the only signal (WCAG 1.4.1).
  const accessibleLabel = [
    new Intl.DateTimeFormat("en-US", {
      timeZone: LK_TIMEZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date),
    isTodayDate && "Today",
    holidayName,
    categoryLabel,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Button
      className={cn(
        // Clean vertical stack — month, day, then a fixed icon row — so the
        // holiday marker never overlaps the number and every cell is the same
        // height whether or not it has an icon.
        "relative h-auto min-w-12 flex-col justify-center gap-0.5 px-2 py-2 text-xs",
        // Today is a hairline ring around the whole cell. The previous top
        // accent bar sat on the month label and read as a strikethrough; a ring
        // cannot collide with anything, and stays clearly distinct from the
        // selected day, which is filled.
        isTodayDate && !isSelected && "ring-1 ring-inset ring-primary/60",
        className
      )}
      onClick={() => onDateSelect(date)}
      size="sm"
      title={holidayName ? [holidayName, categoryLabel].filter(Boolean).join(" — ") : undefined}
      type="button"
      variant={isSelected ? "default" : "ghost"}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "text-[10px] leading-none font-medium tracking-wide uppercase text-muted-foreground",
          isSelected && "text-primary-foreground/70"
        )}
      >
        {month}
      </span>
      <span
        aria-hidden
        className={cn(
          "text-base leading-none font-semibold tabular-nums",
          !isSelected && holiday && holidayToneClass(holiday.categories),
          !isSelected && isWeekend && "text-weekend"
        )}
      >
        {day}
      </span>
      {/* The holiday marker is absolutely positioned rather than a reserved
          row: a fixed empty row left every ordinary day with a block of dead
          space at the bottom. Out of flow, cells stay compact and identical
          in height whether or not a day carries a marker. */}
      {holiday ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-1 flex items-center justify-center",
            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
          )}
        >
          <HolidayIcon categories={holiday.categories} className="size-3" />
        </span>
      ) : null}
      <span className="sr-only">{accessibleLabel}</span>
    </Button>
  );
};
