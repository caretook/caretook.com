import type { ChoiceOption } from "./choices";

import { useId } from "react";
import { fieldControl } from "./fieldIds";
import { buttonClass } from "./buttonClass";
import { RequiredLabel } from "./Required";
import { CHOICE_BUTTON, FIELD_ERROR, FIELD_LABEL } from "./styles";

/**
 * One option in the grid: the label is the box, the radio covers it unseen (so
 * a tap lands on the radio itself), and its text wraps rather than truncates.
 */
const GRID_OPTION = `${buttonClass({ size: "sm" })} relative h-auto min-h-10 justify-start py-2 text-start leading-snug font-normal whitespace-normal has-checked:btn-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2`;

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
  /** A choice must be made: a `*` after the label, `aria-required` on the group. */
  required?: boolean;
  /** Classes for the wrapper (the outer element). */
  className?: string;
  /**
   * `row` (the default): joined buttons in a wrapping row, for a few short
   * options. `grid`: two equal columns of plain text boxes, for a longer list
   * (the care period types).
   */
  layout?: "row" | "grid";
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
 * A row of joined buttons that pick one of a few options (or, with `layout`
 * `grid`, two equal columns of them): native radios
 * (`name`, one per option, named by its label) in a `radiogroup`, so the
 * choice posts with its form and arrow keys move it. With an `error` the group
 * is `aria-invalid`, described by the message, and focusable, so a form can
 * move focus to it. `required` marks the label with a `*` and the group
 * `aria-required`.
 */
export function ChoiceGroup<T extends string>(props: Props<T>) {
  const {
    name,
    options,
    label,
    labelledBy,
    error,
    required,
    className = "",
    layout = "row",
    value,
    onChange,
    defaultValue,
  } = props;
  const id = useId();
  const labelId = `${id}-label`;
  const control = fieldControl(id, { error: !!error, required });
  return (
    <div className={`fieldset ${className}`}>
      {label && (
        <span id={labelId} className={FIELD_LABEL}>
          <RequiredLabel required={required}>{label}</RequiredLabel>
        </span>
      )}
      <div
        role="radiogroup"
        aria-labelledby={labelledBy ?? (label ? labelId : undefined)}
        aria-invalid={control["aria-invalid"]}
        aria-required={control["aria-required"]}
        aria-describedby={control["aria-describedby"]}
        tabIndex={error ? -1 : undefined}
        className={layout === "grid" ? "grid grid-cols-2 gap-2" : "join flex-wrap"}
        data-layout={layout}
      >
        {options.map((option) => {
          const radio = (
            <input
              key={option.value}
              type="radio"
              name={name}
              value={option.value}
              aria-label={option.label}
              {...(onChange
                ? { checked: value === option.value, onChange: () => onChange(option.value) }
                : { defaultChecked: defaultValue === option.value })}
              className={
                layout === "grid"
                  ? "absolute inset-0 cursor-pointer appearance-none opacity-0"
                  : CHOICE_BUTTON
              }
            />
          );
          return layout === "grid" ? (
            <label key={option.value} className={GRID_OPTION}>
              {radio}
              <span aria-hidden="true">{option.label}</span>
            </label>
          ) : (
            radio
          );
        })}
      </div>
      {error && (
        <p id={`${id}-error`} className={FIELD_ERROR}>
          {error}
        </p>
      )}
    </div>
  );
}
