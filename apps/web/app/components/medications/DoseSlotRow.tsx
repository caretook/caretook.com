import type { DoseStatus } from "@caretook/data/schema";
import type { DoseSlot, SlotState } from "~/lib/dueDoses";

import { Check, Ellipsis } from "lucide-react";
import { Link } from "react-router";
import { Menu } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { isOpen } from "~/lib/dueDoses";
import { medicationTitle, slotStateText } from "~/lib/medicationDisplay";
import { usePassLog } from "./usePassLog";

const BADGE: Record<SlotState, string> = {
  upcoming: "badge-ghost",
  due: "badge-warning",
  overdue: "badge-error",
  given: "badge-primary badge-soft",
  skipped: "badge-neutral badge-outline",
  refused: "badge-neutral badge-outline",
  missed: "badge-error badge-outline",
};

/** A slot's state as a badge: "Due", "Overdue", "Given 8:05"… */
export function SlotBadge({ slot, timeZone }: { slot: DoseSlot; timeZone: string }) {
  return (
    <span className={`badge badge-sm shrink-0 ${BADGE[slot.state]}`} data-slot-state={slot.state}>
      {slotStateText(slot, timeZone)}
    </span>
  );
}

export type MarkStatus = Exclude<DoseStatus, "given">;

/**
 * One medication at one of today's times (alone, or inside a pass): its name
 * (a link to its page), its amount, its state and who logged it. While it's
 * still open, writers get a one-tap Given (logged now, for this slot, with
 * its amount, in `passLogId`'s round when it's in a pass) and a menu for
 * Skipped and Refused (`onMark`, which asks for a note).
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

  return (
    <li
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
      data-slot={`${medication.id}@${slot.time}`}
    >
      <div className="min-w-0 flex-1">
        <Link to={appUrls.medication(groupId, medication.id)} className="link-hover font-medium break-words">
          {title}
        </Link>
        {slot.amount && <p className="text-base-content/70 text-sm">{slot.amount}</p>}
      </div>
      <SlotBadge slot={slot} timeZone={timeZone} />
      {loggedBy && slot.dose && (
        <span className="text-base-content/70 text-sm" data-logged-by>
          by {loggedBy}
        </span>
      )}
      {open && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            aria-label={`Given: ${title}, ${slot.time}`}
            data-give
            onClick={() => void logSlot(slot, "given", { passLogId })}
          >
            <Check className="size-4" aria-hidden="true" />
            Given
          </button>
          <Menu
            label={`More for ${title}, ${slot.time}`}
            className="btn btn-ghost btn-sm btn-square"
            items={[
              { id: "skipped", label: "Skipped…", onAction: () => onMark(slot, "skipped") },
              { id: "refused", label: "Refused…", onAction: () => onMark(slot, "refused") },
            ]}
          >
            <Ellipsis className="size-4" aria-hidden="true" />
          </Menu>
        </div>
      )}
      {error && (
        <p role="alert" className="text-error w-full text-sm">
          {error}
        </p>
      )}
    </li>
  );
}
