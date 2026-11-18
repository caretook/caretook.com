import { Ellipsis } from "lucide-react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";

/** The ⋯ menu in the entry page's header (React Aria: arrow keys, typeahead, focus return). */
export function EntryMenu({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <MenuTrigger>
      <Button aria-label={label} className="btn btn-ghost btn-sm btn-square">
        <Ellipsis className="size-4" aria-hidden="true" />
      </Button>
      <Popover placement="bottom end" className="rounded-box border-base-300 bg-base-100 border shadow-lg">
        <Menu className="menu w-44 outline-none">
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
