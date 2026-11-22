import type { ReactNode } from "react";
import type { FieldControl, FieldKind } from "./fieldIds";

import { useId } from "react";
import { fieldControl, fieldControlClass } from "./fieldIds";
import { FIELD_ERROR, FIELD_HELP, FIELD_LABEL, FIELD_WARNING } from "./styles";

/**
 * A labelled form control with optional help, and an error line or (while
 * there's no error) a warning line: a value that's allowed but worth a second
 * look. `children` renders the control (an input, select or textarea) from the
 * props it's given: its `id`, `aria-invalid` while there's an error, and
 * `aria-describedby` pointing at the lines shown. With `kind` it also gets its
 * classes (`input w-full`, and `input-error` while there's an error); a
 * `className` the caller sets after spreading the props replaces them. `labelHidden` keeps
 * the label for screen readers only (a title field whose look says what it is).
 */
export function Field({
  label,
  help,
  error,
  warning,
  labelHidden,
  kind,
  className = "",
  children,
}: {
  label: ReactNode;
  help?: ReactNode;
  /** The message to show; none while the value is fine. */
  error?: string;
  /** A softer message, shown (and described) only while there's no error. */
  warning?: string;
  labelHidden?: boolean;
  /** The control's kind, so the field styles it; without it the caller does. */
  kind?: FieldKind;
  /** Classes for the wrapper (the outer element). */
  className?: string;
  children: (control: FieldControl) => ReactNode;
}) {
  const id = useId();
  const control: FieldControl = {
    ...fieldControl(id, { help: !!help, error: !!error, warning: !!warning }),
    ...(kind && { className: fieldControlClass(kind, !!error) }),
  };
  const lines = (
    <>
      {help && (
        <p id={`${id}-help`} className={FIELD_HELP}>
          {help}
        </p>
      )}
      {error ? (
        <p id={`${id}-error`} className={FIELD_ERROR}>
          {error}
        </p>
      ) : (
        warning && (
          <p id={`${id}-warn`} className={FIELD_WARNING}>
            {warning}
          </p>
        )
      )}
    </>
  );

  if (labelHidden)
    return (
      <div className={className}>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        {children(control)}
        {lines}
      </div>
    );
  return (
    <fieldset className={`fieldset ${className}`}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      {children(control)}
      {lines}
    </fieldset>
  );
}
