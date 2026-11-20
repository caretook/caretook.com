import type { RescheduleTarget } from "~/components/entry";

import { useState } from "react";
import { useNavigate } from "react-router";
import { Sheet } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { endError, sameSchedule } from "~/lib/appointments/entrySchedule";
import { keepOldByDefault, scheduleOf, withMovedStart } from "~/lib/appointments/eventReschedule";
import { getSync } from "~/lib/sync";
import { rescheduleEvent } from "~/lib/appointments/appointments.sync";
import { upcomingTitle } from "~/lib/appointments/upcomingLabels";
import { ScheduleFields } from "./ScheduleFields";

/**
 * Rescheduling an event, opened in place from its ⋯ menu (the timeline,
 * Upcoming and the entry page): the new time (its end moves with it, so the
 * event keeps its length; all day and the end can change too), then "Keep
 * the old one as cancelled" (on for an event still to come or already
 * cancelled, off for a past one), and Reschedule.
 *
 * Off, the event just moves: same id, notes and providers; the sheet closes.
 * On, a new event takes over the title, place, providers and notes, the old
 * one stays cancelled and links to it, and the sheet opens the new event.
 * Both are local writes (`rescheduleEvent`), so they work offline.
 */
export function RescheduleSheet({
  entry,
  groupId,
  onClose,
}: {
  entry: RescheduleTarget;
  groupId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [initial] = useState(() => scheduleOf(entry));
  const [schedule, setSchedule] = useState(initial);
  const [keepOld, setKeepOld] = useState(() => keepOldByDefault(entry, new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endProblem = endError(schedule);

  const save = async () => {
    if (busy || endProblem) return;
    // Nothing to move: nothing to write.
    if (!keepOld && sameSchedule(schedule, initial)) return onClose();
    setBusy(true);
    const res = await rescheduleEvent(getSync(), entry.id, { ...schedule, keepOldAsCancelled: keepOld });
    setBusy(false);
    if (!res.ok) return setError(res.issues[0]?.message ?? res.error);
    onClose();
    if (res.id !== entry.id) void navigate(appUrls.entry(groupId, res.id));
  };

  return (
    <Sheet isOpen onOpenChange={(open) => !open && onClose()} title={`Reschedule ${upcomingTitle(entry)}`}>
      <form
        className="space-y-3"
        data-reschedule-sheet=""
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <ScheduleFields
          kind="event"
          schedule={schedule}
          timeZone={entry.timeZone}
          startLabel="New time"
          moveStart={withMovedStart}
          onChange={(next) => {
            setSchedule(next);
            setError(null);
          }}
        />
        <label className="label text-base-content cursor-pointer items-start gap-2 text-sm whitespace-normal">
          <input
            type="checkbox"
            className="checkbox checkbox-sm mt-0.5"
            checked={keepOld}
            data-keep-old=""
            aria-describedby="reschedule-keep-help"
            onChange={(e) => setKeepOld(e.target.checked)}
          />
          <span>
            Keep the old one as cancelled
            <span id="reschedule-keep-help" className="text-base-content/70 block">
              {keepOld
                ? "It stays, struck through, linking to the new one. Its notes and providers carry over."
                : "The event just moves to the new time, with its notes and providers."}
            </span>
          </span>
        </label>
        {error && (
          <p role="alert" className="text-error text-sm">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !!endProblem}>
          {busy ? "Rescheduling…" : "Reschedule"}
        </button>
      </form>
    </Sheet>
  );
}
