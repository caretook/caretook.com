import type { EasyModeState } from "~/lib/assistant/useEasyMode";

import { LayoutGrid, Type } from "lucide-react";

/**
 * Easy mode's "Full app" button: back to the full timeline on this device
 * (`lib/assistant/easyModeToggle.ts`); the full timeline's way back in is
 * its View options menu. Nothing while locked in easy mode.
 */
export function EasyModeToggle({ mode }: { mode: EasyModeState }) {
  if (!mode.canToggle) return null;
  const Icon = mode.easy ? LayoutGrid : Type;
  return (
    <button
      type="button"
      className="btn btn-ghost btn-md shrink-0 text-base"
      onClick={mode.toggle}
      data-easy-toggle={mode.easy ? "full" : "easy"}
    >
      <Icon aria-hidden="true" className="size-4" />
      {mode.easy ? "Full app" : "Easy view"}
    </button>
  );
}
