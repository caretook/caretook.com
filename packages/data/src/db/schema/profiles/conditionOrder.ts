import type { ConditionStatus } from "./recipientCondition";

// The order a recipient's conditions are shown in, shared by the profile's
// screens and the connected assistant: active first, then resolved; within
// each, the most recent "since" first (none last), then by name.

export type ConditionOrderable = {
  id: string;
  name: string;
  status: ConditionStatus;
  sinceYear: number | null;
  sinceMonth: number | null;
};

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** A since as one number for ordering: later is bigger; no since is smallest; a year alone sorts as its start. */
const sinceKey = ({ sinceYear, sinceMonth }: Pick<ConditionOrderable, "sinceYear" | "sinceMonth">) =>
  sinceYear === null ? -1 : sinceYear * 13 + (sinceMonth ?? 0);

export const sortConditions = <C extends ConditionOrderable>(conditions: readonly C[]): C[] =>
  [...conditions].sort(
    (a, b) =>
      (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) ||
      sinceKey(b) - sinceKey(a) ||
      collator.compare(a.name, b.name) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
