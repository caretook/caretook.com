import type { ComponentProps } from "react";
import type { QuickEntrySize } from "./QuickEntryBox";

import { Sparkles } from "lucide-react";
import { Popover } from "~/components/ui";
import { QuickEntrySuggestions } from "./QuickEntrySuggestions";

const BUTTON_CLASS: Record<QuickEntrySize, string> = {
  md: "btn-sm top-1.5 right-1.5",
  lg: "top-3 right-3",
};

/** The textarea's right padding while the button sits inside its border. */
export const SUGGEST_ROOM: Record<QuickEntrySize, string> = { md: "pr-11", lg: "pr-16" };

/**
 * The Sparkles button inside the empty box's border, at its right edge
 * (top-aligned, so it stays put as the box grows). It opens the suggestions
 * popover; a dot, and its name ("Suggestions, a pass is due"), say a due
 * pass is offered. The box shows it only while it's empty and some row has
 * something.
 */
export function QuickEntrySuggestButton({
  size,
  ...rows
}: { size: QuickEntrySize } & Omit<ComponentProps<typeof QuickEntrySuggestions>, "close">) {
  const due = !!rows.onGivePass && !!rows.duePasses?.length;
  return (
    <Popover
      label={due ? "Suggestions, a pass is due" : "Suggestions"}
      dialogLabel="Suggestions"
      placement="bottom end"
      className={`btn btn-ghost btn-circle absolute ${BUTTON_CLASS[size]}`}
      trigger={
        <>
          <Sparkles className="size-5" aria-hidden="true" />
          {due && (
            <span
              className="bg-warning ring-base-100 absolute top-0.5 right-0.5 size-2.5 rounded-full ring-2"
              aria-hidden="true"
              data-quick-due-dot
            />
          )}
        </>
      }
    >
      {(close) => <QuickEntrySuggestions {...rows} close={close} />}
    </Popover>
  );
}
