/** The ids and ARIA attributes a field gives its control. */
export type FieldControl = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

/**
 * The control's props for a field with id `id`: invalid while there's an
 * error, and described by the lines that are shown: its help, then its
 * error, or its warning while there's no error.
 */
export function fieldControl(
  id: string,
  { help, error, warning }: { help?: boolean; error?: boolean; warning?: boolean },
): FieldControl {
  const describedBy = [help && `${id}-help`, error ? `${id}-error` : warning && `${id}-warn`]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    ...(error && { "aria-invalid": true as const }),
    ...(describedBy && { "aria-describedby": describedBy }),
  };
}
