import type { StripState } from "~/lib/medications/medicationStrip";

import { CheckCheck, Pill } from "lucide-react";
import { Link, useLocation } from "react-router";
import { PassUndoStatus, usePassLog } from "~/components/medications";
import { appUrls } from "~/lib/app-shell/appUrls";
import { givenAllLabel, scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { medicationStripText } from "~/lib/medications/medicationStrip";
import { STRIP_CAP, STRIP_CLASS, STRIP_ICON } from "./layout";
import { SHEET_LINK_STATE } from "./sheet";
import { useMedicationStrip } from "./useMedicationStrip";

const TONE: Record<StripState, { box: string; icon: string; action: string }> = {
  next: { box: "border-base-300 bg-base-100", icon: "text-base-content/70", action: "" },
  due: { box: "border-warning/50 bg-warning/10", icon: "text-warning", action: "btn-warning" },
  overdue: { box: "border-error/50 bg-error/10", icon: "text-error", action: "btn-error" },
};

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The medication strip (B-86): one line, there while the group has scheduled
 * medications. "Next: Evening · 20:00 · 4 meds" (quiet) until a pass is due;
 * then amber with **Given all** for writers, red once overdue (an overdue
 * earlier pass takes the line's place). For writers the pass's name opens the
 * Dose sheet on that pass (filters kept); Given all logs every open
 * medication in it and offers Undo below. Viewers get the text only.
 */
export function MedicationStrip({ groupId, canWrite }: { groupId: string; canWrite: boolean }) {
  const { strip, timeZone } = useMedicationStrip(groupId);
  const { search } = useLocation();
  const { givenAll, busy, error } = usePassLog(groupId);
  if (!strip) return null;

  const { state, pass, tomorrow } = strip;
  const { lead, title, rest, text } = medicationStripText(strip);
  const zoneNote = scheduleZoneNote(timeZone, deviceZone());
  const tone = TONE[state];
  const dueNow = state !== "next";

  return (
    <div className={STRIP_CAP}>
      <section
        aria-label="Medications"
        data-med-strip
        data-strip-state={state}
        data-strip-pass={tomorrow ? undefined : pass.key}
        // The strip family's box, in this state's colours.
        className={STRIP_CLASS.replace("border-base-300 bg-base-100", tone.box)}
      >
        <Pill className={`${STRIP_ICON} ${tone.icon}`} aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate py-1" title={zoneNote ? `${text} · ${zoneNote}` : text}>
          <span className={dueNow ? "font-semibold" : "text-base-content/70"}>{lead}:</span>{" "}
          {canWrite && !tomorrow ? (
            <Link
              to={appUrls.newDose(
                groupId,
                pass.passId
                  ? { passId: pass.passId, search }
                  : {
                      medicationId: pass.open[0]?.medication.id ?? pass.slots[0]?.medication.id,
                      slot: pass.time,
                      search,
                    },
              )}
              state={SHEET_LINK_STATE}
              preventScrollReset
              prefetch="render"
              className="link font-medium"
              aria-label={`${title}: open the Dose sheet`}
              data-strip-open
            >
              {title}
            </Link>
          ) : (
            <span className="font-medium">{title}</span>
          )}
          <span data-strip-rest> · {rest}</span>
          {zoneNote && <span className="text-base-content/60"> · {zoneNote}</span>}
        </p>
        {canWrite && dueNow && (
          <button
            type="button"
            className={`btn btn-xs shrink-0 ${tone.action}`}
            disabled={busy}
            aria-label={givenAllLabel(pass)}
            data-strip-given-all
            onClick={() => void givenAll(pass)}
          >
            <CheckCheck className="size-3.5" aria-hidden="true" />
            Given all
          </button>
        )}
      </section>
      {error && <p className="text-error mt-1 text-sm">{error}</p>}
      <PassUndoStatus groupId={groupId} className="not-empty:mt-2" />
    </div>
  );
}
