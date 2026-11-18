import type { TimelineEntryKind } from "@caretook/data/schema";
import type { MenuEntry } from "~/components/ui";

import { Ellipsis } from "lucide-react";
import { Menu } from "~/components/ui";
import { entryActionItems } from "./entryActionItems";

/**
 * An entry's ⋯ menu: the same items in the same order on rows, cards and the
 * entry page (`entryActionItems`). It sits above a row's stretched open target
 * (`relative z-10`), so a tap on it never opens the entry.
 */
export function EntryActions({
  kind,
  label,
  onEdit,
  onDelete,
}: {
  kind: TimelineEntryKind;
  /** Names the entry for screen readers, e.g. "Actions for note at 2:27 PM". */
  label: string;
  /** Opens the edit sheet (symptoms and vitals only; ignored for notes and events). */
  onEdit?: () => void;
  onDelete: () => void;
}) {
  const items: MenuEntry[] = entryActionItems(kind, { canEdit: !!onEdit }).map((action) =>
    action === "edit"
      ? { id: "edit", label: "Edit", onAction: onEdit }
      : { id: "delete", label: "Delete", tone: "danger", onAction: onDelete },
  );
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
