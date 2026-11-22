import type { CheckFieldProps } from "./CheckField";

import { CheckRow } from "./CheckField";

/**
 * A switch: a native checkbox with the `switch` role (an on/off setting saved
 * as it changes), laid out as `CheckField` is: the label beside it (tapping
 * it toggles), its help and error under it, describing it.
 */
export function ToggleField(props: CheckFieldProps) {
  return <CheckRow {...props} look="toggle" />;
}
