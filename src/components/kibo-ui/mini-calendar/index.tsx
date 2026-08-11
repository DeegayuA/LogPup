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
import {
  isLkHoliday,
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

  const contextValue: MiniCalendarContextType = {
    selectedDate: selectedDate || null,
    onDateSelect: handleDateSelect,
    startDate: currentStartDate || new Date(),
    onNavigate: handleNavigate,
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
  const holidayName = isLkHoliday(date);
  // A Sunday that is also a public holiday is still marked orange (holiday
  // wins) — the dot marker below is what keeps that distinguishable from a
  // plain Sunday for anyone who can't rely on the red/orange hue alone.
  const isWeekend = isLkSunday(date) && !holidayName;

  // The visible "Feb" / "4" fragments are marked aria-hidden and a single
  // sr-only span carries the full accessible name instead, so today/holiday
  // context is always announced regardless of what aria-label (if any) a
  // caller passes through `props`.
  const accessibleLabel = [
    new Intl.DateTimeFormat("en-US", {
      timeZone: LK_TIMEZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date),
    isTodayDate && "Today",
    holidayName,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Button
      className={cn(
        "relative h-auto min-h-11 min-w-11 flex-col gap-0.5 p-2 text-xs",
        // Today reads as a quiet underline, not a second green box, so it
        // never competes with the filled selected day.
        isTodayDate && !isSelected && "after:absolute after:bottom-0.5 after:h-0.5 after:w-4 after:rounded-full after:bg-primary after:content-['']",
        className
      )}
      onClick={() => onDateSelect(date)}
      size="sm"
      title={holidayName}
      type="button"
      variant={isSelected ? "default" : "ghost"}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "font-medium text-[10px] text-muted-foreground",
          isSelected && "text-primary-foreground/70"
        )}
      >
        {month}
      </span>
      <span
        aria-hidden
        className={cn(
          "font-semibold text-sm",
          !isSelected && holidayName && "text-holiday",
          !isSelected && isWeekend && "text-weekend"
        )}
      >
        {day}
      </span>
      {holidayName ? (
        <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-holiday" />
      ) : null}
      <span className="sr-only">{accessibleLabel}</span>
    </Button>
  );
};
