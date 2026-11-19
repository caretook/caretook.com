import type { DoseStatus } from "@caretook/data/schema";
import type { DoseSlot, DueDoses } from "~/lib/dueDoses";

import { useEffect, useRef, useState } from "react";
import { MEDICATION_LIMITS } from "@caretook/data/schema";
import { ConfirmDialog, Field } from "~/components/ui";
import { clockTime, medicationTitle, missedText, scheduleZoneNote } from "~/lib/medicationDisplay";
import { AsNeededRow } from "./AsNeededRow";
import { TodaySlotRow } from "./TodaySlotRow";
import { useLogDose } from "./useLogDose";

type Marking = { slot: DoseSlot; status: Exclude<DoseStatus, "given"> };

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Today's slots grouped by time, in order. */
const byTime = (slots: DoseSlot[]) => {
  const groups = new Map<string, DoseSlot[]>();
  for (const slot of slots) groups.set(slot.time, [...(groups.get(slot.time) ?? []), slot]);
  return [...groups.entries()];
};

/** Skipped or Refused, with an optional note: asks, then logs it now for the slot. */
function MarkDialog({
  marking,
  groupId,
  onClose,
}: {
  marking: Marking | null;
  groupId: string;
  onClose: () => void;
}) {
  const { log, busy, error } = useLogDose(groupId);
  const [note, setNote] = useState("");
  // Closes once its write is through (a refusal stays, with its message).
  const saving = useRef(false);
  useEffect(() => {
    if (busy) saving.current = true;
    else if (saving.current) {
      saving.current = false;
      if (!error) onClose();
    }
  }, [busy, error, onClose]);

  const label = marking?.status === "refused" ? "Refused" : "Skipped";
  return (
    <ConfirmDialog
      open={marking !== null}
      title={
        marking
          ? `${label}: ${medicationTitle(marking.slot.medication)}, ${clockTime(marking.slot.time)}`
          : ""
      }
      message={error}
      confirmLabel={`Mark ${label.toLowerCase()}`}
      confirmDisabled={busy}
      onConfirm={() => {
        if (!marking) return;
        log({
          medicationId: marking.slot.medication.id,
          status: marking.status,
          scheduledFor: marking.slot.time,
          note,
        });
        setNote("");
      }}
      onClose={() => {
        setNote("");
        onClose();
      }}
    >
      <Field label="Note (optional)">
        {(control) => (
          <textarea
            {...control}
            className="textarea w-full"
            rows={2}
            maxLength={MEDICATION_LIMITS.doseNote}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-mark-note
          />
        )}
      </Field>
    </ConfirmDialog>
  );
}

/**
 * Today, at the top of the medication list: each of today's times with its
 * medications and their state (in the recipient's zone), the as-needed
 * medications with today's count, and yesterday's missed doses on one line.
 * Writers log from here; viewers see it all without controls. Hidden when
 * there's nothing scheduled or as needed.
 */
export function TodaySection({
  due,
  groupId,
  canWrite,
}: {
  due: DueDoses;
  groupId: string;
  canWrite: boolean;
}) {
  const [marking, setMarking] = useState<Marking | null>(null);
  const missed = missedText(due.missed);
  if (!due.slots.length && !due.asNeeded.length && !missed) return null;
  const zoneNote = scheduleZoneNote(due.timeZone, deviceZone());

  return (
    <section aria-labelledby="today-heading" className="space-y-3" data-today>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="today-heading" className="font-semibold">
          Today
        </h2>
        {zoneNote && <p className="text-base-content/70 text-sm">{zoneNote}</p>}
      </div>

      {byTime(due.slots).map(([time, slots]) => (
        <section key={time} aria-labelledby={`today-${time}`} className="space-y-1" data-slot-time={time}>
          <h3 id={`today-${time}`} className="text-base-content/70 text-sm font-semibold">
            {clockTime(time)}
          </h3>
          <ul className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y border">
            {slots.map((slot) => (
              <TodaySlotRow
                key={slot.medication.id}
                slot={slot}
                groupId={groupId}
                timeZone={due.timeZone}
                canWrite={canWrite}
                onMark={(s, status) => setMarking({ slot: s, status })}
              />
            ))}
          </ul>
        </section>
      ))}

      {due.asNeeded.length > 0 && (
        <section aria-labelledby="today-as-needed" className="space-y-1">
          <h3 id="today-as-needed" className="text-base-content/70 text-sm font-semibold">
            As needed
          </h3>
          <ul className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y border">
            {due.asNeeded.map((item) => (
              <AsNeededRow
                key={item.medication.id}
                item={item}
                due={due}
                groupId={groupId}
                canWrite={canWrite}
              />
            ))}
          </ul>
        </section>
      )}

      {missed && (
        <p className="text-base-content/70 text-sm" data-missed>
          {missed}
        </p>
      )}

      {canWrite && <MarkDialog marking={marking} groupId={groupId} onClose={() => setMarking(null)} />}
    </section>
  );
}
