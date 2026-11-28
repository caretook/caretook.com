import { useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { openedFromApp, sheetTab } from "~/lib/medications/medicationSheets";

// Sheets over the Medications tabs are child routes (`medications/<tab>/new`,
// `medications/<tab>/:medicationId/edit`): the
// tab stays mounted underneath, with its search, filter and scroll position. Like the directory's sheets
// (`providerSheet.ts`).

/**
 * Close the sheet by leaving its route; Back, Escape, Cancel and a save all
 * end up in the same place: back, when it was opened by one of the app's
 * links (from a tab, or from a medication's page, which it returns to);
 * otherwise (a bookmark, a reload) the tab underneath replaces it, with its
 * search kept. `toTab` goes to that tab whatever opened it (after a delete,
 * the page it came from is gone). Only the first call counts.
 */
export function useCloseMedicationSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const state: unknown = location.state;
  const { pathname, search } = location;
  const { id } = useGroup();
  const closed = useRef(false);
  return useCallback(
    (toTab = false) => {
      if (closed.current) return;
      closed.current = true;
      if (!toTab && openedFromApp(state)) void navigate(-1);
      else
        void navigate(appUrls.medicationTab(id, sheetTab(id, pathname), search), {
          replace: true,
          preventScrollReset: true,
        });
    },
    [navigate, state, pathname, search, id],
  );
}
