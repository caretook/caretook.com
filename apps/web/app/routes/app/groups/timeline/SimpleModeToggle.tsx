import type { SimpleModeState } from "~/lib/assistant/useSimpleMode";

import { LayoutGrid, Type } from "lucide-react";

/**
 * The timeline's switch between simple mode and the full timeline, on this
 * device (`lib/assistant/simpleModeToggle.ts`). Nothing while locked in simple mode.
 */
export function SimpleModeToggle({ mode, large }: { mode: SimpleModeState; large?: boolean }) {
  if (!mode.canToggle) return null;
  const Icon = mode.simple ? LayoutGrid : Type;
  return (
    <button
      type="button"
      className={`btn btn-ghost shrink-0 ${large ? "btn-md text-base" : "btn-sm"}`}
      onClick={mode.toggle}
      data-simple-toggle={mode.simple ? "full" : "simple"}
    >
      <Icon aria-hidden="true" className="size-4" />
      {mode.simple ? "Full app" : "Simple view"}
    </button>
  );
}
