import type { ReactNode } from "react";
import type { GroupContext } from "./groupContext";
import type { SyncDb } from "../sync";
import type { GroupRow } from "../timeline/timeline.sync";

import { createContext as createReactContext, useContext, useEffect, useMemo, useState } from "react";
import type { RouterContextProvider } from "react-router";

import { createContext, useFetchers, useNavigate, useNavigation } from "react-router";
import { notOnDevice } from "../sync/firstSync";
import { toGroupContext } from "./groupContext";
import { appUrls } from "./appUrls";
import { syncUserId, useLiveQuery, waitForFirstSync } from "../sync";
import { myGroupQuery, readRows } from "../timeline/timeline.sync";

export type { GroupContext } from "./groupContext";

// The group under `/app/groups/:groupId`, loaded once per navigation by the
// group layout's middleware (`routes/app/groups/layout/route.tsx`):
//
// - loaders and actions below it read `getGroup(context)`;
// - components read `useGroup()`, which stays live (a rename or a changed
//   role on another device shows without a reload).
//
// A group that isn't on the device is `notOnDevice` (404, or "Getting your
// care groups…" before the first sync). The middleware records it rather
// than throwing it, and `getGroup` throws it from the loaders: an error
// thrown by middleware on the native (SPA) build's first page load renders
// in the root error boundary, not /app's, while a loader's error lands in
// /app's on both builds. No child reads anything before `getGroup`.

/** The group, or why there isn't one, as the middleware found it. */
type GroupLoad = { ok: true; group: GroupContext } | { ok: false; error: unknown };

const groupLoad = createContext<GroupLoad>();

/** The group from the device's copy, or `notOnDevice`. */
const loadGroup = async (db: SyncDb, groupId: string): Promise<GroupContext> => {
  await waitForFirstSync(db);
  const [row] = await readRows<GroupRow>(db, myGroupQuery(db.userId, groupId));
  if (!row) throw notOnDevice(db);
  return toGroupContext(row, db.userId);
};

/** The group route's middleware: load the group once for this navigation. */
export const setGroup = async (context: Readonly<RouterContextProvider>, db: SyncDb, groupId: string) => {
  try {
    context.set(groupLoad, { ok: true, group: await loadGroup(db, groupId) });
  } catch (error) {
    context.set(groupLoad, { ok: false, error });
  }
};

/** The group, for loaders and actions under the group route; throws `notOnDevice` when there's none. */
export const getGroup = (context: Readonly<RouterContextProvider>): GroupContext => {
  const load = context.get(groupLoad);
  if (!load.ok) throw load.error;
  return load.group;
};

const LiveGroup = createReactContext<GroupContext | null>(null);

/** History state on the navigation away from a group you were removed from (`/app` says so). */
export const LOST_GROUP_STATE = { lostGroup: true } as const;

/** Whether `/app` was opened by losing a group (`LOST_GROUP_STATE`). */
export const cameFromLostGroup = (state: unknown) =>
  typeof state === "object" && state !== null && "lostGroup" in state;

/**
 * Serves the group to the screens below it, live from the device. Render it
 * keyed on the group id: its first value seeds the watch, and a later
 * (older) read from a revalidation mustn't replace what the watch reported.
 *
 * The value is always the last membership row the watch saw (a role lowered
 * on another device stays lowered), never the first-loaded one. If the row
 * leaves the device (you were removed), the screen goes to the group list
 * with `LOST_GROUP_STATE`, which says "you no longer have access". Not while
 * a navigation or a fetcher is busy: leaving (and deleting a group) waits for
 * the row to go and then redirects by itself. Not after sign-out either: the
 * wipe empties the database it watches.
 */
export function GroupProvider({ group, children }: { group: GroupContext; children: ReactNode }) {
  const [initial] = useState(group);
  const query = useMemo(() => myGroupQuery(initial.userId, initial.id), [initial]);
  // Its own array: `rows === seed` means the watch hasn't reported yet.
  const [seed] = useState<GroupRow[]>([]);
  const rows = useLiveQuery<GroupRow>(query.sql, query.params, seed);
  const row = rows[0];
  const live = useMemo(() => (row ? toGroupContext(row, initial.userId) : null), [row, initial]);
  const [last, setLast] = useState(initial);
  if (live && live !== last) setLast(live);
  const gone = rows !== seed && !row;

  const navigate = useNavigate();
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const busy = navigation.state !== "idle" || fetchers.some((f) => f.state !== "idle");
  useEffect(() => {
    if (!gone || busy || syncUserId() !== initial.userId) return;
    void navigate(appUrls.groupList(), { replace: true, state: LOST_GROUP_STATE });
  }, [gone, busy, initial, navigate]);

  return <LiveGroup.Provider value={live ?? last}>{children}</LiveGroup.Provider>;
}

/** The current group, live. Only for components under the group route. */
export function useGroup(): GroupContext {
  const group = useContext(LiveGroup);
  if (!group) throw new Error("useGroup() is only for screens under /app/groups/:groupId");
  return group;
}
