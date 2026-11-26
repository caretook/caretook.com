import type { TagPickerTarget } from "./TagPickerSheet";

import { useState } from "react";
import { TagPickerSheet } from "./TagPickerSheet";

/**
 * "Tags" from a screen's ⋯ menus: `ask` opens the picker sheet for a
 * record, and `sheet` is where it renders (nothing while closed).
 */
export function useTagPicker() {
  const [asking, setAsking] = useState<TagPickerTarget | null>(null);
  return {
    ask: (record: TagPickerTarget) => setAsking(record),
    sheet: asking && (
      <TagPickerSheet
        key={`${asking.target}:${asking.recordId}`}
        {...asking}
        onClose={() => setAsking(null)}
      />
    ),
  };
}
