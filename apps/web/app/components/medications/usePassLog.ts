import type { DoseStatus, DoseSlot, DuePass } from "@caretook/data/schema";

import { createContext, useCallback, useContext, useState } from "react";
import { dismissToast, toast } from "~/components/ui";
import { clearUndo, doseUndoLabel, offerUndo, UNDO_MS } from "~/lib/medications/passUndo";
import { getSync } from "~/lib/sync";
import { logDose, logDoses, removeDoses } from "~/lib/medications/medications.sync";
import { removeEntries } from "~/lib/assistant/quickEntry.sync";
import { givenAllWrites, passLoggedLabel } from "@caretook/data/schema";

// The Schedule tab's Undo (B-697): every dose logged there (one-tap Given,
// Skipped, Refused, an as-needed Log, Given all) shows a toast, "Tylenol
// logged · Undo" or "Morning logged · Undo", for about 10 s (`UNDO_MS`),
// instead of a `PassUndoStatus` line. The offer still goes through
// `passUndo.ts` (one at a time; its `place` keeps the other screens' lines
// from showing it), and Undo through `undoPassLog`.

/** The `place` of the Schedule tab's offers, so no `PassUndoStatus` shows them. */
export const UNDO_TOAST_PLACE = "toast";

const UndoToastContext = createContext(false);
/** `value` true (the Schedule tab's Today): the logging controls under it offer Undo as a toast. */
export const UndoToastProvider = UndoToastContext.Provider;
export const useUndoToast = () => useContext(UndoToastContext);

/** The toast showing the last offer; the next offer replaces it. */
let undoToastId: string | null = null;

/** Offer Undo for doses just logged, as a toast (the Schedule tab). */
export function offerUndoToast(groupId: string, label: string, doseIds: readonly string[]) {
  const offer = offerUndo({ groupId, label, doseIds, place: UNDO_TOAST_PLACE });
  if (undoToastId) dismissToast(undoToastId);
  undoToastId = toast({
    message: label,
    timeout: UNDO_MS,
    data: { "data-undo-toast": "" },
    undo: () =>
      void undoPassLog(offer.key, offer.doseIds).then((result) => {
        if (!result.ok) toast({ message: result.error });
      }),
  });
}

/**
 * Logging doses by pass, the one path for Today, the Dose sheet and the
 * timeline's medication strip. Local writes, so they work offline.
 * - `givenAll(pass, { place })`: every open medication in the pass, given
 *   now (`givenAllWrites`), in one transaction; then Undo is offered for
 *   about 10 s (the `PassUndoStatus` for that `place` shows it).
 * - `logSlot(slot, status, { note, passLogId })`: one medication of a pass
 *   (or a time of its own), now; in a pass it joins the pass's round, so the
 *   round stays one log.
 * Each control has its own, so `busy` and `error` are its own. Under an
 * `UndoToastProvider` (the Schedule tab) both offer Undo as a toast instead,
 * a single dose's too ("Tylenol logged · Undo"); only once the write is
 * through (a refusal stays `error`).
 */
export function usePassLog(groupId: string) {
  const asToast = useUndoToast();
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
        if (!result.ok) return result;
        if (asToast) offerUndoToast(groupId, passLoggedLabel(pass), result.ids);
        else offerUndo({ groupId, label: passLoggedLabel(pass), doseIds: result.ids, place });
        return result;
      }),
    [groupId, run, asToast],
  );

  const logSlot = useCallback(
    (
      slot: DoseSlot,
      status: DoseStatus,
      { note, passLogId }: { note?: string; passLogId?: string | null } = {},
    ) =>
      run(async () => {
        const result = await logDose(getSync(), groupId, {
          medicationId: slot.medication.id,
          status,
          scheduledFor: slot.time,
          passId: slot.passId,
          passLogId: passLogId ?? null,
          amount: status === "given" ? slot.amount : null,
          note: note?.trim() || null,
        });
        if (result.ok && asToast)
          offerUndoToast(groupId, doseUndoLabel(slot.medication.name, status), [result.id]);
        return result;
      }),
    [groupId, run, asToast],
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
