import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";

/** The ⋯ menu on a timeline entry (React Aria: arrow keys, typeahead, focus return). */
export function EntryActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <MenuTrigger>
      <Button aria-label="Entry actions" className="btn btn-ghost btn-sm btn-square">
        <span aria-hidden="true">⋯</span>
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
