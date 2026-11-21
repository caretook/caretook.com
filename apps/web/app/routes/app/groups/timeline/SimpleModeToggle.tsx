import type { SimpleModeState } from "~/lib/assistant/useSimpleMode";

import { LayoutGrid, Type } from "lucide-react";

/**
 * Simple mode's "Full app" button: back to the full timeline on this device
 * (`lib/assistant/simpleModeToggle.ts`); the full timeline's way back in is
 * its View options menu. Nothing while locked in simple mode.
 */
export function SimpleModeToggle({ mode }: { mode: SimpleModeState }) {
  if (!mode.canToggle) return null;
  const Icon = mode.simple ? LayoutGrid : Type;
  return (
    <button
      type="button"
      className="btn btn-ghost btn-md shrink-0 text-base"
      onClick={mode.toggle}
      data-simple-toggle={mode.simple ? "full" : "simple"}
    >
      <Icon aria-hidden="true" className="size-4" />
      {mode.simple ? "Full app" : "Simple view"}
    </button>
  );
}
