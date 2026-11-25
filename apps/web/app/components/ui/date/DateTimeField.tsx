import type { ZonedDateTime } from "@internationalized/date";
import type { Dispatch, KeyboardEvent, ReactNode, SetStateAction } from "react";

import { now, parseAbsolute } from "@internationalized/date";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker,
  DateSegment,
  FieldError,
  Group,
  Heading,
  Label,
} from "react-aria-components";
import { localTimeZone } from "~/lib/core/format";
import { steppedMinute } from "~/lib/core/timeOfDay";
import { buttonClass } from "../buttonClass";
import { PopoverPanel } from "../Popover";
import { RequiredLabel } from "../Required";
import { FIELD_ERROR, FIELD_LABEL } from "../styles";

/** The field's and the calendar's icon-only buttons. */
const ICON_BUTTON = buttonClass({ variant: "ghost", size: "sm", shape: "square" });

/** A segment's step keys, as React Aria's spin buttons read them: one, or a page (5 years, 2 months). */
const SEGMENT_STEPS: Record<string, { sign: 1 | -1; page: boolean }> = {
  ArrowUp: { sign: 1, page: false },
  ArrowDown: { sign: -1, page: false },
  PageUp: { sign: 1, page: true },
  PageDown: { sign: -1, page: true },
};

/** Which field's calendar is open, inside InlineCalendars. */
const InlineCalendarsContext = createContext<{
  openId: string | null;
  setOpenId: Dispatch<SetStateAction<string | null>>;
} | null>(null);

/**
 * Date and time, typed segment by segment (keyboard and screen-reader
 * friendly, from React Aria), with a "Pick a date" button that opens a
 * month calendar. Picking a day keeps the time. Submits as `name`, a zoned
 * value such as "2026-11-17T15:30:00-08:00[America/Los_Angeles]"; see
 * parseDateTimeField. Outside a form, `onChange` gets each complete value
 * as ISO 8601 (UTC). The calendar opens in its own popover, except inside
 * `InlineCalendars` (another popover's fields, the entry page's time chip),
 * where it opens inline below the field, the panel's width, one at a time.
 * `error` shows under the field (it describes the segments, which
 * are marked invalid), styled like the field primitive's. `max` (ISO 8601)
 * is the latest time it takes: later days can't be picked in the calendar,
 * and a later typed time is invalid (the form won't submit). `granularity`
 * "day" shows the date alone (an all-day item). `dayPickTime` sets the time
 * the first time the day changes (an appointment whose day is picked first
 * starts at 9:00); after that, picking a day keeps the time as usual.
 * `calendarOpen` opens the calendar as the field mounts. `onCalendarPick`
 * is called after a day is picked in the calendar (not typed), once
 * `onChange` has the new value. `timeZone` shows
 * and edits the time in that zone (the care recipient's) instead of the
 * device's. `minuteStep` makes the minute segment's step keys move on that
 * grid (:10 goes to :15 or :00); a typed or saved minute stays as it is.
 * The hour segment's arrow keys move through the day's 24 hours (11 AM up is
 * 12 PM) and never change the date (11 PM up is 12 AM that day); PageUp and
 * PageDown do the same, two hours at a time (10 AM up is 12 PM).
 * `required` puts a `*` after the label and marks the segments
 * `aria-required` (React Aria keeps the browser's popup away).
 */
