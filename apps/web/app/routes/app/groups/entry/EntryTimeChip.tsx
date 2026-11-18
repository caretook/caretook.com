import { CalendarClock } from "lucide-react";
import { useRef } from "react";
import { Popover } from "~/components/ui";
import { DateTimeField } from "~/components/ui/date";
import { EntryTime } from "./EntryHeader";

/**
 * The entry header's time, as a chip ("Today, 2:15 PM") that opens the date
 * and time field in a popover. The new time is committed when the popover
 * closes (Done, Esc or a tap outside), so typing a segment at a time
 * doesn't move the entry around the timeline on every keystroke.
 */
export function EntryTimeChip({
  occurredAt,
  onChange,
}: {
  /** ISO 8601. */
  occurredAt: string;
  /** Called with the new time (ISO 8601) when it differs from `occurredAt`. */
  onChange: (occurredAt: string) => void;
}) {
  const pending = useRef<string | null>(null);

  const commit = () => {
    const next = pending.current;
    pending.current = null;
    if (next && new Date(next).getTime() !== new Date(occurredAt).getTime()) onChange(next);
  };

  return (
    <Popover
      label="Change when it happened"
      dialogLabel="When it happened"
      onOpenChange={(open) => !open && commit()}
      className="badge badge-ghost hover:bg-base-300 h-auto cursor-pointer gap-1 py-0.5 outline-offset-2 data-[focus-visible]:outline-2"
      trigger={
        <>
          <CalendarClock className="size-3.5" aria-hidden="true" />
          <EntryTime occurredAt={occurredAt} />
        </>
      }
    >
      {(close) => (
        <>
          <DateTimeField label="When" defaultValue={occurredAt} onChange={(iso) => (pending.current = iso)} />
          <div className="flex justify-end">
            <button type="button" className="btn btn-primary btn-sm" onClick={close}>
              Done
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}
