import type { Schedule } from "~/lib/appointments/entrySchedule";

import { useState } from "react";
import { DateTimeField } from "~/components/ui/date";
import {
  DEFAULT_START,
  defaultEnd,
  endError,
  withAllDay,
  withEnd,
  withStart,
} from "~/lib/appointments/entrySchedule";

/**
 * When a note or event is: its start (or day, all day), All day, and for
 * events an optional end ("Add an end time", "No end time"). Controlled: the
 * caller holds the schedule and gets each edit. An end before the start
 * shows the field's error (`endError`), which the caller checks before it
 * saves. Used by the entry page's time chip and the reschedule sheet.
 */
export function ScheduleFields({
  kind,
  schedule,
  timeZone,
  onChange,
  startLabel,
  pickDay = false,
  moveStart = withStart,
}: {
  kind: "note" | "event";
  schedule: Schedule;
  /** The entry's own zone, where an all-day item's day is. */
  timeZone: string;
  onChange: (schedule: Schedule) => void;
  /** The start field's label, when not "Starts" (events) or "When" (notes). */
  startLabel?: string;
  /** Open the calendar first, and start at 9:00 once a day is picked. */
  pickDay?: boolean;
  /** How a new start applies (the reschedule sheet keeps the event's length). */
  moveStart?: (schedule: Schedule, occurredAt: string, timeZone: string) => Schedule;
}) {
  // Each field is uncontrolled: a remount (a new key) starts it from the schedule.
  const [version, setVersion] = useState(0);
  const [endVersion, setEndVersion] = useState(0);
  const error = endError(schedule);

  const edit = (next: Schedule, remount = false) => {
    onChange(next);
    if (remount) setVersion((v) => v + 1);
  };

  return (
    <>
      <DateTimeField
        key={`start-${version}`}
        label={schedule.allDay ? "Day" : (startLabel ?? (kind === "event" ? "Starts" : "When"))}
        granularity={schedule.allDay ? "day" : "minute"}
        defaultValue={schedule.occurredAt}
        dayPickTime={pickDay && version === 0 && !schedule.allDay ? DEFAULT_START : undefined}
        calendarOpen={pickDay && version === 0}
        // A moved start can move the end too: remount the end field to show it.
        onChange={(iso) => {
          const next = moveStart(schedule, iso, timeZone);
          edit(next, false);
          if (next.endsAt !== schedule.endsAt && schedule.endsAt) setEndVersion((v) => v + 1);
        }}
      />
      <label className="label text-base-content cursor-pointer gap-2 text-sm">
        <input
          type="checkbox"
          className="toggle toggle-sm"
          checked={schedule.allDay}
          onChange={(e) => edit(withAllDay(schedule, e.target.checked, timeZone), true)}
        />
        All day
      </label>
      {kind === "event" &&
        !schedule.allDay &&
        (schedule.endsAt ? (
          <div>
            <DateTimeField
              key={`end-${version}-${endVersion}`}
              label="Ends"
              defaultValue={schedule.endsAt}
              error={error ?? undefined}
              onChange={(iso) => edit(withEnd(schedule, iso))}
            />
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => edit(withEnd(schedule, null), true)}
            >
              No end time
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => edit(withEnd(schedule, defaultEnd(schedule)), true)}
          >
            Add an end time
          </button>
        ))}
    </>
  );
}
