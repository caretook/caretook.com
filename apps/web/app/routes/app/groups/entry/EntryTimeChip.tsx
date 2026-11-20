import type { Schedule } from "~/lib/appointments/entrySchedule";

import { CalendarClock } from "lucide-react";
import { useRef, useState } from "react";
import { Popover } from "~/components/ui";
import { ScheduleFields } from "~/components/schedule";
import { endError, scheduleToSave } from "~/lib/appointments/entrySchedule";
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
  const error = endError(schedule);

  return (
    <>
      <ScheduleFields
        kind={kind}
        schedule={schedule}
        timeZone={timeZone}
        pickDay={pickDay}
        onChange={(next) => {
          setSchedule(next);
          onEdit(next);
        }}
      />
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
