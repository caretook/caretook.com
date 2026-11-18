import type { UnitChoices, VitalFieldSpec } from "@caretook/data/schema";

import { BRISTOL_TYPES, fromDisplay, isUnusual, toDisplay } from "@caretook/data/schema";

// How one vital field's input behaves: what it shows, what it offers, when it warns.

/** The Bristol type is a choice from a scale, not a measurement: its options. */
export const bristolOptions = Object.entries(BRISTOL_TYPES).map(([n, text]) => ({
  value: n,
  label: `Type ${n}: ${text}`,
}));

/** Is this field a choice from a scale (a select) rather than a number? */
export const isChoiceField = (field: VitalFieldSpec) => field.key === "bristol";

/** A stored (canonical) value as the input shows it, in the user's units; "" for none. */
export const inputValue = (field: VitalFieldSpec, value: unknown, units: UnitChoices) =>
  typeof value === "number" ? String(toDisplay(field, value, units)) : "";

/** Is what's typed (a number in the user's units, NaN when blank) outside the typical range? */
export const isUnusualInput = (field: VitalFieldSpec, typed: number, units: UnitChoices) =>
  !Number.isNaN(typed) && isUnusual(field, fromDisplay(field, typed, units));
