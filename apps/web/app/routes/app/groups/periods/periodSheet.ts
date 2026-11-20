import type { SyncDb } from "~/lib/sync";
import type { LocalProvider, ProviderRow } from "~/lib/providers/providers.sync";

import { useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { openedFromApp } from "~/lib/care-periods/periodSheets";
import { useLiveQuery } from "~/lib/sync";
import { placeChoicesQuery } from "~/lib/care-periods/carePeriods.sync";
import { toProviders } from "~/lib/providers/providers.sync";
import { readRows } from "~/lib/timeline/timeline.sync";

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

/** The place picker's providers as a sheet's loader reads them, so the first render has them. */
export const loadPlaceRows = (db: SyncDb, groupId: string) =>
  readRows<ProviderRow>(db, placeChoicesQuery(groupId));

/** The group's providers, live (deleted ones too, so a removed place still has a name). */
export function usePlaceChoices(groupId: string, initial: ProviderRow[]): LocalProvider[] {
  const query = placeChoicesQuery(groupId);
  const rows = useLiveQuery<ProviderRow>(query.sql, query.params, initial);
  return useMemo(() => toProviders(rows), [rows]);
}
