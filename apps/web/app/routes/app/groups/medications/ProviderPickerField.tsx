import type { ProviderRole } from "./medicationProviders";
import type { LocalProvider } from "~/lib/sync/providers";

import { useId, useMemo, useState } from "react";
import { ChipList, ComboBox } from "~/components/ui";
import { canAddProvider, chosenLabel, providerOptions } from "./medicationProviders";
import { FIELD } from "./medicationFormData";

type Choice = { kind: "none" } | { kind: "existing"; id: string } | { kind: "new"; name: string };

const NAMES: Record<ProviderRole, { id: string; newName: string; noun: string }> = {
  prescriber: { id: FIELD.prescriberId, newName: FIELD.newPrescriber, noun: "prescriber" },
  pharmacy: { id: FIELD.pharmacyId, newName: FIELD.newPharmacy, noun: "pharmacy" },
};

/**
 * The prescriber or the pharmacy: once chosen, a chip with × to clear it; otherwise a combo box over the group's providers that
 * fit (clinicians and practices prescribe, pharmacies fill), which can also
 * add the typed name as a new one: "Add "<typed>" as a new prescriber". A
 * new one is only a name until the form is saved, when the device writes it
 * with the medication (one transaction), so cancelling leaves nothing
 * behind. Posts `prescriberId` or `newPrescriber` (and the pharmacy's).
 */
export function ProviderPickerField({
  kind: role,
  providers,
  initialId,
  error,
}: {
  /** Which one this is (not `role`, an ARIA attribute name). */
  kind: ProviderRole;
  providers: readonly LocalProvider[];
  initialId: string | null;
  error?: string;
}) {
  const labelId = useId();
  const names = NAMES[role];
  const [choice, setChoice] = useState<Choice>(
    initialId ? { kind: "existing", id: initialId } : { kind: "none" },
  );
  const [text, setText] = useState("");
  const options = useMemo(() => providerOptions(providers, role, text), [providers, role, text]);
  const label = role === "prescriber" ? "Prescriber (optional)" : "Pharmacy (optional)";

  const chosen = choice.kind === "existing" ? providers.find((p) => p.id === choice.id) : null;
  const chipText =
    choice.kind === "new"
      ? chosenLabel(choice.name, { isNew: true })
      : chosen
        ? chosenLabel(chosen.name, { deleted: !!chosen.deletedAt })
        : `Chosen ${names.noun}`;

  return (
    <div className="fieldset" data-provider-picker={role}>
      <span id={labelId} className="fieldset-legend">
        {label}
      </span>
      {choice.kind === "none" ? (
        <div role="group" aria-labelledby={labelId}>
          <ComboBox
            label={`Find a ${names.noun}`}
            placeholder={role === "prescriber" ? "Search clinicians and practices" : "Search pharmacies"}
            options={options}
            inputValue={text}
            onInputChange={setText}
            onSelect={(id) => {
              setChoice({ kind: "existing", id });
              setText("");
            }}
            emptyText={`No ${role === "prescriber" ? "clinicians or practices" : "pharmacies"} match`}
            {...(canAddProvider(providers, role, text) && {
              onCreate: (name: string) => {
                setChoice({ kind: "new", name });
                setText("");
              },
              createLabel: (typed: string) => `Add "${typed}" as a new ${names.noun}`,
            })}
          />
        </div>
      ) : (
        <ChipList
          label={role === "prescriber" ? "Prescriber" : "Pharmacy"}
          chips={[
            {
              id: choice.kind === "existing" ? choice.id : "new",
              label: chipText,
              // Plain text: a link would leave the form unsaved.
              to: null,
              muted: !!chosen?.deletedAt,
              removeLabel: `Clear the ${names.noun}`,
              onRemove: () => setChoice({ kind: "none" }),
            },
          ]}
        />
      )}
      <input type="hidden" name={names.id} value={choice.kind === "existing" ? choice.id : ""} />
      <input type="hidden" name={names.newName} value={choice.kind === "new" ? choice.name : ""} />
      {error && (
        <p className="text-error text-sm" role="alert" data-picker-error>
          {error}
        </p>
      )}
    </div>
  );
}
