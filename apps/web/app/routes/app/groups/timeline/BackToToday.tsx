import { useLocation } from "react-router";
import { Button } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { clearDay } from "~/lib/timeline/timelineFilters";

/**
 * The way back from a jump (`?day=`): floats above the tab bar so it stays in
 * reach far down the list, and returns to the newest entries, filters kept.
 */
export function BackToToday({ groupId }: { groupId: string }) {
  const { search } = useLocation();
  return (
    <div
      data-jump-controls=""
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mb-(--tab-bar-height) flex justify-center gap-2 p-2 sm:mb-0 print:hidden"
    >
      <div className="pointer-events-auto">
        <Button to={appUrls.timeline(groupId, clearDay(search))} size="sm" data-back-to-today="">
          Back to today
        </Button>
      </div>
    </div>
  );
}
