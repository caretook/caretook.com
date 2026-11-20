import type { DoseStatus } from "@caretook/data/schema";
import type { DoseSlot } from "~/lib/dueDoses";
import type { DuePass } from "~/lib/duePasses";

import { useCallback, useState } from "react";
import { givenAllWrites } from "~/lib/duePasses";
import { passLoggedLabel } from "~/lib/medicationDisplay";
import { clearUndo, offerUndo } from "~/lib/passUndo";
import { getSync } from "~/lib/sync";
import { logDose, logDoses, removeDoses } from "~/lib/sync/medications";
import { removeEntries } from "~/lib/sync/quickEntry";

/**
 * Logging doses by pass, the one path for Today, the Dose sheet and the
 * timeline's medication strip. Local writes, so they work offline.
 * - `givenAll(pass, { place })`: every open medication in the pass, given
 *   now (`givenAllWrites`), in one transaction; then Undo is offered for
 *   about 10 s (the `PassUndoStatus` for that `place` shows it).
 * - `logSlot(slot, status, { note, passLogId })`: one medication of a pass
 *   (or a time of its own), now; in a pass it joins the pass's round, so the
 *   round stays one log.
 * Each control has its own, so `busy` and `error` are its own.
 */
export function usePassLog(groupId: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (write: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await write();
      if (!result.ok) setError(result.error);
      return result.ok;
    } finally {
      setBusy(false);
    }
  }, []);

  const givenAll = useCallback(
    (pass: DuePass, { place = null }: { place?: string | null } = {}) =>
      run(async () => {
        const writes = givenAllWrites(pass, new Date());
        if (!writes.length) return { ok: true };
        const result = await logDoses(getSync(), groupId, writes);
        if (result.ok) offerUndo({ groupId, label: passLoggedLabel(pass), doseIds: result.ids, place });
        return result;
      }),
    [groupId, run],
  );

  const logSlot = useCallback(
    (
      slot: DoseSlot,
      status: DoseStatus,
      { note, passLogId }: { note?: string; passLogId?: string | null } = {},
    ) =>
      run(() =>
        logDose(getSync(), groupId, {
          medicationId: slot.medication.id,
          status,
          scheduledFor: slot.time,
          passId: slot.passId,
          passLogId: passLogId ?? null,
          amount: status === "given" ? slot.amount : null,
          note: note?.trim() || null,
        }),
      ),
    [groupId, run],
  );

  return { givenAll, logSlot, busy, error };
}

/** Undo a round Given all logged: soft-deletes exactly its doses (and, for quick entry's line, its other entries). */
export async function undoPassLog(key: string, doseIds: readonly string[], entryIds: readonly string[] = []) {
  const result = entryIds.length
    ? await removeEntries(getSync(), [...doseIds, ...entryIds])
    : await removeDoses(getSync(), doseIds);
  if (result.ok) clearUndo(key);
  return result;
}
