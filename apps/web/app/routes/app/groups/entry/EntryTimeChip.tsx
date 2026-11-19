import type { Schedule } from "~/lib/entrySchedule";

import { CalendarClock } from "lucide-react";
import { useRef, useState } from "react";
import { Popover } from "~/components/ui";
import { DateTimeField } from "~/components/ui/date";
import {
  DEFAULT_START,
  defaultEnd,
  endError,
  scheduleToSave,
  withAllDay,
  withEnd,
  withStart,
} from "~/lib/entrySchedule";
import { EntryTime } from "./EntryHeader";

/**
 * The entry header's time, as a chip ("Today, 2:15 PM", "Tomorrow, 10:30
 * AM–11:15 AM", "Friday, Nov 20 · All day") that opens the schedule in a
 * popover: when it starts, all day, and (events) an optional end. The change
 * is committed when the popover closes (Done, Esc or a tap outside), so
 * typing a segment at a time doesn't move the entry around the timeline on
 * every keystroke. An end before the start shows the field's error: Done
 * stays open, and closing otherwise keeps what was saved.
 *
 * `pickDay` (a draft opened by Add appointment or Add reminder) opens the
 * popover and its calendar on arrival, and the first day picked starts at
 * 9:00. Later openings behave as usual.
 */
export function EntryTimeChip({
  kind,
  schedule,
  timeZone,
  pickDay = false,
  onChange,
}: {
  kind: "note" | "event";
  schedule: Schedule;
  /** The entry's own zone, where an all-day item's day is. */
  timeZone: string;
  pickDay?: boolean;
  /** Called with the new schedule when it differs from `schedule`. */
  onChange: (schedule: Schedule) => void;
}) {
  const edited = useRef<Schedule | null>(null);
  // Only the first opening asks for the day (calendar open, 9:00 once picked).
  const [askDay, setAskDay] = useState(pickDay);

  const commit = () => {
    setAskDay(false);
    const next = edited.current && scheduleToSave(edited.current, schedule);
    edited.current = null;
    if (next) onChange(next);
  };

  return (
    <Popover
      label="Change when it happened"
      dialogLabel="When it happened"
      defaultOpen={pickDay}
      onOpenChange={(open) => !open && commit()}
      className="badge badge-ghost hover:bg-base-300 h-auto cursor-pointer gap-1 py-0.5 text-start outline-offset-2 data-[focus-visible]:outline-2"
      trigger={
        <>
          <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
          <EntryTime {...schedule} timeZone={timeZone} />
        </>
      }
    >
      {(close) => (
        <SchedulePanel
          kind={kind}
          initial={schedule}
          timeZone={timeZone}
          pickDay={askDay}
          onEdit={(next) => (edited.current = next)}
          onDone={close}
        />
      )}
    </Popover>
  );
}

/** The popover's fields. Its state lives here while it's open; the chip saves it on close. */
function SchedulePanel({
  kind,
  initial,
  timeZone,
  pickDay,
  onEdit,
  onDone,
}: {
  kind: "note" | "event";
  initial: Schedule;
  timeZone: string;
  pickDay: boolean;
  onEdit: (schedule: Schedule) => void;
  onDone: () => void;
}) {
  const [schedule, setSchedule] = useState(initial);
  // Each field is uncontrolled: a remount (a new key) starts it from the schedule.
  const [version, setVersion] = useState(0);
  const error = endError(schedule);

  const edit = (next: Schedule, remount = false) => {
    setSchedule(next);
    onEdit(next);
    if (remount) setVersion((v) => v + 1);
  };

  return (
    <>
      <DateTimeField
        key={`start-${version}`}
        label={schedule.allDay ? "Day" : kind === "event" ? "Starts" : "When"}
        granularity={schedule.allDay ? "day" : "minute"}
        defaultValue={schedule.occurredAt}
        dayPickTime={pickDay && version === 0 && !schedule.allDay ? DEFAULT_START : undefined}
        calendarOpen={pickDay && version === 0}
        onChange={(iso) => edit(withStart(schedule, iso, timeZone))}
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
              key={`end-${version}`}
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
      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          // An end before the start keeps the popover open, with the field's error.
          onClick={() => !error && onDone()}
        >
          Done
        </button>
      </div>
    </>
  );
}
