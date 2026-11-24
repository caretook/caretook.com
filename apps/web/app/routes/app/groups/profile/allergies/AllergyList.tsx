import type { AllergyState } from "~/lib/medications/allergies";
import type { ActionResult } from "~/lib/core/api";
import type { LocalAllergy } from "~/lib/medications/allergies.sync";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button, ConfirmDialog, IconButton, List, ListRow, Message } from "~/components/ui";
import { allergyText, NO_KNOWN_ALLERGIES } from "~/lib/medications/allergies";
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
        <List data-allergy-list="">
          {state.allergies.map((allergy) => (
            <ListRow
              key={allergy.id}
              data-allergy-row={allergy.id}
              trailing={
                <>
                  <IconButton
                    label={`Edit ${allergy.substance}`}
                    icon={Pencil}
                    onPress={() => onEdit(allergy)}
                  />
                  <IconButton
                    label={`Remove ${allergy.substance}`}
                    icon={Trash2}
                    onPress={() => setRemoving(allergy)}
                  />
                </>
              }
            >
              <span className="wrap-break-word">{allergyText(allergy)}</span>
            </ListRow>
          ))}
        </List>
      ) : state.kind === "none" ? (
        <div className="flex items-center justify-between gap-2" data-no-known-allergies>
          <p className="font-semibold">{NO_KNOWN_ALLERGIES}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => post({ [ALLERGY_FIELD.intent]: "noKnown", [ALLERGY_FIELD.on]: "0" })}
            data-clear-no-known=""
          >
            Clear
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2" data-allergies-not-recorded>
          <p className="text-muted text-sm">Nothing recorded yet. Add an allergy below, or:</p>
          <Button
            size="sm"
            onClick={() => post({ [ALLERGY_FIELD.intent]: "noKnown", [ALLERGY_FIELD.on]: "1" })}
            data-record-no-known=""
          >
            {NO_KNOWN_ALLERGIES}
          </Button>
        </div>
      )}
      {refusal && <Message tone="error">{refusal}</Message>}
      <ConfirmDialog
        open={!!removing}
        title={removing ? `Remove ${removing.substance}?` : "Remove allergy?"}
        message="It comes off the profile, the medication list and the printed sheets."
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
