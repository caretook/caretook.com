import type { ConditionLike } from "./conditions";

import { sinceText, sortConditions } from "./conditions";

// The medication form's "For" field (conditions slice 4): which of the
// recipient's conditions it offers. Pure: web:unit tests it.

export type ConditionChoice = { id: string; label: string; description?: string };

/**
 * The conditions a medication can be said to be for, matching every typed
 * word (case ignored) in the name: the live active ones, and a resolved one
 * only when the medication is already for it (so an edit keeps it). Ones
 * already chosen are left out. Active first, as the profile orders them.
 */
export const conditionChoices = ({
  conditions,
  linkedIds,
  chosenIds,
  text,
}: {
  conditions: readonly ConditionLike[];
  /** What the medication was for when the form opened. */
  linkedIds: readonly string[];
  chosenIds: readonly string[];
  text: string;
}): ConditionChoice[] => {
  const words = text.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return sortConditions(
    conditions.filter(
      (c) =>
        (c.status === "active" || linkedIds.includes(c.id)) &&
        !chosenIds.includes(c.id) &&
        words.every((w) => c.name.toLocaleLowerCase().includes(w)),
    ),
  ).map((c) => {
    const description = c.status === "resolved" ? "Resolved" : sinceText(c);
    return description ? { id: c.id, label: c.name, description } : { id: c.id, label: c.name };
  });
};

/** Whether the form has anything to offer or show: a condition it could pick, or one already chosen. */
export const hasConditionChoices = (conditions: readonly ConditionLike[], linkedIds: readonly string[]) =>
  conditions.some((c) => c.status === "active" || linkedIds.includes(c.id));
