import { Ellipsis } from "lucide-react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";

/** The ⋯ menu on a timeline entry (React Aria: arrow keys, typeahead, focus return). */
export function EntryActions({
  label,
  onEdit,
  onDelete,
}: {
  /** Names the entry for screen readers, e.g. "Actions for note at 2:27 PM". */
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <MenuTrigger>
      <Button aria-label={label} className="btn btn-ghost btn-sm btn-square -my-1 shrink-0">
        <Ellipsis className="size-4" aria-hidden="true" />
      </Button>
      <Popover placement="bottom end" className="rounded-box border-base-300 bg-base-100 border shadow-lg">
        <Menu className="menu w-36 outline-none">
          <MenuItem
            onAction={onEdit}
            className="rounded-field cursor-pointer px-3 py-2 outline-none data-[focused]:bg-base-200"
          >
            Edit
          </MenuItem>
          <MenuItem
            onAction={onDelete}
            className="text-error rounded-field cursor-pointer px-3 py-2 outline-none data-[focused]:bg-base-200"
          >
            Delete
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
