import type { LiveEntry } from "./useLiveEntry";

import { ClipboardList } from "lucide-react";
import { Button } from "~/components/ui";
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
  const { entry, canSetUp, stored, deleted } = live;
  const now = useNow(TICK_MS);
  const show =
    canSetUp &&
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
        <Button
          size="sm"
          icon={ClipboardList}
          data-prepare-visit=""
          onClick={() => prep.ask({ id: entry.id, title: entry.title })}
        >
          Prepare for this visit
        </Button>
      )}
      {prep.sheet}
    </div>
  );
}
