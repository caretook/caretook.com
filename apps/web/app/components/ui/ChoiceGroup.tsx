import type { ChoiceOption } from "./choices";

import { useId } from "react";
import { fieldControl } from "./fieldIds";
import { CHOICE_BUTTON, FIELD_ERROR, FIELD_LABEL } from "./styles";

type Props<T extends string> = {
  /** The radios' form name. */
  name: string;
  options: readonly ChoiceOption<T>[];
  /**
   * The group's visible label. Leave it out and pass `labelledBy` when the
   * page already shows the name (a heading), so it isn't said twice.
   */
  label?: string;
  /** The id of an element on the page that names the group. */
  labelledBy?: string;
  /** The message to show; none while the choice is fine. */
  error?: string;
  /** Classes for the wrapper (the outer element). */
  className?: string;
} & (
  | {
      /** Controlled; null is none chosen yet. */ value: T | null;
      onChange: (value: T) => void;
      defaultValue?: never;
    }
  | {
      /** Uncontrolled: read from the form when it posts. */ defaultValue: T;
      value?: never;
      onChange?: never;
    }
);

/**
 * A row of joined buttons that pick one of a few options: native radios
 * (`name`, one per option, named by its label) in a `radiogroup`, so the
 * choice posts with its form and arrow keys move it. With an `error` the group
 * is `aria-invalid`, described by the message, and focusable, so a form can
 * move focus to it.
 */
export function ChoiceGroup<T extends string>(props: Props<T>) {
  const { name, options, label, labelledBy, error, className = "", value, onChange, defaultValue } = props;
  const id = useId();
  const labelId = `${id}-label`;
  const control = fieldControl(id, { error: !!error });
  return (
    <div className={`fieldset ${className}`}>
      {label && (
        <span id={labelId} className={FIELD_LABEL}>
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-labelledby={labelledBy ?? (label ? labelId : undefined)}
        aria-invalid={control["aria-invalid"]}
        aria-describedby={control["aria-describedby"]}
        tabIndex={error ? -1 : undefined}
        className="join flex-wrap"
      >
        {options.map((option) => (
          <input
            key={option.value}
            type="radio"
            name={name}
            value={option.value}
            aria-label={option.label}
            {...(onChange
              ? { checked: value === option.value, onChange: () => onChange(option.value) }
              : { defaultChecked: defaultValue === option.value })}
            className={CHOICE_BUTTON}
          />
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className={FIELD_ERROR}>
          {error}
        </p>
      )}
    </div>
  );
}
