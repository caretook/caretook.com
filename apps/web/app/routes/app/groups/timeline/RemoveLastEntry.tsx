import type { LastEntryRow } from "./easyRows";

import { Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { ConfirmDialog } from "~/components/ui";
import { useLiveQuery } from "~/lib/sync";
import { lastEntryName, removableEntry } from "./removeLast";
import { lastOwnEntryQuery } from "./easyRows";

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: LastEntryRow[] = [];

/**
 * Easy mode's "Remove my last entry" (writers): the latest entry you added
 * in the last 30 minutes, behind a confirm, deleted the normal way (the
 * timeline's `remove`, a soft delete that syncs). Then the one before it,
 * while it's in the window too. Nothing shows when there's none.
 */
export function RemoveLastEntry({ groupId, userId, now }: { groupId: string; userId: string; now: Date }) {
  const query = useMemo(() => lastOwnEntryQuery(groupId, userId), [groupId, userId]);
  const [latest] = useLiveQuery<LastEntryRow>(query.sql, query.params, NO_ROWS);
  const entry = removableEntry(latest, now);
  const [asking, setAsking] = useState<LastEntryRow | null>(null);
  const remover = useFetcher();
  const [removed, setRemoved] = useState<string | null>(null);

  const confirm = () => {
    if (!asking) return;
    void remover.submit({ intent: "remove", id: asking.id }, { method: "post" });
    setRemoved(lastEntryName(asking));
    setAsking(null);
  };

  return (
    <div className="space-y-1" data-remove-last="">
      {entry && (
        <button
          type="button"
          className="btn btn-ghost btn-md text-base"
          disabled={remover.state !== "idle"}
          onClick={() => setAsking(entry)}
        >
          <Undo2 aria-hidden="true" className="size-5" />
          Remove my last entry
        </button>
      )}
      <p role="status" className="text-base-content/70 text-base">
        {removed && remover.state === "idle" ? `Removed ${removed}.` : ""}
      </p>
      <ConfirmDialog
        open={!!asking}
        title="Remove your last entry?"
        message={asking ? `${lastEntryName(asking)}. It goes for everyone in the group.` : null}
        confirmLabel="Remove"
        onConfirm={confirm}
        onClose={() => setAsking(null)}
      />
    </div>
  );
}
