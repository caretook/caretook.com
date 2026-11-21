import type { LinkOption } from "./todoLinks";

import { useId, useMemo, useState } from "react";
import { ChipList, ComboBox } from "~/components/ui";

/**
 * One of the todo's optional links (a provider, an appointment, a
 * medication): once chosen, a chip with × to clear it; otherwise a combo box
 * over `optionsFor(typed)`. The chip says what `chipFor(id)` gives, greyed
 * for a removed or cancelled one. Posts the chosen id as `name` ("" for none).
 */
export function LinkPickerField({
  name,
  legend,
  comboLabel,
  placeholder,
  emptyText,
  clearLabel,
  optionsFor,
  chipFor,
  initialId,
  error,
}: {
  /** The form field: `providerId`, `eventId` or `medicationId`. */
  name: string;
  legend: string;
  comboLabel: string;
  placeholder: string;
  emptyText: string;
  clearLabel: string;
  optionsFor: (text: string) => LinkOption[];
  chipFor: (id: string) => { label: string; muted: boolean };
  initialId: string | null;
  error?: string;
}) {
  const legendId = useId();
  const [chosen, setChosen] = useState<string | null>(initialId);
  const [text, setText] = useState("");
  const options = useMemo(() => optionsFor(text), [optionsFor, text]);
  const chip = chosen ? chipFor(chosen) : null;

  return (
    <div className="fieldset" data-link-picker={name}>
      <span id={legendId} className="fieldset-legend">
        {legend}
      </span>
      {chosen && chip ? (
        <ChipList
          label={legend}
          chips={[
            {
              id: chosen,
              label: chip.label,
              // Plain text: a link would leave the form unsaved.
              to: null,
              muted: chip.muted,
              removeLabel: clearLabel,
              onRemove: () => setChosen(null),
            },
          ]}
        />
      ) : (
        <div role="group" aria-labelledby={legendId}>
          <ComboBox
            label={comboLabel}
            placeholder={placeholder}
            options={options}
            inputValue={text}
            onInputChange={setText}
            onSelect={(id) => {
              setChosen(id);
              setText("");
            }}
            emptyText={emptyText}
          />
        </div>
      )}
      <input type="hidden" name={name} value={chosen ?? ""} />
      {error && (
        <p className="text-error text-sm" role="alert" data-picker-error>
          {error}
        </p>
      )}
    </div>
  );
}
