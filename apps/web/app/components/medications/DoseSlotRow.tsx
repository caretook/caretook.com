import type { DoseStatus, DoseSlot, SlotState } from "@caretook/data/schema";
import type { BadgeTone } from "~/components/ui";

import { Check, Ellipsis } from "lucide-react";
import { Badge, Button, Menu, Message, STATUS_TONE } from "~/components/ui";
import { ExtraDoseWarning } from "./ExtraDoseWarning";
import { MedicationCard } from "./MedicationCard";
import { usePassLog } from "./usePassLog";
import { isOpen, extraDoseText, medicationTitle, slotStateText } from "@caretook/data/schema";

const TONE: Record<SlotState, BadgeTone> = {
  upcoming: "neutral",
  due: STATUS_TONE.dueSoon,
  overdue: STATUS_TONE.overdue,
  given: STATUS_TONE.done,
  skipped: STATUS_TONE.past,
  refused: STATUS_TONE.past,
  missed: STATUS_TONE.overdue,
};

/** A slot's state as a badge: "Due", "Overdue", "Given 8:05"… */
export function SlotBadge({ slot, timeZone }: { slot: DoseSlot; timeZone: string }) {
  return (
    <Badge tone={TONE[slot.state]} className="shrink-0" data-slot-state={slot.state}>
      {slotStateText(slot, timeZone)}
    </Badge>
  );
}

export type MarkStatus = Exclude<DoseStatus, "given">;

/**
 * One medication at one of today's times (alone, or inside a pass), as its
 * `MedicationCard` (the whole card opens its page): its amount, its state
 * and who logged it. While it's
 * still open, writers get a one-tap Given (logged now, for this slot, with
 * its amount, in `passLogId`'s round when it's in a pass) and a menu for
 * Skipped and Refused (`onMark`, which asks for a note). Given more than
 * once, it says so (`ExtraDoseWarning`), to viewers too.
 */
export function DoseSlotRow({
  slot,
  groupId,
  timeZone,
  canWrite,
  passLogId = null,
  loggedBy = null,
  onMark,
}: {
  slot: DoseSlot;
  groupId: string;
  timeZone: string;
  canWrite: boolean;
  /** The round a dose here joins (a pass's), or null. */
  passLogId?: string | null;
  /** Who logged it ("Ann"), once it's answered. */
  loggedBy?: string | null;
  onMark: (slot: DoseSlot, status: MarkStatus) => void;
}) {
  const { logSlot, busy, error } = usePassLog(groupId);
  const { medication } = slot;
  const title = medicationTitle(medication);
  const open = canWrite && isOpen(slot);
  const twice = extraDoseText(slot, timeZone);

  return (
    <MedicationCard
      medication={medication}
      groupId={groupId}
      data-slot={`${medication.id}@${slot.time}`}
      badge={<SlotBadge slot={slot} timeZone={timeZone} />}
      actions={
        open && (
          <>
            <Button
              variant="primary"
              size="sm"
              icon={Check}
              disabled={busy}
              aria-label={`Given: ${title}, ${slot.time}`}
              data-give=""
              onClick={() => void logSlot(slot, "given", { passLogId })}
            >
              Given
            </Button>
            <Menu
              label={`More for ${title}, ${slot.time}`}
              variant="ghost"
              size="sm"
              shape="square"
              items={[
                { id: "skipped", label: "Skipped…", onAction: () => onMark(slot, "skipped") },
                { id: "refused", label: "Refused…", onAction: () => onMark(slot, "refused") },
              ]}
            >
              <Ellipsis className="size-4" aria-hidden="true" />
            </Menu>
          </>
        )
      }
      notes={
        (twice || error) && (
          <>
            {twice && <ExtraDoseWarning text={twice} />}
            {error && <Message tone="error">{error}</Message>}
          </>
        )
      }
    >
      {slot.amount && <p className="text-muted text-sm">{slot.amount}</p>}
      {loggedBy && slot.dose && (
        <p className="text-muted text-sm" data-logged-by>
          by {loggedBy}
        </p>
      )}
    </MedicationCard>
  );
}
