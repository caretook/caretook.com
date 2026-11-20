import type { ActionResult } from "~/lib/core/api";

import { useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { toActionResult } from "~/lib/core/api";
import { appUrls } from "~/lib/app-shell/appUrls";
import { PROFILE_NEEDS_CONNECTION } from "~/lib/profiles/recipientDisplay";
import { useSyncState } from "~/lib/sync";

// The profile's edit sheets are child routes (`profile/basics`, and later
// slices' `profile/contact`, …): the profile stays mounted underneath. Every
// profile write is online only, through oRPC.

/** History state on a link that opens a profile sheet (so closing it can go back). */
export const PROFILE_SHEET_STATE = { profileSheet: true } as const;

/** Whether a sheet was opened by one of this app's links. */
export const openedFromProfile = (state: unknown) =>
  typeof state === "object" && state !== null && "profileSheet" in state;

/**
 * Close the sheet by leaving its route: back, when the profile opened it;
 * otherwise (a bookmark, a reload) the profile replaces it, so Back never
 * reopens it. Only the first call counts.
 */
export function useCloseProfileSheet(groupId: string) {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: unknown };
  const closed = useRef(false);
  return useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    if (openedFromProfile(state)) void navigate(-1);
    else void navigate(appUrls.profile(groupId), { replace: true, preventScrollReset: true });
  }, [navigate, state, groupId]);
}

/**
 * Whether this device reaches the server now (PowerSync's connection), for
 * the online-only edit controls. False until the connection is known.
 */
export function useOnline() {
  return useSyncState()?.connected ?? false;
}

/** fetch fails with a TypeError when there's no connection. */
const isNetworkError = (e: unknown) => e instanceof TypeError;

/** What a save that threw says: "Needs a connection" without one, else the API's error. */
export const failedProfileSave = (e: unknown): ActionResult => {
  if (isNetworkError(e)) return { ok: false, error: PROFILE_NEEDS_CONNECTION, issues: [] };
  return toActionResult(e);
};
