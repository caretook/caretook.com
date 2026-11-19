import type { AllergyState } from "~/lib/allergies";
import type { ActionResult } from "~/lib/api";
import type { LocalAllergy } from "~/lib/sync/allergies";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { ConfirmDialog, IconButton } from "~/components/ui";
import { allergyText, NO_KNOWN_ALLERGIES } from "~/lib/allergies";
import { ALLERGY_FIELD } from "./allergyActions";

/**
 * What's on file: each allergy with Edit and Remove (after a confirm), or,
 * while there are none, "No known allergies" to record (or clear). The
 * writes are local, so they work offline.
 */
export function AllergyList({
  state,
  onEdit,
}: {
  state: AllergyState<LocalAllergy>;
  onEdit: (allergy: LocalAllergy) => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const [removing, setRemoving] = useState<LocalAllergy | null>(null);
  const post = (fields: Record<string, string>) => void fetcher.submit(fields, { method: "post" });
  const refusal = fetcher.state === "idle" && fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;

  return (
    <div className="space-y-2">
      {state.kind === "recorded" ? (
        <ul className="divide-base-300 border-base-300 rounded-box divide-y border" data-allergy-list>
          {state.allergies.map((allergy) => (
            <li key={allergy.id} className="flex items-center gap-2 px-3 py-2" data-allergy-row={allergy.id}>
              <span className="min-w-0 flex-1 wrap-break-word">{allergyText(allergy)}</span>
              <IconButton label={`Edit ${allergy.substance}`} icon={Pencil} onPress={() => onEdit(allergy)} />
              <IconButton
                label={`Remove ${allergy.substance}`}
                icon={Trash2}
                onPress={() => setRemoving(allergy)}
              />
            </li>
          ))}
        </ul>
      ) : state.kind === "none" ? (
        <div className="flex items-center justify-between gap-2" data-no-known-allergies>
          <p className="font-semibold">{NO_KNOWN_ALLERGIES}</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => post({ [ALLERGY_FIELD.intent]: "noKnown", [ALLERGY_FIELD.on]: "0" })}
            data-clear-no-known
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2" data-allergies-not-recorded>
          <p className="text-base-content/70 text-sm">Nothing recorded yet. Add an allergy below, or:</p>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => post({ [ALLERGY_FIELD.intent]: "noKnown", [ALLERGY_FIELD.on]: "1" })}
            data-record-no-known
          >
            {NO_KNOWN_ALLERGIES}
          </button>
        </div>
      )}
      {refusal && (
        <p className="text-error text-sm" role="alert">
          {refusal}
        </p>
      )}
      <ConfirmDialog
        open={!!removing}
        title={removing ? `Remove ${removing.substance}?` : "Remove allergy?"}
        message="It comes off the medication list and the printed sheets."
        confirmLabel="Remove"
        onConfirm={() => {
          if (removing) post({ [ALLERGY_FIELD.intent]: "remove", [ALLERGY_FIELD.allergyId]: removing.id });
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
