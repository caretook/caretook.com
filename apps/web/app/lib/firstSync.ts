import type { SyncDb } from "./sync";

import { data, isRouteErrorResponse } from "react-router";
import { isFirstSyncDone } from "./sync";

// A row a screen needs (its care group) that isn't on the device. Once the
// first sync is done it's a 404; before that it may simply not have arrived,
// so the loader throws a "still syncing" response instead, which the /app
// error boundary shows as `FirstSyncPending` (and reloads when it's done).

const FIRST_SYNC_PENDING = "First sync pending";

/** What a loader throws for a missing group: 404, or "still syncing" on a new device. */
export const notOnDevice = (db: SyncDb) =>
  isFirstSyncDone(db)
    ? data("Not found", { status: 404 })
    : data(FIRST_SYNC_PENDING, { status: 503, statusText: FIRST_SYNC_PENDING });

/** Whether a route error is `notOnDevice`'s "still syncing". */
export const isFirstSyncPending = (error: unknown) =>
  isRouteErrorResponse(error) && error.status === 503 && error.data === FIRST_SYNC_PENDING;
