import { describe, expect, it } from "vitest";
import {
  conditionChange,
  conditionChangeDetailsZSchema,
  conditionChangeId,
  conditionChangeText,
  conditionSinceWords,
} from "./conditionChange";
import { medicationChangeId } from "../medications/medication";

const DIABETES = {
  name: "Type 2 diabetes",
  status: "active" as const,
  sinceYear: 2015,
  sinceMonth: null,
  note: "Diet-controlled",
};
const ID = "6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d";

describe("conditionChange", () => {
  it("a new condition is added, with what's set", () => {
    expect(conditionChange(null, DIABETES)).toEqual({
      conditionName: "Type 2 diabetes",
      change: "added",
      after: {
        name: "Type 2 diabetes",
        status: "active",
        sinceYear: 2015,
        sinceMonth: null,
        note: "Diet-controlled",
      },
    });
    expect(
      conditionChange(null, {
        name: "Asthma",
        status: "active",
        sinceYear: null,
        sinceMonth: null,
        note: null,
      }),
    ).toEqual({ conditionName: "Asthma", change: "added", after: { name: "Asthma", status: "active" } });
  });

  it.each([
    {
      field: "name",
      after: { ...DIABETES, name: "Diabetes, type 2" },
      before: { name: "Type 2 diabetes" },
      changed: { name: "Diabetes, type 2" },
    },
    {
      field: "since",
      after: { ...DIABETES, sinceYear: 2014, sinceMonth: 3 },
      before: { sinceYear: 2015, sinceMonth: null },
      changed: { sinceYear: 2014, sinceMonth: 3 },
    },
    {
      field: "note",
      after: { ...DIABETES, note: null },
      before: { note: "Diet-controlled" },
      changed: { note: null },
    },
  ])(
    "an edit to $field is changed, with before and after for it alone",
    ({ field, after, before, changed }) => {
      expect(conditionChange(DIABETES, after)).toEqual({
        conditionName: after.name,
        change: "changed",
        fields: [field],
        before,
        after: changed,
      });
    },
  );

  it("a month alone counts as a since change", () => {
    expect(conditionChange(DIABETES, { ...DIABETES, sinceMonth: 6 })?.fields).toEqual(["since"]);
  });

  it("an edit that changes nothing records nothing (null and undefined are the same)", () => {
    expect(conditionChange(DIABETES, { ...DIABETES })).toBeNull();
    expect(
      conditionChange({ ...DIABETES, note: null }, { ...DIABETES, note: undefined as unknown as null }),
    ).toBeNull();
  });

  it("resolving and reactivating are their own changes, with any edits saved alongside", () => {
    const resolved = { ...DIABETES, status: "resolved" as const };
    expect(conditionChange(DIABETES, resolved)).toEqual({
      conditionName: "Type 2 diabetes",
      change: "resolved",
    });
    expect(conditionChange(resolved, DIABETES)).toEqual({
      conditionName: "Type 2 diabetes",
      change: "reactivated",
    });
    expect(conditionChange(DIABETES, { ...resolved, note: "In remission" })).toEqual({
      conditionName: "Type 2 diabetes",
      change: "resolved",
      fields: ["note"],
      before: { note: "Diet-controlled" },
      after: { note: "In remission" },
    });
  });

  it("builds details the timeline's schema accepts", () => {
    for (const change of [
      conditionChange(null, DIABETES),
      conditionChange(DIABETES, { ...DIABETES, sinceYear: null }),
      conditionChange(DIABETES, { ...DIABETES, status: "resolved" }),
    ])
      expect(conditionChangeDetailsZSchema.safeParse({ conditionId: ID, ...change }).success).toBe(true);
  });
});

describe("conditionChangeId", () => {
  it("is the same for the same save, whatever form the time takes, and differs from a medication's", () => {
    const id = conditionChangeId(ID, "2026-11-17T21:45:25.229Z");
    expect(conditionChangeId(ID.toUpperCase(), "2026-11-17 21:45:25.229000Z")).toBe(id);
    expect(conditionChangeId(ID, "2026-11-17T21:45:25.230Z")).not.toBe(id);
    expect(medicationChangeId(ID, "2026-11-17T21:45:25.229Z")).not.toBe(id);
  });

  it("refuses something that isn't a time", () => {
    expect(() => conditionChangeId(ID, "soon")).toThrow();
  });
});

describe("conditionChangeText", () => {
  const text = (
    before: Parameters<typeof conditionChange>[0],
    after: Parameters<typeof conditionChange>[1],
  ) => conditionChangeText({ conditionId: ID, ...conditionChange(before, after)! });

  it("an add names the condition, with what was set", () => {
    expect(text(null, DIABETES)).toEqual({
      heading: "Added Type 2 diabetes",
      lines: ["Since 2015 · Diet-controlled"],
    });
    expect(
      text(null, { name: "Hip fracture", status: "resolved", sinceYear: 2019, sinceMonth: 3, note: null }),
    ).toEqual({ heading: "Added Hip fracture", lines: ["Resolved · Since March 2019"] });
    expect(
      text(null, { name: "Asthma", status: "active", sinceYear: null, sinceMonth: null, note: null }),
    ).toEqual({ heading: "Added Asthma", lines: [] });
  });

  it("an edit is before → after, field by field", () => {
    expect(text(DIABETES, { ...DIABETES, sinceYear: 2014 })).toEqual({
      heading: "Changed Type 2 diabetes",
      lines: ["Since: 2015 → 2014"],
    });
    expect(text(DIABETES, { ...DIABETES, name: "Diabetes", sinceYear: null, note: "On insulin" })).toEqual({
      heading: "Changed Diabetes",
      lines: ["Name: Type 2 diabetes → Diabetes", "Since: 2015 → none", "Note: Diet-controlled → On insulin"],
    });
  });

  it("a resolve and a reactivate say so", () => {
    const hip = {
      name: "Hip fracture",
      status: "active" as const,
      sinceYear: null,
      sinceMonth: null,
      note: null,
    };
    const resolved = { ...hip, status: "resolved" as const };
    expect(text(hip, resolved)).toEqual({ heading: "Resolved Hip fracture", lines: [] });
    expect(text(resolved, hip)).toEqual({ heading: "Reactivated Hip fracture", lines: [] });
    expect(text(hip, { ...resolved, sinceYear: 2019 })).toEqual({
      heading: "Resolved Hip fracture",
      lines: ["Since: none → 2019"],
    });
  });
});

describe("conditionSinceWords", () => {
  it("is a year, a month and year, or nothing", () => {
    expect(conditionSinceWords(2015)).toBe("2015");
    expect(conditionSinceWords(2021, 3)).toBe("March 2021");
    expect(conditionSinceWords(2021, 12)).toBe("December 2021");
    expect(conditionSinceWords(null, 3)).toBeNull();
  });
});
