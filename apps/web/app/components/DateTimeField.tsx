import type { ZonedDateTime } from "@internationalized/date";

import { now, parseAbsolute } from "@internationalized/date";
import { DateField, DateInput, DateSegment, FieldError, Label } from "react-aria-components";
import { localTimeZone } from "~/lib/format";

/**
 * Date and time, typed segment by segment (keyboard and screen-reader
 * friendly, from React Aria). Submits as `name`, a zoned value such as
 * "2026-11-17T15:30:00-08:00[America/Los_Angeles]"; see parseDateTimeField.
 */
export function DateTimeField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  /** ISO 8601; defaults to now. */
  defaultValue?: string;
}) {
  const initial: ZonedDateTime = defaultValue
    ? parseAbsolute(defaultValue, localTimeZone())
    : now(localTimeZone()).set({ second: 0, millisecond: 0 });

  return (
    <DateField name={name} defaultValue={initial} granularity="minute" isRequired className="fieldset">
      <Label className="fieldset-legend">{label}</Label>
      <DateInput className="input w-full">
        {(segment) => (
          <DateSegment
            segment={segment}
            className="rounded px-0.5 tabular-nums outline-none data-[focused]:bg-primary data-[focused]:text-primary-content data-[placeholder]:opacity-60"
          />
        )}
      </DateInput>
      <FieldError className="text-error text-sm" />
    </DateField>
  );
}
