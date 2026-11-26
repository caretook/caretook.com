import type { Schedule } from "~/lib/appointments/entrySchedule";

import { useState } from "react";
import { Button, ToggleField } from "~/components/ui";
import { DateTimeField } from "~/components/ui/date";
import { localTimeZone } from "~/lib/core/format";
import { currentHourIn } from "~/lib/core/timeOfDay";
import {
  defaultEnd,
  endError,
  startError,
  withAllDay,
  withEnd,
  withStart,
} from "~/lib/appointments/entrySchedule";

/** An event's minute segment steps by a quarter hour. */
const EVENT_MINUTE_STEP = 15;

/**
 * When a note or event is: its start (or day, all day), All day, and for
 * events an optional end ("Add an end time", "No end time"). Controlled: the
 * caller holds the schedule and gets each edit. An end before the start
 * shows the field's error (`endError`), and a note's start ahead of now
 * shows `startError` (the field maxes at now); the caller checks both before it
 * saves. An event's minutes step by 15 (a saved minute stays) and a time it
 * has to invent is the current hour at :00. Used by the entry page's time chip
 * and the reschedule sheet.
 */
export function ScheduleFields({
  kind,
  schedule,
  timeZone,
  onChange,
  startLabel,
  pickDay = false,
  onDayPick,
  moveStart = withStart,
}: {
  kind: "note" | "event";
  schedule: Schedule;
  /** The entry's own zone, where an all-day item's day is. */
  timeZone: string;
  onChange: (schedule: Schedule) => void;
  /** The start field's label, when not "Starts" (events) or "When" (notes). */
  startLabel?: string;
  /** Open the calendar first, and start at the current hour once a day is picked. */
  pickDay?: boolean;
  /** A day was picked in the start field's calendar (after `onChange`; typing doesn't count). */
  onDayPick?: () => void;
  /** How a new start applies (the reschedule sheet keeps the event's length). */
  moveStart?: (schedule: Schedule, occurredAt: string, timeZone: string) => Schedule;
}) {
  // Each field is uncontrolled: a remount (a new key) starts it from the schedule.
  const [version, setVersion] = useState(0);
  const [endVersion, setEndVersion] = useState(0);
  const error = endError(schedule);
  // A note is what happened: its start maxes at now (fixed at mount) and shows the message past it.
  const [now] = useState(() => new Date());
  const past = kind === "note";
  const futureError = startError(kind, schedule, now);

  const minuteStep = kind === "event" ? EVENT_MINUTE_STEP : undefined;

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
        // The field shows the device's zone, so its current hour is the device's.
        dayPickTime={
          pickDay && version === 0 && !schedule.allDay
            ? { hour: currentHourIn(localTimeZone()), minute: 0 }
            : undefined
        }
        minuteStep={minuteStep}
        calendarOpen={pickDay && version === 0}
        onCalendarPick={onDayPick}
        max={past ? now.toISOString() : undefined}
        error={futureError ?? undefined}
        required
        // A moved start can move the end too: remount the end field to show it.
        onChange={(iso) => {
          const next = moveStart(schedule, iso, timeZone);
          edit(next, false);
          if (next.endsAt !== schedule.endsAt && schedule.endsAt) setEndVersion((v) => v + 1);
        }}
      />
      <ToggleField
        label="All day"
        checked={schedule.allDay}
        onChange={(e) =>
          edit(
            withAllDay(
              schedule,
              e.target.checked,
              timeZone,
              // withAllDay places it in the entry's zone, so the hour is that zone's.
              kind === "event" ? { hour: currentHourIn(timeZone), minute: 0 } : undefined,
            ),
            true,
          )
        }
      />
      {kind === "event" &&
        !schedule.allDay &&
        (schedule.endsAt ? (
          <div>
            <DateTimeField
              key={`end-${version}-${endVersion}`}
              label="Ends"
              minuteStep={minuteStep}
              defaultValue={schedule.endsAt}
              error={error ?? undefined}
              onChange={(iso) => edit(withEnd(schedule, iso))}
            />
            <Button variant="ghost" size="xs" onClick={() => edit(withEnd(schedule, null), true)}>
              No end time
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => edit(withEnd(schedule, defaultEnd(schedule)), true)}
          >
            Add an end time
          </Button>
        ))}
    </>
  );
}
