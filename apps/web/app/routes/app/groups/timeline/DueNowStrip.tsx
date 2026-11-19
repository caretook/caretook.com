import { Pill } from "lucide-react";
import { Link, useLocation } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { dueSlotLabel } from "~/lib/medicationDisplay";
import { STRIP_CAP } from "./layout";
import { SHEET_LINK_STATE } from "./sheet";
import { useDueNow } from "./useDueNow";

const ITEM = "badge badge-lg h-auto min-h-8 gap-1.5 py-1 text-left text-sm";

/**
 * "Due now: Metformin 500 mg · 20:00 dose, overdue": today's medication
 * slots that are due or overdue, shown only while there are any. For
 * writers each opens the Dose sheet for that slot (over the timeline, filters
 * kept); viewers see them read-only.
 */
export function DueNowStrip({ groupId, canWrite }: { groupId: string; canWrite: boolean }) {
  const { slots } = useDueNow(groupId);
  const { search } = useLocation();
  if (!slots.length) return null;

  return (
    <section
      aria-label="Due now"
      data-due-now
      className={`rounded-box border-warning/40 bg-warning/10 flex flex-wrap items-center gap-2 border px-3 py-2 ${STRIP_CAP}`}
    >
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Pill className="size-4" aria-hidden="true" />
        Due now
      </p>
      <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {slots.map((slot) => {
          const label = dueSlotLabel(slot);
          const key = `${slot.medication.id}@${slot.time}`;
          const tone = slot.state === "overdue" ? "badge-error badge-soft" : "badge-warning badge-soft";
          return (
            <li key={key} data-due-slot={key} data-slot-state={slot.state}>
              {canWrite ? (
                <Link
                  to={appUrls.newDose(groupId, { medicationId: slot.medication.id, slot: slot.time, search })}
                  state={SHEET_LINK_STATE}
                  preventScrollReset
                  prefetch="render"
                  aria-label={`Log ${label}`}
                  className={`${ITEM} ${tone} hover:brightness-95`}
                >
                  {label}
                </Link>
              ) : (
                <span className={`${ITEM} ${tone}`}>{label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
