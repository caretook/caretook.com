import { useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { openedFromApp } from "~/lib/care-periods/periodSheets";

// Sheets over the periods page are child routes (`periods/new`): the page
// stays mounted underneath. Like the medication list's sheets.

/**
 * Close the sheet by leaving its route; Back, Escape, Cancel and a save all
 * end up in the same place: back, when it was opened by one of the app's
 * links (the periods page, a period's page, the timeline's line, an entry's
 * suggestion); otherwise (a bookmark, a reload) the periods page replaces it.
 * `toList` goes to the periods page whatever opened it (once the period is
 * deleted, the page it came from is gone). Only the first call counts.
 */
export function useClosePeriodSheet() {
  const navigate = useNavigate();
  const state: unknown = useLocation().state;
  const { id } = useGroup();
  const closed = useRef(false);
  return useCallback(
    (toList = false) => {
      if (closed.current) return;
      closed.current = true;
      if (!toList && openedFromApp(state)) void navigate(-1);
      else void navigate(appUrls.periods(id), { replace: true, preventScrollReset: true });
    },
    [navigate, state, id],
  );
}
