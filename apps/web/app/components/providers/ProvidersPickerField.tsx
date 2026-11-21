import type { LocalProvider } from "~/lib/providers/providers.sync";
import type { ProviderFit } from "~/lib/providers/providerPicker";

import { useId, useMemo, useState } from "react";
import { ChipList, ComboBox } from "~/components/ui";
import { canAddPicked, chosenLabel, pickerOptions } from "~/lib/providers/providerPicker";

type Chosen = { kind: "existing"; id: string } | { kind: "new"; name: string };

const keyOf = (c: Chosen) => (c.kind === "existing" ? c.id : `new:${c.name}`);

/**
 * Any number of providers for a form (who manages a condition): each a chip
 * with × once chosen, picked from a combo box over the group's providers
 * that `fits` (not those already chosen), which can also add the typed name:
 * "Add "<typed>" as a new <noun>". New ones are only names until the form is
 * saved. A deleted one already chosen shows "(removed)", greyed, until it's
 * taken off. Posts one `name` per chosen id and one `newName` per new name.
 */
export function ProvidersPickerField({
  pickerId,
  name,
  newName,
  legend,
  chipsLabel,
  comboLabel,
  noun,
  placeholder,
  emptyText,
  fits,
  providers,
  initialIds,
  error,
}: {
  /** `data-providers-picker`'s value: which picker this is. */
  pickerId: string;
  name: string;
  newName: string;
  /** "Managed by (optional)". */
  legend: string;
  /** The chips' list name: "Providers who manage it". */
  chipsLabel: string;
  /** "Add a provider who manages it". */
  comboLabel: string;
  /** "provider": "Add "<typed>" as a new provider". */
  noun: string;
  placeholder: string;
  emptyText: string;
  fits: ProviderFit;
  providers: readonly LocalProvider[];
  initialIds: readonly string[];
  error?: string;
}) {
  const legendId = useId();
  const [chosen, setChosen] = useState<Chosen[]>(() => initialIds.map((id) => ({ kind: "existing", id })));
  const [text, setText] = useState("");
  const ids = useMemo(() => chosen.flatMap((c) => (c.kind === "existing" ? [c.id] : [])), [chosen]);
  const pending = useMemo(() => chosen.flatMap((c) => (c.kind === "new" ? [c.name] : [])), [chosen]);
  const options = useMemo(
    () => pickerOptions(providers, fits, text, { exclude: ids }),
    [providers, fits, text, ids],
  );
  const byId = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers]);
  const add = (next: Chosen) => {
    setChosen((list) => (list.some((c) => keyOf(c) === keyOf(next)) ? list : [...list, next]));
    setText("");
  };

  return (
    <div className="fieldset" data-providers-picker={pickerId}>
      <span id={legendId} className="fieldset-legend">
        {legend}
      </span>
      {chosen.length > 0 && (
        <ChipList
          label={chipsLabel}
          className="mb-1.5"
          chips={chosen.map((c) => {
            const provider = c.kind === "existing" ? byId.get(c.id) : null;
            const label =
              c.kind === "new"
                ? chosenLabel(c.name, { isNew: true })
                : chosenLabel(provider?.name ?? `Chosen ${noun}`, { deleted: !!provider?.deletedAt });
            return {
              id: keyOf(c),
              label,
              // Plain text: a link would leave the form unsaved.
              to: null,
              muted: !!provider?.deletedAt,
              removeLabel: `Remove ${c.kind === "new" ? c.name : (provider?.name ?? noun)}`,
              onRemove: () => setChosen((list) => list.filter((x) => keyOf(x) !== keyOf(c))),
            };
          })}
        />
      )}
      <div role="group" aria-labelledby={legendId}>
        <ComboBox
          label={comboLabel}
          placeholder={placeholder}
          options={options}
          inputValue={text}
          onInputChange={setText}
          onSelect={(id) => add({ kind: "existing", id })}
          emptyText={emptyText}
          {...(canAddPicked(providers, fits, text, pending) && {
            onCreate: (typed: string) => add({ kind: "new", name: typed.trim() }),
            createLabel: (typed: string) => `Add "${typed}" as a new ${noun}`,
          })}
        />
      </div>
      {ids.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {pending.map((n) => (
        <input key={n} type="hidden" name={newName} value={n} />
      ))}
      {error && (
        <p className="text-error text-sm" role="alert" data-picker-error>
          {error}
        </p>
      )}
    </div>
  );
}
