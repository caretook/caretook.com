import type { TimelineEntry } from "~/lib/rpc";

import { useState } from "react";
import { useFetcher } from "react-router";

/**
 * Deleting from the timeline: one confirm for the whole list. `ask` opens it
 * for an entry, `confirm` posts `remove` to the timeline's action (the local
 * database; live queries show it at once), and `isRemoving` fades the row
 * while that runs.
 */
export function useEntryRemoval() {
  const [deleting, setDeleting] = useState<TimelineEntry | null>(null);
  const remover = useFetcher();
  const removingId = remover.state !== "idle" ? remover.formData?.get("id") : null;
  return {
    asking: !!deleting,
    ask: (entry: TimelineEntry) => setDeleting(entry),
    cancel: () => setDeleting(null),
    confirm: () => {
      if (deleting) void remover.submit({ intent: "remove", id: deleting.id }, { method: "post" });
      setDeleting(null);
    },
    isRemoving: (entryId: string) => removingId === entryId,
  };
}
