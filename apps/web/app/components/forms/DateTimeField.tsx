import type { ZonedDateTime } from "@internationalized/date";

import { now, parseAbsolute } from "@internationalized/date";
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
  Dialog,
  FieldError,
  Group,
  Heading,
  Label,
  Popover,
} from "react-aria-components";
import { localTimeZone } from "~/lib/format";

/**
 * Date and time, typed segment by segment (keyboard and screen-reader
 * friendly, from React Aria), with a "Pick a date" button that opens a
 * month calendar. Picking a day keeps the time. Submits as `name`, a zoned
 * value such as "2026-11-17T15:30:00-08:00[America/Los_Angeles]"; see
 * parseDateTimeField. Outside a form, `onChange` gets each complete value
 * as ISO 8601 (UTC). Inside another popover (the entry page's time chip),
 * the calendar opens as a nested popover and closing it leaves the outer
 * one open.
 */
export function DateTimeField({
  name,
  label,
  defaultValue,
  onChange,
}: {
  name?: string;
  label: string;
  /** ISO 8601; defaults to now. */
  defaultValue?: string;
  onChange?: (iso: string) => void;
}) {
  const initial: ZonedDateTime = defaultValue
    ? parseAbsolute(defaultValue, localTimeZone())
    : now(localTimeZone()).set({ second: 0, millisecond: 0 });

  return (
    <DatePicker
      name={name}
      defaultValue={initial}
      granularity="minute"
      isRequired
      onChange={(value) => {
        if (value && onChange) onChange(value.toAbsoluteString());
      }}
      className="fieldset"
    >
      <Label className="fieldset-legend">{label}</Label>
      <Group className="input w-full pe-1">
        <DateInput className="flex min-w-0 flex-1">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="rounded px-0.5 tabular-nums outline-none data-[focused]:bg-primary data-[focused]:text-primary-content data-[placeholder]:opacity-60"
            />
          )}
        </DateInput>
        <Button
          aria-label="Pick a date"
          className="btn btn-ghost btn-sm btn-square outline-offset-2 data-[focus-visible]:outline-2"
        >
          <CalendarIcon className="size-4" aria-hidden="true" />
        </Button>
      </Group>
      <FieldError className="text-error text-sm" />
      <Popover
        placement="bottom end"
        className="rounded-box border-base-300 bg-base-100 max-w-[calc(100vw-2rem)] border p-3 shadow-lg"
      >
        <Dialog className="outline-none">
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
        </Dialog>
      </Popover>
    </DatePicker>
  );
}
