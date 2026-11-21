import type { ConditionStatus } from "@caretook/data/schema";

// The recipient's conditions, in words: their order (active first), the
// "since" text, a condition's one-line summary and the card's states. Pure:
// web:unit tests it; the profile's card and sheets use it (and later the
// printed sheets and the assistant).

export type ConditionLike = {
  id: string;
  name: string;
  status: ConditionStatus;
  sinceYear: number | null;
  sinceMonth: number | null;
  note: string | null;
};

export const CONDITION_STATUS_LABELS: Record<ConditionStatus, string> = {
  active: "Active",
  resolved: "Resolved",
};

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** A since as one number for ordering: later is bigger; no since is smallest; a year alone sorts as its start. */
const sinceKey = ({ sinceYear, sinceMonth }: Pick<ConditionLike, "sinceYear" | "sinceMonth">) =>
  sinceYear === null ? -1 : sinceYear * 13 + (sinceMonth ?? 0);

/**
 * Active first, then resolved; within each, the most recent since first
 * (none last), then by name.
 */
export const sortConditions = <C extends ConditionLike>(conditions: readonly C[]): C[] =>
  [...conditions].sort(
    (a, b) =>
      (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) ||
      sinceKey(b) - sinceKey(a) ||
      collator.compare(a.name, b.name) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

/** "2015", "March 2021", or null when there's no since. */
export const sinceDate = ({ sinceYear, sinceMonth }: Pick<ConditionLike, "sinceYear" | "sinceMonth">) => {
  if (sinceYear === null) return null;
  const month = sinceMonth !== null ? MONTH_NAMES[sinceMonth - 1] : undefined;
  return month ? `${month} ${sinceYear}` : String(sinceYear);
};

/** "since 2015", "since March 2021", or null. */
export const sinceText = (condition: Pick<ConditionLike, "sinceYear" | "sinceMonth">) => {
  const date = sinceDate(condition);
  return date ? `since ${date}` : null;
};

/**
 * One line for print and the assistant: "Type 2 diabetes (since 2015;
 * diet-controlled)", "Hip fracture (resolved; since March 2019)",
 * "Asthma".
 */
export const conditionText = ({ name, status, sinceYear, sinceMonth, note }: Omit<ConditionLike, "id">) => {
  const details = [
    status === "resolved" ? "resolved" : null,
    sinceText({ sinceYear, sinceMonth }),
    note?.trim() || null,
  ].filter(Boolean);
  return details.length ? `${name} (${details.join("; ")})` : name;
};

/** The card's three states: conditions on file (active and past), "No known conditions", or nothing recorded yet. */
export type ConditionState<C extends ConditionLike = ConditionLike> =
  { kind: "recorded"; active: C[]; past: C[] } | { kind: "none" } | { kind: "notRecorded" };

/** Conditions on file win over a stale "No known conditions" (adding one clears it anyway). */
export const conditionState = <C extends ConditionLike>(
  conditions: readonly C[],
  noKnownConditionsAt: string | null,
): ConditionState<C> => {
  if (!conditions.length) return noKnownConditionsAt ? { kind: "none" } : { kind: "notRecorded" };
  const sorted = sortConditions(conditions);
  return {
    kind: "recorded",
    active: sorted.filter((c) => c.status === "active"),
    past: sorted.filter((c) => c.status !== "active"),
  };
};

export const NO_KNOWN_CONDITIONS = "No known conditions";
export const CONDITIONS_NOT_RECORDED = "Conditions not recorded";