export function DateTimeField({
  name,
  label,
  defaultValue,
  onChange,
  error,
  required,
  max,
  granularity = "minute",
  dayPickTime,
  calendarOpen,
  onCalendarPick,
  timeZone,
  minuteStep,
}: {
  name?: string;
  label: string;
  /** ISO 8601; defaults to now. */
  defaultValue?: string;
  onChange?: (iso: string) => void;
  error?: string;
  /** It must be set: a `*` after the label, `aria-required` on the segments. */
  required?: boolean;
  /** ISO 8601: the latest time allowed. */
  max?: string;
  granularity?: "minute" | "day";
  /** The time the first change of day sets. */
  dayPickTime?: { hour: number; minute: number };
  /** Open the calendar on mount. */
  calendarOpen?: boolean;
  /** A day was picked in the calendar (after `onChange`). */
  onCalendarPick?: () => void;
  /** The IANA zone the time is shown and typed in; the device's by default. */
  timeZone?: string;
  /** The minutes the step keys move by. */
  minuteStep?: number;
}) {
  const zone = timeZone ?? localTimeZone();
  const [value, setValue] = useState<ZonedDateTime>(() =>
    defaultValue ? parseAbsolute(defaultValue, zone) : now(zone).set({ second: 0, millisecond: 0 }),
  );
  const [timeSet, setTimeSet] = useState(!dayPickTime);
  // Inline (inside InlineCalendars), the group holds which field's calendar is open.
  const inline = useContext(InlineCalendarsContext);
  const setOpenId = inline?.setOpenId;
  const id = useId();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = inline ? inline.openId === id : ownOpen;
  const setOpen = (next: boolean) =>
    setOpenId ? setOpenId((current) => (next ? id : current === id ? null : current)) : setOwnOpen(next);
  // In its own popover it opens after mount, so inside a sheet it stacks above
  // it (a tap in the calendar then isn't a tap outside the sheet).
  useEffect(() => {
    if (!calendarOpen) return;
    if (setOpenId) {
      setOpenId(id);
      return;
    }
    const timer = setTimeout(() => setOwnOpen(true), 50);
    return () => clearTimeout(timer);
  }, [calendarOpen, setOpenId, id]);
  // An inline calendar that closes with focus in it (a day picked, Escape)
  // hands focus back to its button, as the popover does.
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    const active = document.activeElement;
    if (inline && wasOpen.current && !open && (!active || active === document.body)) button.current?.focus();
    wasOpen.current = open;
  }, [inline, open]);

  // React Aria steps a month (or year) segment without clamping the day: from
  // 31 October, ArrowDown shows 31 September, an invalid date it holds back
  // until blur. Step it here instead whenever the day would clamp, so 31 Oct
  // goes to 30 Sep and 29 Feb 2028 to 28 Feb 2027, as date pickers do (B-134).
  const stepClamped = (e: KeyboardEvent<HTMLElement>) => {
    const field = (e.target as HTMLElement).dataset.type;
    const step = SEGMENT_STEPS[e.key];
    if (!step || e.altKey || e.ctrlKey || e.metaKey) return;
    if (field === "minute" && minuteStep) {
      e.preventDefault();
      e.stopPropagation();
      change(value.set({ minute: steppedMinute(value.minute, step.sign, minuteStep) }));
      return;
    }
    // React Aria's 12-hour segment wraps inside AM or PM (11 AM up is 12 AM).
    // Take only the steps across that edge, a page (2 hours) as well as one, so
    // they move through the day's 24 hours on the same date (B-585, B-605);
    // every other step, and its typing buffer, stays React Aria's. A cleared
    // segment has no hour to step from.
    if (field === "hour") {
      const amount = step.sign * (step.page ? 2 : 1);
      const inHalfDay = (value.hour % 12) + amount;
      if ((inHalfDay >= 0 && inHalfDay < 12) || (e.target as HTMLElement).dataset.placeholder) return;
      e.preventDefault();
      e.stopPropagation();
      change(value.cycle("hour", amount));
      return;
    }
    if (field !== "month" && field !== "year") return;
    const amount = step.sign * (step.page ? (field === "year" ? 5 : 2) : 1);
    const next = value.cycle(field, amount, { round: field === "year" });
    if (next.day === value.day) return;
    e.preventDefault();
    e.stopPropagation();
    change(next);
  };

  const change = (next: ZonedDateTime | null) => {
    if (!next) return;
    let picked = next;
    if (!timeSet && next.toString().slice(0, 10) !== value.toString().slice(0, 10)) {
      setTimeSet(true);
      picked = next.set({ ...dayPickTime, second: 0, millisecond: 0 });
    }
    setValue(picked);
    onChange?.(picked.toAbsoluteString());
  };

  return (
    <DatePicker
      name={name}
      value={value}
      isOpen={open}
      onOpenChange={setOpen}
      granularity={granularity}
      maxValue={max ? parseAbsolute(max, zone) : undefined}
      isRequired={required}
      isInvalid={error ? true : undefined}
      onChange={change}
      className="fieldset"
    >
      <Label className={FIELD_LABEL}>
        <RequiredLabel required={required}>{label}</RequiredLabel>
      </Label>
      {/* min-w-0: the fieldset is a grid, whose items otherwise grow to the
          segments' width and spill out of a narrow popover (B-71). The
          segments wrap (the time drops to a second line) before they'd clip. */}
      <Group className="input h-auto min-h-10 w-full min-w-0 gap-1 py-0.5 pe-1">
        {/* Captures the step keys before the segment's own handler (stepClamped). */}
        <div className="contents" onKeyDownCapture={stepClamped}>
          <DateInput className="flex min-w-0 flex-1 flex-wrap items-center">
            {(segment) => (
              <DateSegment
                segment={segment}
                className={`rounded tabular-nums outline-none data-[focused]:bg-primary data-[focused]:text-primary-content data-[placeholder]:text-faint ${segment.type === "literal" ? "" : "px-0.5"}`}
              />
            )}
          </DateInput>
        </div>
        {/* 32 px to look at, at least 44 px to tap (the after: box, kept inside the field on the right). */}
        <Button
          ref={button}
          aria-label="Pick a date"
          // Inline, a second tap closes the calendar (the popover closes on a tap outside).
          {...(inline ? { "aria-haspopup": false, onPress: () => open && setOpen(false) } : {})}
          className={`${ICON_BUTTON} relative shrink-0 outline-offset-2 after:absolute after:-inset-y-2 after:-right-1 after:-left-2 after:z-10 data-[focus-visible]:outline-2`}
        >
          <CalendarIcon className="size-4" aria-hidden="true" />
        </Button>
      </Group>
      <FieldError className={FIELD_ERROR}>{error}</FieldError>
      {inline ? (
        open && <MonthCalendar inline onPick={onCalendarPick} />
      ) : (
        <PopoverPanel placement="bottom end">
          <MonthCalendar onPick={onCalendarPick} />
        </PopoverPanel>
      )}
    </DatePicker>
  );
}

