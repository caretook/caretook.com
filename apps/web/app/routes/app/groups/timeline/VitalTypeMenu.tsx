import type { VitalType } from "@caretook/data/schema";
import type { ReactNode } from "react";

import { VITAL_TYPES, VITALS } from "@caretook/data/schema";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";

/**
 * A button that opens the list of vital types (React Aria menu: arrow keys,
 * typeahead, focus return). Used by the entry kind picker and by "Add a
 * reading". Types in `exclude` (already on the entry) aren't offered.
 */
export function VitalTypeMenu({
  children,
  className,
  exclude = [],
  onSelect,
}: {
  children: ReactNode;
  className: string;
  exclude?: VitalType[];
  onSelect: (type: VitalType) => void;
}) {
  const types = VITAL_TYPES.filter((t) => !exclude.includes(t));
  return (
    <MenuTrigger>
      <Button className={className} isDisabled={types.length === 0}>
        {children}
      </Button>
      <Popover
        placement="bottom start"
        className="rounded-box border-base-300 bg-base-100 max-h-80 overflow-y-auto border shadow-lg"
      >
        <Menu
          aria-label="Vital type"
          className="menu w-56 outline-none"
          onAction={(key) => onSelect(key as VitalType)}
        >
          {types.map((type) => (
            <MenuItem
              key={type}
              id={type}
              className="rounded-field cursor-pointer px-3 py-2 outline-none data-[focused]:bg-base-200"
            >
              {VITALS[type].label}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
