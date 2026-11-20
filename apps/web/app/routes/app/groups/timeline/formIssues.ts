import type { FieldIssue } from "../../../../lib/core/api";
import type { UnitChoices, VitalFieldSpec } from "@caretook/data/schema";

import { BP_ORDER_MESSAGE, fieldRange, fieldUnitLabel } from "@caretook/data/schema";

// Which of a save's issues each EntryForm field shows, and in what words.

// Plain-language messages for the fields people most often miss. The
// server's Zod messages ("Too small: expected string…") aren't for users.
const FRIENDLY: Record<string, string> = {
  "details.name": "Name the symptom.",
  details: "Name the symptom.",
  occurredAt: "Enter a date and time.",
};

/** The message for the first issue on any of `paths`, friendly where we have words for it. */
export const issueFor = (issues: FieldIssue[], ...paths: string[]) => {
  const issue = issues.find((i) => paths.includes(i.path));
  return issue ? (FRIENDLY[issue.path] ?? issue.message) : undefined;
};

/** A problem with the readings list itself (none, or a type twice), in words. */
export const readingsIssue = (issues: FieldIssue[]) =>
  issues.some((i) => i.path === "details.readings" || i.path === "details")
    ? "Add at least one reading, each type once."
    : undefined;

/**
 * The message for one field of the reading at `index`: an issue on the field,
 * or on the whole reading, in words that name the range in the user's units.
 * Blood pressure's order rule is shown as it is.
 */
export const vitalFieldIssue = (
  issues: FieldIssue[],
  index: number,
  field: VitalFieldSpec,
  units: UnitChoices,
) => {
  const issue = issues.find(
    (i) => i.path === `details.readings.${index}.${field.key}` || i.path === `details.readings.${index}`,
  );
  if (!issue) return undefined;
  if (issue.message === BP_ORDER_MESSAGE) return issue.message;
  const { min, max } = fieldRange(field, units);
  const unit = fieldUnitLabel(field, units);
  const range = `${min.toLocaleString()} to ${max.toLocaleString()}${unit && unit !== "/10" ? ` ${unit}` : ""}`;
  const what = field.integer ? "a whole number" : "a number";
  return field.optional ? `Leave it blank or enter ${what} from ${range}.` : `Enter ${what} from ${range}.`;
};
