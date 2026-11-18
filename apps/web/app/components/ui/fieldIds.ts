/** The ids and ARIA attributes a field gives its control. */
export type FieldControl = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

/**
 * The control's props for a field with id `id`: invalid while there's an
 * error, and described by its help and error lines (those that are shown).
 */
export function fieldControl(id: string, { help, error }: { help?: boolean; error?: boolean }): FieldControl {
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ");
  return {
    id,
    ...(error && { "aria-invalid": true as const }),
    ...(describedBy && { "aria-describedby": describedBy }),
  };
}
