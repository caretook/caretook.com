import type { MarkStatus } from "./DoseSlotRow";
import type { DoseSlot } from "~/lib/medications/dueDoses";
import type { DuePass, PassState } from "~/lib/medications/duePasses";

import { CheckCheck, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import {
  clockTime,
  givenAllLabel,
  listText,
  medicationTitle,
  passLoggedText,
  passStateText,
  passTitle,
} from "~/lib/medications/medicationDisplay";
import { passLogIdFor } from "~/lib/medications/duePasses";
import { DoseSlotRow } from "./DoseSlotRow";
import { usePassLog } from "./usePassLog";

const BADGE: Record<PassState, string> = {
  upcoming: "badge-ghost",
  due: "badge-warning",
  overdue: "badge-error",
  done: "badge-primary badge-soft",
};

/**
 * One of today's passes (Today, the Dose sheet): its name and time, its
 * state, who logged what so far, and, for writers while anything in it is
 * open, **Given all** (every open medication, given now; then Undo). The
 * expand lists each medication with its own Given, Skipped and Refused, which
 * join the pass's round. Viewers see the same without logging controls.
 */
export function PassCard({
  pass,
  groupId,
  timeZone,
  canWrite,
  nameOf,
  onMark,
  defaultExpanded = false,
}: {
  pass: DuePass;
  groupId: string;
  timeZone: string;
  canWrite: boolean;
  /** A user's name as it reads here ("you" for the viewer). */
  nameOf: (userId: string) => string;
  onMark: (slot: DoseSlot, status: MarkStatus, passLogId: string) => void;
  defaultExpanded?: boolean;
}) {
  const { givenAll, busy, error } = usePassLog(groupId);
  const [expanded, setExpanded] = useState(defaultExpanded);
  // The round a single mark joins: the pass's, else the one its key and day
  // derive, so two members' marks in one pass fold into one timeline item.
  const passLogId = passLogIdFor(pass);
  const listId = useId();
  const title = passTitle(pass);
  const logged = passLoggedText(pass, nameOf);

  return (
    <section
      aria-label={`${title}, ${clockTime(pass.time)}`}
      className="rounded-box border-base-300 bg-base-100 border"
      data-pass={pass.key}
      data-pass-state={pass.state}
      data-pass-partly={pass.partly ? "" : undefined}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">
            <span data-pass-name>{title}</span>{" "}
            <time className="text-base-content/70 font-normal tabular-nums">{clockTime(pass.time)}</time>
          </h3>
          <p className="text-base-content/70 text-sm" data-pass-summary>
            {logged ?? listText(pass.slots.map((s) => medicationTitle(s.medication)))}
          </p>
        </div>
        <span className={`badge badge-sm shrink-0 ${BADGE[pass.state]}`} data-pass-badge>
          {passStateText(pass)}
        </span>
        <div className="flex items-center gap-1">
          {canWrite && pass.open.length > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              aria-label={givenAllLabel(pass)}
              data-given-all
              onClick={() => void givenAll(pass)}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
              Given all
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-label={`${expanded ? "Hide" : "Show"} each medication: ${title}`}
            data-pass-expand
            onClick={() => setExpanded((e) => !e)}
          >
            <ChevronDown
              className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
        {error && (
          <p role="alert" className="text-error w-full text-sm">
            {error}
          </p>
        )}
      </div>
      <ul id={listId} hidden={!expanded} className="border-base-200 divide-base-200 divide-y border-t">
        {pass.slots.map((slot) => (
          <DoseSlotRow
            key={slot.medication.id}
            slot={slot}
            groupId={groupId}
            timeZone={timeZone}
            canWrite={canWrite}
            passLogId={passLogId}
            loggedBy={slot.dose?.createdBy ? nameOf(slot.dose.createdBy) : null}
            onMark={(s, status) => onMark(s, status, passLogId)}
          />
        ))}
      </ul>
    </section>
  );
}
