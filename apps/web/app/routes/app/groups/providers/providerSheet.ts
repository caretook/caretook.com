import type { LocalProvider } from "~/lib/sync/providers";

import { useCallback, useRef } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { openedOverProviders } from "~/lib/providerSheetLink";

// Sheets over the directory are child routes (`providers/new`,
// `providers/:providerId/edit`): the list stays mounted underneath, with its
// search, filters and scroll position, and serves its sheets the group's
// providers (live) through the outlet. Like the timeline's sheets (`sheet.ts`).

/** What the directory gives the sheet routes rendered in its `Outlet`. */
export type ProvidersOutlet = {
  /** The group's providers (not deleted), live. */
  providers: LocalProvider[];
};

export const useProvidersOutlet = () => useOutletContext<ProvidersOutlet>();

/**
 * Close the sheet by leaving its route; Back, Escape, Cancel, a save and a
 * delete all end up in the same place: back, when it was opened from the
 * directory (so Back afterwards doesn't reopen it); otherwise (a link, a
 * bookmark, a reload) the directory replaces it, with its search kept. Only
 * the first call counts.
 */
export function useCloseProviderSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const state: unknown = location.state;
  const { search } = location;
  const { id } = useGroup();
  const closed = useRef(false);
  return useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    if (openedOverProviders(state)) void navigate(-1);
    else void navigate(appUrls.providers(id, search), { replace: true, preventScrollReset: true });
  }, [navigate, state, search, id]);
}
