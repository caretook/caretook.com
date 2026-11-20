import type { LiveEntry } from "./useLiveEntry";

import { ClipboardList } from "lucide-react";
import { useVisitPrep } from "~/components/visitPrep";
import { useNow } from "~/lib/live-notes/editors.sync";
import { isUpcoming } from "~/lib/appointments/upcoming";

/** Re-check every minute whether the appointment is still to come. */
const TICK_MS = 60_000;

/**
 * "Prepare for this visit" on an upcoming appointment's page, for writers
 * (not on a cancelled or rescheduled one): opens the visit prep sheet, whose
 * section goes at the top of these notes.
 */
export function EntryVisitPrep({ live, groupId }: { live: LiveEntry; groupId: string }) {
  const { entry, canWrite, stored, deleted } = live;
  const now = useNow(TICK_MS);
  const show =
    canWrite &&
    stored &&
    !deleted &&
    entry.kind === "event" &&
    !entry.cancelledAt &&
    !entry.rescheduledTo &&
    isUpcoming(entry, new Date(now));
  const prep = useVisitPrep(groupId, show);
  if (!show && !prep.sheet) return null;
  return (
    <div className="print:hidden">
      {show && (
        <button
          type="button"
          className="btn btn-outline btn-sm gap-1.5"
          data-prepare-visit=""
          onClick={() => prep.ask({ id: entry.id, title: entry.title })}
        >
          <ClipboardList className="size-4" aria-hidden="true" />
          Prepare for this visit
        </button>
      )}
      {prep.sheet}
    </div>
  );
}
