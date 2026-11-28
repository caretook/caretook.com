import type { ConditionLike } from "./conditions";

import { recipientConditionContentZSchema } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { conditionState, conditionText, sinceText } from "./conditions";
import { sortConditions } from "@caretook/data/domain";

let n = 0;
const condition = (overrides: Partial<ConditionLike> = {}): ConditionLike => ({
  id: `c${++n}`,
  name: "Asthma",
  status: "active",
  sinceYear: null,
  sinceMonth: null,
  note: null,
  ...overrides,
});

describe("sortConditions", () => {
  it("puts active first, the most recent since first (none last), then by name", () => {
    const sorted = sortConditions([
      condition({ name: "Pneumonia", status: "resolved", sinceYear: 2025, sinceMonth: 11 }),
      condition({ name: "Gout" }),
      condition({ name: "High blood pressure", sinceYear: 2012 }),
      condition({ name: "Type 2 diabetes", sinceYear: 2016, sinceMonth: 3 }),
      condition({ name: "Glaucoma", sinceYear: 2016, sinceMonth: 9 }),
      condition({ name: "Anemia", sinceYear: 2016 }),
      condition({ name: "asthma" }),
      condition({ name: "Hip fracture", status: "resolved", sinceYear: 2019 }),
    ]);
    expect(sorted.map((c) => c.name)).toEqual([
      "Glaucoma",
      "Type 2 diabetes",
      "Anemia",
      "High blood pressure",
      "asthma",
      "Gout",
      "Pneumonia",
      "Hip fracture",
    ]);
  });
});

describe("the since and the summary", () => {
  it("says a year, or a month and year, or nothing", () => {
    expect(sinceText({ sinceYear: 2015, sinceMonth: null })).toBe("since 2015");
    expect(sinceText({ sinceYear: 2021, sinceMonth: 3 })).toBe("since March 2021");
    expect(sinceText({ sinceYear: null, sinceMonth: null })).toBeNull();
  });

  it("is one line: the name, then resolved, the since and the note", () => {
    expect(
      conditionText(condition({ name: "Type 2 diabetes", sinceYear: 2015, note: "Diet-controlled" })),
    ).toBe("Type 2 diabetes (since 2015; Diet-controlled)");
    expect(
      conditionText(condition({ name: "Hip fracture", status: "resolved", sinceYear: 2019, sinceMonth: 3 })),
    ).toBe("Hip fracture (resolved; since March 2019)");
    expect(conditionText(condition({ name: "Asthma", note: "  " }))).toBe("Asthma");
  });
});

describe("conditionState", () => {
  it("splits what's on file into active and past, over a stale No known conditions", () => {
    const state = conditionState(
      [condition({ name: "Gout", status: "resolved" }), condition({ name: "Asthma" })],
      "2026-11-01T00:00:00.000000Z",
    );
    expect(state.kind).toBe("recorded");
    if (state.kind !== "recorded") return;
    expect(state.active.map((c) => c.name)).toEqual(["Asthma"]);
    expect(state.past.map((c) => c.name)).toEqual(["Gout"]);
  });

  it("is No known conditions, or not recorded, when none are on file", () => {
    expect(conditionState([], "2026-11-01T00:00:00.000000Z")).toEqual({ kind: "none" });
    expect(conditionState([], null)).toEqual({ kind: "notRecorded" });
  });
});

describe("a condition's content", () => {
  const parse = (input: Record<string, unknown>) =>
    recipientConditionContentZSchema.safeParse({ name: "Asthma", ...input });
  const issues = (input: Record<string, unknown>) => {
    const res = parse(input);
    return res.success ? [] : res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  };

  it("refuses a month without a year", () => {
    expect(issues({ sinceMonth: 3 })).toEqual(["sinceYear: Enter the year too"]);
    expect(parse({ sinceMonth: 3, sinceYear: 2021 }).success).toBe(true);
  });

  it("refuses an empty name, a year out of range, a month out of range and a year that isn't a number", () => {
    expect(issues({ name: " " })).toEqual(["name: Enter the condition"]);
    expect(issues({ sinceYear: 1899 })).toEqual(["sinceYear: Enter a year from 1900"]);
    expect(issues({ sinceYear: 2015, sinceMonth: 0 })).toEqual(["sinceMonth: Choose a month"]);
    expect(issues({ sinceYear: Number.NaN })).toEqual(["sinceYear: Enter a year, such as 2015"]);
  });

  it("trims, defaults to active and turns an empty note into none", () => {
    expect(parse({ name: " Gout ", note: "" })).toMatchObject({
      success: true,
      data: { name: "Gout", status: "active", sinceYear: null, sinceMonth: null, note: null },
    });
  });
});
