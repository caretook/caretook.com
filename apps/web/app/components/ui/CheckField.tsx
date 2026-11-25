import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { useId } from "react";
import { fieldControl } from "./fieldIds";
import { RequiredLabel } from "./Required";
import { FIELD_ERROR } from "./styles";

/** What a check or toggle field takes: the input's own props, but not its type or look. */
export type CheckFieldProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "role" | "className" | "id"
> & {
  label: ReactNode;
  /** A line under the label, the control's description. */
  help?: ReactNode;
  /** What's wrong (the control is `aria-invalid` and described by it); none while it's fine. */
  error?: string;
  /** It must be checked: a `*` after the label, `aria-required` on the input (not the native attribute). */
  required?: boolean;
  /**
   * With `required`, the native attribute too: for a form the browser
   * validates (the account forms' consent boxes, which must block the submit).
   */
  nativeRequired?: boolean;
  /** Classes for the outer element (a margin), never its look. */
  className?: string;
  /** Data hooks (`data-*`), on the input. */
  [attr: `data-${string}`]: string | undefined;
};

/**
 * A native checkbox with its label beside it, one size, the label the rest
 * of the row (tapping it toggles), then its help and error under the label,
 * both describing the control. An `aria-label` names the control instead (the
 * visible label is then hidden from screen readers, so it isn't read twice).
 * `required` puts a `*` after the label and `aria-required` on the input.
 */
export function CheckField(props: CheckFieldProps) {
  return <CheckRow {...props} look="checkbox" />;
}

/** The row `CheckField` and `ToggleField` share; `look` is the control's daisyUI class. */
export function CheckRow({
  label,
  help,
  error,
  required,
  nativeRequired,
  className = "",
  look,
  "aria-describedby": describedBy,
  ...input
}: CheckFieldProps & { look: "checkbox" | "toggle" }) {
  const id = useId();
  const control = fieldControl(id, { help: !!help, error: !!error, required });
  const describers = [control["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 ${className}`.trim()}>
      <input
        {...input}
        {...control}
        aria-describedby={describers}
        required={(required && nativeRequired) || undefined}
        type="checkbox"
        role={look === "toggle" ? "switch" : undefined}
        className={`${look} peer`}
      />
      <label
        htmlFor={id}
        aria-hidden={input["aria-label"] ? true : undefined}
        className="min-w-0 cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
      >
        <RequiredLabel required={required}>{label}</RequiredLabel>
      </label>
      {help && (
        <p id={`${id}-help`} className="text-muted col-start-2 text-sm">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={`${FIELD_ERROR} col-start-2`}>
          {error}
        </p>
      )}
    </div>
  );
}
