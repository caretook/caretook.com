import type { ZonedDateTime } from "@internationalized/date";

import { now, parseAbsolute } from "@internationalized/date";
import { useEffect, useState } from "react";
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
import { localTimeZone } from "~/lib/format";
import { PopoverPanel } from "../Popover";
import { FIELD_ERROR, FIELD_LABEL } from "../styles";

/**
 * Date and time, typed segment by segment (keyboard and screen-reader
 * friendly, from React Aria), with a "Pick a date" button that opens a
 * month calendar. Picking a day keeps the time. Submits as `name`, a zoned
 * value such as "2026-11-17T15:30:00-08:00[America/Los_Angeles]"; see
 * parseDateTimeField. Outside a form, `onChange` gets each complete value
 * as ISO 8601 (UTC). Inside another popover (the entry page's time chip),
 * the calendar opens as a nested popover and closing it leaves the outer
 * one open. `error` shows under the field (it describes the segments, which
 * are marked invalid), styled like the field primitive's. `max` (ISO 8601)
 * is the latest time it takes: later days can't be picked in the calendar,
 * and a later typed time is invalid (the form won't submit). `granularity`
 * "day" shows the date alone (an all-day item). `dayPickTime` sets the time
 * the first time the day changes (an appointment whose day is picked first
 * starts at 9:00); after that, picking a day keeps the time as usual.
 * `calendarOpen` opens the calendar as the field mounts. `timeZone` shows
 * and edits the time in that zone (the care recipient's) instead of the
 * device's.
 */
export function DateTimeField({
  name,
  label,
  defaultValue,
  onChange,
  error,
  max,
  granularity = "minute",
  dayPickTime,
  calendarOpen,
  timeZone,
}: {
  name?: string;
  label: string;
  /** ISO 8601; defaults to now. */
  defaultValue?: string;
  onChange?: (iso: string) => void;
  error?: string;
  /** ISO 8601: the latest time allowed. */
  max?: string;
  granularity?: "minute" | "day";
  /** The time the first change of day sets. */
  dayPickTime?: { hour: number; minute: number };
  /** Open the calendar on mount. */
  calendarOpen?: boolean;
  /** The IANA zone the time is shown and typed in; the device's by default. */
  timeZone?: string;
}) {
  const zone = timeZone ?? localTimeZone();
  const [value, setValue] = useState<ZonedDateTime>(() =>
    defaultValue ? parseAbsolute(defaultValue, zone) : now(zone).set({ second: 0, millisecond: 0 }),
  );
  const [timeSet, setTimeSet] = useState(!dayPickTime);
  // Opened after mount, so inside another popover it stacks above it (a tap in
  // the calendar then isn't a tap outside the outer one).
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!calendarOpen) return;
    const timer = setTimeout(() => setOpen(true), 50);
    return () => clearTimeout(timer);
  }, [calendarOpen]);

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
      isRequired
      isInvalid={error ? true : undefined}
      onChange={change}
      className="fieldset"
    >
      <Label className={FIELD_LABEL}>{label}</Label>
      {/* min-w-0: the fieldset is a grid, whose items otherwise grow to the
          segments' width and spill out of a narrow popover (B-71). The
          segments wrap (the time drops to a second line) before they'd clip. */}
      <Group className="input h-auto min-h-10 w-full min-w-0 gap-1 py-0.5 pe-1">
        <DateInput className="flex min-w-0 flex-1 flex-wrap items-center">
          {(segment) => (
            <DateSegment
              segment={segment}
              className={`rounded tabular-nums outline-none data-[focused]:bg-primary data-[focused]:text-primary-content data-[placeholder]:opacity-60 ${segment.type === "literal" ? "" : "px-0.5"}`}
            />
          )}
        </DateInput>
        {/* 32 px to look at, at least 44 px to tap (the after: box, kept inside the field on the right). */}
        <Button
          aria-label="Pick a date"
          className="btn btn-ghost btn-sm btn-square relative shrink-0 outline-offset-2 after:absolute after:-inset-y-2 after:-right-1 after:-left-2 after:z-10 data-[focus-visible]:outline-2"
        >
          <CalendarIcon className="size-4" aria-hidden="true" />
        </Button>
      </Group>
      <FieldError className={FIELD_ERROR}>{error}</FieldError>
      <PopoverPanel placement="bottom end">
        <Calendar className="w-72 max-w-full">
          <header className="mb-2 flex items-center gap-1">
            <Button slot="previous" aria-label="Previous month" className="btn btn-ghost btn-sm btn-square">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Heading className="flex-1 text-center font-semibold" />
            <Button slot="next" aria-label="Next month" className="btn btn-ghost btn-sm btn-square">
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </header>
          <CalendarGrid className="w-full border-collapse">
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
                      "btn btn-sm w-full px-0 tabular-nums font-normal outline-offset-1 data-[focus-visible]:outline-2",
                      isSelected ? "btn-primary" : isToday ? "btn-outline" : "btn-ghost",
                      isOutsideMonth && !isSelected ? "text-base-content/40" : "",
                    ].join(" ")
                  }
                />
              )}
            </CalendarGridBody>
          </CalendarGrid>
        </Calendar>
      </PopoverPanel>
    </DatePicker>
  );
}
