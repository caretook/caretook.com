import type { DoseSlot, DueDoses } from "~/lib/medications/dueDoses";
import type { DuePass } from "~/lib/medications/duePasses";
import type { Marking } from "~/components/medications";
import type { PassLike } from "@caretook/data/schema";

import { useMemo, useState } from "react";
import { List, TITLE_SECTION, TITLE_SUB } from "~/components/ui";
import { DoseSlotRow, MarkDoseDialog, PassCard, UndoToastProvider } from "~/components/medications";
import { duePasses, isNamedPass } from "~/lib/medications/duePasses";
import { clockTime, missedText, scheduleZoneNote } from "~/lib/medications/medicationDisplay";
import { useMemberNames } from "~/lib/care-groups/memberNames.sync";
import { AsNeededRow } from "./AsNeededRow";

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Today in order: each named pass on its own, and times of their own grouped by time, as before. */
type Block = { type: "pass"; pass: DuePass } | { type: "time"; time: string; slots: DoseSlot[] };
const blocksOf = (passes: readonly DuePass[]): Block[] => {
  const blocks: Block[] = [];
  for (const pass of passes) {
    if (isNamedPass(pass)) {
      blocks.push({ type: "pass", pass });
      continue;
    }
    const last = blocks.at(-1);
    if (last?.type === "time" && last.time === pass.time) last.slots.push(...pass.slots);
    else blocks.push({ type: "time", time: pass.time, slots: [...pass.slots] });
  }
  return blocks;
};

/**
 * Today, at the top of the medication list, by pass (in the recipient's
 * zone): each pass with its state, who logged what, Given all for writers
 * and an expand with each medication; times of their own as
 * before, each medication with its state; the as-needed medications with
 * today's count; and yesterday's missed doses on one line. Viewers see it
 * all without logging controls. Hidden when there's nothing scheduled or as
 * needed. Every dose logged here offers Undo as a toast ("Tylenol logged ·
 * Undo", `UndoToastProvider`), not an inline line.
 */
export function TodaySection({
  due,
  passes,
  groupId,
  userId,
  canWrite,
}: {
  due: DueDoses;
  /** The group's passes (deleted ones too), for their names. */
  passes: readonly Pick<PassLike, "id" | "name" | "sortOrder">[];
  groupId: string;
  userId: string;
  canWrite: boolean;
}) {
  const [marking, setMarking] = useState<Marking | null>(null);
  const nameOf = useMemberNames(groupId, userId);
  const blocks = useMemo(() => blocksOf(duePasses(due, passes)), [due, passes]);
  const missed = missedText(due.missed);
  if (!due.slots.length && !due.asNeeded.length && !missed) return null;
  const zoneNote = scheduleZoneNote(due.timeZone, deviceZone());

  return (
    <UndoToastProvider value={true}>
      <section aria-labelledby="today-heading" className="space-y-3" data-today>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="today-heading" className={TITLE_SECTION}>
            Today
          </h2>
          {zoneNote && <p className="text-muted text-sm">{zoneNote}</p>}
        </div>

        {blocks.map((block) =>
          block.type === "pass" ? (
            <PassCard
              key={block.pass.key}
              pass={block.pass}
              groupId={groupId}
              timeZone={due.timeZone}
              canWrite={canWrite}
              nameOf={nameOf}
              onMark={(slot, status, passLogId) => setMarking({ slot, status, passLogId })}
            />
          ) : (
            <section
              key={`time-${block.time}`}
              aria-labelledby={`today-${block.time}`}
              className="space-y-1"
              data-slot-time={block.time}
            >
              <h3 id={`today-${block.time}`} className={`${TITLE_SUB} text-muted`}>
                {clockTime(block.time)}
              </h3>
              <List>
                {block.slots.map((slot) => (
                  <DoseSlotRow
                    key={slot.medication.id}
                    slot={slot}
                    groupId={groupId}
                    timeZone={due.timeZone}
                    canWrite={canWrite}
                    loggedBy={slot.dose?.createdBy ? nameOf(slot.dose.createdBy) : null}
                    onMark={(s, status) => setMarking({ slot: s, status })}
                  />
                ))}
              </List>
            </section>
          ),
        )}

        {due.asNeeded.length > 0 && (
          <section aria-labelledby="today-as-needed" className="space-y-1">
            <h3 id="today-as-needed" className={`${TITLE_SUB} text-muted`}>
              As needed
            </h3>
            <List>
              {due.asNeeded.map((item) => (
                <AsNeededRow
                  key={item.medication.id}
                  item={item}
                  due={due}
                  groupId={groupId}
                  canWrite={canWrite}
                />
              ))}
            </List>
          </section>
        )}

        {missed && (
          <p className="text-muted text-sm" data-missed>
            {missed}
          </p>
        )}

        {canWrite && <MarkDoseDialog marking={marking} groupId={groupId} onClose={() => setMarking(null)} />}
      </section>
    </UndoToastProvider>
  );
}
