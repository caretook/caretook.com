import type { ActionResult } from "../api";
import type { SyncDb } from "./index";

import { cancelPatch, UNCANCEL_PATCH } from "../eventCancel";
import { updateEntry } from "./timeline";

// Local writes for appointments (events), beside timeline.ts: cancel and
// undo cancel. Each is an ordinary update of the cancel fields, so it's
// checked like any edit (writers only, events only: the content rules refuse
// cancel fields on other kinds), lands at once and uploads as a PATCH. Past
// events can be cancelled too. The server records who cancelled.

/** Cancel an event now, with an optional reason. */
export const cancelEvent = (db: SyncDb, id: string, reason?: string | null): Promise<ActionResult> =>
  updateEntry(db, id, cancelPatch(reason));

/** Undo a cancel: the event is back, without its reason or "rescheduled to". */
export const uncancelEvent = (db: SyncDb, id: string): Promise<ActionResult> =>
  updateEntry(db, id, { ...UNCANCEL_PATCH });
