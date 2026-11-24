import type { MarkStatus } from "./DoseSlotRow";
import type { DoseSlot } from "~/lib/medications/dueDoses";
import type { DuePass, PassState } from "~/lib/medications/duePasses";
import type { BadgeTone } from "~/components/ui";

import { CheckCheck } from "lucide-react";
import { useId, useState } from "react";
import { Badge, Button, Chevron, Collapse, Message, STATUS_TONE, TITLE_SECTION } from "~/components/ui";
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
import { PassExtraDoseWarnings } from "./ExtraDoseWarning";
import { usePassLog } from "./usePassLog";

/** A pass state's badge tone (here and on the Passes tab). */
export const PASS_TONE: Record<PassState, BadgeTone> = {
  upcoming: "neutral",
  due: STATUS_TONE.dueSoon,
  overdue: STATUS_TONE.overdue,
  done: STATUS_TONE.done,
};

/**
 * One of today's passes (Today, the Dose sheet): its name and time, its
 * state, who logged what so far, and, for writers while anything in it is
 * open, **Given all** (every open medication, given now; then Undo). The
 * expand lists each medication with its own Given, Skipped and Refused, which
 * join the pass's round. A medication given twice in it is called out on
 * the card. Viewers see the same without logging controls.
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
          <h3 className={TITLE_SECTION}>
            <span data-pass-name>{title}</span>{" "}
            <time className="text-muted font-normal tabular-nums">{clockTime(pass.time)}</time>
          </h3>
          <p className="text-muted text-sm" data-pass-summary>
            {logged ?? listText(pass.slots.map((s) => medicationTitle(s.medication)))}
          </p>
        </div>
        <Badge tone={PASS_TONE[pass.state]} className="shrink-0" data-pass-badge="">
          {passStateText(pass)}
        </Badge>
        <div className="flex items-center gap-1">
          {canWrite && pass.open.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              icon={CheckCheck}
              disabled={busy}
              aria-label={givenAllLabel(pass)}
              data-given-all=""
              onClick={() => void givenAll(pass)}
            >
              Given all
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            expanded={expanded}
            controls={listId}
            aria-label={`${expanded ? "Hide" : "Show"} each medication: ${title}`}
            data-pass-expand=""
            onClick={() => setExpanded((e) => !e)}
          >
            <Chevron open={expanded} closed="down" />
          </Button>
        </div>
        {/* On the card itself, so a double dose reads without opening it. */}
        <PassExtraDoseWarnings pass={pass} timeZone={timeZone} className="w-full" />
        {error && (
          <Message tone="error" className="w-full">
            {error}
          </Message>
        )}
      </div>
      <Collapse open={expanded} id={listId}>
        <ul className="border-base-300 divide-base-300 divide-y border-t">
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
      </Collapse>
    </section>
  );
}
