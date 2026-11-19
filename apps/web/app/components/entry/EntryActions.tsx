import type { TimelineEntryKind } from "@caretook/data/schema";
import type { MenuEntry } from "~/components/ui";
import type { EntryAction } from "./entryActionItems";

import { Ellipsis } from "lucide-react";
import { Menu } from "~/components/ui";
import { entryActionItems } from "./entryActionItems";

/**
 * An event's Reschedule (when it can be: not one already rescheduled) and
 * Cancel (or Undo cancel, once it's cancelled) in its ⋯ menu.
 */
export type EntryCancelActions = {
  cancelled: boolean;
  onCancel: () => void;
  onUncancel: () => void;
  /** Opens the reschedule sheet; left out, there's no Reschedule. */
  onReschedule?: () => void;
};

/**
 * An entry's ⋯ menu: the same items in the same order on rows, cards,
 * Upcoming and the entry page (`entryActionItems`). It sits above a row's
 * stretched open target (`relative z-10`), so a tap on it never opens the
 * entry.
 */
export function EntryActions({
  kind,
  label,
  onEdit,
  cancel,
  onDelete,
}: {
  kind: TimelineEntryKind;
  /** Names the entry for screen readers, e.g. "Actions for note at 2:27 PM". */
  label: string;
  /** Opens the edit sheet (symptoms and vitals only; ignored for notes and events). */
  onEdit?: () => void;
  /** An event's Reschedule, and Cancel or Undo cancel (ignored for other kinds). */
  cancel?: EntryCancelActions;
  onDelete: () => void;
}) {
  const item = (action: EntryAction): MenuEntry => {
    switch (action) {
      case "edit":
        return { id: "edit", label: "Edit", onAction: onEdit };
      case "reschedule":
        return { id: "reschedule", label: "Reschedule", onAction: cancel?.onReschedule };
      case "cancel":
        return { id: "cancel", label: "Cancel event", onAction: cancel?.onCancel };
      case "uncancel":
        return { id: "uncancel", label: "Undo cancel", onAction: cancel?.onUncancel };
      case "delete":
        return { id: "delete", label: "Delete", tone: "danger", onAction: onDelete };
    }
  };
  const items = entryActionItems(kind, {
    canEdit: !!onEdit,
    canCancel: !!cancel,
    cancelled: cancel?.cancelled,
    canReschedule: !!cancel?.onReschedule,
  }).map(item);
  return (
    <Menu
      label={label}
      items={items}
      className="btn btn-ghost btn-sm btn-square relative z-10 -my-1 shrink-0"
    >
      <Ellipsis className="size-4" aria-hidden="true" />
    </Menu>
  );
}
