import type { LocalProvider } from "~/lib/providers/providers.sync";

import { useId, useMemo, useState } from "react";
import { ChipList, ComboBox } from "~/components/ui";
import { FIELD } from "./periodFormData";
import { canAddPlace, placeChipLabel, placeOptions } from "./periodPlaces";

type Choice = { kind: "none" } | { kind: "existing"; id: string } | { kind: "new"; name: string };

/**
 * Where care is: once chosen, a chip with × to clear it; otherwise a combo
 * box over the group's providers (practices first), which can also add the
 * typed name as a new place: "Add "<typed>" as a new place". A new place is
 * only a name until the form is saved, when the device writes it with the
 * period (one transaction), so cancelling leaves nothing behind. Posts
 * `placeProviderId` or `newPlace`.
 */
export function PlacePickerField({
  providers,
  initialId,
  error,
}: {
  providers: readonly LocalProvider[];
  initialId: string | null;
  error?: string;
}) {
  const labelId = useId();
  const [choice, setChoice] = useState<Choice>(
    initialId ? { kind: "existing", id: initialId } : { kind: "none" },
  );
  const [text, setText] = useState("");
  const options = useMemo(() => placeOptions(providers, text), [providers, text]);

  const chosen = choice.kind === "existing" ? providers.find((p) => p.id === choice.id) : null;
  const chipText =
    choice.kind === "new"
      ? placeChipLabel(choice.name, { isNew: true })
      : chosen
        ? placeChipLabel(chosen.name, { deleted: !!chosen.deletedAt })
        : "Chosen place";

  return (
    <div className="fieldset" data-place-picker>
      <span id={labelId} className="fieldset-legend">
        Place (optional)
      </span>
      {choice.kind === "none" ? (
        <div role="group" aria-labelledby={labelId}>
          <ComboBox
            label="Find a place"
            placeholder="Search hospitals, facilities and providers"
            options={options}
            inputValue={text}
            onInputChange={setText}
            onSelect={(id) => {
              setChoice({ kind: "existing", id });
              setText("");
            }}
            emptyText="No providers match"
            {...(canAddPlace(providers, text) && {
              onCreate: (name: string) => {
                setChoice({ kind: "new", name });
                setText("");
              },
              createLabel: (typed: string) => `Add "${typed}" as a new place`,
            })}
          />
        </div>
      ) : (
        <ChipList
          label="Place"
          chips={[
            {
              id: choice.kind === "existing" ? choice.id : "new",
              label: chipText,
              // Plain text: a link would leave the form unsaved.
              to: null,
              muted: !!chosen?.deletedAt,
              removeLabel: "Clear the place",
              onRemove: () => setChoice({ kind: "none" }),
            },
          ]}
        />
      )}
      <input type="hidden" name={FIELD.placeProviderId} value={choice.kind === "existing" ? choice.id : ""} />
      <input type="hidden" name={FIELD.newPlace} value={choice.kind === "new" ? choice.name : ""} />
      {error && (
        <p className="text-error text-sm" role="alert" data-picker-error>
          {error}
        </p>
      )}
    </div>
  );
}
