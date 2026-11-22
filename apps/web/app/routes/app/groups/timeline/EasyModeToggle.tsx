import type { EasyModeState } from "~/lib/assistant/useEasyMode";

import { LayoutGrid, Type } from "lucide-react";
import { Button } from "~/components/ui";

/**
 * The one control that flips this device between the full timeline and easy
 * mode (`lib/assistant/easyModeToggle.ts`), on the right of the page header
 * in both views: "Easy mode" on the full timeline, "Full app" on the easy
 * one, the same size either way. Renders nothing when the member can't toggle
 * (`canToggle` is false for an easy role: `resolveEasyMode`).
 */
export function EasyModeToggle({ mode }: { mode: EasyModeState }) {
  if (!mode.canToggle) return null;
  return (
    <Button
      variant="ghost"
      icon={mode.easy ? LayoutGrid : Type}
      className="min-h-11 shrink-0 text-base"
      onClick={mode.toggle}
      data-easy-toggle={mode.easy ? "full" : "easy"}
    >
      {mode.easy ? "Full app" : "Easy mode"}
    </Button>
  );
}
