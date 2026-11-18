import { describe, expect, it } from "vitest";
import { entryOpen, openRule } from "./entryOpen";

const G = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b8c0001";
const E = "11111111-2222-4333-8444-555555555555";
const GROUP = `/app/groups/${G}`;

describe("openRule (kind × role)", () => {
  it.each([
    ["note", true, "page"],
    ["note", false, "page"],
    ["event", true, "page"],
    ["event", false, "page"],
    ["symptom", true, "editSheet"],
    ["symptom", false, null],
    ["vital", true, "editSheet"],
    ["vital", false, null],
  ] as const)("%s, writer %s → %s", (kind, canWrite, rule) => {
    expect(openRule(kind, canWrite)).toBe(rule);
  });
});

describe("entryOpen", () => {
  it("opens a note's or event's page, without the filters", () => {
    expect(
      entryOpen({ groupId: G, entry: { id: E, kind: "note" }, canWrite: false, search: "?kind=note" }),
    ).toEqual({
      to: `${GROUP}/entries/${E}`,
      sheet: false,
    });
  });

  it("opens a symptom's edit sheet for a writer, keeping the filters", () => {
    expect(
      entryOpen({ groupId: G, entry: { id: E, kind: "symptom" }, canWrite: true, search: "?kind=symptom" }),
    ).toEqual({ to: `${GROUP}/timeline/${E}/edit?kind=symptom`, sheet: true });
  });

  it("opens nothing for a viewer's vital", () => {
    expect(
      entryOpen({ groupId: G, entry: { id: E, kind: "vital" }, canWrite: false, search: "" }),
    ).toBeUndefined();
  });
});
