import type { ActionResult } from "~/lib/core/api";

import { useState } from "react";
import { ConfirmDialog, Field, Message } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { rpc } from "~/lib/core/rpc";
import { failedSave } from "../api";

/** `timeline.symptomTypes.replace`, as a result: offline it says it needs a connection. */
const replaceSymptom = (groupId: string, id: string, replacementId: string): Promise<ActionResult> =>
  rpc.timeline.symptomTypes.replace({ groupId, id, replacementId }).then(
    () => ({ ok: true }),
    (e: unknown) => failedSave(e),
  );

/**
 * Deleting a symptom (owners, `symptomCatalogAccess(...).replace`; the
 * server checks it again): the shared confirm <dialog>, laid out like Merge
 * on the Tags page, with a native select of the group's other active
 * symptoms. Once one is chosen it names both and how many entries move, then
 * Delete calls `timeline.symptomTypes.replace` (online only: offline it says
 * so here and stays open; awaited in place, as Merge awaits its write, so the
 * dialog closes on success). The row leaves the list when the tombstone
 * syncs back.
 */
export function DeleteSymptomDialog({
  symptom,
  others,
  open,
  onClose,
}: {
  /** The symptom, its name as shown, and how many live entries use it ("2 entries"), or null for none. */
  symptom: { id: string; name: string; entries: string | null };
  /** The group's other active symptoms, A to Z, by their shown names: what takes its place. */
  others: readonly { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const group = useGroup();
  const [intoId, setIntoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const into = others.find((r) => r.id === intoId);
  const { name, entries } = symptom;

  const close = () => {
    setIntoId("");
    setError(null);
    onClose();
  };

  const remove = async () => {
    if (!into || busy) return;
    setError(null);
    setBusy(true);
    const res = await replaceSymptom(group.id, symptom.id, into.id);
    setBusy(false);
    if (res.ok) close();
    else setError(res.error);
  };

  return (
    <ConfirmDialog
      open={open}
      title={`Delete “${name}”?`}
      message={
        !into
          ? `Choose the symptom that takes its place: entries logged as “${name}” move to it.`
          : entries
            ? `The ${entries} logged as “${name}” move to “${into.name}”, for everyone in the group, and “${name}” is deleted.`
            : `No entry is logged as “${name}”, so it is just deleted.`
      }
      confirmLabel="Delete symptom"
      confirmDisabled={!into || busy}
      onConfirm={() => void remove()}
      onClose={close}
    >
      <Field label="Replace with" kind="select">
        {(control) => (
          <select
            {...control}
            value={intoId}
            onChange={(e) => setIntoId(e.target.value)}
            data-symptom-replace-with=""
          >
            <option value="">Choose a symptom</option>
            {others.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      {error && (
        <div className="mt-3">
          <Message tone="error">{error}</Message>
        </div>
      )}
    </ConfirmDialog>
  );
}
