import type { UnitChoices } from "@caretook/data/schema";

import { useCallback, useRef } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { withoutSheetParams } from "~/lib/timeline/urls";
import { useGroup } from "~/lib/app-shell/group";
import { openedOverTimeline } from "~/lib/timeline/timelineSheet";

// Sheets over the timeline are child routes (`timeline/new/:kind`,
// `timeline/:entryId/edit`): the timeline stays mounted underneath, with its
// scroll position, loaded pages and filters, and serves its sheets what they
// share through the outlet.

/**
 * What the timeline gives the sheet routes rendered in its `Outlet`: the
 * user's units, and whether the timeline is in simple mode (the add sheet
 * then opens its simple variant).
 */
export type TimelineOutlet = { units: UnitChoices; simple?: boolean };

export const useTimelineOutlet = () => useOutletContext<TimelineOutlet>();

export { SHEET_LINK_STATE } from "~/lib/timeline/timelineSheet";

/**
 * Close the sheet by leaving its route; Back, Escape, Cancel and a save all
 * end up in the same place:
 *
 * - opened from the timeline: go back, so the history has no sheet left in
 *   it ahead of you (Back after a save doesn't reopen it, and doesn't stay
 *   on a second copy of the timeline either);
 * - opened from a link or a bookmark (the first page loaded): replace it
 *   with the timeline, keeping its filters.
 *
 * Only the first call counts, so a save and a dismissal together never go
 * back twice.
 */
export function useCloseSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const state: unknown = location.state;
  const { search } = location;
  const { id } = useGroup();
  const closed = useRef(false);
  return useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    if (openedOverTimeline(state)) void navigate(-1);
    else
      void navigate(appUrls.timeline(id, withoutSheetParams(search)), {
        replace: true,
        preventScrollReset: true,
      });
  }, [navigate, state, search, id]);
}
