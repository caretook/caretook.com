import type { VitalType } from "@caretook/data/schema";
import type { ReactNode } from "react";

import { VITAL_TYPES, VITALS } from "@caretook/data/schema";
import { Menu } from "~/components/ui";

/**
 * A button that opens the list of vital types. Used by the quick-add bar,
 * the entry kind picker and "Add a reading". Types in `exclude` (already on
 * the entry) aren't offered.
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
    <Menu
      menuLabel="Vital type"
      className={className}
      isDisabled={types.length === 0}
      placement="bottom start"
      width="md"
      scrollable
      items={types.map((type) => ({ id: type, label: VITALS[type].label, onAction: () => onSelect(type) }))}
    >
      {children}
    </Menu>
  );
}
