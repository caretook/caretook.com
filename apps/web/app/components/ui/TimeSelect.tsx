import { useState } from "react";
import { localTimeZone } from "~/lib/core/format";
import { currentHourTime, minuteOptions } from "~/lib/core/timeOfDay";
import { Field } from "./Field";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const hourLabel = (hour: number) =>
  new Intl.DateTimeFormat(undefined, { hour: "numeric", timeZone: "UTC" }).format(Date.UTC(2000, 0, 1, hour));

/**
 * A time of day as an hour select and a minute select (00, 15, 30, 45), native
 * so a phone shows its own picker. Submits as `name`, "HH:MM". A new required
 * time starts at the current hour in `timeZone` (the device's by default); an
 * `optional` one starts empty, with a "No time" hour. A saved off-grid time
 * such as 08:10 stays as it is and shows as an extra minute until changed.
 * Controlled with `value` and `onChange`, or uncontrolled with `defaultValue`.
 * While `disabled` it submits nothing, as a disabled input does.
 */
export function TimeSelect({
  name,
  label,
  value,
  defaultValue,
  onChange,
  timeZone,
  optional = false,
  disabled = false,
  help,
  error,
  labelHidden,
  className,
}: {
  name?: string;
  label: string;
  /** "HH:MM", or "" for none. */
  value?: string;
  defaultValue?: string;
  onChange?: (time: string) => void;
  /** The IANA zone a new time's current hour is read in. */
  timeZone?: string;
  optional?: boolean;
  disabled?: boolean;
  help?: string;
  error?: string;
  labelHidden?: boolean;
  /** Classes for the field's wrapper. */
  className?: string;
}) {
  const [own, setOwn] = useState(
    () => defaultValue || (optional ? "" : currentHourTime(timeZone ?? localTimeZone())),
  );
  const time = value ?? own;
  const hour = time.slice(0, 2);
  const minute = time.slice(3, 5);

  const change = (next: string) => {
    setOwn(next);
    onChange?.(next);
  };

  return (
    <Field
      kind="select"
      label={label}
      help={help}
      error={error}
      labelHidden={labelHidden}
      className={className}
    >
      {(control) => (
        <div className="flex gap-1" data-time-select>
          {name && <input type="hidden" name={name} value={time} disabled={disabled} />}
          <select
            {...control}
            aria-label={`${label} hour`}
            className={`${control.className} min-w-0 flex-[3]`}
            value={hour}
            disabled={disabled}
            onChange={(e) => {
              const picked = e.currentTarget.value;
              change(picked ? `${picked}:${minute || "00"}` : "");
            }}
          >
            {(optional || !hour) && <option value="">No time</option>}
            {HOURS.map((h) => {
              const id = String(h).padStart(2, "0");
              return (
                <option key={id} value={id}>
                  {hourLabel(h)}
                </option>
              );
            })}
          </select>
          <select
            aria-label={`${label} minute`}
            className={`${control.className} min-w-0 flex-[2]`}
            value={minute || "00"}
            disabled={disabled || !hour}
            onChange={(e) => change(`${hour}:${e.currentTarget.value}`)}
          >
            {minuteOptions(minute).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}
    </Field>
  );
}
