import type { LocalProvider } from "~/lib/providers/providers.sync";
import type { ProviderFit } from "~/lib/providers/providerPicker";

import { useId, useMemo, useState } from "react";
import { ChipList, ComboBox, Message } from "~/components/ui";
import { canAddPicked, chosenLabel, pickerOptions } from "~/lib/providers/providerPicker";

type Choice = { kind: "none" } | { kind: "existing"; id: string } | { kind: "new"; name: string };

/**
 * One provider for a form (a medication's prescriber or pharmacy, who
 * diagnosed a condition): once chosen, a chip with × to clear it; otherwise
 * a combo box over the group's providers that `fits`, which can also add the
 * typed name: "Add "<typed>" as a new <noun>". A new one is only a name
 * until the form is saved, when the device writes it with the form's row
 * (one transaction), so cancelling leaves nothing behind. A deleted one
 * already chosen shows "(removed)". Posts `name` (the id) or `newName`.
 */
export function ProviderPickerField({
  pickerId,
  name,
  newName,
  legend,
  chipsLabel,
  noun,
  placeholder,
  emptyText,
  fits,
  providers,
  initialId,
  error,
}: {
  /** `data-provider-picker`'s value: which picker this is. */
  pickerId: string;
  name: string;
  newName: string;
  /** "Prescriber (optional)". */
  legend: string;
  /** The chosen chip's list name: "Prescriber". */
  chipsLabel: string;
  /** "prescriber": "Find a prescriber", "Clear the prescriber". */
  noun: string;
  placeholder: string;
  emptyText: string;
  fits: ProviderFit;
  providers: readonly LocalProvider[];
  initialId: string | null;
  error?: string;
}) {
  const labelId = useId();
  const [choice, setChoice] = useState<Choice>(
    initialId ? { kind: "existing", id: initialId } : { kind: "none" },
  );
  const [text, setText] = useState("");
  const options = useMemo(() => pickerOptions(providers, fits, text), [providers, fits, text]);

  const chosen = choice.kind === "existing" ? providers.find((p) => p.id === choice.id) : null;
  const chipText =
    choice.kind === "new"
      ? chosenLabel(choice.name, { isNew: true })
      : chosen
        ? chosenLabel(chosen.name, { deleted: !!chosen.deletedAt })
        : `Chosen ${noun}`;

  return (
    <div className="fieldset" data-provider-picker={pickerId}>
      <span id={labelId} className="fieldset-legend">
        {legend}
      </span>
      {choice.kind === "none" ? (
        <div role="group" aria-labelledby={labelId}>
          <ComboBox
            label={`Find a ${noun}`}
            placeholder={placeholder}
            options={options}
            inputValue={text}
            onInputChange={setText}
            onSelect={(id) => {
              setChoice({ kind: "existing", id });
              setText("");
            }}
            emptyText={emptyText}
            {...(canAddPicked(providers, fits, text) && {
              onCreate: (typed: string) => {
                setChoice({ kind: "new", name: typed });
                setText("");
              },
              createLabel: (typed: string) => `Add "${typed}" as a new ${noun}`,
            })}
          />
        </div>
      ) : (
        <ChipList
          label={chipsLabel}
          chips={[
            {
              id: choice.kind === "existing" ? choice.id : "new",
              label: chipText,
              // Plain text: a link would leave the form unsaved.
              to: null,
              muted: !!chosen?.deletedAt,
              removeLabel: `Clear the ${noun}`,
              onRemove: () => setChoice({ kind: "none" }),
            },
          ]}
        />
      )}
      <input type="hidden" name={name} value={choice.kind === "existing" ? choice.id : ""} />
      <input type="hidden" name={newName} value={choice.kind === "new" ? choice.name : ""} />
      {error && (
        <Message tone="error" data-picker-error="">
          {error}
        </Message>
      )}
    </div>
  );
}
