import type { CompletionName } from "./quickEntryCompletion";

import { describe, expect, it } from "vitest";
import { completeName } from "./quickEntryCompletion";

const NAMES: CompletionName[] = [
  { id: "m1", name: "Metformin", kind: "medication" },
  { id: "m2", name: "Metoprolol", kind: "medication" },
  { id: "m3", name: "Folic acid", kind: "medication" },
  { id: "m4", name: "Acetaminophen", kind: "medication" },
  { id: "p1", name: "Dr. Sandra Lee", kind: "provider" },
  { id: "p2", name: "Leeward Pharmacy", kind: "provider" },
  { id: "p3", name: "Dr. José Núñez", kind: "provider" },
];

const offered = (text: string) => completeName(text, NAMES).map((c) => c.name);
const completed = (text: string, name: string) =>
  completeName(text, NAMES).find((c) => c.name === name)?.text;

describe("completeName", () => {
  it("offers the names the last word starts, first words first, medications before providers", () => {
    expect(offered("gave met")).toEqual(["Metformin", "Metoprolol"]);
    expect(offered("appt with le")).toEqual(["Leeward Pharmacy", "Dr. Sandra Lee"]);
    expect(offered("gave ac")).toEqual(["Acetaminophen", "Folic acid"]);
  });

  it("offers pass names too, after medications and before providers", () => {
    const names: CompletionName[] = [
      ...NAMES,
      { id: "x1", name: "Evening", kind: "pass" },
      { id: "x2", name: "Lean morning", kind: "pass" },
    ];
    expect(completeName("gave eve", names).map((c) => c.text)).toEqual(["gave Evening "]);
    expect(completeName("appt le", names).map((c) => c.name)).toEqual([
      "Lean morning",
      "Leeward Pharmacy",
      "Dr. Sandra Lee",
    ]);
  });

  it("completes the word, keeping the rest of the line", () => {
    expect(completed("bp 120/80, gave met", "Metformin")).toBe("bp 120/80, gave Metformin ");
    expect(completed("gave folic ac", "Folic acid")).toBe("gave Folic acid ");
  });

  it("takes in a title or first name typed before it", () => {
    expect(completed("appt dr le", "Dr. Sandra Lee")).toBe("appt Dr. Sandra Lee ");
    expect(completed("appt with Dr. sandra le", "Dr. Sandra Lee")).toBe("appt with Dr. Sandra Lee ");
    expect(completed("appt with sandra le", "Dr. Sandra Lee")).toBe("appt with Dr. Sandra Lee ");
  });

  it("ignores case and accents, and never matches a title alone", () => {
    expect(offered("see NUN")).toEqual(["Dr. José Núñez"]);
    expect(offered("see jos")).toEqual(["Dr. José Núñez"]);
    expect(offered("see dr")).toEqual([]);
  });

  it("offers nothing for a short, finished or unmatched word", () => {
    expect(offered("")).toEqual([]);
    expect(offered("gave m")).toEqual([]);
    expect(offered("gave met ")).toEqual([]);
    expect(offered("gave metformin")).toEqual([]);
    expect(offered("pain 4 left knee")).toEqual([]);
    expect(offered("bp 120/80")).toEqual([]);
  });

  it("only looks at the part being typed", () => {
    expect(offered("gave met, pain 4")).toEqual([]);
    expect(offered("pain 4; met")).toEqual(["Metformin", "Metoprolol"]);
  });

  it("offers each name once, at most four", () => {
    const many: CompletionName[] = [
      ...NAMES,
      { id: "m5", name: "metformin", kind: "medication" },
      { id: "m6", name: "Methotrexate", kind: "medication" },
      { id: "m7", name: "Methadone", kind: "medication" },
    ];
    const names = completeName("gave met", many).map((c) => c.name);
    expect(names).toHaveLength(4);
    expect(names.filter((n) => n.toLowerCase() === "metformin")).toHaveLength(1);
  });
});
