import type { QuickEntryCommand } from "@caretook/data/domain";

import { CalendarDays, ExternalLink, SquareArrowRight } from "lucide-react";
import { Badge, IconChip } from "~/components/ui";
import { inNewTab } from "~/lib/assistant/runCommand";
import { commandTarget, GO_TO_AHEAD, IN_NEW_TAB } from "./quickEntryCopy";

/**
 * A line that is a command (`readCommand`): what Go will do, a page or the
 * timeline on a day, here or in a new tab. It saves nothing; a day ahead is blocked.
 */
export function QuickEntryCommandCard({ command }: { command: QuickEntryCommand }) {
  const ahead = command.kind === "day" && command.ahead;
  const newTab = inNewTab(command);
  return (
    <div
      className={`rounded-box bg-base-100 flex items-start gap-2 border p-3 ${ahead ? "border-error" : "border-base-300"}`}
      data-quick-command={command.kind === "page" ? command.page : "day"}
      data-quick-goto={command.kind === "day" ? command.day : undefined}
      data-quick-new-tab={newTab ? "" : undefined}
    >
      <IconChip
        icon={newTab ? ExternalLink : command.kind === "day" ? CalendarDays : SquareArrowRight}
        shape="rounded"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Badge>Go to</Badge>
        </p>
        <p className="font-medium">{commandTarget(command)}</p>
        {newTab && <p className="text-muted text-sm">{IN_NEW_TAB}</p>}
        {ahead && (
          <p className="text-error-ink mt-2 text-sm" data-quick-blocking>
            {GO_TO_AHEAD}
          </p>
        )}
      </div>
    </div>
  );
}
