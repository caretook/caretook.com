/** The ids and ARIA attributes a field gives its control, and its classes when the field knows its kind. */
export type FieldControl = {
  id: string;
  "aria-invalid"?: true;
  /** A required field: said, not the native `required` (so the browser's popup never replaces our inline error). */
  "aria-required"?: true;
  "aria-describedby"?: string;
  className?: string;
};

/** The control a `Field` styles: a text input, a select or a textarea. */
export type FieldKind = "input" | "select" | "textarea";

/** The classes for a field's control of `kind`: full width, with daisyUI's error style while there's an error. */
export const fieldControlClass = (kind: FieldKind, error: boolean) =>
  error ? `${kind} ${kind}-error w-full` : `${kind} w-full`;

/**
 * The control's props for a field with id `id`: required (`aria-required`)
 * when it is, invalid while there's an error, and described by the lines that are shown: its help, then its
 * error, or its warning while there's no error.
 */
export function fieldControl(
  id: string,
  {
    help,
    error,
    warning,
    required,
  }: { help?: boolean; error?: boolean; warning?: boolean; required?: boolean },
): FieldControl {
  const describedBy = [help && `${id}-help`, error ? `${id}-error` : warning && `${id}-warn`]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    ...(required && { "aria-required": true as const }),
    ...(error && { "aria-invalid": true as const }),
    ...(describedBy && { "aria-describedby": describedBy }),
  };
}
