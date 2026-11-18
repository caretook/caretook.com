import type { ReactNode } from "react";
import type { GroupContext } from "./groupContext";
import type { SyncDb } from "./sync";
import type { GroupRow } from "./sync/timeline";

import { createContext as createReactContext, useContext, useMemo, useState } from "react";
import type { RouterContextProvider } from "react-router";

import { createContext } from "react-router";
import { notOnDevice } from "./firstSync";
import { toGroupContext } from "./groupContext";
import { useLiveQuery, waitForFirstSync } from "./sync";
import { myGroupQuery, readRows } from "./sync/timeline";

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

/**
 * Serves the group to the screens below it, live from the device. Render it
 * keyed on the group id: its first value seeds the watch, and a later
 * (older) read from a revalidation mustn't replace what the watch reported.
 * If the group leaves the device (you left, or were removed), the last value
 * stays until the screen goes.
 */
export function GroupProvider({ group, children }: { group: GroupContext; children: ReactNode }) {
  const [initial] = useState(group);
  const query = useMemo(() => myGroupQuery(initial.userId, initial.id), [initial]);
  const [seed] = useState<GroupRow[]>([]);
  const rows = useLiveQuery<GroupRow>(query.sql, query.params, seed);
  const row = rows[0];
  const value = useMemo(() => (row ? toGroupContext(row, initial.userId) : initial), [row, initial]);
  return <LiveGroup.Provider value={value}>{children}</LiveGroup.Provider>;
}

/** The current group, live. Only for components under the group route. */
export function useGroup(): GroupContext {
  const group = useContext(LiveGroup);
  if (!group) throw new Error("useGroup() is only for screens under /app/groups/:groupId");
  return group;
}
