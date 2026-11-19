import type { ActionResult } from "~/lib/api";

import { useState } from "react";
import { getSync } from "~/lib/sync";
import { cancelEvent, uncancelEvent } from "~/lib/sync/appointments";

/**
 * Cancelling and un-cancelling events from a list (the timeline, Upcoming):
 * one Cancel dialog for the whole list. `ask` opens it for an event,
 * `confirm` cancels it with the typed reason, and `undo` puts a cancelled
 * one back at once (no confirm: it's undone the same way). Both are local
 * writes; live queries show them. `error` is the last refusal's message.
 */
export function useEventCancel() {
  const [asking, setAsking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const report = (res: ActionResult) => setError(res.ok ? null : res.error);
  return {
    asking: !!asking,
    ask: (entryId: string) => setAsking(entryId),
    close: () => setAsking(null),
    confirm: (reason: string) => {
      if (asking) void cancelEvent(getSync(), asking, reason).then(report);
      setAsking(null);
    },
    undo: (entryId: string) => void uncancelEvent(getSync(), entryId).then(report),
    error,
  };
}
