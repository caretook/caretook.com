import type { GoToDay } from "@caretook/data/schema";

import { CalendarDays } from "lucide-react";
import { Badge, IconChip } from "~/components/ui";
import { jumpDayText } from "~/lib/timeline/timelineJump";
import { GO_TO_AHEAD } from "./quickEntryCopy";

/** A line that asks for a day: where Go leads. It saves nothing; a day ahead is blocked. */
export function QuickEntryGoToCard({ goTo }: { goTo: GoToDay }) {
  return (
    <div
      className={`rounded-box bg-base-100 flex items-start gap-2 border p-3 ${goTo.ahead ? "border-error" : "border-base-300"}`}
      data-quick-goto={goTo.day}
    >
      <IconChip icon={CalendarDays} shape="rounded" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Badge>Go to</Badge>
        </p>
        <p className="font-medium">{jumpDayText(goTo.day)}</p>
        {goTo.ahead && (
          <p className="text-error-ink mt-2 text-sm" data-quick-blocking>
            {GO_TO_AHEAD}
          </p>
        )}
      </div>
    </div>
  );
}
