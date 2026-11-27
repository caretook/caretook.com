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
  onTags,
  cancel,
  onPrepare,
  onRemind,
  onPrint,
  printHref,
  onCopyLink,
  onDelete,
}: {
  kind: TimelineEntryKind;
  /** Names the entry for screen readers, e.g. "Actions for note at 2:27 PM". */
  label: string;
  /**
   * Opens the edit sheet (symptoms and vitals). For a note or event, only a
   * series visit's: Edit asks Only this visit or This and later visits.
   */
  onEdit?: () => void;
  /** Opens the tag picker (tags PRD); left out (viewers, someone else's entry for an Easy helper), there's no Tags. */
  onTags?: () => void;
  /** An event's Reschedule, and Cancel or Undo cancel (ignored for other kinds). */
  cancel?: EntryCancelActions;
  /** Opens visit prep for an upcoming event (Prepare). */
  onPrepare?: () => void;
  /** Opens the "Remind me" sheet for an upcoming note or event (any role). */
  onRemind?: () => void;
  /** Prints a note or event here (the entry page)… */
  onPrint?: () => void;
  /** …or opens its page to print it (rows elsewhere). */
  printHref?: string;
  /** Copies the entry's link (the timeline's rows and cards; any role). */
  onCopyLink?: () => void;
  /** Left out (viewers), there's no Delete. */
  onDelete?: () => void;
}) {
  const item = (action: EntryAction): MenuEntry => {
    switch (action) {
      case "edit":
        return { id: "edit", label: "Edit", onAction: onEdit };
      case "editSeries":
        return { id: "edit", label: "Edit", onAction: onEdit };
      case "tags":
        return { id: "tags", label: "Tags", onAction: onTags };
      case "reschedule":
        return { id: "reschedule", label: "Reschedule", onAction: cancel?.onReschedule };
      case "cancel":
        return { id: "cancel", label: "Cancel event", onAction: cancel?.onCancel };
      case "uncancel":
        return { id: "uncancel", label: "Undo cancel", onAction: cancel?.onUncancel };
      case "prepare":
        return { id: "prepare", label: "Prepare for this visit", onAction: onPrepare };
      case "remind":
        return { id: "remind", label: "Remind me", onAction: onRemind };
      case "print":
        return printHref
          ? { id: "print", label: "Print", href: printHref }
          : { id: "print", label: "Print", onAction: onPrint };
      case "copyLink":
        return { id: "copyLink", label: "Copy link", onAction: onCopyLink };
      case "delete":
        return { id: "delete", label: "Delete", tone: "danger", onAction: onDelete };
    }
  };
  const items = entryActionItems(kind, {
    canEdit: !!onEdit,
    canEditSeries: !!onEdit,
    canTag: !!onTags,
    canCancel: !!cancel,
    cancelled: cancel?.cancelled,
    canReschedule: !!cancel?.onReschedule,
    canPrepare: !!onPrepare,
    canRemind: !!onRemind,
    canPrint: !!(onPrint || printHref),
    canCopyLink: !!onCopyLink,
    canDelete: !!onDelete,
  }).map(item);
  return (
    <Menu
      label={label}
      items={items}
      variant="ghost"
      size="sm"
      shape="square"
      className="relative z-10 -my-1 shrink-0"
    >
      <Ellipsis className="size-4" aria-hidden="true" />
    </Menu>
  );
}
