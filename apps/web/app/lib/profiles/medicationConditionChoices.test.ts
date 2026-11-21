import { describe, expect, it } from "vitest";
import { conditionChoices, hasConditionChoices } from "./medicationConditionChoices";

const condition = (
  id: string,
  name: string,
  over: Partial<Parameters<typeof conditionChoices>[0]["conditions"][number]> = {},
) => ({
  id,
  name,
  status: "active" as const,
  sinceYear: null,
  sinceMonth: null,
  note: null,
  ...over,
});

const CONDITIONS = [
  condition("a", "Type 2 diabetes", { sinceYear: 2015 }),
  condition("b", "High blood pressure"),
  condition("c", "Hip fracture", { status: "resolved" }),
];

describe("conditionChoices", () => {
  it("offers the active conditions, most recent since first, with their since", () => {
    expect(conditionChoices({ conditions: CONDITIONS, linkedIds: [], chosenIds: [], text: "" })).toEqual([
      { id: "a", label: "Type 2 diabetes", description: "since 2015" },
      { id: "b", label: "High blood pressure" },
    ]);
  });

  it("offers a resolved one only when the medication is already for it", () => {
    const choices = conditionChoices({ conditions: CONDITIONS, linkedIds: ["c"], chosenIds: [], text: "" });
    expect(choices.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(choices[2]).toEqual({ id: "c", label: "Hip fracture", description: "Resolved" });
  });

  it("leaves out what's chosen and matches every typed word, case ignored", () => {
    expect(
      conditionChoices({ conditions: CONDITIONS, linkedIds: [], chosenIds: ["a"], text: "" }).map(
        (c) => c.id,
      ),
    ).toEqual(["b"]);
    expect(
      conditionChoices({ conditions: CONDITIONS, linkedIds: [], chosenIds: [], text: "PRESSURE high" }).map(
        (c) => c.id,
      ),
    ).toEqual(["b"]);
    expect(
      conditionChoices({ conditions: CONDITIONS, linkedIds: [], chosenIds: [], text: "asthma" }),
    ).toEqual([]);
  });
});

describe("hasConditionChoices", () => {
  it("is true with an active condition, or a resolved one already linked", () => {
    expect(hasConditionChoices(CONDITIONS, [])).toBe(true);
    expect(hasConditionChoices([CONDITIONS[2]!], [])).toBe(false);
    expect(hasConditionChoices([CONDITIONS[2]!], ["c"])).toBe(true);
    expect(hasConditionChoices([], [])).toBe(false);
  });
});
