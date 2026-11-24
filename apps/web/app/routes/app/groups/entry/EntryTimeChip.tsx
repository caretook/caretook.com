import type { Schedule } from "~/lib/appointments/entrySchedule";

import { CalendarClock } from "lucide-react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button, Popover } from "~/components/ui";
import { ScheduleFields } from "~/components/schedule";
import { InlineCalendars } from "~/components/ui/date";
import { endError, scheduleToSave, startError } from "~/lib/appointments/entrySchedule";
import { EntryTime } from "./EntryHeader";
import { ENTRY_CHIP } from "./entryPage";

/**
 * The entry header's time, as a chip ("Today, 2:15 PM", "Tomorrow, 10:30
 * AM–11:15 AM", "Friday, Nov 20 · All day") that opens the schedule in a
 * popover: when it starts, all day, and (events) an optional end. The change
 * is committed when the popover closes (Done, Esc or a tap outside), so
 * typing a segment at a time doesn't move the entry around the timeline on
 * every keystroke. An end before the start shows the field's error: Done
 * stays open, and closing otherwise keeps what was saved.
 *
 * `pickDay` (a draft opened by Add event) opens the popover and its
 * calendar on arrival, and the first day picked starts at the current hour.
 * That first pick in the calendar (B-692) also closes the popover, saving
 * the schedule, then calls `onFirstDayPick` inside the same tap (the page
 * focuses the title, and iOS opens a keyboard only within a gesture; focus
 * moved out of the popover isn't returned to the chip). Typing the
 * date, and later openings, behave as usual.
 */
export function EntryTimeChip({
  kind,
  schedule,
  timeZone,
  pickDay = false,
  onFirstDayPick,
  onChange,
}: {
  kind: "note" | "event";
  schedule: Schedule;
  /** The entry's own zone, where an all-day item's day is. */
  timeZone: string;
  pickDay?: boolean;
  /** `pickDay`'s first day picked in the calendar, just before the popover closes. */
  onFirstDayPick?: () => void;
  /** Called with the new schedule when it differs from `schedule`. */
  onChange: (schedule: Schedule) => void;
}) {
  const edited = useRef<Schedule | null>(null);
  // Only the first opening asks for the day (calendar open, 9:00 once picked).
  const [askDay, setAskDay] = useState(pickDay);

  const commit = () => {
    setAskDay(false);
    const next = edited.current && scheduleToSave(edited.current, schedule, kind);
    edited.current = null;
    if (next) onChange(next);
  };

  return (
    <Popover
      label="Change when it happened"
      dialogLabel="When it happened"
      defaultOpen={pickDay}
      onOpenChange={(open) => !open && commit()}
      className={`${ENTRY_CHIP} text-start`}
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
          onDayPick={
            askDay
              ? () => {
                  // Closed now, so the popover no longer holds focus in; then the
                  // page moves it, still inside the tap.
                  flushSync(close);
                  onFirstDayPick?.();
                }
              : undefined
          }
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
  onDayPick,
  onDone,
}: {
  kind: "note" | "event";
  initial: Schedule;
  timeZone: string;
  pickDay: boolean;
  onEdit: (schedule: Schedule) => void;
  onDayPick?: () => void;
  onDone: () => void;
}) {
  const [schedule, setSchedule] = useState(initial);
  const error = endError(schedule) ?? startError(kind, schedule);

  // The calendars open inline: the panel is already a popover.
  return (
    <InlineCalendars className="space-y-2">
      <ScheduleFields
        kind={kind}
        schedule={schedule}
        timeZone={timeZone}
        pickDay={pickDay}
        onDayPick={onDayPick}
        onChange={(next) => {
          setSchedule(next);
          onEdit(next);
        }}
      />
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="sm"
          // An end before the start keeps the popover open, with the field's error.
          onClick={() => !error && onDone()}
        >
          Done
        </Button>
      </div>
    </InlineCalendars>
  );
}