/** The month calendar, in the field's popover or inline below it. */
function MonthCalendar({ inline = false, onPick }: { inline?: boolean; onPick?: () => void }) {
  return (
    // React Aria chains this after the picker's own onChange (which sets the value).
    <Calendar className={inline ? "w-full" : "w-72 max-w-full"} onChange={onPick && (() => onPick())}>
      <header className="mb-2 flex items-center gap-1">
        <Button slot="previous" aria-label="Previous month" className={ICON_BUTTON}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Heading className="flex-1 text-center font-semibold" />
        <Button slot="next" aria-label="Next month" className={ICON_BUTTON}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </header>
      <CalendarGrid className="w-full table-fixed border-collapse">
        <CalendarGridHeader>
          {(day) => (
            <CalendarHeaderCell className="text-base-content/60 pb-1 text-xs font-medium">
              {day}
            </CalendarHeaderCell>
          )}
        </CalendarGridHeader>
        <CalendarGridBody>
          {(date) => (
            <CalendarCell
              date={date}
              className={({ isSelected, isToday, isOutsideMonth }) =>
                [
                  buttonClass({ variant: isSelected ? "primary" : "ghost", size: "sm" }),
                  "w-full px-0 tabular-nums font-normal outline-offset-1 data-[focus-visible]:outline-2",
                  // Inline, as square as the panel's width allows, up to 44 px.
                  inline ? "mx-auto flex aspect-square h-auto max-w-11" : "",
                  // Today, when not picked: outlined in the text colour.
                  isToday && !isSelected ? "border-current" : "",
                  isOutsideMonth && !isSelected ? "text-base-content/40" : "",
                ].join(" ")
              }
            />
          )}
        </CalendarGridBody>
      </CalendarGrid>
    </Calendar>
  );
}

/**
 * Wraps fields already inside a popover (the entry page's time chip): each
 * DateTimeField in it opens its calendar inline, not as a second popover,
 * and only one at a time (opening Ends' closes Starts'). Escape anywhere in it
 * closes an open calendar first; the next closes the popover.
 */
export function InlineCalendars({ className, children }: { className?: string; children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const value = useMemo(() => ({ openId, setOpenId }), [openId]);
  return (
    <InlineCalendarsContext.Provider value={value}>
      <div
        className={className}
        // Captured, so it's taken before the outer popover's own Escape.
        onKeyDownCapture={(e) => {
          if (e.key !== "Escape" || !openId) return;
          e.stopPropagation();
          e.preventDefault();
          setOpenId(null);
        }}
      >
        {children}
      </div>
    </InlineCalendarsContext.Provider>
  );
}
